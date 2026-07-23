/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	getProcessingPDFFilenames,
	toChatImageAttachments,
	toChatPDFAttachments,
} from '../../common/prepareChatAttachments.js';

suite('prepareChatAttachments', () => {

	test('toChatImageAttachments excludes failed uploads', () => {
		const result = toChatImageAttachments([
			{ id: '1', data: 'a', mimeType: 'image/png', filename: 'a.png', uploadStatus: 'failed' },
			{ id: '2', data: 'b', mimeType: 'image/png', filename: 'b.png', uploadStatus: 'success' },
			{ id: '3', data: 'c', mimeType: 'image/png', filename: 'c.png' },
		]);
		assert.strictEqual(result.length, 2);
		assert.deepStrictEqual(result.map(r => r.id), ['2', '3']);
	});

	test('toChatPDFAttachments excludes failed uploads', () => {
		const result = toChatPDFAttachments([
			{ id: '1', data: 'a', filename: 'a.pdf', uploadStatus: 'failed' },
			{ id: '2', data: 'b', filename: 'b.pdf', uploadStatus: 'processing' },
		]);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].filename, 'b.pdf');
	});

	test('getProcessingPDFFilenames lists in-flight PDFs', () => {
		const names = getProcessingPDFFilenames([
			{ id: '1', data: 'a', filename: 'done.pdf', uploadStatus: 'success' },
			{ id: '2', data: 'b', filename: 'wait.pdf', uploadStatus: 'processing' },
		]);
		assert.deepStrictEqual(names, ['wait.pdf']);
	});
});
