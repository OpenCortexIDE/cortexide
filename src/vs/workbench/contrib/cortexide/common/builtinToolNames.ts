/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { BuiltinToolName } from './toolsServiceTypes.js';

/**
 * Runtime, exhaustive list of CortexIDE built-in tool names. Single source of truth for any
 * "N built-in tools" figure shown in onboarding/docs, so the number can never drift.
 *
 * The `Record<BuiltinToolName, true>` shape makes this fail to COMPILE if a tool is added to
 * `BuiltinToolCallParams`/`BuiltinToolResultType` (i.e. to the `BuiltinToolName` union) without
 * being added here — the type gate (tsgo) catches the drift, and the count test pins the value.
 *
 * The `import type` above is erased at build time, so this module has no runtime dependencies
 * (it is pure: importable from node unit tests and cheap to bundle into the React UI).
 */
const builtinToolNameTable: Record<BuiltinToolName, true> = {
	// read / search / navigate
	read_file: true,
	ls_dir: true,
	get_dir_tree: true,
	search_pathnames_only: true,
	search_for_files: true,
	search_in_file: true,
	read_lint_errors: true,
	open_file: true,
	go_to_definition: true,
	find_references: true,
	search_symbols: true,
	grep_search: true,
	get_diagnostics: true,
	glob_files: true,
	// code intelligence
	automated_code_review: true,
	generate_tests: true,
	rename_symbol: true,
	extract_function: true,
	// edits
	rewrite_file: true,
	edit_file: true,
	multi_edit: true,
	create_file_or_folder: true,
	delete_file_or_folder: true,
	// terminal
	run_command: true,
	run_nl_command: true,
	open_persistent_terminal: true,
	run_persistent_command: true,
	kill_persistent_terminal: true,
	// web
	web_search: true,
	browse_url: true,
	// agent control / memory
	todo_write: true,
	attempt_completion: true,
	run_subagent: true,
	run_parallel_subagents: true,
	save_memory: true,
};

export const builtinToolNames: BuiltinToolName[] = Object.keys(builtinToolNameTable) as BuiltinToolName[];

/** Number of built-in tools the agent can call. Use this for any user-facing tool count. */
export const builtinToolCount: number = builtinToolNames.length;
