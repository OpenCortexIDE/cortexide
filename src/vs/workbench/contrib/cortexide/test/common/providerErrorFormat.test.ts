/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { formatGeminiRateLimitError, isRateLimitErrorMessage } from '../../common/providerErrorFormat.js';

const DOCS = 'For more information, see https://ai.google.dev/gemini-api/docs/rate-limits';
const GENERIC_FALLBACK = 'Rate limit reached. Please check your Gemini API quota and billing details. See https://ai.google.dev/gemini-api/docs/rate-limits';

// Build a Gemini-style error whose outer .error.message is itself a JSON string (the common shape).
const nested = (innerMessage: string, retryDelay?: string) => {
	const inner: any = { error: { message: innerMessage, details: [] } };
	if (retryDelay) inner.error.details.push({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay });
	return JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: JSON.stringify(inner) } });
};

suite('formatGeminiRateLimitError', () => {
	test('nested error message + RetryInfo with minutes and seconds', () => {
		const out = formatGeminiRateLimitError(nested('You have hit your quota.', '90s'));
		assert.ok(out.startsWith('You have hit your quota.'), out);
		assert.ok(out.includes('Please retry in 1 minute and 30 seconds.'), out);
		assert.ok(out.endsWith(DOCS), out);
	});

	test('RetryInfo with whole minutes (no leftover seconds) omits the seconds clause', () => {
		const out = formatGeminiRateLimitError(nested('quota', '120s'));
		assert.ok(out.includes('Please retry in 2 minutes.'), out);
		assert.ok(!out.includes('second'), out);
	});

	test('RetryInfo plural vs singular seconds', () => {
		assert.ok(formatGeminiRateLimitError(nested('q', '1s')).includes('Please retry in 1 second.'));
		assert.ok(formatGeminiRateLimitError(nested('q', '2s')).includes('Please retry in 2 seconds.'));
	});

	test('fractional retry delay is ceil-ed to whole seconds', () => {
		const out = formatGeminiRateLimitError(nested('q', '57.627694635s'));
		assert.ok(out.includes('Please retry in 58 seconds.'), out);
	});

	test('singular minute with one second', () => {
		const out = formatGeminiRateLimitError(nested('q', '61s'));
		assert.ok(out.includes('Please retry in 1 minute and 1 second.'), out);
	});

	test('no RetryInfo -> "Please wait a moment" suffix', () => {
		const out = formatGeminiRateLimitError(nested('Slow down please.'));
		assert.ok(out.startsWith('Slow down please.'), out);
		assert.ok(out.includes('Please wait a moment before trying again.'), out);
		assert.ok(out.endsWith(DOCS), out);
	});

	test('outer error.message that is NOT JSON -> uses it verbatim as the rate-limit message', () => {
		const raw = JSON.stringify({ error: { code: 429, message: 'Plain quota message, not JSON' } });
		const out = formatGeminiRateLimitError(raw);
		assert.ok(out.startsWith('Plain quota message, not JSON'), out);
		assert.ok(out.includes('Please wait a moment before trying again.'), out);
	});

	test('code 429 with no error.message -> generic quota message', () => {
		const raw = JSON.stringify({ error: { code: 429 } });
		const out = formatGeminiRateLimitError(raw);
		assert.ok(out.startsWith('You exceeded your current quota. Please check your plan and billing details.'), out);
	});

	test('RESOURCE_EXHAUSTED status with no error.message -> generic quota message', () => {
		const raw = JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } });
		const out = formatGeminiRateLimitError(raw);
		assert.ok(out.startsWith('You exceeded your current quota.'), out);
	});

	test('a JSON object embedded inside a noisy non-JSON string is extracted', () => {
		const embedded = 'GoogleGenerativeAIError: [429] ' + JSON.stringify({ error: { code: 429, message: 'Quota for X' } });
		const out = formatGeminiRateLimitError(embedded);
		assert.ok(out.startsWith('Quota for X'), out);
	});

	test('no JSON at all in the message -> default rate-limit message (not the throw fallback)', () => {
		const out = formatGeminiRateLimitError('429 Too Many Requests');
		assert.ok(out.startsWith('Rate limit reached. Please check your plan and billing details.'), out);
		assert.ok(out.includes('Please wait a moment before trying again.'), out);
		assert.ok(out.endsWith(DOCS), out);
	});

	test('an embedded but MALFORMED brace block throws inside parsing -> generic fallback', () => {
		// regex matches `{...}` but it is not valid JSON, so the inner JSON.parse throws to the outer catch
		const out = formatGeminiRateLimitError('boom {not: valid, json}');
		assert.strictEqual(out, GENERIC_FALLBACK);
	});

	test('empty string -> default rate-limit message', () => {
		const out = formatGeminiRateLimitError('');
		assert.ok(out.startsWith('Rate limit reached. Please check your plan and billing details.'), out);
		assert.ok(out.endsWith(DOCS), out);
	});
});

suite('isRateLimitErrorMessage', () => {
	const hits = [
		'Error 429 Too Many Requests',
		'You hit the rate limit',
		'rate-limit exceeded',
		'tokens per min exceeded',
		'TPM limit reached',
		'You exceeded your current quota',
		'RESOURCE_EXHAUSTED',
		'quota',
	];
	for (const h of hits) {
		test(`positive: ${JSON.stringify(h)}`, () => {
			assert.strictEqual(isRateLimitErrorMessage(h), true);
		});
	}

	test('case-insensitive (matches the .toLowerCase() in the original)', () => {
		assert.strictEqual(isRateLimitErrorMessage('Resource_Exhausted'), true);
		assert.strictEqual(isRateLimitErrorMessage('Rate Limit'), true);
		assert.strictEqual(isRateLimitErrorMessage('QUOTA'), true);
	});

	test('negatives: unrelated errors are not rate-limits', () => {
		assert.strictEqual(isRateLimitErrorMessage(''), false);
		assert.strictEqual(isRateLimitErrorMessage('Invalid API key'), false);
		assert.strictEqual(isRateLimitErrorMessage('connection refused'), false);
		assert.strictEqual(isRateLimitErrorMessage('500 Internal Server Error'), false);
		assert.strictEqual(isRateLimitErrorMessage('model not found'), false);
	});

	test('429 as a substring still matches (mirrors the inline includes check)', () => {
		assert.strictEqual(isRateLimitErrorMessage('HTTP 4290 weird'), true); // contains "429"
	});
});
