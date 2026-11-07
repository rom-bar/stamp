package main

import (
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"database/sql"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

//go:embed web/* web/templates/* web/static/*
var webFiles embed.FS

type app struct {
	db           *sql.DB
	cookieSecure bool
	loginTmpl    *templateSet
	appTmpl      *templateSet
}

type templateSet struct{ name string }

type userSession struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	FamilyID string `json:"familyId"`
	Family   string `json:"family"`
}

type syncOperation struct {
	ID      string          `json:"id"`
	Kind    string          `json:"kind"`
	Payload json.RawMessage `json:"payload"`
}

type syncRequest struct {
	Operations []syncOperation `json:"operations"`
}

type syncReply struct {
	Applied  []string          `json:"applied"`
	Rejected map[string]string `json:"rejected"`
	Snapshot snapshot          `json:"snapshot"`
}

type snapshot struct {
	Family           familyRecord     `json:"family"`
	User             userSession      `json:"user"`
	Members          []memberRecord   `json:"members"`
	Children         []childRecord    `json:"children"`
	Journals         []journalRecord  `json:"journals"`
	Activities       []activityRecord `json:"activities"`
	JournalComments  []commentRecord  `json:"journalComments"`
	JournalReactions []reactionRecord `json:"journalReactions"`
	Reasons          []reasonRecord   `json:"reasons"`
	Designs          []designRecord   `json:"designs"`
	Rewards          []rewardRecord   `json:"rewards"`
	Stamps           []stampRecord    `json:"stamps"`
	Redemptions      []redeemRecord   `json:"redemptions"`
	ServerTime       string           `json:"serverTime"`
}

