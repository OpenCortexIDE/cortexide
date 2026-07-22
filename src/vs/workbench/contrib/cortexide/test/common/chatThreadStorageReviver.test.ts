/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { parseChatThreadsFromStorage, reviveChatThreadStorageValue } from '../../common/chatThreadStorageReviver.js';

suite('chatThreadStorageReviver', () => {
	test('reviveChatThreadStorageValue restores marshalled URIs via URI.revive', () => {
		const uri = URI.file('/workspace/foo.ts');
		const marshalled = uri.toJSON();
		const revived = reviveChatThreadStorageValue('uri', marshalled);
		assert.ok(revived instanceof URI);
		assert.strictEqual((revived as URI).fsPath, uri.fsPath);
	});

	test('reviveChatThreadStorageValue decodes base64 image data', () => {
		const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		const b64 = `__base64__:${btoa(String.fromCharCode(...bytes))}`;
		const revived = reviveChatThreadStorageValue('data', b64);
		assert.ok(revived instanceof Uint8Array);
		assert.deepStrictEqual(Array.from(revived as Uint8Array), Array.from(bytes));
	});

	test('parseChatThreadsFromStorage round-trips staging file URIs', () => {
		const uri = URI.file('/project/src/main.ts');
		const payload = {
			thread1: {
				id: 'thread1',
				createdAt: 1,
				lastModified: 1,
				messages: [],
				state: {
					stagingSelections: [{
						type: 'File',
						uri: uri.toJSON(),
						language: 'typescript',
						state: { wasAddedAsCurrentFile: false },
					}],
					isBeingEdited: false,
				},
			},
		};
		const parsed = parseChatThreadsFromStorage<typeof payload>(JSON.stringify(payload));
		const selection = parsed.thread1.state.stagingSelections[0];
		assert.ok(selection.uri instanceof URI);
		assert.strictEqual(selection.uri.fsPath, uri.fsPath);
	});
});
