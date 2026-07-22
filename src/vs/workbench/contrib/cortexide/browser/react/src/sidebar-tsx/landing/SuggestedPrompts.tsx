/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

const DEFAULT_PROMPTS = [
	'Summarize my codebase',
	'How do types work in Rust?',
	'Create a .voidrules file for me',
];

export const SuggestedPrompts = ({ onSubmit }: { onSubmit: (text: string) => void }) => (
	<div className='flex flex-col gap-2 w-full text-nowrap select-none'>
		{DEFAULT_PROMPTS.map((text, index) => (
			<button
				key={index}
				type="button"
				className='btn btn-sm btn-secondary cortex-prompt-chip w-full text-left py-1 px-2 text-sm opacity-90 hover:opacity-100 void-focus-ring'
				onClick={() => onSubmit(text)}
			>
				{text}
			</button>
		))}
	</div>
);
