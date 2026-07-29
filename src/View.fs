module View

open Feliz
open App
open Types
open Icons

// ---------------------------------------------------------------------------
// Css helpers — wraps CSS properties that may not have named helpers in
// Feliz 3.2.0, using the always-available (name, value) object notation.
// All standard properties (color, fontSize, padding, margin, border, etc.)
// use the normal style.xxx DSL. These are only for the ones we're uncertain
// about across Feliz versions.
// ---------------------------------------------------------------------------
module Css =
    let inline aspectRatio (v: string) = style.custom ("aspectRatio", v)
    let inline gridTemplateColumns (v: string) = style.custom ("gridTemplateColumns", v)
    let inline gap (px: int) = style.custom ("gap", $"{px}px")
    let inline gap2 (a: int) (b: int) = style.custom ("gap", $"{a}px {b}px")
    let inline flexGrow (v: int) = style.custom ("flexGrow", string v)
    let inline flexShrink (v: int) = style.custom ("flexShrink", string v)
    let inline minWidth (px: int) = style.custom ("minWidth", $"{px}px")
    let inline maxWidth (px: int) = style.custom ("maxWidth", $"{px}px")
    let inline whiteSpace (v: string) = style.custom ("whiteSpace", v)
    let inline overflowX (v: string) = style.custom ("overflowX", v)
    let inline overflowY (v: string) = style.custom ("overflowY", v)
    let inline pointerEvents (v: string) = style.custom ("pointerEvents", v)
    let inline backgroundImage (v: string) = style.custom ("backgroundImage", v)
    let inline textDecorationLine (v: string) = style.custom ("textDecorationLine", v)
    let inline animation (v: string) = style.custom ("animation", v)
    let inline transition (v: string) = style.custom ("transition", v)
    let inline textShadow (v: string) = style.custom ("textShadow", v)
    let inline transform (v: string) = style.custom ("transform", v)
    let inline transformOrigin (v: string) = style.custom ("transformOrigin", v)
    let inline border (v: string) = style.custom ("border", v)
    let inline borderBottom (v: string) = style.custom ("borderBottom", v)
    let inline boxShadow (v: string) = style.custom ("boxShadow", v)
    let inline lineHeight (v: int) = style.custom ("lineHeight", string v)
    let inline opacity (v: float) = style.custom ("opacity", string v)
    let inline background (v: string) = style.custom ("background", v)

// ---------------------------------------------------------------------------
// Shared CSS-in-Feliz helpers
// ---------------------------------------------------------------------------

let palette = [
    "#F5A623"; "#4A90D9"; "#D9548A"; "#F0C419"
    "#E0566F"; "#6FAE4E"; "#7BA3C4"; "#B879D1"
    "#8E7CC3"; "#4FC3D9"; "#E0A93A"; "#4FBF8F"
]

let sharedKeyframes = """
@keyframes bg-flash-in { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes stamp-slam-big {
  0%   { transform: scale(3.2) rotate(-12deg); opacity: 0; }
  55%  { transform: scale(0.92) rotate(4deg);  opacity: 1; }
  75%  { transform: scale(1.08) rotate(-2deg); }
  100% { transform: scale(1)    rotate(0deg);  }
}
@keyframes stamp-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.06); }
}
@keyframes label-pop-in {
  0%   { opacity: 0; transform: translateY(10px) scale(0.8); }
  100% { opacity: 1; transform: translateY(0)    scale(1);   }
}
@keyframes ray-burst {
  0%   { opacity: 0.7; transform: scaleY(0.3); }
  100% { opacity: 0;   transform: scaleY(1.4); }
}
@keyframes confetti-fall {
  0%   { transform: translateY(0)     translateX(0)               rotate(0deg);   opacity: 1; }
  100% { transform: translateY(100vh) translateX(var(--drift,0px)) rotate(720deg); opacity: 0; }
}
"""

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

[<ReactComponent>]
let StampGlyph (emoji: string) (size: int) =
    Html.div [
        prop.style [
            style.fontSize size
            style.lineHeight 1
            style.display.flex
            style.alignItems.center
            style.justifyContent.center
        ]
        prop.text (if emoji = "" then "❔" else emoji)
    ]

[<ReactComponent>]
let ColorSwatchPicker (value: string) (onChange: string -> unit) =
    Html.div [
        prop.style [ style.display.flex; style.flexWrap.wrap; style.gap 8 ]
        prop.children (
            palette |> List.map (fun c ->
                Html.button [
                    prop.key c
                    prop.onClick (fun _ -> onChange c)
                    prop.style [
                        style.width 32; style.height 32
                        style.borderRadius (length.percent 50)
                        style.backgroundColor c
                        Css.border (
                            if value = c then "3px solid #2d2a24"
                            else "2px solid white"
                        )
                        Css.boxShadow "0 0 0 1px #e5e0d5"
                        style.cursor.pointer
                    ]
                ]
            )
        )
    ]

[<ReactComponent>]
let TextField (label: string) (value: string) (onChange: string -> unit) (placeholder: string) (autoFocus: bool) =
    Html.div [
        prop.style [ style.marginBottom 16 ]
        prop.children [
            Html.div [
                prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 6; style.fontWeight 500 ]
                prop.text label
            ]
            Html.input [
                prop.autoFocus autoFocus
                prop.value value
                prop.onChange onChange
                prop.placeholder placeholder
                prop.style [
                    style.width (length.percent 100)
                    style.padding (12, 14)
                    style.borderRadius 12
                    Css.border "1px solid #e5e0d5"
                    style.fontSize 15
                    style.boxSizing.borderBox
                    style.outlineWidth 0
                    style.fontFamily "inherit"
                ]
            ]
        ]
    ]

