/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { checkEarlyTokenQuality, shouldUseSpeculativeEscalation } from '../../common/routingEscalation.js';

/**
 * Early-token quality + speculative-escalation decisions (already pure, were untested). These gate
 * whether a streaming response is abandoned mid-flight for a stronger model.
 */

suite('routingEscalation.checkEarlyTokenQuality', () => {

	test('under 20 tokens -> neutral 0.5, no escalation (not enough to judge)', () => {
		const r = checkEarlyTokenQuality('some early text', '', 10);
		assert.strictEqual(r.score, 0.5);
		assert.strictEqual(r.shouldEscalate, false);
		assert.ok(r.reasons[0].includes('Insufficient'));
	});

	test('high repetition drops the score and is reported', () => {
		const r = checkEarlyTokenQuality('na '.repeat(20).trim(), '', 30); // 20 identical words -> ratio ~0.05
		assert.ok(r.score <= 0.7, `expected repetition penalty, score ${r.score}`);
		assert.ok(r.reasons.some(x => x.includes('repetition')));
	});

	test('a generic refusal + error message pushes the score below 0.5 and escalates at >=50 tokens', () => {
		const text = 'I cannot help with this request. An error occurred while processing your input here.';
		const r = checkEarlyTokenQuality(text, '', 50);
		assert.ok(r.score < 0.5, `expected low score, got ${r.score}`);
		assert.strictEqual(r.shouldEscalate, true);
		assert.ok(r.reasons.some(x => x.includes('Generic')));
	});

	test('an incomplete code fence is penalized', () => {
		const r = checkEarlyTokenQuality('here is some code ```python\nprint(1)\n and more text to pad this out nicely', '', 40);
		assert.ok(r.reasons.some(x => x.includes('Incomplete code block')));
	});

	test('a clean, balanced-fence response of adequate length is acceptable and not escalated', () => {
		const text = 'Here is the implementation you asked for, which reads the file and returns its contents:\n```ts\nconst x = readFile(uri);\nreturn x;\n```\nThat should work for your case.';
		const r = checkEarlyTokenQuality(text, '', 60);
		assert.strictEqual(r.score, 1.0);
		assert.strictEqual(r.shouldEscalate, false);
		assert.deepStrictEqual(r.reasons, ['Quality acceptable']);
	});

	test('escalation requires BOTH score < 0.5 AND tokenCount >= 50 (a bad short response does not escalate)', () => {
		const text = 'I cannot help with this. An error occurred.';
		const r = checkEarlyTokenQuality(text, '', 40); // < 50 tokens
		assert.ok(r.score < 0.5);
		assert.strictEqual(r.shouldEscalate, false);
	});
});

suite('routingEscalation.shouldUseSpeculativeEscalation', () => {

	test('confidence below 0.6 escalates; the 0.6 boundary does not', () => {
		assert.strictEqual(shouldUseSpeculativeEscalation(0.59, 'standard'), true);
		assert.strictEqual(shouldUseSpeculativeEscalation(0.6, 'standard'), false);
		assert.strictEqual(shouldUseSpeculativeEscalation(0.9, 'standard'), false);
	});

	test("a quality tier of 'escalate' forces escalation regardless of confidence", () => {
		assert.strictEqual(shouldUseSpeculativeEscalation(0.95, 'escalate'), true);
		assert.strictEqual(shouldUseSpeculativeEscalation(0.95, undefined), false);
	});
});
