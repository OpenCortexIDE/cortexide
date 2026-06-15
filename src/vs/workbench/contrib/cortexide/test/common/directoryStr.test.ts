/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { stringifyDirectoryTree1Deep } from '../../common/directoryStrService.js';
import { BuiltinToolCallParams, BuiltinToolResultType } from '../../common/toolsServiceTypes.js';

/**
 * The ls_dir tree renderer the agent reads to navigate the workspace. Pure (no extraction needed).
 * Box-drawing chars are written as \u escapes so the test source stays ASCII (hygiene).
 */
const TEE = '\u251c\u2500\u2500 ';   // non-last-entry prefix (box-drawing as unicode escapes for ASCII source)
const ELBOW = '\u2514\u2500\u2500 '; // last-entry prefix

const params = (p: string): BuiltinToolCallParams['ls_dir'] => ({ uri: URI.file(p) } as BuiltinToolCallParams['ls_dir']);
const child = (name: string, isDirectory = false, isSymbolicLink = false) => ({ name, isDirectory, isSymbolicLink, uri: URI.file('/ws/' + name) });

suite('directoryStrService.stringifyDirectoryTree1Deep', () => {

	test('no children -> the not-a-directory Error branch', () => {
		const out = stringifyDirectoryTree1Deep(params('/ws/file.ts'), { children: null, hasNextPage: false, hasPrevPage: false, itemsRemaining: 0 } as unknown as BuiltinToolResultType['ls_dir']);
		assert.ok(out.startsWith('Error:'));
		assert.ok(out.includes('is not a directory'));
	});

	test('first page renders the dir header, then one entry per line with dir/symlink markers', () => {
		const result = {
			children: [child('a.ts'), child('sub', true), child('link', false, true)],
			hasPrevPage: false, hasNextPage: false,
		} as unknown as BuiltinToolResultType['ls_dir'];
		const out = stringifyDirectoryTree1Deep(params('/ws/src'), result);

		assert.ok(out.startsWith('/ws/src\n'), 'first page includes the directory path header');
		assert.ok(out.includes(TEE + 'a.ts\n'));
		assert.ok(out.includes(TEE + 'sub/\n'), 'a directory gets a trailing slash');
		assert.ok(out.includes(ELBOW + 'link (symbolic link)\n'), 'the last entry uses the elbow + symlink marker');
	});

	test('a non-first page omits the header', () => {
		const result = {
			children: [child('b.ts')],
			hasPrevPage: true, hasNextPage: false,
		} as unknown as BuiltinToolResultType['ls_dir'];
		const out = stringifyDirectoryTree1Deep(params('/ws/src'), result);
		assert.ok(!out.includes('/ws/src\n'), 'no header when hasPrevPage');
		assert.ok(out.includes(ELBOW + 'b.ts\n'));
	});

	test('hasNextPage appends a "results remaining" line and the last real entry is NOT the elbow', () => {
		const result = {
			children: [child('a.ts'), child('b.ts')],
			hasPrevPage: false, hasNextPage: true, itemsRemaining: 7,
		} as unknown as BuiltinToolResultType['ls_dir'];
		const out = stringifyDirectoryTree1Deep(params('/ws/src'), result);
		assert.ok(out.includes(ELBOW + '(7 results remaining...)\n'));
		assert.ok(out.includes(TEE + 'b.ts\n'), 'with a next page, the last shown entry still uses the tee, not the elbow');
	});
});
