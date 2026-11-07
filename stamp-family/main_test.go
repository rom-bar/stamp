package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

func testDB(t *testing.T) *app {
	t.Helper()
	db, err := openDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return &app{db: db}
}

func insertTestFamily(t *testing.T, a *app, id, name string) userSession {
	t.Helper()
	if _, err := a.db.Exec(`INSERT INTO families(id,name,created_at) VALUES(?,?,?)`, id, name, timestamp()); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`INSERT INTO users(id,family_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)`, "user-"+id, id, "user_"+id, "hash", "admin", timestamp()); err != nil {
		t.Fatal(err)
	}
	return userSession{ID: "user-" + id, Username: "user_" + id, Role: "admin", FamilyID: id, Family: name}
}

func operation(id, kind string, payload any) syncOperation {
	b, _ := json.Marshal(payload)
	return syncOperation{ID: id, Kind: kind, Payload: b}
}

func TestFamilyStarterCatalogHasFortyOneReasonsAndIsIdempotent(t *testing.T) {
	a := testDB(t)
	u := insertTestFamily(t, a, "family-starter", "Starter Family")
	for i := 0; i < 2; i++ {
		tx, err := a.db.Begin()
		if err != nil {
			t.Fatal(err)
		}
		if err = seedFamilyCatalogTx(tx, u.FamilyID); err != nil {
			tx.Rollback()
			t.Fatal(err)
		}
		if err = tx.Commit(); err != nil {
			t.Fatal(err)
		}
	}
	var reasonCount, designCount int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM reasons WHERE family_id=?`, u.FamilyID).Scan(&reasonCount); err != nil {
		t.Fatal(err)
	}
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM stamp_designs WHERE family_id=? AND id=?`, u.FamilyID, reasonStampDesignID(u.FamilyID)).Scan(&designCount); err != nil {
		t.Fatal(err)
	}
	if reasonCount != 41 || len(starterStampReasons) != 41 || designCount != 1 {
		t.Fatalf("expected 41 starter reasons and one internal emoji design; got %d reasons, %d catalog reasons, %d designs", reasonCount, len(starterStampReasons), designCount)
	}
	snapshot, err := a.snapshot(u)
	if err != nil {
		t.Fatal(err)
	}
	for _, design := range snapshot.Designs {
		if design.ID == reasonStampDesignID(u.FamilyID) && !design.System {
			t.Fatal("internal reason-driven stamp design should be marked system-only")
		}
	}
}

func TestOperationReplayIsIdempotentAndFamilyScoped(t *testing.T) {
	a := testDB(t)
	u1 := insertTestFamily(t, a, "family-a", "Family A")
	u2 := insertTestFamily(t, a, "family-b", "Family B")
	childA := operation("op-child-a", "child.add", map[string]any{"id": "child-a", "name": "Ari", "color": "#f2b66d"})
	if err := a.applyOperation(u1, childA); err != nil {
		t.Fatal(err)
	}
	if err := a.applyOperation(u1, childA); err != nil {
		t.Fatalf("replayed operation should succeed: %v", err)
	}
	s1, err := a.snapshot(u1)
	if err != nil {
		t.Fatal(err)
	}
	if len(s1.Children) != 1 {
		t.Fatalf("family A should have one child after replay, got %d", len(s1.Children))
	}

	if _, err = a.db.Exec(`INSERT INTO children(id,family_id,name,color,created_at) VALUES(?,?,?,?,?)`, "child-b", "family-b", "Bima", "#f2b66d", timestamp()); err != nil {
		t.Fatal(err)
	}
	if _, err = a.db.Exec(`INSERT INTO reasons(id,family_id,name,emoji,active) VALUES(?,?,?,?,1)`, "reason-b", "family-b", "Membantu", "⭐"); err != nil {
		t.Fatal(err)
	}
	if _, err = a.db.Exec(`INSERT INTO stamp_designs(id,family_id,name,emoji,color,active) VALUES(?,?,?,?,?,1)`, "design-b", "family-b", "Bintang", "⭐", "#f2b66d"); err != nil {
		t.Fatal(err)
	}
	crossFamily := operation("op-cross-family", "stamp.give", map[string]any{"id": "stamp-cross", "childId": "child-b", "reasonId": "reason-b", "designId": "design-b"})
	if err := a.applyOperation(u1, crossFamily); err == nil {
		t.Fatal("cross-family stamp operation should be rejected")
	}
	s1, err = a.snapshot(u1)
	if err != nil {
		t.Fatal(err)
	}
	if len(s1.Stamps) != 0 {
		t.Fatalf("family A should not receive cross-family stamps, got %d", len(s1.Stamps))
	}
	_ = u2
}