let primaryBtn (label: string) (disabled: bool) (onClick: unit -> unit) =
    Html.button [
        prop.disabled disabled
        prop.onClick (fun _ -> onClick ())
        prop.text label
        prop.style [
            style.width (length.percent 100)
            style.padding (14, 0)
            style.borderRadius 14
            Css.border "none"
            style.backgroundColor (if disabled then "#d9d4c5" else "#2d2a24")
            style.color "white"
            style.fontSize 15
            style.fontWeight 500
            style.cursor (if disabled then "default" else "pointer")
        ]
    ]

let screenHeader (title: string) (onBack: unit -> unit) =
    Html.div [
        prop.style [ style.display.flex; style.alignItems.center; style.gap 10; style.marginBottom 20 ]
        prop.children [
            Html.button [
                prop.onClick (fun _ -> onBack ())
                prop.text "←"
                prop.style [
                    Css.border "none"; style.backgroundColor "transparent"
                    style.fontSize 20; style.cursor.pointer; style.color "#2d2a24"
                ]
            ]
            Html.div [
                prop.style [ style.fontSize 18; style.fontWeight 500; style.color "#2d2a24" ]
                prop.text title
            ]
        ]
    ]

let emptyState (text: string) =
    Html.div [
        prop.style [ style.textAlign.center; style.padding (40, 20); style.color "#b5b0a2"; style.fontSize 14 ]
        prop.text text
    ]

let listRow (left: ReactElement list) (right: ReactElement list) (onDelete: (unit -> unit) option) =
    Html.div [
        prop.style [
            style.display.flex; style.alignItems.center; style.justifyContent.spaceBetween
            style.padding (12, 14); style.borderRadius 12
            Css.border "1px solid #e5e0d5"; style.backgroundColor "white"; style.marginBottom 8
        ]
        prop.children [
            Html.div [
                prop.style [ style.display.flex; style.alignItems.center; style.gap 10 ]
                prop.children left
            ]
            Html.div [
                prop.style [ style.display.flex; style.alignItems.center; style.gap 10 ]
                prop.children [
                    yield! right
                    match onDelete with
                    | Some del ->
                        yield Html.button [
                            prop.onClick (fun _ -> del ())
                            prop.text "Remove"
                            prop.style [
                                Css.border "none"; style.backgroundColor "transparent"
                                style.color "#c77b8f"; style.fontSize 13; style.cursor.pointer
                            ]
                        ]
                    | None -> ()
                ]
            ]
        ]
    ]

let childSelector (children: Child list) (selectedId: ChildId option) (onSelect: ChildId -> unit) =
    Html.div [
        prop.style [ style.display.flex; style.gap 8; style.flexWrap.wrap; style.marginBottom 20 ]
        prop.children (
            children |> List.map (fun c ->
                Html.button [
                    prop.key c.Id
                    prop.onClick (fun _ -> onSelect c.Id)
                    prop.text c.Name
                    prop.style [
                        Css.flexGrow 1; Css.minWidth 90
                        style.padding (10, 12); style.borderRadius 12
                        Css.border (
                            if Some c.Id = selectedId then $"2px solid {c.Color}"
                            else "1px solid #e5e0d5"
                        )
                        style.backgroundColor (
                            if Some c.Id = selectedId then $"{c.Color}15"
                            else "white"
                        )
                        style.color (if Some c.Id = selectedId then c.Color else "#3d3a33")
                        style.fontWeight 500; style.fontSize 14; style.cursor.pointer
                    ]
                ]
            )
        )
    ]

// ---------------------------------------------------------------------------
// Icon picker — 60-icon closed preset grid grouped by category
// ---------------------------------------------------------------------------

[<ReactComponent>]
let IconPicker (selected: string option) (onSelect: string -> unit) =
    let (activeGroup, setActiveGroup) = React.useState (List.head groups).Label

    Html.div [
        prop.style [
            Css.border "1px solid #e5e0d5"; style.borderRadius 14
            style.overflow.hidden; style.backgroundColor "white"
        ]
        prop.children [
            // Category tabs
            Html.div [
                prop.style [
                    style.display.flex; Css.overflowX "auto"
                    Css.borderBottom "1px solid #e5e0d5"
                    style.padding (0, 8)
                ]
                prop.children (
                    groups |> List.map (fun g ->
                        Html.button [
                            prop.key g.Label
                            prop.onClick (fun _ -> setActiveGroup g.Label)
                            prop.text g.Label
                            prop.style [
                                Css.flexShrink 0
                                style.padding (8, 12)
                                Css.border "none"
                                style.backgroundColor "transparent"
                                style.fontSize 12
                                style.fontWeight (if g.Label = activeGroup then 600 else 400)
                                style.color (if g.Label = activeGroup then "#2d2a24" else "#8a8578")
                                Css.borderBottom (
                                    if g.Label = activeGroup then "2px solid #2d2a24"
                                    else "2px solid transparent"
                                )
                                style.cursor.pointer
                                Css.whiteSpace "nowrap"
                            ]
                        ]
                    )
                )
            ]
            // Icon grid
            let activeIcons =
                groups
                |> List.tryFind (fun g -> g.Label = activeGroup)
                |> Option.map (fun g -> g.Icons)
                |> Option.defaultValue []

            Html.div [
                prop.style [
                    style.display.grid
                    Css.gridTemplateColumns "repeat(5, 1fr)"
                    style.gap 6
                    style.padding 12
                ]
                prop.children (
                    activeIcons |> List.map (fun emoji ->
                        Html.button [
                            prop.key emoji
                            prop.onClick (fun _ -> onSelect emoji)
                            prop.text emoji
                            prop.style [
                                style.fontSize 24
                                style.padding 8
                                style.borderRadius 10
                                Css.border (
                                    if Some emoji = selected then "2px solid #2d2a24"
                                    else "1px solid #e5e0d5"
                                )
                                style.backgroundColor (
                                    if Some emoji = selected then "#2d2a2410"
                                    else "transparent"
                                )
                                style.cursor.pointer
                                style.lineHeight 1
                                Css.transform (
                                    if Some emoji = selected then "scale(1.1)"
                                    else "scale(1)"
                                )
                                Css.transition "all 0.1s"
                            ]
                        ]
                    )
                )
            ]
        ]
    ]

