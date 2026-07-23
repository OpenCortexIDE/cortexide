/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState } from '../util/services.js';

import { TextAreaFns } from '../util/inputs.js';
import { PastThreadsList } from './SidebarThreadSelector.js';
import { scrollToBottom } from './composer/ScrollToBottomContainer.js';
import { ChatMessageList } from './composer/ChatMessageList.js';
import { ComposerInputSection } from './composer/ComposerInputSection.js';
import { useContextUsage } from './composer/useContextUsage.js';
import { resolveAtReferencesInMessage } from '../../../../common/resolveAtReferences.js';
import { handleSlashCommand } from './composer/handleSlashCommand.js';
import { prepareChatSubmitAttachments } from './composer/prepareChatSubmit.js';
import { useVisionAttachmentHandlers } from './composer/useVisionAttachmentHandlers.js';
import { LandingPage } from './landing/LandingPage.js';
import { ComposerTabs } from './chrome/ComposerTabs.js';
import { ThreadHeader } from './chrome/ThreadHeader.js';
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from '../../../cortexideSettingsPane.js';
import { isFeatureNameDisabled } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js';
import { StagingSelectionItem } from '../../../../common/chatThreadServiceTypes.js';
import ErrorBoundary from './ErrorBoundary.js';
import { useImageAttachments } from '../util/useImageAttachments.js';
import { usePDFAttachments } from '../util/usePDFAttachments.js';
import { useTranslation } from '../util/useTranslation.js';

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

	const { addImages, addPDFs } = useVisionAttachmentHandlers({
		settingsState,
		accessor,
		settingsCommandId: CORTEXIDE_OPEN_SETTINGS_ACTION_ID,
		addImagesRaw,
		addPDFsRaw,
	});

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
		const trimmed = userMessage.trim()
		const clearInput = () => {
			if (textAreaFnsRef.current) textAreaFnsRef.current.setValue('')
			textAreaRef.current?.focus()
		}

		const slashResult = await handleSlashCommand({
			trimmedMessage: trimmed,
			clearInput,
			chatThreadsService,
			commandService,
			notificationService,
			settingsCommandId: CORTEXIDE_OPEN_SETTINGS_ACTION_ID,
		})
		if (slashResult.handled) return
		userMessage = slashResult.userMessage

		await resolveAtReferencesInMessage({
			userMessage,
			threadId,
			existingSelections: chatThreadsState.allThreads[currentThread.id]?.state?.stagingSelections || [],
			chatThreadsService,
			accessor,
			notificationService,
		});

		const prepared = await prepareChatSubmitAttachments({
			imageAttachments,
			pdfAttachments,
			modelSelection: settingsState.modelSelectionOfFeature['Chat'],
			settingsOfProvider: settingsState.settingsOfProvider,
			notificationService,
		});
		if (!prepared.ok) return;

		const { images, pdfs } = prepared;

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

	const composerInputProps = {
		onSubmit: () => onSubmit(),
		onAbort,
		isStreaming: isActivelyStreaming,
		isDisabled,
		selections,
		setSelections,
		textAreaRef,
		textAreaFnsRef,
		onChangeText,
		onKeyDown,
		onInputFocus: () => { chatThreadsService.setCurrentlyFocusedMessageIdx(undefined) },
		imageAttachments,
		removeImage,
		retryImage,
		cancelImage,
		focusedImageIndex,
		setFocusedImageIndex,
		imageValidationError,
		addImages,
		pdfAttachments,
		removePDF,
		retryPDF,
		cancelPDF,
		focusedPDFIndex,
		setFocusedPDFIndex,
		pdfValidationError,
		addPDFs,
		modelSel,
		contextTotal,
		contextBudget,
		contextPct,
	};

	const landingPageInput = (
		<ComposerInputSection variant="landing" {...composerInputProps} />
	);

	const threadPageInput = (
		<ComposerInputSection
			variant="thread"
			threadKey={chatThreadsState.currentThreadId}
			{...composerInputProps}
		/>
	);

	const isLandingPage = previousMessages.length === 0

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
