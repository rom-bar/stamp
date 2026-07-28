
import { Union, Record } from "../fable_modules/fable-library-js.5.13.0/Types.js";
import { list_type, float64_type, union_type, int32_type, record_type, string_type } from "../fable_modules/fable-library-js.5.13.0/Reflection.js";
import { isEmpty, empty } from "../fable_modules/fable-library-js.5.13.0/List.js";

export class Child extends Record {
    constructor(Id, Name, Color) {
        super();
        this.Id = Id;
        this.Name = Name;
        this.Color = Color;
    }
}

export function Child_$reflection() {
    return record_type("Types.Child", [], Child, () => [["Id", string_type], ["Name", string_type], ["Color", string_type]]);
}

export class Reason extends Record {
    constructor(Id, Label) {
        super();
        this.Id = Id;
        this.Label = Label;
    }
}

export function Reason_$reflection() {
    return record_type("Types.Reason", [], Reason, () => [["Id", string_type], ["Label", string_type]]);
}

export class StampType extends Record {
    constructor(Id, Emoji, Name, Color) {
        super();
        this.Id = Id;
        this.Emoji = Emoji;
        this.Name = Name;
        this.Color = Color;
    }
}

export function StampType_$reflection() {
    return record_type("Types.StampType", [], StampType, () => [["Id", string_type], ["Emoji", string_type], ["Name", string_type], ["Color", string_type]]);
}

export class Reward extends Record {
    constructor(Id, Emoji, Name, Cost) {
        super();
        this.Id = Id;
        this.Emoji = Emoji;
        this.Name = Name;
        this.Cost = (Cost | 0);
    }
}

export function Reward_$reflection() {
    return record_type("Types.Reward", [], Reward, () => [["Id", string_type], ["Emoji", string_type], ["Name", string_type], ["Cost", int32_type]]);
}

export class AwardStatus extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Active", "Redeemed"];
    }
    static Active = new AwardStatus(0, []);
    static Redeemed = new AwardStatus(1, []);
}

export function AwardStatus_$reflection() {
    return union_type("Types.AwardStatus", [], AwardStatus, () => [[], []]);
}

export class Award extends Record {
    constructor(Id, ChildId, ReasonId, StampTypeId, Timestamp, Status) {
        super();
        this.Id = Id;
        this.ChildId = ChildId;
        this.ReasonId = ReasonId;
        this.StampTypeId = StampTypeId;
        this.Timestamp = Timestamp;
        this.Status = Status;
    }
}

export function Award_$reflection() {
    return record_type("Types.Award", [], Award, () => [["Id", string_type], ["ChildId", string_type], ["ReasonId", string_type], ["StampTypeId", string_type], ["Timestamp", float64_type], ["Status", AwardStatus_$reflection()]]);
}

/**
 * The full persisted app state — this is what gets written to / read from IndexedDB.
 */
export class AppData extends Record {
    constructor(Children, Reasons, Stamps, Rewards, Awards) {
        super();
        this.Children = Children;
        this.Reasons = Reasons;
        this.Stamps = Stamps;
        this.Rewards = Rewards;
        this.Awards = Awards;
    }
}

export function AppData_$reflection() {
    return record_type("Types.AppData", [], AppData, () => [["Children", list_type(Child_$reflection())], ["Reasons", list_type(Reason_$reflection())], ["Stamps", list_type(StampType_$reflection())], ["Rewards", list_type(Reward_$reflection())], ["Awards", list_type(Award_$reflection())]]);
}

export const AppDataModule_empty = new AppData(empty(), empty(), empty(), empty(), empty());

export class Screen extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["GiveStamp", "Collection", "RewardsScreen", "ManageChildren", "ManageReasons", "ManageStamps", "ManageRewards"];
    }
    static GiveStamp = new Screen(0, []);
    static Collection = new Screen(1, []);
    static RewardsScreen = new Screen(2, []);
    static ManageChildren = new Screen(3, []);
    static ManageReasons = new Screen(4, []);
    static ManageStamps = new Screen(5, []);
    static ManageRewards = new Screen(6, []);
}

export function Screen_$reflection() {
    return union_type("Types.Screen", [], Screen, () => [[], [], [], [], [], [], []]);
}

/**
 * Which onboarding step (if any) must be completed before Give Stamp is usable.
 * Order matters: Children -> Reasons -> Stamps.
 */
export class OnboardingStep extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["NeedsChildren", "NeedsReasons", "NeedsStamps"];
    }
    static NeedsChildren = new OnboardingStep(0, []);
    static NeedsReasons = new OnboardingStep(1, []);
    static NeedsStamps = new OnboardingStep(2, []);
}

export function OnboardingStep_$reflection() {
    return union_type("Types.OnboardingStep", [], OnboardingStep, () => [[], [], []]);
}

export function onboardingStep(data) {
    if (isEmpty(data.Children)) {
        return OnboardingStep.NeedsChildren;
    }
    else if (isEmpty(data.Reasons)) {
        return OnboardingStep.NeedsReasons;
    }
    else if (isEmpty(data.Stamps)) {
        return OnboardingStep.NeedsStamps;
    }
    else {
        return undefined;
    }
}

