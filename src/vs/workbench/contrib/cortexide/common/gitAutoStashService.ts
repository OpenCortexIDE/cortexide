/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { parseStashIndex } from './gitStashRef.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAuditLogService } from './auditLogService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize } from '../../../../nls.js';
import Severity from '../../../../base/common/severity.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

export const IGitAutoStashService = createDecorator<IGitAutoStashService>('gitAutoStashService');

export interface IGitAutoStashService {
	readonly _serviceBrand: undefined;
	isEnabled(): boolean;
	createStash(operationId: string): Promise<string | undefined>;
	restoreStash(stashRef: string): Promise<void>;
	dropStash(stashRef: string): Promise<void>;
}

class GitAutoStashService extends Disposable implements IGitAutoStashService {
	declare readonly _serviceBrand: undefined;

	private _enabled = true;
	// Note: _mode is reserved for future implementation when direct git API access is available
	// Currently using commands which don't easily support dirty-only mode checking
	private _stashRefs = new Map<string, string>(); // operationId -> stashRef

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@IAuditLogService private readonly _auditLogService: IAuditLogService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super();
		this._updateConfiguration();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cortexide.safety.autostash')) {
				this._updateConfiguration();
			}
		}));
	}

	private _updateConfiguration(): void {
		this._enabled = this._configurationService.getValue<boolean>('cortexide.safety.autostash.enable') ?? true;
		// Note: mode configuration is read but not yet implemented due to command-based approach
		// const mode = this._configurationService.getValue<'always' | 'dirty-only'>('cortexide.safety.autostash.mode') ?? 'dirty-only';
	}

	isEnabled(): boolean {
		return this._enabled;
	}

	async createStash(operationId: string): Promise<string | undefined> {
		if (!this._enabled) {
			return undefined;
		}

		try {
			// Check if git extension is available
			const gitExtension = await this._extensionService.getExtension('vscode.git');
			if (!gitExtension) {
				this._logService.warn('[GitAutoStash] Git extension not available');
				return undefined;
			}

			// Activate git extension
			await this._extensionService.activateById(gitExtension.identifier, { startup: false, extensionId: gitExtension.identifier, activationEvent: 'api' });

			// Note: git.stash command requires user interaction (prompts for message)
			// For auto-stash, we use git.stashIncludeUntracked which can be called programmatically
			// but still may prompt. This is a known limitation - proper implementation would
			// require direct git API access which isn't easily available from workbench.

			// For P0, we'll attempt stash and handle gracefully if it fails
			try {
				// Use stashIncludeUntracked which is more suitable for auto-stash
				// It will stash all changes including untracked files
				await this._commandService.executeCommand('git.stashIncludeUntracked');
			} catch (error) {
				// If stash fails (e.g., no changes, user cancelled), return undefined
				const errorStr = String(error);
				if (errorStr.includes('no changes') || errorStr.includes('cancelled')) {
					return undefined;
				}
				throw error;
			}

			// After stash, the latest stash is at index 0
			const stashRef = `stash@{0}`;
			this._stashRefs.set(operationId, stashRef);

			// Non-blocking toast
			this._notificationService.notify({
				severity: Severity.Info,
				message: localize('autostash.created', 'Auto-stash created: {0} — use Git:Stashes to inspect.', stashRef),
				sticky: false,
			});

			// Audit log
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'git:stash',
					ok: true,
					meta: { operationId, stashRef },
				});
			}

			return stashRef;
		} catch (error) {
			this._logService.error('[GitAutoStash] Failed to create stash:', error);
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'git:stash',
					ok: false,
					meta: { operationId, error: String(error) },
				});
			}
			return undefined;
		}
	}

	async restoreStash(stashRef: string): Promise<void> {
		try {
			// Parse stash index from ref (format: "stash@{0}") -- pure, tested (common/gitStashRef.ts).
			const stashIndex = parseStashIndex(stashRef);

			// For index 0 (latest), use stashPopLatest/stashApplyLatest which don't require repository
			// Try stash pop (apply and drop) first, fallback to stash apply
			if (stashIndex === 0) {
				try {
					await this._commandService.executeCommand('git.stashPopLatest');
				} catch (error) {
					// If pop fails (conflicts), try apply
					await this._commandService.executeCommand('git.stashApplyLatest');
				}
			} else {
				// For other indices, we'd need repository - this is a limitation
				// For P0, we only support latest stash (index 0)
				this._logService.warn(`[GitAutoStash] Restore of stash@{${stashIndex}} not supported, only stash@{0} is supported`);
				throw new Error(`Only stash@{0} restore is supported`);
			}

			// Audit log
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'git:stash:restore',
					ok: true,
					meta: { stashRef },
				});
			}

			this._notificationService.notify({
				severity: Severity.Info,
				message: localize('autostash.restored', 'Apply failed. Working tree restored from {0}.', stashRef),
				sticky: false,
			});
		} catch (error) {
			this._logService.error('[GitAutoStash] Failed to restore stash:', error);
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'git:stash:restore',
					ok: false,
					meta: { stashRef, error: String(error) },
				});
			}
			throw error;
		}
	}

	async dropStash(stashRef: string): Promise<void> {
		try {
			// Parse stash index from ref (format: "stash@{0}") -- pure, tested (common/gitStashRef.ts).
			const stashIndex = parseStashIndex(stashRef);
			await this._commandService.executeCommand('git.stashDrop', stashIndex);
		} catch (error) {
			this._logService.warn('[GitAutoStash] Failed to drop stash:', error);
		}
	}
}

registerSingleton(IGitAutoStashService, GitAutoStashService, InstantiationType.Delayed);

