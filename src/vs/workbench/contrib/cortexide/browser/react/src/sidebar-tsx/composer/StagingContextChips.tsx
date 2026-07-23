/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { StagingSelectionItem } from '../../../../common/chatThreadServiceTypes.js';

type StagingContextChipsProps = {
	selections: StagingSelectionItem[];
	onRemoveAt: (index: number) => void;
};

export const StagingContextChips = ({ selections, onRemoveAt }: StagingContextChipsProps) => {
	if (selections.length === 0) {
		return null;
	}

	return (
		<div className='mt-1 flex flex-wrap gap-1 px-1'>
			{selections.map((sel, idx) => {
				const name = sel.type === 'Folder'
					? (sel.uri?.path?.split('/').filter(Boolean).pop() || 'folder')
					: (sel.uri?.path?.split('/').pop() || 'file');
				const fullPath = sel.uri?.fsPath || sel.uri?.path || name;
				const rangeLabel = (sel as { range?: { startLineNumber: number; endLineNumber: number } }).range
					? ` • ${(sel as { range: { startLineNumber: number; endLineNumber: number } }).range.startLineNumber}-${(sel as { range: { startLineNumber: number; endLineNumber: number } }).range.endLineNumber}`
					: '';
				const tooltipText = (sel as { range?: { startLineNumber: number; endLineNumber: number } }).range
					? `${fullPath} (lines ${(sel as { range: { startLineNumber: number; endLineNumber: number } }).range.startLineNumber}-${(sel as { range: { startLineNumber: number; endLineNumber: number } }).range.endLineNumber})`
					: fullPath;
				return (
					<span
						key={idx}
						className='inline-flex items-center gap-1 px-2 py-0.5 rounded border border-void-border-3 bg-void-bg-1 text-void-fg-2 text-[11px]'
						title={tooltipText}
						aria-label={tooltipText}
					>
						<span className='opacity-80'>{sel.type === 'Folder' ? 'Folder' : 'File'}</span>
						<span className='text-void-fg-1'>{name}</span>
						{rangeLabel && <span className='opacity-70'>{rangeLabel}</span>}
						<button
							type="button"
							className='btn btn-icon btn-ghost ml-1 text-void-fg-3 hover:text-void-fg-1'
							onClick={() => onRemoveAt(idx)}
							aria-label={`Remove ${name}`}
						>
							×
						</button>
					</span>
				);
			})}
		</div>
	);
};
