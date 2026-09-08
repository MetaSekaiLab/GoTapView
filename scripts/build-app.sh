#!/usr/bin/env bash
# Build GoTapView.app: a single macOS bundle containing the .tap decoder, the
# HTTP server and the viewer UI.
#
#   1. export the React Native app to a static web bundle (React Native Web)
#   2. copy it into internal/ui/dist so go:embed picks it up
#   3. build the windowed binary (CGO, links WKWebView)
#   4. assemble the .app bundle with an Info.plist and an icon
#
# Usage: scripts/build-app.sh [version]
set -euo pipefail

VERSION="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="GoTapView"
BUNDLE_ID="io.gotapview.viewer"
OUT="dist"
APP="$OUT/$APP_NAME.app"

echo "==> exporting the UI (React Native → React Native Web)"
pushd app >/dev/null
[ -d node_modules ] || npm install --silent
rm -rf /tmp/gotapview-web
CI=1 npx expo export --platform web --output-dir /tmp/gotapview-web >/dev/null
popd >/dev/null

echo "==> embedding the UI bundle"
PLACEHOLDER=internal/ui/dist/PLACEHOLDER.txt
PLACEHOLDER_BODY="$(cat "$PLACEHOLDER" 2>/dev/null || true)"
rm -rf internal/ui/dist
mkdir -p internal/ui/dist
cp -R /tmp/gotapview-web/. internal/ui/dist/
# keep the tracked placeholder so `go build ./...` still works after a clean
printf '%s\n' "$PLACEHOLDER_BODY" > "$PLACEHOLDER"
test -f internal/ui/dist/index.html || { echo "export produced no index.html"; exit 1; }

echo "==> building the app binary (arm64, CGO for WKWebView)"
rm -rf "$OUT"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -trimpath \
  -ldflags "-s -w -X main.version=$VERSION" \
  -o "$APP/Contents/MacOS/$APP_NAME" ./cmd/gotapview-app

echo "==> building the headless CLI"
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath \
  -ldflags "-s -w" -o "$OUT/tapview" ./cmd/tapview

echo "==> icon"
if [ -f app/assets/icon.png ]; then
  ICONSET=/tmp/gotapview.iconset
  rm -rf "$ICONSET"; mkdir -p "$ICONSET"
  for sz in 16 32 64 128 256 512; do
    sips -z $sz $sz app/assets/icon.png --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
    d=$((sz*2))
    sips -z $d $d app/assets/icon.png --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/$APP_NAME.icns" 2>/dev/null || true
fi

echo "==> Info.plist"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>$APP_NAME</string>
  <key>CFBundleIconFile</key><string>$APP_NAME</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <!-- The UI and API are served on 127.0.0.1 inside this process. -->
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key><string>GoTapline capture</string>
      <key>CFBundleTypeExtensions</key><array><string>tap</string></array>
      <key>CFBundleTypeRole</key><string>Viewer</string>
      <key>LSHandlerRank</key><string>Alternate</string>
    </dict>
  </array>
</dict>
</plist>
PLIST

echo "==> ad-hoc codesign (unsigned builds are quarantined by Gatekeeper)"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || echo "    (codesign unavailable; the app still runs after clearing quarantine)"

echo
echo "built $APP"
du -sh "$APP" | awk '{print "     size: "$1}'
echo "     CLI: $OUT/tapview"
