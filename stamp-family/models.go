package main

import (
	"database/sql"
	"encoding/json"
)

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
