# CortexIDE smoke harness

Lightweight launch + smoke verification for the CortexIDE dev build, driven over the
Chrome DevTools Protocol (CDP). Used to confirm the editor actually boots and its core
+ CortexIDE-specific UI render — see `../../CORTEXIDE-TEST-STATUS.md` for results.

## Files
- `launch-dev.sh` — launches the built dev app (`.build/electron/...`) with
  `--remote-debugging-port`, stripping the inherited `ELECTRON_RUN_AS_NODE` that
  otherwise makes Electron run as plain Node. Uses throwaway user-data/extensions dirs.
- `cdp-smoke.mjs` — connects with Playwright `connectOverCDP`, finds the workbench page
  (`workbench-dev.html` in dev builds), and asserts core + CortexIDE surfaces exist.
- `phase0-qa-verify.mjs` — CDP regression for merged Phase 0 fixes (PR #69): provider
  validation, local tool format, attach-file commands, menubar stacking, theme scoping.
- `phase1-safety-verify.mjs` — CDP regression for Phase 1 safety: loads real transpiled
  `toolPermissions` / `commandRisk` in the live renderer, exercises gather/agent/untrusted
  decisions, and confirms `cortexide.*` safety settings registered at startup.
- `run-phase0-qa.sh` — runs `npm run test-phase0-qa` (unit) and optionally `--cdp` live verify
  (Phase 0 UI + Phase 1 safety).

## Usage
```bash
# (rebuild React UI only if you touched browser/react/src/*.tsx)
npm run buildreact

# Terminal A — launch and leave running:
test/cortexide-smoke/launch-dev.sh 9222 /tmp/cx-ws-cdp

# Terminal B — run the smoke test:
node test/cortexide-smoke/cdp-smoke.mjs --port 9222
```
Exit code 0 = all checks passed. A screenshot is written to the OS temp dir.

### Phase 0 QA (PR #69 regression)

```bash
# Fast — unit tests only (CI runs this on every PR):
npm run test-cortexide-qa
# Phase 0 only: npm run test-phase0-qa
# Phase 2 only: npm run test-phase2-qa

# Full — unit tests + live CDP verify (needs a built dev app):
node build/lib/preLaunch.ts
npm run buildreact   # if you touched React UI
test/cortexide-smoke/run-phase0-qa.sh --cdp

# Phase 1 safety only (app must already be running on the CDP port):
npm run test-phase1-safety-cdp
# or: node test/cortexide-smoke/phase1-safety-verify.mjs --port 9222
```

CI: `.github/workflows/phase0-qa.yml` runs unit tests on every PR/push to `main`.
Manual CDP jobs (`run-phase0-qa.sh --cdp`) also run Phase 1 safety verification.
Trigger CDP jobs manually via **Actions → Phase 0 QA → Run workflow**:
- **Windows** job clicks the in-window menubar and verifies the dropdown is visible (release gate for #8).
- **macOS** job runs module + CSS checks (native menu bar — no live click).

## Why CDP and not Playwright `_electron.launch()`
VS Code / CortexIDE manages its own (re)launching, so Playwright's stdout-handshake
Electron launcher fails with "Process failed to launch!". Launching the app ourselves
with a debug port and attaching over CDP is the supported path (mirrors upstream VS Code
`test/automation`). Note: once a debugger is attached to a page, `/json/list` may drop
that page's `webSocketDebuggerUrl`; Playwright's `connectOverCDP` handles this, a hand-
rolled raw-WebSocket client does not — so prefer `cdp-smoke.mjs`.
