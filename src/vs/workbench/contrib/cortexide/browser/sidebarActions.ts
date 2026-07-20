/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { Codicon } from '../../../../base/common/codicons.js';

import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';

import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';

import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IRange } from '../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { CORTEXIDE_VIEW_CONTAINER_ID, CORTEXIDE_VIEW_ID } from './sidebarPane.js';
import { IMetricsService } from '../common/metricsService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { CORTEXIDE_TOGGLE_SETTINGS_ACTION_ID } from './cortexideSettingsPane.js';
import { CORTEXIDE_ATTACH_FILE_TO_CHAT_ACTION_ID, CORTEXIDE_CTRL_L_ACTION_ID } from './actionIDs.js';
import { localize2 } from '../../../../nls.js';
import { IChatThreadService } from './chatThreadService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { ExplorerFolderContext } from '../../files/common/files.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { collectAttachableUris } from '../common/attachFileToChat.js';

// ---------- Register commands and keybindings ----------


export const roundRangeToLines = (range: IRange | null | undefined, options: { emptySelectionBehavior: 'null' | 'line' }) => {
	if (!range)
		return null

	// treat as no selection if selection is empty
	if (range.endColumn === range.startColumn && range.endLineNumber === range.startLineNumber) {
		if (options.emptySelectionBehavior === 'null')
			return null
		else if (options.emptySelectionBehavior === 'line')
			return { startLineNumber: range.startLineNumber, startColumn: 1, endLineNumber: range.startLineNumber, endColumn: 1 }
	}

	// IRange is 1-indexed
	const endLine = range.endColumn === 1 ? range.endLineNumber - 1 : range.endLineNumber // e.g. if the user triple clicks, it selects column=0, line=line -> column=0, line=line+1
	const newRange: IRange = {
		startLineNumber: range.startLineNumber,
		startColumn: 1,
		endLineNumber: endLine,
		endColumn: Number.MAX_SAFE_INTEGER
	}
	return newRange
}

// const getContentInRange = (model: ITextModel, range: IRange | null) => {
// 	if (!range)
// 		return null
// 	const content = model.getValueInRange(range)
// 	const trimmedContent = content
// 		.replace(/^\s*\n/g, '') // trim pure whitespace lines from start
// 		.replace(/\n\s*$/g, '') // trim pure whitespace lines from end
// 	return trimmedContent
// }



const CORTEXIDE_OPEN_SIDEBAR_ACTION_ID = 'cortexide.sidebar.open'
registerAction2(class extends Action2 {
	constructor() {
		super({ id: CORTEXIDE_OPEN_SIDEBAR_ACTION_ID, title: localize2('voidOpenSidebar', 'CortexIDE: Open Sidebar'), f1: true });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService)
		const chatThreadsService = accessor.get(IChatThreadService)
		viewsService.openViewContainer(CORTEXIDE_VIEW_CONTAINER_ID)
		await chatThreadsService.focusCurrentChat()
	}
})


// cmd L
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: CORTEXIDE_CTRL_L_ACTION_ID,
			f1: true,
			title: localize2('voidCmdL', 'CortexIDE: Add Selection to Chat'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyL,
				weight: KeybindingWeight.ExternalExtension
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		// Get services
		const commandService = accessor.get(ICommandService)
		const viewsService = accessor.get(IViewsService)
		const metricsService = accessor.get(IMetricsService)
		const editorService = accessor.get(ICodeEditorService)
		const chatThreadService = accessor.get(IChatThreadService)

		metricsService.capture('Ctrl+L', {})

		// capture selection and model before opening the chat panel
		const editor = editorService.getActiveCodeEditor()
		const model = editor?.getModel()

		// open panel - always open even if no editor
		const wasAlreadyOpen = viewsService.isViewContainerVisible(CORTEXIDE_VIEW_CONTAINER_ID)
		if (!wasAlreadyOpen) {
			await commandService.executeCommand(CORTEXIDE_OPEN_SIDEBAR_ACTION_ID)
		}

		// If there's a model, add selection to chat
		if (model) {
			const selectionRange = roundRangeToLines(editor?.getSelection(), { emptySelectionBehavior: 'null' })

			// add line selection
			if (selectionRange) {
				editor?.setSelection({
					startLineNumber: selectionRange.startLineNumber,
					endLineNumber: selectionRange.endLineNumber,
					startColumn: 1,
					endColumn: Number.MAX_SAFE_INTEGER
				})
				chatThreadService.addNewStagingSelection({
					type: 'CodeSelection',
					uri: model.uri,
					language: model.getLanguageId(),
					range: [selectionRange.startLineNumber, selectionRange.endLineNumber],
					state: { wasAddedAsCurrentFile: false },
				})
			}
			// add file
			else {
				chatThreadService.addNewStagingSelection({
					type: 'File',
					uri: model.uri,
					language: model.getLanguageId(),
					state: { wasAddedAsCurrentFile: false },
				})
			}
		}

		await chatThreadService.focusCurrentChat()
	}
})


