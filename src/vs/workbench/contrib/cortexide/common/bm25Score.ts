/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The lexical scoring core of the repo indexer, extracted from RepoIndexerService so it is node-testable.
 * BM25/keyword retrieval is the ONLY live RAG path (embeddings are gated/optional), so this is what ranks
 * the code context fed to the model. tokenize + scoreEntry + naiveScore are copied byte-for-byte from
 * _tokenize / _scoreEntryFast / _score; the service keeps its tokenization CACHE and delegates the math.
 */

/** The fields scoreEntry reads off an index entry (IndexEntry is structurally assignable to this). */
export interface ScorableEntry {
	readonly uri: string;
	readonly symbols: readonly string[];
	readonly snippet: string;
	readonly symbolTokens?: ReadonlySet<string>;
	readonly uriTokens?: ReadonlySet<string>;
	readonly snippetTokens?: ReadonlySet<string>;
}

/** Lowercase tokens of alphanumeric + underscore runs. (The service memoizes this in an LRU cache.) */
export function tokenize(text: string): Set<string> {
	return new Set(text.toLowerCase().split(/[^a-z0-9_]+/g).filter(Boolean));
}

/**
 * Score an index entry against a query. Higher is more relevant. Weights (byte-identical to the inline
 * _scoreEntryFast): exact symbol +10, partial symbol (containment either way) +4, symbol token overlap
 * +2/token; URI token/substring +3 (binary); snippet token overlap +1.5/token capped at 5; exact snippet
 * phrase +1. Pre-computed token sets are used when present, with a substring fallback otherwise.
 */
export function scoreEntry(q: string, qTokens: ReadonlySet<string>, entry: ScorableEntry): number {
	let score = 0;
	const qLower = q.toLowerCase();

	// Exact symbol name match (highest weight) - use pre-computed symbol tokens
	for (const sym of entry.symbols) {
		const symLower = sym.toLowerCase();
		if (symLower === qLower) {
			score += 10; // Exact match boost
		} else if (symLower.includes(qLower) || qLower.includes(symLower)) {
			score += 4; // Partial symbol match
		} else if (entry.symbolTokens) {
			// Token overlap in symbol name (using pre-computed tokens)
			for (const token of qTokens) {
				if (entry.symbolTokens.has(token)) { score += 2; }
			}
		}
	}

	// URI match (medium weight) - use pre-computed URI tokens
	if (entry.uriTokens) {
		for (const token of qTokens) {
			if (entry.uriTokens.has(token)) {
				score += 3;
				break; // URI match is binary
			}
		}
	} else {
		const uriLower = entry.uri.toLowerCase();
		if (uriLower.includes(qLower)) { score += 3; }
	}

	// Lexical overlap in snippet (weighted by token matches) - use pre-computed snippet tokens
	if (entry.snippetTokens) {
		let snippetTokenMatches = 0;
		for (const token of qTokens) {
			if (entry.snippetTokens.has(token)) {
				snippetTokenMatches++;
			}
		}
		if (snippetTokenMatches > 0) {
			// Weight by how many query tokens matched
			score += Math.min(snippetTokenMatches * 1.5, 5);
		}
	} else {
		// Fallback to old method if tokens not pre-computed
		const snippetLower = entry.snippet.toLowerCase();
		let snippetTokenMatches = 0;
		for (const token of qTokens) {
			if (snippetLower.includes(token)) {
				snippetTokenMatches++;
				if (snippetLower.split(/[^a-z0-9_]+/g).includes(token)) {
					snippetTokenMatches += 0.5;
				}
			}
		}
		if (snippetTokenMatches > 0) {
			score += Math.min(snippetTokenMatches * 1.5, 5);
		}
	}

	// Exact phrase match in snippet (lower weight but useful)
	const snippetLower = entry.snippet.toLowerCase();
	if (snippetLower.includes(qLower)) {
		score += 1;
	}

	return score;
}

/** A very naive token-overlap score (used by the context-cache fallback). Byte-identical to _score;
 *  note it does NOT lowercase the query, matching the original. */
export function naiveScore(q: string, doc: string): number {
	const qt = new Set(q.split(/[^a-z0-9_]+/g).filter(Boolean));
	let score = 0;
	for (const t of qt) { if (doc.includes(t)) { score += 1; } }
	return score;
}
