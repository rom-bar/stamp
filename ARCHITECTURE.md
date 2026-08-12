# Architecture

A technical walkthrough of how Stamp Collector is built — how the pieces fit together,
why certain decisions were made, and how to deploy it.

---

## Overview

Stamp Collector is split into two independently deployable pieces:

- **`stamp-app/`** — a Progressive Web App (PWA) built with F#/Fable/Elmish/Feliz,
  compiled to JavaScript via Fable and bundled by Vite. Runs entirely in the browser.
  No backend required for core functionality.

- **`stamp-signal/`** — a thin Giraffe HTTP server with no database. Only used
  to broker the initial WebRTC handshake between two devices during P2P sync.
  The stamp data itself never touches this server.

---

## Frontend — stamp-app

### The Elmish loop

The app follows the standard Elmish model-view-update architecture:

```
  User action
      ↓
   Dispatch Msg
      ↓
  update: Model → Msg → Model * Cmd<Msg>
      ↓
  render: Model → (Msg → unit) → ReactElement
      ↓
   DOM update
```

All application state lives in a single `Model` record defined in `App.fs`.
Nothing is stored in React component state except transient UI state
(e.g. which tab is active in the icon picker, which child is selected in
the collection view) that doesn't need to survive a refresh.

### File-by-file

**`Types.fs`** — the foundation. All domain types live here:
`Child`, `Reason`, `StampType`, `Reward`, `Award`, `AppData`.
Also contains the CRDT merge function `mergeData` and the `onboardingStep`
helper that drives the forced-setup flow on first launch.

All entities have a `Deleted: bool` field for soft deletion — see the
"P2P sync and CRDT merge" section below for why.

**`Icons.fs`** — the closed preset list of 60 emoji stamps, grouped into
6 categories (Stars & sky, Nature, Animals, Food, Fun & prizes, Adventure).
This is intentionally a simple F# list, not a database query. Adding new
emoji categories is just editing this file.

**`Storage.fs`** + **`storage.js`** — IndexedDB persistence.
The entire `AppData` record is serialized to JSON via `Thoth.Json` and stored
as a single key-value entry in IndexedDB. This is simpler than modeling each
entity type as a separate object store, and adequate for a family's stamp
history (orders of magnitude smaller than Tokecang's transaction log, where
per-entity stores are warranted).

`storage.js` is plain JavaScript because IndexedDB's callback-based,
stateful API (onupgradeneeded / onsuccess / onerror chains) is painful to
drive via Fable's emit interop patterns. `Storage.fs` imports only the two
public entry points: `loadRawJson` and `saveRawJson`.

**`Sound.fs`** + **`sound.js`** — Web Audio synthesis.
Three sounds: award chime (bass thump + ascending sparkle arpeggio + landing
chord), tap sound (light sine ping), redeem chime (warm descending resolution).
All synthesized in real time — no audio files, no network requests, works
fully offline. Same JS-for-hairy-interop rationale as storage.

**`WebRtc.fs`** + **`webrtc.js`** — WebRTC P2P sync client.
`webrtc.js` handles the full WebRTC lifecycle: creating offers/answers,
polling the signaling server, ICE candidate trickle, opening the data channel,
and exchanging AppData JSON. `WebRtc.fs` exposes three typed F# functions:
`generateRoomCode`, `startAsOfferer`, `startAsAnswerer`.

**`App.fs`** — Elmish Model, Msg, init, update. All application logic.
Screens are represented as a `Screen` discriminated union; the render function
in `View.fs` pattern-matches on `model.Screen` to decide what to show.
The onboarding gate also lives here — if any of children/reasons/stamps
is empty, `effectiveScreen` is overridden to force the user through setup.

**`View.fs`** — all Feliz UI. One `[<ReactComponent>]` per screen, plus
shared components (`StampGlyph`, `IconPicker`, `ColorSwatchPicker`,
`AwardOverlay`, etc.). CSS animations are defined as a `sharedKeyframes`
string injected via `Html.style`. All style helpers that might not exist
in the target Feliz version are wrapped in a local `Css` module that uses
`style.custom` as the fallback.

**`Program.fs`** — Elmish entry point. Wires `init`, `update`, `render`
together and mounts to `#root`.

### Screens

```
GiveStamp (home)
├── child selector
├── reason list (closed, managed)
└── stamp grid (emoji, managed)

Collection
└── per-child stamp album (tap to replay animation)

RewardsScreen
├── stamp balance display
├── reward list with Redeem buttons
└── → ManageRewards (linked from bottom)

SyncScreen
├── Share a code (offerer flow)
└── Enter a code (answerer flow)

ManageChildren
ManageReasons
ManageStamps
ManageRewards
```

The hamburger menu (`☰`) provides access to everything except GiveStamp,
which is always the home screen. This keeps the daily-use Give Stamp flow
uncluttered — parents tap it dozens of times a week, management screens
are visited rarely.

### Onboarding gate

On first launch, `AppData` is empty. The app detects this via `onboardingStep`
and force-routes to `ManageChildren` first, then `ManageReasons`, then
`ManageStamps`, in that order. Each screen shows a guided onboarding header
instead of the normal back-button header. Once all three lists have at least
one non-deleted entry, `GiveStamp` becomes accessible.

### PWA and offline

Vite's `vite-plugin-pwa` generates the service worker and web manifest.
The service worker caches all static assets on install and serves them from
cache on subsequent loads — the app works entirely without network access
after the first load.

IndexedDB data persists independently of the service worker cache. Clearing
the browser cache removes the app code but not the stamp data (which lives
in IndexedDB). Uninstalling the PWA from the home screen removes both.

