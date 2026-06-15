/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Canonical, single-source-of-truth list of CortexIDE configuration keys that are read
 * from `IConfigurationService` by CortexIDE services.
 *
 * This module is intentionally PURE — it imports nothing from VS Code — so it can be
 * imported by node unit tests (the claim-verification test) without pulling in the
 * workbench/registry. `cortexideGlobalSettingsConfiguration.ts` registers the VS Code
 * configuration schema from this list, so a key that a service reads but that is missing
 * here will be caught by `phase0ClaimVerification.test.ts` instead of silently shipping
 * an invisible, unregistered setting.
 *
 * NOTE: `cortexide.secretDetection.*` is intentionally NOT listed here — it is registered
 * separately by `secretDetectionConfiguration.ts`. Do not double-register it.
 */

export type CortexideConfigType = 'boolean' | 'number' | 'string' | 'enum';
export type CortexideConfigScope = 'application' | 'window' | 'resource';

export interface CortexideConfigKeyDef {
	readonly key: string;
	readonly type: CortexideConfigType;
	readonly default: boolean | number | string;
	readonly scope: CortexideConfigScope;
	/** Honest, user-facing description. Must not overstate what the feature actually does. */
	readonly description: string;
	/** Marks the setting as experimental so the UI/tests can flag it as not-yet-reliable. */
	readonly experimental?: boolean;
	/** Allowed values when `type === 'enum'`. */
	readonly enumValues?: readonly string[];
	readonly enumDescriptions?: readonly string[];
	readonly minimum?: number;
}

