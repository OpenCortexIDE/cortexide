/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The pure byte-budget for rollback snapshots, extracted from RollbackSnapshotService so it is
 * node-testable (the service's file/model reads are not). A snapshot must not grow without bound, so
 * files are included greedily in order until one would push the running total over maxBytes; the rest are
 * skipped (the snapshot is marked `skipped`). The service reads each file's content, then applies this.
 */

export interface SnapshotFile {
	path: string;
	content: string;
	mtime: number;
}

export interface SnapshotPlan {
	included: SnapshotFile[];
	totalBytes: number;
	/** true iff some file did not fit under the budget (the rest were skipped). */
	skipped: boolean;
}

/** UTF-8 byte length of a file's content (the unit the budget is measured in). */
export function snapshotFileBytes(content: string): number {
	return new TextEncoder().encode(content).length;
}

/**
 * Greedily include `files` in order until one would push the running byte total over `maxBytes`; that
 * file and everything after it are skipped. Mirrors the old inline streaming loop byte-for-byte.
 */
export function planSnapshot(files: readonly SnapshotFile[], maxBytes: number): SnapshotPlan {
	const included: SnapshotFile[] = [];
	let totalBytes = 0;
	let skipped = false;
	for (const file of files) {
		const fileBytes = snapshotFileBytes(file.content);
		if (totalBytes + fileBytes > maxBytes) {
			skipped = true;
			break;
		}
		included.push(file);
		totalBytes += fileBytes;
	}
	return { included, totalBytes, skipped };
}
