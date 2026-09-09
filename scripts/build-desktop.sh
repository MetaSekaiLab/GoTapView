#!/usr/bin/env bash
# Build the Electron desktop app: the Go decoder sidecar + the React renderer,
# packaged by electron-builder into a .dmg and a .zip (macOS arm64, ad-hoc).
#
# Usage: scripts/build-desktop.sh [version]
set -euo pipefail

VERSION="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> building the Go decoder sidecar (arm64)"
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags '-s -w' \
  -o desktop/resources/tapview ./cmd/tapview

cd desktop

echo "==> installing renderer deps (if needed)"
[ -d node_modules ] || npm ci

# Keep package.json version in step with the release tag (strip a leading v).
PLAIN="${VERSION#v}"
npm version "$PLAIN" --no-git-tag-version --allow-same-version >/dev/null 2>&1 || true

echo "==> building the renderer + electron bundles"
npm run build

echo "==> packaging with electron-builder (dmg + zip, arm64)"
npx electron-builder --mac dmg zip --arm64 --publish never

echo
echo "built:"
ls -1 release/*.dmg release/*.zip 2>/dev/null || true
