/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { planSnapshot } from './snapshotBudget.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAuditLogService } from './auditLogService.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export interface FileSnapshot {
	path: string;
	content: string;
	mtime: number;
}

export interface Snapshot {
	id: string;
	createdAt: number;
	files: FileSnapshot[];
	skipped?: boolean;
}

export const IRollbackSnapshotService = createDecorator<IRollbackSnapshotService>('rollbackSnapshotService');

export interface IRollbackSnapshotService {
	readonly _serviceBrand: undefined;
	isEnabled(): boolean;
	createSnapshot(files: string[]): Promise<Snapshot>;
	restoreSnapshot(id: string): Promise<void>;
	discardSnapshot(id: string): Promise<void>;
	getLastSnapshot(): Snapshot | undefined;
}

class RollbackSnapshotService extends Disposable implements IRollbackSnapshotService {
	declare readonly _serviceBrand: undefined;

	private _enabled = false;
	private _maxSnapshotBytes = 5_000_000;
	private _snapshots = new Map<string, Snapshot>();
	private _lastSnapshotId: string | undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@IAuditLogService private readonly _auditLogService: IAuditLogService,
	) {
		super();
		this._updateConfiguration();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cortexide.safety.rollback')) {
				this._updateConfiguration();
			}
		}));
	}

	private _updateConfiguration(): void {
		this._enabled = this._configurationService.getValue<boolean>('cortexide.safety.rollback.enable') ?? false;
		this._maxSnapshotBytes = this._configurationService.getValue<number>('cortexide.safety.rollback.maxSnapshotBytes') ?? 5_000_000;
	}

	isEnabled(): boolean {
		return this._enabled;
	}

	async createSnapshot(files: string[]): Promise<Snapshot> {
		if (!this._enabled) {
			throw new Error('Rollback snapshot service is disabled');
		}

		const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		// Read each file's current content (dirty buffer first, else disk), then apply the byte budget.
		const readFiles: FileSnapshot[] = [];
		for (const filePath of files) {
			const uri = URI.file(filePath);
			try {
				// Try to read from buffer (dirty editor) first, else disk
				let content: string;
				let mtime: number;

				const modelRef = await this._textModelService.createModelReference(uri);
				try {
					const textModel = modelRef.object.textEditorModel;
					if (textModel && !textModel.isDisposed()) {
						// Check if model is dirty by comparing with file content
						// For simplicity, we'll always read from model if available, else from disk
						content = textModel.getValue();
						mtime = Date.now(); // Use current time for model content
					} else {
						const stat = await this._fileService.stat(uri);
						const fileContent = await this._fileService.readFile(uri);
						content = fileContent.value.toString();
						mtime = stat.mtime;
					}
				} finally {
					modelRef.dispose();
				}

				readFiles.push({ path: filePath, content, mtime });
			} catch (error) {
				this._logService.warn(`[RollbackSnapshot] Failed to snapshot ${filePath}:`, error);
				// Continue with other files
			}
		}

		// Greedy byte budget (pure, tested -- common/snapshotBudget.ts): include files in order until one
		// would exceed maxSnapshotBytes, then skip the rest. The included set + skipped flag are identical
		// to the old streaming loop (only difference: a past-budget file may have been read before exclusion).
		const plan = planSnapshot(readFiles, this._maxSnapshotBytes);
		if (plan.skipped) {
			this._logService.warn(`[RollbackSnapshot] Snapshot exceeded max size, skipping remaining files`);
		}

		const snapshot: Snapshot = {
			id: snapshotId,
			createdAt: Date.now(),
			files: plan.included,
			skipped: plan.skipped,
		};

		this._snapshots.set(snapshotId, snapshot);
		this._lastSnapshotId = snapshotId;

		// Audit log
		if (this._auditLogService.isEnabled()) {
			await this._auditLogService.append({
				ts: Date.now(),
				action: 'snapshot:create',
				files: plan.included.map(f => f.path),
				ok: true,
				meta: {
					snapshotId,
					bytes: plan.totalBytes,
					skipped: plan.skipped,
				},
			});
		}

		return snapshot;
	}

	async restoreSnapshot(id: string): Promise<void> {
		const snapshot = this._snapshots.get(id);
		if (!snapshot) {
			throw new Error(`Snapshot ${id} not found`);
		}

		try {
			for (const fileSnap of snapshot.files) {
				const uri = URI.file(fileSnap.path);
				try {
					// Write to both buffer (if open) and disk
					const modelRef = await this._textModelService.createModelReference(uri);
					try {
						const textModel = modelRef.object.textEditorModel;
						if (textModel && !textModel.isDisposed()) {
							textModel.setValue(fileSnap.content);
						}
					} finally {
						modelRef.dispose();
					}

					// Also write to disk
					await this._fileService.writeFile(uri, VSBuffer.fromString(fileSnap.content));
				} catch (error) {
					this._logService.error(`[RollbackSnapshot] Failed to restore ${fileSnap.path}:`, error);
					// Continue with other files
				}
			}

			// Audit log
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'snapshot:restore',
					files: snapshot.files.map(f => f.path),
					ok: true,
					meta: { snapshotId: id },
				});
			}
		} catch (error) {
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'snapshot:restore',
					ok: false,
					meta: { snapshotId: id, error: String(error) },
				});
			}
			throw error;
		}
	}

	async discardSnapshot(id: string): Promise<void> {
		this._snapshots.delete(id);
		if (this._lastSnapshotId === id) {
			this._lastSnapshotId = undefined;
		}

		if (this._auditLogService.isEnabled()) {
			await this._auditLogService.append({
				ts: Date.now(),
				action: 'snapshot:discard',
				ok: true,
				meta: { snapshotId: id },
			});
		}
	}

	getLastSnapshot(): Snapshot | undefined {
		return this._lastSnapshotId ? this._snapshots.get(this._lastSnapshotId) : undefined;
	}
}

registerSingleton(IRollbackSnapshotService, RollbackSnapshotService, InstantiationType.Delayed);

