package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

func (a *app) snapshot(u userSession) (snapshot, error) {
	s := snapshot{Family: familyRecord{u.FamilyID, u.Family}, User: u, ServerTime: timestamp(), Members: []memberRecord{}, Children: []childRecord{}, Journals: []journalRecord{}, Activities: []activityRecord{}, JournalComments: []commentRecord{}, JournalReactions: []reactionRecord{}, Reasons: []reasonRecord{}, Designs: []designRecord{}, Rewards: []rewardRecord{}, Stamps: []stampRecord{}, Redemptions: []redeemRecord{}}
	memberRows, err := a.db.Query(`SELECT id,username,role FROM users WHERE family_id=? ORDER BY username,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	for memberRows.Next() {
		var member memberRecord
		if err := memberRows.Scan(&member.ID, &member.Username, &member.Role); err != nil {
			memberRows.Close()
			return s, err
		}
		s.Members = append(s.Members, member)
	}
	if err := memberRows.Err(); err != nil {
		memberRows.Close()
		return s, err
	}
	memberRows.Close()
	rows, err := a.db.Query(`SELECT id,name,color,created_at FROM children WHERE family_id=? ORDER BY created_at,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x childRecord
		if err = rows.Scan(&x.ID, &x.Name, &x.Color, &x.CreatedAt); err != nil {
			return s, err
		}
		s.Children = append(s.Children, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT j.id,j.entry_date,j.title,j.body,j.drawing,j.created_by,u.username,j.created_at,j.activity_id FROM journal_entries j JOIN users u ON u.id=j.created_by AND u.family_id=j.family_id WHERE j.family_id=? ORDER BY j.entry_date DESC,j.created_at DESC,j.id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x journalRecord
		if err = rows.Scan(&x.ID, &x.Date, &x.Title, &x.Body, &x.Drawing, &x.CreatedBy, &x.CreatedByName, &x.CreatedAt, &x.ActivityID); err != nil {
			return s, err
		}
		x.Shared = true
		s.Journals = append(s.Journals, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT l.journal_id,m.id,m.media_type FROM journal_media_links l JOIN journal_entries j ON j.id=l.journal_id AND j.family_id=l.family_id JOIN journal_media m ON m.id=l.media_id AND m.family_id=l.family_id WHERE l.family_id=? ORDER BY l.journal_id,l.position,l.media_id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	journalByID := make(map[string]int, len(s.Journals))
	for i := range s.Journals {
		journalByID[s.Journals[i].ID] = i
	}
	for rows.Next() {
		var journalID string
		var media journalMediaRecord
		if err = rows.Scan(&journalID, &media.ID, &media.Type); err != nil {
			rows.Close()
			return s, err
		}
		if index, ok := journalByID[journalID]; ok {
			s.Journals[index].Media = append(s.Journals[index].Media, media)
		}
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT id,activity_date,title,prompt,created_by,created_at,start_time,activity_kind,assignee_id FROM family_activities WHERE family_id=? ORDER BY activity_date DESC,start_time DESC,created_at DESC,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	for rows.Next() {
		var x activityRecord
		if err = rows.Scan(&x.ID, &x.Date, &x.Title, &x.Prompt, &x.CreatedBy, &x.CreatedAt, &x.Time, &x.Kind, &x.AssigneeID); err != nil {
			rows.Close()
			return s, err
		}
		s.Activities = append(s.Activities, x)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT c.id,c.journal_id,c.user_id,u.username,c.body,c.created_at FROM journal_comments c JOIN users u ON u.id=c.user_id AND u.family_id=c.family_id WHERE c.family_id=? ORDER BY c.created_at,c.id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	for rows.Next() {
		var x commentRecord
		if err = rows.Scan(&x.ID, &x.JournalID, &x.UserID, &x.Username, &x.Body, &x.CreatedAt); err != nil {
			rows.Close()
			return s, err
		}
		s.JournalComments = append(s.JournalComments, x)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT r.id,r.journal_id,r.user_id,u.username,r.emoji,r.created_at FROM journal_reactions r JOIN users u ON u.id=r.user_id AND u.family_id=r.family_id WHERE r.family_id=? ORDER BY r.created_at,r.id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	for rows.Next() {
		var x reactionRecord
		if err = rows.Scan(&x.ID, &x.JournalID, &x.UserID, &x.Username, &x.Emoji, &x.CreatedAt); err != nil {
			rows.Close()
			return s, err
		}
		s.JournalReactions = append(s.JournalReactions, x)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT id,name,emoji,active FROM reasons WHERE family_id=? ORDER BY name,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x reasonRecord
		var active int
		if err = rows.Scan(&x.ID, &x.Name, &x.Emoji, &active); err != nil {
			return s, err
		}
		x.Active = active == 1
		s.Reasons = append(s.Reasons, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT id,name,emoji,color,active FROM stamp_designs WHERE family_id=? ORDER BY name,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x designRecord
		var active int
		if err = rows.Scan(&x.ID, &x.Name, &x.Emoji, &x.Color, &active); err != nil {
			return s, err
		}
		x.System = x.ID == reasonStampDesignID(u.FamilyID)
		x.Active = active == 1
		s.Designs = append(s.Designs, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT id,name,description,goal,active FROM rewards WHERE family_id=? ORDER BY name,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x rewardRecord
		var active int
		if err = rows.Scan(&x.ID, &x.Name, &x.Description, &x.Goal, &active); err != nil {
			return s, err
		}
		x.Active = active == 1
		s.Rewards = append(s.Rewards, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT id,child_id,reason_id,design_id,created_by,created_at FROM stamps WHERE family_id=? ORDER BY created_at,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x stampRecord
		if err = rows.Scan(&x.ID, &x.ChildID, &x.ReasonID, &x.DesignID, &x.CreatedBy, &x.CreatedAt); err != nil {
			return s, err
		}
		s.Stamps = append(s.Stamps, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	rows.Close()
	rows, err = a.db.Query(`SELECT id,child_id,reward_id,cost,created_by,created_at FROM redemptions WHERE family_id=? ORDER BY created_at,id`, u.FamilyID)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var x redeemRecord
		if err = rows.Scan(&x.ID, &x.ChildID, &x.RewardID, &x.Cost, &x.CreatedBy, &x.CreatedAt); err != nil {
			return s, err
		}
		s.Redemptions = append(s.Redemptions, x)
	}
	if err = rows.Err(); err != nil {
		return s, err
	}
	return s, nil
}

func (a *app) sync(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeJSON(w, 403, map[string]string{"error": "origin rejected"})
		return
	}
	u, ok := requireUser(a, w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 256*1024)
	var req syncRequest
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid sync payload"})
		return
	}
	if len(req.Operations) > 100 {
		writeJSON(w, 413, map[string]string{"error": "send at most 100 operations at a time"})
		return
	}
	reply := syncReply{Applied: []string{}, Rejected: map[string]string{}}
	for _, op := range req.Operations {
		if len(op.ID) < 8 || len(op.ID) > 100 {
			reply.Rejected[op.ID] = "invalid operation id"
			continue
		}
		if err := a.applyOperation(u, op); err != nil {
			reply.Rejected[op.ID] = err.Error()
		} else {
			reply.Applied = append(reply.Applied, op.ID)
		}
	}
	s, err := a.snapshot(u)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not load family data"})
		return
	}
	reply.Snapshot = s
	writeJSON(w, 200, reply)
}

func (a *app) uploadMedia(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeJSON(w, 403, map[string]string{"error": "origin rejected"})
		return
	}
	u, ok := requireUser(a, w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 6*1024*1024)
	var req struct {
		OperationID string `json:"operationId"`
		ID          string `json:"id"`
		Type        string `json:"type"`
		Data        string `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid media payload"})
		return
	}
	if len(req.OperationID) < 8 || len(req.OperationID) > 100 || len(req.ID) < 8 || len(req.ID) > 100 {
		writeJSON(w, 400, map[string]string{"error": "invalid media id"})
		return
	}
	data, err := decodeMediaData(req.Type, req.Data)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	tx, err := a.db.Begin()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not store media"})
		return
	}
	defer tx.Rollback()
	var exists int
	err = tx.QueryRow(`SELECT 1 FROM operation_log WHERE family_id=? AND operation_id=?`, u.FamilyID, req.OperationID).Scan(&exists)
	if err == nil {
		var mediaType string
		if tx.QueryRow(`SELECT media_type FROM journal_media WHERE id=? AND family_id=?`, req.ID, u.FamilyID).Scan(&mediaType) != nil {
			writeJSON(w, 409, map[string]string{"error": "media operation already used"})
			return
		}
		writeJSON(w, 200, map[string]string{"id": req.ID, "type": mediaType})
		return
	}
	if err != sql.ErrNoRows {
		writeJSON(w, 500, map[string]string{"error": "could not check media operation"})
		return
	}
	if _, err = tx.Exec(`INSERT INTO journal_media(id,family_id,media_type,data,created_at) VALUES(?,?,?,?,?)`, req.ID, u.FamilyID, req.Type, data, timestamp()); err != nil {
		writeJSON(w, 409, map[string]string{"error": "media id already exists"})
		return
	}
	if _, err = tx.Exec(`INSERT INTO operation_log(family_id,operation_id,user_id,created_at) VALUES(?,?,?,?)`, u.FamilyID, req.OperationID, u.ID, timestamp()); err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not record media upload"})
		return
	}
	if err = tx.Commit(); err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not store media"})
		return
	}
	writeJSON(w, 201, map[string]string{"id": req.ID, "type": req.Type})
}

func (a *app) serveMedia(w http.ResponseWriter, r *http.Request) {
	u, ok := requireUser(a, w, r)
	if !ok {
		return
	}
	var mediaType string
	var data []byte
	err := a.db.QueryRow(`SELECT m.media_type,m.data FROM journal_media m JOIN journal_media_links l ON l.media_id=m.id AND l.family_id=m.family_id JOIN journal_entries j ON j.id=l.journal_id AND j.family_id=l.family_id WHERE m.id=? AND m.family_id=? LIMIT 1`, r.PathValue("id"), u.FamilyID).Scan(&mediaType, &data)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", mediaType)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	_, _ = w.Write(data)
}

func (a *app) applyOperation(u userSession, op syncOperation) error {
	var p map[string]any
	if err := json.Unmarshal(op.Payload, &p); err != nil {
		return errors.New("invalid operation details")
	}
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists int
	err = tx.QueryRow(`SELECT 1 FROM operation_log WHERE family_id=? AND operation_id=?`, u.FamilyID, op.ID).Scan(&exists)
	if err == nil {
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}
	if u.Role != "admin" && strings.HasSuffix(op.Kind, ".add") && op.Kind != "journal.add" && op.Kind != "activity.add" && op.Kind != "calendar.add" && op.Kind != "journal.comment.add" {
		return errors.New("hanya admin keluarga yang dapat mengubah pengaturan")
	}
	now := timestamp()
	entityID := str(p["id"])
	if entityID == "" {
		var e error
		entityID, e = randomID()
		if e != nil {
			return e
		}
	}
	var execErr error
	switch op.Kind {
	case "child.add":
		name := cleanText(str(p["name"]), 60)
		color := safeColor(str(p["color"]))
		if name == "" {
			return errors.New("nama anak wajib diisi")
		}
		_, execErr = tx.Exec(`INSERT INTO children(id,family_id,name,color,created_at) VALUES(?,?,?,?,?)`, entityID, u.FamilyID, name, color, now)
	case "reason.add":
		name := cleanText(str(p["name"]), 60)
		emoji := cleanText(str(p["emoji"]), 12)
		if name == "" {
			return errors.New("nama alasan wajib diisi")
		}
		if emoji == "" {
			emoji = "⭐"
		}
		_, execErr = tx.Exec(`INSERT INTO reasons(id,family_id,name,emoji,active) VALUES(?,?,?,?,1)`, entityID, u.FamilyID, name, emoji)
	case "design.add":
		name := cleanText(str(p["name"]), 50)
		emoji := cleanText(str(p["emoji"]), 12)
		color := safeColor(str(p["color"]))
		if name == "" {
			return errors.New("nama desain wajib diisi")
		}
		if emoji == "" {
			emoji = "⭐"
		}
		_, execErr = tx.Exec(`INSERT INTO stamp_designs(id,family_id,name,emoji,color,active) VALUES(?,?,?,?,?,1)`, entityID, u.FamilyID, name, emoji, color)
	case "reward.add":
		name := cleanText(str(p["name"]), 80)
		description := cleanText(str(p["description"]), 180)
		goal := intValue(p["goal"])
		if name == "" {
			return errors.New("nama hadiah wajib diisi")
		}
		if goal < 1 || goal > 500 {
			return errors.New("target stamp harus 1–500")
		}
		_, execErr = tx.Exec(`INSERT INTO rewards(id,family_id,name,description,goal,active) VALUES(?,?,?,?,?,1)`, entityID, u.FamilyID, name, description, goal)
	case "journal.add":
		if p["shared"] != true {
			return errors.New("jurnal pribadi tidak dapat disinkronkan ke keluarga")
		}
		entryDate := str(p["date"])
		if !validISODate(entryDate) {
			return errors.New("tanggal jurnal tidak valid")
		}
		rawTitle := str(p["title"])
		rawBody := str(p["body"])
		if len([]rune(rawTitle)) > 120 || len([]rune(rawBody)) > 5000 {
			return errors.New("judul maksimal 120 karakter dan cerita maksimal 5000 karakter")
		}
		title := cleanText(rawTitle, 120)
		body := cleanMultiline(rawBody, 5000)
		drawing := str(p["drawing"])
		mediaIDs, mediaErr := mediaIDList(p["mediaIds"])
		if mediaErr != nil {
			return mediaErr
		}
		if title == "" && body == "" && drawing == "" && len(mediaIDs) == 0 {
			return errors.New("isi jurnal, gambar, atau media wajib diisi")
		}
		if err := validateDrawingData(drawing); err != nil {
			return err
		}
		activityID := str(p["activityId"])
		if activityID != "" && !belongsActivity(tx, activityID, u.FamilyID) {
			return errors.New("aktivitas tidak ditemukan di keluarga ini")
		}
		_, execErr = tx.Exec(`INSERT INTO journal_entries(id,family_id,entry_date,title,body,drawing,created_by,created_at,activity_id) VALUES(?,?,?,?,?,?,?,?,?)`, entityID, u.FamilyID, entryDate, title, body, drawing, u.ID, now, activityID)
		if execErr == nil {
			for position, mediaID := range mediaIDs {
				if !belongsMedia(tx, mediaID, u.FamilyID) {
					return errors.New("media tidak ditemukan di keluarga ini")
				}
				if _, execErr = tx.Exec(`INSERT INTO journal_media_links(family_id,journal_id,media_id,position) VALUES(?,?,?,?)`, u.FamilyID, entityID, mediaID, position); execErr != nil {
					break
				}
			}
		}
	case "activity.add":
		activityDate := str(p["date"])
		if !validISODate(activityDate) {
			return errors.New("tanggal aktivitas tidak valid")
		}
		rawTitle := str(p["title"])
		rawPrompt := str(p["prompt"])
		title := cleanText(rawTitle, 120)
		prompt := cleanMultiline(rawPrompt, 500)
		if title == "" || len([]rune(rawTitle)) > 120 {
			return errors.New("judul aktivitas wajib diisi dan maksimal 120 karakter")
		}
		if len([]rune(rawPrompt)) > 500 {
			return errors.New("prompt aktivitas maksimal 500 karakter")
		}
		_, execErr = tx.Exec(`INSERT INTO family_activities(id,family_id,activity_date,title,prompt,created_by,created_at,start_time,activity_kind,assignee_id) VALUES(?,?,?,?,?,?,?,'','challenge','all')`, entityID, u.FamilyID, activityDate, title, prompt, u.ID, now)
	case "calendar.add":
		calendarDate, startTime := str(p["date"]), str(p["time"])
		rawTitle, rawDescription := str(p["title"]), str(p["description"])
		calendarTitle := cleanText(rawTitle, 120)
		description := cleanMultiline(rawDescription, 500)
		kind, assignee := str(p["kind"]), str(p["assigneeId"])
		if !validISODate(calendarDate) || !validClockTime(startTime) {
			return errors.New("tanggal atau waktu kalender tidak valid")
		}
		if calendarTitle == "" || len([]rune(rawTitle)) > 120 || len([]rune(rawDescription)) > 500 {
			return errors.New("judul wajib diisi; judul maksimal 120 dan deskripsi maksimal 500 karakter")
		}
		if kind != "activity" && kind != "task" {
			return errors.New("jenis kalender tidak valid")
		}
		if assignee != "all" && !belongsMember(tx, assignee, u.FamilyID) {
			return errors.New("anggota yang ditugaskan tidak ditemukan di keluarga ini")
		}
		_, execErr = tx.Exec(`INSERT INTO family_activities(id,family_id,activity_date,title,prompt,created_by,created_at,start_time,activity_kind,assignee_id) VALUES(?,?,?,?,?,?,?,?,?,?)`, entityID, u.FamilyID, calendarDate, calendarTitle, description, u.ID, now, startTime, kind, assignee)
	case "journal.comment.add":
		journalID := str(p["journalId"])
		rawBody := str(p["body"])
		body := cleanMultiline(rawBody, 500)
		if body == "" || len([]rune(rawBody)) > 500 {
			return errors.New("komentar wajib diisi dan maksimal 500 karakter")
		}
		if !belongsJournal(tx, journalID, u.FamilyID) {
			return errors.New("jurnal tidak ditemukan di keluarga ini")
		}
		_, execErr = tx.Exec(`INSERT INTO journal_comments(id,family_id,journal_id,user_id,body,created_at) VALUES(?,?,?,?,?,?)`, entityID, u.FamilyID, journalID, u.ID, body, now)
	case "journal.react.toggle":
		journalID, emoji := str(p["journalId"]), str(p["emoji"])
		if !belongsJournal(tx, journalID, u.FamilyID) {
			return errors.New("jurnal tidak ditemukan di keluarga ini")
		}
		if !validReactionEmoji(emoji) {
			return errors.New("reaksi tidak valid")
		}
		var reactionID string
		err = tx.QueryRow(`SELECT id FROM journal_reactions WHERE family_id=? AND journal_id=? AND user_id=? AND emoji=?`, u.FamilyID, journalID, u.ID, emoji).Scan(&reactionID)
		if err == nil {
			_, execErr = tx.Exec(`DELETE FROM journal_reactions WHERE id=? AND family_id=?`, reactionID, u.FamilyID)
		} else if err == sql.ErrNoRows {
			_, execErr = tx.Exec(`INSERT INTO journal_reactions(id,family_id,journal_id,user_id,emoji,created_at) VALUES(?,?,?,?,?,?)`, entityID, u.FamilyID, journalID, u.ID, emoji, now)
		} else {
			return err
		}
	case "stamp.give":
		child, reason, design := str(p["childId"]), str(p["reasonId"]), str(p["designId"])
		if !belongs(tx, "children", child, u.FamilyID) || !belongs(tx, "reasons", reason, u.FamilyID) || !belongs(tx, "stamp_designs", design, u.FamilyID) {
			return errors.New("anak, alasan, atau desain tidak ditemukan di keluarga ini")
		}
		_, execErr = tx.Exec(`INSERT INTO stamps(id,family_id,child_id,reason_id,design_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)`, entityID, u.FamilyID, child, reason, design, u.ID, now)
	case "reward.redeem":
		child, reward := str(p["childId"]), str(p["rewardId"])
		if !belongs(tx, "children", child, u.FamilyID) {
			return errors.New("anak tidak ditemukan di keluarga ini")
		}
		var goal int
		if err = tx.QueryRow(`SELECT goal FROM rewards WHERE id=? AND family_id=? AND active=1`, reward, u.FamilyID).Scan(&goal); err != nil {
			return errors.New("hadiah tidak ditemukan di keluarga ini")
		}
		var earned, spent int
		if err = tx.QueryRow(`SELECT COUNT(*) FROM stamps WHERE family_id=? AND child_id=?`, u.FamilyID, child).Scan(&earned); err != nil {
			return err
		}
		if err = tx.QueryRow(`SELECT COALESCE(SUM(cost),0) FROM redemptions WHERE family_id=? AND child_id=?`, u.FamilyID, child).Scan(&spent); err != nil {
			return err
		}
		if earned-spent < goal {
			return errors.New("stamp belum cukup untuk menukar hadiah")
		}
		_, execErr = tx.Exec(`INSERT INTO redemptions(id,family_id,child_id,reward_id,cost,created_by,created_at) VALUES(?,?,?,?,?,?,?)`, entityID, u.FamilyID, child, reward, goal, u.ID, now)
	default:
		return errors.New("jenis operasi tidak didukung")
	}
	if execErr != nil {
		if strings.Contains(strings.ToLower(execErr.Error()), "unique") {
			return errors.New("data dengan ID ini sudah ada")
		}
		return execErr
	}
	if _, err = tx.Exec(`INSERT INTO operation_log(family_id,operation_id,user_id,created_at) VALUES(?,?,?,?)`, u.FamilyID, op.ID, u.ID, now); err != nil {
		return err
	}
	return tx.Commit()
}
