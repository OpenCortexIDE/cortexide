/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure function: given configured providers + privacy state + remaining
 * quotas, return an ordered list of [provider, model] candidates for the
 * free-tier router.
 *
 * Layer: `common/`. Pure. No I/O.  Tested in isolation under
 * `test/common/freeTierLadder.test.ts`.
 */

import { ModelSelection, ProviderName } from '../cortexideSettingsTypes.js';
import {
	FREE_TIER_QUOTAS,
	FreeTierProviderId,
	freeTierIdOfProviderName,
} from './freeTierConstants.js';
import { FreeTierRemaining } from './freeTierQuotaService.js';

/** A configured free-tier provider candidate (always a real provider, never `'auto'`). */
export interface FreeTierCandidate {
	readonly providerName: ProviderName;
	readonly providerId: FreeTierProviderId;
	readonly modelName: string;
	/** Higher = preferred. */
	readonly qualityRank: number;
	/** Largest free-tier context window (tokens) for this provider. */
	readonly maxContextWindowTokens: number;
}

/** Inputs to the ladder computation - all caller-supplied, no service deps. */
export interface FreeTierLadderInput {
	/** Provider/model pairs the user has actually configured + enabled. */
	readonly configuredModels: readonly ModelSelection[];
	/**
	 * Quota snapshots from `IFreeTierQuotaService.getAllRemaining()`, indexed
	 * implicitly by `providerId`.  Providers absent from this list are
	 * treated as having unlimited quota.
	 */
	readonly quotas: readonly FreeTierRemaining[];
	/**
	 * If true, the privacy gate is engaged - the ladder MUST be empty so the
	 * caller falls back to local models.
	 */
	readonly privacyMode: boolean;
	/**
	 * Minimum input context window (tokens) the task needs.  Providers whose
	 * free-tier context window is smaller are DEMOTED below those that fit (a
	 * stable demotion, not a hard drop — a too-small provider still remains as a
	 * last resort so we never produce an empty ladder when one would otherwise
	 * exist).  Omit / 0 = no context preference (ordering by quality only).
	 *
	 * This is what keeps an agentic / sub-agent task off Cerebras's 8K window
	 * when a large-context free provider (Gemini, Groq) is also configured.
	 */
	readonly minContextWindow?: number;
}

/**
 * Build the ordered candidate list.  Filters out:
 *   - providers not on the free-tier table
 *   - providers without configured models
 *   - providers marked exhausted (429)
 *   - providers with zero remaining RPD, RPM, or TPM
 * then sorts the remainder by descending `qualityRank`.
 *
 * If `privacyMode` is true, returns `[]`.
 */
export function buildFreeTierLadder(input: FreeTierLadderInput): readonly FreeTierCandidate[] {
	if (input.privacyMode) {
		return [];
	}

	const quotaById = new Map<FreeTierProviderId, FreeTierRemaining>();
	for (const q of input.quotas) {
		quotaById.set(q.providerId, q);
	}

	const candidates: FreeTierCandidate[] = [];

	for (const model of input.configuredModels) {
		if (model.providerName === 'auto') {
			continue;
		}
		// model.providerName is now narrowed to ProviderName
		const providerName: ProviderName = model.providerName;
		const providerId = freeTierIdOfProviderName(providerName);
		if (providerId === null) {
			continue;
		}
		const def = FREE_TIER_QUOTAS[providerId];

		const remaining = quotaById.get(providerId);
		if (remaining) {
			if (remaining.exhausted) {
				continue;
			}
			if (remaining.rpd !== null && remaining.rpd <= 0) {
				continue;
			}
			if (remaining.rpm !== null && remaining.rpm <= 0) {
				continue;
			}
			// Drop providers that have exhausted their per-minute token budget;
			// otherwise they stay on the ladder and the very next call earns an
			// avoidable 429 — exactly the stall that breaks "free models out of the box".
			if (remaining.tpm !== null && remaining.tpm <= 0) {
				continue;
			}
		}

		candidates.push({
			providerName,
			providerId,
			modelName: model.modelName,
			qualityRank: def.qualityRank,
			maxContextWindowTokens: def.maxContextWindowTokens,
		});
	}

	// Primary order: quality. Secondary (and dominant when a context floor is
	// set): providers that can hold the task's context window rank above those
	// that can't. We keep too-small providers at the tail rather than dropping
	// them, so a user whose ONLY free provider is context-starved still gets a
	// usable ladder instead of an empty one.
	const minCtx = input.minContextWindow ?? 0;
	candidates.sort((a, b) => {
		if (minCtx > 0) {
			const aFits = a.maxContextWindowTokens >= minCtx ? 1 : 0;
			const bFits = b.maxContextWindowTokens >= minCtx ? 1 : 0;
			if (aFits !== bFits) {
				return bFits - aFits; // fitting providers first
			}
		}
		return b.qualityRank - a.qualityRank;
	});
	return candidates;
}

/**
 * Convenience: convert the first ladder candidate into a `ModelSelection`,
 * or return `null` if the ladder is empty.
 */
export function pickTopFromLadder(
	ladder: readonly FreeTierCandidate[],
): ModelSelection | null {
	if (ladder.length === 0) {
		return null;
	}
	return {
		providerName: ladder[0].providerName,
		modelName: ladder[0].modelName,
	};
}
