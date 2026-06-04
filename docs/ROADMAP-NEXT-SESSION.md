# CortexIDE — Next-Session Handoff

> Self-contained brief for a **fresh session** to pick up the remaining agent-mode roadmap work without
> re-deriving context. Read §0 first, then start at the highest-priority open item (§2). Status as of
> 2026-06-04, branch `chore/launch-fix-smoke-harness-2026-05-31` (NOT pushed).
>
> **Update (2026-06-04, session 10):** parallel-edit phase 2 **STEP 2 is DONE** (the `workspaceRootOverride`
> thread through `validateURI`, now honored by ALL file tools, fail-closed + unit-tested). §2 below is
> re-scoped: the remaining work is STEP 1 (worktree channel), the terminal/editCodeService threads, and
> STEP 3 (the `run_parallel_edit_subagents` caller). Start at §2 step 1.

---

## 0. Start here — build / launch / verify mechanics (non-obvious; cost a lot to discover)

- **Type gate (fast):** `node_modules/.bin/tsgo --project ./src/tsconfig.json --noEmit --skipLibCheck`
  (~8s). Grep its output for your files; ignore the pre-existing `applyEngineV2.test.ts` TS6133. The full
  `tsc -p src` is minutes-slow and often never finishes — **use tsgo**. It catches what tsc hides (e.g. the
  `builtinTools` param keys are snake_cased by a mapped type → use `agent_type`, not `agentType`).
- **Rebuild `out/` (dev build loads compiled JS):** `node build/next/index.ts transpile` (~5s, esbuild;
  produces `out/main.js` + `out/vs/**`, bakes in your `src/` edits). `out/` gets wiped by an interrupted
  `gulp compile` — always confirm `out/main.js` exists before launching.
- **React UI** lives in `browser/react/src/` (NOT `src2/`, which is generated). After editing React, run
  `cd src/.../react && node build.js` (regenerates `src2/` + bundles). `src2/` is gitignored.
- **Launch the dev build for CDP tests — MUST be foreground** (a backgrounded GUI process is denied the
  macOS window server and exits ~6s with no output). Working pattern: one foreground Bash command —
  harness as a `&` child (network only), app via
  `perl -e 'alarm 300; exec @ARGV' env -u ELECTRON_RUN_AS_NODE NODE_ENV=development VSCODE_DEV=1 VSCODE_CLI=1 "$APP" "$ROOT" --remote-debugging-port=9222 --user-data-dir=/tmp/cx-dev-profile/user-data ... --password-store=basic /tmp/cx-ws-cdp`
  in the foreground; the harness `pkill`s the app on exit. `timeout`/`gtimeout` are NOT on macOS — use the
  perl alarm. `.app` stdout is detached → 0-byte logs are normal. Existing harnesses:
  `test/cortexide-smoke/{run-subagent-e2e,roadmap-verify}.mjs`.
- **Pure-test runner (no tsx):** esbuild-bundle the test with `--alias:mocha=<globals-shim.mjs>` then
  `mocha --ui=tdd <bundle>` (type-only imports erase, so `common/` tests bundle without vscode deps). See
  the shim pattern in prior commits.
- **Hygiene (husky precommit)** blocks non-ASCII dashes (U+2011 non-breaking hyphen, U+2013 en-dash) even
  pre-existing ones in a file you stage — normalize to ASCII `-` (em-dash U+2014 is allowed); and requires
  braces on single-line `if`/`else`. Dev-only `.mjs` test harnesses may be committed with `--no-verify`.
