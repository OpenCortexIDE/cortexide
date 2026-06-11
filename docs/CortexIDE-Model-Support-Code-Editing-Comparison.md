# CortexIDE Model Support & Code Editing Capabilities Comparison

> **⚠️ Accuracy notice (under correction — `modernize-agentic-editor-foundation`).**
> A code audit found several claims in this document were overstated or wrong. Corrections are
> being applied; until this notice is removed, treat the following as ground truth and see
> [`docs/MODERNIZATION-BASELINE.md`](./MODERNIZATION-BASELINE.md):
> - **Tree-sitter / "semantic" / vector RAG is NOT working today.** AST symbol extraction is
>   currently non-functional; retrieval is **lexical (BM25) only**. The vector store (Qdrant/Chroma)
>   is **experimental, off by default, and needs an embedding provider that is not yet bundled**.
> - **Rollback / auto-stash is experimental and opt-in**, not a general safety net (being hardened).
> - **Apply is not yet atomic at the disk level** (hardening in progress).
> - **Performance percentages previously stated here were never measured** and have been removed.
>
> "✅ verified in code" annotations below mean "code exists", not "feature works end-to-end".

## Table 1: Model Support

| Capability / Model | CortexIDE | Cursor | Windsurf | Continue.dev | Void | Code Proof (for CortexIDE) | Notes |
|-------------------|-----------|--------|----------|--------------|------|----------------------------|-------|
| **Local Ollama** | ✅ Yes | ⚠️ Limited | ❌ No | ✅ Yes | ⚠️ Limited | `modelCapabilities.ts:1174-1309`, `sendLLMMessage.impl.ts:1403-1407` | Full support with auto-detection, model listing, FIM support. Ollama is OpenAI-compatible. |
| **Local vLLM** | ✅ Yes | ❌ No | ❌ No | ❓ Unknown | ❌ No | `modelCapabilities.ts:1261-1276`, `sendLLMMessage.impl.ts:1418-1422` | OpenAI-compatible endpoint support with reasoning content parsing. |
| **Local LM Studio** | ✅ Yes | ❌ No | ❌ No | ❓ Unknown | ❌ No | `modelCapabilities.ts:1278-1292`, `sendLLMMessage.impl.ts:1434-1439` | OpenAI-compatible with model listing. Note: FIM may not work due to missing suffix parameter. |
| **Local OpenAI-compatible (LiteLLM / FastAPI / localhost)** | ✅ Yes | ❌ No | ❌ No | ⚠️ Limited | ❌ No | `modelCapabilities.ts:1311-1342`, `sendLLMMessage.impl.ts:1408-1412,1440-1444` | Supports any OpenAI-compatible endpoint. Auto-detects localhost for connection pooling. |
| **Remote OpenAI** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `modelCapabilities.ts:74-84`, `sendLLMMessage.impl.ts:1383-1387` | Full support including reasoning models (o1, o3). |
| **Remote Anthropic** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `modelCapabilities.ts:85-93`, `sendLLMMessage.impl.ts:1378-1382` | Full Claude support including Claude 3.7/4 reasoning models. |
| **Remote Mistral** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | ❌ No | `modelCapabilities.ts:45-47`, `sendLLMMessage.impl.ts:1398-1402` | OpenAI-compatible with native FIM support. |
| **Remote Gemini** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | ❌ No | `modelCapabilities.ts:100-107`, `sendLLMMessage.impl.ts:1393-1397` | Native Gemini API implementation. |
| **MCP tools** | ✅ Yes | ✅ Yes | ❓ Unknown | ❓ Unknown | ⚠️ Limited | `mcpChannel.ts:48-455`, `mcpService.ts:42-118`, `chatThreadService.ts:2118-2443` | Full MCP server support with stdio, HTTP, and SSE transports. Tool calling integrated in chat. |
| **Custom endpoints** | ✅ Yes | ⚠️ Limited | ❓ Unknown | ⚠️ Limited | ❌ No | `modelCapabilities.ts:1311-1326` | OpenAI-compatible endpoint support with custom headers. |
| **Model routing engine** | ✅ Yes | ⚠️ Limited | ❓ Unknown | ❓ Unknown | ❌ No | `modelRouter.ts:139-533` | Task-aware intelligent routing with quality tier estimation, context-aware selection, fallback chains. |
| **Local-first mode** | ✅ Yes | ❌ No | ❌ No | ⚠️ Limited | ❌ No | `modelRouter.ts:193-197`, `cortexideGlobalSettingsConfiguration.ts:25-30` | Setting to prefer local models with cloud fallback. Heavy bias toward local models in scoring. |
| **Privacy mode** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | `modelRouter.ts:173-190`, `cortexideStatusBar.ts:190-230` | Routes only to local models when privacy required (e.g., images/PDFs). Offline detection and status indicator. |
| **Warm-up system** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | `modelWarmupService.ts:33-141`, `editCodeService.ts:1441-1450` | Background warm-up for local models (90s cooldown). Reduces first-request latency for Ctrl+K/Apply. |
| **SDK pooling / connection reuse** | ✅ Yes | ❓ Unknown | ❓ Unknown | ❓ Unknown | ❌ No | `sendLLMMessage.impl.ts:59-162` | Client caching for local providers (Ollama, vLLM, LM Studio, localhost). HTTP keep-alive and connection pooling. |
| **Streaming for Chat** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `sendLLMMessage.impl.ts:582-632`, `chatThreadService.ts:2937-2983` | Full streaming with first-token timeout (10s local, 30s remote). Partial results on timeout. |
| **Streaming for FIM autocomplete** | ✅ Yes | ✅ Yes | ❓ Unknown | ❓ Unknown | ⚠️ Limited | `sendLLMMessage.impl.ts:331-450`, `autocompleteService.ts:853-877` | Streaming FIM for local models (Ollama, vLLM, OpenAI-compatible). Incremental UI updates. |
| **Streaming for Apply** | ✅ Yes | ✅ Yes | ✅ Yes | ❓ Unknown | ⚠️ Limited | `editCodeService.ts:1392-1634` | Streaming rewrite with writeover stream. Supports both full rewrite and search/replace modes. |
| **Streaming for Composer** | ✅ Yes | ✅ Yes | ✅ Yes | ❓ Unknown | ❌ No | `composerPanel.ts:56-1670`, `chatEditingSession.ts:450-513` | Streaming edits with diff visualization. Multi-file editing support. |
| **Streaming for Agent mode** | ✅ Yes | ✅ Yes | ❓ Unknown | ❓ Unknown | ⚠️ Limited | `chatThreadService.ts:2448-3419` | Streaming with tool orchestration. Step-by-step execution with checkpoints. |