func TestStampAwardAndRewardCannotOverdraw(t *testing.T) {
	a := testDB(t)
	u := insertTestFamily(t, a, "family-a", "Family A")
	for _, q := range []string{
		`INSERT INTO children(id,family_id,name,color,created_at) VALUES('child-a','family-a','Ari','#f2b66d','2026-01-01T00:00:00Z')`,
		`INSERT INTO reasons(id,family_id,name,emoji,active) VALUES('reason-a','family-a','Membantu','⭐',1)`,
		`INSERT INTO stamp_designs(id,family_id,name,emoji,color,active) VALUES('design-a','family-a','Bintang','⭐','#f2b66d',1)`,
		`INSERT INTO rewards(id,family_id,name,description,goal,active) VALUES('reward-a','family-a','Pilih cerita','',2,1)`,
	} {
		if _, err := a.db.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	award := operation("op-stamp", "stamp.give", map[string]any{"id": "stamp-a", "childId": "child-a", "reasonId": "reason-a", "designId": "design-a"})
	if err := a.applyOperation(u, award); err != nil {
		t.Fatal(err)
	}
	if err := a.applyOperation(u, operation("op-redeem-too-early", "reward.redeem", map[string]any{"id": "redemption-early", "childId": "child-a", "rewardId": "reward-a"})); err == nil {
		t.Fatal("reward must be rejected when there are not enough stamps")
	}
	secondAward := operation("op-stamp-2", "stamp.give", map[string]any{"id": "stamp-b", "childId": "child-a", "reasonId": "reason-a", "designId": "design-a"})
	if err := a.applyOperation(u, secondAward); err != nil {
		t.Fatal(err)
	}
	if err := a.applyOperation(u, operation("op-redeem-ok", "reward.redeem", map[string]any{"id": "redemption-ok", "childId": "child-a", "rewardId": "reward-a"})); err != nil {
		t.Fatal(err)
	}
	s, err := a.snapshot(u)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Stamps) != 2 || len(s.Redemptions) != 1 {
		t.Fatalf("expected 2 stamps and 1 redemption; got %d and %d", len(s.Stamps), len(s.Redemptions))
	}
}

func TestJournalEntriesAreSharedOnlyAndFamilyScoped(t *testing.T) {
	a := testDB(t)
	adminA := insertTestFamily(t, a, "family-a", "Family A")
	userB := insertTestFamily(t, a, "family-b", "Family B")
	memberA := adminA
	memberA.Role = "member"

	shared := operation("journal-op-0001", "journal.add", map[string]any{
		"id": "entry-shared-a", "date": "2026-11-04", "title": "Piknik sore",
		"body": "Kami melihat matahari terbenam.", "shared": true,
	})
	if err := a.applyOperation(memberA, shared); err != nil {
		t.Fatalf("family member should be able to share a journal entry: %v", err)
	}
	if err := a.applyOperation(memberA, shared); err != nil {
		t.Fatalf("replaying a shared journal operation should be idempotent: %v", err)
	}
	if err := a.applyOperation(memberA, operation("journal-private-01", "journal.add", map[string]any{
		"id": "entry-private", "date": "2026-11-04", "title": "Catatan pribadi", "shared": false,
	})); err == nil {
		t.Fatal("private journal entries must not be accepted by family sync")
	}
	if err := a.applyOperation(memberA, operation("journal-bad-date-01", "journal.add", map[string]any{
		"id": "entry-bad-date", "date": "2026-02-30", "title": "Tanggal tidak valid", "shared": true,
	})); err == nil {
		t.Fatal("invalid journal dates should be rejected")
	}

	snapshotA, err := a.snapshot(adminA)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotA.Journals) != 1 || snapshotA.Journals[0].Title != "Piknik sore" || !snapshotA.Journals[0].Shared {
		t.Fatalf("family A should contain exactly its shared journal entry, got %#v", snapshotA.Journals)
	}
	snapshotB, err := a.snapshot(userB)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotB.Journals) != 0 {
		t.Fatalf("family B must not see family A journals, got %#v", snapshotB.Journals)
	}
}

