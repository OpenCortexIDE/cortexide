/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { collectAttachableUris, SUPPORTED_ATTACH_SCHEMES } from '../../common/attachFileToChat.js';

suite('attachFileToChat', () => {
	test('collectAttachableUris returns file URIs from action args', () => {
		const file = URI.file('/workspace/src/app.ts');
		const result = collectAttachableUris([file], undefined);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].toString(), file.toString());
	});

	test('collectAttachableUris ignores unsupported schemes in args', () => {
		const http = URI.parse('https://example.com/a.ts');
		assert.strictEqual(collectAttachableUris([http], undefined).length, 0);
	});

	test('collectAttachableUris falls back to active editor URI', () => {
		const active = URI.file('/workspace/readme.md');
		const result = collectAttachableUris([], active);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].fsPath, active.fsPath);
	});

	test('collectAttachableUris prefers explicit args over active editor', () => {
		const arg = URI.file('/workspace/a.ts');
		const active = URI.file('/workspace/b.ts');
		const result = collectAttachableUris([arg], active);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].fsPath, arg.fsPath);
	});

	test('SUPPORTED_ATTACH_SCHEMES includes file and untitled', () => {
		assert.ok(SUPPORTED_ATTACH_SCHEMES.has('file'));
		assert.ok(SUPPORTED_ATTACH_SCHEMES.has('untitled'));
	});
});
