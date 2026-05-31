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
import { ApplyEngineV2, FileEditOperation } from '../../common/applyEngineV2.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { TextModelResolverService } from '../../../../../workbench/services/textmodelResolver/common/textModelResolverService.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ModelService } from '../../../../../editor/common/services/modelService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestTextResourcePropertiesService } from '../../../../../editor/test/common/services/testTextResourcePropertiesService.js';
import { ITextResourcePropertiesService } from '../../../../../editor/common/services/textResourceConfiguration.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestLanguageConfigurationService } from '../../../../../editor/test/common/modes/testLanguageConfigurationService.js';
import { ILanguageConfigurationService } from '../../../../../editor/common/languages/languageConfigurationRegistry.js';
import { LanguageService } from '../../../../../editor/common/services/languageService.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { UndoRedoService } from '../../../../../platform/undoRedo/common/undoRedoService.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

/**
 * Tests for the REAL ApplyEngineV2 (the multi-file apply pipeline that backs Agent edits /
 * Apply). The previous version of this file tested an in-test reimplementation of the engine,
 * which was both flaky (shared-fileService monkeypatching that leaked across tests) and
 * meaningless (it never exercised the shipping code). This version instantiates the actual
 * `ApplyEngineV2` class via createInstance with real ModelService / TextModelResolverService /
 * InMemoryTestFileService, and injects failures deterministically through
 * InMemoryTestFileService.writeShouldThrowError (no monkeypatching).
 */

// Minimal in-memory mocks for the rollback/stash/audit collaborators. They record calls so we
// can assert the engine's snapshot/rollback choreography without real git or disk snapshots.
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
	getEvents(): any[] { return this.events; }
	clearEvents(): void { this.events = []; }
}

suite('ApplyEngineV2 (real engine)', () => {
	let disposables: DisposableStore;
	let instantiationService: TestInstantiationService;
	let fileService: InMemoryTestFileService;
	let rollbackService: MockRollbackSnapshotService;
	let auditLogService: MockAuditLogService;
	let engine: ApplyEngineV2;
	let workspaceUri: URI;

	const fileUri = (name: string) => workspaceUri.with({ path: workspaceUri.path + '/' + name });

	/** Read current bytes of a file from the in-memory file service. */
	const readFile = async (uri: URI): Promise<string> => {
		const c = await fileService.readFile(uri);
		return c.value.toString();
	};

	setup(() => {
		disposables = new DisposableStore();
		workspaceUri = URI.file('/test/workspace');

		fileService = disposables.add(new InMemoryTestFileService());

		const workspaceService = new TestContextService();
		workspaceService.setWorkspace({ folders: [{ uri: workspaceUri, name: 'test', index: 0 } as any] } as any);

		rollbackService = new MockRollbackSnapshotService();
		const gitStashService = new MockGitAutoStashService();
		auditLogService = new MockAuditLogService();

		instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection(
			[IFileService, fileService],
			[IWorkspaceContextService, workspaceService],
			[IRollbackSnapshotService, rollbackService],
			[IGitAutoStashService, gitStashService],
			[IAuditLogService, auditLogService],
			[ILogService, new NullLogService()],
			[INotificationService, new TestNotificationService()],
			[IConfigurationService, new TestConfigurationService()],
			[ITextResourcePropertiesService, new TestTextResourcePropertiesService(new TestConfigurationService())],
			[IThemeService, new TestThemeService()],
			[ILanguageConfigurationService, disposables.add(new TestLanguageConfigurationService())],
			[ILanguageService, disposables.add(new LanguageService(false))],
			[IDialogService, new TestDialogService()],
			[IUndoRedoService, new UndoRedoService(new TestDialogService(), new TestNotificationService())],
		)));

		const modelService = disposables.add(instantiationService.createInstance(ModelService));
		instantiationService.stub(IModelService, modelService);
		const textModelService = disposables.add(instantiationService.createInstance(TextModelResolverService));
		instantiationService.stub(ITextModelService, textModelService);

		// The real engine, wired through the instantiation service.
		engine = disposables.add(instantiationService.createInstance(ApplyEngineV2));
	});

	teardown(() => {
		disposables.dispose();
	});

	test('create: new file is written with the requested content and reported applied', async () => {
		const uri = fileUri('newfile.txt');
		const ops: FileEditOperation[] = [{ uri, type: 'create', content: 'hello world\n' }];

		const result = await engine.applyTransaction(ops);

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

	test('path safety: an operation outside the workspace is rejected with write_failure', async () => {
		const outside = URI.file('/outside/workspace/evil.txt');
		const result = await engine.applyTransaction([{ uri: outside, type: 'create', content: 'x' }]);

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.errorCategory, 'write_failure');
		assert.ok(result.error && result.error.includes('outside workspace'));
		assert.strictEqual(await fileService.exists(outside), false, 'file outside workspace must not be created');
	});

	test('atomicity: when one file in a multi-file apply fails to write, the transaction fails and rolls back', async () => {
		const a = fileUri('a.txt');
		const b = fileUri('b.txt');
		await fileService.writeFile(a, VSBuffer.fromString('A0\n'));
		await fileService.writeFile(b, VSBuffer.fromString('B0\n'));

		// Make the next write fail (the engine writes during apply, after snapshots are taken).
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

	// base-mismatch is intentionally NOT unit-tested here: the engine reads file content
	// through the cached text model (createModelReference) for BOTH the base signature and the
	// re-verification, so the two reads always observe identical content unless the *model* is
	// mutated mid-apply — which cannot be done from outside the engine without an internal seam.
	// (An earlier attempt to fake it by overriding fileService.readFile silently did not run,
	// because the engine does not read through fileService when a model is resolvable.) The
	// rollback/verification choreography is covered by the atomicity and snapshot tests instead.

	test('deterministic ordering: applying the same edits in different input order yields the same result', async () => {
		const a = fileUri('a.txt');
		const b = fileUri('b.txt');
		const c = fileUri('c.txt');
		const seed = async () => {
			await fileService.writeFile(a, VSBuffer.fromString('a0\n'));
			await fileService.writeFile(b, VSBuffer.fromString('b0\n'));
			await fileService.writeFile(c, VSBuffer.fromString('c0\n'));
		};

		await seed();
		const r1 = await engine.applyTransaction([
			{ uri: c, type: 'edit', content: 'c1\n' },
			{ uri: a, type: 'edit', content: 'a1\n' },
			{ uri: b, type: 'edit', content: 'b1\n' },
		]);
		const after1 = [await readFile(a), await readFile(b), await readFile(c)];

		await seed();
		const r2 = await engine.applyTransaction([
			{ uri: a, type: 'edit', content: 'a1\n' },
			{ uri: b, type: 'edit', content: 'b1\n' },
			{ uri: c, type: 'edit', content: 'c1\n' },
		]);
		const after2 = [await readFile(a), await readFile(b), await readFile(c)];

		assert.strictEqual(r1.success, true, r1.error);
		assert.strictEqual(r2.success, true, r2.error);
		assert.deepStrictEqual(after1, after2, 'final content is independent of input order');
		assert.deepStrictEqual(after1, ['a1\n', 'b1\n', 'c1\n']);
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
