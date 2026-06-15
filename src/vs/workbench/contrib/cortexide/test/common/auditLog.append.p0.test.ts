/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { suite, test } from 'mocha';
import * as assert from 'assert';
import { serializeEvents, shouldRotate, rotatedLogPath, parseJsonl, formatAuditEvents, AuditEventLike } from '../../common/auditLogFormat.js';

/**
 * Real tests for the audit-log on-disk format + rotation policy that AuditLogService delegates to (was a
 * 3-test assert.ok(true) placeholder). The actual append/flush/file I/O needs the live file service (not
 * node-testable); the JSONL serialization + rotation decision + rotated-name format are pinned here.
 */

suite('auditLogFormat.serializeEvents', () => {

	test('one compact JSON object per line, trailing newline', () => {
		const out = serializeEvents([{ ts: 1, action: 'snapshot:create' }, { ts: 2, action: 'git:stash' }]);
		assert.strictEqual(out, '{"ts":1,"action":"snapshot:create"}\n{"ts":2,"action":"git:stash"}\n');
	});

	test('a single event still gets a trailing newline (append-safe)', () => {
		assert.strictEqual(serializeEvents([{ a: 1 }]), '{"a":1}\n');
		// each batch ending in \n means concatenating batches keeps one event per line
		assert.ok(serializeEvents([{ a: 1 }]).endsWith('\n'));
	});

	test('the serialized form round-trips back to the events via parseJsonl', () => {
		const events = [{ ts: 1, action: 'x', meta: { n: 5 } }, { ts: 2, action: 'y' }];
		const parsed = parseJsonl(serializeEvents(events));
		assert.deepStrictEqual(parsed.events, events);
		assert.strictEqual(parsed.skipped, 0);
	});
});

suite('auditLogFormat.parseJsonl', () => {

	test('empty content -> no events, nothing skipped', () => {
		assert.deepStrictEqual(parseJsonl(''), { events: [], skipped: 0 });
		assert.deepStrictEqual(parseJsonl('\n'), { events: [], skipped: 0 });
	});

	test('blank and whitespace-only lines are ignored, NOT counted as corrupt', () => {
		const content = '{"a":1}\n\n   \n{"b":2}\n';
		const parsed = parseJsonl(content);
		assert.deepStrictEqual(parsed.events, [{ a: 1 }, { b: 2 }]);
		assert.strictEqual(parsed.skipped, 0);
	});

	test('a truncated trailing line (crash mid-append) is skipped; every prior event survives', () => {
		// serializeEvents output, then a partial JSON object appended with NO trailing newline.
		const content = serializeEvents([{ ts: 1, action: 'snapshot:create' }, { ts: 2, action: 'git:stash' }]) + '{"ts":3,"action":"run_co';
		const parsed = parseJsonl(content);
		assert.deepStrictEqual(parsed.events, [{ ts: 1, action: 'snapshot:create' }, { ts: 2, action: 'git:stash' }]);
		assert.strictEqual(parsed.skipped, 1);
	});

	test('a corrupt line in the MIDDLE is skipped while later valid lines still parse', () => {
		const content = '{"ts":1}\nNOT JSON\n{"ts":2}\n';
		const parsed = parseJsonl(content);
		assert.deepStrictEqual(parsed.events, [{ ts: 1 }, { ts: 2 }]);
		assert.strictEqual(parsed.skipped, 1);
	});

	test('parseJsonl is the exact inverse of serializeEvents over a batch (golden round-trip)', () => {
		const events = [
			{ ts: 100, action: 'edit', file: 'a/b.ts', risk: 'low' },
			{ ts: 101, action: 'run_command', cmd: 'rm -rf node_modules', approved: true },
			{ ts: 102, action: 'snapshot:rollback', n: 3 },
		];
		const parsed = parseJsonl(serializeEvents(events));
		assert.deepStrictEqual(parsed.events, events);
		assert.strictEqual(parsed.skipped, 0);
	});
});

