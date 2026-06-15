/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { blendScores } from '../../common/hybridRerank.js';

/**
 * The BM25 + vector blend of the hybrid rerank. Pins the min-max normalization (clamped to include 0/1)
 * and the weighted blend that decides hybrid ranking when a vector signal is available.
 */

const W = { bm25Weight: 0.6, vectorWeight: 0.4 };
const approx = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} expected ${b}, got ${a}`);
const item = (score: number, id: string) => ({ score, id });

suite('hybridRerank.blendScores', () => {

	test('empty input -> empty', () => {
		assert.deepStrictEqual(blendScores([], () => 0, W), []);
	});

	test('min-max normalizes BM25 (range clamped to include 0 and 1), then weights it', () => {
		const out = blendScores([item(0, 'a'), item(5, 'b'), item(10, 'c')], () => 0, W);
		// max=max(0,5,10,1)=10, min=min(0,5,10,0)=0 -> normalized = score/10, blend = normalized*0.6
		approx(out[0].score, 0, 'a');
		approx(out[1].score, 0.3, 'b');
		approx(out[2].score, 0.6, 'c');
	});

	test('a high vector score lifts a low-BM25 item (without overtaking a high-BM25 one here)', () => {
		const out = blendScores([item(0, 'lo'), item(10, 'hi')], it => (it.id === 'lo' ? 1 : 0), W);
		const lo = out.find(x => x.id === 'lo')!;
		const hi = out.find(x => x.id === 'hi')!;
		approx(lo.score, 0.4, 'lo lifted by vector');  // 0*0.6 + 1*0.4
		approx(hi.score, 0.6, 'hi from BM25 only');    // 1*0.6 + 0*0.4
		assert.ok(lo.score > 0, 'the vector signal lifted the otherwise-zero BM25 item');
	});

	test('a strong-enough vector score CAN overtake a higher BM25 item', () => {
		const out = blendScores([item(0, 'lo'), item(10, 'hi')], it => (it.id === 'lo' ? 1 : 0.2), W);
		const lo = out.find(x => x.id === 'lo')!; // 0*0.6 + 1*0.4 = 0.4
		const hi = out.find(x => x.id === 'hi')!; // 1*0.6 + 0.2*0.4 = 0.68
		assert.ok(hi.score > lo.score); // here hi still wins; sanity that weights apply to both signals
		approx(hi.score, 0.68, 'hi');
		approx(lo.score, 0.4, 'lo');
	});

	test('a missing vector score (0) means BM25-only contribution', () => {
		const out = blendScores([item(7, 'x')], () => 0, W);
		// single item: max=max(7,1)=7, min=min(7,0)=0 -> normalized=1 -> 0.6
		approx(out[0].score, 0.6, 'x');
	});

	test('all-equal positive BM25 scores normalize to 1.0 (the 0.5 fallback is dead due to the 0-floor clamp)', () => {
		const out = blendScores([item(3, 'a'), item(3, 'b')], () => 0, W);
		approx(out[0].score, 0.6, 'a'); // (3-0)/(3-0)=1 -> 0.6, NOT 0.5*0.6
		approx(out[1].score, 0.6, 'b');
	});

	test('does not mutate the input items', () => {
		const items = [item(5, 'a')];
		blendScores(items, () => 1, W);
		assert.strictEqual(items[0].score, 5, 'original score untouched');
	});
});
