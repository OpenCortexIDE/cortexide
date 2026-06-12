/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { isTelemetryEnabled } from '../../common/telemetryConsent.js';

/**
 * Phase 8: pins the telemetry opt-IN guarantee. Default OFF; only an explicit opt-in enables it;
 * local-only privacy mode always wins.
 */
suite('telemetryConsent.isTelemetryEnabled', () => {

	test('DEFAULT (no stored preference) -> OFF (opt-in, not opt-out)', () => {
		assert.strictEqual(isTelemetryEnabled(undefined, false), false);
	});

	test('explicit opt-out (stored "true") -> OFF', () => {
		assert.strictEqual(isTelemetryEnabled('true', false), false);
	});

	test('explicit opt-in (stored "false") -> ON', () => {
		assert.strictEqual(isTelemetryEnabled('false', false), true);
	});

	test('local-only mode forces OFF even when explicitly opted in', () => {
		assert.strictEqual(isTelemetryEnabled('false', true), false);
		assert.strictEqual(isTelemetryEnabled(undefined, true), false);
		assert.strictEqual(isTelemetryEnabled('true', true), false);
	});

	test('any unexpected stored value -> OFF (fail-closed)', () => {
		assert.strictEqual(isTelemetryEnabled('', false), false);
		assert.strictEqual(isTelemetryEnabled('yes', false), false);
		assert.strictEqual(isTelemetryEnabled('1', false), false);
		assert.strictEqual(isTelemetryEnabled('FALSE', false), false); // case-sensitive on purpose
	});
});
