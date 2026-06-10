/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure model-selection helpers extracted from the chatThreadService agent loop.
 *
 * The actual failover RANKING is already pure + tested (`routing/modelFailover.pickNextFailoverModel`).
 * This module owns the two remaining inline, untested pieces:
 *   1. `resolveModelRuntimeCaps` - the local-vs-cloud loop-cap policy (weak/local models get tighter
 *      iteration + tool-error caps so they stop rambling sooner). Mirrors chatThreadService's
 *      `recomputeModelState` cap logic.
 *   2. `buildFailoverCandidates` - turning the configured providers/models into the `FailoverCandidate[]`
 *      the ranker consumes, applying the eligibility rules (skip hidden/excluded/unconfigured; a LOCAL
 *      model never counts as native-tool-calling; coder = name-heuristic OR FIM support). Mirrors the
 *      candidate-gathering loop in `_pickNextUntriedModel`.
 *
 * Layer: `common/`. Pure - no I/O, no vs/service imports. The caller supplies the provider list (read
 * from settings) and a `getCaps` lookup (wrapping the dynamically-imported getModelCapabilities, which
 * it must guard so it returns null on any failure - matching the original per-model try/catch). Tested
 * in `test/common/modelSelectionEngine.test.ts`.
 */

import type { ProviderName, ModelSelection } from './cortexideSettingsTypes.js';
import { localProviderNames } from './cortexideSettingsTypes.js';
import { isLikelyCoderModelName, KNOWN_CAPABLE_AGENTIC_PROVIDERS, type FailoverCandidate } from './routing/modelFailover.js';
import { freeTierIdOfProviderName } from './routing/freeTierConstants.js';

/* ============================================================================
 * 1. runtime loop caps (mirrors recomputeModelState's cap logic)
 * ========================================================================== */

export interface ModelRuntimeCapsConfig {
	readonly maxAgentIterations: number;
	readonly maxLocalAgentIterations: number;
	readonly maxConsecutiveToolErrors: number;
	readonly maxLocalConsecutiveToolErrors: number;
}

export interface ModelRuntimeCaps {
	readonly isLocalModel: boolean;
	readonly maxAgentIterations: number;
	readonly maxConsecutiveToolErrors: number;
}

/**
 * A model is "local" iff its provider is ollama/vLLM/lmStudio (the 'auto' pseudo-provider and any null
 * selection are non-local). Local models get the tighter caps. Behavior-identical to the inline
 * `isLocalModel = !!m && localProviderNames.includes(m.providerName)` + the two ternaries.
 */
export function resolveModelRuntimeCaps(modelSelection: ModelSelection | null, config: ModelRuntimeCapsConfig): ModelRuntimeCaps {
	const isLocalModel = !!modelSelection && (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);
	return {
		isLocalModel,
		maxAgentIterations: isLocalModel ? config.maxLocalAgentIterations : config.maxAgentIterations,
		maxConsecutiveToolErrors: isLocalModel ? config.maxLocalConsecutiveToolErrors : config.maxConsecutiveToolErrors,
	};
}

/* ============================================================================
 * 2. failover candidate building (mirrors _pickNextUntriedModel's gather loop)
 * ========================================================================== */

export interface FailoverModelEntry {
	readonly modelName: string;
	readonly isHidden?: boolean;
}

export interface FailoverProviderEntry {
	readonly providerName: ProviderName;
	/** settingsOfProvider[p]._didFillInProviderSettings - skip providers the user never configured */
	readonly didFillInProviderSettings: boolean;
	readonly models: readonly FailoverModelEntry[];
}

/** The subset of getModelCapabilities consumed for candidate scoring. */
export interface CandidateCaps {
	readonly contextWindow?: number;
	readonly specialToolFormat?: unknown;
	readonly supportsFIM?: boolean;
}

/**
 * Caps lookup. The caller wraps getModelCapabilities and MUST return null on any failure (mirroring the
 * original inline try/catch that fell back to name heuristics + zero context on error).
 */
export type CandidateCapsLookup = (providerName: ProviderName, modelName: string) => CandidateCaps | null;

/**
 * Build the failover candidate list (in provider/model declaration order, which the ranker's tie-breaks
 * rely on). Mirrors the inline loop byte-for-byte: skip unconfigured providers, hidden models, and any
 * already-tried key; a LOCAL model never reports native tool calls; coder = name-heuristic OR FIM.
 */
export function buildFailoverCandidates(
	providers: readonly FailoverProviderEntry[],
	excludeKeys: ReadonlySet<string>,
	getCaps: CandidateCapsLookup,
): FailoverCandidate[] {
	const candidates: FailoverCandidate[] = [];
	for (const provider of providers) {
		if (!provider.didFillInProviderSettings) { continue; }
		const isLocal = (localProviderNames as readonly ProviderName[]).includes(provider.providerName);
		for (const mi of provider.models) {
			if (mi.isHidden) { continue; }
			if (excludeKeys.has(`${provider.providerName}/${mi.modelName}`)) { continue; }
			let contextWindow = 0;
			let hasNativeToolCalls = false;
			let isCoder = isLikelyCoderModelName(mi.modelName);
			const caps = getCaps(provider.providerName, mi.modelName);
			if (caps) {
				contextWindow = caps.contextWindow ?? 0;
				hasNativeToolCalls = !!caps.specialToolFormat && !isLocal;
				isCoder = isCoder || !!caps.supportsFIM;
			}
			candidates.push({
				providerName: provider.providerName,
				modelName: mi.modelName,
				isLocal,
				contextWindow,
				hasNativeToolCalls,
				isKnownCapableProvider: (KNOWN_CAPABLE_AGENTIC_PROVIDERS as readonly ProviderName[]).includes(provider.providerName),
				isCoder,
				isFreeTierProvider: freeTierIdOfProviderName(provider.providerName) !== null,
			});
		}
	}
	return candidates;
}
