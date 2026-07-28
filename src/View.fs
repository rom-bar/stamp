module View

open Feliz
open App
open Types

/// Minimal placeholder view — just enough to verify Types/Storage/Sound/App
/// compile and wire together correctly via Fable/Elmish before investing in
/// the full 7-screen Feliz UI. Shows raw model state and a couple of buttons
/// to exercise the update loop (add a test child, give a stamp) so you can
/// confirm IndexedDB persistence survives a refresh.
let render (model: Model) (dispatch: Msg -> unit) =
    Html.div [
        prop.style [ style.padding 20; style.fontFamily "sans-serif" ]
        prop.children [
            Html.h2 "Stamp app — compile check placeholder"

            Html.p (sprintf "Loaded: %b" model.Loaded)
            Html.p (sprintf "Children: %d" model.Data.Children.Length)
            Html.p (sprintf "Reasons: %d" model.Data.Reasons.Length)
            Html.p (sprintf "Stamps: %d" model.Data.Stamps.Length)
            Html.p (sprintf "Rewards: %d" model.Data.Rewards.Length)
            Html.p (sprintf "Awards: %d" model.Data.Awards.Length)

            Html.button [
                prop.text "Add test child 'Test Kid'"
                prop.onClick (fun _ ->
                    dispatch (UpdateNewChildName "Test Kid")
                    dispatch AddChild)
            ]

            Html.hr []

            Html.p "If Children count increases and PERSISTS after a page refresh, IndexedDB wiring works."
            Html.p "Next step once this compiles cleanly: build out the full View.fs with all 7 screens."
        ]
    ]
