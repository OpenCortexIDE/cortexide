# CortexIDE — Competitive Gap Analysis (2026-05-31)

Honest comparison of **CortexIDE** vs **Cursor**, **Claude Code**, and **OpenCode**.

- **CortexIDE** entries are **code-verified** from `src/vs/workbench/contrib/cortexide/`
  (file presence, line counts, and reading the implementations) — not marketing. Where a
  claim is about *quality* rather than *existence*, it says so.
- **Competitor** entries are from public docs / changelogs / reviews (May 2026). Sources
  at the bottom.

CortexIDE is a VS Code 1.118.1 fork. Its mission — the thing **none** of the three
competitors offer — is **strong AI out of the box on free models, zero setup**: a built-in
free-tier router that needs no paid plan (cerebras → groq → gemini → openRouter → mistral,
quality-ranked, auto-fallover on HTTP 429). That is the north star; gaps below are
prioritized by how much they help a user with **no API budget**.

Legend: ✅ present (verified) · 🟡 partial / basic · ❌ absent · ❓ unverified

---

## 1. Models & "out of the box" experience  ← CortexIDE's moat

| Capability | CortexIDE | Cursor | Claude Code | OpenCode |
|---|---|---|---|---|
| Free models, **no key / no login** | ✅ free-tier ladder (`common/routing/`): cerebras 100 > groq 80 > gemini 60 > openRouter 40 > mistral 30, ranked, 429-fallover | ❌ paid plan | ❌ Anthropic billing | 🟡 BYO keys or GitHub/OpenAI login |
| Local models (Ollama/vLLM/LM Studio) | ✅ `modelCapabilities.ts`, `localSetupService.ts`, `ollamaInstallerService.ts` | 🟡 limited | ❌ | ✅ |
| Multi-provider router | ✅ `modelRouter.ts` + adaptive router | ✅ Claude/GPT/Gemini/DeepSeek | ❌ Claude only | ✅ 75+ (models.dev) |
| Per-feature model selection | ✅ `cortexideSettingsTypes.ts` (Chat/Autocomplete/Ctrl+K/Apply/SCM…) | 🟡 | ❌ | 🟡 |
| Privacy / offline mode | ✅ `offlinePrivacyGate.ts` + privacy gate in ladder | ❌ | ❌ | 🟡 (no code retention) |
| First-run express setup | ✅ onboarding "Express Setup" auto-configures free models | 🟡 sign-in | 🟡 auth | 🟡 login/config |

## 2. Agentic coding

