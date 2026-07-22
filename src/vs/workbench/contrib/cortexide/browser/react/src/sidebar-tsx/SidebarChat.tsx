/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { FormEvent, FormHTMLAttributes, Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';


import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState, useActiveURI, useCommandBarState, useFullChatThreadsStreamState } from '../util/services.js';

import { ChatMarkdownRender, ChatMessageLocation, getApplyBoxId } from '../markdown/ChatMarkdownRender.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { IDisposable } from '../../../../../../../base/common/lifecycle.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import { BlockCode, TextAreaFns, VoidInputBox2, VoidDiffEditor } from '../util/inputs.js';
import { PastThreadsList } from './SidebarThreadSelector.js';
import { VoidChatArea, ButtonSubmit, ButtonStop } from './composer/VoidChatArea.js';
import { SelectedFiles } from './composer/SelectedFiles.js';
import { ScrollToBottomContainer } from './composer/ScrollToBottomContainer.js';
import { LandingPage } from './landing/LandingPage.js';
import { ComposerTabs } from './chrome/ComposerTabs.js';
import { ThreadHeader } from './chrome/ThreadHeader.js';
import { CORTEXIDE_CTRL_L_ACTION_ID } from '../../../actionIDs.js';
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from '../../../cortexideSettingsPane.js';
import { displayInfoOfProviderName, FeatureName, isFeatureNameDisabled, isValidProviderModelSelection } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { WarningBox } from '../settings/WarningBox.js';
import { getModelCapabilities, getIsReasoningEnabledState, getReservedOutputTokenSpace } from '../../../../common/modelCapabilities.js';
import { AlertTriangle, File, Ban, Check, ChevronRight, Dot, FileIcon, Pencil, Undo, Undo2, X, Flag, Copy as CopyIcon, Info, CirclePlus, Ellipsis, CircleEllipsis, Folder, ALargeSmall, TypeOutline, Text } from 'lucide-react';
import { ChatMessage, CheckpointEntry, StagingSelectionItem, ToolMessage, PlanMessage, ReviewMessage, PlanStep, StepStatus, PlanApprovalState } from '../../../../common/chatThreadServiceTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, ToolName, LintErrorItem, ToolApprovalType, toolApprovalTypes } from '../../../../common/toolsServiceTypes.js';
import { CopyButton, EditToolAcceptRejectButtonsHTML, IconShell1, JumpToFileButton, JumpToTerminalButton, StatusIndicator, StatusIndicatorForApplyButton, useApplyStreamState, useEditToolStreamState } from '../markdown/ApplyBlockHoverButtons.js';
import { IsRunningType } from '../../../chatThreadService.js';
import { acceptAllBg, acceptBorder, buttonFontSize, buttonTextColor, rejectAllBg, rejectBg, rejectBorder } from '../../../../common/helpers/colors.js';
import { builtinToolNames, isABuiltinToolName, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_INACTIVE_TIME } from '../../../../common/prompt/prompts.js';
import { RawToolCallObj } from '../../../../common/sendLLMMessageTypes.js';
import ErrorBoundary from './ErrorBoundary.js';
import { ToolApprovalTypeSwitch } from '../settings/Settings.js';

import { persistentTerminalNameOfId } from '../../../terminalToolService.js';
import { removeMCPToolNamePrefix } from '../../../../common/mcpServiceTypes.js';
import { useImageAttachments } from '../util/useImageAttachments.js';
import { usePDFAttachments } from '../util/usePDFAttachments.js';
import { useTranslation } from '../util/useTranslation.js';
import { PDFAttachmentList } from '../util/PDFAttachmentList.js';
import { ImageAttachmentList } from '../util/ImageAttachmentList.js';
import { ChatImageAttachment, ChatPDFAttachment } from '../../../../common/chatThreadServiceTypes.js';
import { ImageMessageRenderer } from '../util/ImageMessageRenderer.js';
import { PDFMessageRenderer } from '../util/PDFMessageRenderer.js';
import { IconX, IconWarning, IconLoading, TypingCursor } from './shared/icons.js';
import { getBasename, getFolderName, getRelative, voidOpenFileFn } from './shared/pathUtils.js';
import { ToolChildrenWrapper, CodeChildren, ListableToolItem } from './tools/ToolPrimitives.js';
import { ChatBubble } from './chat/ChatBubble.js';
import { EditToolSoFar } from './tools/ToolRenderers.js';

// Re-export shared modules for existing consumers (will migrate imports over time).
export { IconX, IconWarning, IconLoading, TypingCursor } from './shared/icons.js';
export { getBasename, getFolderName, getRelative, voidOpenFileFn } from './shared/pathUtils.js';
export { ToolChildrenWrapper, CodeChildren, ListableToolItem } from './tools/ToolPrimitives.js';
export { VoidChatArea, ButtonSubmit, ButtonStop } from './composer/VoidChatArea.js';
export { SelectedFiles } from './composer/SelectedFiles.js';
export { ChatBubble } from './chat/ChatBubble.js';





