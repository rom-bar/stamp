# Contributing to Stamp Collector

Thanks for your interest! This is a personal project that's been open-sourced,
so contributions are welcome but the scope is intentionally kept small and focused.

---

## Before you start

Check the [issues](../../issues) tab first. If you want to add a feature or fix
a bug that isn't already tracked, open an issue to discuss it before writing code.
This saves everyone time if the direction doesn't fit the project.

---

## Dev setup

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- A browser with WebRTC support (Chrome or Firefox recommended for dev)

### Clone and run

```bash
git clone https://github.com/yourusername/stamp-collector.git
cd stamp-collector/stamp-app

dotnet tool restore   # installs Fable CLI from dotnet-tools.json
npm install
npm start             # starts Vite dev server with hot reload at localhost:5173
```

For the signaling server (only needed if working on the P2P sync feature):

```bash
cd stamp-collector/stamp-signal
dotnet run
# runs on localhost:5050
```

Update `signalBaseUrl` in `stamp-app/src/App.fs` to `http://localhost:5050` for local dev.

---

## Project conventions

### F# style

- **One module per file** — file name matches module name
- **Types at the top** — `Types.fs` owns all domain types; other modules import from it
- **Elmish strictly** — all state lives in `Model`, all changes go through `Msg` and `update`; no local mutable state outside React component hooks
- **Plain JS for hairy interop** — Web Audio, IndexedDB, and WebRTC stay in `.js` files; F# only imports thin typed bindings. This keeps the F# clean and the JS debuggable in browser devtools
- **No `ignore` unless necessary** — if you're discarding a result, comment why

### UI

- Feliz DSL only — no raw `ReactDOM` calls, no `import React` in F# files
- Mobile-first — the app targets phone screens (max-width 420px). Test at 390×844 (iPhone 14 size) before submitting UI changes
- No UI library dependencies — all components are hand-written Feliz. Keep it that way unless there's a very strong reason

### Commits

- Conventional commits style: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep commits small and focused — one logical change per commit
- Commit messages in English

---

## What kind of contributions are welcome

**Yes please:**
- Bug fixes
- Performance improvements
- Accessibility improvements (keyboard nav, screen reader support, contrast)
- Additional emoji categories in `Icons.fs`
- Improvements to the sync reliability or error handling
- Documentation fixes
- Translations (if we ever add i18n)

**Discuss first:**
- New screens or major features
- Changes to the data model (`Types.fs`) — these have sync implications
- Adding new dependencies (the project aims to stay lean)
- Changing the visual design language significantly

**Out of scope:**
- Server-side data storage / accounts / login — the offline-first, no-account approach is intentional
- Native app wrappers (Capacitor, Expo, etc.)
- Replacing the Elmish architecture with something else

---

## Submitting a PR

1. Fork the repo and create a branch from `main`: `git checkout -b feat/my-thing`
2. Make your changes, keeping commits small and focused
3. Test on a real mobile device or a browser dev tools mobile emulator — not just desktop
4. If you changed `Types.fs`, make sure the CRDT merge logic still holds for your change
5. Open a PR against `main` with a clear description of what changed and why
6. Link the related issue if there is one

---

## Questions

Open an issue with the `question` label. I'll do my best to respond.
