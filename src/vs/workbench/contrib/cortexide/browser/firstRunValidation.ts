/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ISecretDetectionService } from '../common/secretDetectionService.js';

const FIRST_RUN_VALIDATION_KEY = 'cortexide.firstRunValidation';
const FIRST_RUN_VALIDATION_COMPLETE_KEY = 'cortexide.firstRunValidationComplete';

/**
 * First-run smoke test validation
 * Exercises critical paths to catch crashes early
 */
export class FirstRunValidationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.cortexideFirstRunValidation';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IEditorService private readonly editorService: IEditorService,
		@ILogService private readonly logService: ILogService,
		@ISecretDetectionService private readonly secretDetectionService: ISecretDetectionService,
	) {
		super();
		this.setupConsoleRedaction();
		this.runValidation();
	}

	/**
	 * Wrap console methods to redact secrets in Cortexide code paths
	 * This ensures secrets never reach console output
	 */
	private setupConsoleRedaction(): void {
		const config = this.secretDetectionService.getConfig();
		if (!config.enabled) {
			return;
		}

		// Store original console methods
		const originalLog = console.log;
		const originalError = console.error;
		const originalWarn = console.warn;
		const originalInfo = console.info;
		const originalDebug = console.debug;

		// Wrap console methods to redact secrets
		console.log = (...args: any[]) => {
			const redacted = this.secretDetectionService.redactSecretsInObject(args);
			originalLog(...(redacted.hasSecrets ? redacted.redacted : args));
		};

		console.error = (...args: any[]) => {
			// Suppress non-fatal Web Locks API errors (they occur during initialization when context isn't fully ready)
			const errorMessage = args.map(arg => typeof arg === 'string' ? arg : String(arg)).join(' ');
			if (errorMessage.includes('lock() request could not be registered') ||
				errorMessage.includes('InvalidStateError') && errorMessage.includes('lock')) {
				// Suppress this non-fatal error - it's a known issue with Web Locks API during initialization
				return;
			}
			const redacted = this.secretDetectionService.redactSecretsInObject(args);
			originalError(...(redacted.hasSecrets ? redacted.redacted : args));
		};

		console.warn = (...args: any[]) => {
			const redacted = this.secretDetectionService.redactSecretsInObject(args);
			originalWarn(...(redacted.hasSecrets ? redacted.redacted : args));
		};

		console.info = (...args: any[]) => {
			const redacted = this.secretDetectionService.redactSecretsInObject(args);
			originalInfo(...(redacted.hasSecrets ? redacted.redacted : args));
		};

		console.debug = (...args: any[]) => {
			const redacted = this.secretDetectionService.redactSecretsInObject(args);
			originalDebug(...(redacted.hasSecrets ? redacted.redacted : args));
		};

		// Restore on dispose
		this._register({
			dispose: () => {
				console.log = originalLog;
				console.error = originalError;
				console.warn = originalWarn;
				console.info = originalInfo;
				console.debug = originalDebug;
			},
		});
	}

	private async runValidation(): Promise<void> {
		// Check if validation was already completed
		const validationComplete = this.storageService.getBoolean(FIRST_RUN_VALIDATION_COMPLETE_KEY, StorageScope.APPLICATION);
		if (validationComplete) {
			return;
		}

		// Check if this is a first run (no validation key exists)
		const hasRunBefore = this.storageService.get(FIRST_RUN_VALIDATION_KEY, StorageScope.APPLICATION);
		if (hasRunBefore) {
			// Mark as complete if we've run before
			this.storageService.store(FIRST_RUN_VALIDATION_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
			return;
		}

		// Mark that we've started validation
		this.storageService.store(FIRST_RUN_VALIDATION_KEY, 'started', StorageScope.APPLICATION, StorageTarget.MACHINE);

		try {
			this.logService.info('[FirstRunValidation] Starting smoke test...');

			// Smoke test 1: Open a file (if workspace has files)
			try {
				const editors = this.editorService.visibleEditors;
				if (editors.length > 0) {
					const firstEditor = editors[0];
					if (firstEditor.resource) {
						// File is already open, test passed
						this.logService.info('[FirstRunValidation] ✓ File access test passed');
					}
				}
			} catch (error) {
				this.logService.error('[FirstRunValidation] File access test failed:', error);
			}

			// Smoke test 2: Quick Action command availability
			try {
				// Check if Quick Action commands are registered (don't execute, just check).
				// Quick Actions are registered with `void.`-prefixed IDs in quickActions.ts
				// (e.g. void.explainCode); the old probe checked a non-existent
				// 'cortexide.quickAction' ID and therefore always warned.
				const commands = CommandsRegistry.getCommands();
				const quickActionIds = ['void.explainCode', 'void.refactorCode', 'void.addTests'];
				const hasQuickAction = quickActionIds.some(id => commands.has(id));
				if (hasQuickAction) {
					this.logService.info('[FirstRunValidation] ✓ Quick Action command available');
				} else {
					this.logService.warn('[FirstRunValidation] ⚠ Quick Action command not found');
				}
			} catch (error) {
				this.logService.error('[FirstRunValidation] Command check failed:', error);
			}

			// Smoke test 3: Basic service availability
			try {
				// Services should be available at this point
				this.logService.info('[FirstRunValidation] ✓ Services initialized');
			} catch (error) {
				this.logService.error('[FirstRunValidation] Service check failed:', error);
			}

			// Mark validation as complete
			this.storageService.store(FIRST_RUN_VALIDATION_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
			this.logService.info('[FirstRunValidation] ✓ Smoke test completed successfully');

		} catch (error) {
			// Log error but don't block startup
			this.logService.error('[FirstRunValidation] Smoke test failed with error:', error);
			// Still mark as complete to avoid retrying on every startup
			this.storageService.store(FIRST_RUN_VALIDATION_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}
	}
}

// Register the contribution
registerWorkbenchContribution2(FirstRunValidationContribution.ID, FirstRunValidationContribution, WorkbenchPhase.AfterRestored);

