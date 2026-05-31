/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { availableTools, COMPACT_LOCAL_TOOLSET, builtinToolNames, InternalToolInfo } from '../../common/prompt/prompts.js';

const fakeMcp: InternalToolInfo[] = [{ name: 'some_mcp_tool', description: 'demo mcp tool', params: {} } as InternalToolInfo];
const setStr = COMPACT_LOCAL_TOOLSET as unknown as Set<string>;

suite('COMPACT_LOCAL_TOOLSET / availableTools(isLocal)', () => {

	test('every curated tool is a real builtin (no dead names)', () => {
		for (const t of COMPACT_LOCAL_TOOLSET) {
			assert.ok(builtinToolNames.includes(t), `curated tool "${t}" is not a known builtin tool`);
		}
	});

	test('curated set EXCLUDES persistent-terminal / web tools (the hallucination sources)', () => {
		for (const t of ['run_persistent_command', 'open_persistent_terminal', 'kill_persistent_terminal', 'web_search', 'browse_url', 'multi_edit', 'rename_symbol', 'extract_function']) {
			assert.ok(!setStr.has(t), `"${t}" must not be in the local set`);
		}
	});

	test('curated set KEEPS run_command + core read/search/edit tools', () => {
		for (const t of ['run_command', 'read_file', 'edit_file', 'rewrite_file', 'search_for_files', 'grep_search', 'get_diagnostics', 'attempt_completion']) {
			assert.ok(setStr.has(t), `"${t}" should be in the local set`);
		}
	});

	test('local agent mode returns ONLY curated tools and NO MCP', () => {
		const names = (availableTools('agent', fakeMcp, { isLocal: true }) ?? []).map(t => t.name);
		assert.ok(names.length > 0, 'local agent mode should still offer tools');
		for (const n of names) {
			assert.ok(setStr.has(n), `unexpected tool "${n}" offered to a local model`);
		}
		assert.ok(!names.includes('some_mcp_tool'), 'MCP tools must be dropped for local models');
		assert.ok(!names.includes('run_persistent_command'), 'persistent-terminal tools must be dropped for local models');
	});

	test('non-local agent mode keeps the FULL set + MCP', () => {
		const names = (availableTools('agent', fakeMcp, { isLocal: false }) ?? []).map(t => t.name);
		assert.ok(names.includes('run_persistent_command'), 'full set keeps persistent-terminal tools');
		assert.ok(names.includes('web_search'), 'full set keeps web tools');
		assert.ok(names.includes('some_mcp_tool'), 'full set keeps MCP tools');
	});

	test('default (no opts) is identical to non-local (backward compatible)', () => {
		const a = (availableTools('agent', fakeMcp) ?? []).map(t => t.name).sort();
		const b = (availableTools('agent', fakeMcp, { isLocal: false }) ?? []).map(t => t.name).sort();
		assert.deepStrictEqual(a, b);
	});
});