// R7: start a background agent (runs on a hidden thread without blocking the active chat)
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'cortexide.runBackgroundAgent',
			f1: true,
			title: localize2('cortexideRunBackgroundAgent', 'CortexIDE: Start a Background Agent'),
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const chatThreadService = accessor.get(IChatThreadService)
		const quickInputService = accessor.get(IQuickInputService)
		const prompt = await quickInputService.input({
			title: 'Start a Background Agent',
			prompt: 'Describe the task. It runs on a hidden thread without blocking your chat; track it in the "Running agents" panel.',
			placeHolder: 'e.g. Add unit tests for src/utils/date.ts and run them',
		})
		const trimmed = (prompt ?? '').trim()
		if (!trimmed) { return }
		const description = trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed
		await chatThreadService.startBackgroundAgent(description, trimmed)
	}
})


// New chat keybind + menu button
const CORTEXIDE_CMD_SHIFT_L_ACTION_ID = 'cortexide.cmdShiftL'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: CORTEXIDE_CMD_SHIFT_L_ACTION_ID,
			title: 'New Chat',
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL,
				weight: KeybindingWeight.ExternalExtension,
			},
			icon: { id: 'add' },
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', when: ContextKeyExpr.equals('view', CORTEXIDE_VIEW_ID), }],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {

		const metricsService = accessor.get(IMetricsService)
		const chatThreadsService = accessor.get(IChatThreadService)
		const editorService = accessor.get(ICodeEditorService)
		metricsService.capture('Chat Navigation', { type: 'Start New Chat' })

		// get current selections and value to transfer
		const oldThreadId = chatThreadsService.state.currentThreadId
		const oldThread = chatThreadsService.state.allThreads[oldThreadId]

		const oldUI = await oldThread?.state.mountedInfo?.whenMounted

		const oldSelns = oldThread?.state.stagingSelections
		const oldVal = oldUI?.textAreaRef?.current?.value

		// open and focus new thread
		chatThreadsService.openNewThread()
		await chatThreadsService.focusCurrentChat()


		// set new thread values
		const newThreadId = chatThreadsService.state.currentThreadId
		const newThread = chatThreadsService.state.allThreads[newThreadId]

		const newUI = await newThread?.state.mountedInfo?.whenMounted
		chatThreadsService.setCurrentThreadState({ stagingSelections: oldSelns, })
		if (newUI?.textAreaRef?.current && oldVal) newUI.textAreaRef.current.value = oldVal


		// if has selection, add it
		const editor = editorService.getActiveCodeEditor()
		const model = editor?.getModel()
		if (!model) return
		const selectionRange = roundRangeToLines(editor?.getSelection(), { emptySelectionBehavior: 'null' })
		if (!selectionRange) return
		editor?.setSelection({ startLineNumber: selectionRange.startLineNumber, endLineNumber: selectionRange.endLineNumber, startColumn: 1, endColumn: Number.MAX_SAFE_INTEGER })
		chatThreadsService.addNewStagingSelection({
			type: 'CodeSelection',
			uri: model.uri,
			language: model.getLanguageId(),
			range: [selectionRange.startLineNumber, selectionRange.endLineNumber],
			state: { wasAddedAsCurrentFile: false },
		})
	}
})

// History menu button
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.historyAction',
			title: 'View Past Chats',
			icon: { id: 'history' },
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', when: ContextKeyExpr.equals('view', CORTEXIDE_VIEW_ID), }]
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {

		// do not do anything if there are no messages (without this it clears all of the user's selections if the button is pressed)
		// TODO the history button should be disabled in this case so we can remove this logic
		const thread = accessor.get(IChatThreadService).getCurrentThread()
		if (thread.messages.length === 0) {
			return;
		}

		const metricsService = accessor.get(IMetricsService)

		const commandService = accessor.get(ICommandService)

		metricsService.capture('Chat Navigation', { type: 'History' })
		commandService.executeCommand(CORTEXIDE_CMD_SHIFT_L_ACTION_ID)

	}
})


// Settings gear
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.settingsAction',
			title: `CortexIDE Settings`,
			icon: { id: 'settings-gear' },
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', when: ContextKeyExpr.equals('view', CORTEXIDE_VIEW_ID), }]
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService)
		commandService.executeCommand(CORTEXIDE_TOGGLE_SETTINGS_ACTION_ID)
	}
})

// Web Search command
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.webSearch',
			title: localize2('voidWebSearch', 'CortexIDE: Search the Web'),
			category: localize2('voidCategory', 'CortexIDE'),
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const chatThreadsService = accessor.get(IChatThreadService)
		const viewsService = accessor.get(IViewsService)
		const quickInputService = accessor.get(IQuickInputService)

		// Open chat sidebar
		viewsService.openViewContainer(CORTEXIDE_VIEW_CONTAINER_ID)
		await chatThreadsService.focusCurrentChat()

		// Prompt for search query
		const query = await quickInputService.input({
			placeHolder: localize2('voidWebSearchPlaceholder', 'Enter your search query...').value,
			prompt: localize2('voidWebSearchPrompt', 'Search the web for information').value,
		}).then((result: string | undefined) => result);

		if (!query) return;

		const threadId = chatThreadsService.state.currentThreadId
		await chatThreadsService.addUserMessageAndStreamResponse({
			userMessage: `Search the web for: ${query}`,
			threadId,
		})
	}
})

