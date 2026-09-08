# GoTapView

A viewer for [GoTapline](https://github.com/TONY-All/GoTapline) `.tap` captures. It decodes and
decrypts a capture and shows the traffic on one timeline, with TLS and UDP interleaved in the
exact order they happened.

Two modules:

1. **`tapview` (Go)** — reads a `.tap`, reassembles TLS flows, decrypts the Project Sekai game API
   (AES-128-CBC + MessagePack) to JSON, auto-discovers Diarkis session keys from the decrypted
   `diarkis-auth` responses, and decodes the Diarkis realtime UDP protocol. It serves the decoded
   session as JSON over localhost.
2. **`app` (Expo / React Native)** — fetches that JSON and renders the timeline, with a detail view
   that shows decrypted request/response JSON and decoded UDP frames.

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

## Run

Terminal 1 — decode and serve a capture:

```sh
go build -o tapview ./cmd/tapview
./tapview -f /path/to/capture.tap          # serves http://127.0.0.1:8787/session
# ./tapview -f cap.tap -json out.json -no-serve   # or dump to a file instead
```

Terminal 2 — the viewer:

```sh
cd app
npm install
npx expo start          # press w for web, or i for the iOS simulator
```

On the iOS simulator `localhost` reaches your Mac. On a real device, set the address field in the
app to your Mac's LAN IP (e.g. `http://192.168.2.155:8787`).

## Architecture

```
capture.tap ──▶ tapview (Go) ──▶ GET /session (JSON) ──▶ Expo app (timeline UI)
                  │
                  ├─ internal/tapfile   read the .tap container
                  ├─ internal/httpx     reassemble TLS streams, frame HTTP/1.1 (CL/chunked/gzip)
                  ├─ internal/apicrypto mkcn AES-128-CBC/PKCS7
                  ├─ internal/mpjson    MessagePack → JSON (bin as hex, nested msgpack, SyncData)
                  ├─ internal/diarkis   UDP wrapper/frame/secure-payload/broadcast decode
                  ├─ internal/keyring   discover Diarkis keys from diarkis-auth responses
                  └─ internal/session   assemble the timeline (events ordered by capture seq)
```

The session JSON is the only contract between the two modules; its shape is mirrored in
`app/src/types.ts`.

## Verify

```sh
go test ./...          # unit tests + a real-capture integration test (skips if no fixture)
go vet ./...
cd app && npx tsc --noEmit
```

The integration test decodes a real capture and asserts the login decrypted to a `sessionToken`,
a Diarkis key was discovered, and >95% of UDP frames decoded — but the `.tap` fixture is **not**
committed, because a capture contains real account tokens and keys.

## Note on secrets

The mkcn API key/iv are static and baked into `internal/apicrypto` (recovered from the game).
Diarkis keys are never hardcoded — they are extracted at runtime from each capture's own
`diarkis-auth` traffic. Captures (`*.tap`) and decoded dumps are gitignored; do not commit them.
