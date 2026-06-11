/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { BuiltinToolName } from './toolsServiceTypes.js';
import type { ChatMode } from './cortexideSettingsTypes.js';

/**
 * Per-tool capability metadata + the dispatch-level permission gate.
 *
 * This is the AUTHORITATIVE, below-the-prompt safety boundary for which tools may run in which
 * chat mode. The prompt-level tool catalog (`availableTools` in prompts.ts) only decides what the
 * model is *told* about; it is advisory and a model can ignore it (weak/cloud/prompt-injected models
 * routinely emit tool calls that were never offered). `_runToolCall` calls `checkToolAllowedInMode`
 * BEFORE validation/approval/execution, so a write/delete/terminal/MCP call in a read-only mode is
 * rejected even if the model fabricates it.
 *
 * Pure module: `import type` only (erased at build), so it is node-unit-testable and cheap to import.
 * The `Record<BuiltinToolName, ToolCapabilityFlags>` shape makes adding a tool to the union without
 * classifying it a COMPILE error — capabilities can never silently drift.
 */

export interface ToolCapabilityFlags {
	/** Reads workspace files/metadata (safe in read-only modes). */
	readsWorkspace: boolean;
	/** Creates or modifies workspace files/folders. */
	writesWorkspace: boolean;
	/** Deletes workspace files/folders. */
	deletesWorkspace: boolean;
	/** Executes shell/terminal commands. */
	runsCommand: boolean;
	/** Makes outbound network requests (blocked under local-only). */
	accessesNetwork: boolean;
	/** Irreversible without a checkpoint/rollback (informs approval defaults). */
	destructive: boolean;
}

const RO = { readsWorkspace: true, writesWorkspace: false, deletesWorkspace: false, runsCommand: false, accessesNetwork: false, destructive: false };

export const BUILTIN_TOOL_CAPABILITIES: Record<BuiltinToolName, ToolCapabilityFlags> = {
	// --- read / search / navigate (read-only) ---
	read_file: { ...RO },
	ls_dir: { ...RO },
	get_dir_tree: { ...RO },
	search_pathnames_only: { ...RO },
	search_for_files: { ...RO },
	search_in_file: { ...RO },
	read_lint_errors: { ...RO },
	open_file: { ...RO },
	go_to_definition: { ...RO },
	find_references: { ...RO },
	search_symbols: { ...RO },
	grep_search: { ...RO },
	get_diagnostics: { ...RO },
	glob_files: { ...RO },
	// --- code intelligence (advisory — return suggestions, do NOT apply them) ---
	automated_code_review: { ...RO },
	generate_tests: { ...RO },
	extract_function: { ...RO },
	// --- edits (mutate the workspace) ---
	rewrite_file: { ...RO, writesWorkspace: true, destructive: true },
	edit_file: { ...RO, writesWorkspace: true, destructive: true },
	multi_edit: { ...RO, writesWorkspace: true, destructive: true },
	create_file_or_folder: { ...RO, writesWorkspace: true },
	delete_file_or_folder: { ...RO, writesWorkspace: true, deletesWorkspace: true, destructive: true },
	// rename is an LSP-backed refactor that applies edits across files — treat as a write.
	rename_symbol: { ...RO, writesWorkspace: true, destructive: true },
	// --- terminal (runs commands) ---
	run_command: { ...RO, runsCommand: true, destructive: true },
	run_nl_command: { ...RO, runsCommand: true, destructive: true },
	run_persistent_command: { ...RO, runsCommand: true, destructive: true },
	open_persistent_terminal: { ...RO, runsCommand: true },
	kill_persistent_terminal: { ...RO, runsCommand: true },
	// --- web / network ---
	web_search: { readsWorkspace: false, writesWorkspace: false, deletesWorkspace: false, runsCommand: false, accessesNetwork: true, destructive: false },
	browse_url: { readsWorkspace: false, writesWorkspace: false, deletesWorkspace: false, runsCommand: false, accessesNetwork: true, destructive: false },
	// --- agent control / memory ---
	// session task list — not a workspace mutation; safe in read-only modes.
	todo_write: { readsWorkspace: false, writesWorkspace: false, deletesWorkspace: false, runsCommand: false, accessesNetwork: false, destructive: false },
	attempt_completion: { readsWorkspace: false, writesWorkspace: false, deletesWorkspace: false, runsCommand: false, accessesNetwork: false, destructive: false },
	// save_memory persists a fact to the project .cortexide memory — a write.
	save_memory: { ...RO, writesWorkspace: true },
	// run_subagent spawns a full (writing-capable) child agent — treat as a workspace write.
	run_subagent: { ...RO, writesWorkspace: true },
	// run_parallel_subagents runs READ-ONLY research children only — safe in read-only modes.
	run_parallel_subagents: { ...RO },
};

