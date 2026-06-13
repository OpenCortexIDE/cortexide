/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { partialSort } from '../../common/partialSort.js';

/**
 * The O(n log k) top-k-by-score min-heap used by the BM25 rerank. The differential fuzz is the strong
 * one: the SET of scores it returns must equal a full sort's top-k scores (it tolerates 0.1 ties, so we
 * compare the score multiset, not exact order).
 */

const it = (score: number, id: number) => ({ score, id });
const scoresSorted = (xs: { score: number }[]) => xs.map(x => x.score).sort((a, b) => a - b);

suite('partialSort - golden', () => {

	test('returns at most k items, highest scores first', () => {
		const out = partialSort([it(1, 0), it(9, 1), it(5, 2), it(7, 3)], 2);
		assert.strictEqual(out.length, 2);
		assert.deepStrictEqual(out.map(x => x.score), [9, 7]);
	});

	test('k >= length returns everything (sorted descending)', () => {
		const out = partialSort([it(3, 0), it(1, 1), it(2, 2)], 10);
		assert.deepStrictEqual(out.map(x => x.score), [3, 2, 1]);
	});

	test('empty input -> empty', () => {
		assert.deepStrictEqual(partialSort([], 5), []);
	});

	test('k = 0 returns nothing', () => {
		assert.deepStrictEqual(partialSort([it(5, 0), it(3, 1)], 0), []);
	});
});

function mulberry32(a: number): () => number {
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

suite('partialSort - differential fuzz vs full sort', () => {

	test('the returned score multiset equals the full-sort top-k (20k random arrays)', () => {
		const rnd = mulberry32(0x70F5);
		const pick = (n: number) => Math.floor(rnd() * n);

		for (let iter = 0; iter < 20000; iter++) {
			const n = pick(40);
			// integer scores spread enough that 0.1 ties don't blur distinct values -> exact multiset check
			const items = Array.from({ length: n }, (_, id) => it(pick(50), id));
			const k = pick(n + 3); // include k > n and k === 0

			const got = partialSort(items.slice(), k);
			const expected = items.slice().sort((a, b) => b.score - a.score).slice(0, Math.min(k, n));

			assert.strictEqual(got.length, expected.length, `length mismatch iter ${iter} (n=${n}, k=${k})`);
			assert.deepStrictEqual(scoresSorted(got), scoresSorted(expected), `top-k score multiset mismatch iter ${iter}`);
		}
	});
});
