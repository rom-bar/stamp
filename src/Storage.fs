module Storage

open Fable.Core
open Fable.Core.JsInterop
open Thoth.Json
open Types

// Thin typed bindings into storage.js. The actual IndexedDB interop is
// plain JS (see storage.js) — this module's job is just to encode/decode
// AppData to/from the JSON string that storage.js persists.

[<Import("loadRawJson", "./storage.js")>]
let private loadRawJson () : JS.Promise<string option> = jsNative

[<Import("saveRawJson", "./storage.js")>]
let private saveRawJson (json: string) : JS.Promise<unit> = jsNative

/// Loads AppData from IndexedDB. Returns AppData.empty if nothing has been
/// saved yet, or if the saved JSON fails to decode (defensive default — a
/// corrupt or outdated record should never hard-crash the app on load).
let loadAppData () : JS.Promise<AppData> =
    JS.Constructors.Promise.Create (fun resolve reject ->
        let promise = loadRawJson ()
        promise?``then`` (fun rawOpt ->
            let result =
                match rawOpt with
                | None -> AppData.empty
                | Some raw ->
                    match Decode.Auto.fromString<AppData> raw with
                    | Ok data -> data
                    | Error _ -> AppData.empty
            resolve result)
        promise?``catch`` (fun error -> reject error))

/// Persists the full AppData blob to IndexedDB. Call this after every
/// state-changing action (add child, give stamp, redeem reward, etc.).
let saveAppData (data: AppData) : JS.Promise<unit> =
    let json = Encode.Auto.toString data
    saveRawJson json
