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

### Phase 2 — Edit E investigated + DEFERRED; first module-split (ToolCallParser core) LANDED (2026-06-10)

**Edit E (completion-routing collapse) was mapped and DEFERRED as not worth doing now.** A 4-agent
mapping workflow (`.../phase2-editE-routing-map`) produced a full terminus table of the LLM-turn block
and concluded: the genuinely valuable full-collapse (Option A) is UNSAFE because the
`interrupted`/`completionSignaled` returns sit BEFORE the consecutive-tool-error cap + plan-step
bookkeeping while the `await`/`continue` decision sits AFTER -- collapsing them into one
`classifyCompletionState` switch would reorder side effects. The safe minimal wiring (Option B) only
wraps the trivial `awaitingUserApproval ? await : continue` + the two skip flags in verbose pure-fn
calls (all other inputs hard-coded false) -- low value, added verbosity, no reliability/testability
gain. So `classifyCompletionState` (and `decideLoopContinuation`, which overlaps what A/B already
wired) stay UNWIRED by choice; they remain tested. Conclusion: the cleanly-wireable pure decisions are
all wired (A/D/B); the remaining two model routing the real loop cannot cleanly separate.

**First module-split increment LANDED** (`a99767686cd`): extracted the agent loop's text-fallback
tool-call recognition into pure `common/toolCallRecognition.ts` (`recognizeTextToolCall`) and removed
the single-use private `_parseJSONToolCallFromText`. This is the safe core of the deferred
parse-classifier (ToolCallParser) and centralizes + TESTS the previously-untested preamble/marker-cut
logic that strips a model's hallucinated multi-tool transcript (the #1 weak/local-model robustness
hazard). Behavior-preserving (mirrors the inline block byte-for-byte: same parseTextToolCall, same
4-marker cut, same cutIdx>0/===0/===-1 preamble ternary, same toolCall build). The latent bug B1
(unparseable would-be tool call silently treated as natural text) is PRESERVED; its deliberate fix
belongs in this module in a later tested change (documented in the module header). Verification: tsgo 0;
new `test/common/toolCallRecognition.test.ts` (10 cases) -> subset **320 -> 330 passing, 0 failing**;
adversarial review (21-input equivalence fuzz) byte-identical; LIVE cdp-smoke 11/11 + atomic-edit-e2e
with `qwen2.5-coder:7b` (which emits the tool call as TEXT) recognized + executed -> file rewritten.

**Second module-split increment LANDED** (`7c548eb9a95`): extracted the agent loop's "should I
SYNTHESIZE a tool call from the model's prose?" GATE into pure `common/toolSynthesisDecision.ts`
(`decideToolSynthesis`); the synthesis ACTION stays inline. This finally TESTS the heuristic that most
governs weak/local-model agentic behavior (when a chatty reply auto-converts to an action): the
action/codebase/web intent word lists, the already-emitted-tool-tag suppression, the `looksFinal`
closer regex, the image-analysis carve-out, and the nAttempts/alreadyActed/file-cap gating. It is also
the synthesis machinery that is B1's runtime vector, now isolated + pinned. Behavior-preserving
(mirrors the inline outer guard + inner condition byte-for-byte; caller coerces
hasToolCall/hasImages/hasSynthesizedForRequest with `!!`, which the original used only in truthy/`!`
contexts). NOTE: a first attempt landed on the WRONG `const userRequest` (there are 3: normal-mode,
synthesis, needsMoreSearch) and clobbered the normal-mode advisory; caught immediately, reverted via
`git checkout`, and redone anchored on the synthesis outer-`if`. Verification: tsgo 0; new
`test/common/toolSynthesisDecision.test.ts` (20 cases) -> subset **330 -> 350 passing, 0 failing**;
adversarial review with a 500k-input equivalence fuzz (inline gate vs module) 0 divergences; LIVE
cdp-smoke 11/11 + atomic-edit-e2e (7B) completes (extraction did not break the loop). Still inline (own
follow-ups): the native-call canonicalization (~4439, already pure 1-liner) and the `needsMoreSearch`
"how many X" gate (~4676).

