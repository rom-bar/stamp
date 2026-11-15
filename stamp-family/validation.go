package main

import (
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

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
