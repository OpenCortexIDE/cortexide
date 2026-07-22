/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useState } from 'react';
import { useAccessor } from '../../util/services.js';
import { ChatMarkdownRender, ChatMessageLocation } from '../../markdown/ChatMarkdownRender.js';
import { ChatMessage } from '../../../../common/chatThreadServiceTypes.js';
import { IconLoading, TypingCursor } from '../shared/icons.js';
import { ToolChildrenWrapper } from '../tools/ToolPrimitives.js';
import { ToolHeaderWrapper } from '../tools/ToolHeader.js';

export const SmallProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div className='
text-void-fg-4
prose
prose-sm
break-words
max-w-none
leading-snug
text-[13px]

[&>:first-child]:!mt-0
[&>:last-child]:!mb-0

prose-h1:text-[14px]
prose-h1:my-4

prose-h2:text-[13px]
prose-h2:my-4

prose-h3:text-[13px]
prose-h3:my-3

prose-h4:text-[13px]
prose-h4:my-2

prose-p:my-2
prose-p:leading-snug
prose-hr:my-2

prose-ul:my-2
prose-ul:pl-4
prose-ul:list-outside
prose-ul:list-disc
prose-ul:leading-snug


prose-ol:my-2
prose-ol:pl-4
prose-ol:list-outside
prose-ol:list-decimal
prose-ol:leading-snug

marker:text-inherit

prose-blockquote:pl-2
prose-blockquote:my-2

prose-code:text-void-fg-3
prose-code:text-[12px]
prose-code:before:content-none
prose-code:after:content-none

prose-pre:text-[12px]
prose-pre:p-2
prose-pre:my-2

prose-table:text-[13px]
'>
		{children}
	</div>
}

export const ProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div className='
text-void-fg-2
prose
prose-sm
break-words
prose-p:block
prose-hr:my-4
prose-pre:my-2
marker:text-inherit
prose-ol:list-outside
prose-ol:list-decimal
prose-ul:list-outside
prose-ul:list-disc
prose-li:my-0
prose-code:before:content-none
prose-code:after:content-none
prose-headings:prose-sm
prose-headings:font-bold

prose-p:leading-normal
prose-ol:leading-normal
prose-ul:leading-normal

max-w-none
'
	>
		{children}
	</div>
}
export const AssistantMessageComponent = React.memo(({ chatMessage, isCheckpointGhost, isCommitted, messageIdx }: { chatMessage: ChatMessage & { role: 'assistant' }, isCheckpointGhost: boolean, messageIdx: number, isCommitted: boolean }) => {

	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')

	const reasoningStr = chatMessage.reasoning?.trim() || null
	const hasReasoning = !!reasoningStr
	const isDoneReasoning = !!chatMessage.displayContent
	const thread = chatThreadsService.getCurrentThread()


	const chatMessageLocation: ChatMessageLocation = useMemo(() => ({
		threadId: thread.id,
		messageIdx: messageIdx,
	}), [thread.id, messageIdx])

	const isEmpty = !chatMessage.displayContent && !chatMessage.reasoning
	if (isEmpty) return null

	return <>
		{/* reasoning token */}
		{hasReasoning &&
			<div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
				<ReasoningWrapper isDoneReasoning={isDoneReasoning} isStreaming={!isCommitted}>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={reasoningStr}
							chatMessageLocation={chatMessageLocation}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ReasoningWrapper>
			</div>
		}

		{/* assistant message */}
		{chatMessage.displayContent &&
			<div
				className={`${isCheckpointGhost ? 'opacity-50' : ''} ${!isCommitted ? 'streaming-content-chunk' : ''}`}
				role={!isCommitted ? "status" : undefined}
				aria-live={!isCommitted ? "polite" : undefined}
				aria-atomic={!isCommitted ? "false" : undefined}
			>
				<ProseWrapper>
					<ChatMarkdownRender
						string={chatMessage.displayContent || ''}
						chatMessageLocation={chatMessageLocation}
						isApplyEnabled={true}
						isLinkDetectionEnabled={true}
					/>
					{!isCommitted && <TypingCursor className="text-void-fg-2" aria-label="Streaming content" />}
				</ProseWrapper>
			</div>
		}
	</>

}, (prev, next) => {
	// Custom comparison: only re-render if message content, checkpoint state, or committed state changes
	return prev.chatMessage.displayContent === next.chatMessage.displayContent &&
		prev.chatMessage.reasoning === next.chatMessage.reasoning &&
		prev.isCheckpointGhost === next.isCheckpointGhost &&
		prev.isCommitted === next.isCommitted &&
		prev.messageIdx === next.messageIdx
})

export const ReasoningWrapper = ({ isDoneReasoning, isStreaming, children }: { isDoneReasoning: boolean, isStreaming: boolean, children: React.ReactNode }) => {
	const isDone = isDoneReasoning || !isStreaming
	const isWriting = !isDone
	const [isOpen, setIsOpen] = useState(isWriting)
	useEffect(() => {
		if (!isWriting) setIsOpen(false) // if just finished reasoning, close
	}, [isWriting])
	return <ToolHeaderWrapper title='Reasoning' desc1={isWriting ? <IconLoading state="thinking" inline /> : ''} isOpen={isOpen} onClick={() => setIsOpen(v => !v)}>
		<ToolChildrenWrapper>
			<div className='!select-text cursor-auto'>
				{children}
			</div>
		</ToolChildrenWrapper>
	</ToolHeaderWrapper>
}




// should either be past or "-ing" tense, not present tense. Eg. when the LLM searches for something, the user expects it to say "I searched for X" or "I am searching for X". Not "I search X".

