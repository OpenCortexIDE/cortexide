/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure transaction for the `multi_edit` tool: apply a list of literal find/replace edits to one file's
 * text. Extracted to `common/` so it is node-unit-testable (the browser apply layer is excluded from the
 * node runner) and fuzzable against the existing single-edit engine.
 *
 * Semantics (these match the model-facing prompt and standard multi-edit tools):
 *  - Edits are applied STRICTLY IN SEQUENCE: each edit operates on the text produced by the edits before
 *    it. So a later edit may target text an earlier edit introduced, and may NOT target text an earlier
 *    edit consumed.
 *  - `replaceAll === false` (the default): `oldString` must occur EXACTLY ONCE in the current text. If it
 *    is absent the edit fails 'Not found'; if it occurs more than once it fails 'Not unique' (rather than
 *    silently editing the first of several identical spans -- a wrong-location edit). This uniqueness test
 *    mirrors common/searchReplaceMatch.findTextInCode (indexOf === lastIndexOf), so a single non-replaceAll
 *    edit behaves exactly like edit_file.
 *  - `replaceAll === true`: every (non-overlapping, left-to-right) occurrence of `oldString` is replaced.
 *    The match must still occur at least once, else the edit fails 'Not found'. This is the case the old
 *    block-expansion implementation could not handle at all (it emitted N identical Search/Replace blocks,
 *    which the span engine rejected as 'Not unique' / 'Has overlap').
 *
 * The whole thing is ALL-OR-NOTHING: validation and rewriting happen on a local copy, and the first failing
 * edit returns `ok: false` WITHOUT having mutated anything the caller can see, so the caller throws before
 * any write -- the file is never left partially edited.
 *
 * Matching is LITERAL (whitespace included), consistent with the tool's contract; there is no
 * whitespace-insensitive fallback (multi_edit never relied on one).
 *
 * Layer: `common/`. Pure - no I/O, no vs/service imports. Tested in `test/common/multiEdit.test.ts`.
 */

/** One edit: replace `oldString` with `newString` (all occurrences when `replaceAll`). */
export interface MultiEditSpec {
	readonly oldString: string;
	readonly newString: string;
	readonly replaceAll: boolean;
}

export type MultiEditResult =
	| { ok: true; newContent: string; replacements: number }
	| { ok: false; reason: 'Not found' | 'Not unique'; editIndex: number; oldString: string };

/** Replace every non-overlapping, left-to-right occurrence of `needle` in `s` with `repl` (literal). */
const replaceAllLiteral = (s: string, needle: string, repl: string): { out: string; count: number } => {
	const parts = s.split(needle);
	return { out: parts.join(repl), count: parts.length - 1 };
};

/**
 * Apply `edits` to `content` in sequence. See the module doc for the exact semantics. Returns the rewritten
 * text plus the total number of textual replacements, or the index/reason of the first edit that failed.
 */
export const computeMultiEditResult = (
	content: string,
	edits: ReadonlyArray<MultiEditSpec>
): MultiEditResult => {
	let cur = content;
	let replacements = 0;

	for (let i = 0; i < edits.length; i++) {
		const { oldString, newString, replaceAll } = edits[i];

		const firstIdx = cur.indexOf(oldString);
		if (firstIdx === -1) {
			return { ok: false, reason: 'Not found', editIndex: i, oldString };
		}

		if (replaceAll) {
			const { out, count } = replaceAllLiteral(cur, oldString, newString);
			cur = out;
			replacements += count;
		} else {
			// Must be unique (same test as findTextInCode): editing the first of several identical spans
			// would silently change the wrong place. The model should add context or set replace_all.
			if (cur.lastIndexOf(oldString) !== firstIdx) {
				return { ok: false, reason: 'Not unique', editIndex: i, oldString };
			}
			cur = cur.slice(0, firstIdx) + newString + cur.slice(firstIdx + oldString.length);
			replacements += 1;
		}
	}

	return { ok: true, newContent: cur, replacements };
};
