# GoTapView

A viewer for [GoTapline](https://github.com/TONY-All/GoTapline) `.tap` captures. It decodes and
decrypts a capture and shows the traffic on one timeline, with TLS and UDP interleaved in the
exact order they happened.

Ships as a single **macOS app** — double-click, choose a `.tap`, read the traffic. The same code
also runs as a headless CLI plus an Expo app if you prefer that split.

Two modules, one binary:

1. **decoder (Go)** — reads a `.tap`, reassembles TLS flows, decrypts the Project Sekai game API
   (AES-128-CBC + MessagePack) to JSON, auto-discovers Diarkis session keys from the decrypted
   `diarkis-auth` responses, and decodes the Diarkis realtime UDP protocol. Serves the decoded
   session as JSON.
2. **viewer (`app/`, Expo / React Native)** — renders the timeline, with a detail view showing
   decrypted request/response JSON and decoded UDP frames.

In the packaged app both live in one process: the UI is embedded with `go:embed` and shown in a
WKWebView window, so there is nothing to install and no port to configure.

> The desktop build renders the React Native source through **React Native Web** inside a native
> window — the UI code is shared verbatim with the mobile app, but the rendering layer is web, not
> `react-native-macos`.

The design point: within one capture you can watch the game fetch its realtime keys over HTTPS and
then watch those same keys decrypt the UDP that follows — the HTTP and UDP halves are proven
against each other, on a single clock.

## What it decodes

- **mkcn game API** (`*.dailygn.com`, `application/octet-stream`): AES-128-CBC/PKCS7 body →
  MessagePack → JSON. Login, `diarkis-auth`, room APIs, etc.
- **Diarkis UDP**: RUDP wrapper + frame header, coalesced-datagram splitting, encrypt-then-MAC
  secure payload (per-session keys taken from the capture's own `diarkis-auth` responses),
  MessagePack, SyncData property blobs (`type|len|data`), and Room broadcast messages
  (`[msgId, sender, data]`).
- **Lossless on the unknown**: a UDP frame that cannot be fully decoded still shows the fields that
  parsed (seq / flag / ver / cmd / status) and keeps the rest as hex. An HTTP body that cannot be
  decrypted is preserved as text or hex.

## Use the app

Download `GoTapView.app` from the releases page, then:

```sh
xattr -dr com.apple.quarantine /Applications/GoTapView.app   # unsigned build
open /Applications/GoTapView.app
```

Click **Choose capture…** and pick a `.tap`. To open one directly:

```sh
open -n GoTapView.app --args -f /path/to/capture.tap
```

## Build it yourself

```sh
scripts/build-app.sh v0.1.0     # → dist/GoTapView.app  and  dist/tapview
```

The script exports the RN app to a web bundle, embeds it, builds the windowed binary (CGO, links
WKWebView) and assembles the bundle. Needs Node and Xcode command-line tools.

## Headless / mobile

The decoder also runs on its own, which is what you want for scripting or for viewing on a phone:

```sh
go build -o tapview ./cmd/tapview
./tapview -f capture.tap                       # serves the UI + JSON on :8787
./tapview -f capture.tap -json out.json -no-serve   # or just dump JSON
```

For the Expo app against that server:

```sh
cd app && npm install && npx expo start        # w = web, i = iOS simulator
```

On the simulator `localhost` reaches your Mac; on a real device set the address field to your Mac's
LAN IP (e.g. `http://192.168.2.155:8787`).

## Architecture

```
                       ┌─────────────── GoTapView.app ───────────────┐
capture.tap ──▶ decoder (Go) ──▶ /session (JSON) ──▶ embedded UI ──▶ WKWebView
                       └────────────────────────────────────────────┘
                  │
                  ├─ internal/tapfile   read the .tap container
                  ├─ internal/httpx     reassemble TLS streams, frame HTTP/1.1 (CL/chunked/gzip)
                  ├─ internal/apicrypto mkcn AES-128-CBC/PKCS7
                  ├─ internal/mpjson    MessagePack → JSON (bin as hex, nested msgpack, SyncData)
                  ├─ internal/diarkis   UDP wrapper/frame/secure-payload/broadcast decode
                  ├─ internal/keyring   discover Diarkis keys from diarkis-auth responses
                  ├─ internal/session   assemble the timeline (events ordered by capture seq)
                  ├─ internal/httpapi   serve /session, /pick (native file dialog), /open
                  └─ internal/ui        go:embed of the exported viewer bundle
```

`cmd/gotapview-app` is the windowed build; `cmd/tapview` is the headless one. Both use the same
decoder, so a capture reads identically either way.

The session JSON is the only contract between the two modules; its shape is mirrored in
`app/src/types.ts`.

## Verify

```sh
go test ./...          # unit tests + a real-capture integration test (skips if no fixture)
go vet ./...
cd app && npx tsc --noEmit
```

`go build ./...` works without Node: `internal/ui/dist` keeps a tracked placeholder, and in that
state the windowed app exits with a message pointing at `scripts/build-app.sh`.

The integration test decodes a real capture and asserts the login decrypted to a `sessionToken`,
a Diarkis key was discovered, and >95% of UDP frames decoded — but the `.tap` fixture is **not**
committed, because a capture contains real account tokens and keys.

## Note on secrets

The mkcn API key/iv are static and baked into `internal/apicrypto` (recovered from the game).
Diarkis keys are never hardcoded — they are extracted at runtime from each capture's own
`diarkis-auth` traffic. Captures (`*.tap`) and decoded dumps are gitignored; do not commit them.
