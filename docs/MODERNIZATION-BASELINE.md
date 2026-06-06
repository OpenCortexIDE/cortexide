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