/**
 * Chat modes that must not mutate the workspace, run commands, or use MCP action tools.
 *
 * Only `gather` for now. `plan` is NOT included yet: an *approved* plan currently executes via a
 * fresh `_runChatAgent` invocation that inherits the user's `plan` chat mode (see `approvePlan` in
 * chatThreadService.ts), so treating `plan` as read-only here would block plan EXECUTION. Making
 * `plan` read-only requires first decoupling plan-generation (read-only) from plan-execution
 * (which must run with write permissions, i.e. as `agent`). Tracked for Phase 2 (AgentPlanner) /
 * Phase 6 (real plan mode).
 */
export const READ_ONLY_CHAT_MODES: ReadonlySet<ChatMode> = new Set<ChatMode>(['gather']);

export function isReadOnlyChatMode(mode: ChatMode | null | undefined): boolean {
	return mode != null && READ_ONLY_CHAT_MODES.has(mode);
}

/** True if a built-in tool mutates the workspace, deletes, or runs a command. */
export function isMutatingBuiltinTool(toolName: BuiltinToolName): boolean {
	const c = BUILTIN_TOOL_CAPABILITIES[toolName];
	return !!c && (c.writesWorkspace || c.deletesWorkspace || c.runsCommand);
}

export interface ToolPermissionResult {
	allowed: boolean;
	/** Human/LLM-readable reason when blocked (shown to the model so it can self-correct). */
	reason?: string;
}

/**
 * The dispatch-level permission decision. Called in `_runToolCall` before any validation, approval,
 * checkpoint, or execution.
 *
 * - Read-only modes (currently `gather`): block any mutating built-in tool (write/delete/command),
 *   any MCP tool (effects can't be classified), and `save_memory`/`run_subagent`. Read/search tools,
 *   `attempt_completion`, `todo_write`, and `run_parallel_subagents` (read-only) are allowed.
 * - `agent`/`plan`/`normal`: all tools allowed (the agent may mutate; an approved plan executes in
 *   plan mode; normal chat does not reach the loop). See READ_ONLY_CHAT_MODES for why `plan` is excluded.
 * - `localOnly`: additionally block any network tool in ANY mode (no outbound traffic).
 *
 * Unknown (non-builtin = MCP) tools are treated as action tools: blocked in read-only modes, and
 * blocked under local-only (can't prove a remote MCP server is local).
 */
export function checkToolAllowedInMode(
	toolName: string,
	chatMode: ChatMode | null | undefined,
	opts?: { isMCPTool?: boolean; localOnly?: boolean; workspaceTrusted?: boolean }
): ToolPermissionResult {
	const isMCPTool = opts?.isMCPTool ?? false;
	const localOnly = opts?.localOnly ?? false;
	// Default trusted=true so existing callers/tests are unaffected; callers pass the real trust state.
	const untrusted = opts?.workspaceTrusted === false;
	const readOnly = isReadOnlyChatMode(chatMode);
	const modeLabel = chatMode ?? 'this';
	// Both read-only mode and an untrusted workspace restrict to read/search only.
	const restricted = readOnly || untrusted;
	const restrictReason = untrusted
		? `the workspace is not trusted. Trust this workspace (Workspace Trust) to let the agent change files, run commands, or use MCP tools.`
		: `${modeLabel} (read-only) mode. Read and search tools are available; switch to Agent mode to make changes.`;

	if (isMCPTool) {
		if (restricted) {
			return { allowed: false, reason: `Blocked: MCP tools are disabled because ${restrictReason}` };
		}
		if (localOnly) {
			return { allowed: false, reason: `Blocked: MCP tools are disabled while local-only privacy mode is on (they may make external/network calls).` };
		}
		return { allowed: true };
	}

	const caps = BUILTIN_TOOL_CAPABILITIES[toolName as BuiltinToolName];
	// Unknown built-in name: let the existing unknown-tool handling deal with it (don't block here).
	if (!caps) { return { allowed: true }; }

	if (localOnly && caps.accessesNetwork) {
		return { allowed: false, reason: `Blocked: the "${toolName}" tool makes network requests, which are disabled while local-only privacy mode is on.` };
	}

	if (restricted && (caps.writesWorkspace || caps.deletesWorkspace || caps.runsCommand)) {
		return { allowed: false, reason: `Blocked: the "${toolName}" tool can change your workspace and is not allowed because ${restrictReason}` };
	}

	return { allowed: true };
}
