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

export interface ParsedJsonl {
	readonly events: unknown[];
	/**
	 * Count of non-blank lines that failed JSON.parse -- i.e. a truncated or corrupt line. The audit log is
	 * append-only and can be cut mid-write by a crash, so the LAST line is the usual culprit.
	 */
	readonly skipped: number;
}

/**
 * The read-side inverse of serializeEvents(): parse an audit JSONL document back into events, one JSON
 * object per line. Blank/whitespace-only lines are ignored (serializeEvents always ends in a trailing
 * newline). A non-blank line that fails JSON.parse is SKIPPED and counted, never thrown -- a single
 * truncated trailing line (crash mid-append) must not lose the whole tamper-evident log. Recovery-oriented:
 * every well-formed line before the corruption is still returned. The deferred audit-view/export consumes
 * this; the file read itself stays in AuditLogService.
 */
export function parseJsonl(content: string): ParsedJsonl {
	const events: unknown[] = [];
	let skipped = 0;
	for (const line of content.split('\n')) {
		if (line.trim() === '') { continue; }
		try {
			events.push(JSON.parse(line));
		} catch {
			skipped++;
		}
	}
	return { events, skipped };
}

/** The structural subset of an audit event the human-readable view renders (matches AuditEvent). */
export interface AuditEventLike {
	readonly ts: number;
	readonly action: string;
	readonly ok: boolean;
	readonly user?: string;
	readonly files?: readonly string[];
	readonly model?: string;
	readonly latencyMs?: number;
	readonly diffStats?: { readonly linesAdded: number; readonly linesRemoved: number; readonly hunks: number };
}

/**
 * Render the audit events as a readable, copy-able text report (for the "Show Audit Log" view). Pure +
 * node-testable: timestamps are formatted from the event's epoch-ms `ts` (ISO-8601, deterministic), one
 * aligned line per event oldest-first, with a header that surfaces any skipped (corrupt/truncated) lines.
 */
export function formatAuditEvents(events: readonly AuditEventLike[], skipped: number): string {
	const lines: string[] = [];
	lines.push(`CortexIDE Audit Log -- ${events.length} event${events.length === 1 ? '' : 's'}`);
	if (skipped > 0) {
		lines.push(`(${skipped} corrupt/truncated line${skipped === 1 ? '' : 's'} skipped)`);
	}
	lines.push('');
	if (events.length === 0) {
		lines.push('No audit events recorded yet.');
		return lines.join('\n') + '\n';
	}
	for (const e of events) {
		const when = new Date(e.ts).toISOString();
		const status = e.ok ? 'OK ' : 'ERR';
		const parts: string[] = [`${when}  ${status}  ${e.action}`];
		if (e.model) { parts.push(`model=${e.model}`); }
		if (e.files && e.files.length > 0) { parts.push(`files=${e.files.join(',')}`); }
		if (e.diffStats) { parts.push(`+${e.diffStats.linesAdded}/-${e.diffStats.linesRemoved} (${e.diffStats.hunks} hunk${e.diffStats.hunks === 1 ? '' : 's'})`); }
		if (typeof e.latencyMs === 'number') { parts.push(`${e.latencyMs}ms`); }
		if (e.user) { parts.push(`user=${e.user}`); }
		lines.push(parts.join('  '));
	}
	return lines.join('\n') + '\n';
}
