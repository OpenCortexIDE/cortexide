/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure parsing for git stash refs, extracted from GitAutoStashService (its restoreStash/dropStash both
 * parsed `stash@{N}` inline, identically) so it is node-testable and lives in one place.
 */

/**
 * Parse the index out of a git stash ref like "stash@{2}". Returns 0 (the latest stash) when the ref is
 * absent or unparseable -- mirrors the old inline `match ? parseInt(match[1], 10) : 0` exactly.
 */
export function parseStashIndex(stashRef: string): number {
	const match = stashRef.match(/stash@\{(\d+)\}/);
	return match ? parseInt(match[1], 10) : 0;
}
