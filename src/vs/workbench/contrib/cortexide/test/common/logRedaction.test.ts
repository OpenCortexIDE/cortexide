/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { redactLogMessage, redactLogArgs } from '../../common/logRedaction.js';
import { SecretDetectionConfig } from '../../common/secretDetection.js';

/**
 * The pure log-redaction core RedactingLogService delegates to -- the "no secret reaches logs" guarantee.
 */

const enabled: SecretDetectionConfig = { enabled: true, customPatterns: [], disabledPatternIds: [], mode: 'redact' };
const disabled: SecretDetectionConfig = { ...enabled, enabled: false };

const OPENAI_KEY = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

suite('logRedaction.redactLogMessage', () => {

	test('redacts a recognizable API key out of a log line', () => {
		const out = redactLogMessage(`connecting with ${OPENAI_KEY}`, enabled);
		assert.ok(!out.includes(OPENAI_KEY), 'the key must not survive');
		assert.notStrictEqual(out, `connecting with ${OPENAI_KEY}`);
	});

	test('a clean line passes through unchanged', () => {
		assert.strictEqual(redactLogMessage('just a normal log line', enabled), 'just a normal log line');
	});

	test('disabled config passes everything through untouched', () => {
		assert.strictEqual(redactLogMessage(`token ${OPENAI_KEY}`, disabled), `token ${OPENAI_KEY}`);
	});
});

suite('logRedaction.redactLogArgs', () => {

	test('redacts secrets inside string args', () => {
		const out = redactLogArgs([`key=${OPENAI_KEY}`, 'plain'], enabled);
		assert.ok(!(out[0] as string).includes(OPENAI_KEY));
		assert.strictEqual(out[1], 'plain');
	});

	test('redacts secrets nested inside object args', () => {
		const out = redactLogArgs([{ auth: OPENAI_KEY, nested: { also: OPENAI_KEY } }], enabled) as any[];
		assert.ok(!JSON.stringify(out[0]).includes(OPENAI_KEY), 'no secret survives anywhere in the object');
	});

	test('non-string / non-object args pass through (numbers, booleans, null)', () => {
		const out = redactLogArgs([42, true, null, undefined], enabled);
		assert.deepStrictEqual(out, [42, true, null, undefined]);
	});

	test('disabled config returns args untouched (same array reference semantics)', () => {
		const args = [`x ${OPENAI_KEY}`, { a: OPENAI_KEY }];
		assert.deepStrictEqual(redactLogArgs(args, disabled), args);
	});
});
