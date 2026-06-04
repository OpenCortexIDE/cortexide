/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  HooksRunnerChannel
 *  ------------------
 *  Runs in the Electron main process. Executes user-configured agent lifecycle hooks
 *  (.cortexide/hooks.json) QUIETLY — no visible terminal, output discarded — unlike the agent's
 *  terminal tool. This is the "hidden process runner" the hooks feature (R3) needs.
 *
 *  Security contract:
 *  - The command is an explicit argv array spawned with `shell: false`, so shell metacharacters
 *    (pipes, redirects, subshells) are NOT interpreted — there is no command-injection surface.
 *  - The only author of hooks.json is the user, on their own machine, running their own commands
 *    (mirrors git hooks). The LLM never writes hooks.json.
 *  - Every run is bounded by a timeout and the child is killed if it overruns.
 *  - stdio is 'ignore' (fire-and-forget); the agent never blocks on or consumes hook output.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';
import { spawn } from 'node:child_process';
import type { HookRunRequest, HookRunResult } from '../common/hooksServiceTypes.js';

const HARD_MAX_TIMEOUT_MS = 60000;

export class HooksRunnerChannel implements IServerChannel {

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`HooksRunnerChannel: no events (got listen "${event}")`);
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		switch (command) {
			case 'run':
				return this._run(params as HookRunRequest);
			default:
				throw new Error(`HooksRunnerChannel: unknown command "${command}"`);
		}
	}

	private _run(req: HookRunRequest): Promise<HookRunResult> {
		return new Promise<HookRunResult>((resolve) => {
			// Validate: a non-empty argv array.
			if (!Array.isArray(req?.command) || req.command.length === 0 || typeof req.command[0] !== 'string') {
				resolve({ exitCode: null, timedOut: false, error: 'invalid command' });
				return;
			}
			const exe = req.command[0];
			const args = req.command.slice(1).map(a => String(a));
			const timeoutMs = Math.min(Math.max(1, req.timeoutMs || 5000), HARD_MAX_TIMEOUT_MS);

			let settled = false;
			const finish = (r: HookRunResult) => { if (!settled) { settled = true; resolve(r); } };

			let child: ReturnType<typeof spawn>;
			try {
				child = spawn(exe, args, {
					cwd: req.cwd,
					env: { ...process.env, ...(req.env || {}) },
					shell: false, // CRITICAL: no shell -> no metacharacter expansion / injection
					stdio: 'ignore', // quiet: discard output, never block the agent
					windowsHide: true,
				});
			} catch (e) {
				finish({ exitCode: null, timedOut: false, error: String(e) });
				return;
			}

			const killTimer = setTimeout(() => {
				try { child.kill('SIGKILL'); } catch { /* ignore */ }
				finish({ exitCode: null, timedOut: true });
			}, timeoutMs);

			child.on('error', (e) => { clearTimeout(killTimer); finish({ exitCode: null, timedOut: false, error: String(e) }); });
			child.on('exit', (code) => { clearTimeout(killTimer); finish({ exitCode: code, timedOut: false }); });
		});
	}
}