const CommandBarInChat = () => {
	const { stateOfURI: commandBarStateOfURI, sortedURIs: sortedCommandBarURIs } = useCommandBarState()
	const numFilesChanged = sortedCommandBarURIs.length

	const accessor = useAccessor()
	const editCodeService = accessor.get('IEditCodeService')
	const commandService = accessor.get('ICommandService')
	const chatThreadsState = useChatThreadsState()
	const commandBarState = useCommandBarState()
	const chatThreadsStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId)

	// (
	// 	<IconShell1
	// 		Icon={CopyIcon}
	// 		onClick={copyChatToClipboard}
	// 		data-tooltip-id='cortex-tooltip'
	// 		data-tooltip-place='top'
	// 		data-tooltip-content='Copy chat JSON'
	// 	/>
	// )

	const [fileDetailsOpenedState, setFileDetailsOpenedState] = useState<'auto-opened' | 'auto-closed' | 'user-opened' | 'user-closed'>('auto-closed');
	const isFileDetailsOpened = fileDetailsOpenedState === 'auto-opened' || fileDetailsOpenedState === 'user-opened';


	useEffect(() => {
		// close the file details if there are no files
		// this converts 'user-closed' to 'auto-closed'
		if (numFilesChanged === 0) {
			setFileDetailsOpenedState('auto-closed')
		}
		// open the file details if it hasnt been closed
		if (numFilesChanged > 0 && fileDetailsOpenedState !== 'user-closed') {
			setFileDetailsOpenedState('auto-opened')
		}
	}, [fileDetailsOpenedState, setFileDetailsOpenedState, numFilesChanged])


	const isFinishedMakingThreadChanges = (
		// there are changed files
		commandBarState.sortedURIs.length !== 0
		// none of the files are streaming
		&& commandBarState.sortedURIs.every(uri => !commandBarState.stateOfURI[uri.fsPath]?.isStreaming)
	)

	// ======== status of agent ========
	// This icon answers the question "is the LLM doing work on this thread?"
	// assume it is single threaded for now
	// green = Running
	// orange = Requires action
	// dark = Done

    const threadStatus = (
        chatThreadsStreamState?.isRunning === 'awaiting_user'
            ? { title: 'Needs Approval', color: 'yellow', } as const
            : (chatThreadsStreamState?.isRunning === 'LLM' || chatThreadsStreamState?.isRunning === 'tool' || chatThreadsStreamState?.isRunning === 'preparing')
                ? { title: chatThreadsStreamState?.isRunning === 'preparing' ? 'Preparing' : 'Running', color: 'orange', } as const
                : { title: 'Done', color: 'dark', } as const
    )


	const threadStatusHTML = <StatusIndicator className='mx-1' indicatorColor={threadStatus.color} title={threadStatus.title} />


	// ======== info about changes ========
	// num files changed
	// acceptall + rejectall
	// popup info about each change (each with num changes + acceptall + rejectall of their own)

	const numFilesChangedStr = numFilesChanged === 0 ? 'No files with changes'
		: `${sortedCommandBarURIs.length} file${numFilesChanged === 1 ? '' : 's'} with changes`




	const acceptRejectAllButtons = <div
		// do this with opacity so that the height remains the same at all times
		className={`flex items-center gap-0.5
			${isFinishedMakingThreadChanges ? '' : 'opacity-0 pointer-events-none'}`
		}
	>
		<IconShell1 // RejectAllButtonWrapper
			// text="Reject All"
			// className="text-xs"
			Icon={X}
			onClick={() => {
				sortedCommandBarURIs.forEach(uri => {
					editCodeService.acceptOrRejectAllDiffAreas({
						uri,
						removeCtrlKs: true,
						behavior: "reject",
						_addToHistory: true,
					});
				});
			}}
			data-tooltip-id='cortex-tooltip'
			data-tooltip-place='top'
			data-tooltip-content='Reject all'
		/>

		<IconShell1 // AcceptAllButtonWrapper
			// text="Accept All"
			// className="text-xs"
			Icon={Check}
			onClick={() => {
				sortedCommandBarURIs.forEach(uri => {
					editCodeService.acceptOrRejectAllDiffAreas({
						uri,
						removeCtrlKs: true,
						behavior: "accept",
						_addToHistory: true,
					});
				});
			}}
			data-tooltip-id='cortex-tooltip'
			data-tooltip-place='top'
			data-tooltip-content='Accept all'
		/>



	</div>


	// !select-text cursor-auto
	const fileDetailsContent = <div className="px-2 gap-1 w-full overflow-y-auto">
		{sortedCommandBarURIs.map((uri, i) => {
			const basename = getBasename(uri.fsPath)

			const { sortedDiffIds, isStreaming } = commandBarStateOfURI[uri.fsPath] ?? {}
			const isFinishedMakingFileChanges = !isStreaming

			const numDiffs = sortedDiffIds?.length || 0

			const fileStatus = (isFinishedMakingFileChanges
				? { title: 'Done', color: 'dark', } as const
				: { title: 'Running', color: 'orange', } as const
			)

			const fileNameHTML = <div
				className="flex items-center gap-1.5 text-void-fg-3 hover:brightness-125 transition-all duration-200 cursor-pointer"
				onClick={() => voidOpenFileFn(uri, accessor)}
			>
				{/* <FileIcon size={14} className="text-void-fg-3" /> */}
				<span className="text-void-fg-3">{basename}</span>
			</div>




			const detailsContent = <div className='flex px-4'>
				<span className="text-void-fg-3 opacity-80">{numDiffs} diff{numDiffs !== 1 ? 's' : ''}</span>
			</div>

			const acceptRejectButtons = <div
				// do this with opacity so that the height remains the same at all times
				className={`flex items-center gap-0.5
					${isFinishedMakingFileChanges ? '' : 'opacity-0 pointer-events-none'}
				`}
			>
				{/* <JumpToFileButton
					uri={uri}
					data-tooltip-id='cortex-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Go to file'
				/> */}
				<IconShell1 // RejectAllButtonWrapper
					Icon={X}
					onClick={() => { editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "reject", _addToHistory: true, }); }}
					data-tooltip-id='cortex-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Reject file'

				/>
				<IconShell1 // AcceptAllButtonWrapper
					Icon={Check}
					onClick={() => { editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "accept", _addToHistory: true, }); }}
					data-tooltip-id='cortex-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Accept file'
				/>

			</div>

			const fileStatusHTML = <StatusIndicator className='mx-1' indicatorColor={fileStatus.color} title={fileStatus.title} />

			return (
				// name, details
				<div key={uri.toString()} className="flex justify-between items-center">
					<div className="flex items-center">
						{fileNameHTML}
						{detailsContent}
					</div>
					<div className="flex items-center gap-2">
						{acceptRejectButtons}
						{fileStatusHTML}
					</div>
				</div>
			)
		})}
	</div>

	const fileDetailsButton = (
		<button
			className={`flex items-center gap-1 rounded ${numFilesChanged === 0 ? 'cursor-pointer' : 'cursor-pointer hover:brightness-125 transition-all duration-200'}`}
			onClick={() => isFileDetailsOpened ? setFileDetailsOpenedState('user-closed') : setFileDetailsOpenedState('user-opened')}
			type='button'
			disabled={numFilesChanged === 0}
		>
			<svg
				className="transition-transform duration-200 size-3.5"
				style={{
					transform: isFileDetailsOpened ? 'rotate(0deg)' : 'rotate(180deg)',
					transition: 'transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)'
				}}
				xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline>
			</svg>
			{numFilesChangedStr}
		</button>
	)

	return (
		<>
			{/* file details */}
			<div className='px-2'>
				<div
					className={`
						select-none
						flex w-full rounded-t-lg bg-void-bg-3
						text-void-fg-3 text-xs text-nowrap

						overflow-hidden transition-all duration-200 ease-in-out
						${isFileDetailsOpened ? 'max-h-24' : 'max-h-0'}
					`}
				>
					{fileDetailsContent}
				</div>
			</div>
			{/* main content */}
			<div
				className={`
					select-none
					flex w-full rounded-t-lg bg-void-bg-3
					text-void-fg-3 text-xs text-nowrap
					border-t border-l border-r border-zinc-300/10

					px-2 py-1
					justify-between
				`}
			>
				<div className="flex gap-2 items-center">
					{fileDetailsButton}
				</div>
				<div className="flex gap-2 items-center">
					{acceptRejectAllButtons}
					{threadStatusHTML}
				</div>
			</div>
		</>
	)
}



