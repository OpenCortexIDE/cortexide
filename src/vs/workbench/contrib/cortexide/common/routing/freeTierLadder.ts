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
}

/**
 * Build the ordered candidate list.  Filters out:
 *   - providers not on the free-tier table
 *   - providers without configured models
 *   - providers marked exhausted (429)
 *   - providers with zero remaining RPD or RPM
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
		}

		candidates.push({
			providerName,
			providerId,
			modelName: model.modelName,
			qualityRank: def.qualityRank,
		});
	}

	candidates.sort((a, b) => b.qualityRank - a.qualityRank);
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
