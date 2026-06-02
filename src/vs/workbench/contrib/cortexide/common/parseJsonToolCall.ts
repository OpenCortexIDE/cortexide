/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure parser: pull a tool call out of free model text.
 *
 * Weak / local models that don't follow the XML tool format often emit a JSON tool call as
 * plain text (sometimes inside a ```json block) and use whatever field names they were trained
 * on. We accept the common shapes for the NAME field (name / function_name / tool_name / tool /
 * action) and the ARGS field (arguments / params / parameters / input) so those calls actually
 * execute instead of being rendered as inert text. Tool-name validity + param coercion are
 * handled downstream (an unknown name yields a recoverable "no such tool" result).
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/parseJsonToolCall.test.ts`.
 */

export interface ParsedJsonToolCall {
	readonly toolName: string;
	readonly toolParams: Record<string, unknown>;
}

/**
 * Common tool-name synonyms weak models emit, mapped to the canonical builtin tool name. Ollama
 * models don't return structured tool_calls (they dump JSON in content), so the model freely invents
 * names — `create_file` instead of `create_file_or_folder`, `list` instead of `ls_dir`, etc. Mapping
 * them lets the call actually run instead of bouncing off "no such tool".
 */
const TOOL_NAME_ALIASES: Readonly<Record<string, string>> = {
	create_file: 'create_file_or_folder', create: 'create_file_or_folder', new_file: 'create_file_or_folder',
	make_file: 'create_file_or_folder', touch: 'create_file_or_folder', write_new_file: 'create_file_or_folder',
	write_file: 'rewrite_file', overwrite_file: 'rewrite_file', save_file: 'rewrite_file',
	edit: 'edit_file', modify_file: 'edit_file', update_file: 'edit_file', apply_edit: 'edit_file', apply_diff: 'edit_file',
	read: 'read_file', open: 'read_file', open_file: 'read_file', cat: 'read_file', view_file: 'read_file', view: 'read_file',
	list: 'ls_dir', ls: 'ls_dir', list_files: 'ls_dir', list_dir: 'ls_dir', list_directory: 'ls_dir',
	list_workspace_folders: 'ls_dir', list_workspace: 'ls_dir', dir: 'ls_dir',
	search: 'grep_search', grep: 'grep_search', search_text: 'grep_search', search_code: 'grep_search',
	find: 'search_for_files', find_files: 'search_for_files', search_files: 'search_for_files', find_file: 'search_for_files',
	glob: 'glob_files',
	delete: 'delete_file_or_folder', remove: 'delete_file_or_folder', rm: 'delete_file_or_folder', delete_file: 'delete_file_or_folder',
	run: 'run_command', exec: 'run_command', execute: 'run_command', shell: 'run_command', bash: 'run_command',
	run_terminal: 'run_command', terminal: 'run_command', run_shell: 'run_command',
	done: 'attempt_completion', finish: 'attempt_completion', complete: 'attempt_completion',
	completion: 'attempt_completion', no_completion: 'attempt_completion', finish_task: 'attempt_completion',
	todo: 'todo_write', update_todo: 'todo_write', set_todos: 'todo_write',
	diagnostics: 'get_diagnostics', get_errors: 'get_diagnostics', lint: 'read_lint_errors',
};

/** Map a (possibly invented) tool name to the canonical builtin name when there's a known synonym. */
export function canonicalizeToolName(name: string): string {
	if (typeof name !== 'string') { return name; }
	return TOOL_NAME_ALIASES[name.trim().toLowerCase()] ?? name;
}

export function parseJsonToolCallFromText(text: string): ParsedJsonToolCall | null {
	try {
		let jsonStr = text.trim();

		// Unwrap a ```json ... ``` (or bare ``` ... ```) code block if present.
		const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		// Find the first balanced { ... } object.
		const openBraceIdx = jsonStr.indexOf('{');
		if (openBraceIdx === -1) {
			return null;
		}
		let braceCount = 0;
		let closeBraceIdx = -1;
		for (let i = openBraceIdx; i < jsonStr.length; i++) {
			if (jsonStr[i] === '{') { braceCount++; }
			if (jsonStr[i] === '}') {
				braceCount--;
				if (braceCount === 0) { closeBraceIdx = i; break; }
			}
		}
		if (closeBraceIdx === -1) {
			return null;
		}

		const parsed = JSON.parse(jsonStr.substring(openBraceIdx, closeBraceIdx + 1));
		if (typeof parsed === 'object' && parsed !== null) {
			const toolName = parsed.name ?? parsed.function_name ?? parsed.tool_name ?? parsed.tool ?? parsed.action;
			const toolParams = parsed.arguments || parsed.params || parsed.parameters || parsed.input || {};
			if (typeof toolName === 'string' && typeof toolParams === 'object' && toolParams !== null) {
				return { toolName: canonicalizeToolName(toolName), toolParams: toolParams as Record<string, unknown> };
			}
		}
	} catch {
		// Not valid JSON / not a tool call — fall through.
	}
	return null;
}
