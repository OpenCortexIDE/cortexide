/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { recognizeTextToolCall, hasStructuredToolCallMarker } from '../../common/toolCallRecognition.js';

suite('recognizeTextToolCall', () => {

	test('no tool call in text: parsed null, preamble unchanged (byte-for-byte)', () => {
		const text = 'I will help you with that. First, let me look around.';
		const r = recognizeTextToolCall(text);
		assert.strictEqual(r.parsed, null);
		assert.strictEqual(r.preamble, text); // NOT trimmed when nothing is parsed
	});

	test('non-tool JSON ({foo:bar}) is not a tool call: parsed null, text unchanged', () => {
		const text = '{"foo":"bar"}';
		const r = recognizeTextToolCall(text);
		assert.strictEqual(r.parsed, null);
		assert.strictEqual(r.preamble, text);
	});

	test('JSON tool call with preamble prose: parsed + preamble is the trimmed prose before the first {', () => {
		const text = 'Sure, here is the call:\n{"name":"read_file","arguments":{"uri":"/a"}}';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'read_file');
		assert.strictEqual(r.parsed!.toolParams.uri, '/a');
		assert.strictEqual(r.preamble, 'Sure, here is the call:'); // cutIdx > 0 -> substring(0,cutIdx).trim()
	});

	test('JSON tool call at index 0: cutIdx === 0 -> preamble is empty string', () => {
		const text = '{"name":"ls_dir"}';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'ls_dir');
		assert.strictEqual(r.preamble, ''); // cutIdx === 0 -> ''
	});

	test('<tool_call> wrapper with preamble: cut at the EARLIER <tool_call marker, not the inner {', () => {
		const text = 'Let me look.\n<tool_call>\n{"name":"ls_dir"}\n</tool_call>';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'ls_dir');
		assert.strictEqual(r.preamble, 'Let me look.'); // min(indexOf('{'), search(<tool_call)) == the marker
	});

	test('Anthropic <function_calls> XML with preamble: cut at the marker (no brace present)', () => {
		const text = 'Working on it.\n<function_calls>\n<invoke name="read_file">\n<parameter name="uri">/a</parameter>\n</invoke>\n</function_calls>';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'read_file');
		assert.strictEqual(r.preamble, 'Working on it.');
	});

	test('THE hallucinated multi-tool transcript: keep ONLY the prose before the first call; drop fake tail', () => {
		// A single message: prose + real call + HALLUCINATED tool_response + a second fake call.
		const text =
			'I will read the file.\n' +
			'<tool_call>{"name":"read_file","arguments":{"uri":"/a"}}</tool_call>\n' +
			'<tool_response>file contents here</tool_response>\n' +
			'<tool_call>{"name":"read_file","arguments":{"uri":"/b"}}</tool_call>';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'read_file');
		assert.strictEqual(r.parsed!.toolParams.uri, '/a'); // the FIRST real call
		assert.strictEqual(r.preamble, 'I will read the file.');
		// the hallucinated continuation must NOT survive in the preamble
		assert.ok(!r.preamble.includes('tool_response'));
		assert.ok(!r.preamble.includes('/b'));
	});

	test('preamble has no leftover marker when the call is mid-text', () => {
		const text = 'first some words {"function_name":"grep_search","arguments":{"query":"x"}} trailing junk';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'grep_search');
		assert.strictEqual(r.preamble, 'first some words'); // everything from the first { is dropped
		assert.ok(!r.preamble.includes('trailing junk'));
	});

	test('invented tool name is canonicalized via the underlying parser (create_file -> create_file_or_folder)', () => {
		const text = 'Creating it now.\n{"name":"create_file","arguments":{"uri":"fib.py","contents":"x"}}';
		const r = recognizeTextToolCall(text);
		assert.ok(r.parsed);
		assert.strictEqual(r.parsed!.toolName, 'create_file_or_folder');
		assert.strictEqual(r.preamble, 'Creating it now.');
	});

	test('empty / whitespace text: parsed null, preamble unchanged, not malformed', () => {
		assert.deepStrictEqual(recognizeTextToolCall(''), { parsed: null, preamble: '', attemptedButMalformed: false });
		assert.deepStrictEqual(recognizeTextToolCall('   \n  '), { parsed: null, preamble: '   \n  ', attemptedButMalformed: false });
	});
});

