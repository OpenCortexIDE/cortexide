/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Free-tier quota and quality configuration for the smart free-tier router.
 *
 * Source of truth for the rate limits we know about as of 2026-05.  These are
 * intentionally NOT hardcoded URLs - only request/token rate limits.  When a
 * provider changes its published limits, update this file in one place.
 *
 * RPD = requests per day.
 * RPM = requests per minute.
 * TPM = tokens per minute.
 *
 * `qualityRank` is a relative ordering used by `freeTierLadder` when more
 * than one provider has remaining quota.  Higher = preferred.  See research
 * doc section 4.1 for the full rationale.
 *
 *     Cerebras > Groq > Gemini Flash > OpenRouter free > Mistral > Cloudflare
 */

import { ProviderName } from '../cortexideSettingsTypes.js';

/**
 * Free-tier-routable provider names.
 */
export type FreeTierProviderId =
	| 'cerebras'
	| 'groq'
	| 'gemini'
	| 'mistral'
	| 'openRouter'
	| 'cloudflareWorkersAI';

/**
 * Per-provider free-tier policy.
 */
export interface FreeTierQuota {
	readonly providerId: FreeTierProviderId;
	/** Provider name in CortexIDE's `ProviderName` enum, or `null` if not yet wired. */
	readonly cortexProviderName: ProviderName | null;
	/** Higher value = preferred when multiple providers have quota. */
	readonly qualityRank: number;
	/** Requests per day, or `null` if not capped. */
	readonly rpd: number | null;
	/** Requests per minute, or `null` if not capped. */
	readonly rpm: number | null;
	/** Tokens per minute, or `null` if not capped. */
	readonly tpm: number | null;
	/**
	 * Largest input context window (tokens) on this provider's free tier.  Used
	 * by `buildFreeTierLadder` to DEMOTE context-starved providers for large /
	 * agentic tasks: a tool loop or sub-agent run on an 8K window (Cerebras)
	 * stalls almost immediately, so when a task needs more headroom we prefer a
	 * large-context provider (Gemini 1M, Groq 128K) even if its raw `qualityRank`
	 * is lower.  Per-provider (not per-model) on purpose — the free tier's
	 * ceiling is what matters here, matching the rest of this table.
	 */
	readonly maxContextWindowTokens: number;
	/** Free-text note for tooltips / docs. */
	readonly notes: string;
}

/**
 * Free-tier quota table.  Update here when provider docs change.
 */
export const FREE_TIER_QUOTAS: { readonly [K in FreeTierProviderId]: FreeTierQuota } = {
	cerebras: {
		providerId: 'cerebras',
		cortexProviderName: 'cerebras',
		qualityRank: 100,
		rpd: null,
		rpm: 30,
		tpm: null,
		// Hard 8K cap on the free tier — too small to sustain an agentic tool loop.
		maxContextWindowTokens: 8_192,
		notes: '1M tokens/day; 8K context cap',
	},
	groq: {
		providerId: 'groq',
		cortexProviderName: 'groq',
		qualityRank: 80,
		rpd: 1000,
		rpm: 30,
		tpm: 6000,
		maxContextWindowTokens: 131_072,
		notes: '',
	},
	gemini: {
		providerId: 'gemini',
		cortexProviderName: 'gemini',
		qualityRank: 60,
		// We track the broadest tier (Flash-Lite) here; per-model tightening is
		// done in `freeTierLadder.ts` based on the actual model name.
		rpd: 1000,
		rpm: 15,
		tpm: null,
		// Gemini 2.5 Flash exposes a 1M-token window — the best free option for
		// long agentic loops and sub-agent orchestration.
		maxContextWindowTokens: 1_000_000,
		notes: 'Flash-Lite limits; Flash/Pro tighter',
	},
	openRouter: {
		providerId: 'openRouter',
		cortexProviderName: 'openRouter',
		qualityRank: 40,
		rpd: 50,
		rpm: 20,
		tpm: null,
		maxContextWindowTokens: 128_000,
		notes: '1000 RPD with $10 top-up',
	},
	mistral: {
		providerId: 'mistral',
		cortexProviderName: 'mistral',
		qualityRank: 30,
		rpd: null,
		rpm: 2,
		tpm: null,
		maxContextWindowTokens: 128_000,
		notes: '1B tokens/month (Experiment tier)',
	},
	cloudflareWorkersAI: {
		providerId: 'cloudflareWorkersAI',
		cortexProviderName: null,
		qualityRank: 20,
		rpd: null,
		rpm: null,
		tpm: null,
		// Workers AI free models are small-context; treat like Cerebras.
		maxContextWindowTokens: 8_192,
		notes: '10,000 Neurons/day',
	},
};

/**
 * Per-model overrides for Gemini (tighter than the entry-level Flash-Lite
 * limits in the master table).  Matched case-insensitively by substring.
 */
export interface GeminiModelQuotaOverride {
	readonly modelNameSubstring: string;
	readonly rpd: number | null;
	readonly rpm: number | null;
}

export const GEMINI_MODEL_OVERRIDES: readonly GeminiModelQuotaOverride[] = [
	{ modelNameSubstring: 'pro', rpd: 100, rpm: 5 },
	{ modelNameSubstring: 'flash-lite', rpd: 1000, rpm: 15 },
	{ modelNameSubstring: 'flash', rpd: 250, rpm: 10 },
];

/**
 * Resolve effective per-call limits for a given provider+model.  Returns the
 * tightest applicable RPD/RPM/TPM triple.
 */
export function resolveEffectiveQuota(
	providerId: FreeTierProviderId,
	modelName: string,
): { rpd: number | null; rpm: number | null; tpm: number | null } {
	const base = FREE_TIER_QUOTAS[providerId];
	let rpd = base.rpd;
	let rpm = base.rpm;
	const tpm = base.tpm;

	if (providerId === 'gemini') {
		const lower = modelName.toLowerCase();
		for (const override of GEMINI_MODEL_OVERRIDES) {
			if (lower.includes(override.modelNameSubstring)) {
				rpd = override.rpd;
				rpm = override.rpm;
				break;
			}
		}
	}

	return { rpd, rpm, tpm };
}

/**
 * Reverse lookup: CortexIDE `ProviderName` -> free-tier id, or `null` if the
 * provider isn't on the free-tier ladder.  Accepts the union with `'auto'`
 * so callers don't have to narrow first; `'auto'` always returns `null`.
 */
export function freeTierIdOfProviderName(providerName: ProviderName | 'auto'): FreeTierProviderId | null {
	if (providerName === 'auto') {
		return null;
	}
	for (const id of Object.keys(FREE_TIER_QUOTAS) as FreeTierProviderId[]) {
		if (FREE_TIER_QUOTAS[id].cortexProviderName === providerName) {
			return id;
		}
	}
	return null;
}
