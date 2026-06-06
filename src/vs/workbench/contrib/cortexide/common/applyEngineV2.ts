/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { EndOfLinePreference } from '../../../../editor/common/model.js';
import { IRollbackSnapshotService } from './rollbackSnapshotService.js';
import { IGitAutoStashService } from './gitAutoStashService.js';
import { IAuditLogService } from './auditLogService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize } from '../../../../nls.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
// Using Web Crypto API for cross-platform compatibility

/**
 * Base signature for a file - used for pre-apply verification
 */
export interface FileBaseSignature {
	uri: URI;
	hash: string; // SHA-256 hash of file content
	isDirty: boolean; // true if content came from editor buffer, false if from disk
}

/**
 * Expected result after applying edits
 */
export interface ExpectedFileResult {
	uri: URI;
	expectedHash: string; // SHA-256 hash of expected final content
}

/**
 * File edit operation
 */
export interface FileEditOperation {
	uri: URI;
	type: 'edit' | 'create' | 'delete';
	content?: string; // new content for edit/create
	textEdits?: Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }>; // for edit operations
}

/**
 * Apply transaction result
 */
export interface ApplyTransactionResult {
	success: boolean;
	appliedFiles: URI[];
	failedFile?: URI;
	error?: string;
	errorCategory?: 'base_mismatch' | 'hunk_apply_failure' | 'write_failure' | 'verification_failure';
}

export const IApplyEngineV2 = createDecorator<IApplyEngineV2>('applyEngineV2');

export interface IApplyEngineV2 {
	readonly _serviceBrand: undefined;
	applyTransaction(operations: FileEditOperation[], options?: { operationId?: string }): Promise<ApplyTransactionResult>;
}

/**
 * Computes SHA-256 hash of content using Web Crypto API
 */
