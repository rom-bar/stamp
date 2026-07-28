
import { ProgramModule_mkProgram, ProgramModule_withConsoleTrace, ProgramModule_run } from "../fable_modules/Fable.Elmish.5.0.2/program.fs.js";
import { Program_withReactSynchronous } from "../fable_modules/Fable.Elmish.React.5.6.0/react.fs.js";
import { update, init } from "./App.fs.js";
import { render } from "./View.fs.js";

ProgramModule_run(ProgramModule_withConsoleTrace(Program_withReactSynchronous("root", ProgramModule_mkProgram(init, update, render))));

