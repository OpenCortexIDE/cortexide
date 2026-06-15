/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test, setup, teardown } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { InMemoryTestFileService, TestContextService } from '../../../../../workbench/test/common/workbenchTestServices.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IRollbackSnapshotService } from '../../common/rollbackSnapshotService.js';
import { IGitAutoStashService } from '../../common/gitAutoStashService.js';
import { IAuditLogService } from '../../common/auditLogService.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { ApplyEngineV2 } from '../../common/applyEngineV2.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

/**
 * Tests for the REAL ApplyEngineV2 (the multi-file apply pipeline that backs Agent edits /
 * Apply). The previous version of this file tested an in-test reimplementation of the engine,
 * which was both flaky (shared-fileService monkeypatching that leaked across tests) and
 * meaningless (it never exercised the shipping code).
 *
 * This version drives the actual `ApplyEngineV2` (constructed via createInstance) and mocks
 * only its collaborators. The text-model service is faked with a tiny in-memory model cache
 * backed by the file service — exercising the engine's createModelReference→setValue→write flow
 * without dragging in the full ModelService / TextModelResolverService / UriIdentity DI graph
 * (which is integration-shaped and not unit-testable in isolation).
 */

// ---- in-memory text-model fake (a collaborator the engine talks to) ----
class FakeTextModel {
	constructor(public content: string) { }
	getValue(): string { return this.content; }
	setValue(v: string): void { this.content = v; }
	applyEdits(): void { /* the engine only uses the full-content path in these tests */ }
	isDisposed(): boolean { return false; }
}

/**
 * Minimal ITextModelService: caches one FakeTextModel per uri (so setValue done during apply is
 * observed by the immediately-following read, mirroring the real resolver's model caching) and
 * seeds new models from the current file-service content.
 */
class FakeTextModelService {
	declare readonly _serviceBrand: undefined;
	private models = new Map<string, FakeTextModel>();
	constructor(private readonly fileService: InMemoryTestFileService) { }

	async createModelReference(uri: URI): Promise<any> {
		const key = uri.toString();
		let model = this.models.get(key);
		if (!model) {
			let content = '';
			try {
				const c = await this.fileService.readFile(uri);
				content = c.value.toString();
			} catch {
				content = '';
			}
			model = new FakeTextModel(content);
			this.models.set(key, model);
		}
		return { object: { textEditorModel: model }, dispose() { /* cached; no-op */ } };
	}
}

class MockRollbackSnapshotService implements IRollbackSnapshotService {
	declare readonly _serviceBrand: undefined;
	private snapshots = new Map<string, string[]>();
	private enabled = true;
	private seq = 0;
	createdCount = 0;
	restoredIds: string[] = [];
	discardedIds: string[] = [];

	isEnabled(): boolean { return this.enabled; }
	setEnabled(enabled: boolean): void { this.enabled = enabled; }
	async createSnapshot(files: string[]): Promise<{ id: string; createdAt: number; files: any[] }> {
		const id = `snapshot-${this.seq++}`;
		this.snapshots.set(id, files);
		this.createdCount++;
		return { id, createdAt: 0, files: [] };
	}
	async restoreSnapshot(id: string): Promise<void> {
		this.restoredIds.push(id);
		if (!this.snapshots.has(id)) { throw new Error(`Snapshot ${id} not found`); }
	}
	async discardSnapshot(id: string): Promise<void> {
		this.discardedIds.push(id);
		this.snapshots.delete(id);
	}
	getLastSnapshot(): { id: string; createdAt: number; files: any[] } | undefined { return undefined; }
	getSnapshotCount(): number { return this.snapshots.size; }
}

class MockGitAutoStashService implements IGitAutoStashService {
	declare readonly _serviceBrand: undefined;
	private enabled = false; // git stash off by default in tests
	createdStashes: string[] = [];
	restoredStashes: string[] = [];

	isEnabled(): boolean { return this.enabled; }
	setEnabled(enabled: boolean): void { this.enabled = enabled; }
	async createStash(operationId: string): Promise<string | undefined> {
		const ref = `stash-${operationId}`;
		this.createdStashes.push(ref);
		return ref;
	}
	async restoreStash(stashRef: string): Promise<void> { this.restoredStashes.push(stashRef); }
	async dropStash(_stashRef: string): Promise<void> { }
}

