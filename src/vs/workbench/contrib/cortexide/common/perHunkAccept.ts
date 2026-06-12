/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ComputedDiff } from './editCodeServiceTypes.js';

/**
 * The pure line/range arithmetic behind per-hunk Accept and Reject, extracted from editCodeService so it
 * is node-testable. These splices are where the off-by-one boundary bugs live (deletion past the diff-area
 * end, insertion of the final newline, sequential accepts).
 *
 *  - computeAcceptedOriginalCode: on ACCEPT, fold the hunk's `code` into the diff-area's originalCode so
 *    the now-accepted text becomes the new baseline (mirrors editCodeService.acceptDiff).
 *  - computeRejectWrite: on REJECT, compute the {text, range} to write back to the model to undo the hunk
 *    (mirrors editCodeService.rejectDiff). The range is a plain IRange-shaped object (no editor import).
 */

/** Plain IRange-shaped range (matches editor IRange structurally, so the service can pass it straight through). */
export interface RejectRange {
	startLineNumber: number;
	startColumn: number;
	endLineNumber: number;
	endColumn: number;
}

export interface RejectWrite {
	writeText: string;
	toRange: RejectRange;
}

/** ACCEPT: produce the new diff-area originalCode with `diff` folded in. Pure; byte-identical to acceptDiff. */
export function computeAcceptedOriginalCode(originalCode: string, diff: ComputedDiff): string {
	const originalLines = originalCode.split('\n');

	if (diff.type === 'deletion') {
		return [
			...originalLines.slice(0, (diff.originalStartLine - 1)), // everything before startLine
			// <-- deletion has nothing here
			...originalLines.slice((diff.originalEndLine - 1) + 1, Infinity) // everything after endLine
		].join('\n');
	}
	else if (diff.type === 'insertion') {
		return [
			...originalLines.slice(0, (diff.originalStartLine - 1)), // everything before startLine
			diff.code, // code
			...originalLines.slice((diff.originalStartLine - 1), Infinity) // startLine (inclusive) and on (no +1)
		].join('\n');
	}
	else if (diff.type === 'edit') {
		return [
			...originalLines.slice(0, (diff.originalStartLine - 1)), // everything before startLine
			diff.code, // code
			...originalLines.slice((diff.originalEndLine - 1) + 1, Infinity) // everything after endLine
		].join('\n');
	}
	else {
		throw new Error(`CortexIDE error: diff.type not recognized`);
	}
}

/**
 * REJECT: compute the text + range to write to undo `diff`. `diffAreaEndLine` is the current diff-area's
 * end line (the model's 1-indexed line); it disambiguates the "hunk reaches the end of the zone" cases
 * where applying to the next line would round wrong. Pure; byte-identical to rejectDiff's range math.
 */
export function computeRejectWrite(diff: ComputedDiff, diffAreaEndLine: number): RejectWrite {
	// deletion: re-insert the deleted original lines
	if (diff.type === 'deletion') {
		// if startLine is out of bounds (deleted lines past the diffarea), applyEdit rounds oddly, so apply
		// to the line before instead.
		if (diff.startLine - 1 === diffAreaEndLine) {
			return {
				writeText: '\n' + diff.originalCode,
				toRange: { startLineNumber: diff.startLine - 1, startColumn: Number.MAX_SAFE_INTEGER, endLineNumber: diff.startLine - 1, endColumn: Number.MAX_SAFE_INTEGER },
			};
		}
		return {
			writeText: diff.originalCode + '\n',
			toRange: { startLineNumber: diff.startLine, startColumn: 1, endLineNumber: diff.startLine, endColumn: 1 },
		};
	}
	// insertion: delete the inserted lines
	else if (diff.type === 'insertion') {
		// the insertion was a newline at the end of the diffarea: deleting the next line doesn't work
		// (it doesn't exist), so delete the line before instead.
		if (diff.endLine === diffAreaEndLine) {
			return {
				writeText: '',
				toRange: { startLineNumber: diff.startLine - 1, startColumn: Number.MAX_SAFE_INTEGER, endLineNumber: diff.endLine, endColumn: 1 },
			};
		}
		return {
			writeText: '',
			toRange: { startLineNumber: diff.startLine, startColumn: 1, endLineNumber: diff.endLine + 1, endColumn: 1 },
		};
	}
	// edit: swap the edited lines back for the original
	else if (diff.type === 'edit') {
		return {
			writeText: diff.originalCode,
			toRange: { startLineNumber: diff.startLine, startColumn: 1, endLineNumber: diff.endLine, endColumn: Number.MAX_SAFE_INTEGER },
		};
	}
	else {
		throw new Error(`CortexIDE error: diff.type not recognized`);
	}
}