export const CORTEXIDE_CONFIG_KEYS: readonly CortexideConfigKeyDef[] = [
	// ---- Local-first / privacy ---------------------------------------------------------
	{
		key: 'cortexide.global.localFirstAI',
		type: 'boolean',
		default: false,
		scope: 'application',
		description: 'Prefer local models (Ollama, vLLM, LM Studio, localhost endpoints) over cloud models when possible. Cloud models are used only as a fallback when local models are unavailable or insufficient. This is a preference, not a hard privacy boundary — for a hard boundary use a local-only routing policy.',
	},
	{
		// Main-process-readable mirror of GlobalSettings.routingPolicy (the settings service writes it
		// on change + at startup) so electron-main telemetry/update gates can read the privacy mode.
		key: 'cortexide.global.routingPolicy',
		type: 'enum',
		default: 'auto-cheapest',
		scope: 'application',
		enumValues: ['auto-cheapest', 'free-tier', 'local-only'],
		enumDescriptions: [
			'Score-based mixture of rules + learned routing (default).',
			'Prefer free-tier providers in quality-ranked order with quota tracking.',
			'HARD privacy boundary: never dispatch off-machine. Cloud LLMs, web tools, remote MCP, telemetry, update checks, and remote catalogs/embeddings/vector stores are all blocked.',
		],
		description: 'Model routing policy; "local-only" is the hard privacy boundary (nothing leaves the machine). The main process reads this mirror to gate telemetry and update checks. Set it from the in-app Privacy setting rather than here.',
	},

	// ---- Codebase indexing -------------------------------------------------------------
	{
		key: 'cortexide.index.ast',
		type: 'boolean',
		default: true,
		scope: 'window',
		experimental: true,
		description: 'Experimental: use tree-sitter ASTs for symbol-aware codebase indexing. AST extraction is currently limited; when it is unavailable, indexing falls back to lexical (BM25) retrieval.',
	},

	// ---- Apply safety: rollback snapshots (Composer "Apply All" path) ------------------
	{
		key: 'cortexide.safety.rollback.enable',
		type: 'boolean',
		default: false,
		scope: 'window',
		experimental: true,
		description: 'Experimental: take snapshots before multi-file Composer "Apply All" operations so the apply can be rolled back. Agent-mode edits use a separate checkpoint system. This rollback path is being hardened — do not rely on it as a sole safety net yet.',
	},
	{
		key: 'cortexide.safety.rollback.maxSnapshotBytes',
		type: 'number',
		default: 5_000_000,
		scope: 'window',
		minimum: 0,
		description: 'Maximum size (in bytes) of a single file captured in a rollback snapshot. Files larger than this are not snapshotted.',
	},

	// ---- Apply safety: git auto-stash --------------------------------------------------
	{
		key: 'cortexide.safety.autostash.enable',
		type: 'boolean',
		default: true,
		scope: 'window',
		description: 'Automatically run `git stash` on dirty changes before a multi-file Composer apply, so your uncommitted work can be recovered if the apply goes wrong. Requires a git repository.',
	},
	{
		key: 'cortexide.safety.autostash.mode',
		type: 'enum',
		default: 'dirty-only',
		scope: 'window',
		enumValues: ['always', 'dirty-only'],
		enumDescriptions: ['Always create a stash before applying.', 'Only stash when the working tree has uncommitted changes.'],
		description: 'When to create a git auto-stash before a multi-file Composer apply.',
	},

	// ---- RAG / vector store (experimental, off by default) -----------------------------
	{
		key: 'cortexide.rag.vectorStore',
		type: 'enum',
		default: 'none',
		scope: 'window',
		experimental: true,
		enumValues: ['none', 'qdrant', 'chroma'],
		enumDescriptions: [
			'Lexical (BM25) retrieval only. Recommended.',
			'Experimental: Qdrant vector store. Requires a configured embedding provider — without one this has no effect.',
			'Experimental: Chroma vector store. Requires a configured embedding provider — without one this has no effect.',
		],
		description: 'Experimental: external vector store backend for semantic retrieval. Requires a configured embedding provider; with no embedding provider configured this has NO effect and should be left as "none". Leave as "none" until embeddings are available, otherwise retrieval quality can degrade.',
	},
	{
		key: 'cortexide.rag.vectorStoreUrl',
		type: 'string',
		default: '',
		scope: 'window',
		experimental: true,
		description: 'URL of the external vector store. Only used when "cortexide.rag.vectorStore" is not "none". Defaults to the standard local Qdrant/Chroma port when left empty.',
	},
	{
		key: 'cortexide.rag.embeddingModel',
		type: 'string',
		default: '',
		scope: 'window',
		experimental: true,
		description: 'Local Ollama embedding model for semantic (hybrid BM25 + vector) retrieval, e.g. "nomic-embed-text". When set AND the model is pulled in your local Ollama, code chunks are embedded ON-MACHINE (Ollama runs on loopback, so this stays local and is allowed under local-only privacy mode). Leave empty for BM25-only retrieval.',
	},

	// ---- Audit log ---------------------------------------------------------------------
	{
		key: 'cortexide.audit.enable',
		type: 'boolean',
		default: false,
		scope: 'window',
		description: 'Write an append-only JSONL audit log of AI actions (prompts, model calls, file edits, approvals, terminal commands) to the workspace ".cortexide/" folder. Off by default.',
	},
	{
		key: 'cortexide.audit.path',
		type: 'string',
		default: '',
		scope: 'window',
		description: 'Custom file path for the audit log. When empty, defaults to ".cortexide/audit.jsonl" in the workspace.',
	},
	{
		key: 'cortexide.audit.rotationSizeMB',
		type: 'number',
		default: 10,
		scope: 'window',
		minimum: 1,
		description: 'Rotate the audit log file once it grows beyond this size (in megabytes).',
	},
];

/** Returns the definition for a key, or undefined if it is not in the canonical list. */
export function getCortexideConfigKeyDef(key: string): CortexideConfigKeyDef | undefined {
	return CORTEXIDE_CONFIG_KEYS.find(d => d.key === key);
}

/** All canonical key strings. */
export function cortexideConfigKeyNames(): string[] {
	return CORTEXIDE_CONFIG_KEYS.map(d => d.key);
}
