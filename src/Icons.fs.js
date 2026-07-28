
import { Record } from "../fable_modules/fable-library-js.5.13.0/Types.js";
import { record_type, list_type, string_type } from "../fable_modules/fable-library-js.5.13.0/Reflection.js";
import { collect, ofArray } from "../fable_modules/fable-library-js.5.13.0/List.js";

/**
 * Closed preset list of kid-friendly emoji, used for both Stamps and Rewards.
 * Grouped loosely by category for a nicer picker layout, but exposed as one flat list.
 * ~60 icons total, no free-text entry — deliberately closed set per product decision.
 */
export class IconGroup extends Record {
    constructor(Label, Icons) {
        super();
        this.Label = Label;
        this.Icons = Icons;
    }
}

export function IconGroup_$reflection() {
    return record_type("Icons.IconGroup", [], IconGroup, () => [["Label", string_type], ["Icons", list_type(string_type)]]);
}

export const groups = ofArray([new IconGroup("Stars & sky", ofArray(["⭐", "🌟", "✨", "🌈", "☀️", "🌙", "☁️", "⚡", "🌠", "🪐"])), new IconGroup("Nature", ofArray(["🌸", "🌷", "🌻", "🍀", "🌵", "🌳", "🍄", "🦋", "🐝", "🐞"])), new IconGroup("Animals", ofArray(["🐶", "🐱", "🐰", "🦊", "🐼", "🐨", "🦁", "🐯", "🐸", "🐢"])), new IconGroup("Food & treats", ofArray(["🍦", "🍩", "🍭", "🍪", "🍓", "🍉", "🧁", "🍕", "🍎", "🍯"])), new IconGroup("Fun & prizes", ofArray(["🏆", "🥇", "🎖️", "👑", "💎", "🎁", "🎈", "🎉", "🎨", "🎵"])), new IconGroup("Adventure", ofArray(["🚀", "⚓", "🏰", "🗺️", "🧩", "🪁", "⚽", "🚲", "🛹", "🏕️"]))]);

export const all = collect((g) => g.Icons, groups);

