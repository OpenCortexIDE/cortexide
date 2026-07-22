/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

const MAX_TAB_LABEL = 32;

/** Minimal thread shape for tab labels (no browser service import). */
export type ThreadLabelSource = {
	messages: { role: string; displayContent?: string }[];
};

/** Short label for composer tabs and headers (first user message or "New chat"). */
export const getThreadTabLabel = (thread: ThreadLabelSource | undefined): string => {
	if (!thread) {
		return 'New chat';
	}
	const firstUserIdx = thread.messages.findIndex(m => m.role === 'user');
	if (firstUserIdx === -1) {
		return 'New chat';
	}
	const msg = thread.messages[firstUserIdx];
	if (msg.role !== 'user') {
		return 'New chat';
	}
	const text = (msg.displayContent || '').trim().replace(/\s+/g, ' ');
	if (!text) {
		return 'New chat';
	}
	if (text.length <= MAX_TAB_LABEL) {
		return text;
	}
	return `${text.slice(0, MAX_TAB_LABEL - 1)}…`;
};
