/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { CommandBarInChat } from './CommandBarInChat.js';
import { ContextUsageBar } from './ContextUsageBar.js';
import { ComposerInputArea, ComposerInputAreaProps } from './ComposerInputArea.js';
import { ModelSelection } from '../../../../common/cortexideSettingsTypes.js';

type ComposerInputSectionProps = ComposerInputAreaProps & {
	variant: 'landing' | 'thread';
	threadKey?: string;
	modelSel: ModelSelection | null | undefined;
	contextTotal: number;
	contextBudget: number;
	contextPct: number;
};

export const ComposerInputSection = ({
	variant,
	threadKey,
	modelSel,
	contextTotal,
	contextBudget,
	contextPct,
	...inputProps
}: ComposerInputSectionProps) => {
	const inputArea = <ComposerInputArea {...inputProps} />;
	const contextBar = modelSel ? (
		<ContextUsageBar
			className={variant === 'landing' ? 'mt-1 px-2' : 'mt-1'}
			contextTotal={contextTotal}
			contextBudget={contextBudget}
			contextPct={contextPct}
		/>
	) : null;

	if (variant === 'thread') {
		return (
			<div key={'input' + (threadKey ?? '')}>
				<div className='px-4'>
					<CommandBarInChat />
				</div>
				<div className='px-2 pb-2'>
					{inputArea}
					{contextBar}
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className='pt-8'>
				{inputArea}
				{contextBar}
			</div>
		</div>
	);
};
