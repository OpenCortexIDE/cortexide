/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Build a good web-search query from a natural-language user request.
 *
 * When the model does not emit its own web_search call, the agent SYNTHESIZES one on web intent
 * ("check online", "search the web", ...). The synthesized query must be the SUBJECT of the request,
 * not the command framing. The previous implementation took the FIRST 5 words after a tiny stop-word
 * list, so "check online and tell me when SpaceX IPO'd" became "check online and tell when" -- so
 * DuckDuckGo returned "check online" (DVLA) results and the agent honestly reported it found nothing,
 * while the real subject ("SpaceX IPO") was dropped because it appeared past word 5.
 *
 * This strips the web-intent trigger phrases and command/filler framing and keeps the remainder. It
 * is intentionally conservative: if stripping leaves nothing usable, it falls back to the original
 * request so we never search for an empty string.
 */

// Trigger phrases + command/filler framing to remove. Order does not matter (we sort by length
// descending at runtime so the longest phrase is removed first and never leaves a fragment).
const STRIP_PHRASES: readonly string[] = [
	// web-intent triggers (mirror the detectors in chatThreadService / toolSynthesisDecision)
	'search the web for', 'search online for', 'search the internet for', 'search internet for',
	'search the web', 'search online', 'search the internet', 'search internet', 'web search for',
	'web search', 'search for', 'search',
	'look up online', 'look it up online', 'look it up', 'look up', 'look online',
	'check online', 'check the web', 'check the internet', 'check internet', 'check the latest',
	'go online', 'on the internet', 'on the web', 'over the internet',
	'find information about', 'find information on', 'find information', 'find out about', 'find out',
	'tell me what you know about', 'what do you know about',
	'google for', 'google', 'duckduckgo for', 'duckduckgo', 'bing',
	// connective / politeness framing
	'and tell me about', 'and tell me', 'and let me know', 'and find out', 'and report back',
	'and report', 'and give me', 'tell me about', 'tell me', 'let me know', 'give me',
	'please', 'can you', 'could you', 'would you', 'for me', 'right now', 'currently', 'today',
];

const LEADING_FILLER = /^(?:and|then|also|so|to|the|a|an|about|for|of|on|in|please|just|now|me|what|is|are|the)\s+/i;

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractWebSearchQuery(request: string): string {
	const original = (request ?? '').trim();
	if (!original) { return ''; }

	let q = original;
	// Remove trigger/framing phrases, longest first, as whole tokens (so "search" inside "research"
	// is not touched -- \b boundaries).
	const phrases = [...STRIP_PHRASES].sort((a, b) => b.length - a.length);
	for (const p of phrases) {
		q = q.replace(new RegExp('\\b' + escapeRegExp(p) + '\\b', 'gi'), ' ');
	}

	q = q.replace(/\s+/g, ' ').trim();
	// Strip leading filler/conjunctions repeatedly (e.g. "and then the ...").
	let prev: string;
	do { prev = q; q = q.replace(LEADING_FILLER, '').trim(); } while (q !== prev);
	// Trim trailing punctuation/conjunction debris.
	q = q.replace(/[\s,;:.\-]+$/g, '').replace(/\s+(and|or|the|a|an)$/i, '').trim();

	// If we stripped it down to nothing meaningful, fall back to the original request -- a slightly
	// noisy real-subject query still beats an empty/garbage one.
	if (q.length < 2 || !/[a-z0-9]/i.test(q)) { return original; }
	return q;
}