suite('recognizeTextToolCall - attemptedButMalformed (B1)', () => {

	test('malformed <tool_call> markup that does not parse -> attemptedButMalformed true', () => {
		const r = recognizeTextToolCall('Let me do that.\n<tool_call>{not valid json</tool_call>');
		assert.strictEqual(r.parsed, null);
		assert.strictEqual(r.attemptedButMalformed, true);
	});

	test('malformed <function_calls> markup -> attemptedButMalformed true', () => {
		assert.strictEqual(recognizeTextToolCall('<function_calls><invoke name=></invoke></function_calls>').attemptedButMalformed, true);
	});

	test('standalone <invoke> is NOT flagged (deliberate - collides with JSX/XML)', () => {
		assert.strictEqual(recognizeTextToolCall('Use the <Invoke onClick={...}/> component like this.').attemptedButMalformed, false);
	});

	test('a final answer that QUOTES the markers in code/backticks is NOT flagged', () => {
		assert.strictEqual(recognizeTextToolCall('The model wraps calls in `<function_calls>` tags.').attemptedButMalformed, false);
		assert.strictEqual(recognizeTextToolCall('Example:\n```\n<tool_call>{...}</tool_call>\n```\nThat is the format.').attemptedButMalformed, false);
	});

	test('a genuine prose answer (no markers) is NOT flagged malformed', () => {
		const r = recognizeTextToolCall('There are 5 endpoints in the app. Let me know if you need details.');
		assert.strictEqual(r.parsed, null);
		assert.strictEqual(r.attemptedButMalformed, false);
	});

	test('a bare { JSON-ish blob that does not parse is NOT flagged (legit answers contain JSON/code)', () => {
		const r = recognizeTextToolCall('The config looks like { "timeout": 30, "retries": 3 } in that file.');
		assert.strictEqual(r.parsed, null);
		assert.strictEqual(r.attemptedButMalformed, false); // bare `{` is intentionally not a marker
	});

	test('a WELL-FORMED text tool call parses and is NOT malformed', () => {
		const r = recognizeTextToolCall('<tool_call>{"name":"ls_dir","arguments":{}}</tool_call>');
		assert.ok(r.parsed);
		assert.strictEqual(r.attemptedButMalformed, false);
	});
});

suite('hasStructuredToolCallMarker', () => {
	test('true for the two wrapper markers (case-insensitive), OUTSIDE code', () => {
		assert.strictEqual(hasStructuredToolCallMarker('x <tool_call> y'), true);
		assert.strictEqual(hasStructuredToolCallMarker('< TOOL_CALL >'), true);
		assert.strictEqual(hasStructuredToolCallMarker('<function_calls>'), true);
	});
	test('false for standalone <invoke>, prose, code, and a bare { blob', () => {
		assert.strictEqual(hasStructuredToolCallMarker('<invoke name="x">'), false); // standalone invoke excluded
		assert.strictEqual(hasStructuredToolCallMarker('I think you should add a route.'), false);
		assert.strictEqual(hasStructuredToolCallMarker('const x = { a: 1 }'), false);
		assert.strictEqual(hasStructuredToolCallMarker('{"name":"ls_dir"}'), false);
	});
	test('false when the marker is only QUOTED inside code spans', () => {
		assert.strictEqual(hasStructuredToolCallMarker('the `<tool_call>` tag'), false);
		assert.strictEqual(hasStructuredToolCallMarker('```\n<function_calls>...\n```'), false);
		// but a RAW marker outside code still counts even if other code is present
		assert.strictEqual(hasStructuredToolCallMarker('here: <tool_call>{bad  and also `code`'), true);
	});
});
