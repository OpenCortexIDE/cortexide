/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure search/replace ORIGINAL-block matching, extracted from the browser editCodeService so it is
 * node-unit-testable (the browser layer is excluded from the node runner). `findTextInCode` locates a
 * SEARCH/REPLACE block's ORIGINAL text inside a file and returns its 1-indexed line range, or a reason
 * string when the match is ambiguous or absent. The caller maps those reason strings to a corrective
 * message that asks the model to fix its ORIGINAL block (see editCodeService._errContentOfInvalidStr).
 *
 * Layer: `common/`. Pure - no I/O, no vs/service imports. Tested in `test/common/searchReplaceMatch.test.ts`.
 */

/** Number of lines in a string (1 for a string with no newline). */
const numLinesOfStr = (str: string) => str.split('\n').length;

/** Collapse every run of non-newline whitespace to nothing (used for the whitespace-insensitive fallback match). */
const removeWhitespaceExceptNewlines = (str: string): string => {
	return str.replace(/[^\S\n]+/g, '');
};

export type FindTextInCodeResult = readonly [number, number] | 'Not found' | 'Not unique';

/**
 * Find `text` (a block's ORIGINAL) in `fileContents` and return its 1-indexed [startLine, endLine].
 *
 * - First tries an EXACT match. When searching the whole file (`startingAtLine` is undefined) the exact
 *   match must be UNIQUE: if `text` occurs more than once, returns 'Not unique' rather than silently
 *   editing the FIRST occurrence (a wrong-location edit). This mirrors the whitespace-fallback path's
 *   long-standing uniqueness check, so both paths now reject ambiguous edits consistently. When
 *   `startingAtLine` is provided the caller is doing positional/sequential matching and wants the first
 *   match at/after that line, so no uniqueness check is applied.
 * - If the exact match fails and `canFallbackToRemoveWhitespace` is set, retries ignoring non-newline
 *   whitespace; that match must also be unique.
 *
 * `startingAtLine` is 1-indexed and inclusive. Returns 'Not found' / 'Not unique' on failure.
 */
export const findTextInCode = (
	text: string,
	fileContents: string,
	canFallbackToRemoveWhitespace: boolean,
	opts: { startingAtLine?: number; returnType: 'lines' }
): FindTextInCodeResult => {

	const returnAns = (fileContents: string, idx: number) => {
		const startLine = numLinesOfStr(fileContents.substring(0, idx + 1));
		const numLines = numLinesOfStr(text);
		const endLine = startLine + numLines - 1;

		return [startLine, endLine] as const;
	};

	const startingAtLineIdx = (fileContents: string) => opts?.startingAtLine !== undefined ?
		fileContents.split('\n').slice(0, opts.startingAtLine).join('\n').length // num characters in all lines before startingAtLine
		: 0;

	// idx = starting index in fileContents
	let idx = fileContents.indexOf(text, startingAtLineIdx(fileContents));

	// if idx was found
	if (idx !== -1) {
		// Whole-file exact match must be unique: editing the first of several identical ORIGINAL blocks
		// would silently change the wrong location. (When startingAtLine is set, positional matching is
		// intended, so the first match at/after that line is correct.)
		if (opts?.startingAtLine === undefined && fileContents.lastIndexOf(text) !== idx) {
			return 'Not unique' as const;
		}
		return returnAns(fileContents, idx);
	}

	if (!canFallbackToRemoveWhitespace)
		return 'Not found' as const;

	// try to find it ignoring all whitespace this time
	text = removeWhitespaceExceptNewlines(text);
	fileContents = removeWhitespaceExceptNewlines(fileContents);
	idx = fileContents.indexOf(text, startingAtLineIdx(fileContents));

	if (idx === -1) return 'Not found' as const;
	const lastIdx = fileContents.lastIndexOf(text);
	if (lastIdx !== idx) return 'Not unique' as const;

	return returnAns(fileContents, idx);
};