**Third module-split increment LANDED** (`5a3da8388c7`): extracted the agent loop's SECOND synthesis
trigger -- the `needsMoreSearch` "how many X" follow-up-search gate (~4620-4645) -- into pure
`common/toolSynthesisDecision.decideHowManySearch`. With `recognizeTextToolCall` +
`decideToolSynthesis` + `decideHowManySearch`, the tool-call recognition / synthesis-decision surface
(the parse-classifier / **ToolCallParser is now functionally COMPLETE**) is fully extracted + tested;
only the trivial already-pure native-call canonicalization one-liner remains inline by design.
Behavior-preserving (HOW_MANY_NOUNS 12 / COUNT_IN_RESPONSE_TERMS 9 match the inline arrays exactly and
correctly differ; `.some(includes)` == the `||` chains; outer guard is the De Morgan dual; inner
AND-chain verbatim; `!!` coercions safe). Verification: tsgo 0; `toolSynthesisDecision.test.ts` +13
(33 total) -> subset **350 -> 363 passing, 0 failing**; adversarial review with a 2,000,000-case
differential fuzz: 0 mismatches; LIVE cdp-smoke 11/11 + atomic-edit-e2e (7B) completes.

**Fourth module-split increment LANDED -- ModelSelectionEngine** (`520da9299c9`): extracted the two
remaining inline, untested pieces of model selection into pure `common/modelSelectionEngine.ts` (the
failover RANKING was already pure+tested in `routing/modelFailover.pickNextFailoverModel`):
`resolveModelRuntimeCaps` (the local-vs-cloud loop-cap POLICY -- local models get the tighter 30/3 caps;
replaces `recomputeModelState`'s cap logic) and `buildFailoverCandidates` (turns providers/models into
`FailoverCandidate[]` with the eligibility rules: skip unconfigured/hidden/tried, a LOCAL model never
reports native tool calls, coder = name||FIM; replaces `_pickNextUntriedModel`'s gather loop -- the
caller still flattens settings + supplies a getCaps wrapper, and pickNextFailoverModel/toModelSelection
are unchanged). Drops the now-unused chatThreadService imports (isLikelyCoderModelName /
KNOWN_CAPABLE_AGENTIC_PROVIDERS / FailoverCandidate type / freeTierIdOfProviderName; localProviderNames
stays). Behavior-preserving (byte-for-byte; candidate order preserved). Verification: tsgo 0; new
`test/common/modelSelectionEngine.test.ts` (15 cases) -> subset **363 -> 378 passing, 0 failing**;
adversarial 8000-run differential fuzz 0 mismatches; LIVE cdp-smoke 11/11 + atomic-edit-e2e (7B)
completes (resolveModelRuntimeCaps drives every turn). buildFailoverCandidates is byte-identical to the
escalation path proven live earlier (the cap-escalation probe), so not separately re-driven.

**Phase 2 module-split status:** the agent loop's PURE decision/selection surface is now extracted +
tested across `agentLoopDecisions` (caps/escalation/compaction; A/D/B wired), `toolCallRecognition`,
`toolSynthesisDecision` (2 fns), and `modelSelectionEngine` (2 fns). What remains is genuinely
stateful orchestration: the **AgentLoopController** (the `while` loop itself + tryEscalateModel's async
side effects), **AgentContextBuilder** (message prep + the prep cache), **AgentSessionStore** (thread
persistence), **AgentVerifier**, **AgentPlanner**. These are class/state refactors, not pure-fn
extractions; AgentLoopController is the keystone.

### Phase 2 — B1 FIXED: unparseable tool-call attempt is now an agent error (2026-06-10, FIRST behavior change)

