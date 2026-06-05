/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js'
import { RawMCPToolCall } from './mcpServiceTypes.js';
import { builtinTools } from './prompt/prompts.js';
import { RawToolParamsObj } from './sendLLMMessageTypes.js';



export type TerminalResolveReason = { type: 'timeout' } | { type: 'done', exitCode: number }

export type LintErrorItem = { code: string, message: string, startLineNumber: number, endLineNumber: number }

// Partial of IFileStat
export type ShallowDirectoryItem = {
	uri: URI;
	name: string;
	isDirectory: boolean;
	isSymbolicLink: boolean;
}


export const approvalTypeOfBuiltinToolName: Partial<{ [T in BuiltinToolName]?: 'edits' | 'terminal' | 'MCP tools' }> = {
	'create_file_or_folder': 'edits',
	'delete_file_or_folder': 'edits',
	'rewrite_file': 'edits',
	'edit_file': 'edits',
	'multi_edit': 'edits',
	'run_command': 'terminal',
	'run_nl_command': 'terminal',
	'run_persistent_command': 'terminal',
	'open_persistent_terminal': 'terminal',
	'kill_persistent_terminal': 'terminal',
}


export type ToolApprovalType = NonNullable<(typeof approvalTypeOfBuiltinToolName)[keyof typeof approvalTypeOfBuiltinToolName]>;


export const toolApprovalTypes = new Set<ToolApprovalType>([
	...Object.values(approvalTypeOfBuiltinToolName),
	'MCP tools',
])




