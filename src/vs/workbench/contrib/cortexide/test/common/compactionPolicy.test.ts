/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { shouldCompactConversation, selectCompactionWindow, CompactionDecisionInput } from '../../common/compactionPolicy.js';

const base: CompactionDecisionInput = {
	enabled: true,
	chatMode: 'agent',
	promptTokens: 80_000,
	contextWindow: 100_000,
	messageCount: 40,
	iterationsSinceLastCompaction: 10,
};

suite('compactionPolicy.shouldCompactConversation', () => {
	test('compacts when enabled, agent mode, long, over threshold, cooled down', () => {
		assert.strictEqual(shouldCompactConversation(base), true);
	});

	test('disabled => never compacts (the default-off safety)', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, enabled: false }), false);
	});

	test('normal/gather chat never compacts', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, chatMode: 'normal' }), false);
		assert.strictEqual(shouldCompactConversation({ ...base, chatMode: 'gather' }), false);
	});

	test('plan mode is eligible', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, chatMode: 'plan' }), true);
	});

	test('below threshold => no compaction', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, promptTokens: 60_000 }), false); // 60%
	});

	test('above the bail ceiling (too full for a summary call) => no compaction', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, promptTokens: 95_000 }), false); // 95% > 92%
	});

	test('too few messages => no compaction', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, messageCount: 8 }), false);
	});

	test('too soon after last compaction => no compaction (anti-loop)', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, iterationsSinceLastCompaction: 1 }), false);
	});

	test('zero/invalid context window or tokens => no compaction', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, contextWindow: 0 }), false);
		assert.strictEqual(shouldCompactConversation({ ...base, promptTokens: 0 }), false);
	});

	test('custom threshold respected', () => {
		assert.strictEqual(shouldCompactConversation({ ...base, promptTokens: 65_000, thresholdPct: 0.6 }), true);
	});
});

suite('compactionPolicy.selectCompactionWindow', () => {
	test('keeps head + recent, summarizes the middle', () => {
		const w = selectCompactionWindow(40, 6, 1);
		assert.deepStrictEqual(w, { start: 1, end: 34 });
	});

	test('returns null when the middle is too small to bother', () => {
		assert.strictEqual(selectCompactionWindow(8, 6, 1), null); // middle = [1,2) -> 1 msg < minWindow
	});

	test('respects custom keepRecent/keepHead', () => {
		const w = selectCompactionWindow(30, 10, 2);
		assert.deepStrictEqual(w, { start: 2, end: 20 });
	});

	test('never returns negative bounds', () => {
		assert.strictEqual(selectCompactionWindow(3, 6, 1), null);
	});
});