suite('auditLogFormat.shouldRotate', () => {

	test('rotates only when current + add EXCEEDS the MB threshold (strict >)', () => {
		const mb = 1; // 1 MB = 1048576 bytes
		assert.strictEqual(shouldRotate(0, 100, mb), false);
		assert.strictEqual(shouldRotate(1048576, 1, mb), true);          // 1048577 > 1048576
		assert.strictEqual(shouldRotate(1048576, 0, mb), false);         // exactly at == not >
		assert.strictEqual(shouldRotate(1048000, 1000, mb), true);       // 1049000 > 1048576
	});

	test('boundary: exactly filling the threshold does NOT rotate; one more byte does', () => {
		const mb = 2; // 2097152 bytes
		assert.strictEqual(shouldRotate(2097000, 152, mb), false); // == 2097152
		assert.strictEqual(shouldRotate(2097000, 153, mb), true);  // 2097153 > 2097152
	});
});

suite('auditLogFormat.rotatedLogPath', () => {

	test('audit.jsonl -> audit.<n>.jsonl (uncompressed) and audit.<n>.jsonl.gz (compressed)', () => {
		assert.strictEqual(rotatedLogPath('/ws/.cortexide/audit.jsonl', 1, false), '/ws/.cortexide/audit.1.jsonl');
		assert.strictEqual(rotatedLogPath('/ws/.cortexide/audit.jsonl', 3, true), '/ws/.cortexide/audit.3.jsonl.gz');
	});

	test('only the trailing .jsonl is rewritten; dots earlier in the path are preserved', () => {
		assert.strictEqual(rotatedLogPath('/a.b/c.d/audit.jsonl', 2, false), '/a.b/c.d/audit.2.jsonl');
	});
});

suite('auditLogFormat.formatAuditEvents', () => {

	test('empty log renders a clear "nothing recorded" report', () => {
		const out = formatAuditEvents([], 0);
		assert.ok(out.startsWith('CortexIDE Audit Log -- 0 events'));
		assert.ok(out.includes('No audit events recorded yet.'));
	});

	test('an event renders an ISO timestamp, status, action, and present fields only', () => {
		const ev: AuditEventLike = {
			ts: Date.parse('2026-06-15T10:00:00.000Z'),
			action: 'apply',
			ok: true,
			model: 'qwen2.5-coder:7b',
			files: ['a.ts', 'b.ts'],
			diffStats: { linesAdded: 5, linesRemoved: 2, hunks: 1 },
			latencyMs: 120,
		};
		const out = formatAuditEvents([ev], 0);
		assert.ok(out.includes('2026-06-15T10:00:00.000Z  OK   apply'));
		assert.ok(out.includes('model=qwen2.5-coder:7b'));
		assert.ok(out.includes('files=a.ts,b.ts'));
		assert.ok(out.includes('+5/-2 (1 hunk)'));
		assert.ok(out.includes('120ms'));
	});

	test('a failed event is marked ERR; absent optional fields are omitted', () => {
		const ev: AuditEventLike = { ts: Date.parse('2026-06-15T11:00:00.000Z'), action: 'rollback', ok: false };
		const out = formatAuditEvents([ev], 0);
		assert.ok(out.includes('ERR  rollback'));
		assert.ok(!out.includes('model='));
		assert.ok(!out.includes('files='));
		assert.ok(!out.includes('ms'));
	});

	test('skipped (corrupt/truncated) lines are surfaced in the header', () => {
		const out = formatAuditEvents([{ ts: 0, action: 'prompt', ok: true }], 2);
		assert.ok(out.includes('CortexIDE Audit Log -- 1 event'));
		assert.ok(out.includes('(2 corrupt/truncated lines skipped)'));
	});

	test('round-trips: serializeEvents -> parseJsonl -> formatAuditEvents covers every event', () => {
		const events: AuditEventLike[] = [
			{ ts: Date.parse('2026-06-15T09:00:00.000Z'), action: 'prompt', ok: true },
			{ ts: Date.parse('2026-06-15T09:00:01.000Z'), action: 'apply', ok: true, files: ['x.ts'] },
		];
		const parsed = parseJsonl(serializeEvents(events));
		const out = formatAuditEvents(parsed.events as AuditEventLike[], parsed.skipped);
		assert.ok(out.includes('CortexIDE Audit Log -- 2 events'));
		assert.ok(out.includes('prompt'));
		assert.ok(out.includes('apply'));
		assert.ok(out.includes('files=x.ts'));
	});
});
