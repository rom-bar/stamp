module View

open System
open Feliz
open Fable.React
open App
open Types

let private palette = [
    "#F5A623"; "#4A90D9"; "#D9548A"; "#F0C419"
    "#E0566F"; "#6FAE4E"; "#7BA3C4"; "#B879D1"
    "#8E7CC3"; "#4FC3D9"; "#E0A93A"; "#4FBF8F"
]

let private firstId items getId =
    items |> List.tryHead |> Option.map getId

let private stampGlyph (emoji: string option) (size: int) =
    Html.div [
        prop.style [
            style.fontSize size
            style.lineHeight 1.0
            style.display.flex
            style.alignItems.center
            style.justifyContent.center
        ]
        prop.text (defaultArg emoji "❓")
    ]

let private textField (label: string) (value: string) (onChange: string -> unit) (placeholder: string) (autofocus: bool) =
    Html.div [
        prop.style [ style.marginBottom 16 ]
        prop.children [
            Html.div [
                prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 6; style.fontWeight 500 ]
                prop.text label
            ]
            Html.input [
                prop.autoFocus autofocus
                prop.value value
                prop.placeholder placeholder
                prop.onChange (fun (text: string) -> onChange text)
                prop.style [ style.padding 12; style.fontSize 15 ]
            ]
        ]
    ]

let private primaryButton (label: string) (disabled: bool) (onClick: unit -> unit) =
    Html.button [
        prop.disabled disabled
        prop.onClick (fun _ -> onClick ())
        prop.style [ style.padding 12; style.backgroundColor "#2d2a24"; style.color "white" ]
        prop.text label
    ]

let private screenHeader (title: string) (onBack: unit -> unit) =
    Html.div [
        prop.style [ style.display.flex; style.alignItems.center; style.gap 10; style.marginBottom 20 ]
        prop.children [
            Html.button [
                prop.onClick (fun _ -> onBack ())
                prop.style [ style.padding 4; style.backgroundColor "transparent" ]
                prop.text "←"
            ]
            Html.div [ prop.text title ]
        ]
    ]

let private listRow (left: ReactElement) (right: ReactElement) (onDelete: (unit -> unit) option) =
    Html.div [
        prop.style [ style.display.flex; style.alignItems.center; style.justifyContent.spaceBetween; style.padding 12; style.marginBottom 8 ]
        prop.children [
            Html.div [ prop.children [ left ] ]
            Html.div [
                prop.children [
                    right
                    if onDelete.IsSome then
                        Html.button [
                            prop.onClick (fun _ -> onDelete.Value ())
                            prop.style [ style.padding 6; style.color "#c77b8f" ]
                            prop.text "Remove"
                        ]
                ]
            ]
        ]
    ]