// PARAMS OF TOOL CALL
export type BuiltinToolCallParams = {
	'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
	'ls_dir': { uri: URI, pageNumber: number },
	'get_dir_tree': { uri: URI },
	'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
	'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
	'search_in_file': { uri: URI, query: string, isRegex: boolean },
	'read_lint_errors': { uri: URI },
	'open_file': { uri: URI },
	'go_to_definition': { uri: URI, line: number, column: number },
	'find_references': { uri: URI, line: number, column: number },
	'search_symbols': { query: string, uri: URI | null },
	'automated_code_review': { uri: URI },
	'generate_tests': { uri: URI, functionName?: string, testFramework?: string },
	'rename_symbol': { uri: URI, line: number, column: number, newName: string },
	'extract_function': { uri: URI, startLine: number, endLine: number, functionName: string },
	// ---
	'rewrite_file': { uri: URI, newContent: string },
	'edit_file': { uri: URI, searchReplaceBlocks: string },
	'create_file_or_folder': { uri: URI, isFolder: boolean },
	'delete_file_or_folder': { uri: URI, isRecursive: boolean, isFolder: boolean },
	// ---
	'run_command': { command: string; cwd: string | null, terminalId: string },
	'run_nl_command': { nlInput: string; cwd: string | null, terminalId: string },
	'open_persistent_terminal': { cwd: string | null },
	'run_persistent_command': { command: string; persistentTerminalId: string },
	'kill_persistent_terminal': { persistentTerminalId: string },
	// ---
	'web_search': { query: string, k?: number, refresh?: boolean },
	'browse_url': { url: string, refresh?: boolean },
	// --- fast grep + workspace diagnostics ---
	'grep_search': { query: string; includePattern: string | null; excludePattern: string | null; isRegex: boolean; caseSensitive: boolean },
	'get_diagnostics': { uri: URI | null },
	// --- multi-block atomic edit ---
	'multi_edit': { uri: URI, edits: Array<{ oldString: string; newString: string; replaceAll: boolean }> },
	// --- glob pattern file listing (mtime-sorted) ---
	'glob_files': { pattern: string; limit: number },
	// --- model-managed task list (per-session) ---
	'todo_write': { todos: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' }> },
	// --- explicit completion signal ---
	'attempt_completion': { result: string; command: string | null },
	// --- delegate a scoped task to a sub-agent (handled in chatThreadService, not toolsService) ---
	'run_subagent': { description: string; prompt: string; agentType: string | null },
	// --- run several READ-ONLY research sub-agents concurrently (handled in chatThreadService) ---
	'run_parallel_subagents': { tasks: Array<{ description: string; prompt: string }> },
	// --- persist a durable, learned fact to project memory (surfaced in future system prompts) ---
	'save_memory': { type: 'decision' | 'preference' | 'context'; key: string; value: string; tags: string[] | null },
}

// RESULT OF TOOL CALL
export type BuiltinToolResultType = {
	'read_file': { fileContents: string, totalFileLen: number, totalNumLines: number, hasNextPage: boolean },
	'ls_dir': { children: ShallowDirectoryItem[] | null, hasNextPage: boolean, hasPrevPage: boolean, itemsRemaining: number },
	'get_dir_tree': { str: string, },
	'search_pathnames_only': { uris: URI[], hasNextPage: boolean },
	'search_for_files': { uris: URI[], hasNextPage: boolean },
	'search_in_file': { lines: number[]; },
	'read_lint_errors': { lintErrors: LintErrorItem[] | null },
	'open_file': {},
	'go_to_definition': { locations: Array<{ uri: URI, startLine: number, startColumn: number, endLine: number, endColumn: number }> },
	'find_references': { locations: Array<{ uri: URI, startLine: number, startColumn: number, endLine: number, endColumn: number }> },
	'search_symbols': { symbols: Array<{ name: string, kind: string, uri: URI, startLine: number, startColumn: number, endLine: number, endColumn: number }> },
	'automated_code_review': { fileContent: string, language: string, lintErrors: LintErrorItem[] | null },
	'generate_tests': { fileContent: string, language: string, testFramework: string, suggestedTestFilePath: string },
	'rename_symbol': { changes: Array<{ uri: URI, oldText: string, newText: string, line: number, column: number }> },
	'extract_function': { newFunctionCode: string, replacementCode: string, insertLine: number },
	// ---
	'rewrite_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'edit_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'create_file_or_folder': {},
	'delete_file_or_folder': {},
	// ---
	'run_command': { result: string; resolveReason: TerminalResolveReason; },
	'run_nl_command': { result: string; resolveReason: TerminalResolveReason; parsedCommand: string; explanation: string; },
	'run_persistent_command': { result: string; resolveReason: TerminalResolveReason; },
	'open_persistent_terminal': { persistentTerminalId: string },
	'kill_persistent_terminal': {},
	// ---
	'web_search': { results: Array<{ title: string, snippet: string, url: string }> },
	'browse_url': { content: string, title?: string, url: string, metadata?: { publishedDate?: string } },
	// --- fast grep + workspace diagnostics ---
	'grep_search': { matches: Array<{ uri: URI; lineNumber: number; lineContent: string }>; totalMatches: number },
	'get_diagnostics': { diagnostics: Array<{ uri: URI; message: string; severity: 'error' | 'warning'; startLine: number; endLine: number; source: string | null; code: string | null }> },
	// --- multi-block atomic edit ---
	'multi_edit': Promise<{ lintErrors: LintErrorItem[] | null; appliedCount: number }>,
	// --- glob pattern file listing (mtime-sorted) ---
	'glob_files': { files: Array<{ uri: URI; mtime: number; size: number }>; truncated: boolean },
	// --- model-managed task list (per-session) ---
	'todo_write': { acknowledged: true; count: number },
	// --- explicit completion signal ---
	'attempt_completion': { acknowledged: true },
	// --- sub-agent: the child's final summary, returned to the parent agent ---
	'run_subagent': { result: string; childThreadId: string; completed: boolean },
	// --- parallel sub-agents: each child's summary, returned together to the parent ---
	'run_parallel_subagents': { results: Array<{ description: string; result: string; completed: boolean }> },
	// --- memory write: acknowledgement of the persisted fact ---
	'save_memory': { acknowledged: true; key: string },
}


export type ToolCallParams<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolCallParams[T] : RawToolParamsObj
export type ToolResult<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolResultType[T] : RawMCPToolCall

export type BuiltinToolName = keyof BuiltinToolResultType

type BuiltinToolParamNameOfTool<T extends BuiltinToolName> = keyof (typeof builtinTools)[T]['params']
export type BuiltinToolParamName = { [T in BuiltinToolName]: BuiltinToolParamNameOfTool<T> }[BuiltinToolName]


export type ToolName = BuiltinToolName | (string & {})
export type ToolParamName<T extends ToolName> = T extends BuiltinToolName ? BuiltinToolParamNameOfTool<T> : string
