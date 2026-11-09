package main

import (
	"crypto/rand"
	"crypto/sha256"
	"embed"
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

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

//go:embed web/* web/templates/* web/static/*
var webFiles embed.FS

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
