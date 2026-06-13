/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure formatting/rotation decisions for the append-only audit log, extracted from AuditLogService so
 * they are node-testable (the file I/O stays in the service). The audit log is the tamper-evident record
 * of every dangerous action, so its on-disk shape (one JSON event per line) and rotation policy matter.
 */

/** Serialize a batch of events to JSONL: one compact JSON object per line, with a trailing newline. */
export function serializeEvents(events: readonly unknown[]): string {
	return events.map(e => JSON.stringify(e)).join('\n') + '\n';
}

/** Whether appending `addBytes` to a `currentFileSize`-byte log would exceed the rotation threshold. */
export function shouldRotate(currentFileSize: number, addBytes: number, rotationSizeMB: number): boolean {
	return currentFileSize + addBytes > rotationSizeMB * 1024 * 1024;
}

/**
 * The rotated file name for `audit.jsonl` -> `audit.<n>.jsonl[.gz]`. `compressed` adds the `.gz` suffix
 * (the service gzips when that is smaller). Only the trailing `.jsonl` is rewritten, so paths with dots
 * elsewhere are preserved. Mirrors the inline `path.replace(/\.jsonl$/, ...)` exactly.
 */
export function rotatedLogPath(jsonlPath: string, rotationNum: number, compressed: boolean): string {
	return jsonlPath.replace(/\.jsonl$/, `.${rotationNum}.jsonl${compressed ? '.gz' : ''}`);
}