// ---------------------------------------------------------------------------
// Award animation overlay
// ---------------------------------------------------------------------------

[<ReactComponent>]
let AwardOverlay (emoji: string) (bgColor: string) (label: string) (onClose: (unit -> unit) option) =
    let confettiColors = [| "#F5A623"; "#4A90D9"; "#D9548A"; "#6FAE4E"; "#B879D1"; "#F0C419"; "#E0566F" |]

    Html.div [
        prop.onClick (fun _ -> onClose |> Option.iter (fun f -> f ()))
        prop.style [
            style.position.fixedRelativeToWindow; style.top 0; style.left 0; style.right 0; style.bottom 0
            style.display.flex; style.flexDirection.column
            style.alignItems.center; style.justifyContent.center
            style.backgroundColor bgColor
            style.zIndex 50; style.overflow.hidden
            Css.animation "bg-flash-in 0.35s ease-out forwards"
        ]
        prop.children [
            // Burst rays
            Html.div [
                prop.style [
                    style.position.absolute; style.top 0; style.left 0; style.right 0; style.bottom 0
                    style.display.flex; style.alignItems.center; style.justifyContent.center
                    Css.pointerEvents "none"
                ]
                prop.children (
                    Array.init 12 (fun i ->
                        Html.div [
                            prop.key i
                            prop.style [
                                style.position.absolute
                                style.width 4; style.height 220
                                Css.backgroundImage "linear-gradient(to bottom, rgba(255,255,255,0.7), transparent)"
                                Css.transformOrigin "center 0"
                                style.top (length.percent 50); style.left (length.percent 50)
                                style.marginLeft -2; style.opacity 0.5
                                Css.transform $"rotate({(360 / 12) * i}deg)"
                                Css.animation "ray-burst 0.9s ease-out forwards"
                            ]
                        ]
                    ) |> Array.toList
                )
            ]
            // Stamp card + label
            Html.div [
                prop.style [ style.position.relative; style.display.flex; style.flexDirection.column; style.alignItems.center ]
                prop.children [
                    Html.div [
                        prop.style [
                            Css.animation "stamp-slam-big 0.7s cubic-bezier(0.32, 1.7, 0.5, 1) forwards, stamp-pulse 0.9s ease-in-out 0.7s 2"
                            style.backgroundColor "white"; style.borderRadius 32
                            style.padding 40
                            Css.boxShadow "0 30px 80px rgba(0,0,0,0.35)"
                        ]
                        prop.children [ StampGlyph emoji 110 ]
                    ]
                    Html.div [
                        prop.style [
                            style.marginTop 24; style.fontSize 24; style.fontWeight 500
                            style.color "white"; style.opacity 0
                            Css.animation "label-pop-in 0.4s ease-out 0.6s forwards"
                            Css.textShadow "0 2px 12px rgba(0,0,0,0.25)"
                        ]
                        prop.text label
                    ]
                ]
            ]
            // Confetti
            Html.div [
                prop.style [
                    style.position.fixedRelativeToWindow; style.top 0; style.left 0; style.right 0; style.bottom 0
                    Css.pointerEvents "none"; style.overflow.hidden; style.zIndex 60
                ]
                prop.children (
                    Array.init 60 (fun i ->
                        let rng = System.Random(i * 17 + 3)
                        let left = rng.NextDouble() * 100.0
                        let delay = rng.NextDouble() * 0.5
                        let duration = 1.8 + rng.NextDouble() * 1.4
                        let color = confettiColors.[i % confettiColors.Length]
                        let rotate = rng.NextDouble() * 360.0
                        let size = 8.0 + rng.NextDouble() * 8.0
                        let drift = (rng.NextDouble() - 0.5) * 120.0
                        Html.span [
                            prop.key i
                            prop.style [
                                style.position.absolute
                                style.left (length.percent left)
                                style.top -20
                                style.width (int size); style.height (int size)
                                style.backgroundColor color
                                style.borderRadius (if i % 3 = 0 then length.percent 50 else length.px 2)
                                Css.animation $"confetti-fall {duration}s cubic-bezier(0.35,0,0.65,1) {delay}s forwards"
                                Css.transform $"rotate({rotate}deg) translateX(0px)"
                                // Note: --drift CSS custom property not settable via Feliz style DSL.
                                // The confetti-fall animation translateX(var(--drift,0px)) falls back to 0px.
                                // Acceptable for prototype — pieces still fall, just without lateral drift.
                            ]
                        ]
                    ) |> Array.toList
                )
            ]
            Html.style [ prop.text sharedKeyframes ]
        ]
    ]

