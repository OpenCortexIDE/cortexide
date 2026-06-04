/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *
 *  Agent lifecycle hooks (R3) — types + pure config parsing.
 *  --------------------------------------------------------
 *  Users place a `.cortexide/hooks.json` in the workspace root to run their OWN shell commands at
 *  agent lifecycle events (pre-tool, post-tool, agent-stop). Hooks are FIRE-AND-FORGET status
 *  reporters in v1: the agent does not wait on their output and they cannot cancel a tool. The
 *  command is an explicit argv array (NOT a shell string) and is run with `shell: false`, so there is
 *  no command injection — and the only author of hooks.json is the user, on their own machine.
 *--------------------------------------------------------------------------------------*/

export type HookEvent = 'pre-tool' | 'post-tool' | 'agent-stop';
export const HOOK_EVENTS: readonly HookEvent[] = ['pre-tool', 'post-tool', 'agent-stop'];

export interface HookDefinition {
	/** Which lifecycle event fires this hook. */
	readonly event: HookEvent;
	/** Executable + args as an explicit array (argv). Run with shell:false — no metacharacter expansion. */
	readonly command: string[];
	/** Per-hook timeout in ms (the process is killed after this). Default 5000, capped at 60000. */
	readonly timeoutMs?: number;
}

export interface HooksConfig {
	readonly hooks: HookDefinition[];
}

/** Context passed to a hook process as CORTEX_HOOK_* environment variables. */
export interface HookContext {
	readonly event: HookEvent;
	readonly toolName?: string;
	readonly threadId?: string;
	readonly reason?: string;
}

/** Request sent over the electron-main runner channel. */
export interface HookRunRequest {
	readonly command: string[];
	readonly timeoutMs: number;
	readonly cwd?: string;
	readonly env: Record<string, string>;
}

export interface HookRunResult {
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	readonly error?: string;
}

export const HOOKS_RUNNER_CHANNEL = 'void-channel-hooksRunner';
const DEFAULT_HOOK_TIMEOUT_MS = 5000;
const MAX_HOOK_TIMEOUT_MS = 60000;
const MAX_HOOKS = 50;

/**
 * Pure parser for `.cortexide/hooks.json`. Tolerant: silently drops malformed entries rather than
 * throwing, so one bad hook never breaks the others (or the agent). Accepts either the documented
 * `{ "hooks": [ { event, command, timeoutMs? } ] }` shape, or a bare array of hook entries.
 */
export function parseHooksConfigFile(text: string): HooksConfig {
	let json: unknown;
	try { json = JSON.parse(text); }
	catch { return { hooks: [] }; }

	const rawList: unknown =
		Array.isArray(json) ? json
			: (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).hooks)) ? (json as Record<string, unknown>).hooks
				: [];

	const hooks: HookDefinition[] = [];
	for (const raw of (rawList as unknown[]).slice(0, MAX_HOOKS)) {
		if (!raw || typeof raw !== 'object') { continue; }
		const obj = raw as Record<string, unknown>;
		const event = obj.event;
		if (event !== 'pre-tool' && event !== 'post-tool' && event !== 'agent-stop') { continue; }

		// command: an argv array of non-empty strings. Also accept a single string -> [string] (still
		// run with shell:false, so it is treated as one executable name, not a shell line).
		let command: string[] | null = null;
		if (Array.isArray(obj.command)) {
			const parts = obj.command.filter((c): c is string => typeof c === 'string' && c.length > 0);
			if (parts.length > 0) { command = parts; }
		} else if (typeof obj.command === 'string' && obj.command.trim().length > 0) {
			command = [obj.command.trim()];
		}
		if (!command) { continue; }

		let timeoutMs = DEFAULT_HOOK_TIMEOUT_MS;
		if (typeof obj.timeoutMs === 'number' && obj.timeoutMs > 0) {
			timeoutMs = Math.min(obj.timeoutMs, MAX_HOOK_TIMEOUT_MS);
		}

		hooks.push({ event, command, timeoutMs });
	}
	return { hooks };
}
