/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { FileSystemProviderCapabilities } from '../../../../../platform/files/common/files.js';
import { CortexideModelService } from '../../common/cortexideModelService.js';

/**
 * Phase 1 #1: AI edits must persist with an ATOMIC (temp file + rename) write so a crash/ENOSPC
 * mid-write can't corrupt the file. saveModel goes through the normal save path (so dirty/etag stay
 * correct) and requests `atomicWrite` ONLY when the provider supports FileAtomicWrite — otherwise it
 * falls back to a normal save (no throw on remote/virtual providers). This pins that wiring.
 */
suite('Phase 1 — cortexideModelService.saveModel atomic write', () => {

	function makeService(hasAtomicCapability: boolean) {
		const saveCalls: { uri: URI; options: any }[] = [];
		const fileService: any = {
			hasCapability: (_uri: URI, cap: FileSystemProviderCapabilities) =>
				hasAtomicCapability && cap === FileSystemProviderCapabilities.FileAtomicWrite,
		};
		const textFileService: any = {
			save: async (uri: URI, options: any) => { saveCalls.push({ uri, options }); return uri; },
		};
		const textModelService: any = {};
		// constructor is just super(); DI decorators are inert when calling `new` directly
		const svc = new CortexideModelService(textModelService, textFileService, fileService);
		return { svc, saveCalls };
	}

	test('requests atomicWrite when the provider supports FileAtomicWrite', async () => {
		const { svc, saveCalls } = makeService(true);
		await svc.saveModel(URI.file('/ws/a.ts'));
		assert.strictEqual(saveCalls.length, 1);
		assert.strictEqual(saveCalls[0].options.atomicWrite, true, 'atomicWrite must be requested when supported');
		assert.strictEqual(saveCalls[0].options.skipSaveParticipants, true, 'must still skip save participants');
	});

	test('falls back to non-atomic when the provider lacks FileAtomicWrite (no throw)', async () => {
		const { svc, saveCalls } = makeService(false);
		await svc.saveModel(URI.file('/remote/b.ts'));
		assert.strictEqual(saveCalls.length, 1);
		assert.strictEqual(saveCalls[0].options.atomicWrite, false, 'atomicWrite must be false on providers without atomic support');
	});

	test('saves the requested URI', async () => {
		const { svc, saveCalls } = makeService(true);
		const uri = URI.file('/ws/nested/file.txt');
		await svc.saveModel(uri);
		assert.strictEqual(saveCalls[0].uri.toString(), uri.toString());
	});
});