let render (model: Model) (dispatch: Msg -> unit) =
    let onboarding = onboardingStep model.Data
    let effectiveScreen =
        match onboarding with
        | Some NeedsChildren -> ManageChildren
        | Some NeedsReasons -> ManageReasons
        | Some NeedsStamps -> ManageStamps
        | None -> model.Screen

    let selectedChildId : ChildId option =
        match model.CollectionChildId with
        | Some childId -> Some childId
        | None -> firstId model.Data.Children (fun c -> c.Id)

    let rewardsChildId : ChildId option =
        match model.RewardsChildId with
        | Some childId -> Some childId
        | None -> firstId model.Data.Children (fun c -> c.Id)

    let body =
        match effectiveScreen with
        | GiveStamp ->
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    Html.h3 [ prop.text "Give stamp" ]
                    Html.div [ prop.text "Who is this for?" ]
                    Html.div [
                        prop.children [
                            for child in model.Data.Children do
                                Html.button [
                                    prop.key child.Id
                                    prop.onClick (fun _ -> dispatch (SelectGiveChild child.Id))
                                    prop.style [ style.marginRight 8; style.padding 8 ]
                                    prop.text child.Name
                                ]
                        ]
                    ]
                    Html.div [ prop.text "What is this for?" ]
                    Html.div [
                        prop.children [
                            for reason in model.Data.Reasons do
                                Html.button [
                                    prop.key reason.Id
                                    prop.onClick (fun _ -> dispatch (SelectGiveReason reason.Id))
                                    prop.style [ style.marginRight 8; style.padding 8 ]
                                    prop.text reason.Label
                                ]
                        ]
                    ]
                    Html.div [ prop.text "Pick a stamp" ]
                    Html.div [
                        prop.children [
                            for stamp in model.Data.Stamps do
                                Html.button [
                                    prop.key stamp.Id
                                    prop.onClick (fun _ -> dispatch (SelectGiveStamp stamp.Id))
                                    prop.style [ style.marginRight 8; style.padding 8 ]
                                    prop.children [ stampGlyph (Some stamp.Emoji) 24 ]
                                ]
                        ]
                    ]
                    match model.GiveDraft.Error with
                    | Some error -> Html.div [ prop.text error ]
                    | None -> Html.none
                    primaryButton (if model.GiveDraft.Animating then "Awarding..." else "Give stamp") false (fun () -> dispatch SubmitGiveStamp)
                ]
            ]
        | Collection ->
            let awards =
                model.Data.Awards
                |> List.filter (fun award -> award.ChildId = (selectedChildId |> Option.defaultValue ""))
                |> List.sortByDescending (fun award -> award.Timestamp)
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    screenHeader "Collection" (fun () -> dispatch (SetScreen GiveStamp))
                    Html.div [
                        prop.children [
                            for child in model.Data.Children do
                                Html.button [
                                    prop.key child.Id
                                    prop.onClick (fun _ -> dispatch (SelectCollectionChild child.Id))
                                    prop.style [ style.marginRight 8; style.padding 8 ]
                                    prop.text child.Name
                                ]
                        ]
                    ]
                    if awards.IsEmpty then
                        Html.div [ prop.text "No stamps yet" ]
                    else
                        Html.div [
                            prop.children [
                                for award in awards do
                                    match model.Data.Stamps |> List.tryFind (fun stamp -> stamp.Id = award.StampTypeId) with
                                    | Some stamp ->
                                        Html.button [
                                            prop.key award.Id
                                            prop.onClick (fun _ -> dispatch (ReplayAward award.Id))
                                            prop.style [ style.marginRight 8; style.padding 8 ]
                                            prop.children [ stampGlyph (Some stamp.Emoji) 30 ]
                                        ]
                                    | None -> Html.none
                            ]
                        ]
                ]
            ]
        | RewardsScreen ->
            let balance =
                model.Data.Awards
                |> List.filter (fun award -> award.ChildId = (rewardsChildId |> Option.defaultValue "") && award.Status = Active)
                |> List.length
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    screenHeader "Rewards" (fun () -> dispatch (SetScreen GiveStamp))
                    Html.div [ prop.text (sprintf "Available stamps: %d" balance) ]
                    Html.div [
                        prop.children [
                            for reward in model.Data.Rewards do
                                let affordable = balance >= reward.Cost
                                Html.div [
                                    prop.key reward.Id
                                    prop.style [ style.marginBottom 8 ]
                                    prop.children [
                                        Html.button [
                                            prop.onClick (fun _ -> if affordable then dispatch (RequestRedeem reward.Id))
                                            prop.disabled (not affordable)
                                            prop.style [ style.padding 8 ]
                                            prop.text reward.Name
                                        ]
                                        Html.span [ prop.text (sprintf " (%d stamps)" reward.Cost) ]
                                    ]
                                ]
                        ]
                    ]
                    match model.ConfirmingRewardId with
                    | Some rewardId ->
                        match model.Data.Rewards |> List.tryFind (fun reward -> reward.Id = rewardId) with
                        | Some reward ->
                            Html.div [
                                prop.children [
                                    Html.div [ prop.text (sprintf "Redeem %s?" reward.Name) ]
                                    Html.button [ prop.onClick (fun _ -> dispatch ConfirmRedeem); prop.text "Confirm" ]
                                    Html.button [ prop.onClick (fun _ -> dispatch CancelRedeem); prop.text "Cancel" ]
                                ]
                            ]
                        | None -> Html.none
                    | None -> Html.none
                ]
            ]
        | ManageChildren ->
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    if onboarding = None then screenHeader "Manage children" (fun () -> dispatch (SetScreen GiveStamp)) else Html.div []
                    if not model.Data.Children.IsEmpty then
                        Html.div [
                            prop.children [
                                for child in model.Data.Children do
                                    listRow
                                        (Html.span [ prop.text child.Name ])
                                        Html.none
                                        (Some (fun () -> dispatch (DeleteChild child.Id)))
                            ]
                        ]
                    else Html.none
                    textField "Child's name" model.NewChildForm.Name (fun value -> dispatch (UpdateNewChildName value)) "e.g. Ilyas" true
                    primaryButton "Add child" (String.IsNullOrWhiteSpace model.NewChildForm.Name) (fun () -> dispatch AddChild)
                ]
            ]
        | ManageReasons ->
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    if onboarding = None then screenHeader "Manage reasons" (fun () -> dispatch (SetScreen GiveStamp)) else Html.div []
                    if not model.Data.Reasons.IsEmpty then
                        Html.div [
                            prop.children [
                                for reason in model.Data.Reasons do
                                    listRow
                                        (Html.span [ prop.text reason.Label ])
                                        Html.none
                                        (Some (fun () -> dispatch (DeleteReason reason.Id)))
                            ]
                        ]
                    else Html.none
                    textField "Reason" model.NewReasonForm.Label (fun value -> dispatch (UpdateNewReasonLabel value)) "e.g. Finished homework" true
                    primaryButton "Add reason" (String.IsNullOrWhiteSpace model.NewReasonForm.Label) (fun () -> dispatch AddReason)
                ]
            ]
        | ManageStamps ->
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    if onboarding = None then screenHeader "Manage stamps" (fun () -> dispatch (SetScreen GiveStamp)) else Html.div []
                    if not model.Data.Stamps.IsEmpty then
                        Html.div [
                            prop.children [
                                for stamp in model.Data.Stamps do
                                    listRow
                                        (Html.span [ prop.text stamp.Name ])
                                        Html.none
                                        (Some (fun () -> dispatch (DeleteStamp stamp.Id)))
                            ]
                        ]
                    else Html.none
                    textField "Emoji" (model.NewStampForm.Emoji |> Option.defaultValue "") (fun value -> dispatch (UpdateNewStampEmoji value)) "Tap and open your emoji keyboard" true
                    textField "Name" model.NewStampForm.Name (fun value -> dispatch (UpdateNewStampName value)) "e.g. Rocket" false
                    primaryButton "Add stamp" (String.IsNullOrWhiteSpace (model.NewStampForm.Emoji |> Option.defaultValue "") || String.IsNullOrWhiteSpace model.NewStampForm.Name) (fun () -> dispatch AddStamp)
                ]
            ]
        | ManageRewards ->
            Html.div [
                prop.style [ style.padding 8 ]
                prop.children [
                    screenHeader "Manage rewards" (fun () -> dispatch (SetScreen RewardsScreen))
                    if not model.Data.Rewards.IsEmpty then
                        Html.div [
                            prop.children [
                                for reward in model.Data.Rewards do
                                    listRow
                                        (Html.span [ prop.text reward.Name ])
                                        (Html.span [ prop.text (sprintf "%d stamps" reward.Cost) ])
                                        (Some (fun () -> dispatch (DeleteReward reward.Id)))
                            ]
                        ]
                    else Html.none
                    textField "Emoji" (model.NewRewardForm.Emoji |> Option.defaultValue "") (fun value -> dispatch (UpdateNewRewardEmoji value)) "Tap and open your emoji keyboard" true
                    textField "Reward name" model.NewRewardForm.Name (fun value -> dispatch (UpdateNewRewardName value)) "e.g. Choose dinner tonight" false
                    textField "Cost (stamps)" model.NewRewardForm.Cost (fun value -> dispatch (UpdateNewRewardCost value)) "5" false
                    primaryButton "Add reward" (String.IsNullOrWhiteSpace (model.NewRewardForm.Emoji |> Option.defaultValue "") || String.IsNullOrWhiteSpace model.NewRewardForm.Name) (fun () -> dispatch AddReward)
                ]
            ]

    Html.div [
        prop.style [ style.padding 16; style.backgroundColor "#faf8f2" ]
        prop.children [
            Html.h2 [ prop.text (match effectiveScreen with | GiveStamp -> "Stamp collector" | Collection -> "Collection" | RewardsScreen -> "Rewards" | ManageChildren -> "Manage children" | ManageReasons -> "Manage reasons" | ManageStamps -> "Manage stamps" | ManageRewards -> "Manage rewards") ]
            body
            if model.MenuOpen then
                Html.div [
                    prop.style [ style.marginTop 16 ]
                    prop.children [
                        Html.button [ prop.onClick (fun _ -> dispatch (SetScreen Collection); dispatch (ToggleMenu false)); prop.text "Collection" ]
                        Html.button [ prop.onClick (fun _ -> dispatch (SetScreen RewardsScreen); dispatch (ToggleMenu false)); prop.text "Rewards" ]
                        Html.button [ prop.onClick (fun _ -> dispatch (SetScreen ManageChildren); dispatch (ToggleMenu false)); prop.text "Manage children" ]
                        Html.button [ prop.onClick (fun _ -> dispatch (SetScreen ManageStamps); dispatch (ToggleMenu false)); prop.text "Manage stamps" ]
                        Html.button [ prop.onClick (fun _ -> dispatch (SetScreen ManageReasons); dispatch (ToggleMenu false)); prop.text "Manage reasons" ]
                    ]
                ]
            else Html.none
            Html.button [
                prop.onClick (fun _ -> dispatch (ToggleMenu true))
                prop.style [ style.marginTop 12; style.padding 8 ]
                prop.text "Menu"
            ]
        ]
    ]
