# CortexIDE Roadmap

Derived from [GAP-ANALYSIS.md](./GAP-ANALYSIS.md). Ordered by impact for the core
mission: **a powerful editor that works out of the box on free models, zero setup.**
Each item references verified source files so work can start immediately. Sizes: S/M/L.

> Keep [../CORTEXIDE-TEST-STATUS.md](../CORTEXIDE-TEST-STATUS.md) updated as items land.

## Done (branch `chore/launch-fix-smoke-harness-2026-05-31`, not yet pushed)
- ✅ Dev-build launch fixed (strip leaked `ELECTRON_RUN_AS_NODE`) + CDP smoke harness
  `test/cortexide-smoke/` (`d29a4d4256d`).
- ✅ **Security:** secret-redaction now catches `sk-proj-*` OpenAI keys + long GitHub
  tokens (`03c70bbafe1`; secretDetection 12/7 → 19/19).
- ✅ **Security:** SSRF guard for `browse_url`/`web_search` merged (`be33c74d5b4`; 18/18).
- ✅ Test-infra: relocated browser-dependent tests out of `test/common/` (stop the
  node-runner load crash); test-status doc corrected to real measured numbers.

---

## P0 — Protect the differentiator (free-tier reliability)
The free router is the product; it must never strand a user.
1. **Free-tier resilience** (M) — `common/routing/*`, `common/sendLLMMessageService.ts`
   - End-to-end 429 / quota-exhaustion fallover against live providers (only unit-tested today).
   - Graceful "all free quotas exhausted" state: clear message + offer local/BYO-key; never a silent hang.
   - Per-request timeout + retry/backoff on transient provider errors.
2. **"Which free model am I on" UX** (S) — `browser/cortexideStatusBar.ts`, settings pane:
   active provider + remaining quota indicator, one-click switch.
3. **Provider preflight on first run** (S) — probe reachable free providers, rank accordingly.

## P0 — Don't lose user code (apply-engine trust)
4. **Real applyEngineV2 tests** (M) — `common/applyEngineV2.ts`
   - Test the registered `IApplyEngineV2` singleton, not the in-test reimplementation.
   - Fix the test-isolation bugs (mocked `fileService` not restored; `setTimeout` races;
     undisposed `TestLanguageConfigurationService`) noted in TEST-STATUS.
   - Cover atomic multi-file apply, rollback on partial failure, base-signature mismatch,
     CRLF/LF normalization, large-file fast-apply.

## P1 — Make the agent good on *weak* models
5. **Small-model agent tuning** (L) — `common/prompt/prompts.ts`, `chatThreadService.ts`,
   building on `localModelOptimizations`/`convertToLLMMessageService`:
   tighter prompts + token budgets, robust/repairing tool-call parsing for weak JSON
   adherence, iteration caps + context-overflow summarization for small windows.
6. **Sandboxed / classifier-gated tool approval** (M) — `browser/toolsService.ts`,
   `terminalToolService.ts`: `run_command` allowlist + lightweight risk classifier
   before exec. SSRF follow-up: resolve hostnames and re-check to block DNS-rebinding.
7. **extract_function indentation fix** (S) — `browser/toolsService.ts`: the extracted
   block drops its leading indentation (failing test in `test/browser/toolsService.test.ts`).

## P1 — End-to-end verification
8. **Extend smoke harness to AI flows** (M) — `test/cortexide-smoke/`: drive open-chat →
   send → stream, Ctrl+K, Apply, an agent tool call, autocomplete (against a free provider
   or a mock). Wire into CI so AI-flow regressions are caught (only boot/render covered today).

## P2 — Catch up on scale / collaboration
9. **Session sharing** (M) — shareable read-only session link (OpenCode parity).
10. **Parallel agents via git worktrees** (L) — N agents in isolated worktrees.
11. **Background agents** (L) — long tasks off the main UI thread (Cursor parity).

## P3 — Extensibility & polish
12. **Tab next-edit-prediction** (L) — cursor-jump-to-next-edit in `autocompleteService.ts`.
13. **Hooks** (M) — pre/post tool-call + lifecycle hooks (Claude Code parity).
14. **AI PR-review bot** (M) — extend `codeReviewService.ts` to PR comments.
15. **`void` → `cortex` branding sweep** (S) — runtime still writes `~/.void-editor/`;
    many `void.*` ids and the `void-scope` class remain. Low risk.

---

## Suggested sequence
1. P0 free-tier reliability (1–3) — protect the moat.
2. P0 apply-engine real tests (4) — protect user code.
3. P1 small-model agent tuning (5) + tool guardrails (6) + extract_function fix (7).
4. P1 AI-flow smoke (8) into CI.
5. Then P2/P3.

## Release discipline
Cut a versioned release only after: P0 items green, the cortexide unit suite green
(no flaky applyEngineV2), and the AI-flow smoke passing. Release runs 3-platform CI —
a separate, deliberate step.
