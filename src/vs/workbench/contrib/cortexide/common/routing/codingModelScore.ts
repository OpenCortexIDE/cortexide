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
export function localModelSizeBonus(modelNameLower: string): number {
	const m = modelNameLower.match(/(\d+(?:\.\d+)?)\s*b(?:\b|$)/);
	const params = m ? parseFloat(m[1]) : 8; // unnumbered tag => assume a capable flagship size
	if (!isFinite(params) || params <= 0) {
		return 0;
	}
	return Math.min(params, 32) * 0.5; // 1.5b->0.75, 3b->1.5, 7b/latest->~4, >=32b->16
}
