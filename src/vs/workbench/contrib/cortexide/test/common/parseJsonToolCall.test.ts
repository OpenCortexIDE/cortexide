/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { parseJsonToolCallFromText } from '../../common/parseJsonToolCall.js';

suite('parseJsonToolCallFromText', () => {

	test('canonical {name, arguments}', () => {
		const r = parseJsonToolCallFromText('{"name":"glob_files","arguments":{"pattern":"**/*"}}');
		assert.deepStrictEqual(r, { toolName: 'glob_files', toolParams: { pattern: '**/*' } });
	});

	test('REGRESSION: {function_name, arguments} (the exact shape a weak model emitted)', () => {
		const r = parseJsonToolCallFromText('{"function_name": "glob_files", "arguments": {"limit": 1, "pattern": "**/*"}}');
		assert.ok(r);
		assert.strictEqual(r!.toolName, 'glob_files');
		assert.deepStrictEqual(r!.toolParams, { limit: 1, pattern: '**/*' });
	});

	test('{action, arguments} is recognized (name maps even if the tool is later unknown)', () => {
		const r = parseJsonToolCallFromText('{"action":"list","arguments":{"directory":"/x"}}');
		assert.ok(r);
		assert.strictEqual(r!.toolName, 'list');
		assert.deepStrictEqual(r!.toolParams, { directory: '/x' });
	});

	test('{tool_name, params} and {tool, parameters} and input', () => {
		assert.strictEqual(parseJsonToolCallFromText('{"tool_name":"read_file","params":{"uri":"/a"}}')!.toolName, 'read_file');
		assert.strictEqual(parseJsonToolCallFromText('{"tool":"grep_search","parameters":{"query":"x"}}')!.toolName, 'grep_search');
		assert.deepStrictEqual(parseJsonToolCallFromText('{"name":"read_file","input":{"uri":"/a"}}')!.toolParams, { uri: '/a' });
	});

	test('unwraps a ```json code block and ignores surrounding prose', () => {
		const text = 'Sure, here is the call:\n```json\n{"function_name":"read_file","arguments":{"uri":"/a"}}\n```\nDone.';
		assert.strictEqual(parseJsonToolCallFromText(text)!.toolName, 'read_file');
	});

	test('missing args defaults to empty object', () => {
		assert.deepStrictEqual(parseJsonToolCallFromText('{"name":"ls_dir"}'), { toolName: 'ls_dir', toolParams: {} });
	});

	test('non-tool-call text returns null', () => {
		assert.strictEqual(parseJsonToolCallFromText('I will help you with that. First, let me look around.'), null);
		assert.strictEqual(parseJsonToolCallFromText('{"foo":"bar"}'), null); // no recognizable name field
		assert.strictEqual(parseJsonToolCallFromText('not json at all'), null);
	});
});