// ---------------------------------------------------------------------------
// Give Stamp screen
// ---------------------------------------------------------------------------

[<ReactComponent>]
let GiveStampScreen (model: Model) (dispatch: Msg -> unit) =
    let draft = model.GiveDraft
    let activeStamp =
        draft.StampTypeId
        |> Option.bind (fun id -> model.Data.Stamps |> List.tryFind (fun s -> s.Id = id))

    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            // Child selector
            Html.div [
                prop.style [ style.marginBottom 20 ]
                prop.children [
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "Who is this for?" ]
                    childSelector model.Data.Children draft.ChildId (SelectGiveChild >> dispatch)
                ]
            ]
            // Reason list
            Html.div [
                prop.style [ style.marginBottom 20 ]
                prop.children [
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "What's this for?" ]
                    Html.div [
                        prop.style [ style.display.flex; style.flexDirection.column; style.gap 8 ]
                        prop.children (
                            model.Data.Reasons |> List.map (fun r ->
                                Html.button [
                                    prop.key r.Id
                                    prop.onClick (fun _ -> dispatch (SelectGiveReason r.Id))
                                    prop.text r.Label
                                    prop.style [
                                        style.textAlign.left; style.padding (12, 14); style.borderRadius 12
                                        Css.border (if Some r.Id = draft.ReasonId then "2px solid #2d2a24" else "1px solid #e5e0d5")
                                        style.backgroundColor (if Some r.Id = draft.ReasonId then "#2d2a2408" else "white")
                                        style.fontSize 14; style.color "#2d2a24"; style.cursor.pointer
                                    ]
                                ]
                            )
                        )
                    ]
                ]
            ]
            // Stamp grid
            Html.div [
                prop.style [ style.marginBottom 20 ]
                prop.children [
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "Pick a stamp" ]
                    Html.div [
                        prop.style [ style.display.grid; Css.gridTemplateColumns "repeat(5, 1fr)"; style.gap 8 ]
                        prop.children (
                            model.Data.Stamps |> List.map (fun s ->
                                Html.button [
                                    prop.key s.Id
                                    prop.onClick (fun _ -> dispatch (SelectGiveStamp s.Id))
                                    prop.children [ StampGlyph s.Emoji 26 ]
                                    prop.style [
                                        Css.aspectRatio "1"; style.borderRadius 14
                                        Css.border (if Some s.Id = draft.StampTypeId then $"2px solid {s.Color}" else "1px solid #e5e0d5")
                                        style.backgroundColor (if Some s.Id = draft.StampTypeId then $"{s.Color}15" else "white")
                                        style.display.flex; style.alignItems.center; style.justifyContent.center
                                        style.cursor.pointer
                                        Css.transform (if Some s.Id = draft.StampTypeId then "scale(1.05)" else "scale(1)")
                                        Css.transition "all 0.15s"
                                    ]
                                ]
                            )
                        )
                    ]
                ]
            ]
            // Error
            match draft.Error with
            | Some err -> Html.div [ prop.style [ style.color "#d9548a"; style.fontSize 13; style.marginBottom 12 ]; prop.text err ]
            | None -> Html.none

            primaryBtn (if draft.Animating then "Awarding..." else "Give stamp") draft.Animating (fun () -> dispatch SubmitGiveStamp)

            // Animation overlay
            match draft.Animating, activeStamp with
            | true, Some stamp -> AwardOverlay stamp.Emoji stamp.Color "Awesome!" None
            | _ -> Html.none
        ]
    ]

// ---------------------------------------------------------------------------
// Collection screen
// ---------------------------------------------------------------------------

