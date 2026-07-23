/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState } from '../util/services.js';

import { TextAreaFns, VoidInputBox2 } from '../util/inputs.js';
import { PastThreadsList } from './SidebarThreadSelector.js';
import { VoidChatArea, ButtonSubmit, ButtonStop } from './composer/VoidChatArea.js';
import { SelectedFiles } from './composer/SelectedFiles.js';
import { scrollToBottom } from './composer/ScrollToBottomContainer.js';
import { ContextUsageBar } from './composer/ContextUsageBar.js';
import { CommandBarInChat } from './composer/CommandBarInChat.js';
import { ChatMessageList } from './composer/ChatMessageList.js';
import { StagingContextChips } from './composer/StagingContextChips.js';
import { useContextUsage } from './composer/useContextUsage.js';
import { resolveAtReferencesInMessage } from './composer/resolveAtReferences.js';
import { LandingPage } from './landing/LandingPage.js';
import { ComposerTabs } from './chrome/ComposerTabs.js';
import { ThreadHeader } from './chrome/ThreadHeader.js';
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from '../../../cortexideSettingsPane.js';
import { isFeatureNameDisabled } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js';
import { StagingSelectionItem, ChatImageAttachment, ChatPDFAttachment } from '../../../../common/chatThreadServiceTypes.js';
import ErrorBoundary from './ErrorBoundary.js';
import { useImageAttachments } from '../util/useImageAttachments.js';
import { usePDFAttachments } from '../util/usePDFAttachments.js';
import { useTranslation } from '../util/useTranslation.js';
import { PDFAttachmentList } from '../util/PDFAttachmentList.js';
import { ImageAttachmentList } from '../util/ImageAttachmentList.js';
import { IconX, IconWarning, IconLoading, TypingCursor } from './shared/icons.js';
import { getBasename, getFolderName, getRelative, voidOpenFileFn } from './shared/pathUtils.js';
import { ToolChildrenWrapper, CodeChildren, ListableToolItem } from './tools/ToolPrimitives.js';
import { ChatBubble } from './chat/ChatBubble.js';

// Re-export shared modules for existing consumers (will migrate imports over time).
export { IconX, IconWarning, IconLoading, TypingCursor } from './shared/icons.js';
export { getBasename, getFolderName, getRelative, voidOpenFileFn } from './shared/pathUtils.js';
export { ToolChildrenWrapper, CodeChildren, ListableToolItem } from './tools/ToolPrimitives.js';
export { VoidChatArea, ButtonSubmit, ButtonStop } from './composer/VoidChatArea.js';
export { SelectedFiles } from './composer/SelectedFiles.js';
export { CommandBarInChat } from './composer/CommandBarInChat.js';
export { ChatBubble } from './chat/ChatBubble.js';




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

		const notificationService = accessor.get('INotificationService')

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

		await resolveAtReferencesInMessage({
			userMessage,
			threadId,
			existingSelections: chatThreadsState.allThreads[currentThread.id]?.state?.stagingSelections || [],
			chatThreadsService,
			accessor,
			notificationService,
		});

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

	}, [accessor, chatThreadsService, commandService, isDisabled, isRunning, textAreaRef, textAreaFnsRef, setSelections, settingsState, imageAttachments, pdfAttachments, clearImages, clearPDFs, currentThread.id, chatThreadsState])

	const onAbort = async () => {
		const threadId = currentThread.id
		await chatThreadsService.abortRunning(threadId)
	}

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




	const onChangeText = useCallback((newStr: string) => {
		setInstructionsAreEmpty(!newStr)
	}, [setInstructionsAreEmpty])
	const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			if (!isDisabled && !isRunning) {
				onSubmit()
			}
		} else if (e.key === 'Escape' && isRunning) {
			onAbort()
		}
	}, [onSubmit, onAbort, isRunning, isDisabled])

	const isActivelyStreaming = isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'preparing'

	const { modelSel, contextTotal, contextBudget, contextPct } = useContextUsage(
		previousMessages,
		textAreaRef.current?.value || '',
	)

	const messagesHTML = <ChatMessageList
		threadId={threadId}
		previousMessages={previousMessages}
		currCheckpointIdx={currCheckpointIdx}
		isRunning={isRunning}
		displayContentSoFar={displayContentSoFar}
		reasoningSoFar={reasoningSoFar}
		toolCallSoFar={toolCallSoFar}
		latestError={latestError}
		scrollContainerRef={scrollContainerRef}
		scrollToBottomCallback={scrollToBottomCallback}
	/>

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
		<StagingContextChips
			selections={selections}
			onRemoveLast={() => { chatThreadsService.popStagingSelections(1) }}
		/>

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
				<ContextUsageBar
					className="mt-1"
					contextTotal={contextTotal}
					contextBudget={contextBudget}
					contextPct={contextPct}
				/>
			) : null}
		</div>
	</div>

	const landingPageInput = <div>
		<div className='pt-8'>
			{inputChatArea}
			{modelSel ? (
				<ContextUsageBar
					className="mt-1 px-2"
					contextTotal={contextTotal}
					contextBudget={contextBudget}
					contextPct={contextPct}
				/>
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
