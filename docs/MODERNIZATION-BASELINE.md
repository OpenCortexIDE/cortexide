# Modernization Baseline

Captured at the start of the `modernize-agentic-editor-foundation` effort. This is the
ground-truth state we are measuring all phases against. Do not edit retroactively — append
phase results below instead.

## Git

- **Branch:** `modernize-agentic-editor-foundation` (forked from `fix/agentic-mode-cloud-failover-2026-06-05`,
  which is 89 commits ahead of `main`, 0 behind — it carries the Session-11 agentic fixes).
- **Working tree at branch creation:** clean (0 uncommitted changes).

## Versions / runtime

- VS Code base: **1.118.1** (`package.json` `version`)
- Electron: **39.8.8** (`package.json` devDependencies)
- Node: **22.22.1** (`.nvmrc`)
- distro pin: `b85ea484c93395a77703478557a49e35ac7c0841`
- Product: `nameShort`/`nameLong` = `CortexIDE` (`product.json`)

## Commands

| Purpose | Command |
|---|---|
| Type check (fast) | `npm run compile-check-ts-native` → `tsgo --project ./src/tsconfig.json --noEmit --skipLibCheck` |
| Node unit tests (all) | `npm run test-node` → `mocha test/unit/node/index.js` |
| Node unit tests (cortexide subset) | `npm run test-node -- --runGlob "vs/workbench/contrib/cortexide/test/common/*.test.js"` |
| Browser unit tests | `npm run test-browser` |
| Full build | `npm run compile` (gulp) |
| React UI build | `npm run buildreact` (source = `browser/react/src2/`, **not** `src/`) |
| Fast transpile src→out | `node build/next/index.ts transpile` |

Node test runner globs `**/test/**/*.test.js` and **excludes** `**/{browser,electron-browser,electron-main,electron-utility}/**/*.test.js`,
so node-runnable tests must live in a `test/common/` directory.

## Test baseline (cortexide subset)

- `npm run test-node -- --runGlob "vs/workbench/contrib/cortexide/test/common/*.test.js"`
  → **214 passing, 0 failing** (108ms).

### Known weak/placeholder tests (pass but prove nothing — tracked for Phase 1/2)

- `test/common/rollbackSnapshotService.test.ts` — all bodies are `assert.ok(true)` placeholders.
- `test/common/autostash.flow.test.ts` — all bodies are `assert.ok(true)` placeholders.
- `test/common/applyAll.rollback.flow.test.ts` — all bodies are `assert.ok(true)` placeholders.
- `test/common/ssrfGuard.test.ts` — imports from the `browser/` layer; silently fails to compile and is never exercised (the real coverage is `test/browser/ssrfGuard.test.ts`).

## Highest-risk untested subsystems (no direct tests at baseline)

- `browser/chatThreadService.ts` (6,217 lines — agent loop) — **0 direct tests**.
- `browser/editCodeService.ts` (2,609 lines — apply engine) — **0 direct tests**.
- `electron-main/llmMessage/sendLLMMessage.impl.ts` (18-provider dispatch) — **0 tests**.
- `common/modelRouter.ts` (1,763 lines) — **0 tests**.
- IPC channels (`mcpChannel`, `hooksRunnerChannel`, `sendLLMMessageChannel`) — **0 tests**.

## Config keys read by code but NOT registered at baseline (invisible in Settings UI)

`cortexide.global.localFirstAI`, `cortexide.index.ast`, `cortexide.safety.rollback.enable`,
`cortexide.safety.rollback.maxSnapshotBytes`, `cortexide.safety.autostash.enable`,
`cortexide.safety.autostash.mode`, `cortexide.rag.vectorStore`, `cortexide.rag.vectorStoreUrl`,
`cortexide.audit.enable`, `cortexide.audit.path`, `cortexide.audit.rotationSizeMB`.
(`cortexide.secretDetection.*` IS registered via `secretDetectionConfiguration.ts`.)

The registering contribution `cortexideGlobalSettingsConfiguration.ts` existed but was **never imported**
into `cortexide.contribution.ts`, so even `cortexide.global.localFirstAI` was unregistered.

---

## Phase results (append-only)

### Phase 0 — Stop shipping broken promises ✅ (4 commits)

- **Config registration:** `cortexideConfigKeys.ts` (pure SSOT) + rewritten
  `cortexideGlobalSettingsConfiguration.ts` now register the 11 `cortexide.*` keys services
  read; the contribution is statically imported in `cortexide.contribution.ts`. Defaults match
  each service's `?? fallback`; experimental/degrading features stay OFF (rag.vectorStore='none',
  rollback off, audit off, ast experimental).
