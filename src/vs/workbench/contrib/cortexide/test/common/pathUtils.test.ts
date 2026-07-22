/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { getBasename, getFolderName } from '../../common/pathDisplay.js';

suite('pathDisplay (Phase 1 SidebarChat split)', () => {
	test('getBasename returns last path segment', () => {
		assert.strictEqual(getBasename('/a/b/c.ts'), 'c.ts');
		assert.strictEqual(getBasename('a\\b\\c.ts'), 'c.ts');
	});

	test('getBasename can return multiple trailing parts', () => {
		assert.strictEqual(getBasename('/a/b/c.ts', 2), 'b/c.ts');
	});

	test('getFolderName returns last two folders with trailing slash', () => {
		assert.strictEqual(getFolderName('/Users/me/CodeBase/cortexide'), 'CodeBase/cortexide/');
		assert.strictEqual(getFolderName('/'), '/');
	});
});
