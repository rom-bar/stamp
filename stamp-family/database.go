package main

import (
	"database/sql"
	"fmt"
	"os"
)

const reasonStampDesignPrefix = "system-reason-"

func reasonStampDesignID(familyID string) string {
	return reasonStampDesignPrefix + familyID
}
func dbPath() string {
	if v := os.Getenv("STAMP_DB"); v != "" {
		return v
	}
	return "stamp-family.db"
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`); err != nil {
		db.Close()
		return nil, err
	}
	if err = migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	if err = seedFamilyCatalog(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func seedFamilyCatalog(db *sql.DB) error {
	rows, err := db.Query(`SELECT id FROM families ORDER BY id`)
	if err != nil {
		return err
	}
	familyIDs := []string{}
	for rows.Next() {
		var familyID string
		if err := rows.Scan(&familyID); err != nil {
			rows.Close()
			return err
		}
		familyIDs = append(familyIDs, familyID)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	for _, familyID := range familyIDs {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if err = seedFamilyCatalogTx(tx, familyID); err != nil {
			tx.Rollback()
			return err
		}
		if err = tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func seedFamilyCatalogTx(tx *sql.Tx, familyID string) error {
	_, err := tx.Exec(`INSERT OR IGNORE INTO stamp_designs(id,family_id,name,emoji,color,active) VALUES(?,?,?,?,?,1)`, reasonStampDesignID(familyID), familyID, "Emoji dari alasan", "⭐", "#f2eadb")
	if err != nil {
		return err
	}
	for index, reason := range starterStampReasons {
		id := fmt.Sprintf("starter-reason-%s-%02d", familyID, index+1)
		_, err = tx.Exec(`INSERT OR IGNORE INTO reasons(id,family_id,name,emoji,active)
			SELECT ?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM reasons WHERE family_id=? AND name=?)`, id, familyID, reason.name, reason.emoji, familyID, reason.name)
		if err != nil {
			return err
		}
	}
	return nil
}

func migrate(db *sql.DB) error {
	const schema = `
CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS children (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reasons (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL, emoji TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS stamp_designs (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL, emoji TEXT NOT NULL, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', goal INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), entry_date TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', drawing TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, activity_id TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS family_activities (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), activity_date TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, start_time TEXT NOT NULL DEFAULT '', activity_kind TEXT NOT NULL DEFAULT 'challenge', assignee_id TEXT NOT NULL DEFAULT 'all');
CREATE TABLE IF NOT EXISTS journal_media (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), media_type TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS journal_media_links (family_id TEXT NOT NULL REFERENCES families(id), journal_id TEXT NOT NULL REFERENCES journal_entries(id), media_id TEXT NOT NULL REFERENCES journal_media(id), position INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(family_id,journal_id,media_id));
CREATE TABLE IF NOT EXISTS journal_comments (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), journal_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(journal_id) REFERENCES journal_entries(id));
CREATE TABLE IF NOT EXISTS journal_reactions (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), journal_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), emoji TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(family_id,journal_id,user_id,emoji), FOREIGN KEY(journal_id) REFERENCES journal_entries(id));
CREATE TABLE IF NOT EXISTS stamps (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), child_id TEXT NOT NULL REFERENCES children(id), reason_id TEXT NOT NULL REFERENCES reasons(id), design_id TEXT NOT NULL REFERENCES stamp_designs(id), created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS redemptions (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), child_id TEXT NOT NULL REFERENCES children(id), reward_id TEXT NOT NULL REFERENCES rewards(id), cost INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS operation_log (family_id TEXT NOT NULL REFERENCES families(id), operation_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(family_id, operation_id));
CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_journal_family_date ON journal_entries(family_id, entry_date, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_family_date ON family_activities(family_id, activity_date, created_at);
CREATE INDEX IF NOT EXISTS idx_media_family ON journal_media(family_id);
CREATE INDEX IF NOT EXISTS idx_media_links_journal ON journal_media_links(family_id, journal_id, position);
CREATE INDEX IF NOT EXISTS idx_comments_family_journal ON journal_comments(family_id, journal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_family_journal ON journal_reactions(family_id, journal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stamps_family_child ON stamps(family_id, child_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_family_child ON redemptions(family_id, child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);`
	if _, err := db.Exec(schema); err != nil {
		return err
	}
	var hasActivityID bool
	rows, err := db.Query(`PRAGMA table_info(journal_entries)`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var cid, name, typ string
		var notnull, pk int
		var def any
		if err := rows.Scan(&cid, &name, &typ, &notnull, &def, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == "activity_id" {
			hasActivityID = true
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	if !hasActivityID {
		if _, err := db.Exec(`ALTER TABLE journal_entries ADD COLUMN activity_id TEXT NOT NULL DEFAULT ''`); err != nil {
			return err
		}
	}
	for _, column := range []struct{ name, definition string }{
		{"start_time", "TEXT NOT NULL DEFAULT ''"},
		{"activity_kind", "TEXT NOT NULL DEFAULT 'challenge'"},
		{"assignee_id", "TEXT NOT NULL DEFAULT 'all'"},
	} {
		if err := ensureColumn(db, "family_activities", column.name, column.definition); err != nil {
			return err
		}
	}
	return nil
}

func ensureColumn(db *sql.DB, table, column, definition string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid, name, typ string
		var notnull, pk int
		var def any
		if err := rows.Scan(&cid, &name, &typ, &notnull, &def, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + definition)
	return err
}
