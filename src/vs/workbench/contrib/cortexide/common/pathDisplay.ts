/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/** Display helpers for file paths in chat UI (pure — no workspace services). */

export const getFolderName = (pathStr: string) => {
	pathStr = pathStr.replace(/[/\\]+/g, '/')
	const parts = pathStr.split('/')
	const nonEmptyParts = parts.filter(part => part.length > 0)
	if (nonEmptyParts.length === 0) return '/'
	if (nonEmptyParts.length === 1) return nonEmptyParts[0] + '/'
	const lastTwo = nonEmptyParts.slice(-2)
	return lastTwo.join('/') + '/'
}

export const getBasename = (pathStr: string, parts: number = 1) => {
	pathStr = pathStr.replace(/[/\\]+/g, '/')
	const allParts = pathStr.split('/')
	if (allParts.length === 0) return pathStr
	return allParts.slice(-parts).join('/')
}
