/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { useAccessor, useSettingsState } from '../../util/services.js';

export const ContextChipsBar = () => {
	const accessor = useAccessor();
	const settingsState = useSettingsState();
	const editorService = accessor.get('IEditorService');
	const activeEditor = editorService?.activeEditor;
	const activeResource = activeEditor?.resource;
	const activeFileLabel = activeResource ? activeResource.path?.split('/').pop() : undefined;
	const modelSel = settingsState.modelSelectionOfFeature['Chat'];
	const modelLabel = modelSel ? `${modelSel.providerName}:${modelSel.modelName}` : undefined;

	if (!activeFileLabel && !modelLabel) {
		return null;
	}

	return (
		<div className='w-full flex items-center gap-2 flex-wrap mt-2 mb-1 px-1'>
			{activeFileLabel && (
				<span className='inline-flex items-center gap-1 px-2 py-0.5 rounded border border-void-border-3 bg-void-bg-1 text-void-fg-2 text-[11px]'>
					<span>File</span>
					<span className='text-void-fg-1'>{activeFileLabel}</span>
				</span>
			)}
			{modelLabel && (
				<span className='inline-flex items-center gap-1 px-2 py-0.5 rounded border border-void-border-3 bg-void-bg-1 text-void-fg-2 text-[11px]'>
					<span>Model</span>
					<span className='text-void-fg-1'>{modelLabel}</span>
				</span>
			)}
		</div>
	);
};
