module Program

open Elmish
open Elmish.React

Program.mkProgram App.init App.update View.render
|> Program.withReactSynchronous "root"
#if DEBUG
|> Program.withConsoleTrace
#endif
|> Program.run
