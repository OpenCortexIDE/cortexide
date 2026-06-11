/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { checkToolAllowedInMode, BUILTIN_TOOL_CAPABILITIES, isReadOnlyChatMode, isMutatingBuiltinTool } from '../../common/toolPermissions.js';
import { approvalTypeOfBuiltinToolName } from '../../common/toolsServiceTypes.js';
import { builtinToolNames } from '../../common/builtinToolNames.js';

/**
 * Phase 1 — dispatch-level read-only enforcement.
 *
 * checkToolAllowedInMode is the AUTHORITATIVE boundary called in _runToolCall before any
 * validation/approval/execution, regardless of how the tool call was produced (native function call,
 * JSON-in-text, XML, Anthropic <function_calls>, or synthesized). So these tests — exercising the
 * gate directly — cover every parse path: a write/delete/terminal/MCP call cannot run in gather mode
 * no matter how a (weak / cloud / prompt-injected) model emits it.
 */
suite('Phase 1 — tool permission gate (gather/read-only enforcement)', () => {

	test('gather mode BLOCKS every mutating built-in tool (write/delete/terminal)', () => {
		for (const tool of ['edit_file', 'rewrite_file', 'multi_edit', 'create_file_or_folder', 'delete_file_or_folder', 'run_command', 'run_nl_command', 'run_persistent_command', 'open_persistent_terminal', 'kill_persistent_terminal', 'rename_symbol', 'save_memory', 'run_subagent']) {
			const r = checkToolAllowedInMode(tool, 'gather');
			assert.strictEqual(r.allowed, false, `${tool} must be blocked in gather mode`);
			assert.ok(r.reason && r.reason.length > 0, `${tool} block must include a reason`);
		}
	});

	test('gather mode ALLOWS read/search/navigation tools and harmless controls', () => {
		for (const tool of ['read_file', 'ls_dir', 'get_dir_tree', 'search_for_files', 'grep_search', 'get_diagnostics', 'go_to_definition', 'find_references', 'search_symbols', 'glob_files', 'read_lint_errors', 'open_file', 'attempt_completion', 'todo_write', 'run_parallel_subagents']) {
			assert.strictEqual(checkToolAllowedInMode(tool, 'gather').allowed, true, `${tool} should be allowed in gather mode`);
		}
	});

	test('gather mode BLOCKS all MCP (non-builtin) tools — effects cannot be classified', () => {
		const r = checkToolAllowedInMode('some_mcp_server_tool', 'gather', { isMCPTool: true });
		assert.strictEqual(r.allowed, false);
	});

	test('agent mode ALLOWS everything (writes, terminal, MCP)', () => {
		for (const tool of ['edit_file', 'delete_file_or_folder', 'run_command', 'save_memory', 'run_subagent']) {
			assert.strictEqual(checkToolAllowedInMode(tool, 'agent').allowed, true, `${tool} should be allowed in agent mode`);
		}
		assert.strictEqual(checkToolAllowedInMode('mcp_tool', 'agent', { isMCPTool: true }).allowed, true);
	});

	test('plan mode is NOT (yet) read-only — an approved plan executes in plan mode (see READ_ONLY_CHAT_MODES)', () => {
		assert.strictEqual(isReadOnlyChatMode('plan'), false);
		assert.strictEqual(checkToolAllowedInMode('edit_file', 'plan').allowed, true);
	});

	test('local-only privacy mode BLOCKS network tools in ANY mode', () => {
		assert.strictEqual(checkToolAllowedInMode('web_search', 'agent', { localOnly: true }).allowed, false);
		assert.strictEqual(checkToolAllowedInMode('browse_url', 'agent', { localOnly: true }).allowed, false);
		// MCP tools also blocked under local-only (may call out).
		assert.strictEqual(checkToolAllowedInMode('mcp_tool', 'agent', { isMCPTool: true, localOnly: true }).allowed, false);
		// without local-only, network tools are fine in agent mode
		assert.strictEqual(checkToolAllowedInMode('web_search', 'agent').allowed, true);
	});

	test('an unknown built-in name is not blocked here (left to the unknown-tool handler)', () => {
		assert.strictEqual(checkToolAllowedInMode('totally_made_up_tool', 'gather').allowed, true);
	});

	test('isReadOnlyChatMode: only gather today', () => {
		assert.strictEqual(isReadOnlyChatMode('gather'), true);
		assert.strictEqual(isReadOnlyChatMode('agent'), false);
		assert.strictEqual(isReadOnlyChatMode('normal'), false);
		assert.strictEqual(isReadOnlyChatMode(null), false);
	});
});

suite('Phase 1 — workspace trust enforcement', () => {

	test('UNTRUSTED workspace blocks writes/terminal/MCP even in agent mode', () => {
		for (const tool of ['edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder', 'run_command', 'run_persistent_command']) {
			const r = checkToolAllowedInMode(tool, 'agent', { workspaceTrusted: false });
			assert.strictEqual(r.allowed, false, `${tool} must be blocked in an untrusted workspace`);
			assert.ok(r.reason && /not trusted|Workspace Trust/i.test(r.reason), `${tool} block reason should mention trust`);
		}
		assert.strictEqual(checkToolAllowedInMode('mcp_tool', 'agent', { isMCPTool: true, workspaceTrusted: false }).allowed, false);
	});

	test('UNTRUSTED workspace still ALLOWS read/search (safe to understand the repo)', () => {
		for (const tool of ['read_file', 'ls_dir', 'search_for_files', 'grep_search', 'get_diagnostics']) {
			assert.strictEqual(checkToolAllowedInMode(tool, 'agent', { workspaceTrusted: false }).allowed, true, `${tool} should be allowed read-only in untrusted workspace`);
		}
	});

	test('TRUSTED workspace (default) allows writes in agent mode', () => {
		assert.strictEqual(checkToolAllowedInMode('edit_file', 'agent', { workspaceTrusted: true }).allowed, true);
		// default (no flag) is trusted, so existing behaviour is unchanged
		assert.strictEqual(checkToolAllowedInMode('edit_file', 'agent').allowed, true);
	});
});

suite('Phase 1 — tool capability table consistency', () => {

	test('every built-in tool has a capability entry', () => {
		for (const name of builtinToolNames) {
			assert.ok(BUILTIN_TOOL_CAPABILITIES[name], `missing capability flags for ${name}`);
		}
	});

	test("capabilities agree with approvalTypeOfBuiltinToolName (no drift between the two sources of truth)", () => {
		for (const [tool, approval] of Object.entries(approvalTypeOfBuiltinToolName)) {
			const caps = BUILTIN_TOOL_CAPABILITIES[tool as keyof typeof BUILTIN_TOOL_CAPABILITIES];
			assert.ok(caps, `capability flags missing for approval-typed tool ${tool}`);
			if (approval === 'edits') {
				assert.ok(caps.writesWorkspace || caps.deletesWorkspace, `${tool} has approvalType 'edits' but is not classified as writing/deleting`);
				assert.ok(isMutatingBuiltinTool(tool as keyof typeof BUILTIN_TOOL_CAPABILITIES), `${tool} (edits) must be mutating`);
			}
			if (approval === 'terminal') {
				assert.ok(caps.runsCommand, `${tool} has approvalType 'terminal' but runsCommand is false`);
			}
		}
	});

	test('every approval-typed (edits/terminal) tool is blocked in gather mode', () => {
		for (const tool of Object.keys(approvalTypeOfBuiltinToolName)) {
			assert.strictEqual(checkToolAllowedInMode(tool, 'gather').allowed, false, `approval-typed ${tool} must be blocked in gather`);
		}
	});
});
