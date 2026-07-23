#!/usr/bin/env bash
#---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See License.txt in the project root for license information.
#---------------------------------------------------------------------------------------------
#
# Phase 0 QA runner — unit tests (always) + optional CDP smoke against a dev build.
# When --cdp is set, also runs Phase 1 safety verification (tool permissions, command risk, config registry).
#
#  Usage:
#    test/cortexide-smoke/run-phase0-qa.sh           # unit tests only
#    test/cortexide-smoke/run-phase0-qa.sh --cdp     # unit tests + CDP verify (port 9222)
#    CX_CDP_PORT=9333 test/cortexide-smoke/run-phase0-qa.sh --cdp
#---------------------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUN_CDP=0
for arg in "$@"; do
	if [[ "$arg" == "--cdp" ]]; then RUN_CDP=1; fi
done
if [[ "${CX_CDP:-0}" == "1" ]]; then RUN_CDP=1; fi

PORT="${CX_CDP_PORT:-9222}"
WS="${CX_WS:-/tmp/cx-phase0-qa-ws}"
PROFILE="${CX_PROFILE:-/tmp/cx-phase0-qa-profile}"

echo "== CortexIDE QA: Phase 0 + Phase 2 unit tests =="
npm run test-cortexide-qa

if [[ "$RUN_CDP" -ne 1 ]]; then
	echo ""
	echo "Unit tests passed. For live CDP verification, re-run with: $0 --cdp"
	echo "  (requires: node build/lib/preLaunch.ts && npm run buildreact)"
	exit 0
fi

APP="$ROOT/.build/electron/CortexIDE.app/Contents/MacOS/CortexIDE"
if [[ ! -x "$APP" ]]; then APP="$ROOT/.build/electron/cortexide"; fi
if [[ ! -x "$APP" ]] && [[ -f "$ROOT/.build/electron/cortexide.exe" ]]; then APP="$ROOT/.build/electron/cortexide.exe"; fi
if [[ ! -x "$APP" ]]; then
	echo "ERROR: built app not found. Run: node build/lib/preLaunch.ts" >&2
	exit 1
fi

echo ""
echo "== Phase 0 QA: CDP verify (port $PORT) =="

# Kill any stale instance on our profile/port.
pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
sleep 1

mkdir -p "$WS"
[[ -f "$WS/hello.txt" ]] || printf 'phase0 qa\n' > "$WS/hello.txt"

test/cortexide-smoke/launch-dev.sh "$PORT" "$WS" "$PROFILE" &
LAUNCH_PID=$!
cleanup() {
	kill "$LAUNCH_PID" 2>/dev/null || true
	pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for CDP endpoint.
for i in {1..60}; do
	if curl -sf "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then break; fi
	sleep 2
done

node test/cortexide-smoke/phase0-qa-verify.mjs --port "$PORT"
echo ""
echo "== Phase 1 safety: CDP verify (port $PORT) =="
node test/cortexide-smoke/phase1-safety-verify.mjs --port "$PORT"
echo "Phase 0 QA + Phase 1 safety (unit + CDP) complete."
