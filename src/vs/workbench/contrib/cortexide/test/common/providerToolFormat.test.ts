/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { rawToolCallObjOfParamsStr, buildRawToolCallObj, sanitizeOpenAIMessagesForEmptyContent as _sanitize, EMPTY_CONTENT_PLACEHOLDER, toOpenAICompatibleTool, accumulateOpenAIChatDelta, OpenAIChatAccumulator, OpenAIStreamDelta, effectiveSpecialToolFormat, convertOpenAIMessagesToOllamaChat, base64FromDataUrl } from '../../common/providerToolFormat.js';
import { LLMChatMessage } from '../../common/sendLLMMessageTypes.js';
import type { InternalToolInfo } from '../../common/prompt/prompts.js';

const m = (o: unknown): LLMChatMessage => o as LLMChatMessage;
// LLMChatMessage is a union (the Gemini variant has `parts`, not `content`); return any[] so tests can read `.content`.
const sanitizeOpenAIMessagesForEmptyContent = (msgs: LLMChatMessage[]): any[] => _sanitize(msgs);

suite('effectiveSpecialToolFormat', () => {
	test('local inference clears native tool format (XML/text mode only)', () => {
		assert.strictEqual(effectiveSpecialToolFormat('openai-style', true), undefined);
		assert.strictEqual(effectiveSpecialToolFormat('anthropic-style', true), undefined);
	});
	test('cloud inference keeps native tool format', () => {
		assert.strictEqual(effectiveSpecialToolFormat('openai-style', false), 'openai-style');
		assert.strictEqual(effectiveSpecialToolFormat(undefined, false), undefined);
	});
	test('loopback local inference always uses XML/text tool mode', () => {
		assert.strictEqual(effectiveSpecialToolFormat('openai-style', true), undefined);
	});
});

suite('convertOpenAIMessagesToOllamaChat', () => {
	test('string content passes through', () => {
		assert.deepStrictEqual(convertOpenAIMessagesToOllamaChat([m({ role: 'user', content: 'hi' })]), [{ role: 'user', content: 'hi' }]);
	});
	test('text parts flatten to content string', () => {
		assert.deepStrictEqual(
			convertOpenAIMessagesToOllamaChat([m({ role: 'user', content: [{ type: 'text', text: 'see ' }, { type: 'text', text: 'this' }] })]),
			[{ role: 'user', content: 'see this' }],
		);
	});
	test('image_url parts become base64 images array', () => {
		const r = convertOpenAIMessagesToOllamaChat([m({
			role: 'user',
			content: [{ type: 'text', text: 'what is this?' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }],
		})]);
		assert.strictEqual(r[0].content, 'what is this?');
		assert.deepStrictEqual(r[0].images, ['abc123']);
	});
	test('base64FromDataUrl strips data-URL prefix', () => {
		assert.strictEqual(base64FromDataUrl('data:image/jpeg;base64,XYZ'), 'XYZ');
		assert.strictEqual(base64FromDataUrl('rawb64'), 'rawb64');
	});
});

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

