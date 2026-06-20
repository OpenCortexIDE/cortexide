/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { availableTools, COMPACT_LOCAL_TOOLSET, CAPABLE_LOCAL_TOOLSET, localToolsetFor, builtinToolNames, InternalToolInfo } from '../../common/prompt/prompts.js';

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

	test('CAPABLE local coder (>=7B) ALSO gets the web tools (so "check online" works locally)', () => {
		// localToolsetFor(true) = COMPACT + web tools.
		assert.ok((CAPABLE_LOCAL_TOOLSET as unknown as Set<string>).has('web_search'));
		assert.ok((CAPABLE_LOCAL_TOOLSET as unknown as Set<string>).has('browse_url'));
		for (const t of COMPACT_LOCAL_TOOLSET) {
			assert.ok((CAPABLE_LOCAL_TOOLSET as unknown as Set<string>).has(t), `capable set must still include "${t}"`);
		}
		assert.strictEqual(localToolsetFor(true), CAPABLE_LOCAL_TOOLSET);
		assert.strictEqual(localToolsetFor(false), COMPACT_LOCAL_TOOLSET);
		assert.strictEqual(localToolsetFor(undefined), COMPACT_LOCAL_TOOLSET);

		const capable = (availableTools('agent', fakeMcp, { isLocal: true, isCapableLocalModel: true }) ?? []).map(t => t.name);
		assert.ok(capable.includes('web_search'), 'capable local model should be offered web_search');
		assert.ok(capable.includes('browse_url'), 'capable local model should be offered browse_url');
		assert.ok(capable.includes('read_file') && capable.includes('edit_file'), 'capable local model keeps the core tools');
		assert.ok(!capable.includes('some_mcp_tool'), 'still no MCP for local models');
		assert.ok(!capable.includes('run_persistent_command'), 'still no persistent terminals for local models');

		// A SMALL local model (isCapableLocalModel false) still gets NO web tools.
		const small = (availableTools('agent', fakeMcp, { isLocal: true, isCapableLocalModel: false }) ?? []).map(t => t.name);
		assert.ok(!small.includes('web_search') && !small.includes('browse_url'), 'small local model must not get web tools');
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

suite('availableTools allowedToolNames (R4.2 per-agent restriction)', () => {
	test('intersects to exactly the allowed builtins (+ attempt_completion always kept)', () => {
		const names = (availableTools('agent', fakeMcp, { allowedToolNames: ['read_file', 'edit_file'] }) ?? []).map(t => t.name).sort();
		assert.deepStrictEqual(names, ['attempt_completion', 'edit_file', 'read_file']);
	});

	test('attempt_completion survives even if omitted (a restricted sub-agent must be able to finish)', () => {
		const names = (availableTools('agent', fakeMcp, { allowedToolNames: ['read_file'] }) ?? []).map(t => t.name);
		assert.ok(names.includes('attempt_completion'), 'attempt_completion must always be offered');
		assert.ok(names.includes('read_file'));
		assert.ok(!names.includes('run_command'), 'non-allowed tools are removed');
	});

	test('empty allowedToolNames => only attempt_completion', () => {
		const names = (availableTools('agent', fakeMcp, { allowedToolNames: [] }) ?? []).map(t => t.name);
		assert.deepStrictEqual(names, ['attempt_completion']);
	});

	test('only removes — cannot escalate: combined with isLocal it is the intersection of BOTH', () => {
		// web_search is in neither the local set nor the allow list => absent
		const names = (availableTools('agent', fakeMcp, { isLocal: true, allowedToolNames: ['read_file', 'web_search'] }) ?? []).map(t => t.name).sort();
		assert.ok(names.includes('read_file'));
		assert.ok(names.includes('attempt_completion'));
		assert.ok(!names.includes('web_search'), 'web_search not in the local set => cannot be added back by allowedToolNames');
	});

	test('MCP tools are filtered to the allow list', () => {
		const withMcp = (availableTools('agent', fakeMcp, { allowedToolNames: ['read_file', 'some_mcp_tool'] }) ?? []).map(t => t.name);
		assert.ok(withMcp.includes('some_mcp_tool'), 'allowed MCP tool kept');
		const withoutMcp = (availableTools('agent', fakeMcp, { allowedToolNames: ['read_file'] }) ?? []).map(t => t.name);
		assert.ok(!withoutMcp.includes('some_mcp_tool'), 'non-allowed MCP tool dropped');
	});

	test('absent allowedToolNames => unchanged (backward compatible canary)', () => {
		const a = (availableTools('agent', fakeMcp, { isLocal: false }) ?? []).map(t => t.name).sort();
		const b = (availableTools('agent', fakeMcp, { isLocal: false, allowedToolNames: undefined }) ?? []).map(t => t.name).sort();
		assert.deepStrictEqual(a, b);
	});
});
