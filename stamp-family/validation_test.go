package main

import "testing"

func TestSafeColor(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty", input: "", want: "#F2B66D"},
		{name: "valid lowercase", input: "#abcdef", want: "#abcdef"},
		{name: "valid uppercase", input: "#ABCDEF", want: "#ABCDEF"},
		{name: "valid mixed case", input: "#a1B2c3", want: "#a1B2c3"},
		{name: "invalid prefix", input: "ffffff", want: "#F2B66D"},
		{name: "invalid length short", input: "#fff", want: "#F2B66D"},
		{name: "invalid length long", input: "#ffffffff", want: "#F2B66D"},
		{name: "invalid character", input: "#12xz89", want: "#F2B66D"},
		{name: "unicode digit", input: "#１２３４５６", want: "#F2B66D"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := safeColor(tt.input); got != tt.want {
				t.Fatalf("safeColor(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestIntValue(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  int
	}{
		{name: "nil", input: nil, want: 0},
		{name: "float truncates", input: 12.9, want: 12},
		{name: "negative float truncates toward zero", input: -12.9, want: -12},
		{name: "int", input: 42, want: 42},
		{name: "empty string", input: "", want: 0},
		{name: "decimal string", input: " 17 ", want: 17},
		{name: "invalid string", input: "not-a-number", want: 0},
		{name: "unsupported type", input: true, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := intValue(tt.input); got != tt.want {
				t.Fatalf("intValue(%#v) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

func TestStr(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  string
	}{
		{name: "nil", input: nil, want: ""},
		{name: "empty string", input: "", want: ""},
		{name: "trims ASCII whitespace", input: "  hello \t", want: "hello"},
		{name: "trims Unicode whitespace", input: "\u2003halo\u00a0", want: "halo"},
		{name: "preserves internal whitespace", input: "hello  world", want: "hello  world"},
		{name: "unsupported type", input: 12, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := str(tt.input); got != tt.want {
				t.Fatalf("str(%#v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestCleanText(t *testing.T) {
	tests := []struct {
		name  string
		input string
		max   int
		want  string
	}{
		{name: "empty", input: "", max: 10, want: ""},
		{name: "trims and flattens newlines", input: "  halo\n dunia\r!  ", max: 50, want: "halo  dunia !"},
		{name: "unicode boundary", input: "abcdé你好", max: 6, want: "abcdé你"},
		{name: "exact boundary", input: "abc", max: 3, want: "abc"},
		{name: "zero limit", input: "abc", max: 0, want: ""},
		{name: "Unicode whitespace", input: "\u2003teks\u00a0", max: 20, want: "teks"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cleanText(tt.input, tt.max); got != tt.want {
				t.Fatalf("cleanText(%q, %d) = %q, want %q", tt.input, tt.max, got, tt.want)
			}
		})
	}
}

func TestCleanMultiline(t *testing.T) {
	tests := []struct {
		name  string
		input string
		max   int
		want  string
	}{
		{name: "empty", input: "", max: 10, want: ""},
		{name: "normalizes line endings", input: "  satu\r\ndua\rtiga  ", max: 50, want: "satu\ndua\ntiga"},
		{name: "removes null bytes", input: "a\x00b\x00", max: 10, want: "ab"},
		{name: "unicode boundary", input: "abcdé你好", max: 6, want: "abcdé你"},
		{name: "exact boundary", input: "abc", max: 3, want: "abc"},
		{name: "zero limit", input: "abc", max: 0, want: ""},
		{name: "preserves internal whitespace", input: "  satu  \n dua  ", max: 30, want: "satu  \n dua"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cleanMultiline(tt.input, tt.max); got != tt.want {
				t.Fatalf("cleanMultiline(%q, %d) = %q, want %q", tt.input, tt.max, got, tt.want)
			}
		})
	}
}
