# CortexIDE Modernization — Fresh-Session Handoff

> Paste this whole file (or point the new session at it) to continue. It is self-contained.
> Companion docs in this repo: `docs/MODERNIZATION-BASELINE.md` (authoritative phase log, append-only)
> and `docs/PHASE2-WIRING-PLAN.md` (the exact next edits). Auto-memory also summarizes this.

---

## 0. Mission & role

You are the **CortexIDE modernization agent**. Goal: turn CortexIDE (a VS Code 1.118.1 fork via the
"Void" editor) into a reliable, safe, model-agnostic, **local-first** agentic editor that competes with
Cursor / Claude Code / OpenCode. Work in **strict phases**; reliability before features; no fake safety;
no silent failures; no untested agentic write paths; every dangerous action permissioned/auditable/
reversible/blocked; every user-facing claim maps to working, tested code.

**The repo you edit is the nested fork:** `/Users/tajudeentajudeen/CodeBase/cortexide/cortexide`
(the AI code lives under `src/vs/workbench/contrib/cortexide/`). The OUTER dir
`/Users/tajudeentajudeen/CodeBase/cortexide` is a wrapper — do NOT work there.

**Branch:** `modernize-agentic-editor-foundation` (off `fix/agentic-mode-cloud-failover-2026-06-05`,
~114 commits ahead of `main`, **not pushed**). Keep using it. Small commits per increment.

---

## 1. Where things stand (DONE vs TODO)

- **Phase 0 — Stop shipping broken promises: ✅ COMPLETE.** Registered the 11 hidden `cortexide.*`
  settings (pure SSOT `common/cortexideConfigKeys.ts` + now-imported `cortexideGlobalSettingsConfiguration.ts`);
  fixed false "27 tools" -> dynamic **35** (`common/builtinToolNames.ts`, compile-guarded); de-lied the 2
  comparison docs; removed 11 dead files + `common/telemetry/`; `phase0ClaimVerification.test.ts`.
