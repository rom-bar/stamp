
import { FSharpRef, Union, Record } from "../fable_modules/fable-library-js.5.13.0/Types.js";
import { union_type, record_type, bool_type, option_type, string_type } from "../fable_modules/fable-library-js.5.13.0/Reflection.js";
import { Reward, StampType, Reason, Child, AppData, Award, AwardStatus, Screen, AppDataModule_empty, Screen_$reflection, AppData_$reflection } from "./Types.fs.js";
import { filter, sortBy, truncate, map, tryFind, singleton, append, tryHead, length, item, ofArray } from "../fable_modules/fable-library-js.5.13.0/List.js";
import { Cmd_batch, Cmd_none, Cmd_OfPromise_perform } from "../fable_modules/Fable.Elmish.5.0.2/cmd.fs.js";
import { saveAppData, loadAppData } from "./Storage.fs.js";
import { utcNow, getTicks } from "../fable_modules/fable-library-js.5.13.0/Date.js";
import { nonSeeded } from "../fable_modules/fable-library-js.5.13.0/Random.js";
import { printf, toText } from "../fable_modules/fable-library-js.5.13.0/String.js";
import { orElse, value } from "../fable_modules/fable-library-js.5.13.0/Option.js";
import { playRedeemChime, playAwardChime, playTapSound } from "./sound.js";
import { sleep } from "./timing.js";
import { contains, ofList } from "../fable_modules/fable-library-js.5.13.0/Set.js";
import { comparePrimitives, equals } from "../fable_modules/fable-library-js.5.13.0/Util.js";
import { tryParse } from "../fable_modules/fable-library-js.5.13.0/Int32.js";

export class GiveStampDraft extends Record {
    constructor(ChildId, ReasonId, StampTypeId, Error$, Animating) {
        super();
        this.ChildId = ChildId;
        this.ReasonId = ReasonId;
        this.StampTypeId = StampTypeId;
        this.Error = Error$;
        this.Animating = Animating;
    }
}

export function GiveStampDraft_$reflection() {
    return record_type("App.GiveStampDraft", [], GiveStampDraft, () => [["ChildId", option_type(string_type)], ["ReasonId", option_type(string_type)], ["StampTypeId", option_type(string_type)], ["Error", option_type(string_type)], ["Animating", bool_type]]);
}

export const GiveStampDraftModule_empty = new GiveStampDraft(undefined, undefined, undefined, undefined, false);

export class NewChildForm extends Record {
    constructor(Name, Color) {
        super();
        this.Name = Name;
        this.Color = Color;
    }
}

export function NewChildForm_$reflection() {
    return record_type("App.NewChildForm", [], NewChildForm, () => [["Name", string_type], ["Color", string_type]]);
}

export class NewReasonForm extends Record {
    constructor(Label) {
        super();
        this.Label = Label;
    }
}

export function NewReasonForm_$reflection() {
    return record_type("App.NewReasonForm", [], NewReasonForm, () => [["Label", string_type]]);
}

export class NewStampForm extends Record {
    constructor(Emoji, Name, Color) {
        super();
        this.Emoji = Emoji;
        this.Name = Name;
        this.Color = Color;
    }
}

export function NewStampForm_$reflection() {
    return record_type("App.NewStampForm", [], NewStampForm, () => [["Emoji", option_type(string_type)], ["Name", string_type], ["Color", string_type]]);
}

export class NewRewardForm extends Record {
    constructor(Emoji, Name, Cost) {
        super();
        this.Emoji = Emoji;
        this.Name = Name;
        this.Cost = Cost;
    }
}

export function NewRewardForm_$reflection() {
    return record_type("App.NewRewardForm", [], NewRewardForm, () => [["Emoji", option_type(string_type)], ["Name", string_type], ["Cost", string_type]]);
}

export class Model extends Record {
    constructor(Data, Loaded, Screen, MenuOpen, GiveDraft, CollectionChildId, ReplayingAwardId, RewardsChildId, ConfirmingRewardId, JustRedeemed, NewChildForm, NewReasonForm, NewStampForm, NewRewardForm) {
        super();
        this.Data = Data;
        this.Loaded = Loaded;
        this.Screen = Screen;
        this.MenuOpen = MenuOpen;
        this.GiveDraft = GiveDraft;
        this.CollectionChildId = CollectionChildId;
        this.ReplayingAwardId = ReplayingAwardId;
        this.RewardsChildId = RewardsChildId;
        this.ConfirmingRewardId = ConfirmingRewardId;
        this.JustRedeemed = JustRedeemed;
        this.NewChildForm = NewChildForm;
        this.NewReasonForm = NewReasonForm;
        this.NewStampForm = NewStampForm;
        this.NewRewardForm = NewRewardForm;
    }
}