suite('accumulateOpenAIChatDelta (OpenAI-compatible streaming reducer)', () => {
	const empty = (): OpenAIChatAccumulator => ({ fullText: '', fullReasoning: '', toolName: '', toolParamsStr: '', toolId: '' });
	const step = (s: OpenAIChatAccumulator, delta: OpenAIStreamDelta | null | undefined, providerName = 'openAI', reasoningFieldName?: string | null) =>
		accumulateOpenAIChatDelta(s, delta, { providerName, reasoningFieldName });

	test('plain text content is appended across deltas', () => {
		let s = empty();
		s = step(s, { content: 'Hel' });
		s = step(s, { content: 'lo' });
		s = step(s, { content: ' world' });
		assert.strictEqual(s.fullText, 'Hello world');
		assert.strictEqual(s.toolName, '');
	});

	test('undefined / null delta leaves state unchanged', () => {
		const base = { fullText: 'x', fullReasoning: 'r', toolName: 'n', toolParamsStr: '{', toolId: 'i' };
		assert.deepStrictEqual(step({ ...base }, undefined), base);
		assert.deepStrictEqual(step({ ...base }, null), base);
		assert.deepStrictEqual(step({ ...base }, {}), base);
	});

	test('missing content defaults to empty (no change)', () => {
		const s = step(empty(), { tool_calls: [] });
		assert.strictEqual(s.fullText, '');
	});

	test('tool call: name comes once, arguments fragment across deltas, id concatenated', () => {
		let s = empty();
		s = step(s, { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'read_file', arguments: '{"uri":' } }] });
		s = step(s, { tool_calls: [{ index: 0, function: { arguments: '"/a.ts"' } }] });
		s = step(s, { tool_calls: [{ index: 0, function: { arguments: '}' } }] });
		assert.strictEqual(s.toolName, 'read_file');
		assert.strictEqual(s.toolParamsStr, '{"uri":"/a.ts"}');
		assert.strictEqual(s.toolId, 'call_1');
		// the assembled args string round-trips through the JSON parser used after the stream
		assert.deepStrictEqual(rawToolCallObjOfParamsStr(s.toolName, s.toolParamsStr, s.toolId), {
			id: 'call_1', name: 'read_file', rawParams: { uri: '/a.ts' }, doneParams: ['uri'], isDone: true,
		});
	});

	test('tool call with index !== 0 is dropped (single-tool-call-per-turn)', () => {
		let s = empty();
		s = step(s, { tool_calls: [{ index: 0, id: 'a', function: { name: 'first', arguments: '{}' } }] });
		s = step(s, { tool_calls: [{ index: 1, id: 'b', function: { name: 'second', arguments: '{}' } }] });
		assert.strictEqual(s.toolName, 'first');
		assert.strictEqual(s.toolId, 'a');
	});

	test('tool call entry with no index is skipped (index !== 0)', () => {
		const s = step(empty(), { tool_calls: [{ id: 'x', function: { name: 'noidx', arguments: '{}' } }] });
		assert.strictEqual(s.toolName, '');
		assert.strictEqual(s.toolId, '');
	});

	test('multiple index-0 entries within one delta all accumulate', () => {
		const s = step(empty(), {
			tool_calls: [
				{ index: 0, id: 'i', function: { name: 'do_', arguments: '{"a"' } },
				{ index: 0, function: { name: 'thing', arguments: ':1}' } },
			],
		});
		assert.strictEqual(s.toolName, 'do_thing');
		assert.strictEqual(s.toolParamsStr, '{"a":1}');
	});

	test('Mistral array content: text parts -> fullText, thinking parts -> fullReasoning', () => {
		const delta: OpenAIStreamDelta = {
			content: [
				{ type: 'text', text: 'answer ' },
				{ type: 'thinking', thinking: [{ type: 'text', text: 'reason1 ' }, { type: 'text', text: 'reason2' }] },
				{ type: 'text', text: 'more' },
			],
		};
		const s = step(empty(), delta, 'mistral');
		assert.strictEqual(s.fullText, 'answer more');
		assert.strictEqual(s.fullReasoning, 'reason1 reason2');
	});

	test('Mistral non-array object content is dropped (no text added)', () => {
		const s = step(empty(), { content: { type: 'text', text: 'x' } as any }, 'mistral');
		assert.strictEqual(s.fullText, '');
	});

	test('non-Mistral object content falls through to string coercion (preserves the inline quirk)', () => {
		// the original `fullTextSoFar += newText` coerces a non-string content; preserved byte-for-byte
		const s = step(empty(), { content: { foo: 1 } as any }, 'openAI');
		assert.strictEqual(s.fullText, '[object Object]');
	});

	test('reasoning field: appended when present, coerced via (|| "") + ""', () => {
		let s = empty();
		s = step(s, { reasoning_content: 'think ' } as any, 'deepseek', 'reasoning_content');
		s = step(s, { reasoning_content: 'more' } as any, 'deepseek', 'reasoning_content');
		assert.strictEqual(s.fullReasoning, 'think more');
		assert.strictEqual(s.fullText, '');
	});

	test('reasoning field absent in delta -> no reasoning change', () => {
		const s = step(empty(), { content: 'hi' }, 'deepseek', 'reasoning_content');
		assert.strictEqual(s.fullReasoning, '');
		assert.strictEqual(s.fullText, 'hi');
	});

	test('reasoning field name not configured -> reasoning ignored even if present', () => {
		const s = step(empty(), { reasoning_content: 'leak' } as any, 'openAI', undefined);
		assert.strictEqual(s.fullReasoning, '');
	});

	test('reasoning falsy value (0 / "") contributes nothing', () => {
		let s = step(empty(), { rf: 0 } as any, 'p', 'rf');
		assert.strictEqual(s.fullReasoning, '');
		s = step(s, { rf: '' } as any, 'p', 'rf');
		assert.strictEqual(s.fullReasoning, '');
	});

	test('purity: the input accumulator is not mutated', () => {
		const input = empty();
		const frozen = Object.freeze({ ...input });
		const out = step(frozen as OpenAIChatAccumulator, { content: 'x', tool_calls: [{ index: 0, function: { name: 'n', arguments: 'a' } }] });
		assert.strictEqual(frozen.fullText, '');
		assert.strictEqual(out.fullText, 'x');
		assert.strictEqual(out.toolName, 'n');
		assert.notStrictEqual(out, frozen);
	});

	test('end-to-end: a realistic fragmented tool-call stream assembles correctly', () => {
		let s = empty();
		const stream: OpenAIStreamDelta[] = [
			{ content: '' },
			{ tool_calls: [{ index: 0, id: 'call_abc', function: { name: 'run_command', arguments: '' } }] },
			{ tool_calls: [{ index: 0, function: { arguments: '{"command' } }] },
			{ tool_calls: [{ index: 0, function: { arguments: '":"ls -la"}' } }] },
		];
		for (const d of stream) s = step(s, d);
		assert.strictEqual(s.fullText, '');
		assert.strictEqual(s.toolName, 'run_command');
		assert.strictEqual(s.toolParamsStr, '{"command":"ls -la"}');
		assert.deepStrictEqual(rawToolCallObjOfParamsStr(s.toolName, s.toolParamsStr, s.toolId)!.rawParams, { command: 'ls -la' });
	});
});
