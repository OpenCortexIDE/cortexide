/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { extractAtReferenceTokens } from '../../common/atReferenceTokens.js';

suite('atReferenceTokens', () => {

	test('extracts bare @word tokens', () => {
		assert.deepStrictEqual(
			extractAtReferenceTokens('summarize @workspace and @recent files'),
			['workspace', 'recent'],
		);
	});

	test('extracts quoted @"path with spaces"', () => {
		assert.deepStrictEqual(
			extractAtReferenceTokens('check @"src/my file.ts" please'),
			['src/my file.ts'],
		);
	});

	test('extracts path-like tokens with line ranges', () => {
		assert.deepStrictEqual(
			extractAtReferenceTokens('fix @src/app.ts:10-20'),
			['src/app.ts:10-20'],
		);
	});

	test('extracts symbol references', () => {
		assert.deepStrictEqual(
			extractAtReferenceTokens('find @sym:MyClass usages'),
			['sym:MyClass'],
		);
	});

	test('returns empty array when no @ tokens', () => {
		assert.deepStrictEqual(extractAtReferenceTokens('hello world'), []);
	});
});