func TestJournalDrawingDataValidation(t *testing.T) {
	if err := validateDrawingData("data:image/jpeg;base64,/9j/"); err != nil {
		t.Fatalf("valid JPEG signature should be accepted: %v", err)
	}
	for _, invalid := range []string{
		"data:image/svg+xml;base64,PHN2Zz4=",
		"data:image/jpeg;base64,not-base64",
		"data:image/jpeg;base64,AA==",
	} {
		if err := validateDrawingData(invalid); err == nil {
			t.Fatalf("invalid drawing data should be rejected: %q", invalid)
		}
	}
}

func TestActivityJournalSocialOperationsAreFamilyScopedAndIdempotent(t *testing.T) {
	a := testDB(t)
	familyA := insertTestFamily(t, a, "family-a", "Family A")
	familyB := insertTestFamily(t, a, "family-b", "Family B")

	activity := operation("activity-op-0001", "activity.add", map[string]any{
		"id": "activity-a", "date": "2026-11-04", "title": "Gambar bersama", "prompt": "Gambar tempat bahagia.",
	})
	if err := a.applyOperation(familyA, activity); err != nil {
		t.Fatalf("create activity: %v", err)
	}
	journal := operation("journal-op-0002", "journal.add", map[string]any{
		"id": "entry-a", "date": "2026-11-04", "title": "Kenangan bersama", "body": "Kami menggambar.", "shared": true, "activityId": "activity-a",
	})
	if err := a.applyOperation(familyA, journal); err != nil {
		t.Fatalf("create activity journal: %v", err)
	}
	comment := operation("comment-op-0003", "journal.comment.add", map[string]any{
		"id": "comment-a", "journalId": "entry-a", "body": "Bagus sekali!",
	})
	if err := a.applyOperation(familyA, comment); err != nil {
		t.Fatalf("add comment: %v", err)
	}
	reaction := operation("reaction-op-0004", "journal.react.toggle", map[string]any{
		"id": "reaction-a", "journalId": "entry-a", "emoji": "👏",
	})
	if err := a.applyOperation(familyA, reaction); err != nil {
		t.Fatalf("add reaction: %v", err)
	}
	if err := a.applyOperation(familyA, reaction); err != nil {
		t.Fatalf("replaying reaction should be idempotent: %v", err)
	}

	snapshotA, err := a.snapshot(familyA)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotA.Activities) != 1 || len(snapshotA.Journals) != 1 || snapshotA.Journals[0].ActivityID != "activity-a" {
		t.Fatalf("family A activity/journal mismatch: activities=%#v journals=%#v", snapshotA.Activities, snapshotA.Journals)
	}
	if len(snapshotA.JournalComments) != 1 || snapshotA.JournalComments[0].Body != "Bagus sekali!" {
		t.Fatalf("family A comment missing: %#v", snapshotA.JournalComments)
	}
	if len(snapshotA.JournalReactions) != 1 || snapshotA.JournalReactions[0].Emoji != "👏" {
		t.Fatalf("reaction replay should not duplicate or toggle: %#v", snapshotA.JournalReactions)
	}

	if err := a.applyOperation(familyB, operation("cross-comment-0005", "journal.comment.add", map[string]any{
		"id": "cross-comment", "journalId": "entry-a", "body": "Cross-family comment",
	})); err == nil {
		t.Fatal("cross-family comments must be rejected")
	}
	if err := a.applyOperation(familyB, operation("cross-react-0006", "journal.react.toggle", map[string]any{
		"id": "cross-reaction", "journalId": "entry-a", "emoji": "👍",
	})); err == nil {
		t.Fatal("cross-family reactions must be rejected")
	}
	if err := a.applyOperation(familyB, operation("cross-response-0007", "journal.add", map[string]any{
		"id": "cross-response", "date": "2026-11-04", "title": "Cross-family", "shared": true, "activityId": "activity-a",
	})); err == nil {
		t.Fatal("cross-family activity references must be rejected")
	}
	if err := a.applyOperation(familyA, operation("bad-emoji-op-0008", "journal.react.toggle", map[string]any{
		"id": "bad-emoji", "journalId": "entry-a", "emoji": "<script>",
	})); err == nil {
		t.Fatal("unsupported reaction emoji must be rejected")
	}
	if err := a.applyOperation(familyA, operation("bad-date-op-0009", "activity.add", map[string]any{
		"id": "bad-date-activity", "date": "2026-02-30", "title": "Tanggal tidak valid", "prompt": "x",
	})); err == nil {
		t.Fatal("invalid activity dates must be rejected")
	}
	if err := a.applyOperation(familyA, operation("long-activity-op-0010", "activity.add", map[string]any{
		"id": "long-activity", "date": "2026-11-04", "title": strings.Repeat("x", 121), "prompt": "x",
	})); err == nil {
		t.Fatal("activity titles over the limit must be rejected")
	}
	if err := a.applyOperation(familyA, operation("long-comment-op-0011", "journal.comment.add", map[string]any{
		"id": "long-comment", "journalId": "entry-a", "body": strings.Repeat("x", 501),
	})); err == nil {
		t.Fatal("comments over the limit must be rejected")
	}

	snapshotB, err := a.snapshot(familyB)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotB.Activities) != 0 || len(snapshotB.Journals) != 0 || len(snapshotB.JournalComments) != 0 || len(snapshotB.JournalReactions) != 0 {
		t.Fatalf("family B must not see family A collaboration data: %#v", snapshotB)
	}
}

