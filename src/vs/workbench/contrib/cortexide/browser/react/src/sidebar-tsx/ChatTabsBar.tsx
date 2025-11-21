/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react';
import { useAccessor, useChatThreadsState, useFullChatThreadsStreamState } from '../util/services.js';
import { IconX } from './SidebarChat.js';
import { X, LoaderCircle, MessageCircleQuestion } from 'lucide-react';
import { IsRunningType, ThreadType } from '../../../chatThreadService.js';
import { IconShell1 } from '../markdown/ApplyBlockHoverButtons.js';

// Get a short title for a thread (first user message or "New Chat")
const getThreadTitle = (thread: ThreadType | undefined): string => {
	if (!thread) return 'New Chat';
	const firstUserMsgIdx = thread.messages.findIndex((msg) => msg.role === 'user');
	if (firstUserMsgIdx !== -1) {
		const firstUserMsg = thread.messages[firstUserMsgIdx];
		if (firstUserMsg.role === 'user' && firstUserMsg.displayContent) {
			// Truncate to 30 characters
			const title = firstUserMsg.displayContent;
			return title.length > 30 ? title.substring(0, 30) + '...' : title;
		}
	}
	return 'New Chat';
};

interface ChatTabProps {
	threadId: string;
	isActive: boolean;
	onClick: () => void;
	onClose: (e: React.MouseEvent) => void;
	isRunning?: IsRunningType;
}

const ChatTab: React.FC<ChatTabProps> = ({ threadId, isActive, onClick, onClose, isRunning }) => {
	const threadsState = useChatThreadsState();
	const thread = threadsState.allThreads[threadId];
	const title = getThreadTitle(thread);

	return (
		<div
			className={`
				group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg border-b-2 transition-all duration-150 cursor-pointer
				${isActive
					? 'bg-void-bg-2 border-void-fg-1 text-void-fg-1'
					: 'bg-void-bg-1/40 border-transparent text-void-fg-2 hover:bg-void-bg-1/60 hover:text-void-fg-1'
				}
			`}
			onClick={onClick}
		>
			{/* Status icon */}
			{isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'preparing' ? (
				<LoaderCircle className="animate-spin text-void-fg-1 flex-shrink-0" size={12} />
			) : isRunning === 'awaiting_user' ? (
				<MessageCircleQuestion className="text-void-fg-1 flex-shrink-0" size={12} />
			) : null}

			{/* Title */}
			<span className="text-xs truncate max-w-[120px]" title={title}>
				{title}
			</span>

			{/* Close button */}
			<IconShell1
				Icon={X}
				className="size-[11px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
				onClick={(e) => {
					e.stopPropagation();
					onClose(e);
				}}
				data-tooltip-id='void-tooltip'
				data-tooltip-place='top'
				data-tooltip-content='Close tab'
			/>
		</div>
	);
};

export const ChatTabsBar: React.FC = () => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get('IChatThreadService');
	const threadsState = useChatThreadsState();
	const streamState = useFullChatThreadsStreamState();

	const { openTabs, currentThreadId } = threadsState;

	// Memoize running thread IDs
	const runningThreadIds = useMemo(() => {
		const result: { [threadId: string]: IsRunningType | undefined } = {};
		for (const threadId in streamState) {
			const isRunning = streamState[threadId]?.isRunning;
			if (isRunning) {
				result[threadId] = isRunning;
			}
		}
		return result;
	}, [streamState]);

	// Filter out tabs that no longer exist
	const validTabs = useMemo(() => {
		return openTabs.filter(threadId => threadsState.allThreads[threadId] !== undefined);
	}, [openTabs, threadsState.allThreads]);

	// If no tabs, don't show the bar
	if (validTabs.length === 0) {
		return null;
	}

	const handleTabClick = (threadId: string) => {
		chatThreadsService.switchToTab(threadId);
	};

	const handleTabClose = (threadId: string) => {
		chatThreadsService.closeTab(threadId);
	};

	const handleNewTab = () => {
		chatThreadsService.openNewThread();
	};

	return (
		<div className="flex items-end gap-1 px-2 pt-2 border-b border-void-border-3 bg-void-bg-1/30">
			<div className="flex items-end gap-1 overflow-x-auto flex-1 min-w-0">
				{validTabs.map((threadId) => (
					<ChatTab
						key={threadId}
						threadId={threadId}
						isActive={threadId === currentThreadId}
						onClick={() => handleTabClick(threadId)}
						onClose={() => handleTabClose(threadId)}
						isRunning={runningThreadIds[threadId]}
					/>
				))}
			</div>
			{/* New tab button */}
			<button
				className="px-2 py-1.5 rounded-t-lg bg-void-bg-1/40 hover:bg-void-bg-1/60 text-void-fg-2 hover:text-void-fg-1 transition-all duration-150 text-xs border-b-2 border-transparent hover:border-void-border-3 flex-shrink-0"
				onClick={handleNewTab}
				data-tooltip-id='void-tooltip'
				data-tooltip-place='top'
				data-tooltip-content='New chat tab'
			>
				+
			</button>
		</div>
	);
};