---

## Backend — stamp-signal

### What it does

The signaling server's only job is to help two WebRTC peers find each other.
It holds a temporary "room" (a small in-memory record) for at most 120 seconds,
containing the SDP offer, SDP answer, and ICE candidates from both sides.

Once the WebRTC data channel opens, the signaling server is completely out of
the picture. All data exchange is direct device-to-device.

### Endpoints

```
POST   /signal/offer              — Device A creates room, posts SDP offer
GET    /signal/offer/:code        — Device B fetches Device A's SDP offer
POST   /signal/answer             — Device B posts SDP answer
GET    /signal/answer/:code       — Device A fetches Device B's SDP answer
POST   /signal/candidate          — Either side posts an ICE candidate
GET    /signal/candidates/:code/:side — Either side polls for other side's candidates
DELETE /signal/room/:code         — Either side cleans up after sync (optional, TTL handles it)
GET    /health                    — Liveness probe
```

### Room lifecycle

```
Device A                      Server                        Device B
  POST /signal/offer  ──────► Room created (TTL: 120s)
                                                ◄── GET /signal/offer/:code
  GET /signal/answer/:code ◄── (202 while waiting)
                                                    POST /signal/answer ──►
  GET /signal/answer/:code ◄── Answer available
  POST /signal/candidate ──►
                                                ◄── POST /signal/candidate
  GET /signal/candidates/:code/offerer ◄──────────────────────────────────
  ──────────────────────────────────── GET /signal/candidates/:code/answerer ──►

  [WebRTC data channel opens — server no longer involved]

  DELETE /signal/room/:code ──► Room deleted
```

### Storage

In-memory only — a `ConcurrentDictionary<string, Room>`. No database,
no filesystem. A background task runs every 30 seconds and removes rooms
older than 120 seconds. If the server restarts mid-sync, the sync fails
and the user tries again — acceptable given syncs complete in under 10 seconds
on a good connection.

---

## P2P sync and CRDT merge

### Why CRDT?

Two devices can diverge independently for days or weeks. When they sync,
both sides may have added stamps, deleted children, or redeemed rewards.
A naive "last write wins" strategy would lose data. A proper CRDT
(Conflict-free Replicated Data Type) guarantees that both sides converge
to the same state regardless of sync order or timing.

### The merge strategy

All entities use **stable IDs** (timestamp + random suffix, generated at
creation time and never changed). The merge is a **set union by ID**:

- If an ID exists on only one side → add it to the merged result
- If an ID exists on both sides → merge the record:
  - `Deleted = true` wins (deletion propagates)
  - `Status = Redeemed` wins over `Active` (redemption propagates)
  - All other fields: keep the local version (last-write not tracked, not needed)

This works because:
- New records never reuse IDs, so there are no insert conflicts
- All mutations are monotonic (Active→Redeemed, notDeleted→Deleted) — they
  only move in one direction, so the "wins" rule is unambiguous
- No wall-clock timestamps needed for correctness (no vector clocks, no CRDTs
  library required)

### Soft delete

Hard-deleting a `Child` record and syncing would bring it back from the other
device (which still has it). Soft delete — `Deleted: bool` on every entity —
means the deletion is itself a data record that propagates on the next sync.

Records with `Deleted = true` are filtered out in all UI queries but kept
in IndexedDB indefinitely. Storage cost is negligible for a family's worth of data.

### What the signaling server sees

Only WebRTC session description protocol (SDP) strings and ICE candidates.
SDP describes network connection parameters — codec preferences, port ranges,
fingerprints. It contains no user data. ICE candidates are IP addresses used
for NAT traversal. No children, no stamps, no awards ever reach the server.

---

## Deployment

### Requirements

- A VPS with Debian/Ubuntu and systemd
- .NET 10 runtime (`apt install dotnet-runtime-8.0`)
- Node.js 20+ (for building the PWA — not needed at runtime)
- Caddy (`apt install caddy`)

### PWA build and deploy

```bash
# On your dev machine
cd stamp-app

# Update signalBaseUrl in src/App.fs to your production URL before building
npm run build
# Output: stamp-app/dist/

# Copy to server
scp -r dist/* user@yourserver:/var/www/stamp-app/dist/
```

### Signaling server build and deploy

```bash
# On your dev machine — update CORS origins in src/Program.fs first
cd stamp-signal
dotnet publish -c Release -o publish/
scp -r publish/* user@yourserver:/opt/stamp-signal/
scp stamp-signal.service user@yourserver:/etc/systemd/system/

# On server
systemctl daemon-reload
systemctl enable --now stamp-signal
systemctl status stamp-signal
```

### Caddy configuration

```caddy
stamp.yourdomain.com {
    # Proxy signaling endpoints to the Giraffe server
    reverse_proxy /signal/* localhost:5050
    reverse_proxy /health    localhost:5050

    # Serve the PWA
    root * /var/www/stamp-app/dist
    file_server
    try_files {path} /index.html
}
```

Caddy handles HTTPS automatically via Let's Encrypt.

### Environment variables for the signaling server

Set via the systemd unit file (`Environment=` lines) or a `.env` file:

```
ASPNETCORE_URLS=http://localhost:5050
DOTNET_ENVIRONMENT=Production
```

No other configuration is required — the signaling server has no secrets,
no database connection strings, and no API keys.

### Smoke test after deploy

```bash
# Health check
curl https://stamp.yourdomain.com/health
# → {"status":"ok"}

# PWA loads
curl -I https://stamp.yourdomain.com
# → HTTP/2 200

# Service worker registered (open in browser, check Application tab in devtools)
```
