/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { RefObject, useMemo } from 'react';
import { useAccessor, useChatThreadsStreamState } from '../../util/services.js';
import { ChatMessage } from '../../../../common/chatThreadServiceTypes.js';
import { IsRunningType } from '../../../chatThreadService.js';
import { ScrollToBottomContainer } from './ScrollToBottomContainer.js';
import { ChatBubble } from '../chat/ChatBubble.js';
import { EditToolSoFar } from '../tools/ToolRenderers.js';
import { ProseWrapper } from '../chat/proseWrappers.js';
import { IconLoading } from '../shared/icons.js';
import { ErrorDisplay } from '../ErrorDisplay.js';
import { WarningBox } from '../../settings/WarningBox.js';
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from '../../../cortexideSettingsPane.js';

type StreamError = { message: string; fullError?: string } | undefined;

type ChatMessageListProps = {
	threadId: string;
	previousMessages: ChatMessage[];
	currCheckpointIdx: number | undefined;
	isRunning: IsRunningType | undefined;
	displayContentSoFar: string | undefined;
	reasoningSoFar: string | undefined;
	toolCallSoFar: { name: string; isDone?: boolean; rawParams?: string } | undefined;
	latestError: StreamError;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	scrollToBottomCallback: (() => void) | null;
};

export const ChatMessageList = ({
	threadId,
	previousMessages,
	currCheckpointIdx,
	isRunning,
	displayContentSoFar,
	reasoningSoFar,
	toolCallSoFar,
	latestError,
	scrollContainerRef,
	scrollToBottomCallback,
}: ChatMessageListProps) => {
	const accessor = useAccessor();
	const commandService = accessor.get('ICommandService');
	const chatThreadsService = accessor.get('IChatThreadService');
	const currThreadStreamState = useChatThreadsStreamState(threadId);

	const previousMessagesHTML = useMemo(() => {
		return previousMessages.map((message, i) => {
			const messageKey = (message as { id?: string }).id || `msg-${i}`;
			return <ChatBubble
				key={messageKey}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={message}
				messageIdx={i}
				isCommitted={true}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={scrollToBottomCallback}
			/>;
		});
	}, [previousMessages, threadId, currCheckpointIdx, isRunning, scrollToBottomCallback]);

	const streamingChatIdx = previousMessagesHTML.length;
	const streamingChatMessage = useMemo(() => ({
		role: 'assistant' as const,
		displayContent: displayContentSoFar ?? '',
		reasoning: reasoningSoFar ?? '',
		anthropicReasoning: null,
	}), [displayContentSoFar, reasoningSoFar]);

	const isActivelyStreaming = isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'preparing';
	const toolIsGenerating = toolCallSoFar && !toolCallSoFar.isDone;

	const currStreamingMessageHTML = isActivelyStreaming && (reasoningSoFar || displayContentSoFar)
		? <ChatBubble
			key={'curr-streaming-msg'}
			currCheckpointIdx={currCheckpointIdx}
			chatMessage={streamingChatMessage}
			messageIdx={streamingChatIdx}
			isCommitted={false}
			chatIsRunning={isRunning}
			threadId={threadId}
			_scrollToBottom={null}
		/>
		: null;

	const generatingTool = toolIsGenerating && (toolCallSoFar.name === 'edit_file' || toolCallSoFar.name === 'rewrite_file')
		? <EditToolSoFar key={'curr-streaming-tool'} toolCallSoFar={toolCallSoFar} />
		: null;

	return (
		<ScrollToBottomContainer
			key={'messages' + threadId}
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
			{previousMessagesHTML}
			{currStreamingMessageHTML}
			{generatingTool}

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
									<span className="text-void-fg-2">{currThreadStreamState.llmInfo.displayContentSoFar}</span>
									<IconLoading state="thinking" inline />
								</>
							) : isRunning === 'preparing' ? (
								<>
									<span className="text-void-fg-2">Preparing request</span>
									<IconLoading state="thinking" inline />
								</>
							) : (
								<>
									<span className="text-void-fg-2">Generating response</span>
									<IconLoading state="typing" inline />
								</>
							)}
						</div>
						<span className="text-xs text-void-fg-3 opacity-60">Press Escape to cancel</span>
					</div>
				</ProseWrapper>
			) : null}

			{(isRunning === 'LLM' || isRunning === 'preparing') && (displayContentSoFar || reasoningSoFar) ? (
				<p className="text-xs text-void-fg-3 opacity-60 mt-1" role="status">Press Escape to cancel</p>
			) : null}

			{latestError === undefined ? null : (
				<div className='px-2 my-1 message-enter space-y-2'>
					<ErrorDisplay
						message={latestError.message}
						fullError={latestError.fullError}
						onDismiss={() => { chatThreadsService.dismissStreamError(threadId); }}
						showDismiss={true}
					/>
					<p className="text-sm text-void-fg-3 px-1">
						You can try again or open settings to change the model.
					</p>
					<WarningBox className='text-sm my-1 mx-3' onClick={() => { commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID); }} text='Open settings' />
				</div>
			)}
		</ScrollToBottomContainer>
	);
};
