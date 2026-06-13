/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { serializeEvents, shouldRotate, rotatedLogPath } from './auditLogFormat.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export interface AuditEvent {
	ts: number;
	user?: string;
	action: 'prompt' | 'reply' | 'diff_preview' | 'apply' | 'undo' | 'rollback' | 'snapshot:create' | 'snapshot:restore' | 'snapshot:discard' | 'git:stash' | 'git:stash:restore';
	files?: string[];
	diffStats?: { linesAdded: number; linesRemoved: number; hunks: number };
	model?: string;
	latencyMs?: number;
	ok: boolean;
	meta?: Record<string, any>;
}

export const IAuditLogService = createDecorator<IAuditLogService>('auditLogService');

export interface IAuditLogService {
	readonly _serviceBrand: undefined;
	append(event: AuditEvent): Promise<void>;
	isEnabled(): boolean;
}

class AuditLogService extends Disposable implements IAuditLogService {
	declare readonly _serviceBrand: undefined;

	private _enabled = false;
	private _logPath: URI | null = null;
	private _pendingWrites: AuditEvent[] = [];
	private _writeScheduler: RunOnceScheduler;
	private _rotationSizeMB: number = 10;
	private _currentFileSize: number = 0;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IEnvironmentService private readonly _environmentService: IEnvironmentService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._writeScheduler = this._register(new RunOnceScheduler(() => this._flushWrites(), 100));
		this._updateConfiguration();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cortexide.audit')) {
				this._updateConfiguration();
			}
		}));
	}

	private _updateConfiguration(): void {
		this._enabled = this._configurationService.getValue<boolean>('cortexide.audit.enable') ?? false;
		const customPath = this._configurationService.getValue<string>('cortexide.audit.path');
		this._rotationSizeMB = this._configurationService.getValue<number>('cortexide.audit.rotationSizeMB') ?? 10;

		if (!this._enabled) {
			this._logPath = null;
			return;
		}

		if (customPath) {
			this._logPath = URI.file(customPath);
		} else {
			const workspace = this._workspaceContextService.getWorkspace();
			if (workspace.folders.length > 0) {
				this._logPath = joinPath(workspace.folders[0].uri, '.cortexide', 'audit.jsonl');
			} else {
				this._logPath = joinPath(this._environmentService.workspaceStorageHome, 'audit.jsonl');
			}
		}

		// Initialize log file if needed
		this._initializeLogFile().catch(err => {
			this._logService.error('[AuditLog] Failed to initialize log file:', err);
		});
	}

	isEnabled(): boolean {
		return this._enabled;
	}

	async append(event: AuditEvent): Promise<void> {
		if (!this._enabled || !this._logPath) {
			return;
		}

		this._pendingWrites.push(event);
		this._writeScheduler.schedule();
	}

	private async _initializeLogFile(): Promise<void> {
		if (!this._logPath) return;

		const parentDir = this._logPath.with({ path: this._logPath.path.replace(/\/[^/]*$/, '') });
		try {
			await this._fileService.createFolder(parentDir);
		} catch {
			// Folder might already exist
		}

		// Check current file size
		try {
			const stat = await this._fileService.stat(this._logPath);
			this._currentFileSize = stat.size;
		} catch {
			// File doesn't exist yet, will be created on first write
			this._currentFileSize = 0;
		}
	}

	private async _flushWrites(): Promise<void> {
		if (this._pendingWrites.length === 0 || !this._logPath) {
			return;
		}

		const events = this._pendingWrites.splice(0);
		const lines = serializeEvents(events); // pure, tested -- common/auditLogFormat.ts
		const buffer = VSBuffer.fromString(lines);
		const sizeBytes = buffer.byteLength;

		// Check if rotation needed
		if (shouldRotate(this._currentFileSize, sizeBytes, this._rotationSizeMB)) {
			await this._rotateLogFile();
		}

		try {
			// Append to file (non-blocking)
			// Read existing content and append
			let existingContent = VSBuffer.fromString('');
			try {
				const existing = await this._fileService.readFile(this._logPath);
				existingContent = existing.value;
			} catch {
				// File doesn't exist yet, that's fine
			}
			const combined = VSBuffer.concat([existingContent, buffer]);
			await this._fileService.writeFile(this._logPath, combined);
			this._currentFileSize += sizeBytes;
		} catch (err) {
			this._logService.error('[AuditLog] Failed to write audit log:', err);
		}
	}

	private async _rotateLogFile(): Promise<void> {
		if (!this._logPath) return;

		try {
			// Read current file
			const content = await this._fileService.readFile(this._logPath);
			const contentBuffer = content.value.buffer;

			// Compress with gzip (using Node.js zlib, available in Electron main process)
			// For browser context, we'll skip compression and just rotate
			let compressed: Buffer;
			try {
				const zlib = await import('zlib');
				const { promisify: promisifyNode } = await import('util');
				const gzip = promisifyNode(zlib.gzip);
				compressed = await gzip(Buffer.from(contentBuffer));
			} catch {
				// zlib not available (browser context), use uncompressed
				compressed = Buffer.from(contentBuffer);
			}

			// Find next rotation number
			let rotationNum = 1;
			let rotatedPath: URI;
			do {
				const compressedSmaller = compressed.length < contentBuffer.byteLength;
				rotatedPath = this._logPath.with({ path: rotatedLogPath(this._logPath.path, rotationNum, compressedSmaller) });
				rotationNum++;
			} while (await this._fileService.exists(rotatedPath));

			// Write compressed file
			await this._fileService.writeFile(rotatedPath, VSBuffer.wrap(compressed));

			// Create new empty log file
			await this._fileService.writeFile(this._logPath, VSBuffer.fromString(''));
			this._currentFileSize = 0;

			this._logService.debug(`[AuditLog] Rotated log file to ${rotatedPath.path}`);
		} catch (err) {
			this._logService.error('[AuditLog] Failed to rotate log file:', err);
		}
	}
}

registerSingleton(IAuditLogService, AuditLogService, InstantiationType.Delayed);