type familyRecord struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type childRecord struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	CreatedAt string `json:"createdAt"`
}
type memberRecord struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}
type journalMediaRecord struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}
type journalRecord struct {
	ID            string               `json:"id"`
	Date          string               `json:"date"`
	Title         string               `json:"title"`
	Body          string               `json:"body"`
	Drawing       string               `json:"drawing,omitempty"`
	CreatedBy     string               `json:"createdBy"`
	CreatedByName string               `json:"createdByName"`
	ActivityID    string               `json:"activityId,omitempty"`
	Media         []journalMediaRecord `json:"media,omitempty"`
	CreatedAt     string               `json:"createdAt"`
	Shared        bool                 `json:"shared"`
}
type activityRecord struct {
	ID         string `json:"id"`
	Date       string `json:"date"`
	Time       string `json:"time,omitempty"`
	Title      string `json:"title"`
	Prompt     string `json:"prompt"`
	Kind       string `json:"kind"`
	AssigneeID string `json:"assigneeId"`
	CreatedBy  string `json:"createdBy"`
	CreatedAt  string `json:"createdAt"`
}
type commentRecord struct {
	ID        string `json:"id"`
	JournalID string `json:"journalId"`
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
}
type reactionRecord struct {
	ID        string `json:"id"`
	JournalID string `json:"journalId"`
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Emoji     string `json:"emoji"`
	CreatedAt string `json:"createdAt"`
}
type reasonRecord struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Emoji  string `json:"emoji"`
	Active bool   `json:"active"`
}
type designRecord struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Emoji  string `json:"emoji"`
	Color  string `json:"color"`
	System bool   `json:"system,omitempty"`
	Active bool   `json:"active"`
}
type rewardRecord struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Goal        int    `json:"goal"`
	Active      bool   `json:"active"`
}
type stampRecord struct {
	ID        string `json:"id"`
	ChildID   string `json:"childId"`
	ReasonID  string `json:"reasonId"`
	DesignID  string `json:"designId"`
	CreatedBy string `json:"createdBy"`
	CreatedAt string `json:"createdAt"`
}
type redeemRecord struct {
	ID        string `json:"id"`
	ChildID   string `json:"childId"`
	RewardID  string `json:"rewardId"`
	Cost      int    `json:"cost"`
	CreatedBy string `json:"createdBy"`
	CreatedAt string `json:"createdAt"`
}

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]{3,40}$`)

type starterReason struct {
	name  string
	emoji string
}

var starterStampReasons = []starterReason{
	{"Merapikan tempat tidur", "🛏️"},
	{"Merapikan mainan", "🧸"},
	{"Menyimpan sepatu di rak", "👟"},
	{"Menata buku dan alat tulis", "📚"},
	{"Menyiram tanaman", "🪴"},
	{"Memberi makan hewan peliharaan", "🐾"},
	{"Membantu menata meja makan", "🍽️"},
	{"Membawa piring sendiri ke dapur", "🥣"},
	{"Membantu mengelap meja", "🧽"},
	{"Memilah sampah sesuai jenis", "♻️"},
	{"Melipat pakaian kecil", "🧺"},
	{"Menaruh pakaian kotor di keranjang", "👕"},
	{"Menyiapkan botol minum", "🥤"},
	{"Menata tas untuk besok", "🎒"},
	{"Membantu mencuci buah", "🍎"},
	{"Menjaga kamar tetap rapi", "🧹"},
	{"Menyapu area kecil bersama orang tua", "🧹"},
	{"Menata bantal sofa", "🛋️"},
	{"Mengembalikan barang ke tempatnya", "📦"},
	{"Menjaga kebersihan setelah makan", "✨"},
	{"Berbagi tugas rumah dengan senang", "🤝"},
	{"Membantu menyiapkan bekal sederhana", "🥪"},
	{"Membantu membuat daftar belanja", "🛒"},
	{"Membantu menyiram kebun", "🌱"},
	{"Merapikan alat gambar setelah dipakai", "🎨"},
	{"Menyelesaikan PR tepat waktu", "✏️"},
	{"Membaca buku selama 15 menit", "📖"},
	{"Menyiapkan buku sesuai jadwal", "📘"},
	{"Merapikan kotak pensil", "🖍️"},
	{"Menjaga meja belajar tetap rapi", "🗂️"},
	{"Menyelesaikan tugas sekolah", "📄"},
	{"Berani bertanya saat belum paham", "🙋"},
	{"Mendengarkan guru dengan baik", "👂"},
	{"Membantu teman belajar", "🤝"},
	{"Berbagi alat tulis", "🖊️"},
	{"Mengantre dengan tertib", "🚶"},
	{"Menjaga kebersihan kelas", "🧹"},
	{"Mengembalikan buku perpustakaan", "📚"},
	{"Datang tepat waktu", "⏰"},
	{"Mengumpulkan tugas sesuai waktu", "📮"},
	{"Berani mencoba hal baru", "🌟"},
}

const reasonStampDesignPrefix = "system-reason-"

func reasonStampDesignID(familyID string) string {
	return reasonStampDesignPrefix + familyID
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "create-admin" {
		if err := createAdmin(os.Args[2:]); err != nil {
			log.Fatal(err)
		}
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "help" {
		printHelp()
		return
	}
	if err := runServer(); err != nil {
		log.Fatal(err)
	}
}

func printHelp() {
	fmt.Println(`Buku Keluarga — jurnal keluarga dan koleksi stamp offline-first

Commands:
  stamp-family serve                         Start the web server (default)
  stamp-family create-admin -family NAME -username NAME [-password VALUE]
                                             Create a family and its first admin

