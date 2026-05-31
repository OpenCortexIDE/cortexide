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

## Sources
- Cursor: [cursor.com/changelog](https://cursor.com/changelog), [DeployHQ guide](https://www.deployhq.com/guides/cursor), [Codersera 3.5 guide](https://codersera.com/blog/cursor-ide-complete-guide-2026/), [AI Tool Analysis review](https://aitoolanalysis.com/cursor-ai-review/)
- OpenCode: [opencode.ai](https://opencode.ai), [opencode docs](https://opencode.ai/docs/)
- Claude Code: Anthropic public docs (agentic loop, subagents, hooks, slash commands, MCP, memory, permissions, background tasks, checkpoints)
- CortexIDE: direct source verification under `src/vs/workbench/contrib/cortexide/` (2026-05-31), corroborated by two independent 45-agent audit passes.
