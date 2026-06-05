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

/**
 * Param-name synonyms models use for the single file param this IDE's tools universally call `uri`.
 * Models — especially via gateways like Pollinations that emit tool calls as JSON text — frequently use
 * `path` / `file` / `filepath` instead. Without mapping these, EVERY file tool (read_file, get_dir_tree,
 * create_file_or_folder, edit_file, ls_dir, ...) fails validation with "Provided uri must be a string,
 * but it's undefined" and the action silently does nothing.
 */
const URI_PARAM_ALIASES: readonly string[] = [
	'path', 'filepath', 'file_path', 'filePath', 'file', 'filename', 'file_name', 'fileName',
	'dir', 'directory', 'folder', 'folder_path', 'dir_path', 'dirpath', 'target_file', 'targetFile',
	'location', 'pathname', 'uri_path',
];

/**
 * Normalize a tool call's parameter names to what the builtin tools expect. Currently fills the universal
 * `uri` param from a `path`/`file`/`filepath`/... alias when `uri` is missing. Never overwrites an explicit
 * uri. Pure + idempotent — safe to apply on every tool-call ingestion path (native, JSON-text, XML).
 */
export function canonicalizeToolParams(params: Record<string, unknown> | null | undefined): Record<string, unknown> {
	if (!params || typeof params !== 'object' || Array.isArray(params)) { return (params ?? {}) as Record<string, unknown>; }
	const cur = params['uri'];
	if (typeof cur === 'string' && cur.length > 0) { return params; }
	for (const alias of URI_PARAM_ALIASES) {
		const v = params[alias];
		if (typeof v === 'string' && v.length > 0) {
			return { ...params, uri: v };
		}
	}
	return params;
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
				return { toolName: canonicalizeToolName(toolName), toolParams: canonicalizeToolParams(toolParams as Record<string, unknown>) };
			}
		}
	} catch {
		// Not valid JSON / not a tool call — fall through.
	}
	return null;
}

/**
 * Parse Anthropic's XML tool-use format, which Claude emits as TEXT when the endpoint doesn't pass native
 * `tools` (e.g. the Pollinations gateway proxying claude). Shape:
 *   <function_calls><invoke name="get_dir_tree"><parameter name="path">/tmp/x</parameter></invoke></function_calls>
 * We extract the FIRST <invoke> (models often emit a whole fake multi-call transcript with hallucinated
 * results — we run the first REAL call and re-prompt with the real result). Name + param names are
 * canonicalized so e.g. `path` lines up with the builtin tools' `uri`.
 */
export function parseAnthropicFunctionCalls(text: string): ParsedJsonToolCall | null {
	if (typeof text !== 'string' || !/<\s*invoke\b/i.test(text)) { return null; }
	const invokeMatch = text.match(/<\s*invoke\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\s*\/\s*invoke\s*>/i);
	if (!invokeMatch) { return null; }
	const toolName = invokeMatch[1];
	const body = invokeMatch[2];
	const params: Record<string, unknown> = {};
	const paramRe = /<\s*parameter\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\s*\/\s*parameter\s*>/gi;
	let m: RegExpExecArray | null;
	while ((m = paramRe.exec(body)) !== null) {
		params[m[1]] = m[2].trim();
	}
	if (!toolName) { return null; }
	return { toolName: canonicalizeToolName(toolName), toolParams: canonicalizeToolParams(params) };
}

/**
 * Pull a tool call out of free model text in ANY format weak / gateway-proxied models emit: a JSON object
 * (optionally inside a ```json block or <tool_call> wrapper), or Anthropic's <function_calls>/<invoke>
 * XML. Returns the FIRST recognizable call, or null.
 */
export function parseTextToolCall(text: string): ParsedJsonToolCall | null {
	return parseJsonToolCallFromText(text) ?? parseAnthropicFunctionCalls(text);
}