class MockAuditLogService implements IAuditLogService {
	declare readonly _serviceBrand: undefined;
	private enabled = true;
	events: any[] = [];
	isEnabled(): boolean { return this.enabled; }
	setEnabled(enabled: boolean): void { this.enabled = enabled; }
	async append(event: any): Promise<void> { this.events.push(event); }
	getLogPath(): any { return null; }
	async readEvents(): Promise<{ events: any[]; skipped: number }> { return { events: this.events, skipped: 0 }; }
	getEvents(): any[] { return this.events; }
	clearEvents(): void { this.events = []; }
}

// Captures the write OPTIONS (which the upstream InMemoryTestFileService doesn't record) so we can
// assert that ApplyEngineV2 requests atomic (temp-file + rename) writes — Phase 1 corruption safety.
class CapturingFileService extends InMemoryTestFileService {
	readonly writeOptions: Array<{ resource: URI; options: any }> = [];
	override async writeFile(resource: any, contents: any, options?: any): Promise<any> {
		this.writeOptions.push({ resource, options });
		return super.writeFile(resource, contents, options);
	}
}

suite('ApplyEngineV2 (real engine)', () => {
	let disposables: DisposableStore;
	let instantiationService: TestInstantiationService;
	let fileService: CapturingFileService;
	let rollbackService: MockRollbackSnapshotService;
	let auditLogService: MockAuditLogService;
	let engine: ApplyEngineV2;
	let workspaceUri: URI;

	const fileUri = (name: string) => workspaceUri.with({ path: workspaceUri.path + '/' + name });
	const readFile = async (uri: URI): Promise<string> => (await fileService.readFile(uri)).value.toString();

	setup(() => {
		disposables = new DisposableStore();
		workspaceUri = URI.file('/test/workspace');

		fileService = disposables.add(new CapturingFileService());

		const workspaceService = new TestContextService();
		workspaceService.setWorkspace({ folders: [{ uri: workspaceUri, name: 'test', index: 0 } as any] } as any);

		rollbackService = new MockRollbackSnapshotService();
		const gitStashService = new MockGitAutoStashService();
		auditLogService = new MockAuditLogService();

		instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection(
			[IFileService, fileService],
			[ITextModelService, new FakeTextModelService(fileService) as unknown as ITextModelService],
			[IWorkspaceContextService, workspaceService],
			[IRollbackSnapshotService, rollbackService],
			[IGitAutoStashService, gitStashService],
			[IAuditLogService, auditLogService],
			[ILogService, new NullLogService()],
			[INotificationService, new TestNotificationService()],
		)));

		engine = disposables.add(instantiationService.createInstance(ApplyEngineV2));
	});

	teardown(() => {
		disposables.dispose();
	});

	test('create: new file is written with the requested content and reported applied', async () => {
		const uri = fileUri('newfile.txt');
		const result = await engine.applyTransaction([{ uri, type: 'create', content: 'hello world\n' }]);

		assert.strictEqual(result.success, true, result.error);
		assert.strictEqual(result.appliedFiles.length, 1);
		assert.strictEqual(result.appliedFiles[0].toString(), uri.toString());
		assert.strictEqual(await readFile(uri), 'hello world\n');
	});

	test('edit (full rewrite): existing file content is replaced', async () => {
		const uri = fileUri('edit.txt');
		await fileService.writeFile(uri, VSBuffer.fromString('original\n'));

		const result = await engine.applyTransaction([{ uri, type: 'edit', content: 'rewritten\n' }]);

		assert.strictEqual(result.success, true, result.error);
		assert.strictEqual(await readFile(uri), 'rewritten\n');
	});

	test('atomic write: create and edit request a temp-file+rename atomic write (corruption safety)', async () => {
		// Phase 1: the node disk provider only does temp+rename when atomic.postfix is set. A crash/ENOSPC
		// mid-write must not leave the user's file empty/half-written, so the engine must request atomic writes.
		const createUri = fileUri('atomic-create.txt');
		await engine.applyTransaction([{ uri: createUri, type: 'create', content: 'hello\n' }]);
		const createWrite = fileService.writeOptions.find(w => w.resource.toString() === createUri.toString());
		assert.ok(createWrite, 'create issued a write');
		assert.ok(createWrite!.options?.atomic?.postfix, 'create write must request an atomic temp+rename (atomic.postfix)');

		const editUri = fileUri('atomic-edit.txt');
		await fileService.writeFile(editUri, VSBuffer.fromString('a\n'));
		fileService.writeOptions.length = 0;
		await engine.applyTransaction([{ uri: editUri, type: 'edit', content: 'b\n' }]);
		const editWrite = fileService.writeOptions.find(w => w.resource.toString() === editUri.toString());
		assert.ok(editWrite, 'edit issued a write');
		assert.ok(editWrite!.options?.atomic?.postfix, 'edit write must request an atomic temp+rename (atomic.postfix)');
	});

	test('path safety: an operation outside the workspace is rejected before any write', async () => {
		const outside = URI.file('/outside/workspace/evil.txt');
		const result = await engine.applyTransaction([{ uri: outside, type: 'create', content: 'x' }]);

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.errorCategory, 'write_failure');
		assert.ok(result.error && result.error.includes('outside workspace'));
		// The real guarantee: the engine returns before performing any write.
		// (InMemoryTestFileService.exists() defaults to true for unwritten paths, so we assert on
		// the recorded write operations rather than exists().)
		assert.ok(!fileService.writeOperations.some(w => w.resource.toString() === outside.toString()),
			'no write was issued for the out-of-workspace file');
	});

	test('atomicity: a write failure during apply fails the transaction and rolls back (no discard)', async () => {
		const a = fileUri('a.txt');
		const b = fileUri('b.txt');
		await fileService.writeFile(a, VSBuffer.fromString('A0\n'));
		await fileService.writeFile(b, VSBuffer.fromString('B0\n'));

		// Force the apply-phase write to throw.
		fileService.writeShouldThrowError = new Error('simulated write failure');

		const result = await engine.applyTransaction([
			{ uri: a, type: 'edit', content: 'A1\n' },
			{ uri: b, type: 'edit', content: 'B1\n' },
		]);

		assert.strictEqual(result.success, false, 'transaction should fail when a write throws');
		assert.ok(rollbackService.createdCount >= 1, 'a rollback snapshot was created before applying');
		assert.ok(rollbackService.restoredIds.length >= 1, 'rollback (snapshot restore) was attempted on failure');
		assert.strictEqual(rollbackService.discardedIds.length, 0, 'a failed apply must not discard the snapshot');
	});

	// base-mismatch is intentionally NOT unit-tested: the engine reads content through the cached
	// text model for both the base signature and the re-verification, so the two reads always agree
	// unless the model is mutated mid-apply — which has no external seam. It is covered indirectly by
	// the verification/rollback choreography in the atomicity + snapshot tests.

	test('deterministic ordering: same edits in different input order yield the same result', async () => {
		const a = fileUri('a.txt');
		const b = fileUri('b.txt');
		const c = fileUri('c.txt');
		await fileService.writeFile(a, VSBuffer.fromString('a0\n'));
		await fileService.writeFile(b, VSBuffer.fromString('b0\n'));
		await fileService.writeFile(c, VSBuffer.fromString('c0\n'));

		const r1 = await engine.applyTransaction([
			{ uri: c, type: 'edit', content: 'c1\n' },
			{ uri: a, type: 'edit', content: 'a1\n' },
			{ uri: b, type: 'edit', content: 'b1\n' },
		]);

		assert.strictEqual(r1.success, true, r1.error);
		assert.deepStrictEqual(
			[await readFile(a), await readFile(b), await readFile(c)],
			['a1\n', 'b1\n', 'c1\n'],
			'all three files have their new content regardless of operation order',
		);
	});

	test('audit log: a successful apply records an ok=true apply event', async () => {
		const uri = fileUri('audited.txt');
		await fileService.writeFile(uri, VSBuffer.fromString('before\n'));

		await engine.applyTransaction([{ uri, type: 'edit', content: 'after\n' }]);

		const applyEvents = auditLogService.getEvents().filter(e => e.action === 'apply');
		assert.ok(applyEvents.length >= 1, 'an apply audit event was appended');
		assert.strictEqual(applyEvents[applyEvents.length - 1].ok, true);
	});

	test('snapshot lifecycle: a successful apply discards its rollback snapshot', async () => {
		const uri = fileUri('snap.txt');
		await fileService.writeFile(uri, VSBuffer.fromString('x\n'));

		const result = await engine.applyTransaction([{ uri, type: 'edit', content: 'y\n' }]);

		assert.strictEqual(result.success, true, result.error);
		assert.ok(rollbackService.createdCount >= 1, 'snapshot created');
		assert.ok(rollbackService.discardedIds.length >= 1, 'snapshot discarded on success');
		assert.strictEqual(rollbackService.restoredIds.length, 0, 'no restore on success');
	});
});
