module App

open Elmish
open Fable.Core
open Types

[<Import("sleep", "./timing.js")>]
let private sleep (ms: int) : JS.Promise<unit> = jsNative

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

type GiveStampDraft = {
    ChildId: ChildId option
    ReasonId: ReasonId option
    StampTypeId: StampTypeId option
    Error: string option
    Animating: bool
}

module GiveStampDraft =
    let empty = {
        ChildId = None
        ReasonId = None
        StampTypeId = None
        Error = None
        Animating = false
    }

type NewChildForm = { Name: string; Color: string }
type NewReasonForm = { Label: string }
type NewStampForm = { Emoji: string option; Name: string; Color: string }
type NewRewardForm = { Emoji: string option; Name: string; Cost: string }

type Model = {
    Data: AppData
    Loaded: bool
    Screen: Screen
    MenuOpen: bool

    // Give Stamp screen working state
    GiveDraft: GiveStampDraft

    // Collection screen: which child is currently selected, and which award
    // (if any) is being replayed in the full-screen modal
    CollectionChildId: ChildId option
    ReplayingAwardId: AwardId option

    // Rewards screen
    RewardsChildId: ChildId option
    ConfirmingRewardId: RewardId option
    JustRedeemed: bool

    // Manage screens: new-entry form state
    NewChildForm: NewChildForm
    NewReasonForm: NewReasonForm
    NewStampForm: NewStampForm
    NewRewardForm: NewRewardForm
}

type Msg =
    | DataLoaded of AppData
    | DataSaved

    | SetScreen of Screen
    | ToggleMenu of bool

    // Give Stamp
    | SelectGiveChild of ChildId
    | SelectGiveReason of ReasonId
    | SelectGiveStamp of StampTypeId
    | SubmitGiveStamp
    | GiveStampAnimationFinished

    // Collection
    | SelectCollectionChild of ChildId
    | ReplayAward of AwardId
    | CloseReplay

    // Rewards
    | SelectRewardsChild of ChildId
    | RequestRedeem of RewardId
    | CancelRedeem
    | ConfirmRedeem
    | DismissJustRedeemed

    // Manage Children
    | UpdateNewChildName of string
    | UpdateNewChildColor of string
    | AddChild
    | DeleteChild of ChildId

    // Manage Reasons
    | UpdateNewReasonLabel of string
    | AddReason
    | DeleteReason of ReasonId

    // Manage Stamps
    | UpdateNewStampEmoji of string
    | UpdateNewStampName of string
    | UpdateNewStampColor of string
    | AddStamp
    | DeleteStamp of StampTypeId

    // Manage Rewards
    | UpdateNewRewardEmoji of string
    | UpdateNewRewardName of string
    | UpdateNewRewardCost of string
    | AddReward
    | DeleteReward of RewardId

let private defaultPaletteColor (usedCount: int) =
    let palette = [
        "#F5A623"; "#4A90D9"; "#D9548A"; "#F0C419"
        "#E0566F"; "#6FAE4E"; "#7BA3C4"; "#B879D1"
        "#8E7CC3"; "#4FC3D9"; "#E0A93A"; "#4FBF8F"
    ]
    palette.[usedCount % palette.Length]

let init () : Model * Cmd<Msg> =
    let model = {
        Data = AppData.empty
        Loaded = false
        Screen = GiveStamp
        MenuOpen = false
        GiveDraft = GiveStampDraft.empty
        CollectionChildId = None
        ReplayingAwardId = None
        RewardsChildId = None
        ConfirmingRewardId = None
        JustRedeemed = false
        NewChildForm = { Name = ""; Color = defaultPaletteColor 0 }
        NewReasonForm = { Label = "" }
        NewStampForm = { Emoji = None; Name = ""; Color = defaultPaletteColor 0 }
        NewRewardForm = { Emoji = None; Name = ""; Cost = "5" }
    }
    model, Cmd.OfPromise.perform Storage.loadAppData () DataLoaded

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let private uid () : string =
    let ticks = System.DateTime.UtcNow.Ticks
    let rand = System.Random().Next(100000, 999999)
    sprintf "%d-%d" ticks rand

let private saveCmd (data: AppData) : Cmd<Msg> =
    Cmd.OfPromise.perform Storage.saveAppData data (fun () -> DataSaved)

let private firstId (items: 'a list) (getId: 'a -> string) : string option =
    items |> List.tryHead |> Option.map getId

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