// Browse URL command
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.browseUrl',
			title: localize2('voidBrowseUrl', 'CortexIDE: Open URL in Reader'),
			category: localize2('voidCategory', 'CortexIDE'),
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const chatThreadsService = accessor.get(IChatThreadService)
		const viewsService = accessor.get(IViewsService)
		const quickInputService = accessor.get(IQuickInputService)

		// Open chat sidebar
		viewsService.openViewContainer(CORTEXIDE_VIEW_CONTAINER_ID)
		await chatThreadsService.focusCurrentChat()

		// Prompt for URL
		const url = await quickInputService.input({
			placeHolder: localize2('voidBrowseUrlPlaceholder', 'Enter URL (https://...)').value,
			prompt: localize2('voidBrowseUrlPrompt', 'Fetch and extract content from URL').value,
		}).then((result: string | undefined) => result);

		if (!url) return;

		const threadId = chatThreadsService.state.currentThreadId
		await chatThreadsService.addUserMessageAndStreamResponse({
			userMessage: `Browse URL: ${url}`,
			threadId,
		})
	}
})

const getAttachableUrisFromArgs = (accessor: ServicesAccessor, ...args: unknown[]): URI[] => {
	const editorService = accessor.get(IEditorService)
	const activeUri = EditorResourceAccessor.getCanonicalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY })
	return collectAttachableUris(args, activeUri)
}

// Explorer / editor context menu: attach a file to the CortexIDE chat input (issue #54).
// Upstream "Add File to Chat" targets the hidden built-in VS Code chat; this wires the same menus
// to CortexIDE's staging selections instead.
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: CORTEXIDE_ATTACH_FILE_TO_CHAT_ACTION_ID,
			title: localize2('cortexideAttachFileToChat', 'Add File to Chat'),
			icon: Codicon.attach,
			f1: true,
			menu: [{
				id: MenuId.ExplorerContext,
				group: '5_chat',
				order: 1,
				when: ContextKeyExpr.and(
					ExplorerFolderContext.negate(),
					ContextKeyExpr.or(
						ResourceContextKey.Scheme.isEqualTo(Schemas.file),
						ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote),
					),
				),
			}, {
				id: MenuId.EditorTitleContext,
				group: '2_chat',
				order: 1,
				when: ContextKeyExpr.or(
					ResourceContextKey.Scheme.isEqualTo(Schemas.file),
					ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote),
				),
			}, {
				id: MenuId.EditorContext,
				group: '1_chat',
				order: 2,
				when: ContextKeyExpr.and(
					EditorContextKeys.hasNonEmptySelection.negate(),
					ContextKeyExpr.or(
						ResourceContextKey.Scheme.isEqualTo(Schemas.file),
						ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote),
						ResourceContextKey.Scheme.isEqualTo(Schemas.untitled),
						ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeUserData),
					),
				),
			}],
		})
	}
	async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {
		const commandService = accessor.get(ICommandService)
		const viewsService = accessor.get(IViewsService)
		const chatThreadService = accessor.get(IChatThreadService)
		const languageService = accessor.get(ILanguageService)
		const metricsService = accessor.get(IMetricsService)

		const files = getAttachableUrisFromArgs(accessor, ...args)
		if (!files.length) {
			return
		}

		metricsService.capture('Attach File to Chat', { count: files.length })

		if (!viewsService.isViewContainerVisible(CORTEXIDE_VIEW_CONTAINER_ID)) {
			await commandService.executeCommand(CORTEXIDE_OPEN_SIDEBAR_ACTION_ID)
		}

		for (const uri of files) {
			chatThreadService.addNewStagingSelection({
				type: 'File',
				uri,
				language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) ?? 'plaintext',
				state: { wasAddedAsCurrentFile: false },
			})
		}

		await chatThreadService.focusCurrentChat()
	}
})




// export class TabSwitchListener extends Disposable {

// 	constructor(
// 		onSwitchTab: () => void,
// 		@ICodeEditorService private readonly _editorService: ICodeEditorService,
// 	) {
// 		super()

// 		// when editor switches tabs (models)
// 		const addTabSwitchListeners = (editor: ICodeEditor) => {
// 			this._register(editor.onDidChangeModel(e => {
// 				if (e.newModelUrl?.scheme !== 'file') return
// 				onSwitchTab()
// 			}))
// 		}

// 		const initializeEditor = (editor: ICodeEditor) => {
// 			addTabSwitchListeners(editor)
// 		}

// 		// initialize current editors + any new editors
// 		for (let editor of this._editorService.listCodeEditors()) initializeEditor(editor)
// 		this._register(this._editorService.onCodeEditorAdd(editor => { initializeEditor(editor) }))
// 	}
// }