export function Model_$reflection() {
    return record_type("App.Model", [], Model, () => [["Data", AppData_$reflection()], ["Loaded", bool_type], ["Screen", Screen_$reflection()], ["MenuOpen", bool_type], ["GiveDraft", GiveStampDraft_$reflection()], ["CollectionChildId", option_type(string_type)], ["ReplayingAwardId", option_type(string_type)], ["RewardsChildId", option_type(string_type)], ["ConfirmingRewardId", option_type(string_type)], ["JustRedeemed", bool_type], ["NewChildForm", NewChildForm_$reflection()], ["NewReasonForm", NewReasonForm_$reflection()], ["NewStampForm", NewStampForm_$reflection()], ["NewRewardForm", NewRewardForm_$reflection()]]);
}

export class Msg extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["DataLoaded", "DataSaved", "SetScreen", "ToggleMenu", "SelectGiveChild", "SelectGiveReason", "SelectGiveStamp", "SubmitGiveStamp", "GiveStampAnimationFinished", "SelectCollectionChild", "ReplayAward", "CloseReplay", "SelectRewardsChild", "RequestRedeem", "CancelRedeem", "ConfirmRedeem", "DismissJustRedeemed", "UpdateNewChildName", "UpdateNewChildColor", "AddChild", "DeleteChild", "UpdateNewReasonLabel", "AddReason", "DeleteReason", "UpdateNewStampEmoji", "UpdateNewStampName", "UpdateNewStampColor", "AddStamp", "DeleteStamp", "UpdateNewRewardEmoji", "UpdateNewRewardName", "UpdateNewRewardCost", "AddReward", "DeleteReward"];
    }
    static DataSaved = new Msg(1, []);
    static SubmitGiveStamp = new Msg(7, []);
    static GiveStampAnimationFinished = new Msg(8, []);
    static CloseReplay = new Msg(11, []);
    static CancelRedeem = new Msg(14, []);
    static ConfirmRedeem = new Msg(15, []);
    static DismissJustRedeemed = new Msg(16, []);
    static AddChild = new Msg(19, []);
    static AddReason = new Msg(22, []);
    static AddStamp = new Msg(27, []);
    static AddReward = new Msg(32, []);
}

export function Msg_$reflection() {
    return union_type("App.Msg", [], Msg, () => [[["Item", AppData_$reflection()]], [], [["Item", Screen_$reflection()]], [["Item", bool_type]], [["Item", string_type]], [["Item", string_type]], [["Item", string_type]], [], [], [["Item", string_type]], [["Item", string_type]], [], [["Item", string_type]], [["Item", string_type]], [], [], [], [["Item", string_type]], [["Item", string_type]], [], [["Item", string_type]], [["Item", string_type]], [], [["Item", string_type]], [["Item", string_type]], [["Item", string_type]], [["Item", string_type]], [], [["Item", string_type]], [["Item", string_type]], [["Item", string_type]], [["Item", string_type]], [], [["Item", string_type]]]);
}

function defaultPaletteColor(usedCount) {
    const palette = ofArray(["#F5A623", "#4A90D9", "#D9548A", "#F0C419", "#E0566F", "#6FAE4E", "#7BA3C4", "#B879D1", "#8E7CC3", "#4FC3D9", "#E0A93A", "#4FBF8F"]);
    return item(usedCount % length(palette), palette);
}

export function init() {
    const model = new Model(AppDataModule_empty, false, Screen.GiveStamp, false, GiveStampDraftModule_empty, undefined, undefined, undefined, undefined, false, new NewChildForm("", defaultPaletteColor(0)), new NewReasonForm(""), new NewStampForm(undefined, "", defaultPaletteColor(0)), new NewRewardForm(undefined, "", "5"));
    return [model, Cmd_OfPromise_perform(loadAppData, undefined, (Item) => (new Msg(/* DataLoaded */ 0, [Item])))];
}

