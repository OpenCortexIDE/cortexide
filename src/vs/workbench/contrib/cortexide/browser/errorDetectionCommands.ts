/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IErrorDetectionService } from '../common/errorDetectionService.js';
import { IProgressService, IProgress, IProgressStep, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { URI } from '../../../../base/common/uri.js';
import { DetectedError } from '../common/errorDetectionService.js';
import { ErrorDetectionEditorContribution } from './errorDetectionEditorContribution.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { IChatService } from '../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { IChatEditingService } from '../../../../workbench/contrib/chat/common/editing/chatEditingService.js';
import { ChatAgentLocation } from '../../../../workbench/contrib/chat/common/constants.js';
import { ChatModel } from '../../../../workbench/contrib/chat/common/model/chatModel.js';
import { IViewsService } from '../../../../workbench/services/views/common/viewsService.js';
import { ComposerPanel } from '../../../../workbench/contrib/chat/browser/chatEditing/composerPanel.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';

/**
 * Command to detect errors in the active editor
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.errorDetection.detectErrors',
			title: localize2('voidErrorDetectionDetectErrors', 'CortexIDE: Detect Errors'),
			f1: true,
			keybinding: {
				weight: 100,
				primary: 0,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(ICodeEditorService);
		const errorDetectionService = accessor.get(IErrorDetectionService);
		const progressService = accessor.get(IProgressService);
		const notificationService = accessor.get(INotificationService);

		const editor = editorService.getFocusedCodeEditor();
		if (!editor || !editor.hasModel()) {
			notificationService.warn('No editor is focused');
			return;
		}

		const uri = editor.getModel().uri;
		const fileName = uri.fsPath.split('/').pop() || 'file';

		// Create cancellation token source
		const cancellationTokenSource = new CancellationTokenSource();

		// Show progress
		await progressService.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Detecting errors in ${fileName}...`,
				cancellable: true,
			},
			async (progress: IProgress<IProgressStep>) => {
				try {
					progress.report({ message: 'Scanning for errors...' });

					// Detect errors
					const errors = await errorDetectionService.detectErrorsInFile(uri, cancellationTokenSource.token);

					if (cancellationTokenSource.token.isCancellationRequested) {
						return;
					}

					// Get the editor contribution and set errors
					const contribution = ErrorDetectionEditorContribution.get(editor);
					if (contribution) {
						contribution.setErrors(uri, errors);
						progress.report({ message: `Found ${errors.length} error(s)` });
					}

					// Show notification with summary
					if (errors.length === 0) {
						// allow-any-unicode-next-line
						notificationService.info(`✅ ${fileName}: No errors found!`);
					} else {
						const errorCount = errors.filter(e => e.severity === 'error').length;
						const warningCount = errors.filter(e => e.severity === 'warning').length;
						// allow-any-unicode-next-line
						notificationService.info(`📋 ${fileName}: ${errorCount} error(s), ${warningCount} warning(s)`);
					}
				} catch (error) {
					notificationService.error(`Error detection failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			},
			() => {
				// onDidCancel callback
				cancellationTokenSource.cancel();
			}
		);
	}
});

/**
 * Command to apply a fix for an error
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.errorDetection.applyFix',
			f1: false, // Not in command palette, called programmatically
			title: localize2('voidErrorDetectionApplyFix', 'CortexIDE: Apply Fix'),
		});
	}

	async run(accessor: ServicesAccessor, error: DetectedError, uri: URI): Promise<void> {
		const errorDetectionService = accessor.get(IErrorDetectionService);
		const chatService = accessor.get(IChatService);
		const chatEditingService = accessor.get(IChatEditingService) as IChatEditingService;
		const viewsService = accessor.get(IViewsService);
		const notificationService = accessor.get(INotificationService);

		try {
			// Get fixes for the error
			const fixes = await errorDetectionService.getFixesForError(error, CancellationToken.None);

			if (fixes.length === 0) {
				notificationService.info('No fixes available for this error');
				return;
			}

			// Use the first fix (preferred fix)
			const fix = fixes[0];

			// Create a chat session for the editing session
			const chatModelRef = chatService.startNewLocalSession(ChatAgentLocation.Chat, { debugOwner: 'errorDetectionCommands' });
			const chatModel = chatModelRef.object as ChatModel;

			// Create editing session
			const editingSession = chatEditingService.createEditingSession(chatModel);

			// Open ComposerPanel to show the diff
			const composerPanel = await viewsService.openView(ComposerPanel.ID) as ComposerPanel | undefined;
			if (composerPanel) {
				// Set the file in scope and create a request to apply the fix
				composerPanel.setScope([uri]);

				// Format goal with error details and fix description
				const goalParts = [
					`Apply fix for error: ${error.message}`,
					error.code ? `Error code: ${error.code}` : '',
					error.source ? `Source: ${error.source}` : '',
					'',
					`Fix: ${fix.description}`,
				].filter(Boolean);

				composerPanel.setGoal(goalParts.join('\n'));

				// Show the panel
				await editingSession.show();
			}

			// Note: The user can then generate proposals and apply them through the Composer Panel
		} catch (error) {
			notificationService.error(`Failed to apply fix: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
});

