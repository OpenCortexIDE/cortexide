/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { parseJsonToolCallFromText, canonicalizeToolName, canonicalizeToolParams } from '../../common/parseJsonToolCall.js';

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

	test('{action, arguments} is recognized; the invented name is canonicalized (list -> ls_dir)', () => {
		const r = parseJsonToolCallFromText('{"action":"list","arguments":{"directory":"/x"}}');
		assert.ok(r);
		assert.strictEqual(r!.toolName, 'ls_dir');
		// param-canonicalization also fills `uri` from the `directory` alias so ls_dir (which expects uri) validates
		assert.deepStrictEqual(r!.toolParams, { directory: '/x', uri: '/x' });
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

	test('REGRESSION: the exact name the 7B invented (create_file) is canonicalized so the call runs', () => {
		const r = parseJsonToolCallFromText('{"name":"create_file","arguments":{"uri":"fib.py","contents":"x"}}');
		assert.strictEqual(r!.toolName, 'create_file_or_folder');
	});
});

suite('canonicalizeToolName', () => {
	test('maps the common invented names to canonical builtins', () => {
		assert.strictEqual(canonicalizeToolName('create_file'), 'create_file_or_folder');
		assert.strictEqual(canonicalizeToolName('write_file'), 'rewrite_file');
		assert.strictEqual(canonicalizeToolName('list_workspace_folders'), 'ls_dir');
		assert.strictEqual(canonicalizeToolName('no_completion'), 'attempt_completion');
		assert.strictEqual(canonicalizeToolName('run'), 'run_command');
		assert.strictEqual(canonicalizeToolName('delete'), 'delete_file_or_folder');
	});

	test('is case- and whitespace-insensitive', () => {
		assert.strictEqual(canonicalizeToolName('  Create_File '), 'create_file_or_folder');
		assert.strictEqual(canonicalizeToolName('LIST'), 'ls_dir');
	});

	test('leaves a valid canonical name untouched', () => {
		assert.strictEqual(canonicalizeToolName('create_file_or_folder'), 'create_file_or_folder');
		assert.strictEqual(canonicalizeToolName('grep_search'), 'grep_search');
	});

	test('leaves an unknown name untouched (downstream yields a recoverable "no such tool")', () => {
		assert.strictEqual(canonicalizeToolName('frobnicate'), 'frobnicate');
	});
});

suite('canonicalizeToolParams', () => {
	test('THE pollinations bug: {path} maps to {uri} so file tools validate', () => {
		assert.deepStrictEqual(canonicalizeToolParams({ path: '/tmp/x' }), { path: '/tmp/x', uri: '/tmp/x' });
	});
	test('maps file/filepath/file_path/directory aliases to uri', () => {
		assert.strictEqual(canonicalizeToolParams({ file: 'a.txt' }).uri, 'a.txt');
		assert.strictEqual(canonicalizeToolParams({ filepath: 'a.txt' }).uri, 'a.txt');
		assert.strictEqual(canonicalizeToolParams({ file_path: 'a.txt' }).uri, 'a.txt');
		assert.strictEqual(canonicalizeToolParams({ directory: '/d' }).uri, '/d');
	});
	test('never overwrites an explicit uri', () => {
		assert.deepStrictEqual(canonicalizeToolParams({ uri: '/real', path: '/other' }), { uri: '/real', path: '/other' });
	});
	test('leaves non-file params (run_command{command}, grep{query}) untouched', () => {
		assert.deepStrictEqual(canonicalizeToolParams({ command: 'rm -f x' }), { command: 'rm -f x' });
		assert.deepStrictEqual(canonicalizeToolParams({ query: 'foo' }), { query: 'foo' });
	});
	test('end-to-end: a {"name":"get_dir_tree","arguments":{"path":...}} text call resolves uri', () => {
		const r = parseJsonToolCallFromText('<tool_call>\n{"name": "get_dir_tree", "arguments": {"path": "/tmp/cx"}}\n</tool_call>');
		assert.ok(r);
		assert.strictEqual(r!.toolName, 'get_dir_tree');
		assert.strictEqual(r!.toolParams.uri, '/tmp/cx');
	});
	test('handles empty / non-object params safely', () => {
		assert.deepStrictEqual(canonicalizeToolParams({}), {});
		assert.deepStrictEqual(canonicalizeToolParams(null), {});
		assert.deepStrictEqual(canonicalizeToolParams(undefined), {});
	});
});