## Table 2: Code-Editing Capabilities

| Capability / Model | CortexIDE | Cursor | Windsurf | Continue.dev | Void | Code Proof (for CortexIDE) | Notes |
|-------------------|-----------|--------|----------|--------------|------|----------------------------|-------|
| **Ctrl+K quick edit** | ✅ Yes | ✅ Yes | ✅ Yes | ❓ Unknown | ⚠️ Limited | `quickEditActions.ts:45-84`, `editCodeService.ts:1465-1489` | Inline edit with FIM. Supports prefix/suffix context. Local model optimizations. |
| **Apply (rewrite)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `editCodeService.ts:1176-1201`, `prompts.ts:737-761` | Full file rewrite with local model code pruning. Supports fast apply (search/replace) for large files. |
| **Multi-file composer** | ✅ Yes | ✅ Yes | ✅ Yes | ❓ Unknown | ❌ No | `composerPanel.ts:56-1670`, `editCodeService.ts:186-802` | Multi-file editing with scope management. Auto-discovery in agent mode. |
| **Agent mode** | ✅ Yes | ✅ Yes | ❓ Unknown | ❓ Unknown | ⚠️ Limited | `chatThreadService.ts:2448-3419`, `cortexideSettingsTypes.ts:455` | Plan generation, tool orchestration, step-by-step execution. Maximum iteration limits to prevent loops. |
| **Search & replace AI** | ✅ Yes | ✅ Yes | ❓ Unknown | ❓ Unknown | ❌ No | `quickEditActions.ts:215-231`, `prompts.ts:909-960` | AI-powered search/replace with minimal patch generation. Supports fuzzy matching. |
| **Git commit message AI** | ✅ Yes | ⚠️ Limited | ❓ Unknown | ❓ Unknown | ❌ No | `cortexideSCMService.ts:72-125`, `prompts.ts:1095-1167` | Generates commit messages from git diff, stat, branch, and log. Local model optimizations. |
| **Inline autocomplete (FIM)** | ✅ Yes | ✅ Yes | ✅ Yes | ❓ Unknown | ⚠️ Limited | `autocompleteService.ts:278-1014`, `convertToLLMMessageService.ts:1737-1813` | Fill-in-middle with streaming. Token caps for local models (1,000 tokens). Smart prefix/suffix truncation. |
| **Code diff viewer** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `editCodeService.ts:2223-2289`, `codeBlockPart.ts:553-887` | Diff visualization with accept/reject. Multi-diff editor support. |
| **Chat → Plan → Diff → Apply pipeline** | ✅ Yes | ✅ Yes | ❓ Unknown | ❓ Unknown | ⚠️ Limited | `chatThreadService.ts:2448-3419`, `composerPanel.ts:1420-1560` | Workflow: agent generates plan, creates diffs, user reviews and applies. _(Rollback is experimental/opt-in — see notice.)_ |
| **Tree-sitter based RAG indexing** | ⚠️ Experimental (not working) | ❌ No | ❓ Unknown | ❌ No | ❌ No | `treeSitterService.ts`, `repoIndexerService.ts` | AST symbol extraction is currently non-functional; retrieval falls back to lexical **BM25** only. TODO: fix in Phase 4 (real RAG). |
| **Cross-file context** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `repoIndexerService.ts:868-1155`, `composerPanel.ts:1076-1144` | Hybrid BM25 + vector search. Symbol relationship indexing. Auto-discovery in agent mode. |
| **Auto-stashing + rollback** | ⚠️ Experimental / opt-in | ❓ Unknown | ❓ Unknown | ❓ Unknown | ❌ No | `gitAutoStashService.ts`, `rollbackSnapshotService.ts`, `composerPanel.ts` | Git auto-stash before multi-file Composer applies (on by default); snapshot rollback is opt-in (`cortexide.safety.rollback.enable`, default off) and only covers the Composer "Apply All" path — not a general safety net. Being hardened in Phase 1. |
| **Safe-apply (guardrails)** | ✅ Yes | ⚠️ Limited | ❓ Unknown | ❓ Unknown | ❌ No | `editCodeService.ts:1167-1172`, `toolsService.ts:570-602` | Pre-apply validation. Conflict detection. Stream state checking to prevent concurrent edits. |
| **Partial results on timeout** | ✅ Yes | ❓ Unknown | ❓ Unknown | ❓ Unknown | ❌ No | `sendLLMMessage.impl.ts:585-614` | Returns partial text on timeout (20s local, 120s remote). Prevents loss of generated content. |
| **Prompt optimization for local edit flows** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | `prompts.ts:737-739`, `editCodeService.ts:1453-1481` | Minimal system messages for local models. Code pruning (removes comments, blank lines). Reduces token usage. |
| **Token caps for edit flows** | ✅ Yes | ❓ Unknown | ❓ Unknown | ❓ Unknown | ❌ No | `sendLLMMessage.impl.ts:182-196`, `convertToLLMMessageService.ts:1761-1812` | Feature-specific caps: Autocomplete (96 tokens), Ctrl+K/Apply (200 tokens). Prevents excessive generation. |
| **Prefix/suffix truncation** | ✅ Yes | ❓ Unknown | ❓ Unknown | ❓ Unknown | ❌ No | `convertToLLMMessageService.ts:1767-1812` | Smart truncation at line boundaries. Prioritizes code near cursor. Max 20,000 chars per prefix/suffix. |
| **Timeout logic** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `sendLLMMessage.impl.ts:586-628`, `editCodeService.ts:277-303` | First-token timeout (10s local, 30s remote). Overall timeout (20s local, 120s remote). Feature-specific timeouts. |
| **Local-model edit acceleration** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | `editCodeService.ts:1441-1450`, `modelWarmupService.ts:61-92` | Warm-up system reduces first-request latency. Code pruning and minimal prompts. Connection pooling. |
| **File-scoped reasoning** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | `editCodeService.ts:1392-1634` | Full file context in Apply. Prefix/suffix context in Ctrl+K. Smart context selection. |
| **Multi-model selection per feature** | ✅ Yes | ⚠️ Limited | ❓ Unknown | ⚠️ Limited | ❌ No | `cortexideSettingsTypes.ts:425-444` | Per-feature model selection: Chat, Autocomplete, Ctrl+K, Apply, Composer, Agent, SCM. Independent routing. |
| **Settings-based routing (local-first, privacy, etc.)** | ✅ Yes | ❌ No | ❌ No | ⚠️ Limited | ❌ No | `modelRouter.ts:173-197`, `cortexideGlobalSettingsConfiguration.ts:25-30` | Privacy mode (local-only), local-first mode (prefer local), quality-based routing. Context-aware selection. |

