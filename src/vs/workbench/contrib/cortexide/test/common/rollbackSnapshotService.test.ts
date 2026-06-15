/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { suite, test } from 'mocha';
import * as assert from 'assert';
import { planSnapshot, snapshotFileBytes, SnapshotFile } from '../../common/snapshotBudget.js';

/**
 * Real tests for the rollback-snapshot byte budget (was a 4-test assert.ok(true) placeholder). The
 * file/model reads stay in the service (not node-testable); the greedy budget -- which the service now
 * delegates to -- is pinned here. Each file is included until one would exceed the budget, then the rest
 * are skipped and the snapshot is marked `skipped`.
 */

const f = (path: string, content: string, mtime = 0): SnapshotFile => ({ path, content, mtime });

suite('snapshotBudget.snapshotFileBytes', () => {
	test('measures UTF-8 byte length', () => {
		assert.strictEqual(snapshotFileBytes(''), 0);
		assert.strictEqual(snapshotFileBytes('abc'), 3);
		assert.strictEqual(snapshotFileBytes('a'.repeat(1000)), 1000);
	});
});

suite('snapshotBudget.planSnapshot', () => {

	test('all files fit under the budget -> all included, not skipped', () => {
		const plan = planSnapshot([f('a', 'xx'), f('b', 'yyy')], 100);
		assert.strictEqual(plan.skipped, false);
		assert.deepStrictEqual(plan.included.map(x => x.path), ['a', 'b']);
		assert.strictEqual(plan.totalBytes, 5);
	});

	test('a file that would exceed the budget truncates the set at that boundary and marks skipped', () => {
		// budget 5: 'aaa'(3) fits (total 3), 'bbb'(3) would make 6 > 5 -> skip b and everything after
		const plan = planSnapshot([f('a', 'aaa'), f('b', 'bbb'), f('c', 'c')], 5);
		assert.strictEqual(plan.skipped, true);
		assert.deepStrictEqual(plan.included.map(x => x.path), ['a']);
		assert.strictEqual(plan.totalBytes, 3);
	});

	test('exactly-at-budget is included (strict > boundary)', () => {
		const plan = planSnapshot([f('a', 'aa'), f('b', 'bbb')], 5); // 2 + 3 == 5, not > 5
		assert.strictEqual(plan.skipped, false);
		assert.deepStrictEqual(plan.included.map(x => x.path), ['a', 'b']);
	});

	test('empty input -> empty plan, not skipped', () => {
		assert.deepStrictEqual(planSnapshot([], 100), { included: [], totalBytes: 0, skipped: false });
	});

	test('a single oversized file is skipped (nothing included)', () => {
		const plan = planSnapshot([f('big', 'x'.repeat(10))], 5);
		assert.strictEqual(plan.skipped, true);
		assert.strictEqual(plan.included.length, 0);
	});

	test('greedy: once a file is skipped, later files that WOULD fit are still skipped', () => {
		// budget 5: 'a'(1) fits, big(10) skipped -> break, so 'c'(1) is never reached even though it would fit
		const plan = planSnapshot([f('a', 'a'), f('big', 'x'.repeat(10)), f('c', 'c')], 5);
		assert.strictEqual(plan.skipped, true);
		assert.deepStrictEqual(plan.included.map(x => x.path), ['a']);
	});
});
