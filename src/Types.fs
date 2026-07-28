module Types

type ChildId = string
type ReasonId = string
type StampTypeId = string
type RewardId = string
type AwardId = string

type Child = {
    Id: ChildId
    Name: string
    Color: string
}

type Reason = {
    Id: ReasonId
    Label: string
}

type StampType = {
    Id: StampTypeId
    Emoji: string
    Name: string
    Color: string
}

type Reward = {
    Id: RewardId
    Emoji: string
    Name: string
    Cost: int
}

type AwardStatus =
    | Active
    | Redeemed

type Award = {
    Id: AwardId
    ChildId: ChildId
    ReasonId: ReasonId
    StampTypeId: StampTypeId
    Timestamp: float // JS epoch millis, matches Tokecang convention
    Status: AwardStatus
}

/// The full persisted app state — this is what gets written to / read from IndexedDB.
type AppData = {
    Children: Child list
    Reasons: Reason list
    Stamps: StampType list
    Rewards: Reward list
    Awards: Award list
}

module AppData =
    let empty = {
        Children = []
        Reasons = []
        Stamps = []
        Rewards = []
        Awards = []
    }

type Screen =
    | GiveStamp
    | Collection
    | RewardsScreen
    | ManageChildren
    | ManageReasons
    | ManageStamps
    | ManageRewards

/// Which onboarding step (if any) must be completed before Give Stamp is usable.
/// Order matters: Children -> Reasons -> Stamps.
type OnboardingStep =
    | NeedsChildren
    | NeedsReasons
    | NeedsStamps

let onboardingStep (data: AppData) : OnboardingStep option =
    if List.isEmpty data.Children then Some NeedsChildren
    elif List.isEmpty data.Reasons then Some NeedsReasons
    elif List.isEmpty data.Stamps then Some NeedsStamps
    else None