- **Tool count:** false "27 built-ins" → dynamic `builtinToolCount` (**35**) from
  `builtinToolNames.ts`, edited in `src/` (authored source). Compile-time `Record<BuiltinToolName,true>`
  exhaustiveness guard + count test prevent drift.
- **Docs:** accuracy banners on both comparison docs; removed fabricated "50-90%"/"20-40%" figures;
  fixed false "Claude Code: No MCP / No agent mode"; downgraded dead tree-sitter/vector/"Enterprise-Grade
  RAG" and experimental audit/rollback claims.
- **Dead code:** removed 11 orphaned files + `common/telemetry/` (re-verified 0 importers each).
- **Claim-verification test:** `phase0ClaimVerification.test.ts` (8 tests) fails if a service reads
  an unregistered key or an experimental feature gets a degrading default.
- **Result:** cortexide common node tests **214 → 222 passing, 0 failing**. tsgo clean.

**Audit corrections discovered while implementing (the audit was WRONG on these):**
- `browser/react/src/` is **NOT dead** — it is the authored source; `src2/` and `out/` are
  **gitignored** build artifacts generated by `scope-tailwind`/`tsup`. (Audit debt #17 would have
  deleted the real UI source.) Edit `src/`, never `src2/`.
- `common/diffComposerAudit.ts` is **LIVE** (used at runtime by `composerPanel.ts`), not dead.
- Real built-in tool count is **35**, not 27 (claimed) or 17 (audit estimate).

### Phase 1 — Protect User Workspaces ⚠️ PARTIAL (5 commits)

Done + tested (cortexide common subset 222 → **243 passing, 0 failing**, tsgo clean throughout):
- **#3 Gather/read-only enforced at DISPATCH** (the keystone critical bug): new pure
  `common/toolPermissions.ts` (capability table + `checkToolAllowedInMode`); `_runToolCall` now
  gates every call (any parse path) BEFORE validation/approval/execution. `toolPermissions.test.ts`.
- **#4 Terminal danger now BLOCKS**: new pure `common/commandRisk.ts` classifier wired into the
  terminal approval gate — dangerous commands can't be auto-approved, catastrophic ones are refused.
  `commandRisk.test.ts`.
- **#1 Atomic writes (partial)**: `applyEngineV2` create+edit now request temp-file+rename atomic
  writes. `applyEngineV2.test.ts` asserts it via a capturing mock.
- **#6 Workspace Trust enforced at dispatch**: untrusted workspace blocks write/terminal/MCP (read
  allowed); `IWorkspaceTrustManagementService` injected into `chatThreadService`.
- **#4 Terminal cwd containment**: new pure `cwdEscapesWorkspace()`; a command whose cwd escapes the
  workspace can no longer be auto-approved (forces explicit approval). Multi-root aware. Tested.
- **#5 Secret redaction**: VERIFIED already implemented + secure-by-default (audit was WRONG that it
  was "completely unmitigated"). `sendLLMMessageService` redacts the outbound payload across all
  provider message formats; `cortexide.secretDetection.enabled` defaults true, `mode` defaults
  'redact', `block` mode honored. No code change needed.

**Build verification (real build, not piecemeal esbuild):**
- `npm run compile-check-ts-native` (tsgo, whole project): **0 errors**.
- `npm run buildreact`: success (onboarding bundle builds with dynamic `builtinToolCount`).
- `node build/next/index.ts transpile`: 5942 files, ok.
- `test-node` cortexide common subset: **249 passing, 0 failing**.
- NOTE: earlier `tsgo` runs were wrapped in `timeout` (absent on macOS) and silently no-op'd; the
  real runs above confirm 0 errors. A real transpile also surfaced + fixed a suite-crashing broken
  test (`test/common/ssrfGuard.test.ts` imported the browser layer → `MouseEvent` crash; deleted).

NOT done (DoD not met — Phase 1 is NOT complete; require core changes + LIVE app verification):
- **#1 agent-path atomic** — `editCodeService → cortexideModelService.saveModel → textFileService.save`
  is still non-atomic (`save` has no atomic option; a direct atomic write there desyncs the editor's
  dirty/etag state). Needs a core `textFileEditorModel` atomic-save option + a running app to verify
  dirty-state behavior. **Top follow-up.**
- **#2 Durable checkpoint/rollback** — still can't recreate deleted / remove created files, doesn't
  persist to disk, swallows errors (chatThreadService:5193-5298, editCodeService restore). L-effort,
  entangled, needs live verification.
- These two need a build+launch+exercise loop (CDP smoke), not just unit tests, to change safely.

### Phase 1 — LIVE agent-driven verification (2026-06-10, capable model)

