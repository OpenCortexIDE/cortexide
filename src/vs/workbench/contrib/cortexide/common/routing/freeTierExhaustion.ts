/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure function: decide whether the free-tier ladder is fully exhausted and,
 * if so, produce an actionable message so the user is never left with a raw
 * provider 429 (the "free models out of the box, never strand the user" moat).
 *
 * Reuses `buildFreeTierLadder` for the "is any rung still usable?" decision so
 * the exhaustion test and the routing decision can never disagree.
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/freeTierExhaustion.test.ts`.
 */

import { ModelSelection, ProviderName, localProviderNames } from '../cortexideSettingsTypes.js';
import { freeTierIdOfProviderName } from './freeTierConstants.js';
import { FreeTierRemaining } from './freeTierQuotaService.js';
import { buildFreeTierLadder } from './freeTierLadder.js';

/** Inputs - all caller-supplied, no service deps (so this stays unit-testable). */
export interface FreeTierExhaustionInput {
	/** Provider/model pairs the user has configured + enabled (same list the router sees). */
	readonly configuredModels: readonly ModelSelection[];
	/** Quota snapshots from `IFreeTierQuotaService.getAllRemaining()`. */
	readonly quotas: readonly FreeTierRemaining[];
	/** Current time in epoch ms (passed in so the function is deterministic). */
	readonly now: number;
}

export interface FreeTierExhaustionResult {
	/** True only when at least 1 free-tier provider is configured AND none are currently usable. */
	readonly allExhausted: boolean;
	/** A configured local model the user can switch to, if any. */
	readonly localFallback: ModelSelection | null;
	/** A configured BYO / paid cloud model the user can switch to, if any. */
	readonly byoFallback: ModelSelection | null;
	/** Soonest epoch-ms reset among the configured free-tier providers, or null if unknown. */
	readonly soonestResetAt: number | null;
	/** Human-readable, actionable message. Empty string when `allExhausted` is false. */
	readonly message: string;
}

const NOT_EXHAUSTED: FreeTierExhaustionResult = {
	allExhausted: false,
	localFallback: null,
	byoFallback: null,
	soonestResetAt: null,
	message: '',
};

function isLocalProvider(providerName: ProviderName): boolean {
	return (localProviderNames as readonly ProviderName[]).includes(providerName);
}

/** "in ~45s" / "in ~3 min", or '' when no reset time is known. */
function formatResetClause(soonestResetAt: number | null, now: number): string {
	if (soonestResetAt === null || soonestResetAt <= now) {
		return '';
	}
	const seconds = Math.ceil((soonestResetAt - now) / 1000);
	if (seconds < 90) {
		return ` The soonest free provider resets in ~${seconds}s.`;
	}
	const minutes = Math.ceil(seconds / 60);
	return ` The soonest free provider resets in ~${minutes} min.`;
}

/**
 * Returns an exhaustion verdict for the free-tier ladder. `allExhausted` is
 * true only when the user has configured at least one free-tier provider and
 * every one of them is currently unusable (429-exhausted or out of RPD/RPM/TPM).
 */
export function describeFreeTierExhaustion(input: FreeTierExhaustionInput): FreeTierExhaustionResult {
	// Which configured providers are on the free-tier table?
	const configuredFreeTier = input.configuredModels.filter(
		m => m.providerName !== 'auto' && freeTierIdOfProviderName(m.providerName) !== null,
	);
	if (configuredFreeTier.length === 0) {
		return NOT_EXHAUSTED; // not a free-tier setup; nothing to report
	}

	// Reuse the SAME filter the router uses. If any rung is still usable we are
	// not exhausted - this guarantees the message and the routing decision agree.
	const ladder = buildFreeTierLadder({
		configuredModels: input.configuredModels,
		quotas: input.quotas,
		privacyMode: false,
	});
	if (ladder.length > 0) {
		return NOT_EXHAUSTED;
	}

	// Every configured free-tier provider is currently unusable. Find a fallback
	// the user already has: a local model first, else a configured BYO/paid cloud model.
	let localFallback: ModelSelection | null = null;
	let byoFallback: ModelSelection | null = null;
	for (const m of input.configuredModels) {
		if (m.providerName === 'auto') {
			continue;
		}
		if (isLocalProvider(m.providerName)) {
			localFallback ??= m;
		} else if (freeTierIdOfProviderName(m.providerName) === null) {
			// non-local, non-free-tier => a paid/BYO cloud provider the user configured
			byoFallback ??= m;
		}
	}

	// Soonest reset among the configured free-tier providers only.
	const configuredIds = new Set(
		configuredFreeTier.map(m => freeTierIdOfProviderName(m.providerName)),
	);
	let soonestResetAt: number | null = null;
	for (const q of input.quotas) {
		if (!configuredIds.has(q.providerId)) {
			continue;
		}
		if (q.resetAt !== null && (soonestResetAt === null || q.resetAt < soonestResetAt)) {
			soonestResetAt = q.resetAt;
		}
	}

	const resetClause = formatResetClause(soonestResetAt, input.now);
	let action: string;
	if (localFallback) {
		action = `Switch to your local model ${localFallback.providerName}/${localFallback.modelName} to keep working`;
	} else if (byoFallback) {
		action = `Switch to ${byoFallback.providerName}/${byoFallback.modelName} (your configured API key) to keep working`;
	} else {
		action = `Add a local model (e.g. Ollama) or an API key in CortexIDE Settings to keep working`;
	}
	const message = `All free-tier providers are rate-limited right now.${resetClause} ${action}, or wait for the quota to reset.`;

	return { allExhausted: true, localFallback, byoFallback, soonestResetAt, message };
}
