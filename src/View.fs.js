
import { HtmlHelper_createElement } from "../fable_modules/Feliz.3.2.0/./Html.fs.js";
import { createElement } from "react";
import { defaultOf } from "../fable_modules/Feliz.3.2.0/React/../../../src/../fable_modules/fable-library-js.5.13.0/Util.js";
import { printf, toText } from "../fable_modules/fable-library-js.5.13.0/String.js";
import { empty, ofArray, singleton, length } from "../fable_modules/fable-library-js.5.13.0/List.js";
import { Msg } from "./App.fs.js";

/**
 * Minimal placeholder view — just enough to verify Types/Storage/Sound/App
 * compile and wire together correctly via Fable/Elmish before investing in
 * the full 7-screen Feliz UI. Shows raw model state and a couple of buttons
 * to exercise the update loop (add a test child, give a stamp) so you can
 * confirm IndexedDB persistence survives a refresh.
 */
export function render(model, dispatch) {
    let value_5, value_6, arg_1, value_7, arg_2, value_8, arg_3, value_9, arg_4, value_10, arg_5;
    return HtmlHelper_createElement("div", ofArray([["style", {
        padding: 20,
        fontFamily: "sans-serif",
    }], ["children", [createElement("h2", defaultOf(), "Stamp app — compile check placeholder"), (value_5 = toText(printf("Loaded: %b"))(model.Loaded), createElement("p", defaultOf(), value_5)), (value_6 = ((arg_1 = (length(model.Data.Children) | 0), toText(printf("Children: %d"))(arg_1))), createElement("p", defaultOf(), value_6)), (value_7 = ((arg_2 = (length(model.Data.Reasons) | 0), toText(printf("Reasons: %d"))(arg_2))), createElement("p", defaultOf(), value_7)), (value_8 = ((arg_3 = (length(model.Data.Stamps) | 0), toText(printf("Stamps: %d"))(arg_3))), createElement("p", defaultOf(), value_8)), (value_9 = ((arg_4 = (length(model.Data.Rewards) | 0), toText(printf("Rewards: %d"))(arg_4))), createElement("p", defaultOf(), value_9)), (value_10 = ((arg_5 = (length(model.Data.Awards) | 0), toText(printf("Awards: %d"))(arg_5))), createElement("p", defaultOf(), value_10)), HtmlHelper_createElement("button", ofArray([["children", singleton("Add test child \'Test Kid\'")], ["onClick", (_arg) => {
        dispatch(new Msg(/* UpdateNewChildName */ 17, ["Test Kid"]));
        dispatch(Msg.AddChild);
    }]])), HtmlHelper_createElement("hr", empty()), createElement("p", defaultOf(), "If Children count increases and PERSISTS after a page refresh, IndexedDB wiring works."), createElement("p", defaultOf(), "Next step once this compiles cleanly: build out the full View.fs with all 7 screens.")]]]));
}