[<ReactComponent>]
let CollectionScreen (model: Model) (dispatch: Msg -> unit) =
    let selectedId = model.CollectionChildId
    let childAwards =
        model.Data.Awards
        |> List.filter (fun a -> Some a.ChildId = selectedId)
        |> List.sortByDescending (fun a -> a.Timestamp)

    let replayingAward =
        model.ReplayingAwardId
        |> Option.bind (fun id -> model.Data.Awards |> List.tryFind (fun a -> a.Id = id))

    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            screenHeader "Collection" (fun () -> dispatch (SetScreen GiveStamp))
            childSelector model.Data.Children selectedId (SelectCollectionChild >> dispatch)

            Html.div [
                prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 12 ]
                let stampLabel = if childAwards.Length = 1 then "stamp" else "stamps"
                prop.text $"{childAwards.Length} {stampLabel} collected"
            ]

            if childAwards.IsEmpty then emptyState "No stamps yet"
            else
                Html.div [
                    prop.style [ style.display.grid; Css.gridTemplateColumns "repeat(3, 1fr)"; style.gap 10 ]
                    prop.children (
                        childAwards |> List.map (fun a ->
                            let stamp = model.Data.Stamps |> List.tryFind (fun s -> s.Id = a.StampTypeId)
                            match stamp with
                            | None -> Html.none
                            | Some s ->
                                Html.button [
                                    prop.key a.Id
                                    prop.onClick (fun _ -> dispatch (ReplayAward a.Id))
                                    prop.style [
                                        Css.aspectRatio "1"; style.borderRadius 14
                                        Css.border "1px solid #e5e0d5"
                                        style.backgroundColor $"{s.Color}10"
                                        style.display.flex; style.flexDirection.column
                                        style.alignItems.center; style.justifyContent.center
                                        style.padding 10; style.cursor.pointer
                                        style.position.relative
                                        style.opacity (if a.Status = Redeemed then 0.45 else 1.0)
                                    ]
                                    prop.children [
                                        StampGlyph s.Emoji 32
                                        if a.Status = Redeemed then
                                            Html.div [
                                                prop.style [ style.position.absolute; style.bottom 4; style.fontSize 9; style.color "#8a8578"; style.fontWeight 500 ]
                                                prop.text "spent"
                                            ]
                                    ]
                                ]
                        )
                    )
                ]

            // Replay overlay
            match replayingAward with
            | None -> Html.none
            | Some award ->
                let stamp = model.Data.Stamps |> List.tryFind (fun s -> s.Id = award.StampTypeId)
                let reason = model.Data.Reasons |> List.tryFind (fun r -> r.Id = award.ReasonId)
                match stamp with
                | None -> Html.none
                | Some s ->
                    Html.div [
                        prop.onClick (fun _ -> dispatch CloseReplay)
                        prop.style [
                            style.position.fixedRelativeToWindow; style.top 0; style.left 0; style.right 0; style.bottom 0
                            style.display.flex; style.flexDirection.column
                            style.alignItems.center; style.justifyContent.center
                            style.backgroundColor s.Color
                            style.zIndex 50; style.padding 20; style.overflow.hidden
                            Css.animation "bg-flash-in 0.35s ease-out forwards"
                        ]
                        prop.children [
                            Html.div [
                                prop.onClick (fun e -> e.stopPropagation ())
                                prop.style [
                                    style.backgroundColor "white"; style.borderRadius 32
                                    style.padding 36; Css.boxShadow "0 30px 80px rgba(0,0,0,0.35)"
                                    Css.maxWidth 300; style.textAlign.center
                                ]
                                prop.children [
                                    Html.div [
                                        prop.key (string award.Id)
                                        prop.style [ Css.animation "stamp-slam-big 0.7s cubic-bezier(0.32, 1.7, 0.5, 1) forwards, stamp-pulse 0.9s ease-in-out 0.7s 2" ]
                                        prop.children [ StampGlyph s.Emoji 90 ]
                                    ]
                                    Html.div [ prop.style [ style.fontSize 17; style.fontWeight 500; style.marginTop 16; style.color "#2d2a24" ]; prop.text s.Name ]
                                    match reason with
                                    | Some r -> Html.div [ prop.style [ style.fontSize 14; style.color "#8a8578"; style.marginTop 6 ]; prop.text r.Label ]
                                    | None -> Html.none
                                ]
                            ]
                            Html.style [ prop.text sharedKeyframes ]
                        ]
                    ]
        ]
    ]

// ---------------------------------------------------------------------------
// Rewards screen
// ---------------------------------------------------------------------------