- **Phase 1 — Protect user workspaces: ✅ COMPLETE + LIVE-VALIDATED.**
  - #1 atomic writes (applyEngineV2 + agent path via `ISaveOptions.atomicWrite`); live: edit persists, no temp leak.
  - #2 durable rollback (`common/agentFileOps.ts` + journal in chatThreadService); live: create-removal,
    delete-recreate-with-content, edit-restore all on disk.
  - #3 gather read-only at DISPATCH (`common/toolPermissions.ts`); live: blocks a real model-emitted write.
  - #4 terminal danger BLOCKS + cwd containment (`common/commandRisk.ts`).
  - #5 secret redaction — VERIFIED already secure-by-default (sendLLMMessageService).
  - #6 Workspace Trust at dispatch (`IWorkspaceTrustManagementService` injected).
  - Residuals (documented, not blockers): gate D untrusted-block + B/C real destructive commands not
    *driven* live (dev launch auto-trusts; won't run `rm -rf`) — same chokepoint is live-proven via gather.
- **Phase 2 — Testable agent runtime: 🔄 IN PROGRESS (wiring landed).**
  - DONE (zero-risk): `common/agentLoopDecisions.ts` (5 pure decision fns) + **57 tests**.
  - DONE (behavior-preserving + live-validated): **Edits A/D/B WIRED** — the loop now delegates the
    tool-error cap (`updateConsecutiveToolErrors`, `db1bbdb0abd`), compaction+overflow
    (`computeCompactionOverflowDecision`, `53f6a12d0c0`), and the iter-cap escalation gate
    (`shouldEscalateModel`, `cac44f0039a`). Verified by a 6-agent adversarial review (0 reachable
    divergences) + CDP live (7B happy-path completes; 1.5b thrash -> escalation fires). See
    `docs/MODERNIZATION-BASELINE.md` "Phase 2 — wiring Edits A/D/B".
  - **NEXT (own reviewed PRs):** Edit C (llmError gate), Edit E (completion routing), the
    parse-classifier (`classifyToolCallFromLLMResponse`); then the module split (AgentLoopController /
    ToolCallParser / ToolPermissionEngine / AgentPlanner / ModelSelectionEngine / AgentContextBuilder
    / AgentSessionStore / AgentVerifier). `docs/PHASE2-WIRING-PLAN.md` still holds the Edit C/E sketches.
- **Phases 3-10 — NOT STARTED.** (provider platform / RAG / apply-UX / agentic-UX / MCP+plugins /
  privacy / CI / positioning). Original spec is in section 7 below.

**Tests:** cortexide node suite **320 passing, 0 failing**. tsgo 0 errors. CDP smoke 11/11. Renderer
safety checks 26/26. Phase 2 wiring live-validated (happy path + cap/escalation).

---

## 2. Build / test / launch (verified commands — macOS)

```bash
cd /Users/tajudeentajudeen/CodeBase/cortexide/cortexide

# TYPE CHECK (the integration gate). NOTE: macOS has NO `timeout` binary — do NOT wrap with it
# (a `timeout ...` wrapper silently no-ops and you'll think it passed). Run bare:
npm run compile-check-ts-native        # tsgo --project ./src/tsconfig.json --noEmit --skipLibCheck

# TRANSPILE src -> out (needed before node tests pick up changes; ~5s):
node build/next/index.ts transpile

# NODE UNIT TESTS — cortexide subset only (avoids the multi-thousand VS Code suite):
npm run test-node -- --runGlob "vs/workbench/contrib/cortexide/test/common/*.test.js"

# REACT UI build (only if you touch browser/react/src/*.tsx):
npm run buildreact

# Per-file fast transpile for iterating on ONE new file (matches the out/ ESM format):
node_modules/.bin/esbuild <src.ts> --format=esm --sourcemap=inline --outfile=<out.js>
```

- Tests live in `test/common/` (node) — the runner EXCLUDES `test/browser/**`. Style:
  `import * as assert from 'assert'; import { suite, test } from 'mocha';` with `.js` import extensions.
- **Hygiene (husky pre-commit) blocks non-ASCII** (en/em dashes, arrows, smart quotes). Keep new files
  ASCII-only or it rejects the commit. Strip with:
  `perl -CSD -i -pe 's/[\x{2013}\x{2014}]/-/g; s/\x{2192}/->/g; s/[\x{2018}\x{2019}]/'"'"'/g; s/[\x{201C}\x{201D}]/"/g' <file>`
- `out/` and `browser/react/{src2,out}` are **gitignored** (generated). The authored React source is
  `browser/react/src/` (the audit was WRONG that it's dead — scope-tailwind generates src2 from it).
- Commit message footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

### Live launch + CDP smoke (the real-runtime validation loop)
```bash
# 1) launch the dev app in the BACKGROUND with a CDP debug port (run_in_background):
test/cortexide-smoke/launch-dev.sh 9222 /tmp/cx-ws /tmp/cx-profile
#    (CX_KEEP_TRUST=1 keeps Workspace Trust enabled; default disables it.)
# 2) poll until up:  curl -s --retry 45 --retry-delay 1 --retry-connrefused http://127.0.0.1:9222/json/version
# 3) drive via Playwright connectOverCDP. Harnesses exist:
#    test/cortexide-smoke/cdp-smoke.mjs           -> 11/11 boot/UI check
#    test/cortexide-smoke/phase1-safety-verify.mjs -> 26/26 real-module + config-registry checks
#    test/cortexide-smoke/gather-isolated-e2e.mjs  -> gather gate (fresh-convo, gather-only)
#    test/cortexide-smoke/checkpoint-rollback-e2e.mjs -> durable rollback (create/delete)
#    test/cortexide-smoke/atomic-edit-e2e.mjs      -> atomic save
# 4) kill:  pkill -9 -f "cx-<your-profile>"
```
**Launch gotchas:** the binary `.build/electron/CortexIDE.app` must exist + `out/main.js` must be
transpiled. Ollama is running locally (`qwen2.5-coder:7b` + `:latest` pulled — 7B reliably drives the
agent loop; the auto-router can land on a weak 3B, so SELECT 7B in the test). **Driving the chat:**
open with `Meta+l`; mode/model are `<button>` elements you click then pick the option; the textarea is
`win.locator('textarea').last()`; a plan shows "Approve & Execute". **CRITICAL test lesson: a checkpoint
jump (and most actions) NO-OP while the agent isRunning — wait for IDLE before clicking a checkpoint.**
The conversation PERSISTS across mode switches — use a FRESH profile/workspace per scenario to avoid
contamination. The dev CLI launch AUTO-TRUSTS the workspace (no Restricted Mode even with CX_KEEP_TRUST
+ seeded settings), so the untrusted-workspace gate can't be exercised live here.

---

## 3. The reusable pure-module toolkit (already built — REUSE these)

All in `common/`, node-unit-tested, no VS Code runtime deps (type-only imports where needed):
- `cortexideConfigKeys.ts` — SSOT for registered settings (+ claim-verification test).
- `builtinToolNames.ts` — runtime list of the 35 tools (compile-guarded exhaustive).
- `toolPermissions.ts` — `checkToolAllowedInMode(tool, chatMode, {isMCPTool, localOnly, workspaceTrusted})`
  — the dispatch permission gate + capability table. **This is the seed of the Phase 2 ToolPermissionEngine.**
- `commandRisk.ts` — `classifyCommandRisk(cmd)` (hardBlock/requiresApproval) + `cwdEscapesWorkspace`.
- `agentFileOps.ts` — durable create/delete/modify rollback (`undoAgentFileOp`, `undoFileOpsAfterCheckpoint`).
- `agentLoopDecisions.ts` — the 5 loop decisions (tool-error counter, escalation, continuation, completion,
  compaction). **NEXT: wire the loop to call these.**
- Pre-existing pure helpers also reusable: `routing/modelFailover.ts`, `routing/codingModelScore.ts`,
  `routing/simpleQuestionGate.ts`, `parseJsonToolCall.ts`, `compactionPolicy.ts`.

---

## 4. IMMEDIATE next work — Phase 2 (Edits A/D/B DONE; C/E + classifier + split remain)

Edits A, D, B from **`docs/PHASE2-WIRING-PLAN.md`** are LANDED, behavior-preserving (6-agent
adversarial review: 0 reachable divergences), and live-validated (7B happy path completes; 1.5b
thrash escalates). Commits `db1bbdb0abd` (A) / `53f6a12d0c0` (D) / `cac44f0039a` (B).

Remaining Phase 2, each its own reviewed PR (tsgo 0 + live-validate; highest risk last):
1. **Edit C** (llmError escalation gate, ~4344-4382) -> `shouldEscalateModel('llmError')`. CARE:
   `autoFallbackExhausted` must reflect the final `nextModel` state after the auto-fallback chain
   (4168-4332); `nextModel` scope at the escalation site. Keep the retry block (4344-4359) verbatim.
2. **Edit E** (completion routing, ~4730-4892 + synth gates) -> `classifyCompletionState`. Do in two
   steps: first add a dev-only assertion that the pure fn AGREES with the existing inline branch
   across real tasks, then flip control flow. Don't convert `await-user` into a `continue`.
3. **Parse-classifier** (function #6, `classifyToolCallFromLLMResponse`) — its own PR (densest
   heuristics + injected callbacks). This is where to DELIBERATELY fix latent bug **B1** (unparseable
   tool call should be an agent error hitting the tool-error cap, not silently exhausting the iteration
   cap) — but ONLY after the behavior-preserving wiring above is stable, and as a separate, tested change.
Then the larger **module split** (AgentLoopController / ToolCallParser / ToolPermissionEngine /
AgentPlanner / ModelSelectionEngine / AgentContextBuilder / AgentSessionStore / AgentVerifier) per
section 7. New reusable live harness: `test/cortexide-smoke/phase2-cap-escalation-probe.mjs`.

**Mandatory behaviors for the agent runtime (from the spec):** an unparseable tool call IS an agent
error (today it's the latent bug B1 — gibberish exhausts the iteration cap, not the tool-error cap; fix
this DELIBERATELY in a separate commit, not during the behavior-preserving wiring); attempt_completion
must not hide failed tools; completion only after tools/verification finish; distinguish model-failed /
tool-failed / permission-denied / user-cancelled / context-overflow / provider-unavailable /
local-model-missing / workspace-unsafe.

---

## 5. Audit-corrections (the original audit had errors — don't repeat them)

The big audit (`docs/` + memory `project_audit_2026_06`) is a LEAD, not ground truth. Re-verify in code.
Confirmed-WRONG audit claims: (a) `react/src/` is NOT dead — it's the authored source; (b) secret
redaction IS implemented + secure-by-default; (c) `common/diffComposerAudit.ts` is LIVE (composerPanel);
(d) real tool count is 35, not 27/17. Confirmed-correct criticals that Phase 1 already FIXED: non-atomic
writes, gather bypass, fake rollback, terminal danger-no-block, cwd. Still-open audit items for later
phases: tree-sitter RAG dead, embeddings never activate, no next-edit Tab, autocomplete off by default,
provider/router untested, Bedrock proxy-only, MCP image/headers broken, etc. (see the audit / section 7).

---

## 6. Mandatory implementation rules (follow exactly)

1. No huge unreviewable rewrites; small commits per phase/subsystem. 2. Every critical fix + safety claim
needs tests. 3. Investigate every failing test. 4. Don't delete/break working features unless replacing
safely. 5. Don't break local-model or existing-provider support. 6. Don't silently remove user settings.
7. Don't introduce telemetry; don't log secrets. 8. Docs are NOT evidence of implementation. 9. No TODOs
in safety-critical paths. 10. Don't mark a phase complete unless its Definition of Done is met. 11. If a
task is too large, do the safest minimum + document what remains. 12. For risky core changes, live-validate
via the CDP loop; revert if it destabilizes. 13. Under ultracode (if on), use the Workflow tool to design
each phase (understand -> design -> implement -> review), staying in the loop between workflows.

---

## 7. Original Phase spec (Phases 2-10) — the source of truth for scope

(Condensed; the user's full 10-phase brief is the authority. Per-phase: Goals / Tasks / Files / Tests / DoD.)

- **Phase 2 — Testable agent runtime:** split the 6,217-line `chatThreadService.ts` into tested units:
  AgentLoopController, ToolCallParser, ToolPermissionEngine, AgentPlanner, ModelSelectionEngine,
  AgentContextBuilder, AgentSessionStore, AgentVerifier. (Pure decisions already extracted — wire then split.)
- **Phase 3 — Model-agnostic provider platform:** central capability registry (per-model: ctx, max-out,
  streaming, native/parallel tools, vision, reasoning, JSON, FIM, embeddings, local, privacy, tool-format,
  pricing, creds, health-check). Fix llama3.x fallback ordering; correct tool-call formats for
  groq/deepseek/mistral/openRouter; capture ALL tool calls per turn; **mock-fetch tests for all 18 adapters**;
  model-health UI; native Bedrock (or label proxy-only); first-class OpenAI-compatible (base URL/headers/
  caps override); local warmup/latency/missing-model guidance.
- **Phase 4 — Real RAG:** fix tree-sitter (wrong API today -> dead); real symbol extraction; keep BM25; add
  embeddings ONLY when a provider is configured (local via Ollama); don't enable empty vector store; hybrid
  retrieval (BM25+vector+symbols+recency+open-files+deps+diagnostics); multi-root; ignore rules; indexing
  UX (progress/pause/resume/cancel/caps/stale); citations (file+line); fix query-codebase broken-URI bug.
- **Phase 5 — Apply engine + editing UX:** SR uniqueness (reject non-unique, ask for more context); robust
  multi-edit transaction (validate-all -> preview -> atomic -> rollback); test per-hunk + partial accept;
  streaming-diff must not race final apply; targeted patching for large files; apply verification
  (diagnostics/lint/tests); UI states; edit provenance; symbol-aware project refactor.
- **Phase 6 — Agentic UX:** visible agent timeline; real Plan mode (read-only -> approve -> build);
  session tabs (revive dead `ChatTabsBar`); **next-edit Tab prediction** + autocomplete-on-by-default +
  auto FIM model; Ctrl+K upgrade (@-mentions/diagnostics/rules/multi-file/preview); fix-failing-tests loop;
  real code review (BugBot-class); durable background agents; real subagents/agent-teams; Skills
  (`.cortexide/skills/<name>/SKILL.md` + slash commands).
- **Phase 7 — MCP/tools/plugins:** fix MCP headers/auth, image/audio/resource (Playwright screenshots),
  deterministic tool-name prefixes, schema fidelity, result truncation, resources/prompts; MCP permission
  UI; custom tool/plugin API (manifest/command/HTTP/JS) with permissions + schema validation.
- **Phase 8 — Local-first privacy + enterprise:** real local-only mode (block cloud/web/remote-MCP/
  telemetry/remote-catalog/external-image-PDF); "what data left my machine" report; telemetry opt-IN;
  wire RedactingLogService; audit-log UI + export; prompt-injection hardening (delimit untrusted content,
  canaries); SSRF DNS-rebind protection. Tests: local-only blocks every outbound; injection can't enable a
  write tool in read-only mode; SSRF blocked.
- **Phase 9 — Build/CI/release:** CI (typecheck/unit/browser/provider-mock/agent-loop/apply/MCP/packaging);
  CDP smoke in CI; mac/win/linux packaging smoke; fix Windows branding (`win32NameVersion='Microsoft Code
  OSS'`, `serverApplicationName='code-server-oss'`); regression tests for known bugs; release checklist.
- **Phase 10 — Positioning:** "open-source, local-first, model-agnostic agentic editor." Only claim what's
  tested. Update README/website/model-table/privacy/security/local-model/MCP/agent/troubleshooting/release-notes.

**After each phase, report:** Summary / Files changed / Tests added / Tests run (cmd+result) / Safety
impact / Remaining risk / User-visible changes / Next phase.

---

## 8. First actions for the fresh session

1. `cd /Users/tajudeentajudeen/CodeBase/cortexide/cortexide && git status` (expect clean, on
   `modernize-agentic-editor-foundation`) and `git log --oneline -8`.
2. Read `docs/MODERNIZATION-BASELINE.md` (phase log) + `docs/PHASE2-WIRING-PLAN.md` (next edits).
3. Confirm baseline green: `npm run compile-check-ts-native` (0 errors) and
   `npm run test-node -- --runGlob "vs/workbench/contrib/cortexide/test/common/*.test.js"` (320 passing).
4. Execute Phase 2 wiring Edit A, then D, then B (one commit each, tsgo + live check between).
5. Then continue per section 7. Pushing/PR is the user's call (nothing pushed yet).
