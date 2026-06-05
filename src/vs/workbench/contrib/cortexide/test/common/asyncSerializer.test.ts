/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { createSerializer } from '../../common/asyncSerializer.js';

const tick = (ms: number) => new Promise(r => setTimeout(r, ms));

suite('asyncSerializer', () => {
	test('runs tasks strictly one-at-a-time, in submission order (no interleaving)', async () => {
		const s = createSerializer();
		const events: string[] = [];
		const task = (id: string, ms: number) => s.run(async () => {
			events.push(`${id}:start`);
			await tick(ms);
			events.push(`${id}:end`);
		});
		// Submit A (slow) then B (fast). Without serialization B would start before A ends.
		const a = task('A', 30);
		const b = task('B', 1);
		await Promise.all([a, b]);
		assert.deepStrictEqual(events, ['A:start', 'A:end', 'B:start', 'B:end']);
	});

	test('returns each task result to its own caller', async () => {
		const s = createSerializer();
		const [x, y] = await Promise.all([s.run(() => 1), s.run(async () => { await tick(1); return 2; })]);
		assert.strictEqual(x, 1);
		assert.strictEqual(y, 2);
	});

	test('a rejecting task does not wedge the lock (next task still runs) and the rejection propagates', async () => {
		const s = createSerializer();
		const boom = s.run(async () => { throw new Error('boom'); });
		await assert.rejects(boom, /boom/);
		const after = await s.run(() => 'ok');
		assert.strictEqual(after, 'ok');
	});

	test('single idle task runs immediately (no-op for sequential use)', async () => {
		const s = createSerializer();
		assert.strictEqual(await s.run(() => 'immediate'), 'immediate');
	});
});
