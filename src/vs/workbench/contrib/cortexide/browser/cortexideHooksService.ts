/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  CortexIDE Agent Lifecycle Hooks Service (R3)
 *  --------------------------------------------
 *  Loads `.cortexide/hooks.json` from the workspace root and fires the user's hooks at agent
 *  lifecycle events (pre-tool / post-tool / agent-stop) by asking the electron-main HooksRunnerChannel
 *  to run them QUIETLY. Fire-and-forget: the agent never blocks on a hook and a failing hook never
 *  affects the run. Gated by the `enableLifecycleHooks` global setting (default off) AND by the
 *  presence of a matching hook, so when unused this is a pure no-op (normal chat unaffected).
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { URI } from '../../../../base/common/uri.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { HookContext, HookEvent, HooksConfig, HOOKS_RUNNER_CHANNEL, parseHooksConfigFile } from '../common/hooksServiceTypes.js';

export const ICortexideHooksService = createDecorator<ICortexideHooksService>('cortexideHooksService');

export interface ICortexideHooksService {
	readonly _serviceBrand: undefined;
	/** True if the feature is enabled AND at least one hook is configured for the event. */
	hasHooksForEvent(event: HookEvent): boolean;
	/** Fire all hooks for an event (fire-and-forget; never throws, never blocks the caller). */
	runHooksForEvent(context: HookContext): void;
}

const HOOKS_FILE = '.cortexide/hooks.json';
const MAX_HOOKS_FILE_BYTES = 16 * 1024;

class CortexideHooksService extends Disposable implements ICortexideHooksService {
	declare readonly _serviceBrand: undefined;

	private _config: HooksConfig = { hooks: [] };
	private _channel: IChannel | null = null;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@ICortexideSettingsService private readonly settingsService: ICortexideSettingsService,
	) {
		super();
		try { this._channel = this.mainProcessService.getChannel(HOOKS_RUNNER_CHANNEL); }
		catch { this._channel = null; }
		this._initialize();
	}

	hasHooksForEvent(event: HookEvent): boolean {
		if (!this.settingsService.state.globalSettings.enableLifecycleHooks) { return false; }
		return this._config.hooks.some(h => h.event === event);
	}

	runHooksForEvent(context: HookContext): void {
		if (!this.hasHooksForEvent(context.event) || !this._channel) { return; }
		const cwd = this._workspaceRoot();
		const env: Record<string, string> = {
			CORTEX_HOOK_EVENT: context.event,
			...(context.toolName ? { CORTEX_HOOK_TOOL: context.toolName } : {}),
			...(context.threadId ? { CORTEX_HOOK_THREAD: context.threadId } : {}),
			...(context.reason ? { CORTEX_HOOK_REASON: context.reason } : {}),
		};
		for (const h of this._config.hooks) {
			if (h.event !== context.event) { continue; }
			// Fire-and-forget: do not await; swallow all errors so a hook can never break the agent loop.
			this._channel.call('run', { command: h.command, timeoutMs: h.timeoutMs ?? 5000, cwd, env })
				.catch(() => { /* hook failures are intentionally silent */ });
		}
	}

	private _workspaceRoot(): string | undefined {
		const folders = this.workspaceService.getWorkspace().folders;
		return folders.length > 0 ? folders[0].uri.fsPath : undefined;
	}

	private async _initialize(): Promise<void> {
		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length === 0) { return; }
		const hooksUri = URI.joinPath(folders[0].uri, HOOKS_FILE);
		await this._load(hooksUri);
		try {
			this._register(this.fileService.watch(hooksUri));
			this._register(this.fileService.onDidFilesChange(async e => {
				if (e.affects(hooksUri)) { await this._load(hooksUri); }
			}));
		} catch {
			// hooks.json doesn't exist yet — that's fine; no watch needed.
		}
	}

	private async _load(hooksUri: URI): Promise<void> {
		try {
			const stat = await this.fileService.resolve(hooksUri);
			if (stat.isDirectory) { this._config = { hooks: [] }; return; }
			const raw = await this.fileService.readFile(hooksUri);
			const text = raw.value.slice(0, MAX_HOOKS_FILE_BYTES).toString();
			this._config = parseHooksConfigFile(text);
		} catch {
			this._config = { hooks: [] };
		}
	}
}

registerSingleton(ICortexideHooksService, CortexideHooksService, InstantiationType.Delayed);
