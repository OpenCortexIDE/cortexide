/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure scoring bonus that rewards code-tuned models on code / agentic tasks.
 *
 * The model router used to apply this ONLY on "regular" code tasks (writing/editing code),
 * but NOT on the "codebase question" / agentic-reasoning path — so a weak general local model
 * (e.g. llama3.2:3b) could tie or beat a coding-tuned local model (e.g. qwen2.5-coder:7b) for
 * exactly the agentic requests that need a good coder. This helper is now applied on BOTH code
 * paths so a coding-tuned local model reliably wins code/agentic routing.
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/codingModelScore.test.ts`.
 */

/** Substrings that mark a model name as code-tuned. */
const CODER_NAME_HINTS: readonly string[] = ['code', 'coder', 'devstral', 'codestral'];

/**
 * Returns the additive score bonus for `modelNameLower` (already lowercased) given whether the
 * model supports Fill-in-Middle. `+30` for FIM (strong code-editing signal) and `+25` for a
 * code-tuned name; a general model with neither gets `0`.
 */
export function codingModelScoreBonus(modelNameLower: string, supportsFIM: boolean): number {
	let bonus = 0;
	if (supportsFIM) {
		bonus += 30;
	}
	if (CODER_NAME_HINTS.some(hint => modelNameLower.includes(hint))) {
		bonus += 25;
	}
	return bonus;
}

/**
 * Small, capped tie-breaker that prefers a LARGER model within the same family for code/agentic
 * work. Local coders often share identical capability data (e.g. qwen2.5-coder:1.5b and :latest both
 * report 32k context + FIM), so without this the router can pick a too-small coder. The bonus is
 * intentionally tiny so it only breaks ties — it never overrides the coder>general or online>local
 * signals. Apply to LOCAL models only (cloud names rarely carry a parameter count).
 *
 * Parses a parameter count like "7b" / "1.5b" / "32b" from the tag; an unnumbered tag (":latest",
 * ":instruct") is assumed to be the flagship size (capable) rather than the smallest.
 */
/**
 * Parse a parameter count in BILLIONS from either an ollama `details.parameter_size` string
 * ("7.6B", "1.3B", "32B") or a model tag ("7b", "1.5b"). Returns null if no count is present
 * (e.g. an unnumbered tag like ":latest"). Not fooled by a version number ("qwen2.5-coder" -> null;
 * "qwen2.5-coder:1.5b" -> 1.5).
 */
export function parseParamSizeBillions(s: string | undefined | null): number | null {
	if (!s || typeof s !== 'string') { return null; }
	const m = s.toLowerCase().match(/(\d+(?:\.\d+)?)\s*b(?:\b|$)/);
	if (!m) { return null; }
	const n = parseFloat(m[1]);
	return isFinite(n) && n > 0 ? n : null;
}

/**
 * The model's parameter count in billions: the REAL size (ollama `details.parameter_size`) if known,
 * else parsed from the name tag, else 8 (an unnumbered/flagship tag like ":latest" whose real size we
 * don't have — assume capable). Passing the real size is what stops a tiny ":latest" coder (e.g.
 * deepseek-coder:latest ~1.3B) from being mistaken for a flagship.
 */
function effectiveParamsBillions(modelNameLower: string, realParamSize?: string): number {
	return parseParamSizeBillions(realParamSize) ?? parseParamSizeBillions(modelNameLower) ?? 8;
}

export function localModelSizeBonus(modelNameLower: string, realParamSize?: string): number {
	const params = effectiveParamsBillions(modelNameLower, realParamSize);
	return Math.min(params, 32) * 0.5; // 1.5b->0.75, 3b->1.5, 7b/latest->~4, >=32b->16
}

/**
 * Decisive demotion for too-small LOCAL coders on CODE / agentic tasks.
 *
 * A 1.5B-3B model is below the agentic floor (it fumbles multi-step tool loops), yet local coders
 * share identical capability data, so the tiny `localModelSizeBonus` tie-break (a ~1.75-pt final edge
 * after the learned-score blend) is too weak: a lucky learned-score swing or sort order can hand an
 * agent task to a 3B over a 7B. This pushes a sub-7B local coder clearly below a 7B+ one — by more
 * than the blend can flip — but ONLY demotes: resolveAutoModelSelection still returns a small model
 * when it's the only one installed (never excluded). Apply on local models for taskType === 'code'.
 *
 * Returns 0 for >= 7B and for unnumbered/flagship tags (":latest"); a negative penalty below that.
 */
export function smallLocalModelCodePenalty(modelNameLower: string, realParamSize?: string): number {
	// Prefer the real size; else the name tag. An unnumbered tag with NO known real size is assumed a
	// flagship (no penalty) — but if the real size IS known (e.g. deepseek-coder:latest = "1.3B"), a
	// tiny ":latest" coder is correctly penalized.
	const params = parseParamSizeBillions(realParamSize) ?? parseParamSizeBillions(modelNameLower);
	if (params == null) { return 0; } // truly unknown => assume flagship
	if (params >= 7) { return 0; }
	if (params <= 3) { return -15; } // 1.5B / 3B: clearly below the agentic floor
	return -8; // 3B < p < 7B (e.g. 4B/5B): moderately under-sized for agentic coding
}

/**
 * Is this LOCAL model name a coder big enough for agentic work? True for a coder-named tag that is
 * >= 7B (or an unnumbered/flagship tag like ":latest", assumed capable). Used by onboarding to decide
 * whether to offer pulling a capable coder when a fresh user has ollama running but only tiny models.
 *
 * Conservative on the unnumbered case (treats ":latest" as capable) so we DON'T nag a user who has a
 * real flagship coder; the cost of a rare false-positive (skipping the offer) is lower than nagging.
 */
export function isCapableLocalCoder(modelNameLower: string, realParamSize?: string): boolean {
	if (codingModelScoreBonus(modelNameLower, false) < 25) { return false; } // not a coder by name
	const params = parseParamSizeBillions(realParamSize) ?? parseParamSizeBillions(modelNameLower);
	if (params == null) { return true; } // unnumbered, unknown real size => assume capable
	return params >= 7;
}

/**
 * Is this LOCAL model capable enough (by SIZE alone) to be offered the WEB tools (web_search,
 * browse_url)? Unlike isCapableLocalCoder this does NOT require a coder -- web search is a general
 * capability, so any sufficiently large local model (>= 7B, or an unnumbered/flagship ":latest" tag
 * whose real size we don't have -> assume capable) qualifies. Small/weak models (<= ~3B) still get
 * only the COMPACT toolset (no web) because they fumble the agentic loop.
 *
 * Fixes Auto resolving to a capable GENERAL model (e.g. llama3:8b) which was then denied web_search
 * by the coder-only gate and answered "SpaceX has not gone public" from stale training knowledge.
 */
export function isCapableLocalModel(modelNameLower: string, realParamSize?: string): boolean {
	const params = parseParamSizeBillions(realParamSize) ?? parseParamSizeBillions(modelNameLower);
	if (params == null) { return true; } // unnumbered/flagship (":latest") -> assume capable
	return params >= 7;
}

/**
 * Pick the most capable coder from a list of model NAMES (tags) for a LOCAL provider, reusing the
 * same coder + size signal the router uses. Prefers a code-tuned name, breaks ties by larger param
 * count; falls back to the largest model when none are coders, and to the sole entry for a one-item
 * list. Returns null only for an empty list.
 *
 * Shared by resolveAutoModelSelection (the out-of-box Auto default) and onboarding so a brand-new
 * user is put on a capable coder rather than whatever ollama happens to list first — with a single
 * definition of "best coder" so the two never diverge.
 */
export function pickBestCoderModelName(modelNames: readonly string[], sizeOf?: (name: string) => string | undefined): string | null {
	if (!modelNames || modelNames.length === 0) { return null; }
	let best: string | null = null;
	let bestScore = -Infinity;
	for (const name of modelNames) {
		const lower = name.toLowerCase();
		// coder signal (FIM isn't known from a bare tag) + size tie-break. sizeOf supplies the REAL
		// param size (ollama parameter_size) when known, so a tiny ":latest" coder doesn't win by tag.
		const score = codingModelScoreBonus(lower, false) + localModelSizeBonus(lower, sizeOf?.(name));
		if (score > bestScore) { bestScore = score; best = name; }
	}
	return best;
}
