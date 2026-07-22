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
	APP="$ROOT/.build/electron/cortexide"
fi
if [[ ! -x "$APP" ]] && [[ -f "$ROOT/.build/electron/cortexide.exe" ]]; then
	APP="$ROOT/.build/electron/cortexide.exe"
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

# Ensure in-window menubar on Windows/Linux (required for #8 dropdown QA).
SETTINGS="$UDD/User/settings.json"
if [[ ! -f "$SETTINGS" ]]; then
	mkdir -p "$(dirname "$SETTINGS")"
	printf '%s\n' '{"window.menuBarVisibility":"classic","window.titleBarStyle":"custom"}' > "$SETTINGS"
fi

echo "Launching CortexIDE (port $PORT, ws $WS, profile $PROFILE)"
# --password-store=basic: the ad-hoc-signed dev build (Identifier "Electron", no Team ID) can't be
# stably attributed to its macOS Keychain item, so safeStorage prompts for the login password on
# every launch. "basic" makes Electron use in-memory/plaintext encryption instead of the Keychain,
# so there's no prompt. Dev-only convenience; release builds must be Developer-ID signed instead.
#
# Workspace Trust is DISABLED by default (smoke runs want the agent unrestricted). Set
# CX_KEEP_TRUST=1 to keep Workspace Trust ENABLED so the trust dispatch gate can be exercised
# against an untrusted workspace.
TRUST_FLAG="--disable-workspace-trust"
if [[ "${CX_KEEP_TRUST:-0}" == "1" ]]; then
	TRUST_FLAG=""
	echo "Workspace Trust ENABLED (CX_KEEP_TRUST=1) — workspace opens untrusted."
fi
exec env -u ELECTRON_RUN_AS_NODE \
	NODE_ENV=development VSCODE_DEV=1 VSCODE_CLI=1 ELECTRON_ENABLE_LOGGING=1 \
	"$APP" "$ROOT" \
	--remote-debugging-port="$PORT" \
	--user-data-dir="$UDD" \
	--extensions-dir="$EXT" \
	--disable-updates $TRUST_FLAG \
	--skip-welcome --skip-release-notes --disable-gpu \
	--disable-extension=vscode.vscode-api-tests \
	--password-store="basic" \
	"$WS"
