/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Durable create/delete rollback for agent file operations.
 *
 * The in-memory checkpoint system only restores EDITED files that still have a live editor model —
 * it cannot recreate a file the agent deleted (content permanently lost) or remove a file the agent
 * created. This records the BEFORE-state of each create/delete at the tool-dispatch chokepoint, and
 * `undoAgentFileOp` reverses it on disk: recreate a deleted file (with its prior content), remove a
 * created file, or restore an overwritten file. Writes are atomic (temp file + rename) and awaited,
 * and every result is returned so the caller can surface failures (no silent swallowing).
 *
 * The disk I/O is injected (`FileOpIO`) so the reversal logic is fully node-unit-testable.
 */

export type AgentFileOpType = 'create' | 'delete' | 'modify';

export interface AgentFileOpRecord {
	/** The checkpoint message index this op happened AFTER (used to decide what a rollback must undo). */
	readonly checkpointIdx: number;
	readonly fsPath: string;
	readonly opType: AgentFileOpType;
	readonly isFolder: boolean;
	/** Whether the path existed on disk immediately before the op. */
	readonly existedBefore: boolean;
	/** File content immediately before the op (for recreate/restore). null for folders / non-existent. */
	readonly beforeContent: string | null;
}

export interface UndoResult {
	readonly fsPath: string;
	readonly ok: boolean;
	/** What the undo did: 'recreated' | 'removed' | 'restored' | 'noop'. */
	readonly action: 'recreated' | 'removed' | 'restored' | 'noop';
	readonly error?: string;
}

/** Minimal disk interface (a subset of IFileService) so the reversal logic is unit-testable. */
export interface FileOpIO {
	exists(fsPath: string): Promise<boolean>;
	writeFileAtomic(fsPath: string, content: string): Promise<void>;
	createFolder(fsPath: string): Promise<void>;
	del(fsPath: string, opts: { recursive: boolean }): Promise<void>;
	readText(fsPath: string): Promise<string>;
}

/**
 * Reverse a single recorded agent file operation on disk. Returns a result describing what happened
 * (and any error) rather than throwing, so a multi-file rollback can attempt every file and report.
 */
export async function undoAgentFileOp(io: FileOpIO, record: AgentFileOpRecord): Promise<UndoResult> {
	const { fsPath, opType, isFolder, existedBefore, beforeContent } = record;
	try {
		if (opType === 'modify') {
			// The agent edited an existing file → restore the prior content. (If it didn't exist before,
			// the edit effectively created it — remove it.)
			if (existedBefore && beforeContent !== null) {
				await io.writeFileAtomic(fsPath, beforeContent);
				return { fsPath, ok: true, action: 'restored' };
			}
			if (!existedBefore) {
				if (await io.exists(fsPath)) { await io.del(fsPath, { recursive: false }); }
				return { fsPath, ok: true, action: 'removed' };
			}
			return { fsPath, ok: true, action: 'noop' };
		}

		if (opType === 'create') {
			// The agent created (or overwrote) this path.
			if (!existedBefore) {
				// It did not exist before → remove what the agent created (if it's still there).
				if (await io.exists(fsPath)) {
					await io.del(fsPath, { recursive: true });
				}
				return { fsPath, ok: true, action: 'removed' };
			}
			// It existed before and was overwritten → restore the prior content.
			if (!isFolder && beforeContent !== null) {
				await io.writeFileAtomic(fsPath, beforeContent);
				return { fsPath, ok: true, action: 'restored' };
			}
			return { fsPath, ok: true, action: 'noop' };
		}

		// opType === 'delete' → recreate what the agent deleted.
		if (!existedBefore) {
			return { fsPath, ok: true, action: 'noop' }; // nothing to recreate
		}
		if (isFolder) {
			if (!(await io.exists(fsPath))) {
				await io.createFolder(fsPath);
			}
			// NOTE: nested folder CONTENTS are not restored (only the folder itself). Documented limitation.
			return { fsPath, ok: true, action: 'recreated' };
		}
		await io.writeFileAtomic(fsPath, beforeContent ?? '');
		return { fsPath, ok: true, action: 'recreated' };
	} catch (e) {
		return { fsPath, ok: false, action: 'noop', error: e instanceof Error ? e.message : String(e) };
	}
}

/**
 * Undo every op that happened strictly AFTER `targetCheckpointIdx`, most-recent first (so an
 * overwrite is undone before the create that introduced the file, etc.). Returns all results;
 * `incomplete` is true if any file failed, so the caller can fail loudly.
 */
export async function undoFileOpsAfterCheckpoint(
	io: FileOpIO,
	journal: readonly AgentFileOpRecord[],
	targetCheckpointIdx: number
): Promise<{ results: UndoResult[]; incomplete: boolean }> {
	const toUndo = journal.filter(r => r.checkpointIdx > targetCheckpointIdx);
	const results: UndoResult[] = [];
	// reverse chronological order
	for (let i = toUndo.length - 1; i >= 0; i--) {
		results.push(await undoAgentFileOp(io, toUndo[i]));
	}
	return { results, incomplete: results.some(r => !r.ok) };
}