Pulled `qwen2.5-coder:7b` (Auto had been picking the weak 3B). Results:
- **Gate A (gather read-only) — PROVEN end-to-end.** `test/cortexide-smoke/gather-isolated-e2e.mjs`
  (fresh profile, GATHER only, no agent follow-up): the 7B emitted a real `<create_file>` tool call,
  and even after **Approve & Execute** (plan executed), `pwned.txt` was **never written to disk**.
  The dispatch gate blocks real model-emitted writes in gather mode.
  - Earlier alarming `pwned.txt`-on-disk was **agent-mode contamination** (a reused conversation
    switched gather→agent; the agent phase, where writes ARE allowed, created it). Lesson: never
    reuse a chat conversation across mode switches in a safety test.
- **Gate E (settings) / config + secure defaults — PROVEN live.** `phase1-safety-verify.mjs` 26/26
  (real modules decide correctly in-renderer; keys registered; vectorStore='none', secretDetect redact).
- **Gate D (workspace trust) — logic+wiring+trusted-path verified; untrusted-block NOT live-exercised.**
  The dev CLI launch **auto-trusts** the workspace (no Restricted Mode even with `CX_KEEP_TRUST=1` +
  seeded `security.workspace.trust.*`). Same dispatch chokepoint as the proven gather gate.
- **Gates B/C (terminal danger / cwd) — logic+wiring verified (26/26 + artifact); not driven live**
  (would need the model to emit specific terminal commands + I won't run destructive commands).
- App boots on the branch (cdp-smoke 11/11). Capable agent writes work (diagtest.txt created by 7B in
  agent mode). `launch-dev.sh` gains `CX_KEEP_TRUST=1`.

### Phase 1 #1 — agent-path atomic writes ✅ DONE (2026-06-10)

The agent edit path (`editCodeService → cortexideModelService.saveModel → textFileService.save`)
is now atomic. Minimal opt-in core change reusing the normal save path (dirty/etag stay correct):
`ISaveOptions.atomicWrite?` → `textFileEditorModel.doSave` passes `atomic:{postfix:'.vsctmp'}` →
`saveModel` requests it, guarded by the provider's `FileAtomicWrite` capability (remote/virtual
fall back, no throw). tsgo 0 errors; unit `cortexideModelServiceSave.test.ts` (3); subset **252/0**;
LIVE E2E (`atomic-edit-e2e.mjs`, real 7B): rewrote target.txt → correct content, no `.vsctmp` leak,
editor stable. (applyEngineV2 was already atomic.)

### Phase 1 #2 — durable checkpoint/rollback ✅ DONE + LIVE-VALIDATED (2026-06-10)

Edit restore now PERSISTS to disk (editCodeService awaits atomic `saveModel`). New pure
`common/agentFileOps.ts` (12 unit tests) = durable per-op rollback: recreate deleted (with prior
content), remove created, restore modified; atomic writes; failures surfaced; sequential edits undo
in reverse. `chatThreadService` journals the BEFORE-state of create/delete/edit/rewrite/multi_edit at
the dispatch chokepoint and replays them on disk on a checkpoint jump (+notify on incomplete).
tsgo 0; subset **263/0**. LIVE E2E (real 7B agent): create→rollback REMOVES; delete→rollback RECREATES
with original content; edit V1→V2→rollback restores V1 ON DISK. (Lesson: a checkpoint jump no-ops
while the agent is running — wait for idle.) Documented limitations: session-scoped journal (not across
app restart); deleted-folder contents not restored; redo doesn't re-apply create/delete.

### Phase 1 — FUNCTIONALLY COMPLETE
All 6 items implemented, unit-tested (**263 passing, 0 failing**), tsgo 0 errors, and the
safety-critical behaviours live-validated end-to-end:
- #1 atomic writes ✅ (applyEngineV2 + agent-path saveModel; live: edit persists, no temp leak)
- #2 durable rollback ✅ (create/delete/edit restore on disk — live)
- #3 gather read-only at dispatch ✅ (live: blocks a real model-emitted write)
- #4 terminal danger-block + cwd containment ✅ (logic+wiring+renderer-tested; not driven with real destructive commands)
- #5 secret redaction before LLM ✅ (verified secure-by-default, live config)
- #6 workspace trust ✅ (logic+wiring+trusted-path live; untrusted-block NOT live — dev launch auto-trusts)

