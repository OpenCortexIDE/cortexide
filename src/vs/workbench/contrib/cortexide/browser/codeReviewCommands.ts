/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { ICodeReviewService, CodeReviewAnnotation } from '../common/codeReviewService.js';
import { CodeReviewEditorContribution } from './codeReviewEditorContribution.js';
import { IProgressService, ProgressLocation, IProgress, IProgressStep } from '../../../../platform/progress/common/progress.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize2 } from '../../../../nls.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { IChatService } from '../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { IChatEditingService } from '../../../../workbench/contrib/chat/common/editing/chatEditingService.js';
import { ChatAgentLocation } from '../../../../workbench/contrib/chat/common/constants.js';
import { ChatModel } from '../../../../workbench/contrib/chat/common/model/chatModel.js';
import { IViewsService } from '../../../../workbench/services/views/common/viewsService.js';
import { ComposerPanel } from '../../../../workbench/contrib/chat/browser/chatEditing/composerPanel.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Command to review the current file
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.codeReview.reviewFile',
			f1: true,
			title: localize2('voidCodeReviewFile', 'CortexIDE: Review This File'),
			category: localize2('voidCategory', 'CortexIDE'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
				weight: KeybindingWeight.ExternalExtension,
				when: ContextKeyExpr.deserialize('editorFocus && !terminalFocus'),
			},
			menu: {
				id: MenuId.EditorContext,
				group: '1_modification',
				order: 2,
				when: ContextKeyExpr.deserialize('editorTextFocus && !terminalFocus'),
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(ICodeEditorService);
		const codeReviewService = accessor.get(ICodeReviewService);
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
				title: `Reviewing ${fileName}...`,
				cancellable: true,
			},
			async (progress: IProgress<IProgressStep>) => {
				try {
					progress.report({ message: 'Analyzing code...' });

					// Perform review
					const result = await codeReviewService.reviewFile(uri, cancellationTokenSource.token);

					if (cancellationTokenSource.token.isCancellationRequested) {
						return;
					}

					if (!result.success) {
						notificationService.error(`Code review failed: ${result.error || 'Unknown error'}`);
						return;
					}

					// Get the editor contribution and set annotations
					const contribution = CodeReviewEditorContribution.get(editor);
					if (contribution) {
						contribution.setAnnotations(uri, result.annotations);
						progress.report({ message: `Found ${result.annotations.length} issue(s)` });
					}

					// Show notification with summary
					if (result.annotations.length === 0) {
						// allow-any-unicode-next-line
						notificationService.info(`✅ ${fileName}: No issues found!`);
					} else {
						// allow-any-unicode-next-line
						notificationService.info(`📋 ${fileName}: ${result.summary}`);
					}
				} catch (error) {
					notificationService.error(`Code review error: ${error instanceof Error ? error.message : String(error)}`);
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
 * Command to apply a suggested fix from a code review annotation
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.codeReview.applyFix',
			f1: false, // Not in command palette, called programmatically
			title: localize2('voidCodeReviewApplyFix', 'CortexIDE: Apply Fix'),
		});
	}

	async run(accessor: ServicesAccessor, annotation: CodeReviewAnnotation, uri: URI): Promise<void> {
		if (!annotation.suggestedFix) {
			return;
		}

		const chatService = accessor.get(IChatService);
		const chatEditingService = accessor.get(IChatEditingService) as IChatEditingService;
		const viewsService = accessor.get(IViewsService);
		const notificationService = accessor.get(INotificationService);

		try {
			// Create a chat session for the editing session
			const chatModelRef = chatService.startNewLocalSession(ChatAgentLocation.Chat, { debugOwner: 'codeReviewCommands' });
			const chatModel = chatModelRef.object as ChatModel;

			// Create editing session
			const editingSession = chatEditingService.createEditingSession(chatModel);

			// Open ComposerPanel to show the diff
			const composerPanel = await viewsService.openView(ComposerPanel.ID) as ComposerPanel | undefined;
			if (composerPanel) {
				// Set the file in scope and create a request to apply the fix
				composerPanel.setScope([uri]);
				composerPanel.setGoal(`Apply fix for: ${annotation.message}\n\nSuggested fix:\n\`\`\`\n${annotation.suggestedFix}\n\`\`\``);

				// Show the panel
				await editingSession.show();
			}

			// Note: The user can then generate proposals and apply them
		} catch (error) {
			notificationService.error(`Failed to apply fix: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
});

