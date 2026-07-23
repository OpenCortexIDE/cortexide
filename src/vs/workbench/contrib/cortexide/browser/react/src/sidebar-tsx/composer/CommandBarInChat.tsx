/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useCommandBarState } from '../../util/services.js';
import { IconShell1, StatusIndicator } from '../../markdown/ApplyBlockHoverButtons.js';
import { getBasename, voidOpenFileFn } from '../shared/pathUtils.js';

export const CommandBarInChat = () => {
	const { stateOfURI: commandBarStateOfURI, sortedURIs: sortedCommandBarURIs } = useCommandBarState();
	const numFilesChanged = sortedCommandBarURIs.length;

	const accessor = useAccessor();
	const editCodeService = accessor.get('IEditCodeService');
	const chatThreadsState = useChatThreadsState();
	const commandBarState = useCommandBarState();
	const chatThreadsStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId);

	const [fileDetailsOpenedState, setFileDetailsOpenedState] = useState<'auto-opened' | 'auto-closed' | 'user-opened' | 'user-closed'>('auto-closed');
	const isFileDetailsOpened = fileDetailsOpenedState === 'auto-opened' || fileDetailsOpenedState === 'user-opened';

	useEffect(() => {
		if (numFilesChanged === 0) {
			setFileDetailsOpenedState('auto-closed');
		}
		if (numFilesChanged > 0 && fileDetailsOpenedState !== 'user-closed') {
			setFileDetailsOpenedState('auto-opened');
		}
	}, [fileDetailsOpenedState, setFileDetailsOpenedState, numFilesChanged]);

	const isFinishedMakingThreadChanges = (
		commandBarState.sortedURIs.length !== 0
		&& commandBarState.sortedURIs.every(uri => !commandBarState.stateOfURI[uri.fsPath]?.isStreaming)
	);

	const threadStatus = (
		chatThreadsStreamState?.isRunning === 'awaiting_user'
			? { title: 'Needs Approval', color: 'yellow' } as const
			: (chatThreadsStreamState?.isRunning === 'LLM' || chatThreadsStreamState?.isRunning === 'tool' || chatThreadsStreamState?.isRunning === 'preparing')
				? { title: chatThreadsStreamState?.isRunning === 'preparing' ? 'Preparing' : 'Running', color: 'orange' } as const
				: { title: 'Done', color: 'dark' } as const
	);

	const threadStatusHTML = <StatusIndicator className='mx-1' indicatorColor={threadStatus.color} title={threadStatus.title} />;

	const numFilesChangedStr = numFilesChanged === 0 ? 'No files with changes'
		: `${sortedCommandBarURIs.length} file${numFilesChanged === 1 ? '' : 's'} with changes`;

	const acceptRejectAllButtons = <div
		className={`flex items-center gap-0.5
			${isFinishedMakingThreadChanges ? '' : 'opacity-0 pointer-events-none'}`
		}
	>
		<IconShell1
			Icon={X}
			aria-label='Reject all file changes'
			onClick={() => {
				sortedCommandBarURIs.forEach(uri => {
					editCodeService.acceptOrRejectAllDiffAreas({
						uri,
						removeCtrlKs: true,
						behavior: 'reject',
						_addToHistory: true,
					});
				});
			}}
			data-tooltip-id='cortex-tooltip'
			data-tooltip-place='top'
			data-tooltip-content='Reject all'
		/>

		<IconShell1
			Icon={Check}
			aria-label='Accept all file changes'
			onClick={() => {
				sortedCommandBarURIs.forEach(uri => {
					editCodeService.acceptOrRejectAllDiffAreas({
						uri,
						removeCtrlKs: true,
						behavior: 'accept',
						_addToHistory: true,
					});
				});
			}}
			data-tooltip-id='cortex-tooltip'
			data-tooltip-place='top'
			data-tooltip-content='Accept all'
		/>
	</div>;

	const fileDetailsContent = <div className="px-2 gap-1 w-full overflow-y-auto">
		{sortedCommandBarURIs.map((uri) => {
			const basename = getBasename(uri.fsPath);

			const { sortedDiffIds, isStreaming } = commandBarStateOfURI[uri.fsPath] ?? {};
			const isFinishedMakingFileChanges = !isStreaming;

			const numDiffs = sortedDiffIds?.length || 0;

			const fileStatus = (isFinishedMakingFileChanges
				? { title: 'Done', color: 'dark' } as const
				: { title: 'Running', color: 'orange' } as const
			);

			const fileNameHTML = <button
				type='button'
				className="flex items-center gap-1.5 text-void-fg-3 hover:brightness-125 transition-all duration-200 cursor-pointer bg-transparent border-0 p-0"
				onClick={() => voidOpenFileFn(uri, accessor)}
				aria-label={`Open ${basename}`}
			>
				<span className="text-void-fg-3">{basename}</span>
			</button>;

			const detailsContent = <div className='flex px-4'>
				<span className="text-void-fg-3 opacity-80">{numDiffs} diff{numDiffs !== 1 ? 's' : ''}</span>
			</div>;

			const acceptRejectButtons = <div
				className={`flex items-center gap-0.5
					${isFinishedMakingFileChanges ? '' : 'opacity-0 pointer-events-none'}
				`}
			>
				<IconShell1
					Icon={X}
					aria-label={`Reject changes in ${basename}`}
					onClick={() => { editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: 'reject', _addToHistory: true }); }}
					data-tooltip-id='cortex-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Reject file'
				/>
				<IconShell1
					Icon={Check}
					aria-label={`Accept changes in ${basename}`}
					onClick={() => { editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: 'accept', _addToHistory: true }); }}
					data-tooltip-id='cortex-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Accept file'
				/>
			</div>;

			const fileStatusHTML = <StatusIndicator className='mx-1' indicatorColor={fileStatus.color} title={fileStatus.title} />;

			return (
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
			);
		})}
	</div>;

	const fileDetailsButton = (
		<button
			className={`flex items-center gap-1 rounded ${numFilesChanged === 0 ? 'cursor-pointer' : 'cursor-pointer hover:brightness-125 transition-all duration-200'}`}
			onClick={() => isFileDetailsOpened ? setFileDetailsOpenedState('user-closed') : setFileDetailsOpenedState('user-opened')}
			type='button'
			disabled={numFilesChanged === 0}
			aria-expanded={isFileDetailsOpened}
			aria-label={isFileDetailsOpened ? 'Hide file change details' : 'Show file change details'}
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
	);

	return (
		<>
			<div className='px-2'>
				<div
					className={`
						select-none cortex-tool-header-bar text-nowrap
						overflow-hidden transition-all duration-200 ease-in-out
						${isFileDetailsOpened ? 'max-h-24' : 'max-h-0'}
					`}
				>
					{fileDetailsContent}
				</div>
			</div>
			<div className="select-none cortex-tool-header-bar text-nowrap px-2 py-1 justify-between">
				<div className="flex gap-2 items-center">
					{fileDetailsButton}
				</div>
				<div className="flex gap-2 items-center">
					{acceptRejectAllButtons}
					{threadStatusHTML}
				</div>
			</div>
		</>
	);
};