Environment:
  STAMP_DB       SQLite path (default: stamp-family.db)
  STAMP_ADDR     listen address (default: :8080)
  COOKIE_SECURE  set to true when served over HTTPS`)
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

func createAdmin(args []string) error {
	fs := flag.NewFlagSet("create-admin", flag.ContinueOnError)
	familyName := fs.String("family", "", "family name")
	username := fs.String("username", "", "admin username")
	password := fs.String("password", "", "initial password (generated if omitted)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*familyName) == "" || !usernamePattern.MatchString(*username) {
		return errors.New("provide -family NAME and a username of 3–40 letters, numbers, dot, underscore or hyphen")
	}
	pw := *password
	if pw == "" {
		var err error
		pw, err = randomPassword()
		if err != nil {
			return err
		}
	}
	if len(pw) < 10 {
		return errors.New("password must be at least 10 characters")
	}
	db, err := openDB(dbPath())
	if err != nil {
		return err
	}
	defer db.Close()
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), 12)
	if err != nil {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	familyID, err := randomID()
	if err != nil {
		return err
	}
	userID, err := randomID()
	if err != nil {
		return err
	}
	now := timestamp()
	if _, err = tx.Exec(`INSERT INTO families(id,name,created_at) VALUES(?,?,?)`, familyID, strings.TrimSpace(*familyName), now); err != nil {
		return fmt.Errorf("create family: %w", err)
	}
	if _, err = tx.Exec(`INSERT INTO users(id,family_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)`, userID, familyID, *username, string(hash), "admin", now); err != nil {
		return fmt.Errorf("create admin: %w", err)
	}
	if err = seedFamilyCatalogTx(tx, familyID); err != nil {
		return fmt.Errorf("seed family catalog: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	fmt.Printf("Family: %s\nAdmin username: %s\nInitial password: %s\nSave this password now; it is not shown again.\n", *familyName, *username, pw)
	return nil
}

func runServer() error {
	db, err := openDB(dbPath())
	if err != nil {
		return err
	}
	a := &app{db: db, cookieSecure: strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true")}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", a.home)
	mux.HandleFunc("GET /app", a.appPage)
	mux.HandleFunc("POST /login", a.login)
	mux.HandleFunc("POST /logout", a.logout)
	mux.HandleFunc("GET /api/bootstrap", a.bootstrap)
	mux.HandleFunc("POST /api/sync", a.sync)
	mux.HandleFunc("POST /api/media/upload", a.uploadMedia)
	mux.HandleFunc("GET /api/media/{id}", a.serveMedia)
	mux.HandleFunc("POST /api/invite", a.invite)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /manifest.json", serveEmbedded("web/manifest.json", "application/manifest+json"))
	mux.HandleFunc("GET /sw.js", serveEmbedded("web/sw.js", "application/javascript; charset=utf-8"))
	mux.HandleFunc("GET /offline.html", serveEmbedded("web/offline.html", "text/html; charset=utf-8"))
	static, err := fs.Sub(webFiles, "web/static")
	if err != nil {
		return err
	}
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.FS(static))))
	addr := os.Getenv("STAMP_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	server := &http.Server{Addr: addr, Handler: securityHeaders(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("Buku Keluarga listening on %s (SQLite: %s)", addr, dbPath())
	return server.ListenAndServe()
}

func serveEmbedded(name, contentType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := webFiles.ReadFile(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(b)
	}
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

func (a *app) home(w http.ResponseWriter, r *http.Request) {
	if _, ok := a.currentUser(r); ok {
		http.Redirect(w, r, "/app", http.StatusSeeOther)
		return
	}
	b, err := webFiles.ReadFile("web/templates/login.html")
	if err != nil {
		http.Error(w, "template error", 500)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(b)
}
func (a *app) appPage(w http.ResponseWriter, r *http.Request) {
	b, err := webFiles.ReadFile("web/templates/app.html")
	if err != nil {
		http.Error(w, "template error", 500)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(b)
}

func (a *app) login(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		http.Error(w, "origin rejected", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form", 400)
		return
	}
	username := strings.TrimSpace(r.FormValue("username"))
	password := r.FormValue("password")
	var userID, familyID, hash, role, family string
	err := a.db.QueryRow(`SELECT u.id,u.family_id,u.password_hash,u.role,f.name FROM users u JOIN families f ON f.id=u.family_id WHERE u.username=?`, username).Scan(&userID, &familyID, &hash, &role, &family)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		if r.Header.Get("HX-Request") == "true" {
			w.Header().Set("HX-Retarget", "#login-message")
			w.Header().Set("HX-Reswap", "innerHTML")
			w.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprint(w, "Username atau password salah.")
			return
		}
		http.Error(w, "Username atau password salah.", http.StatusUnauthorized)
		return
	}
	token, err := randomToken()
	if err != nil {
		http.Error(w, "could not start session", 500)
		return
	}
	expires := time.Now().UTC().Add(30 * 24 * time.Hour)
	if _, err = a.db.Exec(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)`, hashToken(token), userID, expires.Format(time.RFC3339)); err != nil {
		http.Error(w, "could not start session", 500)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "stamp_session", Value: token, Path: "/", HttpOnly: true, Secure: a.cookieSecure, SameSite: http.SameSiteLaxMode, Expires: expires, MaxAge: 30 * 24 * 3600})
	if strings.Contains(r.Header.Get("HX-Request"), "true") {
		w.Header().Set("HX-Redirect", "/app")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	http.Redirect(w, r, "/app", http.StatusSeeOther)
}
func (a *app) logout(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		http.Error(w, "origin rejected", http.StatusForbidden)
		return
	}
	if c, err := r.Cookie("stamp_session"); err == nil {
		a.db.Exec(`DELETE FROM sessions WHERE token_hash=?`, hashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: "stamp_session", Value: "", Path: "/", HttpOnly: true, Secure: a.cookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func sameOrigin(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	return strings.EqualFold(strings.TrimPrefix(o, "https://"), r.Host) || strings.EqualFold(strings.TrimPrefix(o, "http://"), r.Host)
}
func (a *app) currentUser(r *http.Request) (userSession, bool) {
	c, err := r.Cookie("stamp_session")
	if err != nil || c.Value == "" {
		return userSession{}, false
	}
	var u userSession
	var exp string
	err = a.db.QueryRow(`SELECT u.id,u.username,u.role,u.family_id,f.name,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id JOIN families f ON f.id=u.family_id WHERE s.token_hash=?`, hashToken(c.Value)).Scan(&u.ID, &u.Username, &u.Role, &u.FamilyID, &u.Family, &exp)
	if err != nil {
		return userSession{}, false
	}
	t, err := time.Parse(time.RFC3339, exp)
	if err != nil || time.Now().UTC().After(t) {
		a.db.Exec(`DELETE FROM sessions WHERE token_hash=?`, hashToken(c.Value))
		return userSession{}, false
	}
	return u, true
}
func requireUser(a *app, w http.ResponseWriter, r *http.Request) (userSession, bool) {
	u, ok := a.currentUser(r)
	if !ok {
		writeJSON(w, 401, map[string]string{"error": "login required"})
		return u, false
	}
	return u, true
}
func (a *app) bootstrap(w http.ResponseWriter, r *http.Request) {
	u, ok := requireUser(a, w, r)
	if !ok {
		return
	}
	s, err := a.snapshot(u)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not load family data"})
		return
	}
	writeJSON(w, 200, s)
}

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

func validISODate(s string) bool {
	t, err := time.Parse("2006-01-02", s)
	return err == nil && t.Format("2006-01-02") == s
}
func validReactionEmoji(s string) bool {
	switch s {
	case "❤️", "👏", "😂", "🌟", "🤗", "👍":
		return true
	}
	return false
}
func belongsActivity(tx *sql.Tx, id, family string) bool {
	var n int
	return tx.QueryRow(`SELECT COUNT(*) FROM family_activities WHERE id=? AND family_id=?`, id, family).Scan(&n) == nil && n == 1
}
func belongsMember(tx *sql.Tx, id, family string) bool {
	if id == "" {
		return false
	}
	var n int
	return tx.QueryRow(`SELECT COUNT(*) FROM users WHERE id=? AND family_id=?`, id, family).Scan(&n) == nil && n == 1
}
func belongsMedia(tx *sql.Tx, id, family string) bool {
	if id == "" {
		return false
	}
	var n int
	return tx.QueryRow(`SELECT COUNT(*) FROM journal_media WHERE id=? AND family_id=?`, id, family).Scan(&n) == nil && n == 1
}
func mediaIDList(value any) ([]string, error) {
	if value == nil {
		return []string{}, nil
	}
	items, ok := value.([]any)
	if !ok || len(items) > 6 {
		return nil, errors.New("jurnal maksimal memuat 6 lampiran")
	}
	ids := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		id, ok := item.(string)
		if !ok || len(id) < 8 || len(id) > 100 || seen[id] {
			return nil, errors.New("daftar lampiran tidak valid")
		}
		ids = append(ids, id)
		seen[id] = true
	}
	return ids, nil
}
func validClockTime(value string) bool {
	t, err := time.Parse("15:04", value)
	return err == nil && t.Format("15:04") == value
}
func decodeMediaData(mediaType, encoded string) ([]byte, error) {
	limit := 700 * 1024
	switch mediaType {
	case "video/mp4", "video/webm":
		limit = 4 * 1024 * 1024
	case "image/jpeg", "image/png", "image/webp":
	default:
		return nil, errors.New("format media tidak didukung")
	}
	if len(encoded) > ((limit+2)/3)*4+8 {
		return nil, errors.New("media melebihi batas ukuran")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(data) == 0 || len(data) > limit {
		return nil, errors.New("data media tidak valid atau terlalu besar")
	}
	valid := false
	switch mediaType {
	case "image/jpeg":
		valid = len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff
	case "image/png":
		valid = len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n"
	case "image/webp":
		valid = len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP"
	case "video/mp4":
		valid = len(data) >= 12 && string(data[4:8]) == "ftyp"
	case "video/webm":
		valid = len(data) >= 4 && string(data[:4]) == "\x1a\x45\xdf\xa3"
	}
	if !valid {
		return nil, errors.New("signature file tidak sesuai dengan format media")
	}
	return data, nil
}
func belongsJournal(tx *sql.Tx, id, family string) bool {
	var n int
	return tx.QueryRow(`SELECT COUNT(*) FROM journal_entries WHERE id=? AND family_id=?`, id, family).Scan(&n) == nil && n == 1
}

func belongs(tx *sql.Tx, table, id, family string) bool {
	if id == "" {
		return false
	}
	if table != "children" && table != "reasons" && table != "stamp_designs" {
		return false
	}
	var n int
	err := tx.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE id=? AND family_id=?`, id, family).Scan(&n)
	return err == nil && n == 1
}

func (a *app) invite(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeJSON(w, 403, map[string]string{"error": "origin rejected"})
		return
	}
	u, ok := requireUser(a, w, r)
	if !ok {
		return
	}
	if u.Role != "admin" {
		writeJSON(w, 403, map[string]string{"error": "hanya admin keluarga yang dapat mengundang"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var req struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if !usernamePattern.MatchString(req.Username) {
		writeJSON(w, 400, map[string]string{"error": "username harus 3–40 karakter: huruf, angka, titik, garis bawah, atau tanda hubung"})
		return
	}
	if req.Role != "admin" && req.Role != "member" {
		req.Role = "member"
	}
	pw, err := randomPassword()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not generate password"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), 12)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not create account"})
		return
	}
	id, err := randomID()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not create account"})
		return
	}
	if _, err = a.db.Exec(`INSERT INTO users(id,family_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)`, id, u.FamilyID, req.Username, string(hash), req.Role, timestamp()); err != nil {
		writeJSON(w, 409, map[string]string{"error": "username sudah dipakai; pilih username lain"})
		return
	}
	writeJSON(w, 201, map[string]string{"id": id, "username": req.Username, "password": pw, "role": req.Role, "family": u.Family})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func randomID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
func randomToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
func randomPassword() (string, error) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$"
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	out := make([]byte, len(b))
	for i, x := range b {
		out[i] = chars[int(x)%len(chars)]
	}
	return string(out), nil
}
func hashToken(token string) string {
	s := sha256.Sum256([]byte(token))
	return hex.EncodeToString(s[:])
}
func timestamp() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func str(v any) string {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}
func intValue(v any) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	case string:
		var n int
		_, _ = fmt.Sscan(x, &n)
		return n
	}
	return 0
}
func cleanText(s string, max int) string {
	s = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(s, "\n", " "), "\r", " "))
	r := []rune(s)
	if len(r) > max {
		s = string(r[:max])
	}
	return s
}
func cleanMultiline(s string, max int) string {
	s = strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\r", "\n")
	s = strings.ReplaceAll(s, "\x00", "")
	s = strings.TrimSpace(s)
	r := []rune(s)
	if len(r) > max {
		s = string(r[:max])
	}
	return s
}
func validateDrawingData(data string) error {
	if data == "" {
		return nil
	}
	if len(data) > 180000 {
		return errors.New("gambar jurnal terlalu besar")
	}
	header, encoded, ok := strings.Cut(data, ",")
	if !ok || (header != "data:image/jpeg;base64" && header != "data:image/png;base64") {
		return errors.New("format gambar jurnal tidak didukung")
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(decoded) == 0 || len(decoded) > 128*1024 {
		return errors.New("data gambar jurnal tidak valid atau terlalu besar")
	}
	if header == "data:image/jpeg;base64" && (len(decoded) < 3 || decoded[0] != 0xff || decoded[1] != 0xd8 || decoded[2] != 0xff) {
		return errors.New("data gambar JPEG tidak valid")
	}
	if header == "data:image/png;base64" && (len(decoded) < 8 || string(decoded[:8]) != "\x89PNG\r\n\x1a\n") {
		return errors.New("data gambar PNG tidak valid")
	}
	return nil
}
func safeColor(s string) string {
	if len(s) == 7 && s[0] == '#' {
		for _, c := range s[1:] {
			if !strings.ContainsRune("0123456789abcdefABCDEF", c) {
				return "#F2B66D"
			}
		}
		return s
	}
	return "#F2B66D"
}
