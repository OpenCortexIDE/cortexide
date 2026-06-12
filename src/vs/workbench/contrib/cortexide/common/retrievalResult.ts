/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure structured shape of a codebase-retrieval hit + the formatter for its citation block.
 * Extracted from repoIndexerService._formatResult so it is node-testable and the file URI is a
 * discrete field (consumers were doing URI.file() on the whole formatted string -> a bogus URI).
 */

export interface RetrievalResult {
	readonly uri: string;
	readonly symbols: readonly string[];
	readonly snippet: string;
	readonly startLine: number;
	readonly endLine: number;
}

/** Rank query-overlapping symbols first (either containment direction), at most 5 of each, capped at 10. */
export function prioritizeSymbols(symbols: readonly string[], query: string): string[] {
	if (symbols.length === 0) { return []; }
	const qLower = query.toLowerCase();
	const matching = symbols.filter(s => s.toLowerCase().includes(qLower) || qLower.includes(s.toLowerCase()));
	const other = symbols.filter(s => !matching.includes(s));
	return [...matching.slice(0, 5), ...other.slice(0, 5)].slice(0, 10);
}

/** Render the citation block, byte-identical to the old RepoIndexerService._formatResult. */
export function formatRetrievalResult(r: RetrievalResult, query: string): string {
	const parts: string[] = [];

	const citation = r.startLine === r.endLine ? `${r.startLine}` : `${r.startLine}-${r.endLine}`;
	parts.push(`File: ${r.uri}:${citation}`);

	if (r.symbols.length > 0) {
		parts.push(`Symbols: ${prioritizeSymbols(r.symbols, query).join(', ')}`);
	}

	if (r.snippet) {
		parts.push(`Content preview:\n${r.snippet}`);
	}

	return parts.join('\n');
}