[<ReactComponent>]
let RewardsScreenView (model: Model) (dispatch: Msg -> unit) =
    let selectedId = model.RewardsChildId
    let balance =
        model.Data.Awards
        |> List.filter (fun a -> Some a.ChildId = selectedId && a.Status = Active)
        |> List.length

    let confirming =
        model.ConfirmingRewardId
        |> Option.bind (fun id -> model.Data.Rewards |> List.tryFind (fun r -> r.Id = id))

    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            screenHeader "Rewards" (fun () -> dispatch (SetScreen GiveStamp))
            childSelector model.Data.Children selectedId (SelectRewardsChild >> dispatch)

            Html.div [
                prop.style [
                    style.padding (14, 16); style.borderRadius 14
                    style.backgroundColor "#2d2a24"; style.color "white"
                    style.marginBottom 20
                    style.display.flex; style.justifyContent.spaceBetween; style.alignItems.center
                ]
                prop.children [
                    Html.span [ prop.style [ style.fontSize 14 ]; prop.text "Available stamps" ]
                    Html.span [ prop.style [ style.fontSize 20; style.fontWeight 600 ]; prop.text (string balance) ]
                ]
            ]

            if model.Data.Rewards.IsEmpty then emptyState "No rewards set up yet"
            else
                Html.div [
                    prop.style [ style.display.flex; style.flexDirection.column; style.gap 10 ]
                    prop.children (
                        model.Data.Rewards |> List.map (fun r ->
                            let affordable = balance >= r.Cost
                            Html.div [
                                prop.key r.Id
                                prop.style [
                                    style.display.flex; style.alignItems.center; style.justifyContent.spaceBetween
                                    style.padding 14; style.borderRadius 14
                                    Css.border "1px solid #e5e0d5"; style.backgroundColor "white"
                                ]
                                prop.children [
                                    Html.div [
                                        prop.style [ style.display.flex; style.alignItems.center; style.gap 12 ]
                                        prop.children [
                                            StampGlyph r.Emoji 30
                                            Html.div [
                                                prop.children [
                                                    Html.div [ prop.style [ style.fontSize 14; style.fontWeight 500; style.color "#2d2a24" ]; prop.text r.Name ]
                                                    Html.div [ prop.style [ style.fontSize 12; style.color "#8a8578" ]; prop.text $"{r.Cost} stamps" ]
                                                ]
                                            ]
                                        ]
                                    ]
                                    Html.button [
                                        prop.disabled (not affordable)
                                        prop.onClick (fun _ -> if affordable then dispatch (RequestRedeem r.Id))
                                        prop.text "Redeem"
                                        prop.style [
                                            style.padding (8, 14); style.borderRadius 10; Css.border "none"
                                            style.backgroundColor (if affordable then "#2d2a24" else "#e5e0d5")
                                            style.color (if affordable then "white" else "#b5b0a2")
                                            style.fontSize 13; style.fontWeight 500
                                            style.cursor (if affordable then "pointer" else "default")
                                        ]
                                    ]
                                ]
                            ]
                        )
                    )
                ]

            Html.div [
                prop.style [ style.marginTop 16; style.textAlign.center ]
                prop.children [
                    Html.button [
                        prop.onClick (fun _ -> dispatch (SetScreen ManageRewards))
                        prop.text "Manage rewards"
                        prop.style [ Css.border "none"; style.backgroundColor "transparent"; style.color "#8a8578"; style.fontSize 13; style.cursor.pointer; Css.textDecorationLine "underline" ]
                    ]
                ]
            ]

            // Confirm dialog
            match confirming with
            | None -> Html.none
            | Some reward ->
                Html.div [
                    prop.onClick (fun _ -> dispatch CancelRedeem)
                    prop.style [
                        style.position.fixedRelativeToWindow; style.top 0; style.left 0; style.right 0; style.bottom 0
                        style.backgroundColor "rgba(30,28,24,0.55)"
                        style.display.flex; style.alignItems.center; style.justifyContent.center
                        style.zIndex 60; style.padding 20
                    ]
                    prop.children [
                        Html.div [
                            prop.onClick (fun e -> e.stopPropagation ())
                            prop.style [ style.backgroundColor "white"; style.borderRadius 20; style.padding 24; Css.maxWidth 300; style.textAlign.center ]
                            prop.children [
                                StampGlyph reward.Emoji 50
                                Html.div [ prop.style [ style.fontSize 16; style.fontWeight 500; style.marginTop 10; style.color "#2d2a24" ]; prop.text $"Redeem {reward.Name}?" ]
                                Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginTop 6; style.marginBottom 18 ]; prop.text $"This will use {reward.Cost} stamps" ]
                                Html.div [
                                    prop.style [ style.display.flex; style.gap 8 ]
                                    prop.children [
                                        Html.button [ prop.onClick (fun _ -> dispatch CancelRedeem); prop.text "Cancel"; prop.style [ Css.flexGrow 1; style.padding (10, 0); style.borderRadius 12; Css.border "1px solid #e5e0d5"; style.backgroundColor "white"; style.fontSize 14; style.cursor.pointer ] ]
                                        Html.button [ prop.onClick (fun _ -> dispatch ConfirmRedeem); prop.text "Confirm"; prop.style [ Css.flexGrow 1; style.padding (10, 0); style.borderRadius 12; Css.border "none"; style.backgroundColor "#2d2a24"; style.color "white"; style.fontSize 14; style.cursor.pointer ] ]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]

            if model.JustRedeemed then
                Html.div [
                    prop.style [
                        style.position.fixedRelativeToWindow; style.bottom 24
                        style.left (length.percent 50); Css.transform "translateX(-50%)"
                        style.backgroundColor "#2d2a24"; style.color "white"
                        style.padding (12, 20); style.borderRadius 30; style.fontSize 14; style.zIndex 60
                    ]
                    prop.text "Reward redeemed! 🎉"
                ]
        ]
    ]

// ---------------------------------------------------------------------------
// Manage Children
// ---------------------------------------------------------------------------

[<ReactComponent>]
let ManageChildrenScreen (model: Model) (dispatch: Msg -> unit) (forcedOnboarding: bool) =
    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            if forcedOnboarding then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children [
                        Html.div [ prop.style [ style.fontSize 18; style.fontWeight 500; style.color "#2d2a24" ]; prop.text "Add your first child" ]
                        Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginTop 4 ]; prop.text "You'll need at least one child before giving stamps" ]
                    ]
                ]
            else
                screenHeader "Manage children" (fun () -> dispatch (SetScreen GiveStamp))

            if not model.Data.Children.IsEmpty then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children (
                        model.Data.Children |> List.map (fun c ->
                            listRow
                                [ Html.div [ prop.style [ style.width 20; style.height 20; style.borderRadius (length.percent 50); style.backgroundColor c.Color ] ]
                                  Html.span [ prop.style [ style.fontSize 14; style.color "#2d2a24" ]; prop.text c.Name ] ]
                                []
                                (Some (fun () -> dispatch (DeleteChild c.Id)))
                        )
                    )
                ]

            Html.div [
                prop.style [ style.padding 16; style.borderRadius 14; Css.border "1px solid #e5e0d5"; style.backgroundColor "white" ]
                prop.children [
                    TextField "Child's name" model.NewChildForm.Name (UpdateNewChildName >> dispatch) "e.g. Ilyas" (not forcedOnboarding)
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "Color" ]
                    ColorSwatchPicker model.NewChildForm.Color (UpdateNewChildColor >> dispatch)
                    Html.div [ prop.style [ style.marginBottom 16 ] ]
                    primaryBtn "Add child" (model.NewChildForm.Name.Trim() = "") (fun () -> dispatch AddChild)
                ]
            ]
        ]
    ]

