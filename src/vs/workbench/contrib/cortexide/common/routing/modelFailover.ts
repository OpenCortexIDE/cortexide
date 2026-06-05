/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ModelSelection, ProviderName } from '../cortexideSettingsTypes.js';

/**
 * Pure ranking logic for automatic model failover.
 *
 * When the active model errors, repeatedly fails its tool calls, or stalls past the
 * step limit, the agent loop escalates the task to the best OTHER configured model.
 * This file decides *which* model to escalate to — kept pure (no services) so it is
 * unit-testable and so the policy is auditable in one place.
 *
 * Provider classes known to be reliable for native agentic tool-use. These are the
 * safest escalation targets when a weak/local model is failing.
 */
export const KNOWN_CAPABLE_AGENTIC_PROVIDERS: readonly ProviderName[] = [
	'anthropic', 'openAI', 'gemini', 'openRouter', 'xAI', 'deepseek', 'groq', 'mistral',
	'googleVertex', 'microsoftAzure', 'awsBedrock',
];

export interface FailoverCandidate {
	readonly providerName: ProviderName;
	readonly modelName: string;
	/** True for ollama/vLLM/lmStudio. */
	readonly isLocal: boolean;
	/** Model's context window (tokens). Larger breaks ties — avoid 4096-ctx aliases. */
	readonly contextWindow: number;
	/** Model has a native tool-calling format (specialToolFormat set) AND is non-local. */
	readonly hasNativeToolCalls: boolean;
	/** anthropic/openAI/gemini/openRouter/... — a provider class proven for agentic use. */
	readonly isKnownCapableProvider: boolean;
	/** Coder-tuned model (FIM / name heuristic) — better on code/agentic tasks. */
	readonly isCoder: boolean;
	/** This provider participates in the shared free-tier quota pool (gemini/groq/cerebras/openRouter/mistral).
	 *  When we're escalating BECAUSE the free tier is rate-limited, these are the throttled ones to avoid. */
	readonly isFreeTierProvider: boolean;
}

export interface PickNextFailoverOptions {
	/** "provider/model" keys already attempted this task — never re-pick these. */
	readonly excludeKeys: ReadonlySet<string>;
	/** routingPolicy === 'local-only': never escalate to a cloud provider (privacy). */
	readonly localOnly: boolean;
	/**
	 * When escalating AWAY from a failing local model we strongly prefer a cloud model
	 * (the whole point of "local failed, use my capable cloud key").
	 */
	readonly preferNonLocal: boolean;
	/**
	 * Set when we're escalating BECAUSE the free tier is rate-limited / exhausted. Free-tier providers
	 * (gemini/groq/cerebras/openRouter/mistral) are the throttled ones, so deprioritize them hard — this
	 * makes the escalation land on a configured BYO-key cloud model (e.g. Pollinations) first, then a
	 * local model, rather than bouncing through other rate-limited free providers.
	 */
	readonly avoidFreeTier?: boolean;
}

export function modelKeyOf(m: { providerName: string; modelName: string }): string {
	return `${m.providerName}/${m.modelName}`;
}

/** Higher score = better escalation target. Pure function of the candidate + options. */
export function scoreFailoverCandidate(c: FailoverCandidate, opts: Pick<PickNextFailoverOptions, 'preferNonLocal' | 'avoidFreeTier'>): number {
	let s = 0;
	if (opts.preferNonLocal) {
		// Escalating from a failing local model: cloud first, by a wide margin.
		s += c.isLocal ? 0 : 1000;
	}
	if (opts.avoidFreeTier && c.isFreeTierProvider) {
		// We're here because the free tier is throttled — push those providers below both a BYO-key cloud
		// model and a local model so the escalation doesn't just hit another rate-limited free provider.
		s -= 5000;
	}
	if (c.isKnownCapableProvider) { s += 200; }
	if (c.hasNativeToolCalls) { s += 100; }
	if (c.isCoder) { s += 40; }
	// Tie-break on context window (capped so a huge-context but weak model can't dominate).
	s += Math.min(Math.max(c.contextWindow, 0), 256_000) / 10_000;
	return s;
}

/**
 * Choose the best untried model to fail over to, or null if none qualifies.
 * Deterministic: ties broken by score then by stable key order.
 */
export function pickNextFailoverModel(
	candidates: readonly FailoverCandidate[],
	opts: PickNextFailoverOptions,
): FailoverCandidate | null {
	const eligible = candidates.filter(c => {
		if (opts.excludeKeys.has(modelKeyOf(c))) { return false; }
		if (opts.localOnly && !c.isLocal) { return false; }
		return true;
	});
	if (eligible.length === 0) { return null; }
	const scoreOpts = { preferNonLocal: opts.preferNonLocal, avoidFreeTier: opts.avoidFreeTier };
	eligible.sort((a, b) => {
		const d = scoreFailoverCandidate(b, scoreOpts) - scoreFailoverCandidate(a, scoreOpts);
		if (d !== 0) { return d; }
		return modelKeyOf(a).localeCompare(modelKeyOf(b));
	});
	return eligible[0];
}

/** Convenience: candidate -> ModelSelection. */
export function toModelSelection(c: FailoverCandidate): ModelSelection {
	return { providerName: c.providerName, modelName: c.modelName };
}

/** Lightweight name heuristic for coder-tuned models (used when capability data is absent). */
export function isLikelyCoderModelName(modelName: string): boolean {
	const n = modelName.toLowerCase();
	return /coder|code|deepseek|qwen|codestral|starcoder|codellama|granite-code/.test(n);
}
