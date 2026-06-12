/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { checkRemoteModelCall } from '../../common/imageQA/securityGuardrails.js';

/**
 * Phase 8 (privacy): pins the Image-QA remote-call guard. It blocks sending an image to a REMOTE
 * model when remote models are disabled, and caps the image size sent off-machine. Previously
 * untested despite being a wired privacy gate (imageQAPipeline).
 */
const MB = 1024 * 1024;

suite('imageQA/securityGuardrails.checkRemoteModelCall', () => {

	test('blocks when remote models are disabled (regardless of size)', () => {
		const r = checkRemoteModelCall(false, 1);
		assert.strictEqual(r.allowed, false);
		assert.match(r.reason || '', /disabled/i);
		// even a 0-byte image is blocked when remote is off
		assert.strictEqual(checkRemoteModelCall(false, 0).allowed, false);
	});

	test('allows a reasonably-sized image when remote models are enabled', () => {
		assert.deepStrictEqual(checkRemoteModelCall(true, 5 * MB), { allowed: true });
		assert.strictEqual(checkRemoteModelCall(true, 0).allowed, true);
	});

	test('blocks an oversized image (> 50 MB) even when remote is enabled', () => {
		const r = checkRemoteModelCall(true, 50 * MB + 1);
		assert.strictEqual(r.allowed, false);
		assert.match(r.reason || '', /exceeds maximum/i);
	});

	test('boundary: exactly 50 MB is allowed (cap is strictly-greater-than)', () => {
		assert.strictEqual(checkRemoteModelCall(true, 50 * MB).allowed, true);
		assert.strictEqual(checkRemoteModelCall(true, 50 * MB + 1).allowed, false);
	});

	test('disabled takes precedence over the size cap (disabled + oversized -> "disabled" reason)', () => {
		const r = checkRemoteModelCall(false, 999 * MB);
		assert.strictEqual(r.allowed, false);
		assert.match(r.reason || '', /disabled/i);
	});

	test('the optional logService is truly optional (no throw when omitted)', () => {
		assert.doesNotThrow(() => checkRemoteModelCall(true, 1));
		assert.doesNotThrow(() => checkRemoteModelCall(false, 1));
	});
});