async function computeHash(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalizes line endings to LF for consistent hashing
 */
function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export class ApplyEngineV2 extends Disposable implements IApplyEngineV2 {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@IRollbackSnapshotService private readonly _rollbackService: IRollbackSnapshotService,
		@IGitAutoStashService private readonly _gitStashService: IGitAutoStashService,
		@IAuditLogService private readonly _auditLogService: IAuditLogService,
		@IWorkspaceContextService private readonly _workspaceService: IWorkspaceContextService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService: INotificationService,
	) {
		super();
	}

	/**
	 * Validates that all URIs are within workspace
	 */
	private _validatePaths(uris: URI[]): { valid: boolean; invalid?: URI[] } {
		const invalid: URI[] = [];
		for (const uri of uris) {
			if (!this._workspaceService.isInsideWorkspace(uri)) {
				invalid.push(uri);
			}
		}
		return invalid.length === 0 ? { valid: true } : { valid: false, invalid };
	}

	/**
	 * Gets file content from editor buffer (if dirty) or disk
	 */
	private async _getFileContent(uri: URI): Promise<{ content: string; isDirty: boolean }> {
		try {
			const modelRef = await this._textModelService.createModelReference(uri);
			try {
				const textModel = modelRef.object.textEditorModel;
				if (textModel && !textModel.isDisposed()) {
					const content = textModel.getValue(EndOfLinePreference.LF);
					// Check if dirty by comparing with disk (simplified - assume dirty if model exists)
					// In practice, we'd check model.isDirty() but for safety we'll read both
					let diskContent: string | undefined;
					try {
						if (await this._fileService.exists(uri)) {
							const fileContent = await this._fileService.readFile(uri);
							diskContent = fileContent.value.toString();
						}
					} catch {
						// File doesn't exist on disk
					}
					const isDirty = diskContent === undefined || normalizeLineEndings(content) !== normalizeLineEndings(diskContent);
					return { content, isDirty };
				}
			} finally {
				modelRef.dispose();
			}
		} catch {
			// Model not available, read from disk
		}

		// Read from disk
		if (await this._fileService.exists(uri)) {
			const fileContent = await this._fileService.readFile(uri);
			return { content: fileContent.value.toString(), isDirty: false };
		}

		throw new Error(`File not found: ${uri.fsPath}`);
	}

	/**
	 * Computes base signature for a file
	 */
	private async _computeBaseSignature(uri: URI): Promise<FileBaseSignature> {
		const { content, isDirty } = await this._getFileContent(uri);
		const normalized = normalizeLineEndings(content);
		const hash = await computeHash(normalized);
		return { uri, hash, isDirty };
	}

	/**
	 * Verifies base signature matches current file state
	 */
	private async _verifyBaseSignature(signature: FileBaseSignature): Promise<boolean> {
		const current = await this._computeBaseSignature(signature.uri);
		return current.hash === signature.hash;
	}

	/**
	 * Applies text edits to content deterministically
	 */
	private _applyTextEdits(content: string, edits: Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }>): string {
		// Sort edits by start position (line, then column) descending to apply from end to start
		const sortedEdits = [...edits].sort((a, b) => {
			if (a.range.startLineNumber !== b.range.startLineNumber) {
				return b.range.startLineNumber - a.range.startLineNumber; // descending
			}
			return b.range.startColumn - a.range.startColumn; // descending
		});

		const lines = content.split('\n');
		for (const edit of sortedEdits) {
			const startLine = edit.range.startLineNumber - 1; // 0-indexed
			const endLine = edit.range.endLineNumber - 1;
			const startCol = edit.range.startColumn - 1; // 0-indexed
			const endCol = edit.range.endColumn - 1;

			if (startLine === endLine) {
				// Single line edit
				const line = lines[startLine] || '';
				lines[startLine] = line.substring(0, startCol) + edit.text + line.substring(endCol);
			} else {
				// Multi-line edit
				const firstLine = lines[startLine] || '';
				const lastLine = lines[endLine] || '';
				const newLines = edit.text.split('\n');
				const replacement = [
					firstLine.substring(0, startCol) + newLines[0],
					...newLines.slice(1, -1),
					newLines[newLines.length - 1] + lastLine.substring(endCol)
				];
				lines.splice(startLine, endLine - startLine + 1, ...replacement);
			}
		}
		return lines.join('\n');
	}

	/**
	 * Computes expected file result after applying operation
	 */
	private async _computeExpectedResult(operation: FileEditOperation, baseSignature: FileBaseSignature): Promise<ExpectedFileResult> {
		let finalContent: string;

		if (operation.type === 'delete') {
			throw new Error('Delete operations not yet supported in ApplyEngineV2');
		} else if (operation.type === 'create') {
			if (!operation.content) {
				throw new Error('Create operation requires content');
			}
			finalContent = normalizeLineEndings(operation.content);
		} else if (operation.type === 'edit') {
			const { content } = await this._getFileContent(operation.uri);
			if (operation.content) {
				// Full file rewrite
				finalContent = normalizeLineEndings(operation.content);
			} else if (operation.textEdits && operation.textEdits.length > 0) {
				// Text edits
				finalContent = normalizeLineEndings(this._applyTextEdits(content, operation.textEdits));
			} else {
				throw new Error('Edit operation requires either content or textEdits');
			}
		} else {
			throw new Error(`Unknown operation type: ${operation.type}`);
		}

		const hash = await computeHash(finalContent);
		return { uri: operation.uri, expectedHash: hash };
	}

	/**
	 * Verifies post-apply state matches expected result
	 */
	private async _verifyPostApply(expected: ExpectedFileResult): Promise<boolean> {
		const { content } = await this._getFileContent(expected.uri);
		const normalized = normalizeLineEndings(content);
		const actualHash = await computeHash(normalized);
		return actualHash === expected.expectedHash;
	}

	/**
	 * Applies a single file operation
	 */
	private async _applyFileOperation(operation: FileEditOperation): Promise<void> {
		if (operation.type === 'delete') {
			if (await this._fileService.exists(operation.uri)) {
				await this._fileService.del(operation.uri);
			}
		} else if (operation.type === 'create') {
			if (!operation.content) {
				throw new Error('Create operation requires content');
			}
			const modelRef = await this._textModelService.createModelReference(operation.uri);
			try {
				const textModel = modelRef.object.textEditorModel;
				if (textModel && !textModel.isDisposed()) {
					textModel.setValue(operation.content);
				}
			} finally {
				modelRef.dispose();
			}
			// Phase 1: atomic write (temp file + rename) so a crash/ENOSPC mid-write cannot leave the
			// file empty or half-written. The node disk provider services atomic.postfix via doWriteFileAtomic.
			await this._fileService.writeFile(operation.uri, VSBuffer.fromString(operation.content), { atomic: { postfix: '.cortexide-tmp' } });
		} else if (operation.type === 'edit') {
			const modelRef = await this._textModelService.createModelReference(operation.uri);
			try {
				const textModel = modelRef.object.textEditorModel;
				if (textModel && !textModel.isDisposed()) {
					if (operation.content) {
						// Full rewrite
						textModel.setValue(operation.content);
					} else if (operation.textEdits && operation.textEdits.length > 0) {
						// Apply text edits
						const edits = operation.textEdits.map(e => ({
							range: {
								startLineNumber: e.range.startLineNumber,
								startColumn: e.range.startColumn,
								endLineNumber: e.range.endLineNumber,
								endColumn: e.range.endColumn,
							},
							text: e.text,
						}));
						textModel.applyEdits(edits);
					}
				}
			} finally {
				modelRef.dispose();
			}

			// Also write to disk — atomically (temp file + rename) to avoid corrupting the file on a
			// crash/ENOSPC partway through the write.
			const { content } = await this._getFileContent(operation.uri);
			await this._fileService.writeFile(operation.uri, VSBuffer.fromString(content), { atomic: { postfix: '.cortexide-tmp' } });
		}
	}

	/**
	 * Main apply transaction method - atomic, verifiable, deterministic
	 */
	async applyTransaction(operations: FileEditOperation[], options?: { operationId?: string }): Promise<ApplyTransactionResult> {
		const operationId = options?.operationId || `apply-${Date.now()}`;

		// 1. Validate all paths are within workspace
		const allUris = operations.map(op => op.uri);
		const pathValidation = this._validatePaths(allUris);
		if (!pathValidation.valid) {
			return {
				success: false,
				appliedFiles: [],
				error: `Files outside workspace: ${pathValidation.invalid!.map(u => u.fsPath).join(', ')}`,
				errorCategory: 'write_failure',
			};
		}

		// 2. Sort operations deterministically (lexicographic by URI path)
		const sortedOps = [...operations].sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath));

		// 3. Compute base signatures for all files (pre-apply verification)
		this._notificationService.notify({
			severity: 1, // Info
			message: localize('applyEngine.verifying', 'Verifying files...'),
			sticky: false,
		});

		const baseSignatures = new Map<URI, FileBaseSignature>();
		for (const op of sortedOps) {
			if (op.type !== 'create') {
				try {
					const signature = await this._computeBaseSignature(op.uri);
					baseSignatures.set(op.uri, signature);
				} catch (error) {
					return {
						success: false,
						appliedFiles: [],
						failedFile: op.uri,
						error: `Failed to compute base signature for ${op.uri.fsPath}: ${error}`,
						errorCategory: 'base_mismatch',
					};
				}
			}
		}

		// 4. Re-verify base signatures immediately before applying (race condition protection)
		for (const [uri, signature] of baseSignatures.entries()) {
			const stillValid = await this._verifyBaseSignature(signature);
			if (!stillValid) {
				return {
					success: false,
					appliedFiles: [],
					failedFile: uri,
					error: `File ${uri.fsPath} changed between signature computation and apply`,
					errorCategory: 'base_mismatch',
				};
			}
		}

		// 5. Compute expected results for verification
		const expectedResults = new Map<URI, ExpectedFileResult>();
		for (const op of sortedOps) {
			try {
				const baseSig = baseSignatures.get(op.uri);
				if (op.type === 'create' || baseSig) {
					const expected = await this._computeExpectedResult(op, baseSig!);
					expectedResults.set(op.uri, expected);
				}
			} catch (error) {
				return {
					success: false,
					appliedFiles: [],
					failedFile: op.uri,
					error: `Failed to compute expected result for ${op.uri.fsPath}: ${error}`,
					errorCategory: 'hunk_apply_failure',
				};
			}
		}

		// 6. Create snapshot for rollback
		let snapshotId: string | undefined;
		let stashRef: string | undefined;
		const touchedFiles = sortedOps.map(op => op.uri.fsPath);

		try {
			if (this._rollbackService.isEnabled()) {
				const snapshot = await this._rollbackService.createSnapshot(touchedFiles);
				snapshotId = snapshot.id;
			}

			if (this._gitStashService.isEnabled()) {
				stashRef = await this._gitStashService.createStash(operationId);
			}
		} catch (error) {
			this._logService.warn('[ApplyEngineV2] Failed to create snapshot/stash:', error);
		}

		// 7. Apply operations atomically (all or nothing)
		const appliedFiles: URI[] = [];
		let applyError: Error | undefined;

		try {
			for (const op of sortedOps) {
				try {
					await this._applyFileOperation(op);
					appliedFiles.push(op.uri);
				} catch (error) {
					applyError = error instanceof Error ? error : new Error(String(error));
					throw applyError; // Stop applying, trigger rollback
				}
			}

			// 8. Post-apply verification (proof of apply)
			for (const [uri, expected] of expectedResults.entries()) {
				const verified = await this._verifyPostApply(expected);
				if (!verified) {
					throw new Error(`Post-apply verification failed for ${uri.fsPath}`);
				}
			}

			// 9. Success - discard snapshot
			if (snapshotId) {
				await this._rollbackService.discardSnapshot(snapshotId);
			}

			// Audit log
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'apply',
					files: touchedFiles,
					ok: true,
					meta: { operationId, appliedFiles: appliedFiles.length },
				});
			}

			this._notificationService.notify({
				severity: 1, // Info
				message: localize('applyEngine.success', 'Applied (verified) to {0} file(s)', appliedFiles.length),
				sticky: false,
			});

			return {
				success: true,
				appliedFiles,
			};
		} catch (error) {
			// 10. Failure - rollback
			let restored = false;

			if (snapshotId) {
				try {
					await this._rollbackService.restoreSnapshot(snapshotId);
					restored = true;
				} catch (snapshotError) {
					this._logService.error('[ApplyEngineV2] Snapshot restore failed:', snapshotError);
				}
			}

			if (!restored && stashRef) {
				try {
					await this._gitStashService.restoreStash(stashRef);
					restored = true;
				} catch (stashError) {
					this._logService.error('[ApplyEngineV2] Stash restore failed:', stashError);
				}
			}

			const errorMessage = applyError?.message || (error instanceof Error ? error.message : String(error));
			const errorCategory: ApplyTransactionResult['errorCategory'] = errorMessage.includes('verification') ? 'verification_failure' :
				errorMessage.includes('signature') ? 'base_mismatch' :
					errorMessage.includes('write') || errorMessage.includes('permission') ? 'write_failure' :
						'hunk_apply_failure';

			// Audit log
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'apply',
					ok: false,
					meta: {
						operationId,
						error: errorMessage,
						rollbackAttempted: true,
						rollbackSuccess: restored,
						errorCategory,
					},
				});
			}

			this._notificationService.notify({
				severity: 3, // Error
				message: localize('applyEngine.failure', 'Apply failed: {0}', errorMessage),
				sticky: true,
			});

			return {
				success: false,
				appliedFiles: [],
				failedFile: appliedFiles.length > 0 ? appliedFiles[appliedFiles.length - 1] : sortedOps[0]?.uri,
				error: errorMessage,
				errorCategory,
			};
		}
	}
}

registerSingleton(IApplyEngineV2, ApplyEngineV2, InstantiationType.Delayed);

