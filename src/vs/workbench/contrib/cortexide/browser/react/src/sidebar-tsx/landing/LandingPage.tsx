/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { ReactNode, RefObject } from 'react';
import { useMemo } from 'react';
import { FileAccess } from '../../../../../../../base/common/network.js';
import ErrorBoundary from '../ErrorBoundary.js';
import { PastThreadsList } from '../SidebarThreadSelector.js';
import { ContextChipsBar } from './ContextChipsBar.js';
import { QuickActionsBar } from './QuickActionsBar.js';
import { SuggestedPrompts } from './SuggestedPrompts.js';

export type LandingPageProps = {
	sidebarRef: RefObject<HTMLDivElement | null>;
	inputSection: ReactNode;
	showPreviousThreads: boolean;
	suggestionsLabel: string;
	previousThreadsLabel: string;
	onSubmitPrompt: (text: string) => void;
};

export const LandingPage = ({
	sidebarRef,
	inputSection,
	showPreviousThreads,
	suggestionsLabel,
	previousThreadsLabel,
	onSubmitPrompt,
}: LandingPageProps) => {
	const logoUri = useMemo(
		() => FileAccess.asBrowserUri('vs/workbench/browser/media/cortexide-main.png').toString(true),
		[],
	);

	return (
		<div
			ref={sidebarRef}
			className='w-full h-full max-h-full flex flex-col overflow-auto px-3'
		>
			<div className='flex flex-col items-center pt-6 pb-2 gap-1'>
				<div className='w-20 h-20 rounded-full overflow-hidden' style={{ border: '2px solid var(--vscode-focusBorder, rgba(88,101,242,0.8))', boxShadow: '0 0 16px var(--vscode-focusBorder, rgba(88,101,242,0.4)), 0 4px 20px rgba(0,0,0,0.5)' }}>
					<img
						src={logoUri}
						alt='CortexIDE'
						className='w-full h-full object-cover'
					/>
				</div>
				<span className='text-xs text-void-fg-3 tracking-widest uppercase'>CortexIDE</span>
			</div>

			<ErrorBoundary>
				{inputSection}
			</ErrorBoundary>

			<ErrorBoundary>
				<ContextChipsBar />
			</ErrorBoundary>

			<ErrorBoundary>
				<QuickActionsBar />
			</ErrorBoundary>

			{showPreviousThreads ? (
				<ErrorBoundary>
					<div className='pt-6 mb-2 text-void-fg-3 text-root select-none pointer-events-none'>{previousThreadsLabel}</div>
					<PastThreadsList />
				</ErrorBoundary>
			) : (
				<ErrorBoundary>
					<div className='pt-6 mb-2 text-void-fg-3 text-root select-none pointer-events-none'>{suggestionsLabel}</div>
					<SuggestedPrompts onSubmit={onSubmitPrompt} />
				</ErrorBoundary>
			)}
		</div>
	);
};
