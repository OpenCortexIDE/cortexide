/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { extractToolCallFromNonStreamingChoice, reduceGeminiChunk, finalizeGeminiToolId, GeminiToolState } from '../../common/providerToolFormat.js';

/**
 * The provider tool-capture reducers extracted from sendLLMMessage.impl (electron-main, untestable there).
 * OpenAI non-streaming choice -> {text, first tool call}; Gemini streaming chunk -> running state where a
 * functionCall REPLACES (last wins, unlike OpenAI's concatenation) + the empty-id fallback at finalize.
 */

suite('providerToolFormat.extractToolCallFromNonStreamingChoice', () => {

	test('missing choice -> empty', () => {
		assert.deepStrictEqual(extractToolCallFromNonStreamingChoice(undefined),
			{ empty: true, hasToolCall: false, fullText: '', toolName: '', toolParamsStr: '', toolId: '' });
	});

	test('content but no tool_calls -> hasToolCall false, text captured', () => {
		const r = extractToolCallFromNonStreamingChoice({ message: { content: 'hello world' } });
		assert.strictEqual(r.empty, false);
		assert.strictEqual(r.hasToolCall, false);
		assert.strictEqual(r.fullText, 'hello world');
	});

	test('one tool_call -> name / arguments / id captured', () => {
		const r = extractToolCallFromNonStreamingChoice({
			message: { content: '', tool_calls: [{ id: 'call_1', function: { name: 'read_file', arguments: '{"uri":"a.ts"}' } }] },
		});
		assert.strictEqual(r.hasToolCall, true);
		assert.strictEqual(r.toolName, 'read_file');
		assert.strictEqual(r.toolParamsStr, '{"uri":"a.ts"}');
		assert.strictEqual(r.toolId, 'call_1');
	});

	test('nullish tool-call fields coerce to empty strings', () => {
		const r = extractToolCallFromNonStreamingChoice({ message: { tool_calls: [{}] } });
		assert.strictEqual(r.hasToolCall, true);
		assert.strictEqual(r.fullText, '');
		assert.strictEqual(r.toolName, '');
		assert.strictEqual(r.toolParamsStr, '');
		assert.strictEqual(r.toolId, '');
	});

	test('only the FIRST tool call is captured', () => {
		const r = extractToolCallFromNonStreamingChoice({
			message: { tool_calls: [{ id: 'a', function: { name: 'first' } }, { id: 'b', function: { name: 'second' } }] },
		});
		assert.strictEqual(r.toolName, 'first');
		assert.strictEqual(r.toolId, 'a');
	});
});

suite('providerToolFormat.reduceGeminiChunk', () => {

	const empty: GeminiToolState = { fullTextSoFar: '', toolName: '', toolParamsStr: '', toolId: '' };

	test('text-only chunk appends to fullTextSoFar and leaves the tool untouched', () => {
		const s1 = reduceGeminiChunk(empty, { text: 'hello ' });
		const s2 = reduceGeminiChunk(s1, { text: 'world' });
		assert.strictEqual(s2.fullTextSoFar, 'hello world');
		assert.strictEqual(s2.toolName, '');
	});

	test('functionCall captures name + JSON args + id', () => {
		const s = reduceGeminiChunk(empty, { functionCalls: [{ name: 'ls_dir', args: { uri: 'src' }, id: 'g1' }] });
		assert.strictEqual(s.toolName, 'ls_dir');
		assert.strictEqual(s.toolParamsStr, JSON.stringify({ uri: 'src' }));
		assert.strictEqual(s.toolId, 'g1');
	});

	test('a later functionCall REPLACES the earlier one (last wins, unlike OpenAI concat)', () => {
		const s1 = reduceGeminiChunk(empty, { functionCalls: [{ name: 'first', args: { a: 1 }, id: 'x' }] });
		const s2 = reduceGeminiChunk(s1, { functionCalls: [{ name: 'second', args: { b: 2 }, id: 'y' }] });
		assert.strictEqual(s2.toolName, 'second');
		assert.strictEqual(s2.toolParamsStr, JSON.stringify({ b: 2 }));
		assert.strictEqual(s2.toolId, 'y');
	});

	test('undefined args -> "{}"', () => {
		const s = reduceGeminiChunk(empty, { functionCalls: [{ name: 't' }] });
		assert.strictEqual(s.toolParamsStr, '{}');
	});

	test('empty chunk is a no-op on state', () => {
		assert.deepStrictEqual(reduceGeminiChunk(empty, {}), empty);
	});
});

suite('providerToolFormat.finalizeGeminiToolId', () => {
	test('empty id -> generated uuid; non-empty id -> unchanged', () => {
		assert.strictEqual(finalizeGeminiToolId('', () => 'GEN'), 'GEN');
		assert.strictEqual(finalizeGeminiToolId('existing', () => 'GEN'), 'existing');
	});
});
