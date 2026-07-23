/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { useAccessor } from '../../util/services.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';

const QUICK_ACTIONS: { id: string; label: string }[] = [
	{ id: 'void.explainCode', label: 'Explain' },
	{ id: 'void.refactorCode', label: 'Refactor' },
	{ id: 'void.addTests', label: 'Add Tests' },
	{ id: 'void.fixTests', label: 'Fix Tests' },
	{ id: 'void.writeDocstring', label: 'Docstring' },
	{ id: 'void.optimizeCode', label: 'Optimize' },
	{ id: 'void.debugCode', label: 'Debug' },
];

export const QuickActionsBar = () => {
	const accessor = useAccessor();
	const commandService = accessor.get('ICommandService') as ICommandService;
	const keybindingService = accessor.get('IKeybindingService');

	return (
		<div className='w-full flex items-center justify-center gap-2 flex-wrap mt-3 select-none px-1'>
			{QUICK_ACTIONS.map(({ id, label }) => {
				const kb = keybindingService.lookupKeybinding(id)?.getLabel();
				return (
					<button
						key={id}
						className='px-3 py-1.5 rounded-full bg-gradient-to-br from-[var(--cortex-surface-2)] via-[var(--cortex-surface-3)] to-[var(--cortex-surface-4)] border border-void-border-3 text-xs text-void-fg-1 shadow-[0_3px_12px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all duration-150 ease-out void-focus-ring'
						onClick={() => commandService.executeCommand(id)}
						title={kb ? `${label} (${kb})` : label}
					>
						<span>{label}</span>
						{kb && <span className='ml-1 px-1 rounded bg-[var(--vscode-keybindingLabel-background)] text-[var(--vscode-keybindingLabel-foreground)] border border-[var(--vscode-keybindingLabel-border)]'>{kb}</span>}
					</button>
				);
			})}
		</div>
	);
};