// ---------------------------------------------------------------------------
// Manage Reasons
// ---------------------------------------------------------------------------

[<ReactComponent>]
let ManageReasonsScreen (model: Model) (dispatch: Msg -> unit) (forcedOnboarding: bool) =
    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            if forcedOnboarding then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children [
                        Html.div [ prop.style [ style.fontSize 18; style.fontWeight 500; style.color "#2d2a24" ]; prop.text "Add reasons for stamps" ]
                        Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginTop 4 ]; prop.text "These are the things kids can earn a stamp for — add at least one" ]
                    ]
                ]
            else
                screenHeader "Manage reasons" (fun () -> dispatch (SetScreen GiveStamp))

            if not model.Data.Reasons.IsEmpty then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children (
                        model.Data.Reasons |> List.map (fun r ->
                            listRow
                                [ Html.span [ prop.style [ style.fontSize 14; style.color "#2d2a24" ]; prop.text r.Label ] ]
                                []
                                (Some (fun () -> dispatch (DeleteReason r.Id)))
                        )
                    )
                ]

            Html.div [
                prop.style [ style.padding 16; style.borderRadius 14; Css.border "1px solid #e5e0d5"; style.backgroundColor "white" ]
                prop.children [
                    TextField "Reason" model.NewReasonForm.Label (UpdateNewReasonLabel >> dispatch) "e.g. Finished homework" true
                    primaryBtn "Add reason" (model.NewReasonForm.Label.Trim() = "") (fun () -> dispatch AddReason)
                ]
            ]
        ]
    ]

// ---------------------------------------------------------------------------
// Manage Stamps
// ---------------------------------------------------------------------------

[<ReactComponent>]
let ManageStampsScreen (model: Model) (dispatch: Msg -> unit) (forcedOnboarding: bool) =
    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            if forcedOnboarding then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children [
                        Html.div [ prop.style [ style.fontSize 18; style.fontWeight 500; style.color "#2d2a24" ]; prop.text "Add stamp designs" ]
                        Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginTop 4 ]; prop.text "Pick an emoji, name it, give it a color — add at least one" ]
                    ]
                ]
            else
                screenHeader "Manage stamps" (fun () -> dispatch (SetScreen GiveStamp))

            if not model.Data.Stamps.IsEmpty then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children (
                        model.Data.Stamps |> List.map (fun s ->
                            listRow
                                [ StampGlyph s.Emoji 22
                                  Html.span [ prop.style [ style.fontSize 14; style.color "#2d2a24" ]; prop.text s.Name ] ]
                                []
                                (Some (fun () -> dispatch (DeleteStamp s.Id)))
                        )
                    )
                ]

            Html.div [
                prop.style [ style.padding 16; style.borderRadius 14; Css.border "1px solid #e5e0d5"; style.backgroundColor "white" ]
                prop.children [
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "Pick an emoji" ]
                    IconPicker model.NewStampForm.Emoji (UpdateNewStampEmoji >> dispatch)
                    Html.div [ prop.style [ style.marginBottom 16 ] ]
                    TextField "Name" model.NewStampForm.Name (UpdateNewStampName >> dispatch) "e.g. Rocket" false
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "Color" ]
                    ColorSwatchPicker model.NewStampForm.Color (UpdateNewStampColor >> dispatch)
                    Html.div [ prop.style [ style.marginBottom 16 ] ]
                    primaryBtn "Add stamp"
                        (model.NewStampForm.Emoji.IsNone || model.NewStampForm.Name.Trim() = "")
                        (fun () -> dispatch AddStamp)
                ]
            ]
        ]
    ]

// ---------------------------------------------------------------------------
// Manage Rewards
// ---------------------------------------------------------------------------

[<ReactComponent>]
let ManageRewardsScreen (model: Model) (dispatch: Msg -> unit) =
    Html.div [
        prop.style [ style.padding (0, 4) ]
        prop.children [
            screenHeader "Manage rewards" (fun () -> dispatch (SetScreen RewardsScreen))

            if not model.Data.Rewards.IsEmpty then
                Html.div [
                    prop.style [ style.marginBottom 20 ]
                    prop.children (
                        model.Data.Rewards |> List.map (fun r ->
                            listRow
                                [ StampGlyph r.Emoji 22
                                  Html.span [ prop.style [ style.fontSize 14; style.color "#2d2a24" ]; prop.text r.Name ] ]
                                [ Html.span [ prop.style [ style.fontSize 12; style.color "#8a8578" ]; prop.text $"{r.Cost} stamps" ] ]
                                (Some (fun () -> dispatch (DeleteReward r.Id)))
                        )
                    )
                ]

            Html.div [
                prop.style [ style.padding 16; style.borderRadius 14; Css.border "1px solid #e5e0d5"; style.backgroundColor "white" ]
                prop.children [
                    Html.div [ prop.style [ style.fontSize 13; style.color "#8a8578"; style.marginBottom 8; style.fontWeight 500 ]; prop.text "Pick an emoji" ]
                    IconPicker model.NewRewardForm.Emoji (UpdateNewRewardEmoji >> dispatch)
                    Html.div [ prop.style [ style.marginBottom 16 ] ]
                    TextField "Reward name" model.NewRewardForm.Name (UpdateNewRewardName >> dispatch) "e.g. Choose dinner tonight" false
                    TextField "Cost (stamps)" model.NewRewardForm.Cost (UpdateNewRewardCost >> dispatch) "5" false
                    primaryBtn "Add reward"
                        (model.NewRewardForm.Emoji.IsNone || model.NewRewardForm.Name.Trim() = "")
                        (fun () -> dispatch AddReward)
                ]
            ]
        ]
    ]

