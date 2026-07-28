module Sound

open Fable.Core

// Thin typed bindings into sound.js. Keeping the actual Web Audio interop in
// plain JS (see sound.js) and only binding the three public entry points here
// avoids fragile emitJsExpr/emitJsStatement interop for the Web Audio API's
// chained, stateful call style.

[<Import("playAwardChime", "./sound.js")>]
let playAwardChime () : unit = jsNative

[<Import("playTapSound", "./sound.js")>]
let playTapSound () : unit = jsNative

[<Import("playRedeemChime", "./sound.js")>]
let playRedeemChime () : unit = jsNative
