/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { detectSecrets } from '../../common/secretDetection.js';
import { redactChatMessages, redactFimMessage, summarizeRedaction } from '../../common/outboundRedaction.js';

/**
 * Pins the "never leaks a secret" guarantee at the OUTBOUND DISPATCH BOUNDARY -- the
 * layer where the leak actually occurred. Redaction is exercised with the REAL secret
 * patterns (detectSecrets), proving that across every message shape a key cannot ship
 * verbatim. Regression coverage for two paths that previously leaked raw to cloud
 * providers: tool_result content (e.g. `cat .env` output) and FIM/autocomplete.
 */

// A real-shaped OpenAI key (same fixture style the secretDetection suite uses).
const KEY = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
const detect = (text: string) => detectSecrets(text);

function assertRedacted(s: unknown) {
	assert.strictEqual(typeof s, 'string');
	assert.ok(!(s as string).includes(KEY), `the secret must not survive verbatim: ${String(s)}`);
	assert.ok((s as string).includes('[[REDACTED:'), 'a redaction placeholder must be present');
}

suite('outboundRedaction', () => {

	suite('redactChatMessages', () => {

		test('redacts a secret in plain string content (in place)', () => {
			const messages: any[] = [{ role: 'user', content: `here is my key ${KEY} ok` }];
			const summary = redactChatMessages(messages, detect);
			assert.strictEqual(summary.hasSecrets, true);
			assertRedacted(messages[0].content);
		});

		test('redacts a secret in an OpenAI-style {type:"text"} array part', () => {
			const messages: any[] = [{ role: 'user', content: [{ type: 'text', text: `key: ${KEY}` }] }];
			const summary = redactChatMessages(messages, detect);
			assert.strictEqual(summary.hasSecrets, true);
			assertRedacted(messages[0].content[0].text);
		});

		// THE regression: command/file output routed back as a tool_result was never
		// walked (the old scan only looked at {type:'text'} parts), so `cat .env`
		// output reached the model raw.
		test('redacts a secret in a {type:"tool_result"} content part (cat .env regression)', () => {
			const messages: any[] = [{
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: 'abc', content: `OPENAI_API_KEY=${KEY}\n` }],
			}];
			const summary = redactChatMessages(messages, detect);
			assert.strictEqual(summary.hasSecrets, true, 'tool_result content must be scanned');
			assertRedacted(messages[0].content[0].content);
		});

		test('does not crash on tool_use parts (no text/content string)', () => {
			const messages: any[] = [{
				role: 'assistant',
				content: [{ type: 'tool_use', id: 'x', name: 'run_command', input: { command: 'ls' } }],
			}];
			assert.doesNotThrow(() => redactChatMessages(messages, detect));
		});

		test('redacts a secret in Gemini-style parts[].text', () => {
			const messages: any[] = [{ role: 'user', parts: [{ text: `secret ${KEY}` }] }];
			const summary = redactChatMessages(messages, detect);
			assert.strictEqual(summary.hasSecrets, true);
			assertRedacted(messages[0].parts[0].text);
		});

		test('leaves clean messages untouched and reports no secrets', () => {
			const messages: any[] = [
				{ role: 'system', content: 'You are a helpful assistant. Path: /usr/local/bin' },
				{ role: 'user', content: [{ type: 'text', text: 'refactor src/app.ts please' }] },
			];
			const before = JSON.stringify(messages);
			const summary = redactChatMessages(messages, detect);
			assert.strictEqual(summary.hasSecrets, false);
			assert.strictEqual(JSON.stringify(messages), before, 'clean content must not be mutated');
		});

		test('summary counts each redacted secret type', () => {
			const messages: any[] = [
				{ role: 'user', content: `a ${KEY}` },
				{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: `b ${KEY}` }] },
			];
			const summary = redactChatMessages(messages, detect);
			assert.strictEqual(summary.hasSecrets, true);
			const total = Array.from(summary.countByType.values()).reduce((a, b) => a + b, 0);
			assert.strictEqual(total, 2, 'both occurrences must be counted');
			assert.ok(summarizeRedaction(summary).includes('='), 'summary string renders name=count');
		});

		test('tolerates malformed input without throwing', () => {
			assert.doesNotThrow(() => redactChatMessages(undefined as any, detect));
			assert.doesNotThrow(() => redactChatMessages([null, 42, 'x'] as any, detect));
			assert.doesNotThrow(() => redactChatMessages([{ role: 'user' }] as any, detect));
		});
	});

	suite('redactFimMessage', () => {

		test('redacts a secret in the FIM prefix (autocomplete leak regression)', () => {
			const fim: any = { prefix: `const k = "${KEY}";\n`, suffix: '}', stopTokens: [] };
			const summary = redactFimMessage(fim, detect);
			assert.strictEqual(summary.hasSecrets, true);
			assertRedacted(fim.prefix);
		});

		test('redacts a secret in the FIM suffix', () => {
			const fim: any = { prefix: 'function f() {\n', suffix: `\nreturn "${KEY}"; }`, stopTokens: [] };
			const summary = redactFimMessage(fim, detect);
			assert.strictEqual(summary.hasSecrets, true);
			assertRedacted(fim.suffix);
		});

		test('leaves clean FIM payloads untouched', () => {
			const fim: any = { prefix: 'const x = 1;\n', suffix: '\nconsole.log(x);', stopTokens: [] };
			const summary = redactFimMessage(fim, detect);
			assert.strictEqual(summary.hasSecrets, false);
			assert.strictEqual(fim.prefix, 'const x = 1;\n');
			assert.strictEqual(fim.suffix, '\nconsole.log(x);');
		});

		test('tolerates missing/empty fields', () => {
			assert.doesNotThrow(() => redactFimMessage(undefined, detect));
			assert.doesNotThrow(() => redactFimMessage({}, detect));
			assert.strictEqual(redactFimMessage({ prefix: '', suffix: '' }, detect).hasSecrets, false);
		});
	});
});
