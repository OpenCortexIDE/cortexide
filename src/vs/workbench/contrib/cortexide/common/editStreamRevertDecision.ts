/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The "should we throw away every block applied so far and re-prompt?" decision for the streaming
 * SEARCH/REPLACE apply path, extracted from editCodeService so it is node-testable. During a multi-block
 * edit, each new block is located in the ORIGINAL file; if it can't be located (an error string) or its
 * target range OVERLAPS a block already applied this stream, the whole edit is reverted and the model is
 * asked to re-output all blocks. Getting the overlap test wrong risks silent data loss (a good edit
 * thrown away, or a conflicting edit applied), so the predicate is pinned here. The side effects (delete
 * tracking zones, rewrite the file, abort the stream) stay in the service -- this only DECIDES.
 *
 * Byte-identical to the old inline `if (typeof originalBounds === 'string' || hasOverlap)` check.
 */

export type LineRange = readonly [number, number]; // inclusive [startLine, endLine]

/**
 * Whether two inclusive line ranges overlap. Mirrors the inline rule exactly:
 *   hasNoOverlap = a[1] < b[0] || a[0] > b[1];  overlap = !hasNoOverlap
 * so ranges that merely TOUCH at an endpoint (a[1] === b[0]) DO count as overlapping.
 */
export function rangesOverlap(a: LineRange, b: LineRange): boolean {
	return !(a[1] < b[0] || a[0] > b[1]);
}

export interface StreamRevertInputs {
	/** The error string from locating this block's ORIGINAL text (e.g. 'Not found' / 'Not unique'), or null when it was located. */
	readonly originalBoundsError: string | null;
	/** This block's final-range [start,end], or null when it could not be located (originalBoundsError set). */
	readonly thisBlockRange: LineRange | null;
	/** The bounds of the blocks already applied this stream (compared for overlap). */
	readonly existingRanges: readonly LineRange[];
}

export interface StreamRevertDecision {
	/** True => revert ALL blocks applied so far and re-prompt the model from the first block. */
	readonly revert: boolean;
	/** The error to surface + retry on when reverting (the locate error, or 'Has overlap'); null when not reverting. */
	readonly errorMessage: string | null;
}

export function decideStreamRevert(inputs: StreamRevertInputs): StreamRevertDecision {
	// A block whose ORIGINAL text couldn't be located is an immediate revert (the model mis-quoted the file).
	if (inputs.originalBoundsError !== null) {
		return { revert: true, errorMessage: inputs.originalBoundsError };
	}
	// Otherwise revert iff this block's target range collides with one already applied this stream.
	const overlaps = inputs.thisBlockRange !== null
		&& inputs.existingRanges.some(r => rangesOverlap(inputs.thisBlockRange as LineRange, r));
	if (overlaps) {
		return { revert: true, errorMessage: 'Has overlap' };
	}
	return { revert: false, errorMessage: null };
}