export const SidebarChat = () => {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const textAreaFnsRef = useRef<TextAreaFns | null>(null)

	const { t } = useTranslation()
	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const chatThreadsService = accessor.get('IChatThreadService')

	const settingsState = useSettingsState()
	// ----- HIGHER STATE -----

	// threads state
	const chatThreadsState = useChatThreadsState()

	const currentThread = chatThreadsService.getCurrentThread()
	const previousMessages = currentThread?.messages ?? []

	const selections = currentThread.state.stagingSelections
	const setSelections = (s: StagingSelectionItem[]) => { chatThreadsService.setCurrentThreadState({ stagingSelections: s }) }

	// stream state
	const currThreadStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId)
	const isRunning = currThreadStreamState?.isRunning
	const latestError = currThreadStreamState?.error
	const { displayContentSoFar, toolCallSoFar, reasoningSoFar } = currThreadStreamState?.llmInfo ?? {}

	// this is just if it's currently being generated, NOT if it's currently running
	const toolIsGenerating = toolCallSoFar && !toolCallSoFar.isDone // show loading for slow tools (right now just edit)

	// ----- SIDEBAR CHAT state (local) -----

	// state of current message
	const initVal = ''
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(!initVal)

	// Image attachments management
	const [showHistory, setShowHistory] = useState(false);
	const {
		attachments: imageAttachments,
		addImages: addImagesRaw,
		removeImage,
		retryImage,
		cancelImage,
		clearAll: clearImages,
		focusedIndex: focusedImageIndex,
		setFocusedIndex: setFocusedImageIndex,
		validationError: imageValidationError,
	} = useImageAttachments();

	// PDF attachments management
	const {
		attachments: pdfAttachments,
		addPDFs: addPDFsRaw,
		removePDF,
		retryPDF,
		cancelPDF,
		clearAll: clearPDFs,
		focusedIndex: focusedPDFIndex,
		setFocusedIndex: setFocusedPDFIndex,
		validationError: pdfValidationError,
	} = usePDFAttachments();

	// Wrapper to check vision capabilities before adding PDFs
	// PDFs are more forgiving than images - they can work with non-vision models via text extraction
	const addPDFs = useCallback(async (files: File[]) => {
		const currentModelSel = settingsState.modelSelectionOfFeature['Chat'];

		// In auto mode, skip vision capability check - the router will select an appropriate model
		// PDFs can also work with non-vision models via text extraction, so we're more lenient
		if (currentModelSel?.providerName === 'auto' && currentModelSel?.modelName === 'auto') {
			await addPDFsRaw(files);
			return;
		}

		// For non-auto mode, allow PDFs even without vision models (they can use text extraction)
		// But we could optionally warn if no vision models are available
		await addPDFsRaw(files);
	}, [addPDFsRaw, settingsState]);

	// Wrapper to check vision capabilities before adding images
	const addImages = useCallback(async (files: File[]) => {
		const currentModelSel = settingsState.modelSelectionOfFeature['Chat'];

		// In auto mode, skip vision capability check - the router will select an appropriate model
		if (currentModelSel?.providerName === 'auto' && currentModelSel?.modelName === 'auto') {
			await addImagesRaw(files);
			return;
		}

		// Check if user has vision-capable API keys or Ollama vision models
		const { isSelectedModelVisionCapable, checkOllamaModelVisionCapable, hasVisionCapableApiKey, hasOllamaVisionModel, isOllamaAccessible } = await import('../util/visionModelHelper.js');

		// First, check if the currently selected model is vision-capable (synchronous check)
		let selectedIsVision = isSelectedModelVisionCapable(currentModelSel, settingsState.settingsOfProvider);

		// If Ollama model and not detected by name, query Ollama API directly (async)
		if (!selectedIsVision && currentModelSel?.providerName === 'ollama') {
			const ollamaAccessible = await isOllamaAccessible();
			if (ollamaAccessible) {
				selectedIsVision = await checkOllamaModelVisionCapable(currentModelSel.modelName);
			}
		}

		if (selectedIsVision) {
			// User has selected a vision-capable model, proceed
			await addImagesRaw(files);
			return;
		}

		// If not selected, check if they have any vision-capable options available
		const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
		const ollamaAccessible = await isOllamaAccessible();
		const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();

		if (!hasApiKey && !hasOllamaVision) {
			// Show notification with option to open Ollama setup
			const notificationService = accessor.get('INotificationService');
			const commandService = accessor.get('ICommandService');

			notificationService.notify({
				severity: 2, // Severity.Warning
				message: 'No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava).',
				actions: {
					primary: [{
						id: 'void.vision.setup',
						label: 'Setup Ollama Vision Models',
						tooltip: '',
						class: undefined,
						enabled: true,
						run: () => commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID),
					}],
				},
			});
			return;
		}

		// User has vision support available but not selected, proceed anyway (they might switch models)
		await addImagesRaw(files);
	}, [addImagesRaw, settingsState, accessor]);

	// Compute isDisabled - ensure it's reactive to settings changes
	const isDisabled = useMemo(() => {
		return (instructionsAreEmpty && imageAttachments.length === 0 && pdfAttachments.length === 0) || !!isFeatureNameDisabled('Chat', settingsState)
	}, [instructionsAreEmpty, imageAttachments.length, pdfAttachments.length, settingsState])

	const sidebarRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)

	// Memoize scrollToBottom callback to prevent unnecessary re-renders
	const scrollToBottomCallback = useCallback(() => {
		scrollToBottom(scrollContainerRef)
	}, [scrollContainerRef])

	const onSubmit = useCallback(async (_forceSubmit?: string) => {

		if (isDisabled && !_forceSubmit) return
		if (isRunning) return

		// use subscribed state - currentThread.id is already from subscribed state
		const threadId = currentThread.id

		// send message to LLM
		let userMessage = _forceSubmit || textAreaRef.current?.value || ''

		// allow-any-unicode-next-line
		// ── Slash commands ────────────────────────────────────────────────────────
		// Intercept /command messages before sending to LLM.
		const trimmed = userMessage.trim()
		if (trimmed.startsWith('/')) {
			const [cmd, ...rest] = trimmed.slice(1).split(/\s+/)
			const notificationService = accessor.get('INotificationService')
			const clearInput = () => {
				if (textAreaFnsRef.current) textAreaFnsRef.current.setValue('')
				textAreaRef.current?.focus()
			}
			switch (cmd.toLowerCase()) {
				case 'clear':
				case 'new':
					clearInput()
					await chatThreadsService.openNewThread()
					await chatThreadsService.focusCurrentChat()
					return
				case 'settings':
					clearInput()
					commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID)
					return
				case 'model':
					clearInput()
					commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID)
					return
				case 'help': {
					clearInput()
					const skillNames = chatThreadsService.listSkillNames?.() ?? []
					const skillsLine = skillNames.length > 0
						? ` | skills: ${skillNames.map(n => '/' + n).join(', ')}`
						: ''
					notificationService.info(
						// allow-any-unicode-next-line
						'Slash commands: /clear — new thread | /settings — open settings | /model — change model | /help — this message' + skillsLine
					)
					return
				}
				default: {
					// Phase 6 (Skills): /<skill-name> [args] expands the matching .cortexide/skills SKILL.md
					// into a normal chat turn. Built-in commands above take precedence over same-named skills.
					const skillExpansion = chatThreadsService.getSkillExpansion(trimmed)
					if (skillExpansion !== null) {
						userMessage = skillExpansion
						break
					}
					// allow-any-unicode-next-line
					// Unknown command — let it fall through as normal text
					break
				}
			}
		}
		// allow-any-unicode-next-line
		// ─────────────────────────────────────────────────────────────────────────

			// Resolve @references in the input into staging selections before sending
			// Supports tokens like: @"src/app/file.ts", @path/to/file.ts, @folder, @workspace, @recent, @selection
			try {
				const toolsService = accessor.get('IToolsService')
				const workspaceService = accessor.get('IWorkspaceContextService')
				const editorService = accessor.get('IEditorService')
				const languageService = accessor.get('ILanguageService')
				const historyService = accessor.get('IHistoryService')
				const notificationService = accessor.get('INotificationService')
				let outlineService: any = undefined
				try { outlineService = accessor.get('IOutlineModelService') } catch {}

			// Collect existing URIs to avoid duplicate attachments
			const existing = new Set<string>()
			const existingSelections = chatThreadsState.allThreads[currentThread.id]?.state?.stagingSelections || []
			for (const s of existingSelections) existing.add(s.uri?.fsPath || '')

			const addFileSelection = async (uri: any) => {
				if (!uri) return
				const key = uri.fsPath || uri.path || ''
				if (key && existing.has(key)) return
				existing.add(key)
				const newSel = {
					type: 'File',
					uri,
					language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) || '',
					state: { wasAddedAsCurrentFile: false },
				}
				await chatThreadsService.addNewStagingSelection(newSel)
			}

			const addFolderSelection = async (uri: any) => {
				if (!uri) return
				const key = uri.fsPath || uri.path || ''
				if (key && existing.has(key)) return
				existing.add(key)
				const newSel = {
					type: 'Folder',
					uri,
					language: undefined,
					state: undefined,
				}
				await chatThreadsService.addNewStagingSelection(newSel)
			}

			const tokens: string[] = []
			{
				// Extract quoted paths first: @"..."
				const quoted = [...userMessage.matchAll(/@"([^"]+)"/g)].map(m => m[1])
				tokens.push(...quoted)
				// Extract bare @word-like tokens (stop at whitespace or punctuation)
				for (const m of userMessage.matchAll(/@([\w\.\-_/]+(?::\d+(?:-\d+)?)?)/g)) {
					const t = m[1]
					if (t) tokens.push(t)
				}
			}

			const special = new Set(['selection', 'workspace', 'recent', 'folder'])

			// Track unresolved references for error reporting
			const unresolvedRefs: string[] = []

			for (const raw of tokens) {
				// Handle special tokens
				if (raw === 'selection') {
					const active = editorService.activeTextEditorControl
					const activeResource = editorService.activeEditor?.resource
					const sel = active?.getSelection?.()
					if (activeResource && sel && !sel.isEmpty()) {
						const newSel = {
							type: 'File',
							uri: activeResource,
							language: languageService.guessLanguageIdByFilepathOrFirstLine(activeResource) || '',
							state: { wasAddedAsCurrentFile: false },
							range: sel,
						}
						const key = activeResource.fsPath || ''
						if (!existing.has(key)) {
							existing.add(key)
							await chatThreadsService.addNewStagingSelection(newSel)
						}
					} else {
						unresolvedRefs.push('@selection (no active selection)')
					}
					continue
				}
				if (raw === 'workspace') {
					for (const folder of workspaceService.getWorkspace().folders) {
						await addFolderSelection(folder.uri)
					}
					continue
				}
				if (raw === 'recent') {
					for (const h of historyService.getHistory()) {
						if (h.resource) await addFileSelection(h.resource)
					}
					continue
				}

				// Handle explicit symbol: @sym:Name or @symbol:Name
				if (raw.startsWith('sym:') || raw.startsWith('symbol:')) {
					const symName = raw.replace(/^symbol?:/,'')
					let symbolFound = false
					if (outlineService && typeof outlineService.getCachedModels === 'function') {
						try {
							const models = outlineService.getCachedModels()
							for (const om of models) {
								const list = typeof om.asListOfDocumentSymbols === 'function' ? om.asListOfDocumentSymbols() : []
								for (const s of list) {
									if ((s?.name || '').toLowerCase() === symName.toLowerCase()) {
										symbolFound = true
										const uri = om.uri
										const range = s.range
										const key = uri?.fsPath || ''
										if (!existing.has(key)) {
											existing.add(key)
											await chatThreadsService.addNewStagingSelection({
												type: 'File',
												uri,
												language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) || '',
												state: { wasAddedAsCurrentFile: false },
												range,
											})
										}
									}
								}
							}
						} catch (err) {
							// Service error - log but continue
							console.warn('Error resolving symbol:', err)
						}
					}
					if (!symbolFound) {
						unresolvedRefs.push(`@${raw} (symbol not found)`)
					}
					continue
				}

				// Handle explicit folder keyword like: @folder:path or plain name that matches a folder
				let query = raw
				let isFolderHint = false
				if (raw.startsWith('folder:')) {
					isFolderHint = true
					query = raw.slice('folder:'.length)
				}

				// Use tools service to resolve best match in workspace
				let resolved = false
				try {
					const res = await (await toolsService.callTool.search_pathnames_only({ query, includePattern: null, pageNumber: 1 })).result
					const [first] = res.uris || []
					if (first) {
						resolved = true
						// Heuristic: if hint says folder or resolved path ends with '/', treat as folder
						if (isFolderHint) await addFolderSelection(first)
						else await addFileSelection(first)
					}
				} catch (err) {
					// Service error - log but continue
					console.warn('Error resolving reference:', err)
				}
				if (!resolved) {
					unresolvedRefs.push(`@${raw}`)
				}
			}

			// Report unresolved references to user
			if (unresolvedRefs.length > 0) {
				const refList = unresolvedRefs.slice(0, 3).join(', ')
				const moreText = unresolvedRefs.length > 3 ? ` and ${unresolvedRefs.length - 3} more` : ''
				notificationService.warn(`Could not resolve reference${unresolvedRefs.length > 1 ? 's' : ''}: ${refList}${moreText}. Please check the file path or symbol name.`)
			}
		} catch (err) {
			// Best-effort; do not block send, but log error
			console.warn('Error resolving @references:', err)
		}

		// Convert image attachments to ChatImageAttachment format
		const images: ChatImageAttachment[] = imageAttachments
			.filter(att => att.uploadStatus === 'success' || !att.uploadStatus)
			.map(att => ({
				id: att.id,
				data: att.data,
				mimeType: att.mimeType,
				filename: att.filename,
				width: att.width,
				height: att.height,
				size: att.size,
			}));

		// Check if any PDFs are still processing
		const processingPDFs = pdfAttachments.filter(
			att => att.uploadStatus === 'uploading' || att.uploadStatus === 'processing'
		);

		if (processingPDFs.length > 0) {
			const processingNames = processingPDFs.map(p => p.filename).join(', ');
			notificationService.warn(`Some PDFs are still processing: ${processingNames}. They will be sent but may not have extracted text available yet.`);
		}

		// Convert PDF attachments to ChatPDFAttachment format
		// Include PDFs that are successful, have no status, or are still processing (they might have partial data)
		// Exclude only failed PDFs
		const pdfs: ChatPDFAttachment[] = pdfAttachments
			.filter(att => att.uploadStatus !== 'failed')
			.map(att => ({
				id: att.id,
				data: att.data,
				filename: att.filename,
				size: att.size,
				pageCount: att.pageCount,
				selectedPages: att.selectedPages,
				extractedText: att.extractedText,
				pagePreviews: att.pagePreviews,
			}));

		// Validate that model supports vision/PDFs if attachments are present
		const currentModelSel = settingsState.modelSelectionOfFeature['Chat'];
		if ((images.length > 0 || pdfs.length > 0) && currentModelSel) {
			const { isSelectedModelVisionCapable, checkOllamaModelVisionCapable, hasVisionCapableApiKey, hasOllamaVisionModel, isOllamaAccessible } = await import('../util/visionModelHelper.js');

			// In auto mode, check if user has any vision-capable models available
			if (currentModelSel.providerName === 'auto' && currentModelSel.modelName === 'auto') {
				// Images require vision-capable models (no fallback)
				if (images.length > 0) {
					const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
					const ollamaAccessible = await isOllamaAccessible();
					const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();

					if (!hasApiKey && !hasOllamaVision) {
						notificationService.error('No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava) to use images.');
						return;
					}
				}
				// PDFs can work with non-vision models via text extraction, so we allow them even without vision-capable models
				// If vision-capable models are available, router will select appropriate model
			} else {
				// For non-auto mode, check if the selected model is vision-capable
				let isVisionCapable = isSelectedModelVisionCapable(currentModelSel, settingsState.settingsOfProvider);

				// If Ollama, check via API
				if (!isVisionCapable && currentModelSel.providerName === 'ollama') {
					const ollamaAccessible = await isOllamaAccessible();
					if (ollamaAccessible) {
						isVisionCapable = await checkOllamaModelVisionCapable(currentModelSel.modelName);
					}
				}

				// If not vision-capable, show error
				if (!isVisionCapable) {
					const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
					const ollamaAccessible = await isOllamaAccessible();
					const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();

					if (!hasApiKey && !hasOllamaVision) {
						notificationService.error('The selected model does not support images or PDFs. Please select a vision-capable model (e.g., Claude, GPT-4, Gemini, or an Ollama vision model like llava).');
						return;
					} else {
						notificationService.warn('The selected model may not support images or PDFs. Consider switching to a vision-capable model for better results.');
					}
				}
			}
		}

		// Capture staging selections BEFORE clearing them, so they're included in the message
		const stagingSelections = chatThreadsState.allThreads[currentThread.id]?.state?.stagingSelections || []

		// Optimistic UI: Clear input and attachments immediately for perceived responsiveness
		setSelections([]) // clear staging
		if (textAreaFnsRef.current) {
			textAreaFnsRef.current.setValue('')
		}
		clearImages() // clear image attachments
		clearPDFs() // clear PDF attachments
		textAreaRef.current?.focus() // focus input after submit

		// Send message (non-blocking for UI responsiveness)
		try {
			await chatThreadsService.addUserMessageAndStreamResponse({ userMessage, threadId, images, pdfs, _chatSelections: stagingSelections })
		} catch (e) {
			console.error('Error while sending message in chat:', e)
		}

	}, [chatThreadsService, isDisabled, isRunning, textAreaRef, textAreaFnsRef, setSelections, settingsState, imageAttachments, pdfAttachments, clearImages, clearPDFs, currentThread.id])

	const onAbort = async () => {
		const threadId = currentThread.id
		await chatThreadsService.abortRunning(threadId)
	}

	const keybindingString = accessor.get('IKeybindingService').lookupKeybinding(CORTEXIDE_CTRL_L_ACTION_ID)?.getLabel()

	const threadId = currentThread.id
	const currCheckpointIdx = chatThreadsState.allThreads[threadId]?.state?.currCheckpointIdx ?? undefined  // if not exist, treat like checkpoint is last message (infinity)



	// resolve mount info
	// Accessing .current is safe - refs don't trigger re-renders when changed
	const mountedInfo = chatThreadsState.allThreads[threadId]?.state.mountedInfo
	const isResolved = mountedInfo?.mountedIsResolvedRef.current
	useEffect(() => {
		if (isResolved) return
		mountedInfo?._whenMountedResolver?.({
			textAreaRef: textAreaRef,
			scrollToBottom: scrollToBottomCallback,
		})

	}, [threadId, textAreaRef, scrollContainerRef, isResolved, mountedInfo, scrollToBottomCallback])




	const previousMessagesHTML = useMemo(() => {
		// const lastMessageIdx = previousMessages.findLastIndex(v => v.role !== 'checkpoint')
		// tool request shows up as Editing... if in progress
		// Use stable keys based on message ID or index for better React reconciliation
		return previousMessages.map((message, i) => {
			// Use message ID if available, otherwise fall back to index
			const messageKey = (message as any).id || `msg-${i}`
			return <ChatBubble
				key={messageKey}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={message}
				messageIdx={i}
				isCommitted={true}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={scrollToBottomCallback}
			/>
		})
	}, [previousMessages, threadId, currCheckpointIdx, isRunning, scrollToBottomCallback])

	const streamingChatIdx = previousMessagesHTML.length
	// Memoize chatMessage object to avoid recreating on every render
	const streamingChatMessage = useMemo(() => ({
		role: 'assistant' as const,
		displayContent: displayContentSoFar ?? '',
		reasoning: reasoningSoFar ?? '',
		anthropicReasoning: null,
	}), [displayContentSoFar, reasoningSoFar])

	// Only show streaming message when actively streaming (LLM, tool, or preparing)
	// Don't show when idle/undefined to prevent duplicate messages and never-ending loading
	// Only show stop button when actively running (LLM, tool, preparing), not when idle
	const isActivelyStreaming = isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'preparing'
	const currStreamingMessageHTML = isActivelyStreaming && (reasoningSoFar || displayContentSoFar) ?
		<ChatBubble
			key={'curr-streaming-msg'}
			currCheckpointIdx={currCheckpointIdx}
			chatMessage={streamingChatMessage}
			messageIdx={streamingChatIdx}
			isCommitted={false}
			chatIsRunning={isRunning}
			threadId={threadId}
			_scrollToBottom={null}
		/> : null


	// the tool currently being generated
	const generatingTool = toolIsGenerating ?
		toolCallSoFar.name === 'edit_file' || toolCallSoFar.name === 'rewrite_file' ? <EditToolSoFar
			key={'curr-streaming-tool'}
			toolCallSoFar={toolCallSoFar}
		/>
			: null
		: null

	const messagesHTML = <ScrollToBottomContainer
		key={'messages' + chatThreadsState.currentThreadId} // force rerender on all children if id changes
		scrollContainerRef={scrollContainerRef}
		className={`
			flex flex-col
			px-3 py-3 space-y-3
			w-full h-full
			overflow-x-hidden
			overflow-y-auto
			${previousMessagesHTML.length === 0 && !displayContentSoFar ? 'hidden' : ''}
		`}
	>
		{/* previous messages */}
		{previousMessagesHTML}
		{currStreamingMessageHTML}

		{/* Generating tool */}
		{generatingTool}

		{/* loading indicator with status message - only show when no content is streaming yet */}
		{(isRunning === 'LLM' || isRunning === 'preparing') && !displayContentSoFar && !reasoningSoFar ? (
			<ProseWrapper>
				<div
					className="flex flex-col gap-1"
					role="status"
					aria-live="polite"
					aria-atomic="true"
				>
					<div className="flex items-center gap-2 text-sm opacity-70 loading-state-transition">
						{isRunning === 'preparing' && currThreadStreamState?.llmInfo?.displayContentSoFar ? (
							<>
								<span className="text-void-fg-2" aria-hidden="false">{currThreadStreamState.llmInfo.displayContentSoFar}</span>
								<IconLoading state="thinking" inline />
							</>
						) : isRunning === 'preparing' ? (
							<>
								<span className="text-void-fg-2" aria-hidden="false">Preparing request</span>
								<IconLoading state="thinking" inline />
							</>
						) : (
							<>
								<span className="text-void-fg-2" aria-hidden="false">Generating response</span>
								<IconLoading state="typing" inline />
							</>
						)}
					</div>
					<span className="text-xs text-void-fg-3 opacity-60">Press Escape to cancel</span>
				</div>
			</ProseWrapper>
		) : null}

		{/* Escape hint when streaming (e.g. "Waiting for model response...") */}
		{(isRunning === 'LLM' || isRunning === 'preparing') && (displayContentSoFar || reasoningSoFar) ? (
			<p className="text-xs text-void-fg-3 opacity-60 mt-1" role="status">Press Escape to cancel</p>
		) : null}


		{/* error message */}
		{latestError === undefined ? null :
			<div className='px-2 my-1 message-enter space-y-2'>
				<ErrorDisplay
					message={latestError.message}
					fullError={latestError.fullError}
					onDismiss={() => { chatThreadsService.dismissStreamError(currentThread.id) }}
					showDismiss={true}
				/>
				<p className="text-sm text-void-fg-3 px-1">
					You can try again or open settings to change the model.
				</p>
				<WarningBox className='text-sm my-1 mx-3' onClick={() => { commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID) }} text='Open settings' />
			</div>
		}
	</ScrollToBottomContainer>


	const onChangeText = useCallback((newStr: string) => {
		setInstructionsAreEmpty(!newStr)
	}, [setInstructionsAreEmpty])
	const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			// Check isDisabled again at the time of key press (not closure value)
			if (!isDisabled && !isRunning) {
				onSubmit()
			}
		} else if (e.key === 'Escape' && isRunning) {
			onAbort()
		}
	}, [onSubmit, onAbort, isRunning, isDisabled])

	// Context usage calculation + warning (partially memoized - draft tokens calculated on each render)
	const [ctxWarned, setCtxWarned] = useState(false)
	const estimateTokens = useCallback((s: string) => Math.ceil((s || '').length / 4), [])
	const modelSel = settingsState.modelSelectionOfFeature['Chat']

	// Memoize context budget and messages tokens (only recalculate when messages or model changes)
	const { contextBudget, messagesTokens } = useMemo(() => {
		let budget = 0
		let tokens = 0
		if (modelSel && isValidProviderModelSelection(modelSel)) {
			const { providerName, modelName } = modelSel
			const caps = getModelCapabilities(providerName, modelName, settingsState.overridesOfModel)
			const contextWindow = caps.contextWindow
			const msOpts = settingsState.optionsOfModelSelection['Chat'][providerName]?.[modelName]
			const isReasoningEnabled2 = getIsReasoningEnabledState('Chat', providerName, modelName, msOpts, settingsState.overridesOfModel)
			const rot = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled: isReasoningEnabled2, overridesOfModel: settingsState.overridesOfModel }) || 0
			budget = Math.max(256, Math.floor(contextWindow * 0.8) - rot)
			tokens = previousMessages.reduce((acc, m) => {
				if (m.role === 'user') return acc + estimateTokens(m.content || '')
				if (m.role === 'assistant') return acc + estimateTokens((m.displayContent as string) || (m.content || '') || '')
				return acc
			}, 0)
		}
		return { contextBudget: budget, messagesTokens: tokens }
	}, [modelSel, previousMessages, settingsState.overridesOfModel, estimateTokens])

	// Calculate draft tokens and total on each render (draft changes frequently)
	const draftTokens = estimateTokens(textAreaRef.current?.value || '')
	const contextTotal = messagesTokens + draftTokens
	const contextPct = contextBudget > 0 ? contextTotal / contextBudget : 0

	useEffect(() => {
		if (contextPct > 0.8 && contextPct < 1 && !ctxWarned) {
			try { accessor.get('INotificationService').info(`Context nearing limit: ~${contextTotal} / ${contextBudget} tokens. Older messages may be summarized.`) } catch {}
			setCtxWarned(true)
		}
		if (contextPct < 0.6 && ctxWarned) setCtxWarned(false)
	}, [contextPct, ctxWarned, contextTotal, contextBudget, accessor])

	const inputChatArea = <VoidChatArea
		featureName='Chat'
		onSubmit={() => onSubmit()}
		onAbort={onAbort}
		isStreaming={isActivelyStreaming}
		isDisabled={isDisabled}
		showSelections={true}
		// showProspectiveSelections={previousMessagesHTML.length === 0}
		selections={selections}
		setSelections={setSelections}
		onClickAnywhere={() => { textAreaRef.current?.focus() }}
		imageAttachments={
			imageAttachments.length > 0 ? (
				<>
					<ImageAttachmentList
						attachments={imageAttachments}
						onRemove={removeImage}
						onRetry={retryImage}
						onCancel={cancelImage}
						focusedIndex={focusedImageIndex}
						onFocusChange={setFocusedImageIndex}
					/>
					{imageValidationError && (
						<div className="px-2 py-1 text-xs text-[var(--cortex-danger)] bg-[var(--cortex-danger)]/10 border border-[var(--cortex-danger)]/20 rounded-md mx-2">
							{imageValidationError.message}
						</div>
					)}
				</>
			) : null
		}
		onImagePaste={addImages}
		onImageDrop={addImages}
		onPDFDrop={addPDFs}
		pdfAttachments={
			pdfAttachments.length > 0 ? (
				<>
					<PDFAttachmentList
						attachments={pdfAttachments}
						onRemove={removePDF}
						onRetry={retryPDF}
						onCancel={cancelPDF}
						focusedIndex={focusedPDFIndex}
						onFocusChange={setFocusedPDFIndex}
					/>
					{pdfValidationError && (
						<div className="px-2 py-1 text-xs text-[var(--cortex-danger)] bg-[var(--cortex-danger)]/10 border border-[var(--cortex-danger)]/20 rounded-md mx-2">
							{pdfValidationError}
						</div>
					)}
				</>
			) : null
		}
	>
		<VoidInputBox2
			enableAtToMention
			appearance="chatDark"
			className={`min-h-[60px] px-3 py-3 rounded-2xl`}
			placeholder="Plan, @ for context"
			onChangeText={onChangeText}
			onKeyDown={onKeyDown}
			onFocus={() => { chatThreadsService.setCurrentlyFocusedMessageIdx(undefined) }}
			ref={textAreaRef}
			fnsRef={textAreaFnsRef}
			multiline={true}
		/>

		{/* Context chips for current selections */}
		{selections.length > 0 && (
			<div className='mt-1 flex flex-wrap gap-1 px-1'>
				{selections.map((sel, idx) => {
					const name = sel.type === 'Folder'
						? (sel.uri?.path?.split('/').filter(Boolean).pop() || 'folder')
						: (sel.uri?.path?.split('/').pop() || 'file')
					const fullPath = sel.uri?.fsPath || sel.uri?.path || name
					const rangeLabel = (sel as any).range ? ` • ${(sel as any).range.startLineNumber}-${(sel as any).range.endLineNumber}` : ''
					const tooltipText = (sel as any).range
						? `${fullPath} (lines ${(sel as any).range.startLineNumber}-${(sel as any).range.endLineNumber})`
						: fullPath
					return (
						<span
							key={idx}
							className='inline-flex items-center gap-1 px-2 py-0.5 rounded border border-void-border-3 bg-void-bg-1 text-void-fg-2 text-[11px]'
							title={tooltipText}
							aria-label={tooltipText}
						>
							<span className='opacity-80'>{sel.type === 'Folder' ? 'Folder' : 'File'}</span>
							<span className='text-void-fg-1'>{name}</span>
							{rangeLabel && <span className='opacity-70'>{rangeLabel}</span>}
							<button
								className='ml-1 text-void-fg-3 hover:text-void-fg-1'
								onClick={() => {
									// remove single selection
									chatThreadsService.popStagingSelections(1)
								}}
								aria-label={`Remove ${name}`}
							>
								×
							</button>
						</span>
					)
				})}
			</div>
		)}

	</VoidChatArea>


	const isLandingPage = previousMessages.length === 0


	const threadPageInput = <div key={'input' + chatThreadsState.currentThreadId}>
		<div className='px-4'>
			<CommandBarInChat />
		</div>
		<div className='px-2 pb-2'>
			{inputChatArea}

			{/* Context usage indicator */}
			{modelSel ? (
				(() => {
					const pctNum = Math.max(0, Math.min(100, Math.round(contextPct * 100)))
					const color = contextPct >= 1 ? 'text-[var(--cortex-danger)]' : contextPct > 0.8 ? 'text-[var(--cortex-warning)]' : 'text-void-fg-3'
					const barColor = contextPct >= 1 ? 'bg-[var(--cortex-danger)]' : contextPct > 0.8 ? 'bg-[var(--cortex-warning)]' : 'bg-void-fg-3/60'
					return <div className='mt-1'>
						<div className={`text-[10px] ${color}`}>Context ~{contextTotal} / {contextBudget} tokens ({pctNum}%)</div>
						<div className='h-[3px] w-full bg-void-border-3 rounded mt-0.5'>
							<div className={`h-[3px] ${barColor} rounded`} style={{ width: `${pctNum}%` }} aria-label={`Context usage ${pctNum}%`} />
						</div>
					</div>
				})()
			) : null}
		</div>
	</div>

	const landingPageInput = <div>
		<div className='pt-8'>
			{inputChatArea}
			{modelSel ? (
				(() => {
					const pctNum = Math.max(0, Math.min(100, Math.round(contextPct * 100)))
					const color = contextPct >= 1 ? 'text-[var(--cortex-danger)]' : contextPct > 0.8 ? 'text-[var(--cortex-warning)]' : 'text-void-fg-3'
					const barColor = contextPct >= 1 ? 'bg-[var(--cortex-danger)]' : contextPct > 0.8 ? 'bg-[var(--cortex-warning)]' : 'bg-void-fg-3/60'
					return <div className='mt-1 px-2'>
						<div className={`text-[10px] ${color}`}>Context ~{contextTotal} / {contextBudget} tokens ({pctNum}%)</div>
						<div className='h-[3px] w-full bg-void-border-3 rounded mt-0.5'>
							<div className={`h-[3px] ${barColor} rounded`} style={{ width: `${pctNum}%` }} aria-label={`Context usage ${pctNum}%`} />
						</div>
					</div>
				})()
			) : null}
		</div>
	</div>

	const landingPageContent = <LandingPage
		sidebarRef={sidebarRef}
		inputSection={landingPageInput}
		showPreviousThreads={Object.keys(chatThreadsState.allThreads).length > 1}
		suggestionsLabel={t('chat.suggestions')}
		previousThreadsLabel={t('chat.previousThreads')}
		onSubmitPrompt={onSubmit}
	/>


	// const threadPageContent = <div>
	// 	{/* Thread content */}
	// 	<div className='flex flex-col overflow-hidden'>
	// 		<div className={`overflow-hidden ${previousMessages.length === 0 ? 'h-0 max-h-0 pb-2' : ''}`}>
	// 			<ErrorBoundary>
	// 				{messagesHTML}
	// 			</ErrorBoundary>
	// 		</div>
	// 		<ErrorBoundary>
	// 			{inputForm}
	// 		</ErrorBoundary>
	// 	</div>
	// </div>
	const threadPageContent = <div
		ref={sidebarRef}
		className='w-full h-full flex flex-col overflow-hidden'
	>

		<ErrorBoundary>
			{messagesHTML}
		</ErrorBoundary>
		<ErrorBoundary>
			{threadPageInput}
		</ErrorBoundary>
	</div>


	return (
		<div key={threadId} className="w-full h-full flex flex-col overflow-hidden">
			<ComposerTabs />
			<ThreadHeader
				showHistory={showHistory}
				onToggleHistory={() => setShowHistory(v => !v)}
			/>
			{showHistory && (
				<ErrorBoundary>
					<div className="shrink-0 max-h-[40%] overflow-y-auto px-3 py-2 border-b border-void-border-3 bg-void-bg-2/50">
						<PastThreadsList />
					</div>
				</ErrorBoundary>
			)}
			<div className="flex-1 min-h-0 overflow-hidden">
				{isLandingPage ? landingPageContent : threadPageContent}
			</div>
		</div>
	)
}
