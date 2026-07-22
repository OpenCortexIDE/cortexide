/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { getThreadTabLabel } from '../../common/threadTitle.js';

suite('getThreadTabLabel', () => {
	test('empty thread is "New chat"', () => {
		assert.strictEqual(getThreadTabLabel({ messages: [] } as any), 'New chat');
	});

	test('uses first user message', () => {
		assert.strictEqual(getThreadTabLabel({
			messages: [{ role: 'user', displayContent: 'Fix the menubar bug' }],
		} as any), 'Fix the menubar bug');
	});

	test('truncates long titles', () => {
		const long = 'a'.repeat(40);
		const label = getThreadTabLabel({ messages: [{ role: 'user', displayContent: long }] } as any);
		assert.ok(label.endsWith('…'));
		assert.ok(label.length <= 32);
	});
});
