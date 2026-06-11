/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { undoAgentFileOp, undoFileOpsAfterCheckpoint, FileOpIO, AgentFileOpRecord } from '../../common/agentFileOps.js';

// In-memory fake disk: files (path->content) + folders (set of paths).
function makeIO(initialFiles: Record<string, string> = {}, initialFolders: string[] = []) {
	const files = new Map<string, string>(Object.entries(initialFiles));
	const folders = new Set<string>(initialFolders);
	let throwOnWrite: string | undefined;
	const io: FileOpIO & { files: Map<string, string>; folders: Set<string>; failWritesTo(p: string): void } = {
		files, folders,
		failWritesTo(p: string) { throwOnWrite = p; },
		async exists(p) { return files.has(p) || folders.has(p); },
		async writeFileAtomic(p, content) { if (throwOnWrite === p) { throw new Error('simulated write failure'); } files.set(p, content); },
		async createFolder(p) { folders.add(p); },
		async del(p, _opts) { files.delete(p); folders.delete(p); },
		async readText(p) { const c = files.get(p); if (c === undefined) { throw new Error('not found'); } return c; },
	};
	return io;
}

const rec = (over: Partial<AgentFileOpRecord>): AgentFileOpRecord => ({
	checkpointIdx: 0, fsPath: '/ws/f.txt', opType: 'create', isFolder: false, existedBefore: false, beforeContent: null, ...over,
});

suite('Phase 1 #2 — durable agent file-op rollback (undoAgentFileOp)', () => {

	test('undo CREATE of a new file removes it', async () => {
		const io = makeIO({ '/ws/new.txt': 'AGENT WROTE THIS' });
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/new.txt', opType: 'create', existedBefore: false }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.action, 'removed');
		assert.strictEqual(io.files.has('/ws/new.txt'), false, 'created file must be gone after rollback');
	});

	test('undo CREATE that overwrote an existing file restores the prior content', async () => {
		const io = makeIO({ '/ws/x.txt': 'AGENT OVERWROTE' });
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/x.txt', opType: 'create', existedBefore: true, beforeContent: 'ORIGINAL' }));
		assert.strictEqual(r.action, 'restored');
		assert.strictEqual(io.files.get('/ws/x.txt'), 'ORIGINAL');
	});

	test('undo DELETE of a file RECREATES it with its prior content (no data loss)', async () => {
		const io = makeIO({}); // file was deleted by the agent
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/gone.txt', opType: 'delete', existedBefore: true, beforeContent: 'IMPORTANT DATA' }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.action, 'recreated');
		assert.strictEqual(io.files.get('/ws/gone.txt'), 'IMPORTANT DATA', 'deleted file must be recreated with its content');
	});

	test('undo DELETE of a folder recreates the folder', async () => {
		const io = makeIO({});
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/dir', opType: 'delete', isFolder: true, existedBefore: true, beforeContent: null }));
		assert.strictEqual(r.action, 'recreated');
		assert.strictEqual(io.folders.has('/ws/dir'), true);
	});

	test('a write failure during undo is reported (ok=false), not swallowed', async () => {
		const io = makeIO({});
		io.failWritesTo('/ws/gone.txt');
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/gone.txt', opType: 'delete', existedBefore: true, beforeContent: 'DATA' }));
		assert.strictEqual(r.ok, false);
		assert.ok(r.error && r.error.includes('simulated write failure'));
	});

	test('undo MODIFY restores the prior content (edit rollback on disk)', async () => {
		const io = makeIO({ '/ws/doc.txt': 'VERSION_TWO_EDITED' });
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/doc.txt', opType: 'modify', existedBefore: true, beforeContent: 'VERSION_ONE' }));
		assert.strictEqual(r.action, 'restored');
		assert.strictEqual(io.files.get('/ws/doc.txt'), 'VERSION_ONE');
	});

	test('undo MODIFY of a file the edit created (existed=false) removes it', async () => {
		const io = makeIO({ '/ws/doc.txt': 'EDIT_CREATED_THIS' });
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/doc.txt', opType: 'modify', existedBefore: false, beforeContent: null }));
		assert.strictEqual(r.action, 'removed');
		assert.strictEqual(io.files.has('/ws/doc.txt'), false);
	});

	test('sequential edits undo in reverse to the original content', async () => {
		// edit1: V1->V2 (before=V1), edit2: V2->V3 (before=V2). Undo both (reverse) -> V1.
		const io = makeIO({ '/ws/doc.txt': 'V3' });
		const journal: AgentFileOpRecord[] = [
			{ checkpointIdx: 1, fsPath: '/ws/doc.txt', opType: 'modify', isFolder: false, existedBefore: true, beforeContent: 'V1' },
			{ checkpointIdx: 1, fsPath: '/ws/doc.txt', opType: 'modify', isFolder: false, existedBefore: true, beforeContent: 'V2' },
		];
		const { results } = await undoFileOpsAfterCheckpoint(io, journal, 0);
		assert.strictEqual(results.length, 2);
		assert.strictEqual(io.files.get('/ws/doc.txt'), 'V1', 'reverse replay must land on the original content');
	});

	test('undo of a create whose file is already gone is a safe no-op success', async () => {
		const io = makeIO({});
		const r = await undoAgentFileOp(io, rec({ fsPath: '/ws/new.txt', opType: 'create', existedBefore: false }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.action, 'removed');
	});
});

suite('Phase 1 #2 — undoFileOpsAfterCheckpoint (rollback boundary + ordering)', () => {

	test('undoes only ops AFTER the target checkpoint, most-recent first', async () => {
		const io = makeIO({ '/ws/a.txt': 'A2', '/ws/b.txt': 'B1' });
		const journal: AgentFileOpRecord[] = [
			{ checkpointIdx: 1, fsPath: '/ws/keep.txt', opType: 'create', isFolder: false, existedBefore: false, beforeContent: null }, // before target -> keep
			{ checkpointIdx: 2, fsPath: '/ws/a.txt', opType: 'create', isFolder: false, existedBefore: true, beforeContent: 'A1' }, // after -> restore A1
			{ checkpointIdx: 3, fsPath: '/ws/b.txt', opType: 'delete', isFolder: false, existedBefore: true, beforeContent: 'B0' }, // after -> recreate B0
		];
		const { results, incomplete } = await undoFileOpsAfterCheckpoint(io, journal, 1);
		assert.strictEqual(incomplete, false);
		assert.strictEqual(results.length, 2, 'only the 2 ops after checkpoint 1 are undone');
		// b (idx 3) undone before a (idx 2)
		assert.strictEqual(results[0].fsPath, '/ws/b.txt');
		assert.strictEqual(results[1].fsPath, '/ws/a.txt');
		assert.strictEqual(io.files.get('/ws/a.txt'), 'A1');
		assert.strictEqual(io.files.get('/ws/b.txt'), 'B0');
		assert.strictEqual(io.files.has('/ws/keep.txt'), false, 'ops before the target are not touched');
	});

	test('incomplete=true when any file fails', async () => {
		const io = makeIO({});
		io.failWritesTo('/ws/x.txt');
		const journal: AgentFileOpRecord[] = [
			{ checkpointIdx: 2, fsPath: '/ws/x.txt', opType: 'delete', isFolder: false, existedBefore: true, beforeContent: 'X' },
		];
		const { incomplete } = await undoFileOpsAfterCheckpoint(io, journal, 0);
		assert.strictEqual(incomplete, true);
	});
});