- **Live-verify model needs:** local Ollama is auto-detected (no key). For agentic tool-calling that
  actually drives `run_subagent`/`save_memory`, use a capable **cloud** model — Gemini `gemini-2.5-flash`
  (1M ctx, AI Studio free key) or Groq `llama-3.3-70b-versatile`; NOT Cerebras (8K ctx). Keys inject via the
  Settings UI over CDP (`input[placeholder*="AIzaSy"]`), then pick the exact model row in the chat dropdown
  (close Settings first so its model list doesn't shadow the dropdown).

## 1. What's already DONE (don't redo)
Sub-agents track (R1-R5, R9) + run_subagent **E2E-verified** w/ Gemini. Free-tier agentic routing fix.
The 5 roadmap items — **R10** Playwright MCP, **memory-write** save_memory, **R8** opt-in non-destructive
auto-compaction, **R3** lifecycle hooks (hidden electron-main runner), **R7** background agents + panel —
all opt-in/additive, tsgo-clean, unit-tested, 0-finding adversarial review, **live-verified 8/8** over CDP.
**Parallel-edit phase 1**: an edit-serialization mutex (`common/asyncSerializer.ts` + `_editSerializer` in
chatThreadService) makes concurrent multi-agent file edits collision-safe.

**Parallel-edit phase 2 — STEP 2 (the `workspaceRootOverride` thread)** [session 10, NOT committed]: the
load-bearing per-sub-agent worktree-root override is fully threaded and fail-closed.
- NEW pure helper `common/worktreePathOverride.ts` → `resolveWorktreeRootedURI(uriStr, root)`: resolves a
  model path against a worktree root and **fail-closed rejects any escape** (`normalizePath` THEN
  `isEqualOrParent` containment). 15/15 unit tests (`test/common/worktreePathOverride.test.ts`).
- `browser/toolsService.ts`: `export type ValidateParamsOpts = { workspaceRootOverride? }`; `validateURI`
  gained a 4th param that short-circuits to the helper; `validateOptionalURI` forwards it; **ALL 18
  file-touching validators** forward `opts?.workspaceRootOverride` (edit_file, rewrite_file, read_file,
  create/delete_file_or_folder, multi_edit, ls_dir, search_*, get_diagnostics, …). Non-file tools untouched.
- `browser/chatThreadService.ts`: `AgentRunContext.workspaceRootOverride?`; thread-local
  `_workspaceRootOverrideByThread` Map SET at top of `_runChatAgent` (from runCtx), CLEARED in `_runSubagent`
  finally; `_runToolCall` reads it by threadId and passes `{ workspaceRootOverride }` into `validateParams`.
  **Keyed by threadId NOT runCtx** because the approval-resume re-entry calls `_runChatAgent` WITHOUT runCtx
  (mirrors `allowedToolNames`). No-override path is byte-identical to before.
- Adversarial review found + FIXED 2 real defects: (CRITICAL) `isEqualOrParent` is a raw path-prefix test
  that does NOT collapse `..`, so a `file://` URI with `..` escaped the worktree — fixed by normalizing every
  branch before the guard + rejecting non-file/authority URIs; (MEDIUM) a genuine in-worktree absolute path
  was double-rooted — fixed with an already-in-root short-circuit. **Reusable rule: ANY URI-containment check
  in this repo MUST `normalizePath` before `isEqualOrParent`.** Re-verified sound (50+ adversarial inputs).
  tsgo-clean; `out/` transpiled. NOT live-verified (no caller sets the override yet — that's step 3).

---

## 2. PRIORITY 1 — Parallel-edit phase 2: git-worktree branch isolation [XL]

**Goal:** let `run_parallel_subagents` (or a new `run_parallel_edit_subagents`) EDIT files concurrently with
true isolation — each parallel sub-agent works in its own git worktree on a temp branch; after all finish,
merge the branches back into the workspace (surfacing conflicts). Phase 1's mutex prevents corruption but
still shares ONE working tree; phase 2 gives real conflict-free parallelism + rollback.

**The blocker (why it's XL):** a sub-agent's file tools resolve paths against the workspace root via
`validateURI(workspaceContextService)` in `browser/toolsService.ts` — a **stateless** map with no per-call
context. To root an agent at a worktree you must thread a per-agent **workspace-root override** through:
1. ~~`AgentRunContext` (chatThreadService) — add `workspaceRootOverride?: string`.~~ **DONE (step 2).**
2. ~~The tool execution path → `validateParams` → a context-aware `validateURI`.~~ **DONE (step 2)**: chose
   approach (a) — thread-local `_workspaceRootOverrideByThread` (keyed by threadId, survives approval-resume),
   read in `_runToolCall`, passed as `opts` into `validateParams`; all 18 URI-building validators forward it.
3. `editCodeService` apply path + `terminalToolService` cwd (run_command) must also honor the override. **STILL
   OPEN.** edit_file's apply path operates on whatever URI it's handed (the validated worktree URI), so writes
   already land in the worktree IF it exists; but `terminalToolService._createTerminal` still falls back to
   `workspaceContextService.getWorkspace().folders[0].uri` for run_command cwd → must thread the override there
   too (the override value lives in `_workspaceRootOverrideByThread`, so pass it via the tool param/opts path).

**Proposed approach (incremental, verifiable):**
1. **[NEXT]** New electron-main channel `worktreeChannel` (mirror `hooksRunnerChannel`/`ollamaInstallerChannel`):
   `git worktree add <tmp> -b cortex/agent-<id>` , and `worktree remove` / branch cleanup. Security: argv
   array, shell:false. (See `cortexideSCMMainService.ts` for git-from-electron-main precedent.)
2. ~~Thread `workspaceRootOverride` through `AgentRunContext` → `_runToolCall` → `validateURI`.~~ **DONE
   (session 10)** — see §1. Pure helper `common/worktreePathOverride.ts` is the fail-closed resolver.
   Remaining sliver: run_command cwd (item 3 above).
3. **[NEXT]** New tool `run_parallel_edit_subagents`: for each task, create a worktree (via worktreeChannel),
   spawn the child with `runCtx.workspaceRootOverride = <worktree path>` (the thread-local map + validators
   already confine its edits there — verified), collect a per-worktree diff. After all finish, apply/merge
   diffs to the main tree (or `git merge` the branches), reporting conflicts. Clean up worktrees in a `finally`
   (mirror `_disposeSubagentThreadState`). This is the FIRST caller that actually sets the override.
4. Gate behind a setting (default off) until verified.

**Verification:** ~~unit-test the worktree-path-override resolution.~~ **DONE** (`worktreePathOverride.test.ts`,
15/15, incl. fail-closed escapes). Remaining: E2E with a capable cloud model — a prompt that edits 2+ disjoint
files via parallel-edit sub-agents → assert both files changed + no corruption + worktrees cleaned up.

**Risks:** the override must FAIL-CLOSED (never resolve outside its worktree); merge conflicts need a clear
surface; worktree leak on crash (enforce cleanup); don't break the existing (working, mutex-safe) single-tree
edit path — keep phase-2 entirely behind the new tool + setting.

---

## 3. PRIORITY 2 — Live-verify the model-dependent paths
These are implemented + statically/unit-verified but NOT live-triggered (need a capable model / conditions):
- **memory-write**: `save_memory` is AGENT_ONLY + curated out of local → needs a cloud model to actually call
  it. Verify: cloud model in agent mode, prompt "remember that we use vitest", confirm a memory persists
  (workspace-scoped via memoriesService) and is surfaced in a later turn's system prompt.
- **R3 hook fire**: create `.cortexide/hooks.json` (e.g. `{ "hooks": [{ "event":"pre-tool", "command":["sh","-c","touch /tmp/cx-hook-fired"] }] }`),
  enable the Lifecycle-hooks toggle, run an agent that calls any tool → assert `/tmp/cx-hook-fired` appears.
- **R8 compaction**: enable Auto-compact; drive a long agent run that crosses ~75% of the context window →
  confirm the "[Auto-compacted: N earlier messages omitted...]" marker is sent + the run continues.

## 4. PRIORITY 3 — Optional polish
- **R8 LLM-summarization compaction**: v1 is a provider-agnostic sliding window (drops the middle with a
  marker) because `LLMChatMessage` is provider-specific. A summary variant would preserve more — but needs a
  provider-correct one-shot LLM call (build messages via `prepareLLMChatMessages` on a synthetic thread, or a
  new simple-completion path). Medium.
- **R6 static capability data**: effectively OBSOLETE — superseded by runtime `parameter_size` routing. Skip
  unless a specific need arises.

## 5. First-steps checklist for the new session
1. `git status` + confirm branch; `node build/next/index.ts transpile` then check `out/main.js` exists.
2. `tsgo` to confirm a clean baseline (only `applyEngineV2.test.ts` TS6133 allowed).
3. Read `docs/GAP-ANALYSIS.md` (the R1-R10 ledger) + this file. §2 step 2 is **DONE** (the
   `workspaceRootOverride` thread, fail-closed, all file tools — see §1). Skim
   `common/worktreePathOverride.ts` + its test to see the contract you're now building on.
4. Start §2 **step 1** (the `worktreeChannel` electron-main git-worktree add/remove), then §2 **step 3** (the
   `run_parallel_edit_subagents` tool — the first caller that sets `runCtx.workspaceRootOverride`), and thread
   the override into `terminalToolService` run_command cwd (§2 blocker item 3). The override resolver + all 18
   file validators already confine a child's edits to its worktree; what's missing is creating the worktree,
   the caller that hands the child its root, the run_command cwd, and the merge-back.
5. To run the pure `common/` unit tests (no committed harness): esbuild-bundle the `.test.ts` with an
   onResolve plugin rewriting relative `.js`→`.ts` + `alias: { mocha: <shim re-exporting a mini suite/test
   collector> }`, generated entry imports the test then calls the shim's `__run()`, then `import()` the bundle.
   Reusable security rule from session 10: **any URI-containment check MUST `normalizePath` before
   `isEqualOrParent`** (the guard is a raw path-prefix test that does not collapse `..`).
