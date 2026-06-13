/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { suite, test } from 'mocha';
import * as assert from 'assert';
import { parseStashIndex } from '../../common/gitStashRef.js';

/**
 * Real tests for the git stash-ref parsing GitAutoStashService delegates to (was a 4-test assert.ok(true)
 * placeholder). The actual stash create/restore/drop need the live git command service, so they are not
 * node-testable; the ref parsing -- duplicated in restoreStash + dropStash -- is the pure piece, pinned here.
 * (The placeholder's "dirty-only mode skips stash" case is dropped: createStash has no such mode.)
 */
suite('gitStashRef.parseStashIndex', () => {

	test('parses the index from a well-formed ref', () => {
		assert.strictEqual(parseStashIndex('stash@{0}'), 0);
		assert.strictEqual(parseStashIndex('stash@{2}'), 2);
		assert.strictEqual(parseStashIndex('stash@{17}'), 17);
	});

	test('a missing / malformed ref defaults to 0 (the latest stash)', () => {
		assert.strictEqual(parseStashIndex(''), 0);
		assert.strictEqual(parseStashIndex('not a stash ref'), 0);
		assert.strictEqual(parseStashIndex('stash@{}'), 0);
		assert.strictEqual(parseStashIndex('stash@{abc}'), 0);
	});

	test('finds the index even when the ref is embedded in other text', () => {
		assert.strictEqual(parseStashIndex('refs/stash@{3} (auto)'), 3);
	});
});
