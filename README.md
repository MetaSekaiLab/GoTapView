# GoTapView

A viewer for [GoTapline](https://github.com/TONY-All/GoTapline) `.tap` captures. It decodes and
decrypts a capture and shows the traffic on one timeline, with TLS and UDP interleaved in the
exact order they happened.

Ships as a single **macOS app** (Electron) — open it, choose a `.tap`, read the traffic.

Two parts:

1. **decoder (Go)** — reads a `.tap`, reassembles TLS flows, decrypts the Project Sekai game API
   (AES-128-CBC + MessagePack) to JSON, auto-discovers Diarkis session keys from the decrypted
   `diarkis-auth` responses, and decodes the Diarkis realtime UDP protocol. Emits the decoded
   session as JSON.
2. **viewer (`desktop/`, Electron + React + Tailwind)** — a standard react-dom app that renders the
   timeline, a session overview, and a detail view showing decrypted request/response JSON and
   decoded UDP frames.

The Electron **main process spawns the Go decoder as a bundled sidecar** (`tapview -json -`), reads
its JSON over one IPC call, and hands it to the renderer — there is no localhost server and no port
to configure. The pure decode-adjacent logic (`desktop/src/model/*`) is shared TypeScript; the Go
decoder is the single source of truth for the wire formats.

The design point: within one capture you can watch the game fetch its realtime keys over HTTPS and
then watch those same keys decrypt the UDP that follows — the HTTP and UDP halves are proven
against each other, on a single clock.

## What it decodes

- **mkcn game API** (`*.dailygn.com`, `application/octet-stream`): AES-128-CBC/PKCS7 body →
  MessagePack → JSON. Login, `diarkis-auth`, room APIs, etc.
- **Diarkis UDP**: RUDP wrapper + frame header, coalesced-datagram splitting, encrypt-then-MAC
  secure payload (per-session keys taken from the capture's own `diarkis-auth` responses),
  MessagePack, SyncData property blobs, Room broadcast messages, and the multi-live
  RoomProperty/PlayerProperty maps (named at runtime) — e.g. `BASIC_INFO` expands to the full
  `RoomUserBasicInfo` struct.
- **Lossless on the unknown**: a UDP frame that cannot be fully decoded still shows the fields that
  parsed (seq / flag / ver / cmd / status) and keeps the rest as hex; an undecryptable HTTP body is
  preserved as text or hex.

## Use the app

Download `GoTapView-<ver>-arm64.dmg` from the releases page, drag it to Applications, then:

```sh
xattr -dr com.apple.quarantine /Applications/GoTapView.app   # unsigned build
open /Applications/GoTapView.app
```

Click **Open capture…** (or File → Open, ⌘O) and pick a `.tap`; double-clicking a `.tap` in Finder
also opens it. Arrow keys ↑/↓ step through packets, the logo returns to the overview, and the theme
follows the system (toggle in the top-right).

Apple silicon (arm64), macOS 11+. The build is unsigned and un-notarized, hence the `xattr` step.

## Build it yourself

```sh
scripts/build-desktop.sh v0.7.0     # → desktop/release/GoTapView-0.7.0-arm64.dmg (+ .zip)
```

The script cross-builds the Go decoder into `desktop/resources/tapview`, builds the React renderer
and the Electron main/preload with Vite, and packages everything with electron-builder. Needs Go and
Node.

Dev loop:

```sh
cd desktop && npm install && npm run dev     # Vite + Electron with HMR
```

## Headless CLI

The decoder also runs on its own — for scripting, or to serve the JSON:

```sh
go build -o tapview ./cmd/tapview
./tapview -f capture.tap -json out.json -no-serve   # dump JSON to a file
./tapview -f capture.tap -json - -no-serve          # …or to stdout (this is the Electron sidecar)
./tapview -f capture.tap                            # serve /session on :8787
```

## Architecture

```
                    ┌──────────────── GoTapView.app (Electron) ────────────────┐
capture.tap ──▶ main process ──spawn──▶ tapview (Go sidecar, -json -) ──JSON──▶ │
                    │                                                     IPC   │
                    └── preload (window.gotap) ──▶ renderer (React + Tailwind) ─┘

Go decoder (cmd/tapview + internal/*):
  ├─ internal/tapfile    read the .tap container
  ├─ internal/httpx      reassemble TLS streams, frame HTTP/1.1 (CL/chunked/gzip)
  ├─ internal/apicrypto  mkcn AES-128-CBC/PKCS7
  ├─ internal/mpjson     MessagePack → JSON (bin as hex, nested msgpack, SyncData, 64-bit-safe ints)
  ├─ internal/diarkis    UDP wrapper/frame/secure-payload/broadcast + property maps + struct naming
  ├─ internal/keyring    discover Diarkis keys from diarkis-auth responses
  ├─ internal/session    assemble the timeline (events ordered by capture seq)
  └─ internal/httpapi    optional /session server for the standalone CLI

Renderer (desktop/src):
  ├─ model/*             pure TS: analyze, facets, group, phase, props, search (shared logic)
  ├─ theme/              CSS-variable palette + data-theme (system/light/dark)
  ├─ components/         primitives, timeline (virtualized), detail, overview, toolbar
  └─ screens/AppShell    load → filter/group → master-detail layout
```

The session JSON is the only contract between decoder and viewer; its shape is mirrored in
`desktop/src/types.ts`.

## Verify

```sh
go test ./... && go vet ./...          # decoder: unit tests + real-capture integration test
cd desktop && npm run build            # renderer: tsc --noEmit + vite build
```

The integration test decodes a real capture and asserts the login decrypted to a `sessionToken`, a
Diarkis key was discovered, and >95% of UDP frames decoded — but the `.tap` fixture is **not**
committed, because a capture contains real account tokens and keys.

## Note on secrets

The mkcn API key/iv are static and baked into `internal/apicrypto` (recovered from the game).
Diarkis keys are never hardcoded — they are extracted at runtime from each capture's own
`diarkis-auth` traffic. Captures (`*.tap`) and decoded dumps are gitignored; do not commit them.