`028e3a16ca7` -- the first DELIBERATE behavior change of the Phase 2 work (all prior commits were
behavior-preserving). A 4-agent investigation established B1's REAL manifestation (the old "exhausts the
iteration cap" comment was WRONG): a model that emits structured tool-call markup which fails to parse
(`<tool_call>{broken</tool_call>`) had the malformed text committed as its FINAL answer and the loop
exited via terminate_natural -- the agent appeared done but did nothing, recording no error
(**silent-no-op-success**). Fix: `recognizeTextToolCall` now reports `attemptedButMalformed` (+ exported
`hasStructuredToolCallMarker`) -- conservative detection (only the `<tool_call`/`<function_calls`
WRAPPER markers; standalone `<invoke>` EXCLUDED to avoid JSX/XML collisions; bare `{` not a marker;
markers QUOTED in code fences/backticks ignored). The loop now counts such an attempt toward the SAME
consecutive-tool-error cap and re-prompts (corrective feedback as a USER turn, to preserve
Anthropic/Gemini alternation); at the cap it escalates or stops honestly. Bounded (counter rises to the
cap; iteration cap is a backstop), no double-count (mutually exclusive with the post-dispatch counter),
resets on a later real tool success. Verification: tsgo 0; subset **378 -> 388 passing, 0 failing**;
adversarial review (correctness-focused) -- it surfaced 2 real issues (false positives on quoted/JSX
markers; consecutive-assistant alternation) which were FIXED (wrapper-only + code-strip detection; user
re-prompt turn). LIVE: cdp-smoke 11/11 + atomic-edit-e2e (7B) still completes -> the branch does NOT
false-fire on the normal path (the key regression check). New `b1-malformed-toolcall-probe.mjs` attempts
the positive firing path but is INCONCLUSIVE (the 7B won't emit malformed markup on demand -- capable
models round-trip it); the firing path is unit-tested + reviewed and reuses the cap/escalation machinery
proven live earlier. RESIDUAL: live-firing not driven (needs a model that emits malformed markup or a
synthetic-response test hook).

### Phase 3 — Model-agnostic provider platform (STARTED 2026-06-10)

First increment (`b6773313bee`): the 18-provider dispatch
(`electron-main/llmMessage/sendLLMMessage.impl.ts`, 0 tests -- the node runner excludes electron-main
since it imports the Anthropic/OpenAI/Gemini/Ollama SDKs) now has its PURE, SDK-free tool-call-capture +
message-format helpers extracted into node-tested `common/providerToolFormat.ts`: `buildRawToolCallObj`
(shared core), `rawToolCallObjOfParamsStr` (OpenAI-compat streaming-args JSON -> our tool format), and
`sanitizeOpenAIMessagesForEmptyContent` (the Vertex/Pollinations non-empty-content quirk). These govern
correctness across the OpenAI-compatible family (openAI/groq/deepSeek/mistral/openRouter/xAI) +
Anthropic (`rawToolCallObjOfAnthropicParams` keeps its SDK param type but delegates to the shared core).
Behavior-preserving (bodies copied byte-for-byte; adversarial byte-identity review passed). tsgo 0; new
`test/common/providerToolFormat.test.ts` (17 cases) -> subset **388 -> 405 passing, 0 failing**. LIVE:
cdp-smoke 11/11 + atomic-edit-e2e (7B) -> `sendOllamaChat` exercises the extracted sanitizer and the
edit completes (live-validated on the ollama path). REMAINING Phase 3: the SDK-typed tool-schema
builders (toAnthropicTool/toGeminiFunctionDecl/openAITools) + the per-provider request/response paths
need SDK-type extraction or a mock-fetch harness to test; per-model capability registry; llama3.x
fallback ordering; provider tool-format fixes; model-health UI; first-class OpenAI-compatible config;
native Bedrock (or label proxy-only).

Second increment (`bdd8d94e6cc`): a 4-agent audit (`.../phase3-capability-provider-audit` workflow)
found multiple real bugs in the 0-test `common/modelCapabilities.ts` registry. Added the registry test
suite (`test/common/modelCapabilities.test.ts`, 9 cases pinning the resolution contract +
unrecognized-defaults + override precedence) and FIXED the two highest-severity bugs: (1) **mixed-case
exact-match** (`modelOptions[modelName]` -> `modelOptions[modelName_]`; 'GPT-4o' used to return a
capability-less object / forced XML tool mode; common same-case path byte-identical); (2) **deepseek
reasoning inverted** (deepseek-chat/V3 advertised reasoning, deepseek-reasoner/R1 didn't; swapped the
spread bases, which differ only in reasoningCapabilities). tsgo 0; subset **405 -> 414 passing**;
adversarial high-blast-radius review = both correct/safe; LIVE 11/11 + 7B atomic-edit (registry resolves
ollama caps every turn).

