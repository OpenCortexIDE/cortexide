# CortexIDE — Test & Verification Status

> Living document. Records what is **verified working**, **verified broken**, and
> **not yet tested** in the CortexIDE dev build, based on actually running the editor
> (not code-reading). Update this every session.

- **Editor**: CortexIDE (VS Code 1.118.1 fork), `cortexVersion` 0.1.0
- **Platform tested**: macOS arm64 (darwin 25.3.0), Electron 39.8.8
- **Last verified**: 2026-05-31
- **How it was tested**: launched the built dev app with a Chrome DevTools debug
  port and attached over CDP with Playwright. See `test/cortexide-smoke/`.

## How to run the editor + smoke test

```bash
# 1. Build the React UI bundle if you changed any browser/react/src/*.tsx
npm run buildreact

# 2. Launch the dev build with a debug port (strips ELECTRON_RUN_AS_NODE)
test/cortexide-smoke/launch-dev.sh 9222 /tmp/cx-ws-cdp   # leave running

# 3. In another shell, run the smoke test against it
node test/cortexide-smoke/cdp-smoke.mjs --port 9222
```

### ⚠️ Launch gotcha (cost me a lot of time — documented so it doesn't recur)
When launched from a terminal **inside a VS Code-family editor** (VS Code, Cursor,
CortexIDE), `ELECTRON_RUN_AS_NODE=1` is inherited from the parent. That flag makes
the Electron binary run as **plain Node**, so `out/main.js` dies immediately with:

```
SyntaxError: The requested module 'electron' does not provide an export named 'Menu'
```

The fix is to `unset ELECTRON_RUN_AS_NODE` before launching. `launch-dev.sh` does this
(`env -u ELECTRON_RUN_AS_NODE`), and `scripts/code.sh` was patched to `unset` it too.

Also note: `node_modules/.bin/electron` is **broken** (no `path.txt`/`dist`). The real
binary is `.build/electron/CortexIDE.app/Contents/MacOS/CortexIDE` (produced by
`node build/lib/preLaunch.ts`). And Playwright's `_electron.launch()` does **not** work
(VS Code manages its own processes) — attach over CDP instead.

---

## ✅ Verified WORKING (observed live, 2026-05-31)

| Area | Evidence |
|---|---|
| App boots as a real Electron app | Window opens; `cortexVersion: 0.1.0`, `vscodeVersion: 1.118.1`, `isDevMode: true` |
| Workbench shell renders | `.monaco-workbench` present; activity bar (8 items), status bar, editor part, sidebar part all present |
| Window title | `CortexIDE` |
| First-run self-test | `[FirstRunValidation] ✓ Services initialized` / `✓ Smoke test completed successfully` in boot log |
| CortexIDE commands registered | Command palette shows 21 rows for "CortexIDE"; DOM has `[id*=workbench.view.cortexide]`, `void-scope` (×3), `[aria-label*=Cortex]` (×9) |
| Command palette | Opens via `Cmd+Shift+P`; CortexIDE commands listed |
| **Chat sidebar (CortexIDE)** | Renders fully: CORTEXIDE logo, "Plan, @ for context" input, Agent/Auto selectors, "Context ~0/0 tokens", "Model auto:auto", action chips (Explain/Refactor/Add Tests/Fix Tests/Docstring/Optimize/Debug), "Previous Threads" |
| **Settings pane** | Renders fully with tabs: Models, Local Providers, Main Providers, Feature Options, General, MCP, All Settings |
| Feature Options UI | Autocomplete toggle, Apply (Same-as-Chat / Fast Apply), Tools auto-approve toggles, **Routing policy = "Auto (cheapest viable)"**, YOLO Mode, Editor, Commit Message Generator |
| **Free-tier routing wired into UI** | Settings text: *"Free-tier ladder tracks per-provider quotas and auto-falls-over on 429."* |
| React UI bundle | `npm run buildreact` builds clean; all mount points (sidebar/settings/onboarding/quick-edit/editor-widgets/tooltip) load with no React/mount console errors |
| No fatal renderer console errors | Smoke check "no fatal console errors" passed |

Smoke result: **11/11 checks passed** (`cdp-smoke.mjs`). Screenshot archived by the run.

---

## ❌ Verified BROKEN / issues (observed live, 2026-05-31)