let update (msg: Msg) (model: Model) : Model * Cmd<Msg> =
    match msg with
    | DataLoaded data ->
        let model =
            { model with
                Data = data
                Loaded = true
                CollectionChildId = firstId data.Children (fun c -> c.Id)
                RewardsChildId = firstId data.Children (fun c -> c.Id)
                NewChildForm = { Name = ""; Color = defaultPaletteColor data.Children.Length }
                NewStampForm = { Emoji = None; Name = ""; Color = defaultPaletteColor data.Stamps.Length }
            }
        model, Cmd.none

    | DataSaved ->
        model, Cmd.none

    | SetScreen screen ->
        { model with Screen = screen }, Cmd.none

    | ToggleMenu isOpen ->
        { model with MenuOpen = isOpen }, Cmd.none

    // ---------------- Give Stamp ----------------

    | SelectGiveChild childId ->
        { model with GiveDraft = { model.GiveDraft with ChildId = Some childId; Error = None } }, Cmd.none

    | SelectGiveReason reasonId ->
        Sound.playTapSound ()
        { model with GiveDraft = { model.GiveDraft with ReasonId = Some reasonId; Error = None } }, Cmd.none

    | SelectGiveStamp stampId ->
        Sound.playTapSound ()
        { model with GiveDraft = { model.GiveDraft with StampTypeId = Some stampId; Error = None } }, Cmd.none

    | SubmitGiveStamp ->
        let draft = model.GiveDraft
        match draft.ChildId, draft.ReasonId, draft.StampTypeId with
        | None, _, _ ->
            { model with GiveDraft = { draft with Error = Some "Pick a child first" } }, Cmd.none
        | _, None, _ ->
            { model with GiveDraft = { draft with Error = Some "Pick a reason first" } }, Cmd.none
        | _, _, None ->
            { model with GiveDraft = { draft with Error = Some "Pick a stamp first" } }, Cmd.none
        | Some childId, Some reasonId, Some stampId ->
            Sound.playAwardChime ()
            let award = {
                Id = uid ()
                ChildId = childId
                ReasonId = reasonId
                StampTypeId = stampId
                Timestamp = JS.Constructors.Date.now ()
                Status = Active
            }
            let newData = { model.Data with Awards = model.Data.Awards @ [ award ] }
            let model = { model with Data = newData; GiveDraft = { draft with Error = None; Animating = true } }
            // Delay clearing the animation + draft to let the full-screen
            // award animation play out, matching the JS prototype's 2.4s timing.
            let delayCmd =
                Cmd.OfPromise.perform
                    (fun () -> sleep 2400)
                    ()
                    (fun () -> GiveStampAnimationFinished)
            model, Cmd.batch [ saveCmd newData; delayCmd ]

    | GiveStampAnimationFinished ->
        { model with
            GiveDraft = { model.GiveDraft with ReasonId = None; StampTypeId = None; Animating = false } },
        Cmd.none

    // ---------------- Collection ----------------

    | SelectCollectionChild childId ->
        { model with CollectionChildId = Some childId }, Cmd.none

    | ReplayAward awardId ->
        Sound.playAwardChime ()
        { model with ReplayingAwardId = Some awardId }, Cmd.none

    | CloseReplay ->
        { model with ReplayingAwardId = None }, Cmd.none

    // ---------------- Rewards ----------------

    | SelectRewardsChild childId ->
        { model with RewardsChildId = Some childId }, Cmd.none

    | RequestRedeem rewardId ->
        { model with ConfirmingRewardId = Some rewardId }, Cmd.none

    | CancelRedeem ->
        { model with ConfirmingRewardId = None }, Cmd.none

    | ConfirmRedeem ->
        match model.ConfirmingRewardId, model.RewardsChildId with
        | Some rewardId, Some childId ->
            let rewardOpt = model.Data.Rewards |> List.tryFind (fun r -> r.Id = rewardId)
            match rewardOpt with
            | None -> { model with ConfirmingRewardId = None }, Cmd.none
            | Some reward ->
                // Spend the oldest active awards first, up to reward.Cost of them.
                let activeAwardIdsOldestFirst =
                    model.Data.Awards
                    |> List.filter (fun a -> a.ChildId = childId && a.Status = Active)
                    |> List.sortBy (fun a -> a.Timestamp)
                    |> List.truncate reward.Cost
                    |> List.map (fun a -> a.Id)
                    |> Set.ofList

                let updatedAwards =
                    model.Data.Awards
                    |> List.map (fun a ->
                        if Set.contains a.Id activeAwardIdsOldestFirst then
                            { a with Status = Redeemed }
                        else
                            a)

                let newData = { model.Data with Awards = updatedAwards }
                Sound.playRedeemChime ()
                let model =
                    { model with
                        Data = newData
                        ConfirmingRewardId = None
                        JustRedeemed = true }
                let dismissCmd =
                    Cmd.OfPromise.perform
                        (fun () -> sleep 1800)
                        ()
                        (fun () -> DismissJustRedeemed)
                model, Cmd.batch [ saveCmd newData; dismissCmd ]
        | _ ->
            { model with ConfirmingRewardId = None }, Cmd.none

    | DismissJustRedeemed ->
        { model with JustRedeemed = false }, Cmd.none

    // ---------------- Manage Children ----------------

    | UpdateNewChildName name ->
        { model with NewChildForm = { model.NewChildForm with Name = name } }, Cmd.none

    | UpdateNewChildColor color ->
        { model with NewChildForm = { model.NewChildForm with Color = color } }, Cmd.none

    | AddChild ->
        let name = model.NewChildForm.Name.Trim()
        if name = "" then
            model, Cmd.none
        else
            let child = { Id = uid (); Name = name; Color = model.NewChildForm.Color }
            let newData = { model.Data with Children = model.Data.Children @ [ child ] }
            let model =
                { model with
                    Data = newData
                    NewChildForm = { Name = ""; Color = defaultPaletteColor newData.Children.Length }
                    CollectionChildId = model.CollectionChildId |> Option.orElse (Some child.Id)
                    RewardsChildId = model.RewardsChildId |> Option.orElse (Some child.Id)
                    GiveDraft =
                        if model.GiveDraft.ChildId = None then
                            { model.GiveDraft with ChildId = Some child.Id }
                        else
                            model.GiveDraft }
            model, saveCmd newData

    | DeleteChild childId ->
        let newData = { model.Data with Children = model.Data.Children |> List.filter (fun c -> c.Id <> childId) }
        let model =
            { model with
                Data = newData
                CollectionChildId = if model.CollectionChildId = Some childId then firstId newData.Children (fun c -> c.Id) else model.CollectionChildId
                RewardsChildId = if model.RewardsChildId = Some childId then firstId newData.Children (fun c -> c.Id) else model.RewardsChildId
                GiveDraft = if model.GiveDraft.ChildId = Some childId then { model.GiveDraft with ChildId = firstId newData.Children (fun c -> c.Id) } else model.GiveDraft }
        model, saveCmd newData

    // ---------------- Manage Reasons ----------------

    | UpdateNewReasonLabel label ->
        { model with NewReasonForm = { Label = label } }, Cmd.none

    | AddReason ->
        let label = model.NewReasonForm.Label.Trim()
        if label = "" then
            model, Cmd.none
        else
            let reason = { Id = uid (); Label = label }
            let newData = { model.Data with Reasons = model.Data.Reasons @ [ reason ] }
            { model with Data = newData; NewReasonForm = { Label = "" } }, saveCmd newData

    | DeleteReason reasonId ->
        let newData = { model.Data with Reasons = model.Data.Reasons |> List.filter (fun r -> r.Id <> reasonId) }
        { model with Data = newData }, saveCmd newData

    // ---------------- Manage Stamps ----------------

    | UpdateNewStampEmoji emoji ->
        { model with NewStampForm = { model.NewStampForm with Emoji = Some emoji } }, Cmd.none

    | UpdateNewStampName name ->
        { model with NewStampForm = { model.NewStampForm with Name = name } }, Cmd.none

    | UpdateNewStampColor color ->
        { model with NewStampForm = { model.NewStampForm with Color = color } }, Cmd.none

    | AddStamp ->
        let form = model.NewStampForm
        let name = form.Name.Trim()
        match form.Emoji, name with
        | Some emoji, name when emoji <> "" && name <> "" ->
            let stamp = { Id = uid (); Emoji = emoji; Name = name; Color = form.Color }
            let newData = { model.Data with Stamps = model.Data.Stamps @ [ stamp ] }
            let model =
                { model with
                    Data = newData
                    NewStampForm = { Emoji = None; Name = ""; Color = defaultPaletteColor newData.Stamps.Length } }
            model, saveCmd newData
        | _ ->
            model, Cmd.none

    | DeleteStamp stampId ->
        let newData = { model.Data with Stamps = model.Data.Stamps |> List.filter (fun s -> s.Id <> stampId) }
        { model with Data = newData }, saveCmd newData

    // ---------------- Manage Rewards ----------------

    | UpdateNewRewardEmoji emoji ->
        { model with NewRewardForm = { model.NewRewardForm with Emoji = Some emoji } }, Cmd.none

    | UpdateNewRewardName name ->
        { model with NewRewardForm = { model.NewRewardForm with Name = name } }, Cmd.none

    | UpdateNewRewardCost cost ->
        { model with NewRewardForm = { model.NewRewardForm with Cost = cost } }, Cmd.none

    | AddReward ->
        let form = model.NewRewardForm
        let name = form.Name.Trim()
        let costOpt = match System.Int32.TryParse form.Cost with | true, v when v > 0 -> Some v | _ -> None
        match form.Emoji, name, costOpt with
        | Some emoji, name, Some cost when emoji <> "" && name <> "" ->
            let reward = { Id = uid (); Emoji = emoji; Name = name; Cost = cost }
            let newData = { model.Data with Rewards = model.Data.Rewards @ [ reward ] }
            { model with Data = newData; NewRewardForm = { Emoji = None; Name = ""; Cost = "5" } }, saveCmd newData
        | _ ->
            model, Cmd.none

    | DeleteReward rewardId ->
        let newData = { model.Data with Rewards = model.Data.Rewards |> List.filter (fun r -> r.Id <> rewardId) }
        { model with Data = newData }, saveCmd newData