Third increment (`894c7a2c42b`): FIXED the **3 last-match-wins `modelOptionsFallback` orderings**
(anthropic/openAI/xAI) -> first-match-wins (`ret(k)` + return-early). The review found this was
collapsing nearly EVERY dated variant to its broad parent (gpt-5-mini-2025->gpt-5, o3-mini->o3,
claude-opus-4-8-latest->legacy 4.0, grok-4-0709->grok-3). Required moving openAI's gpt-3.5 above the
broad gpt-5 and tightening the broad gpt-5/gpt-5.1/gpt-4.1 to precise `includes('gpt-N')` (the old
`gpt && '5'` matched a date's stray '5' -> a regression the new tests CAUGHT). tsgo 0; subset
**414 -> 418 passing** (+4 tests); adversarial old-vs-new differential (battery from out/) =
correct/safe; LIVE 11/11 + 7B atomic-edit (no agent-flow regression).

Fourth/fifth increments cleared the rest of the audit backlog:
- `ff1718a708d` -- extracted `toOpenAICompatibleTool` to `common/providerToolFormat.ts` (node-testable)
  and FIXED it to emit `paramsWithType` (OpenAI-family tool schemas now ship typed params). +3 tests.
- `31a8820143a` -- fixed the `extensiveModelOptionsFallback` llama shadowing (most-specific-first;
  'llama-3.1-8b' -> llama3.1 not 10M-ctx llama4-scout; 'maverick' -> llama4-maverick; llama3.1/3.2/3.3
  reachable). +4 tests.

**PROVIDER/CAPABILITY AUDIT BACKLOG FULLY CLEARED** (6 confirmed bugs fixed across 3 commits: mixed-case
exact-match, deepseek reasoning inversion, 3 last-match-wins fallback orderings, OpenAI tool-builder
untyped params, llama shadowing). The registry went from 0 tests to a tested golden-table contract
(modelCapabilities.test.ts) + the provider tool-format helpers are node-tested
(providerToolFormat.test.ts). cortexide node subset now **425 passing, 0 failing**; tsgo 0.
Remaining Phase 3 (NOT bugs): SDK-typed tool-schema builders (toAnthropicTool / toGeminiFunctionDecl --
need SDK-type extraction or a mock-fetch harness), per-provider request/response mock-fetch tests,
model-health UI, native Bedrock, first-class OpenAI-compatible config.

Sixth increment (`8c6ccdf39be`): extracted the **OpenAI-compatible streaming accumulator** out of
`_sendOpenAICompatibleChat`'s stream loop (the highest-value untested provider logic) into a pure,
node-testable reducer `accumulateOpenAIChatDelta` in `common/providerToolFormat.ts`. This is the core
of tool-call CAPTURE for the whole OpenAI-compatible family (openAI / groq / deepSeek / mistral /
openRouter / xAI / openAICompatible / liteLLM / lmStudio / vLLM) and had **zero tests**. The reducer
mirrors the inline logic byte-for-byte: text append; Mistral's parts-array `content` split into text vs
reasoning; the single `index===0` tool call whose name/arguments/id are CONCATENATED across deltas (the
OpenAI streaming protocol delivers `function.arguments` in fragments); dedicated reasoning-field append
(`(... || '') + ''`). The ONE defensive divergence I first introduced (optional chaining on a
type-impossible null tool-array entry, which would have turned the original's throw into a skip) was
removed so the extraction is exactly byte-identical. Verification: tsgo 0; new accumulator suite +16
(**425 -> 441 passing, 0 failing**) covering Mistral object-content, `index!=0` drop, no-index skip,
fragmented args, falsy-reasoning, purity (frozen input), and an end-to-end fragmented tool-call stream;
**500,000-case differential fuzz** (old inline ref vs the extracted reducer over random
content/tool_calls/reasoning deltas) = 0 mismatches; LIVE: cdp-smoke 11/11 + atomic-edit-e2e (7B) no
regression (the 7B agent loop uses `sendOllamaChat`, NOT this path), PLUS the reducer itself
live-validated against REAL ollama `/v1` (OpenAI-compatible) streaming chunks - the text path via
qwen2.5-coder (5 chunks -> "HELLO FROM STREAM") and the **structured `tool_calls` delta path via
llama3.2:3b** (1 tool delta -> `get_weather` / `{"city":"Tokyo"}` -> parsed `{city:"Tokyo"}`). NOTE: the
non-streaming path (`processNonStreamingResponse`, takes `toolCalls[0]`) and the Gemini/ollama/Anthropic
stream handlers were left untouched (different shapes); the trivial SDK-typed tool-schema builders
(toAnthropicTool/toGeminiFunctionDecl, ~15 lines each) are low-value and remain inline. A genuine
remaining Phase 3 item surfaced: the single-tool-call-per-turn limit is architecturally baked into the
`onFinalMessage({ ...toolCall })` contract (Gemini's `functionCalls[0]`, OpenAI's `index===0`); capturing
ALL tool calls per turn is a rippling change, deferred.

Seventh increment (`8af32b383d8`): extracted the inline **Gemini rate-limit/quota error parsing** out
of `sendGeminiChat`'s catch into a pure node-testable `formatGeminiRateLimitError` in a new
`common/providerErrorFormat.ts` (a home for provider error-message formatters, a Phase 3 robustness
theme). The Gemini error message is often a JSON string that itself wraps another JSON string under
`error.message`, with the retry hint in a `google.rpc.RetryInfo` detail (`retryDelay "57s"/"57.6s"`);
this nested-parse + retry-delay minute/second formatting + pluralization was completely untested.
Byte-identical (best-effort `JSON.parse(whole)` then a regex-extracted `{...}` block; inner-error
unwrap; code/status quota fallback; minute/second formatting; generic catch-all on throw); the call
site still does `onError({ message: formatGeminiRateLimitError(error.message), fullError: error })`.
Verification: tsgo 0; new `providerErrorFormat.test.ts` +13 (**441 -> 454 passing, 0 failing**) over all
branches (nested+RetryInfo min/sec/whole-min/singular/plural/fractional-ceil, outer-only message,
code-429 / RESOURCE_EXHAUSTED fallback, embedded-JSON-in-noise, no-JSON default, malformed-brace throw
fallback, empty); **200,000-case differential fuzz** old-vs-new = 0 mismatches; cdp-smoke 11/11 (app
boots healthy with the main-process change). The Gemini error path is CLOUD-ONLY and cannot be driven
live locally (no Gemini key; cannot force a 429) - validated by unit tests + fuzz + differential review.

### Phase 2 — AgentLoopController split BEGUN: first keystone-loop seam extracted (2026-06-11)

`13d41aa9724` -- the FIRST extraction out of the keystone 1,800-line `_runChatAgent` loop
(chatThreadService.ts:3140-4927). A read-only 6-agent **map workflow** (`map-agentloop-controller`,
journal `map-agentloop-controller-wf_e1fc80c3-656.js`) sliced the loop into 5 regions and synthesized
the safest first seam: the **excessive-file-read guard** (4716-4753) is the only remaining seam that is
genuinely pure (4 scalar inputs, 4 outcomes), tiny, and has ZERO coupling to the mutable
plan/escalation state that makes every other seam "hard". Added `decideFileReadGate` to
`common/agentLoopDecisions.ts` (section 6): `{ hasToolCall, toolName, fileReadLimitExceeded,
filesReadInQuery, maxFilesReadPerQuery } -> { action: no_tool | skip_already_exceeded | hit_limit_now |
proceed, filesReadCount, nextFilesReadInQuery, nextFileReadLimitExceeded }`. The caller keeps every side
effect (limit message, the 'LLM' `_setStreamState`, `shouldSendAnotherMessage` + `continue`) and assigns
the two next-counter values back. The off-by-one (limit fires at `>= max`, the counter increments only
on the read_file proceed path, so the max-th read is BLOCKED not performed) is PRESERVED as-is and
pinned by a test (fixing it is a separate change). Verification: tsgo 0; +9 golden-table tests
(**454 -> 463 passing, 0 failing**); **1,800-combo exhaustive differential enum** old-vs-new = 0
mismatches; **4-agent adversarial review** (control-flow / counters / side-effects + synthesis) =
behavior-preserving, 0 reachable divergences (the only flagged arm, `no_tool`, is unreachable at a call
site hardcoded to `hasToolCall:true`); LIVE cdp atomic-edit-e2e (7B) completes through the modified gate
with no false-fire.

`b5d63643aae` -- second keystone-loop seam: lifted the **safety-critical rate-limit classifier**
(chatThreadService.ts:4172-4176) out of the llmError branch into a pure `isRateLimitErrorMessage` in
`common/providerErrorFormat.ts` (alongside formatGeminiRateLimitError). It drives the `avoidFreeTier`
failover decision and MUST match the service-layer rate-limit shapes (the keyword set includes Google's
quota/resource_exhausted, which the old 429-only check missed). Byte-identical (same case-insensitive
substring chain; the call site passes raw `error.message`, the fn lowercases it). `shouldEscalateModel`
already CONSUMES `isRateLimitError` as an input, so this extracts its producer to the same tested layer.
tsgo 0; +11 tests (**463 -> 474 passing, 0 failing**); **300,000-case differential fuzz** = 0 mismatches;
cdp-smoke 11/11 + atomic-edit-e2e (7B) no regression (classifier only fires on llmError; unit+fuzz cover
the path). NOTE on the backlog below: the top HIGH lead (llmError partial-tool-call loss at ~4400) was
RE-VERIFIED in code and DOWNGRADED - it's a UX-recovery gap (the error itself IS surfaced via
`_setStreamState({ error })`; no correctness/data issue) in the documented-fragile error/failover path,
so it's deferred (not worth destabilizing that path for partial-output UX). The escalation
`nMessagesSent`-reset inconsistency (~4807) was also re-verified and judged a defensible design choice
(the iter-cap site MUST reset; the tool-error site need not), not a clear bug - deferred.

**AgentLoopController latent-bug backlog** (from the map; LEADS to re-verify in code, NOT yet fixed -
ranked by severity/fix-risk; line numbers approximate, the loop is ~3140-4927):
- HIGH: on an `llmError`, `streamState.llmInfo` is already cleared to `undefined` by the onError
  handler, so reading `toolCallSoFar` (~4400) is always null and the `interrupted_streaming_tool`
  message is never added -> partial streaming tool-call output silently lost on every streaming error.
- HIGH: `_generatePlanFromUserRequest` (~3325) is called with the raw (possibly 'auto') modelSelection
  instead of `resolvedModelSelection` (confirm the callee doesn't re-resolve before fixing).
- HIGH (metrics-only): a recomputed `promptTokens` (~3931-3961) shadows the standardized
  `_computeTokenCount` value handed to `chatLatencyAudit.markPromptAssemblyEnd` on the model-switch path.
- MED: tool-error-escalation path (~4807) does NOT reset `nMessagesSent` on a successful
  `tryEscalateModel` (the iter-cap + outer-loop escalation sites DO) -> escalated model gets a
  shorter-than-intended iteration budget. Inconsistent across the 3 escalation sites.
- MED: `modelSupportsTools` re-synthesis gate (~4473/4550) keys on `hasSynthesizedToolsInThisRequest`
  which is only set true AFTER a synthesized tool both runs AND completes; an interrupted/failed
  synthesis leaves it false -> possible re-synthesis loop.
- MED: pre-loop tool exec (~3431) destructures only `{ interrupted }` from `_runToolCall`; a tool that
  ERRORED (not interrupted) still runs the success branch and may mark a failed step completed (the
  main-loop path at ~4818 correctly inspects the tail tool-message type - the pre-loop path is the
  inconsistent twin).
- MED: plan-step null-guard gaps (~3388, ~4858), in-place plan-cache divergence (~3358), compacted-view
  cache miss (~3763). LOW: idle-interruptor promise never invokes its fn (~3232, likely dead);
  awaiting_user exit leaves isRunning set with no checkpoint (~4889, likely intentional).
Next-safest pure-fn seams for the backlog (from the map): `isRateLimitError(msg)` (4172), auto-mode
predicate (3857), fallback-chain next-model picker (4215). HARD/deferred: AgentPlanStepTracker class
(4818-4876 + pre-loop twin 3431-3483) - do AFTER the pure gates + the 4763-vs-4819 desync + pre-loop
success-branch bug are fixed, so the refactor target is correct-by-construction.

### Phase 5 — Apply engine / editing correctness STARTED (2026-06-11)

`7cce1593d27` -- FIRST Phase 5 increment. Extracted the SR ORIGINAL-block matcher `findTextInCode`
(+ its `numLinesOfStr` / `removeWhitespaceExceptNewlines` helpers, used nowhere else) from the browser
`editCodeService` into pure node-testable `common/searchReplaceMatch.ts`, and FIXED a real
silent-corruption bug: the EXACT-match path returned the first `indexOf` hit WITHOUT a uniqueness check,
so a non-unique ORIGINAL block silently edited the FIRST of several identical matches (wrong-location
edit). The whitespace-FALLBACK path already rejected non-unique; now the exact path does too, for a
whole-file (`startingAtLine === undefined`) search, using the existing graceful "must be unique" error
(`_errContentOfInvalidStr`). Positional/streaming matching (`startingAtLine` set) is unchanged. All 3
callers handle the `'Not unique'` string (main apply THROWS the descriptive error; streaming diff-area
reverts + re-prompts; stream-cursor is `startingAtLine`-gated) - and the diff-area caller could already
get `'Not unique'` from the fallback path. Verification: tsgo 0; +14 tests (**474 -> 488 passing, 0
failing**); **400,000-run differential fuzz** vs pre-fix = 28,982 divergences, ALL exactly the intended
case (startingAtLine undefined + exact + non-unique), 0 unexpected (~7% rate shows how reachable the
silent-wrong-edit was); **4-agent adversarial review**: fix correct + all callers safe; cdp atomic-edit
(7B) no regression.

`c4ee27d78ac` -- fixed a PRE-EXISTING TDZ crash the SR review surfaced (independent of the SR fix). In
the streaming/manual Fast-Apply path (`_initializeSearchAndReplaceStream` -> `runSearchReplace` ->
`onText`), the `hasOverlap` `.some()` callback referenced `startLine`/`endLine` that were `const`-declared
LATER in the same block - a temporal dead zone that threw `ReferenceError: Cannot access 'startLine'
before initialization` on the 2nd+ block of any multi-block "Apply" (when the callback actually runs).
tsgo/tsc do NOT catch TDZ. Fix: compute the block's final-range bounds (`thisBlockRange`) BEFORE the
overlap check (guarded for the error-string case); the callback uses them; the later
`const [startLine, endLine]` for the diff-area add is unchanged. Behavior preserved on the 1st block +
error-string bail; the 2nd+ block now does the INTENDED overlap check instead of crashing. Verification:
tsgo 0; 488 passing; a scope-pattern repro confirms old-order throws ReferenceError on a non-empty array
while new-order computes overlap correctly; cdp-smoke 11/11 (boot healthy). HONEST LIMIT: the multi-block
ClickApply streaming path is not node-testable and impractical to drive live with the local harness
(the agent's `edit_file` uses the INSTANT `instantlyApplySearchReplaceBlocks` path, not this streaming
one) - validated by the repro + the prior adversarial review which endorsed this exact fix. Remaining
Phase 5 (NOT done): robust multi-edit transaction (validate-all -> preview -> atomic -> rollback),
per-hunk / partial accept, streaming-diff race with final apply, apply verification (diagnostics/lint),
edit provenance, symbol-aware refactor.

### Phases 4, 6-10 — NOT STARTED
Real RAG; agentic UX; MCP/plugins; privacy hardening; CI/release; positioning. Multi-session work.

### Audit reliability note
Of the audit's headline criticals, **two were materially wrong** (secret redaction IS done +
secure-by-default; `react/src/` is the live source, not dead). Re-verify every audit claim in code
before acting on it.