// ---------------------------------------------------------------------------
// Hamburger menu
// ---------------------------------------------------------------------------

let hamburgerMenu (isOpen: bool) (onClose: unit -> unit) (dispatch: Msg -> unit) =
    if not isOpen then Html.none
    else
        let items = [
            ("🏆", "Collection", Collection)
            ("🎁", "Rewards", RewardsScreen)
            ("👤", "Manage children", ManageChildren)
            ("✳️", "Manage stamps", ManageStamps)
            ("📋", "Manage reasons", ManageReasons)
        ]
        Html.div [
            prop.onClick (fun _ -> onClose ())
            prop.style [
                style.position.fixedRelativeToWindow; style.top 0; style.left 0; style.right 0; style.bottom 0
                style.backgroundColor "rgba(30,28,24,0.4)"
                style.zIndex 70; style.display.flex; style.justifyContent.flexEnd
            ]
            prop.children [
                Html.div [
                    prop.onClick (fun e -> e.stopPropagation ())
                    prop.style [
                        style.width (length.percent 78); Css.maxWidth 300
                        style.backgroundColor "#faf8f2"; style.height (length.percent 100)
                        style.padding (24, 16); style.boxSizing.borderBox
                        Css.boxShadow "-8px 0 24px rgba(0,0,0,0.15)"
                        Css.overflowY "auto"
                    ]
                    prop.children [
                        Html.div [ prop.style [ style.fontSize 16; style.fontWeight 500; style.color "#2d2a24"; style.marginBottom 20; style.paddingLeft 6 ]; prop.text "Menu" ]
                        yield! items |> List.map (fun (icon, label, screen) ->
                            Html.button [
                                prop.onClick (fun _ ->
                                    dispatch (SetScreen screen)
                                    onClose ())
                                prop.style [
                                    style.width (length.percent 100)
                                    style.display.flex; style.alignItems.center; style.gap 12
                                    style.padding (12, 10); style.borderRadius 12
                                    Css.border "none"; style.backgroundColor "transparent"
                                    style.fontSize 15; style.color "#2d2a24"
                                    style.cursor.pointer; style.textAlign.left
                                ]
                                prop.children [
                                    Html.span [ prop.style [ style.fontSize 18 ]; prop.text icon ]
                                    Html.span [ prop.text label ]
                                ]
                            ]
                        )
                    ]
                ]
            ]
        ]

// ---------------------------------------------------------------------------
// Root render
// ---------------------------------------------------------------------------

let render (model: Model) (dispatch: Msg -> unit) =
    let onboarding = Types.onboardingStep model.Data

    let effectiveScreen =
        match onboarding with
        | Some NeedsChildren -> ManageChildren
        | Some NeedsReasons -> ManageReasons
        | Some NeedsStamps -> ManageStamps
        | None -> model.Screen

    let body =
        match effectiveScreen with
        | GiveStamp         -> GiveStampScreen model dispatch
        | Collection        -> CollectionScreen model dispatch
        | RewardsScreen     -> RewardsScreenView model dispatch
        | ManageChildren    -> ManageChildrenScreen model dispatch (onboarding = Some NeedsChildren)
        | ManageReasons     -> ManageReasonsScreen model dispatch (onboarding = Some NeedsReasons)
        | ManageStamps      -> ManageStampsScreen model dispatch (onboarding = Some NeedsStamps)
        | ManageRewards     -> ManageRewardsScreen model dispatch

    Html.div [
        prop.style [
            Css.maxWidth 420
            style.margin (0, length.auto)
            style.fontFamily "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            style.backgroundColor "#faf8f2"
            style.minHeight (length.vh 100)
            style.padding (20, 16, 40, 16)
            style.boxSizing.borderBox
        ]
        prop.children [
            // Top bar — hidden during forced onboarding
            if onboarding.IsNone then
                Html.div [
                    prop.style [
                        style.display.flex; style.alignItems.center; style.justifyContent.spaceBetween
                        style.marginBottom 20; style.paddingTop 4
                    ]
                    prop.children [
                        Html.div [ prop.style [ style.width 32 ] ]
                        Html.div [
                            prop.style [ style.fontSize 20; style.fontWeight 500; style.color "#2d2a24" ]
                            prop.text (if effectiveScreen = GiveStamp then "Stamp collector" else "")
                        ]
                        Html.button [
                            prop.onClick (fun _ -> dispatch (ToggleMenu true))
                            prop.text "☰"
                            prop.style [
                                style.width 32; style.height 32; Css.border "none"
                                style.backgroundColor "transparent"
                                style.fontSize 22; style.cursor.pointer; style.color "#2d2a24"
                            ]
                        ]
                    ]
                ]

            body
            hamburgerMenu model.MenuOpen (fun () -> dispatch (ToggleMenu false)) dispatch
            Html.style [ prop.text sharedKeyframes ]
        ]
    ]
