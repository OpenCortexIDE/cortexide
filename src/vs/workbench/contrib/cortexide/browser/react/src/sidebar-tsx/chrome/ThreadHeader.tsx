/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { History, Settings2 } from 'lucide-react';
import { useAccessor, useChatThreadsState } from '../../util/services.js';
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from '../../../cortexideSettingsPane.js';
import { getThreadTabLabel } from '../../../../common/threadTitle.js';

type ThreadHeaderProps = {
	showHistory: boolean;
	onToggleHistory: () => void;
};

export const ThreadHeader = ({ showHistory, onToggleHistory }: ThreadHeaderProps) => {
	const accessor = useAccessor();
	const commandService = accessor.get('ICommandService');
	const chatThreadsService = accessor.get('IChatThreadService');
	const { currentThreadId, allThreads } = useChatThreadsState();

	const thread = allThreads[currentThreadId];
	const title = getThreadTabLabel(thread);
	const hasHistory = Object.keys(allThreads).some(
		id => (allThreads[id]?.messages.length ?? 0) > 0,
	);

	return (
		<div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-void-border-3/50 shrink-0 min-h-[32px]">
			<span className="text-xs font-medium text-void-fg-2 truncate min-w-0" title={title}>
				{title}
			</span>
			<div className="flex items-center gap-1 shrink-0">
				{hasHistory && (
					<button
						type="button"
						className={`p-1.5 rounded-md void-focus-ring ${showHistory ? 'bg-void-bg-1 text-void-fg-1' : 'text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1/60'}`}
						aria-label="Toggle chat history"
						aria-pressed={showHistory}
						title="Chat history"
						onClick={onToggleHistory}
					>
						<History className="size-3.5" />
					</button>
				)}
				<button
					type="button"
					className="px-2 py-1 rounded-md text-xs text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-1 void-focus-ring"
					onClick={() => chatThreadsService.openNewThread()}
				>
					New chat
				</button>
				<button
					type="button"
					className="p-1.5 rounded-md text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1 void-focus-ring"
					aria-label="Open CortexIDE settings"
					title="Settings"
					onClick={() => commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID)}
				>
					<Settings2 className="size-3.5" />
				</button>
			</div>
		</div>
	);
};