function uid() {
    const ticks = getTicks(utcNow());
    const rand = nonSeeded().Next2(100000, 999999) | 0;
    return toText(printf("%d-%d"))(ticks)(rand);
}

function saveCmd(data) {
    return Cmd_OfPromise_perform(saveAppData, data, () => Msg.DataSaved);
}

function firstId(items, getId) {
    const option_1 = tryHead(items);
    if (option_1 != null) {
        return getId(value(option_1));
    }
    else {
        return undefined;
    }
}

export function update(msg, model) {
    let bind$0040, bind$0040_1, bind$0040_2, bind$0040_4, bind$0040_9, bind$0040_11, bind$0040_14, bind$0040_15, bind$0040_16, name_4, emoji_1, bind$0040_19, bind$0040_20, bind$0040_21, v_1, name_8, emoji_4, cost_1;
    switch (msg.tag) {
        case 1:
            return [model, Cmd_none()];
        case 2: {
            const screen = msg.fields[0];
            return [new Model(model.Data, model.Loaded, screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 3: {
            const isOpen = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, isOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 4: {
            const childId = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, (bind$0040 = model.GiveDraft, new GiveStampDraft(childId, bind$0040.ReasonId, bind$0040.StampTypeId, undefined, bind$0040.Animating)), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 5: {
            const reasonId = msg.fields[0];
            playTapSound();
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, (bind$0040_1 = model.GiveDraft, new GiveStampDraft(bind$0040_1.ChildId, reasonId, bind$0040_1.StampTypeId, undefined, bind$0040_1.Animating)), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 6: {
            const stampId = msg.fields[0];
            playTapSound();
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, (bind$0040_2 = model.GiveDraft, new GiveStampDraft(bind$0040_2.ChildId, bind$0040_2.ReasonId, stampId, undefined, bind$0040_2.Animating)), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 7: {
            const draft = model.GiveDraft;
            const matchValue = draft.ChildId;
            const matchValue_1 = draft.ReasonId;
            const matchValue_2 = draft.StampTypeId;
            if (matchValue != null) {
                if (matchValue_1 != null) {
                    if (matchValue_2 != null) {
                        const childId_1 = matchValue;
                        const reasonId_1 = matchValue_1;
                        const stampId_1 = matchValue_2;
                        playAwardChime();
                        const award = new Award(uid(), childId_1, reasonId_1, stampId_1, Date.now(), AwardStatus.Active);
                        let newData;
                        const bind$0040_3 = model.Data;
                        newData = (new AppData(bind$0040_3.Children, bind$0040_3.Reasons, bind$0040_3.Stamps, bind$0040_3.Rewards, append(model.Data.Awards, singleton(award))));
                        const model_2 = new Model(newData, model.Loaded, model.Screen, model.MenuOpen, new GiveStampDraft(draft.ChildId, draft.ReasonId, draft.StampTypeId, undefined, true), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm);
                        const delayCmd = Cmd_OfPromise_perform(() => sleep(2400), undefined, () => Msg.GiveStampAnimationFinished);
                        return [model_2, Cmd_batch(ofArray([saveCmd(newData), delayCmd]))];
                    }
                    else {
                        return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, new GiveStampDraft(draft.ChildId, draft.ReasonId, draft.StampTypeId, "Pick a stamp first", draft.Animating), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
                    }
                }
                else {
                    return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, new GiveStampDraft(draft.ChildId, draft.ReasonId, draft.StampTypeId, "Pick a reason first", draft.Animating), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
                }
            }
            else {
                return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, new GiveStampDraft(draft.ChildId, draft.ReasonId, draft.StampTypeId, "Pick a child first", draft.Animating), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
            }
        }
        case 8:
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, (bind$0040_4 = model.GiveDraft, new GiveStampDraft(bind$0040_4.ChildId, undefined, undefined, bind$0040_4.Error, false)), model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        case 9: {
            const childId_2 = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, childId_2, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 10: {
            const awardId = msg.fields[0];
            playAwardChime();
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, awardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 11:
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, undefined, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        case 12: {
            const childId_3 = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, childId_3, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 13: {
            const rewardId = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, rewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 14:
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, undefined, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        case 15: {
            const matchValue_4 = model.ConfirmingRewardId;
            const matchValue_5 = model.RewardsChildId;
            let matchResult, childId_4, rewardId_1;
            if (matchValue_4 != null) {
                if (matchValue_5 != null) {
                    matchResult = 0;
                    childId_4 = matchValue_5;
                    rewardId_1 = matchValue_4;
                }
                else {
                    matchResult = 1;
                }
            }
            else {
                matchResult = 1;
            }
            switch (matchResult) {
                case 0: {
                    const rewardOpt = tryFind((r) => (r.Id === rewardId_1), model.Data.Rewards);
                    if (rewardOpt != null) {
                        const reward = rewardOpt;
                        const activeAwardIdsOldestFirst = ofList(map((a_2) => a_2.Id, truncate(reward.Cost, sortBy((a_1) => a_1.Timestamp, filter((a) => {
                            if (a.ChildId === childId_4) {
                                return equals(a.Status, AwardStatus.Active);
                            }
                            else {
                                return false;
                            }
                        }, model.Data.Awards), {
                            Compare: (x, y) => (comparePrimitives(x, y) | 0),
                        }))), {
                            Compare: (x_1, y_1) => (comparePrimitives(x_1, y_1) | 0),
                        });
                        const updatedAwards = map((a_3) => {
                            if (contains(a_3.Id, activeAwardIdsOldestFirst)) {
                                return new Award(a_3.Id, a_3.ChildId, a_3.ReasonId, a_3.StampTypeId, a_3.Timestamp, AwardStatus.Redeemed);
                            }
                            else {
                                return a_3;
                            }
                        }, model.Data.Awards);
                        let newData_1;
                        const bind$0040_5 = model.Data;
                        newData_1 = (new AppData(bind$0040_5.Children, bind$0040_5.Reasons, bind$0040_5.Stamps, bind$0040_5.Rewards, updatedAwards));
                        playRedeemChime();
                        const model_3 = new Model(newData_1, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, undefined, true, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm);
                        const dismissCmd = Cmd_OfPromise_perform(() => sleep(1800), undefined, () => Msg.DismissJustRedeemed);
                        return [model_3, Cmd_batch(ofArray([saveCmd(newData_1), dismissCmd]))];
                    }
                    else {
                        return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, undefined, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
                    }
                }
                default:
                    return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, undefined, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
            }
        }
        case 16:
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, false, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        case 17: {
            const name = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, new NewChildForm(name, model.NewChildForm.Color), model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 18: {
            const color = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, new NewChildForm(model.NewChildForm.Name, color), model.NewReasonForm, model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 19: {
            const name_1 = model.NewChildForm.Name.trim();
            if (name_1 === "") {
                return [model, Cmd_none()];
            }
            else {
                const child = new Child(uid(), name_1, model.NewChildForm.Color);
                let newData_2;
                const bind$0040_8 = model.Data;
                newData_2 = (new AppData(append(model.Data.Children, singleton(child)), bind$0040_8.Reasons, bind$0040_8.Stamps, bind$0040_8.Rewards, bind$0040_8.Awards));
                let model_4;
                const NewChildForm_4 = new NewChildForm("", defaultPaletteColor(length(newData_2.Children)));
                const CollectionChildId_2 = orElse(model.CollectionChildId, child.Id);
                const RewardsChildId_2 = orElse(model.RewardsChildId, child.Id);
                model_4 = (new Model(newData_2, model.Loaded, model.Screen, model.MenuOpen, equals(model.GiveDraft.ChildId, undefined) ? ((bind$0040_9 = model.GiveDraft, new GiveStampDraft(child.Id, bind$0040_9.ReasonId, bind$0040_9.StampTypeId, bind$0040_9.Error, bind$0040_9.Animating))) : model.GiveDraft, CollectionChildId_2, model.ReplayingAwardId, RewardsChildId_2, model.ConfirmingRewardId, model.JustRedeemed, NewChildForm_4, model.NewReasonForm, model.NewStampForm, model.NewRewardForm));
                return [model_4, saveCmd(newData_2)];
            }
        }
        case 20: {
            const childId_5 = msg.fields[0];
            let newData_3;
            const bind$0040_10 = model.Data;
            newData_3 = (new AppData(filter((c_2) => (c_2.Id !== childId_5), model.Data.Children), bind$0040_10.Reasons, bind$0040_10.Stamps, bind$0040_10.Rewards, bind$0040_10.Awards));
            let model_5;
            const CollectionChildId_3 = equals(model.CollectionChildId, childId_5) ? firstId(newData_3.Children, (c_3) => c_3.Id) : model.CollectionChildId;
            const RewardsChildId_3 = equals(model.RewardsChildId, childId_5) ? firstId(newData_3.Children, (c_4) => c_4.Id) : model.RewardsChildId;
            model_5 = (new Model(newData_3, model.Loaded, model.Screen, model.MenuOpen, equals(model.GiveDraft.ChildId, childId_5) ? ((bind$0040_11 = model.GiveDraft, new GiveStampDraft(firstId(newData_3.Children, (c_5) => c_5.Id), bind$0040_11.ReasonId, bind$0040_11.StampTypeId, bind$0040_11.Error, bind$0040_11.Animating))) : model.GiveDraft, CollectionChildId_3, model.ReplayingAwardId, RewardsChildId_3, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm));
            return [model_5, saveCmd(newData_3)];
        }
        case 21: {
            const label = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, new NewReasonForm(label), model.NewStampForm, model.NewRewardForm), Cmd_none()];
        }
        case 22: {
            const label_1 = model.NewReasonForm.Label.trim();
            if (label_1 === "") {
                return [model, Cmd_none()];
            }
            else {
                const reason = new Reason(uid(), label_1);
                let newData_4;
                const bind$0040_12 = model.Data;
                newData_4 = (new AppData(bind$0040_12.Children, append(model.Data.Reasons, singleton(reason)), bind$0040_12.Stamps, bind$0040_12.Rewards, bind$0040_12.Awards));
                return [new Model(newData_4, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, new NewReasonForm(""), model.NewStampForm, model.NewRewardForm), saveCmd(newData_4)];
            }
        }
        case 23: {
            const reasonId_2 = msg.fields[0];
            let newData_5;
            const bind$0040_13 = model.Data;
            newData_5 = (new AppData(bind$0040_13.Children, filter((r_1) => (r_1.Id !== reasonId_2), model.Data.Reasons), bind$0040_13.Stamps, bind$0040_13.Rewards, bind$0040_13.Awards));
            return [new Model(newData_5, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), saveCmd(newData_5)];
        }
        case 24: {
            const emoji = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, (bind$0040_14 = model.NewStampForm, new NewStampForm(emoji, bind$0040_14.Name, bind$0040_14.Color)), model.NewRewardForm), Cmd_none()];
        }
        case 25: {
            const name_2 = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, (bind$0040_15 = model.NewStampForm, new NewStampForm(bind$0040_15.Emoji, name_2, bind$0040_15.Color)), model.NewRewardForm), Cmd_none()];
        }
        case 26: {
            const color_1 = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, (bind$0040_16 = model.NewStampForm, new NewStampForm(bind$0040_16.Emoji, bind$0040_16.Name, color_1)), model.NewRewardForm), Cmd_none()];
        }
        case 27: {
            const form = model.NewStampForm;
            const name_3 = form.Name.trim();
            const matchValue_7 = form.Emoji;
            let matchResult_1, emoji_2, name_5;
            if (matchValue_7 != null) {
                if ((name_4 = name_3, (emoji_1 = matchValue_7, (emoji_1 !== "") && (name_4 !== "")))) {
                    matchResult_1 = 0;
                    emoji_2 = matchValue_7;
                    name_5 = name_3;
                }
                else {
                    matchResult_1 = 1;
                }
            }
            else {
                matchResult_1 = 1;
            }
            switch (matchResult_1) {
                case 0: {
                    const stamp = new StampType(uid(), emoji_2, name_5, form.Color);
                    let newData_6;
                    const bind$0040_17 = model.Data;
                    newData_6 = (new AppData(bind$0040_17.Children, bind$0040_17.Reasons, append(model.Data.Stamps, singleton(stamp)), bind$0040_17.Rewards, bind$0040_17.Awards));
                    const model_6 = new Model(newData_6, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, new NewStampForm(undefined, "", defaultPaletteColor(length(newData_6.Stamps))), model.NewRewardForm);
                    return [model_6, saveCmd(newData_6)];
                }
                default:
                    return [model, Cmd_none()];
            }
        }
        case 28: {
            const stampId_2 = msg.fields[0];
            let newData_7;
            const bind$0040_18 = model.Data;
            newData_7 = (new AppData(bind$0040_18.Children, bind$0040_18.Reasons, filter((s) => (s.Id !== stampId_2), model.Data.Stamps), bind$0040_18.Rewards, bind$0040_18.Awards));
            return [new Model(newData_7, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), saveCmd(newData_7)];
        }
        case 29: {
            const emoji_3 = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, (bind$0040_19 = model.NewRewardForm, new NewRewardForm(emoji_3, bind$0040_19.Name, bind$0040_19.Cost))), Cmd_none()];
        }
        case 30: {
            const name_6 = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, (bind$0040_20 = model.NewRewardForm, new NewRewardForm(bind$0040_20.Emoji, name_6, bind$0040_20.Cost))), Cmd_none()];
        }
        case 31: {
            const cost = msg.fields[0];
            return [new Model(model.Data, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, (bind$0040_21 = model.NewRewardForm, new NewRewardForm(bind$0040_21.Emoji, bind$0040_21.Name, cost))), Cmd_none()];
        }
        case 32: {
            const form_1 = model.NewRewardForm;
            const name_7 = form_1.Name.trim();
            let costOpt;
            let matchValue_9;
            let outArg = 0;
            matchValue_9 = [tryParse(form_1.Cost, 511, false, 32, new FSharpRef(() => (outArg | 0), (v) => {
                outArg = (v | 0);
            })), outArg];
            let matchResult_2;
            if (matchValue_9[0]) {
                if ((v_1 = (matchValue_9[1] | 0), v_1 > 0)) {
                    matchResult_2 = 0;
                }
                else {
                    matchResult_2 = 1;
                }
            }
            else {
                matchResult_2 = 1;
            }
            switch (matchResult_2) {
                case 0: {
                    const v_2 = matchValue_9[1] | 0;
                    costOpt = v_2;
                    break;
                }
                default:
                    costOpt = undefined;
            }
            const matchValue_10 = form_1.Emoji;
            let matchResult_3, cost_2, emoji_5, name_9;
            if (matchValue_10 != null) {
                if (costOpt != null) {
                    if ((name_8 = name_7, (emoji_4 = matchValue_10, (cost_1 = (costOpt | 0), (emoji_4 !== "") && (name_8 !== ""))))) {
                        matchResult_3 = 0;
                        cost_2 = costOpt;
                        emoji_5 = matchValue_10;
                        name_9 = name_7;
                    }
                    else {
                        matchResult_3 = 1;
                    }
                }
                else {
                    matchResult_3 = 1;
                }
            }
            else {
                matchResult_3 = 1;
            }
            switch (matchResult_3) {
                case 0: {
                    const reward_1 = new Reward(uid(), emoji_5, name_9, cost_2);
                    let newData_8;
                    const bind$0040_22 = model.Data;
                    newData_8 = (new AppData(bind$0040_22.Children, bind$0040_22.Reasons, bind$0040_22.Stamps, append(model.Data.Rewards, singleton(reward_1)), bind$0040_22.Awards));
                    return [new Model(newData_8, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, new NewRewardForm(undefined, "", "5")), saveCmd(newData_8)];
                }
                default:
                    return [model, Cmd_none()];
            }
        }
        case 33: {
            const rewardId_2 = msg.fields[0];
            let newData_9;
            const bind$0040_23 = model.Data;
            newData_9 = (new AppData(bind$0040_23.Children, bind$0040_23.Reasons, bind$0040_23.Stamps, filter((r_2) => (r_2.Id !== rewardId_2), model.Data.Rewards), bind$0040_23.Awards));
            return [new Model(newData_9, model.Loaded, model.Screen, model.MenuOpen, model.GiveDraft, model.CollectionChildId, model.ReplayingAwardId, model.RewardsChildId, model.ConfirmingRewardId, model.JustRedeemed, model.NewChildForm, model.NewReasonForm, model.NewStampForm, model.NewRewardForm), saveCmd(newData_9)];
        }
        default: {
            const data = msg.fields[0];
            const model_1 = new Model(data, true, model.Screen, model.MenuOpen, model.GiveDraft, firstId(data.Children, (c) => c.Id), model.ReplayingAwardId, firstId(data.Children, (c_1) => c_1.Id), model.ConfirmingRewardId, model.JustRedeemed, new NewChildForm("", defaultPaletteColor(length(data.Children))), model.NewReasonForm, new NewStampForm(undefined, "", defaultPaletteColor(length(data.Stamps))), model.NewRewardForm);
            return [model_1, Cmd_none()];
        }
    }
}

