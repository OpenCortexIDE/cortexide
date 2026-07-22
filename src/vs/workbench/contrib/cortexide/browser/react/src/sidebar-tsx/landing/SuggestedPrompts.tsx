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
	<div className='flex flex-col gap-2 w-full text-nowrap text-void-fg-3 select-none'>
		{DEFAULT_PROMPTS.map((text, index) => (
			<div
				key={index}
				className='py-1 px-2 rounded text-sm bg-zinc-700/5 hover:bg-zinc-700/10 dark:bg-zinc-300/5 dark:hover:bg-zinc-300/10 cursor-pointer opacity-80 hover:opacity-100'
				onClick={() => onSubmit(text)}
			>
				{text}
			</div>
		))}
	</div>
);