func TestMigrationAddsActivityIDToLegacyJournalEntries(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE journal_entries (
		id TEXT PRIMARY KEY, family_id TEXT NOT NULL, entry_date TEXT NOT NULL,
		title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', drawing TEXT NOT NULL DEFAULT '',
		created_by TEXT NOT NULL, created_at TEXT NOT NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO journal_entries(id,family_id,entry_date,title,body,drawing,created_by,created_at) VALUES('legacy-entry','family-a','2026-11-04','Lama','Tetap ada','','user-a','2026-11-04T00:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	if err := migrate(db); err != nil {
		t.Fatalf("migrate old schema: %v", err)
	}
	var activityID string
	if err := db.QueryRow(`SELECT activity_id FROM journal_entries WHERE id='legacy-entry'`).Scan(&activityID); err != nil {
		t.Fatalf("activity_id column missing after migration: %v", err)
	}
	var title string
	if err := db.QueryRow(`SELECT title FROM journal_entries WHERE id='legacy-entry'`).Scan(&title); err != nil || title != "Lama" {
		t.Fatalf("legacy journal data must be preserved; title=%q err=%v", title, err)
	}
}

func TestJournalMediaAndCalendarAssignmentsAreFamilyScoped(t *testing.T) {
	a := testDB(t)
	adminA := insertTestFamily(t, a, "family-a", "Family A")
	familyB := insertTestFamily(t, a, "family-b", "Family B")
	if _, err := a.db.Exec(`INSERT INTO users(id,family_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)`, "member-a", "family-a", "member_a", "hash", "member", timestamp()); err != nil {
		t.Fatal(err)
	}
	memberA := adminA
	memberA.ID, memberA.Username, memberA.Role = "member-a", "member_a", "member"
	if _, err := a.db.Exec(`INSERT INTO journal_media(id,family_id,media_type,data,created_at) VALUES(?,?,?,?,?)`, "media-family-a", "family-a", "image/png", []byte("\x89PNG\r\n\x1a\nmedia"), timestamp()); err != nil {
		t.Fatal(err)
	}
	journal := operation("media-journal-op-01", "journal.add", map[string]any{
		"id": "media-journal-a", "date": "2026-11-05", "title": "Media memory", "shared": true, "mediaIds": []string{"media-family-a"},
	})
	if err := a.applyOperation(memberA, journal); err != nil {
		t.Fatalf("family member should be able to attach family media: %v", err)
	}
	if err := a.applyOperation(familyB, operation("media-cross-family-op", "journal.add", map[string]any{
		"id": "media-journal-b", "date": "2026-11-05", "title": "Cross-family", "shared": true, "mediaIds": []string{"media-family-a"},
	})); err == nil {
		t.Fatal("cross-family media references must be rejected")
	}
	snapshotA, err := a.snapshot(adminA)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotA.Journals) != 1 || len(snapshotA.Journals[0].Media) != 1 || snapshotA.Journals[0].Media[0].ID != "media-family-a" {
		t.Fatalf("family snapshot should include linked media metadata: %#v", snapshotA.Journals)
	}

	calendarTask := operation("calendar-member-op-01", "calendar.add", map[string]any{
		"id": "calendar-task-a", "date": "2026-11-06", "time": "09:30", "title": "Member task", "kind": "task", "assigneeId": "member-a",
	})
	if err := a.applyOperation(memberA, calendarTask); err != nil {
		t.Fatalf("member should be able to create a family task assigned to a member: %v", err)
	}
	if err := a.applyOperation(adminA, operation("calendar-foreign-assignee-op", "calendar.add", map[string]any{
		"id": "calendar-foreign-task", "date": "2026-11-06", "time": "10:00", "title": "Foreign task", "kind": "task", "assigneeId": familyB.ID,
	})); err == nil {
		t.Fatal("calendar assignments to another family must be rejected")
	}
	snapshotA, err = a.snapshot(adminA)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotA.Activities) != 1 || snapshotA.Activities[0].Kind != "task" || snapshotA.Activities[0].Time != "09:30" || snapshotA.Activities[0].AssigneeID != "member-a" {
		t.Fatalf("calendar schedule and assignment should be preserved: %#v", snapshotA.Activities)
	}
	snapshotB, err := a.snapshot(familyB)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshotB.Journals) != 0 || len(snapshotB.Activities) != 0 {
		t.Fatalf("family B must not see family A media/journal/calendar data: %#v", snapshotB)
	}
}

func TestMediaContentValidation(t *testing.T) {
	validPNG := base64.StdEncoding.EncodeToString([]byte("\x89PNG\r\n\x1a\ncontent"))
	if _, err := decodeMediaData("image/png", validPNG); err != nil {
		t.Fatalf("valid PNG signature should be accepted: %v", err)
	}
	validMP4 := base64.StdEncoding.EncodeToString([]byte("\x00\x00\x00\x18ftypisom"))
	if _, err := decodeMediaData("video/mp4", validMP4); err != nil {
		t.Fatalf("valid MP4 signature should be accepted: %v", err)
	}
	for _, test := range []struct{ mediaType, data string }{
		{"text/html", base64.StdEncoding.EncodeToString([]byte("<script>"))},
		{"image/jpeg", base64.StdEncoding.EncodeToString([]byte("not an image"))},
		{"video/webm", base64.StdEncoding.EncodeToString([]byte("not a video"))},
	} {
		if _, err := decodeMediaData(test.mediaType, test.data); err == nil {
			t.Fatalf("invalid media should be rejected: type=%q", test.mediaType)
		}
	}
}
