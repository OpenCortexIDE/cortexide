/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/** Extract @reference tokens from chat input (quoted paths first, then bare @word tokens). */
export const extractAtReferenceTokens = (userMessage: string): string[] => {
	const tokens: string[] = [];
	const quoted = [...userMessage.matchAll(/@"([^"]+)"/g)].map(m => m[1]);
	tokens.push(...quoted);
	for (const m of userMessage.matchAll(/@([\w\.\-_/]+(?::[\w\d.-]+(?:-\d+)?)?)/g)) {
		const t = m[1];
		if (t) {
			tokens.push(t);
		}
	}
	return tokens;
};
