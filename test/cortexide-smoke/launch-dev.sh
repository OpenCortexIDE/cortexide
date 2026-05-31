#!/usr/bin/env bash
#---------------------------------------------------------------------------------------------
#  Copyright (c) 2025 CortexIDE. All rights reserved.
#  Licensed under the MIT License. See License.txt in the project root for license information.
#---------------------------------------------------------------------------------------------
#
# Launch the CortexIDE dev build with a Chrome DevTools debug port so the CDP smoke
# harness (cdp-smoke.mjs) can attach.
#
# IMPORTANT: This editor is a VS Code fork whose main process imports from "electron".
# When this is launched from a terminal inside a VS Code-family editor, ELECTRON_RUN_AS_NODE=1
# leaks into the environment and makes the Electron binary run as plain Node, which then
# fails with: SyntaxError: ... 'electron' does not provide an export named 'Menu'. We
# therefore explicitly clear that variable here.
#
# Usage: test/cortexide-smoke/launch-dev.sh [port] [workspace] [profile-dir]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${1:-9222}"
WS="${2:-/tmp/cx-ws-cdp}"

APP="$ROOT/.build/electron/CortexIDE.app/Contents/MacOS/CortexIDE"
if [[ ! -x "$APP" ]]; then
	# Linux / other: fall back to applicationName binary.
	APP="$ROOT/.build/electron/cortexide"
fi
if [[ ! -x "$APP" ]]; then
	echo "ERROR: built app not found. Run: node build/lib/preLaunch.ts" >&2
	exit 1
fi

mkdir -p "$WS"
[[ -f "$WS/hello.txt" ]] || printf 'hello cortexide\n' > "$WS/hello.txt"

# Use PERSISTENT profile dirs (not mktemp) so the smoke run mirrors a real, warm user
# profile. A fresh temp profile + --no-cached-data pushes extension-host init past the
# 10s startup timeout and triggers a spurious json-language-features restart loop on the
# very first launch that does NOT recur once the profile is warm. Pass a 3rd arg to
# override the profile location.
PROFILE="${3:-/tmp/cx-dev-profile}"
UDD="$PROFILE/user-data"
EXT="$PROFILE/extensions"
mkdir -p "$UDD" "$EXT"

echo "Launching CortexIDE (port $PORT, ws $WS, profile $PROFILE)"
exec env -u ELECTRON_RUN_AS_NODE \
	NODE_ENV=development VSCODE_DEV=1 VSCODE_CLI=1 ELECTRON_ENABLE_LOGGING=1 \
	"$APP" "$ROOT" \
	--remote-debugging-port="$PORT" \
	--user-data-dir="$UDD" \
	--extensions-dir="$EXT" \
	--disable-updates --disable-workspace-trust \
	--skip-welcome --skip-release-notes --disable-gpu \
	--disable-extension=vscode.vscode-api-tests \
	"$WS"
