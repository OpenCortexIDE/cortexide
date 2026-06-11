/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { buildRawToolCallObj, rawToolCallObjOfParamsStr, sanitizeOpenAIMessagesForEmptyContent as _sanitize, EMPTY_CONTENT_PLACEHOLDER, toOpenAICompatibleTool } from '../../common/providerToolFormat.js';
import { LLMChatMessage } from '../../common/sendLLMMessageTypes.js';
import type { InternalToolInfo } from '../../common/prompt/prompts.js';

const m = (o: unknown): LLMChatMessage => o as LLMChatMessage;
// LLMChatMessage is a union (the Gemini variant has `parts`, not `content`); return any[] so tests can read `.content`.
const sanitizeOpenAIMessagesForEmptyContent = (msgs: LLMChatMessage[]): any[] => _sanitize(msgs);

suite('buildRawToolCallObj', () => {
	test('object args -> RawToolCallObj with id/name/rawParams/doneParams/isDone', () => {
		assert.deepStrictEqual(buildRawToolCallObj('id1', 'read_file', { uri: '/a', line: '3' }), {
			id: 'id1', name: 'read_file', rawParams: { uri: '/a', line: '3' }, doneParams: ['uri', 'line'], isDone: true,
		});
	});
	test('empty object args -> empty doneParams', () => {
		const r = buildRawToolCallObj('i', 'ls_dir', {});
		assert.deepStrictEqual(r!.doneParams, []);
		assert.strictEqual(r!.isDone, true);
	});
	test('null args -> null', () => {
		assert.strictEqual(buildRawToolCallObj('i', 'x', null), null);
	});
	test('non-object args (string/number) -> null', () => {
		assert.strictEqual(buildRawToolCallObj('i', 'x', 'hello'), null);
		assert.strictEqual(buildRawToolCallObj('i', 'x', 42), null);
		assert.strictEqual(buildRawToolCallObj('i', 'x', undefined), null);
	});
});

suite('rawToolCallObjOfParamsStr (OpenAI-compatible streaming args)', () => {
	test('valid JSON object string -> built tool call', () => {
		assert.deepStrictEqual(rawToolCallObjOfParamsStr('grep_search', '{"query":"foo"}', 'id9'), {
			id: 'id9', name: 'grep_search', rawParams: { query: 'foo' }, doneParams: ['query'], isDone: true,
		});
	});
	test('malformed JSON -> null (dropped, not thrown)', () => {
		assert.strictEqual(rawToolCallObjOfParamsStr('x', '{not json', 'i'), null);
		assert.strictEqual(rawToolCallObjOfParamsStr('x', '', 'i'), null);
	});
	test('JSON "null" / non-object JSON -> null', () => {
		assert.strictEqual(rawToolCallObjOfParamsStr('x', 'null', 'i'), null);
		assert.strictEqual(rawToolCallObjOfParamsStr('x', '5', 'i'), null);
		assert.strictEqual(rawToolCallObjOfParamsStr('x', '"str"', 'i'), null);
	});
});

suite('sanitizeOpenAIMessagesForEmptyContent', () => {
	test('empty array passes through', () => {
		assert.deepStrictEqual(sanitizeOpenAIMessagesForEmptyContent([]), []);
	});

	test('non-empty string content is untouched', () => {
		const msgs = [m({ role: 'user', content: 'hello' })];
		assert.strictEqual(sanitizeOpenAIMessagesForEmptyContent(msgs)[0].content, 'hello');
	});

	test('empty/whitespace string content (not last assistant) gets the placeholder', () => {
		const out = sanitizeOpenAIMessagesForEmptyContent([m({ role: 'user', content: '' }), m({ role: 'assistant', content: 'ok' })]);
		assert.strictEqual(out[0].content, EMPTY_CONTENT_PLACEHOLDER);
		const out2 = sanitizeOpenAIMessagesForEmptyContent([m({ role: 'user', content: '   ' }), m({ role: 'user', content: 'x' })]);
		assert.strictEqual(out2[0].content, EMPTY_CONTENT_PLACEHOLDER);
	});

	test('the FINAL assistant message with empty content is left empty (the deliberate exception)', () => {
		const out = sanitizeOpenAIMessagesForEmptyContent([m({ role: 'user', content: 'hi' }), m({ role: 'assistant', content: '' })]);
		assert.strictEqual(out[1].content, ''); // last + assistant -> not replaced
	});

	test('a non-last empty assistant message IS replaced', () => {
		const out = sanitizeOpenAIMessagesForEmptyContent([m({ role: 'assistant', content: '' }), m({ role: 'user', content: 'next' })]);
		assert.strictEqual(out[0].content, EMPTY_CONTENT_PLACEHOLDER);
	});

	test('a final empty USER message is replaced (only ASSISTANT is exempted at the end)', () => {
		const out = sanitizeOpenAIMessagesForEmptyContent([m({ role: 'assistant', content: 'a' }), m({ role: 'user', content: '' })]);
		assert.strictEqual(out[1].content, EMPTY_CONTENT_PLACEHOLDER);
	});

	test('messages without a content field (Gemini-style parts) pass through unchanged', () => {
		const g = m({ role: 'user', parts: [{ text: 'x' }] });
		assert.strictEqual(sanitizeOpenAIMessagesForEmptyContent([g])[0], g);
	});

	test('array content with a non-empty text part is untouched', () => {
		const msgs = [m({ role: 'user', content: [{ type: 'text', text: 'see image' }] }), m({ role: 'assistant', content: 'k' })];
		assert.deepStrictEqual(sanitizeOpenAIMessagesForEmptyContent(msgs)[0].content, [{ type: 'text', text: 'see image' }]);
	});

	test('array content with an image_url part counts as non-empty (kept)', () => {
		const msgs = [m({ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:...' } }] }), m({ role: 'assistant', content: 'k' })];
		assert.deepStrictEqual(sanitizeOpenAIMessagesForEmptyContent(msgs)[0].content, [{ type: 'image_url', image_url: { url: 'data:...' } }]);
	});

	test('array content with only empty text (not last assistant) -> single placeholder text part', () => {
		const out = sanitizeOpenAIMessagesForEmptyContent([m({ role: 'user', content: [{ type: 'text', text: '  ' }] }), m({ role: 'assistant', content: 'k' })]);
		assert.deepStrictEqual(out[0].content, [{ type: 'text', text: EMPTY_CONTENT_PLACEHOLDER }]);
	});
});

suite('toOpenAICompatibleTool', () => {
	const tool: InternalToolInfo = {
		name: 'read_file',
		description: 'Read a file',
		params: { uri: { description: 'the path' }, line: { description: 'the line' } },
	};

	test('FIXED: every param gets an explicit JSON-Schema type:string (was emitting untyped params)', () => {
		const out = toOpenAICompatibleTool(tool);
		assert.deepStrictEqual(out.function.parameters.properties, {
			uri: { description: 'the path', type: 'string' },
			line: { description: 'the line', type: 'string' },
		});
	});

	test('produces the OpenAI function-tool envelope', () => {
		const out = toOpenAICompatibleTool(tool);
		assert.strictEqual(out.type, 'function');
		assert.strictEqual(out.function.name, 'read_file');
		assert.strictEqual(out.function.description, 'Read a file');
		assert.strictEqual(out.function.parameters.type, 'object');
	});

	test('a tool with no params yields empty properties', () => {
		const out = toOpenAICompatibleTool({ name: 'noop', description: 'd', params: {} });
		assert.deepStrictEqual(out.function.parameters.properties, {});
	});
});