Honest residuals: gate D untrusted-block and gates B/C with real destructive commands are not
*driven* live (dev auto-trust; won't run `rm -rf`), but they share the dispatch chokepoint that IS
live-proven via the gather gate, and their decision logic is renderer-tested (26/26).

### Phase 2 — testable agent runtime (IN PROGRESS)

Step 1 done (zero-risk): the agent loop's pure DECISION logic is extracted into
`common/agentLoopDecisions.ts` (5 pure fns: tool-error counter, escalation trigger, loop
continuation, completion routing, compaction/overflow) with **57 unit tests** — mirroring the
inline loop behavior byte-for-byte (two known latent bugs B1/B2 preserved + pinned). NO wiring yet,
so zero runtime risk. Design came from a 7-agent mapping workflow (`.claude/phase2-map-workflow.js`)
that verified every line/constant against source. tsgo 0; subset **263 -> 320 passing, 0 failing**.

Remaining Phase 2 (separate behavior-preserving + live-validated commits): rewire the loop to
delegate to these (Edit A tool-error cap, then compaction, then iter-cap; defer the parse-classifier
+ llmError-gate to their own PRs), then the larger module split (AgentLoopController / ToolCallParser
/ AgentPlanner / etc.) per the user's Phase 2 spec.

### Phase 2 — wiring Edits A/D/B LANDED + live-validated (2026-06-10)

Step 2 done: the agent loop now DELEGATES to the pure decision fns (the tested module is the code
that runs, not a parallel copy that can drift). Three behavior-preserving commits, each tsgo 0 +
subset 320/0:
- **Edit A** (`db1bbdb0abd`) tool-error cap -> `updateConsecutiveToolErrors` with
  `escalationAvailable:false` (keeps `consecutiveToolErrors` at the incremented value so the
  escalate-reason + halt-message strings stay byte-identical, em-dash included; `tryEscalateModel`
  stays authoritative).
- **Edit D** (`53f6a12d0c0`) compaction + overflow -> `computeCompactionOverflowDecision`; de-dupes
  the two dynamic `getModelCapabilities` imports into ONE `contextWindow` resolution gated by a
  `capsResolved` flag (closes the only divergence: the unreachable import-throw path). IMPROVEMENT
  over the plan: split into a pre-compaction `compactDecision` and a post-compaction
  `overflowDecision` so the warning reflects post-compaction `promptTokens` (a single pre-compaction
  call would have spuriously warned after a successful compaction).
- **Edit B** (`cac44f0039a`) iter-cap escalation gate -> `shouldEscalateModel('iterCap')`;
  short-circuit is provably equivalent to the original unconditional await (tryEscalateModel returns
  false at its own guard with no side effect). `isAutoMode` is out of scope here (TDZ) and ignored by
  the iterCap branch, so it is passed as a literal `false`.

**Adversarial verification (6-agent Workflow, `.../phase2-wiring-adversarial-review`):** all 6
reviewers (per-edit control-flow/strings/tokens/scope + a whole-diff integration critic) returned
behaviorPreserving=TRUE, **zero reachable divergences**. One reviewer ran an exhaustive 9,216-combo
enumeration of the compaction/overflow inputs (0 divergences in {shouldCompact, warn, pct}); strings
verified byte-identical incl. the U+2014 em-dash; B1/B2 latent behaviors confirmed preserved. The two
flagged non-issues were a non-observable microtask/await-timing change (Edit B short-circuit) and the
redundant `overflowPct != null` guard.

**Live validation (CDP, post-wiring build, fresh ws):**
- boot smoke `cdp-smoke.mjs` 11/11.
- HAPPY PATH: `atomic-edit-e2e.mjs` with `qwen2.5-coder:7b` in Agent mode rewrote target.txt
  correctly (marker present, not empty, no .vsctmp leak) -> loop continuation + Edit A success-reset
  + per-iteration Edit D/B checks all intact end-to-end.
- CAP/ESCALATION PATH: new `phase2-cap-escalation-probe.mjs` with `qwen2.5-coder:1.5b` (thrashes on a
  multi-step Flask task) -> the wired cap path triggered `tryEscalateModel` live ("Switched to ..."
  detected) -> the escalation wiring fires under real model thrash. (The toast does not distinguish
  tool-error-cap vs iter-cap as the trigger, but a wired path fired.)

Tests: cortexide common node subset **320 passing, 0 failing**; tsgo 0 errors throughout.

Deferred (own reviewed PRs, per the plan): Edit C (llmError escalation gate, `nextModel`-scope
sensitive), Edit E (completion routing collapse), and the parse-classifier (function #6,
classifyToolCallFromLLMResponse). Then the larger module split (AgentLoopController / ToolCallParser
/ ToolPermissionEngine / AgentPlanner / ModelSelectionEngine / AgentContextBuilder / AgentSessionStore
/ AgentVerifier).

### Phases 3-10 — NOT STARTED
Model-agnostic provider platform; real RAG; apply/edit UX; agentic UX; MCP/plugins; privacy
hardening; CI/release; positioning. Multi-session work.

### Audit reliability note
Of the audit's headline criticals, **two were materially wrong** (secret redaction IS done +
secure-by-default; `react/src/` is the live source, not dead). Re-verify every audit claim in code
before acting on it.
