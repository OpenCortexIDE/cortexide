/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { formatTodoReminder } from '../../common/todoReminder.js';

suite('todoReminder.formatTodoReminder', () => {

	test('returns undefined for empty / missing input (no injection)', () => {
		assert.strictEqual(formatTodoReminder([]), undefined);
		assert.strictEqual(formatTodoReminder(undefined), undefined);
		assert.strictEqual(formatTodoReminder(null), undefined);
	});

	test('renders each item with a status checkbox', () => {
		const out = formatTodoReminder([
			{ content: 'Read the spec', status: 'completed' },
			{ content: 'Write the code', status: 'in_progress' },
			{ content: 'Add tests', status: 'pending' },
		]);
		assert.ok(out);
		assert.ok(out!.includes('[x] Read the spec'), 'completed -> [x]');
		assert.ok(out!.includes('[~] Write the code'), 'in_progress -> [~]');
		assert.ok(out!.includes('[ ] Add tests'), 'pending -> [ ]');
	});

	test('reports accurate completed/total progress', () => {
		const out = formatTodoReminder([
			{ content: 'a', status: 'completed' },
			{ content: 'b', status: 'completed' },
			{ content: 'c', status: 'pending' },
		]);
		assert.ok(out!.includes('Progress: 2/3 completed.'));
	});

	test('mentions todo_write and attempt_completion so the model knows the contract', () => {
		const out = formatTodoReminder([{ content: 'x', status: 'pending' }]);
		assert.ok(out!.includes('todo_write'), 'tells the model how to maintain it');
		assert.ok(out!.includes('attempt_completion'), 'tells the model when to finish');
	});

	test('preserves item content verbatim (no truncation/escaping surprises)', () => {
		const content = 'Refactor src/app.ts -> extract handler(); keep behaviour';
		const out = formatTodoReminder([{ content, status: 'pending' }]);
		assert.ok(out!.includes(content));
	});
});
