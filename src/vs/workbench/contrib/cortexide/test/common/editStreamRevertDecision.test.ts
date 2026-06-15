/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { decideStreamRevert, rangesOverlap, LineRange } from '../../common/editStreamRevertDecision.js';

/**
 * The streaming SEARCH/REPLACE revert decision (extracted from editCodeService). A wrong overlap test
 * risks silent data loss, so the contract is pinned here.
 */

suite('editStreamRevertDecision.rangesOverlap', () => {

	test('disjoint ranges (one fully before the other) do NOT overlap', () => {
		assert.strictEqual(rangesOverlap([1, 3], [5, 7]), false);
		assert.strictEqual(rangesOverlap([5, 7], [1, 3]), false);
	});

	test('ranges that merely TOUCH at an endpoint DO overlap (matches the inline rule)', () => {
		// a[1] === b[0]: hasNoOverlap = (3 < 3 || 1 > 5) = false -> overlap
		assert.strictEqual(rangesOverlap([1, 3], [3, 5]), true);
		assert.strictEqual(rangesOverlap([3, 5], [1, 3]), true);
	});

	test('contained, identical, and partially-overlapping ranges overlap', () => {
		assert.strictEqual(rangesOverlap([2, 9], [4, 5]), true); // b inside a
		assert.strictEqual(rangesOverlap([4, 5], [2, 9]), true); // a inside b
		assert.strictEqual(rangesOverlap([1, 5], [1, 5]), true); // identical
		assert.strictEqual(rangesOverlap([1, 5], [4, 8]), true); // partial
	});

	test('adjacent-but-not-touching ranges (gap of 1 line) do NOT overlap', () => {
		assert.strictEqual(rangesOverlap([1, 3], [4, 6]), false); // 3 < 4 -> no overlap
	});
});

suite('editStreamRevertDecision.decideStreamRevert', () => {

	test('a locate error reverts and surfaces that error verbatim (takes precedence)', () => {
		assert.deepStrictEqual(
			decideStreamRevert({ originalBoundsError: 'Not found', thisBlockRange: null, existingRanges: [] }),
			{ revert: true, errorMessage: 'Not found' },
		);
		assert.deepStrictEqual(
			decideStreamRevert({ originalBoundsError: 'Not unique', thisBlockRange: null, existingRanges: [[1, 2]] }),
			{ revert: true, errorMessage: 'Not unique' },
		);
	});

	test('a located block that overlaps an applied block reverts with "Has overlap"', () => {
		assert.deepStrictEqual(
			decideStreamRevert({ originalBoundsError: null, thisBlockRange: [4, 6], existingRanges: [[1, 3], [6, 9]] }),
			{ revert: true, errorMessage: 'Has overlap' }, // [4,6] touches [6,9]
		);
	});

	test('a located block with no overlap does NOT revert', () => {
		assert.deepStrictEqual(
			decideStreamRevert({ originalBoundsError: null, thisBlockRange: [4, 5], existingRanges: [[1, 3], [7, 9]] }),
			{ revert: false, errorMessage: null },
		);
	});

	test('the first applied block (no existing ranges) never overlaps', () => {
		assert.deepStrictEqual(
			decideStreamRevert({ originalBoundsError: null, thisBlockRange: [1, 100], existingRanges: [] }),
			{ revert: false, errorMessage: null },
		);
	});

	test('overlap is checked against ANY existing range (some-semantics)', () => {
		const existing: LineRange[] = [[1, 2], [10, 12], [20, 22]];
		assert.strictEqual(decideStreamRevert({ originalBoundsError: null, thisBlockRange: [11, 11], existingRanges: existing }).revert, true);
		assert.strictEqual(decideStreamRevert({ originalBoundsError: null, thisBlockRange: [15, 16], existingRanges: existing }).revert, false);
	});
});