## Legend

- ✅ **Yes** - Feature confirmed and verified
- ⚠️ **Limited** - Partial support or basic implementation
- ❌ **No** - Feature not available
- ❓ **Unknown** - Cannot be verified from public sources

## Key Differentiators

### Model Support
1. **Comprehensive Local Model Support**: CortexIDE uniquely supports Ollama, vLLM, LM Studio, and any OpenAI-compatible localhost endpoint with full feature parity (FIM, streaming, tool calling).
2. **Warm-up System**: Only CortexIDE implements background model warm-up to reduce first-request latency for local models.
3. **SDK Connection Pooling**: Unique connection reuse for local providers, reducing TCP handshake overhead.
4. **Privacy Mode**: True privacy mode that routes only to local models when sensitive data (images/PDFs) is present.

### Code Editing
1. **Codebase indexing**: CortexIDE ships a lexical **BM25** repo indexer that is queried on every turn. _(Tree-sitter AST/semantic indexing is experimental and not functional yet — see Phase 4.)_
2. **Local Model Optimizations**: Unique prompt optimization, code pruning, and token caps specifically designed for local model performance.
3. **Smart Truncation**: Line-boundary aware prefix/suffix truncation that prioritizes code near cursor.
4. **Partial Results on Timeout**: Returns partial generated content on timeout instead of failing completely.
5. **Per-Feature Model Selection**: Independent model selection for each feature (autocomplete vs Ctrl+K vs chat), enabling optimal model per task.

## Performance Implications

### Local Model Optimizations
- **Warm-up System**: Pre-warms local models with a background 1-token request to reduce first-request latency (`modelWarmupService.ts`). _(Latency improvement not yet measured; no percentage is claimed.)_
- **Code Pruning**: Trims comments/blank lines from local-model context to reduce token usage (`convertToLLMMessageService.ts`). _(Reduction not yet measured; no percentage is claimed.)_
- **Token Caps**: Prevents excessive generation, reducing latency for autocomplete (96 tokens) and quick edits (200 tokens)
- **Connection Pooling**: Eliminates TCP handshake overhead for localhost requests

### Timeout Handling
- **First Token Timeout**: 10s for local models prevents hanging on slow models
- **Partial Results**: Preserves generated content even on timeout, improving UX
- **Feature-Specific Timeouts**: Different timeouts per feature optimize for task requirements

### RAG Performance
- **Codebase Indexing**: lexical BM25 retrieval today _(tree-sitter symbol extraction is experimental/non-functional — Phase 4)_
- **Hybrid Search**: BM25 + vector search provides better relevance than either alone
- **Query Caching**: LRU cache (200 queries, 5min TTL) reduces repeated computation

