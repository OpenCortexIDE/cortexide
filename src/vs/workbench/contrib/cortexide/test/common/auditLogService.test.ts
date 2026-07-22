/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { AuditLogService, AuditEvent } from '../../common/auditLogService.js';
import { serializeEvents } from '../../common/auditLogFormat.js';

/**
 * First service-level coverage for AuditLogService (previously only the pure auditLogFormat module
 * was tested). Pins the corruption fix: the whole-file rewrite MUST go through an ATOMIC write
 * (temp + rename) so a crash mid-write cannot truncate or corrupt the entire audit trail. Also
 * checks the append->read round-trip and crash-truncated-tail tolerance end-to-end via an
 * in-memory file service.
 */

const LOG_PATH = '/tmp/cortexide-audit-test/audit.jsonl';

type WriteCall = { path: string; options: any };

class FakeFileService {
	private readonly _store = new Map<string, VSBuffer>();
	readonly writeCalls: WriteCall[] = [];

	// Directly seed file content (simulate prior content / a crash-truncated file).
	seed(uri: URI, content: string) { this._store.set(uri.toString(), VSBuffer.fromString(content)); }

	async createFolder(_uri: URI) { return undefined as any; }
	async exists(uri: URI) { return this._store.has(uri.toString()); }
	async stat(uri: URI) {
		const b = this._store.get(uri.toString());
		if (!b) { throw new Error('ENOENT'); }
		return { size: b.byteLength } as any;
	}
	async readFile(uri: URI) {
		const b = this._store.get(uri.toString());
		if (!b) { throw new Error('ENOENT'); }
		return { value: b } as any;
	}
	async writeFile(uri: URI, content: VSBuffer, options?: any) {
		this.writeCalls.push({ path: uri.toString(), options });
		this._store.set(uri.toString(), content);
		return undefined as any;
	}
	onDidChangeConfiguration() { return { dispose() { } }; }
}

function makeService(fs: FakeFileService): AuditLogService {
	const config = {
		getValue(key: string) {
			switch (key) {
				case 'cortexide.audit.enable': return true;
				case 'cortexide.audit.path': return LOG_PATH;
				case 'cortexide.audit.rotationSizeMB': return 10;
				default: return undefined;
			}
		},
		onDidChangeConfiguration() { return { dispose() { } }; },
	};
	const workspace = { getWorkspace() { return { folders: [] }; } };
	const env = { workspaceStorageHome: URI.file('/tmp/cortexide-audit-test/storage') };
	const log = { error() { }, warn() { }, info() { }, debug() { }, trace() { } };
	return new AuditLogService(fs as any, workspace as any, config as any, env as any, log as any);
}

const ev = (action: AuditEvent['action'], ok = true): AuditEvent => ({ ts: 1700000000000, action, ok });

suite('AuditLogService (atomic append)', () => {

	test('append + readEvents round-trips the event', async () => {
		const fs = new FakeFileService();
		const svc = makeService(fs);
		await svc.append(ev('prompt'));
		const { events, skipped } = await svc.readEvents();
		assert.strictEqual(skipped, 0);
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].action, 'prompt');
		svc.dispose();
	});

	test('the log write is ATOMIC (temp + rename) -- the corruption fix', async () => {
		const fs = new FakeFileService();
		const svc = makeService(fs);
		await svc.append(ev('apply'));
		await svc.readEvents(); // forces the flush/write
		const logWrites = fs.writeCalls.filter(c => c.path === URI.file(LOG_PATH).toString());
		assert.ok(logWrites.length >= 1, 'the log file must have been written');
		for (const w of logWrites) {
			assert.ok(w.options && w.options.atomic && typeof w.options.atomic.postfix === 'string',
				'every audit-log write must pass { atomic: { postfix } } so a crash cannot corrupt the whole file');
		}
		svc.dispose();
	});

	test('successive appends accumulate (no lost events)', async () => {
		const fs = new FakeFileService();
		const svc = makeService(fs);
		await svc.append(ev('prompt'));
		await svc.readEvents();
		await svc.append(ev('reply'));
		const { events } = await svc.readEvents();
		assert.deepStrictEqual(events.map(e => e.action), ['prompt', 'reply']);
		svc.dispose();
	});

	test('a crash-truncated trailing line is skipped; prior events survive', async () => {
		const fs = new FakeFileService();
		const svc = makeService(fs);
		// One valid serialized event line, then a partial JSON object with no newline (mid-crash write).
		const valid = serializeEvents([ev('prompt')]);
		fs.seed(URI.file(LOG_PATH), valid + '{"ts":1700000000001,"action":"reply"');
		const { events, skipped } = await svc.readEvents();
		assert.strictEqual(events.length, 1, 'the complete prior event survives');
		assert.strictEqual(events[0].action, 'prompt');
		assert.ok(skipped >= 1, 'the truncated tail line is reported as skipped');
		svc.dispose();
	});
});