| Capability | CortexIDE | Cursor | Claude Code | OpenCode |
|---|---|---|---|---|
| Agent loop | ✅ `chatThreadService.ts` (~5.6k LOC) | ✅ Agent Mode | ✅ core | ✅ |
| Tool set | ✅ ~32 tools incl. read/edit/multi_edit/grep_search/glob_files/run_command/get_diagnostics/web_search/browse_url/todo_write/attempt_completion (`toolsServiceTypes.ts`) | ✅ | ✅ read/edit/bash/grep/glob | ✅ |
| Chat modes | ✅ `normal` / `gather` / `agent` / `plan` (more than Cursor's ask/agent) | 🟡 ask/agent | ✅ plan mode | 🟡 |
| LSP refactor tools (rename/extract/defs/refs) | ✅ in `toolsService.ts` (rename_symbol, extract_function, go_to_definition, find_references) — ⚠️ extract_function has an indentation bug (see TEST-STATUS) | ✅ | 🟡 | ✅ auto-loads LSPs |
| Subagents | ❌ | 🟡 | ✅ subagents | 🟡 multi-session |
| Background / cloud agents | ❌ **(gap)** | ✅ Cloud Agents → PRs | ✅ background tasks | 🟡 multi-session |
| Parallel agents / worktrees | ❌ **(gap)** | ✅ up to 8 + Mission Control | 🟡 | ✅ parallel sessions |
| Tool approval / sandbox | 🟡 approval categories (edits/terminal/MCP) + SSRF guard; no classifier-sandbox | ✅ auto-review + sandbox classifier | ✅ permissions | 🟡 |
| MCP client | ✅ `mcpService.ts` (reads mcp.json; Electron-only, web build disabled) | ✅ (~40-tool ceiling) | ✅ | ✅ |
| Hooks | ❓ not found | ❌ | ✅ | ❓ |

## 3. Editing & code intelligence

| Capability | CortexIDE | Cursor | Claude Code | OpenCode |
|---|---|---|---|---|
| Tab / FIM autocomplete | 🟡 `autocompleteService.ts` (~1.2k LOC, 'autotab' FIM, LRU cache) — **no next-edit-prediction / cursor-jump**, quality depends on routed model | ✅ best-in-class purpose-built Tab | ❌ | 🟡 |
| Inline quick edit (Ctrl+K) | ✅ `quickEditActions.ts` | ✅ | 🟡 | 🟡 |
| Multi-file apply / composer | ✅ `editCodeService.ts` (~2.6k LOC) + `applyEngineV2.ts`; `multi_edit` atomic | ✅ Composer | ✅ | ✅ |
| Diff review accept/reject | ✅ command-bar diff nav | ✅ | 🟡 | 🟡 |
| Atomic apply + rollback | ✅ `applyEngineV2.ts` + `rollbackSnapshotService.ts` + `gitAutoStashService.ts` + `editRiskScoringService.ts` (pre-apply risk score) — ⚠️ engine only tested via a flaky self-mock (TEST-STATUS) | ❓ | ✅ checkpoints | 🟡 |

## 4. Context & knowledge

| Capability | CortexIDE | Cursor | Claude Code | OpenCode |
|---|---|---|---|---|
| Codebase indexing / RAG | ✅ `repoIndexerService.ts` (~2.6k LOC, hybrid BM25+vector), `treeSitterService.ts` (AST), `vectorStore.ts` (Qdrant/Chroma/NoOp), incremental rebuild | ✅ remote embeddings | 🟡 agentic search | 🟡 |
| @-mentions | 🟡 File / CodeSelection / Folder + symbol search; **no @Git / @Docs / @Web mentions** | ✅ full @-menu | ✅ | 🟡 |
| Rules (.cursorrules equiv) | ✅ `cortexideRulesService.ts` — `.cortexide/rules/*.md`, glob scoping, FS-watched (.md not .mdc; 2 rule types) | ✅ `.cursor/rules/*.mdc` | ✅ CLAUDE.md | 🟡 |
| Persistent memory | ✅ `memoriesService.ts` | 🟡 | ✅ CLAUDE.md | 🟡 |
| Vision / image / PDF input | ✅ `imageQA/`, `pdfService.ts` | ✅ | ✅ | 🟡 |

## 5. Workflow, review & safety

| Capability | CortexIDE | Cursor | Claude Code | OpenCode |
|---|---|---|---|---|
| AI code review | 🟡 `codeReviewService.ts` (in-editor, not a PR bot) | ✅ BugBot (PR reviewer) | 🟡 | ❓ |
| AI commit messages | ✅ `cortexideSCMService.ts` | 🟡 | 🟡 | ❓ |
| Web search / browse tools | ✅ `web_search`, `browse_url` — **now SSRF-guarded** (`assertNotSSRF`) | 🟡 fetch | 🟡 | ❓ |
| Secret redaction (logs/requests) | ✅ `secretDetection.ts` — **fixed this session** to catch `sk-proj-*` keys + long GitHub tokens | ❓ | ✅ | 🟡 |
| Audit log | ✅ `auditLogService.ts` | ❓ | ❓ | ❓ |
| Session sharing | ❌ **(gap)** | 🟡 canvases | ❌ | ✅ share links |
| Open source | ✅ (fork) | ❌ | ❌ | ✅ |

---

## Where CortexIDE already wins
1. **Free models out of the box** — unique. The keyless free-tier ladder is the single
   biggest differentiator for developers who can't afford tokens.
2. **Open source** + full local-model story (Ollama auto-install).
3. **Breadth in one editor**: agent + Tab + Ctrl+K + composer + hybrid RAG + rules +
   memories + commit-AI + audit log + 4 chat modes.
4. **Safety primitives competitors rarely expose**: audit log, rollback/auto-stash,
   pre-apply risk scoring, secret redaction, SSRF guard, offline/privacy gate.

## Top gaps (ranked by impact for the zero-budget user)
| # | Gap | Why it matters |
|---|---|---|
| G1 | **Reliability of the free-tier path itself** (429 handling, provider health, "which free model am I on" UX, graceful all-quota-exhausted state) | This IS the product; if the free router stalls the whole value prop breaks |
| G2 | **Apply-engine real-test coverage** (currently a flaky self-mock) | Multi-file edits must never lose/corrupt code |
| G3 | **Agent quality on weak/free models** (prompts + tool-loop tuned for small models, tight token budgets) | Free models are smaller; the agent must stay useful |
| G4 | **Sandboxed / classifier-gated tool approval** for `run_command` | A free-tier agent running shell needs guardrails |
| G5 | Tab quality: next-edit-prediction / cursor-jump | Cursor's biggest day-to-day edge |
| G6 | Background / parallel agents (worktrees) | productivity; lower priority for budget users |
| G7 | Session sharing; hooks; PR-review bot | collaboration & extensibility |

---

## Implementation Plan — closing all gaps (added 2026-06-03)

Derived from a multi-agent research pass (Cursor / Claude Code / Cline / Roo / Copilot, current
docs) + a fresh code map of CortexIDE's agent loop. The **decisive missing area is multi-agent**:
verified *zero* sub-agents, orchestrator/delegation, parallel agents, background agents, or lifecycle
hooks. Everything below is sequenced so the one keystone refactor unblocks the whole multi-agent set.

Effort: **S** ≈ <½ day · **M** ≈ 1–2 days · **L** ≈ 3–5 days · **XL** ≈ multi-week.
Status: 🔨 in progress · ⬜ planned · ✅ done this session.

### The keystone (do first — unblocks everything multi-agent)
- **R1 · `AgentRunContext` refactor of the agent loop · L · 🔨 in progress.**
  `_runChatAgent` ([chatThreadService.ts:2643](../src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts#L2643))
  read the chat mode from global settings, so a child agent couldn't have its own mode/tools/model
  while the parent runs. Thread an explicit `AgentRunContext { chatModeOverride, allowedToolNames?,
  modelSelection, systemPromptOverride?, isSubagent?, parentThreadId? }`; all existing call sites pass
  a default built from current globals → **zero behavior change** for normal chat. Invisible to users
  but it de-risks sub-agents, custom agents, parallel, and background agents.

### High-impact gaps
- **R2 · Sub-agents (`run_subagent`) · M · ⬜.** *(the headline ask)* New AGENT-ONLY builtin tool
  (excluded from `COMPACT_LOCAL_TOOLSET` so weak local models don't spawn). Dispatched **inside**
  `_runToolCall` ([chatThreadService.ts:2479](../src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts#L2479))
  — NOT in `toolsService` (no `IChatThreadService` dep → would be a DI cycle). It creates a hidden
  ephemeral child thread, seeds it with **only** the `prompt` string (clean context), re-enters
  `_runChatAgent` with the child's `runCtx`, and returns **only** the child's `attempt_completion`
  summary to the parent. No-nesting enforced at the dispatch (reject `run_subagent` when
  `isSubagent`). See the full design below.
- **R3 · Lifecycle hooks (PreToolUse / PostToolUse) · M · ⬜.** Single chokepoint already exists:
  `_runToolCall` ([:2255](../src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts#L2255)).
  Fire a Pre hook before execution (exec the hook cmd via `terminalToolService`, tool name+params as
  JSON on stdin; non-zero exit → recoverable `tool_error` the model self-corrects from, reusing the
  curation-throw machinery), and a Post hook after. Config in `.cortexide/hooks.json` via a new
  `cortexideHooksService` modeled on `cortexideRulesService`. Deterministic gating = the trust
  primitive that makes unattended/background runs safe.
- **R6 · Terminal allowlist + safety classifier for `run_command` · M · ⬜.** `run_command` is
  unsandboxed (60s timeout only). Generalize the terminal-approval block
  ([:2317-2341](../src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts#L2317), currently
  only `run_nl_command`) to all terminal tools: user-editable allowlist + deny-pattern list in
  settings, and route the existing `editRiskScoringService` classifier over shell commands. Also
  **never auto-approve operations on `.git`/`.cortexide`** even under YOLO. (OS-level FS/network
  sandbox is a later **L**, platform-specific.)
- **R5 · Read-only parallel fan-out · M · ⬜.** Once R2 exists, let the orchestrator spawn several
  sub-agents restricted to the read/gather toolset and `Promise.all` them — safe (read tools don't
  touch `editCodeService`/checkpoints). Parallel **editing** is deferred to git-worktree isolation
  (**XL**) because `editCodeService` applies to live in-memory models.

### Medium-impact gaps
- **R4 · Custom agents from `.cortexide/agents/*.md` · M · ⬜.** New `cortexideAgentsService`
  (mirror `cortexideRulesService`): parse YAML frontmatter → `{name, description, systemPrompt,
  allowedTools[], model, permissionMode}`. These become `run_subagent`'s `agent_type` values and
  feed the exact same `runCtx` the R1 refactor introduces — build the context object once, get both.
- **R7 · Local background agents + "Running agents" panel · M · ⬜.** A background run = an ephemeral
  thread whose `streamState` isn't the visible thread's, surfaced in a small panel with pause/abort
  (reuse `abortRunning`/`pauseAgentExecution`). Builds directly on R1. (Cloud/PR-opening agents are
  XL and out of scope for an IDE-only product.)
- **R8 · Automatic context compaction · M · ⬜.** Today there's only a 70%-full warning
  ([:3124-3145](../src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts#L3124)). At a token
  threshold, summarize older turns via an LLM pass and substitute a synthetic summary before
  `prepareLLMChatMessages`; keep recent N turns verbatim; offer a manual "Summarize up to here".
- **R9 · AGENTS.md ingestion + persistent memory · S · ⬜.** Extend `cortexideRulesService` to also
  discover root + nested `AGENTS.md` (most-specific-wins) into the `<project_rules>` injection
  ([prompts.ts:722](../src/vs/workbench/contrib/cortexide/common/prompt/prompts.ts#L722)) — portability
  for users from Cursor/Claude Code. Memory: `memoriesService.ts` exists but the write/persist path
  needs wiring into the already-present `relevantMemories` system-message hook.

### Low-impact / polish
- **R10 · Bundled Playwright MCP (browser/E2E) + Mermaid plan rendering · S · ⬜.** Ship a recommended
  Playwright MCP server config (MCP already supported) for browser verification; render an optional
  Mermaid view of the structured plan steps. Image-gen / voice are deferred (not core to agent usability).

### Sub-agents — concrete design (R2, the headline)
Mirror Claude Code/Roo semantics: the **only** parent→child channel is the prompt string; the **only**
child→parent channel is the final summary; no infinite nesting.
1. **Context (R1):** `_runChatAgent` takes `runCtx`; the loop reads mode/tools/model/system-prompt
   from it instead of globals. Done for normal turns with a default ctx = zero change.
2. **Tool restriction:** the child's mode (e.g. `agent` for scoped edits, `gather` for read-only)
   already restricts tools via `availableTools(chatMode, …)`
   ([prompts.ts:525](../src/vs/workbench/contrib/cortexide/common/prompt/prompts.ts#L525)); a future
   `allowedToolNames` intersect gives per-agent toolsets. `run_subagent` is removed/blocked when
   `isSubagent` (no nesting).
3. **`run_subagent` tool** params `{ description, prompt, agent_type?, allowed_tools? }`; AGENT-ONLY;
   excluded from `COMPACT_LOCAL_TOOLSET`.
4. **Dispatch in `_runToolCall`:** create a hidden child thread (`newThreadObject` pattern, distinct
   id, `parentThreadId`, not in `openTabs`); seed ONE user message = `prompt`; resolve the child's
   `runCtx` (from `agent_type` custom agent, or default `agent` mode inheriting the parent's model);
   `await _runChatAgent({ threadId: childId, runCtx })`.
5. **Return:** the loop already returns on `completionSignaled`
   ([:4074](../src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts#L4074)); capture the
   child's `attempt_completion` result, stringify it as the `run_subagent` tool result, append to the
   PARENT thread. The parent's next turn sees only that summary — the child's noisy intermediate
   calls never enter the parent context.
6. **Safety:** no-nesting (step 2); v1 runs sub-agents **sequentially** (read-only parallel is R5);
   child tool calls flow through the same `_runToolCall`, so hooks (R3) govern sub-agents too; child
   edits create child-thread checkpoints and the parent's jump-back still works.
   **UI:** render the child as a collapsible sub-thread under the parent's `run_subagent` call; abort
   propagates parent→child.

### Quick wins (high value, low effort — can land independently of R1)
- AGENTS.md ingestion (extend `cortexideRulesService`) — instant portability.
- Terminal allowlist + deny-list; **protect `.git`/`.cortexide` from auto-approval**.
- Wire the existing `relevantMemories` hook to a `.cortexide/memory` file (first cut of cross-session memory).
- Turn the 70% token warning into a one-click "Summarize earlier turns".
- Ship a recommended Playwright MCP config (zero native code).

### Recommended sequence
**R1 → R2 → R4 → R5** (sub-agents track, chosen) delivers the headline. Interleave the quick wins
(AGENTS.md, allowlist, protected paths) and **R3 hooks** early — hooks make sub-agent/background runs
trustworthy. **R7/R8** follow naturally on the R1 foundation. Parallel *editing* (worktrees) and
cloud/PR agents are explicitly deferred (XL).

> Build status (2026-06-03): out-of-box agentic moat shipped this session (tool-call repair,
> capable-model routing, onboarding auto-pull, ollama num_ctx 16384, dev Keychain fix — 6 commits,
> verified live). **R1 (`AgentRunContext`) is in progress**; R2 (`run_subagent`) is next.

---

## Sources
- Cursor: [cursor.com/changelog](https://cursor.com/changelog), [DeployHQ guide](https://www.deployhq.com/guides/cursor), [Codersera 3.5 guide](https://codersera.com/blog/cursor-ide-complete-guide-2026/), [AI Tool Analysis review](https://aitoolanalysis.com/cursor-ai-review/)
- OpenCode: [opencode.ai](https://opencode.ai), [opencode docs](https://opencode.ai/docs/)
- Claude Code: Anthropic public docs (agentic loop, subagents, hooks, slash commands, MCP, memory, permissions, background tasks, checkpoints)
- CortexIDE: direct source verification under `src/vs/workbench/contrib/cortexide/` (2026-05-31), corroborated by two independent 45-agent audit passes.
