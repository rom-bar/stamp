
import { saveRawJson, loadRawJson } from "./storage.js";
import { fromString, Auto_generateBoxedDecoder_Z6670B51 } from "../fable_modules/Thoth.Json.10.5.1/./Decode.fs.js";
import { AppDataModule_empty, AppData_$reflection } from "./Types.fs.js";
import { uncurry2 } from "../fable_modules/fable-library-js.5.13.0/Util.js";
import { toString, Auto_generateBoxedEncoder_437914C6 } from "../fable_modules/Thoth.Json.10.5.1/./Encode.fs.js";

/**
 * Loads AppData from IndexedDB. Returns AppData.empty if nothing has been
 * saved yet, or if the saved JSON fails to decode (defensive default — a
 * corrupt or outdated record should never hard-crash the app on load).
 */
export function loadAppData() {
    return new Promise((resolve, reject) => {
        const promise = loadRawJson();
        promise.then((rawOpt) => {
            let result;
            if (rawOpt != null) {
                const raw = rawOpt;
                let matchValue;
                const decoder = Auto_generateBoxedDecoder_Z6670B51(AppData_$reflection(), undefined, undefined);
                matchValue = fromString(uncurry2(decoder), raw);
                if (matchValue.tag === 1) {
                    result = AppDataModule_empty;
                }
                else {
                    const data = matchValue.fields[0];
                    result = data;
                }
            }
            else {
                result = AppDataModule_empty;
            }
            resolve(result);
        });
        promise.catch((error) => {
            reject(error);
        });
    });
}

/**
 * Persists the full AppData blob to IndexedDB. Call this after every
 * state-changing action (add child, give stamp, redeem reward, etc.).
 */
export function saveAppData(data) {
    let json;
    const encoder = Auto_generateBoxedEncoder_437914C6(AppData_$reflection(), undefined, undefined, undefined);
    json = toString(0, encoder(data));
    return saveRawJson(json);
}

