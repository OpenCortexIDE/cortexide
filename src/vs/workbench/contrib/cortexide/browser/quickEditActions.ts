/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IEditCodeService } from './editCodeServiceInterface.js';
import { roundRangeToLines } from './sidebarActions.js';
import { CORTEXIDE_CTRL_K_ACTION_ID } from './actionIDs.js';
import { localize2 } from '../../../../nls.js';
import { IMetricsService } from '../common/metricsService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { EndOfLinePreference } from '../../../../editor/common/model.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { joinPath } from '../../../../base/common/resources.js';

export type QuickEditPropsType = {
	diffareaid: number;
	textAreaRef: (ref: HTMLTextAreaElement | null) => void;
	onChangeHeight: (height: number) => void;
	onChangeText: (text: string) => void;
	initText: string | null;
};

export type QuickEdit = {
	startLine: number; // 0-indexed
	beforeCode: string;
	afterCode?: string;
	instructions?: string;
	responseText?: string; // model can produce a text response too
};


registerAction2(class extends Action2 {
	constructor(
	) {
		super({
			id: CORTEXIDE_CTRL_K_ACTION_ID,
			f1: true,
			title: localize2('voidQuickEditAction', 'Void: Quick Edit'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyK,
				weight: KeybindingWeight.ExternalExtension,
				when: ContextKeyExpr.deserialize('editorFocus && !terminalFocus'),
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {

		const editorService = accessor.get(ICodeEditorService);
		const metricsService = accessor.get(IMetricsService);
		metricsService.capture('Ctrl+K', {});

		const editor = editorService.getActiveCodeEditor();
		if (!editor) {
			// If no editor, show a notification that user needs to open a file first
			const notificationService = accessor.get(INotificationService);
			notificationService.info('Please open a file first to use Quick Edit.');
			return;
		}
		const model = editor.getModel();
		if (!model) { return; }
		const selection = roundRangeToLines(editor.getSelection(), { emptySelectionBehavior: 'line' });
		if (!selection) { return; }


		const { startLineNumber: startLine, endLineNumber: endLine } = selection;

		const editCodeService = accessor.get(IEditCodeService);
		editCodeService.addCtrlKZone({ startLine, endLine, editor });
	}
});

// Inline Edit (AI) command
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.inlineEdit',
			f1: true,
			title: localize2('voidInlineEditAction', 'CortexIDE: Inline Edit (AI)'),
			category: localize2('voidCategory', 'CortexIDE'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE,
				weight: KeybindingWeight.ExternalExtension,
				when: ContextKeyExpr.deserialize('editorFocus && !terminalFocus'),
			},
			menu: {
				id: MenuId.EditorContext,
				group: '1_modification',
				order: 1.5,
				when: ContextKeyExpr.deserialize('editorTextFocus && !terminalFocus'),
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(ICodeEditorService);
		const metricsService = accessor.get(IMetricsService);
		const quickInputService = accessor.get(IQuickInputService);
		const llmMessageService = accessor.get(ILLMMessageService);
		const settingsService = accessor.get(ICortexideSettingsService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);
		const progressService = accessor.get(IProgressService);
		const notificationService = accessor.get(INotificationService);
		const editCodeService = accessor.get(IEditCodeService);
		const fileService = accessor.get(IFileService);

		metricsService.capture('Inline Edit', {});

		const editor = editorService.getActiveCodeEditor();
		if (!editor) {
			notificationService.warn('Please open an editor to use Inline Edit.');
			return;
		}

		const model = editor.getModel();
		if (!model) {
			notificationService.warn('No file is open.');
			return;
		}

		// Check workspace boundary
		if (!workspaceContextService.isInsideWorkspace(model.uri)) {
			notificationService.warn('Inline Edit only works on files within the workspace.');
			return;
		}

		// Get selection or current line
		const selection = roundRangeToLines(editor.getSelection(), { emptySelectionBehavior: 'line' });
		if (!selection) {
			notificationService.warn('Please select code or position cursor on a line.');
			return;
		}

		const { startLineNumber, endLineNumber } = selection;
		const selectedCode = model.getValueInRange(selection, EndOfLinePreference.LF);

		// Collect context (nearby lines)
		const contextLines = 5;
		const contextStart = Math.max(1, startLineNumber - contextLines);
		const contextEnd = Math.min(model.getLineCount(), endLineNumber + contextLines);
		const contextCode = model.getValueInRange(
			{ startLineNumber: contextStart, startColumn: 1, endLineNumber: contextEnd, endColumn: Number.MAX_SAFE_INTEGER },
			EndOfLinePreference.LF
		);

		// Prompt for edit instruction
		const instruction = await quickInputService.input({
			placeHolder: localize2('voidInlineEditPlaceholder', 'Describe what you want to change (e.g., "add error handling", "refactor to use async/await")...').value,
			prompt: localize2('voidInlineEditPrompt', 'Edit instruction').value,
		}).then((result: string | undefined) => result);

		if (!instruction) { return; }

		// Check for model selection
		const modelSelection = settingsService.state.modelSelectionOfFeature['Chat'];
		if (!modelSelection) {
			notificationService.warn('Please select a model in CortexIDE Settings to use Inline Edit.');
			return;
		}

		// Generate edit using LLM
		let generatedEdit: string | null = null;
		let requestId: string | null = null;
		let isComplete = false;
		let errorMessage: string | null = null;
		const cancellationToken = new CancellationTokenSource();

		// Read project Rules files if they exist
		let projectRules = '';
		try {
			const workspaceFolder = workspaceContextService.getWorkspaceFolder(model.uri);
			if (workspaceFolder) {
				const rulesFiles = ['.cursorrules', '.voidrules', '.rules'];
				for (const rulesFile of rulesFiles) {
					const rulesUri = joinPath(workspaceFolder.uri, rulesFile);
					try {
						const content = await fileService.readFile(rulesUri);
						if (content && content.value) {
							const rulesText = content.value.toString().trim();
							if (rulesText) {
								projectRules = `\n\nProject Rules (from ${rulesFile}):\n${rulesText}\n`;
								break; // Use first found rules file
							}
						}
					} catch {
						// File doesn't exist or can't be read, continue to next
					}
				}
			}
		} catch {
			// Ignore errors reading rules files
		}

		await progressService.withProgress(
			{
				location: ProgressLocation.Notification,
				title: localize2('voidInlineEditProgress', 'Generating edit...').value,
				cancellable: true,
			},
			async (progress) => {
				// Build prompt for minimal patch
				const systemMessage = `You are a code assistant. Generate a minimal SEARCH/REPLACE block to implement the requested change.

Rules:
1. Return ONLY the SEARCH/REPLACE block(s) - no explanations or code blocks
2. The ORIGINAL code must EXACTLY match the selected code
3. Keep changes minimal - only modify what's necessary
4. Format: ${'<<<<<<< ORIGINAL'}\n<original code>\n${'======='}\n<new code>\n${'>>>>>>> UPDATED'}${projectRules}

Selected code (lines ${startLineNumber}-${endLineNumber}):
\`\`\`
${selectedCode}
\`\`\`

Context (nearby lines):
\`\`\`
${contextCode}
\`\`\``;

				const userMessage = `Edit instruction: ${instruction}\n\nGenerate a SEARCH/REPLACE block for the selected code.`;

				const chatOptions = settingsService.state.optionsOfModelSelection['Chat'];
				// Skip "auto" - it's not a real provider
				const modelOptions = modelSelection && !(modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')
					? chatOptions[modelSelection.providerName]?.[modelSelection.modelName]
					: undefined;
				const overrides = settingsService.state.overridesOfModel;

				requestId = llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					chatMode: 'normal',
					messages: [
						{ role: 'system', content: systemMessage },
						{ role: 'user', content: userMessage },
					],
					modelSelection,
					modelSelectionOptions: modelOptions,
					overridesOfModel: overrides,
					separateSystemMessage: systemMessage,
					logging: { loggingName: 'Inline Edit', loggingExtras: {} },
					onText: ({ fullText }) => {
						generatedEdit = fullText;
						progress.report({ message: 'Generating...' });
					},
					onFinalMessage: ({ fullText }) => {
						generatedEdit = fullText;
						isComplete = true;
					},
					onError: ({ message }) => {
						errorMessage = message;
						isComplete = true;
					},
					onAbort: () => {
						isComplete = true;
					},
				});

				if (!requestId) {
					throw new Error('Failed to start LLM request');
				}

				// Wait for completion with cancellation support
				await new Promise<void>((resolve) => {
					let resolved = false;
					const doResolve = () => {
						if (resolved) { return; }
						resolved = true;
						resolve();
					};

					const timeout = setTimeout(() => {
						if (requestId && !isComplete) {
							llmMessageService.abort(requestId);
							errorMessage = 'Timeout after 30 seconds';
							isComplete = true;
						}
						clearInterval(checkInterval);
						doResolve();
					}, 30000); // 30s timeout

					const checkInterval = setInterval(() => {
						if (cancellationToken.token.isCancellationRequested) {
							clearInterval(checkInterval);
							clearTimeout(timeout);
							if (requestId && !isComplete) {
								llmMessageService.abort(requestId);
							}
							isComplete = true;
							doResolve();
							return;
						}
						if (isComplete) {
							clearInterval(checkInterval);
							clearTimeout(timeout);
							doResolve();
						}
					}, 100);
				});
			},
			() => {
				// onDidCancel callback
				cancellationToken.cancel();
			}
		);

		if (errorMessage) {
			notificationService.error(`Inline Edit failed: ${errorMessage}`);
			return;
		}

		if (!generatedEdit || typeof generatedEdit !== 'string') {
			notificationService.warn('No edit was generated. Please try again.');
			return;
		}

		// Extract search/replace blocks from response
		// TypeScript now knows generatedEdit is string after the check above
		const searchReplaceBlocks = (generatedEdit as string)
			.replace(/```[\w]*\n?/g, '')
			.replace(/```/g, '')
			.trim();

		if (!searchReplaceBlocks.includes('<<<<<<< ORIGINAL') || !searchReplaceBlocks.includes('>>>>>>> UPDATED')) {
			notificationService.warn('The model did not generate a valid SEARCH/REPLACE block. Please try again or use Ctrl+K Quick Edit.');
			return;
		}

		// Apply the edit using existing EditCodeService
		// This will show the diff preview automatically
		try {
			await editCodeService.callBeforeApplyOrEdit(model.uri);
			editCodeService.instantlyApplySearchReplaceBlocks({
				uri: model.uri,
				searchReplaceBlocks,
			});
			notificationService.info('Edit generated. Review the diff and apply or reject changes.');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			notificationService.error(`Failed to apply edit: ${errorMessage}`);
			return;
		}
	}
});