| # | Severity | Issue | Evidence (boot log) |
|---|---|---|---|
| 1 | Cold-start only (measured) | **Extension-host restart loop + `json-language-features` activation failure happens on COLD start, clears on WARM start.** Measured both runs against the *same* persistent profile (35s window each): cold first run = `startFailed`×16, `json-language-features`×87 (ext host loops then settles); warm second run = `startFailed`×0, `json-language-features`×0, ext-host restarts×0, ext host started once. So it's a cold-profile init-timeout artifact, not a steady-state bug — but a real user's *very first* launch does hit it. **Mitigation worth doing:** raise/relax the 10s ext-host startup timeout for dev/cold-cache, or warm the profile during install. Not release-blocking. | cold: `startFailed`=16, `json-language-features`=87 · warm: both `=0`, ext-host-started=1 |
| 2 | Medium | ✅ **FIXED 2026-05-31.** `FirstRunValidation` probed a non-existent command ID `cortexide.quickAction`, so it always warned. Quick Actions are registered as `void.explainCode` / `void.refactorCode` / … (`quickActions.ts:301+`). Fixed `firstRunValidation.ts:132-145` to probe the real IDs. | was: `[FirstRunValidation] ⚠ Quick Action command not found` |
| 3 | Low | **Legacy `void` branding leak at runtime.** App writes extensions to `~/.void-editor/extensions/`; shared-storage paths reference void; many internal IDs/classes still `void.*` / `void-scope`; Quick Action command IDs are `void.*`. | `Updating extensions.json /Users/.../.void-editor/extensions/extensions.json` |

> **Re issue #1:** likely (but not yet confirmed) a cold-start artifact of the isolated
> `--extensions-dir` temp profile used for smoke testing — the workbench was still
> "Initializing default profile extensions" when the ext host first timed out, then it
> restarted and settled. Needs a second run against a **warm** profile to confirm whether
> it reproduces for real users. **TODO: confirm before treating as a real bug.**
>
> **Not a bug (earlier mis-report corrected):** `cortexide.openSidebar` (`sidebarPane.ts:152`,
> no `f1`, internal/startup) and `cortexide.sidebar.open` (`sidebarActions.ts:65`, `f1:true`,
> focuses chat) are two *distinct* commands, **not** a command-palette duplicate. Left as-is.

---

## ❓ NOT yet tested (next sessions)

- Onboarding "Express Setup" actually configuring a free model end-to-end (needs network + a real free provider key/keyless path).
- Sending a chat message and getting a streamed response.
- Ctrl+K inline quick edit; Apply; multi-file composer; diff accept/reject.
- Autocomplete (FIM) with a local model (Ollama).
- Agent mode tool calls (read_file/edit_file/grep_search/run_command/etc.).
- MCP server connection.
- Repo indexing / RAG.
- Windows and Linux launch.

---

## Unit test results (2026-05-31) — only what was actually measured

- ✅ **`freeTierLadder.test.ts` — 9/9 passing** (RUN_EXIT=0). The free-model routing ladder:
  provider ordering by qualityRank (cerebras>groq>gemini>openRouter>mistral), quota-exhaustion
  fallthrough, privacy gate, empty-config handling. Command that works:
  ```bash
  node test/unit/node/index.js --run out/vs/workbench/contrib/cortexide/test/common/freeTierLadder.test.js
  ```
  This is the one cortexide suite confirmed green this session.

- ⚠️ **Running the whole cortexide suite via `--runGlob "**/contrib/cortexide/test/**/*.test.js"`
  FAILS TO LOAD** (RUN_EXIT=1, no TAP output): `ReferenceError: MouseEvent is not defined`,
  thrown from `out/vs/workbench/contrib/terminal/browser/terminal.js` while importing
  `localModelOptimizations.test.js`. Cause: that test lives under `test/common/` but transitively
  imports a **browser** module (`terminal.js` → `MouseEvent`), so it cannot run under the Node
  unit runner. The default runner (`test-node`) avoids this by excludeGlobbing browser tests, but
  `--runGlob` bypasses those excludes. **Net:** the other cortexide common suites (secretDetection,
  applyEngineV2, autostash, rollbackSnapshot, auditLog, toolsService) are **NOT yet measured this
  session** — they need to be run individually with `--run` (one file each) or the mislocated
  browser-dep test needs moving to `test/browser/`. **TODO next session.**

> NOTE: an earlier draft of this section claimed "114 passing, 4 failing" with a detailed
> applyEngineV2 failure analysis. That was NOT a real measurement (the glob run never produced
> TAP output) and has been removed. Only the freeTierLadder 9/9 result above is verified.

## Regression-test plan

- **Unit (already in repo):** `src/vs/workbench/contrib/cortexide/test/common/freeTierLadder.test.ts`
  (9 tests for the free-tier ladder ordering / quota / privacy gate). Needs wiring into a
  runnable suite — see todo.
- **Smoke (added this session):** `test/cortexide-smoke/cdp-smoke.mjs` — boot + core/AI surface
  presence. This guards against the launch + render regressions found above.
- **Next:** add assertions that fail on issues #1–#3 once fixed, so they can't regress.
