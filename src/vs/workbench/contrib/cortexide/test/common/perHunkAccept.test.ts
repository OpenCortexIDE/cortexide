/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { computeAcceptedOriginalCode, computeRejectWrite } from '../../common/perHunkAccept.js';
import { findDiffs } from '../../browser/helpers/findDiffs.js';
import { ComputedDiff } from '../../common/editCodeServiceTypes.js';

/**
 * The per-hunk Accept/Reject splice + range math (extracted from editCodeService). The accept-convergence
 * fuzz is the strong one: repeatedly accepting the first hunk (re-diffing the new baseline each time, as
 * the service does) must fold the diff-area's originalCode all the way to the new code -- this is exactly
 * the sequential-accept path where the boundary off-by-ones would surface.
 */

suite('perHunkAccept.computeAcceptedOriginalCode - golden splices', () => {

	test('edit: swaps the edited original lines for the hunk code', () => {
		const diff: ComputedDiff = { type: 'edit', originalCode: 'B', originalStartLine: 2, originalEndLine: 2, code: 'X', startLine: 2, endLine: 2 };
		assert.strictEqual(computeAcceptedOriginalCode('A\nB\nC', diff), 'A\nX\nC');
	});

	test('deletion: removes the original lines', () => {
		const diff: ComputedDiff = { type: 'deletion', originalCode: 'B', originalStartLine: 2, originalEndLine: 2, startLine: 2 };
		assert.strictEqual(computeAcceptedOriginalCode('A\nB\nC', diff), 'A\nC');
	});

	test('insertion: inserts the hunk code before the original start line (original lines stay)', () => {
		const diff: ComputedDiff = { type: 'insertion', originalStartLine: 2, code: 'X', startLine: 2, endLine: 2 };
		assert.strictEqual(computeAcceptedOriginalCode('A\nB\nC', diff), 'A\nX\nB\nC');
	});

	test('edit at end-of-file', () => {
		const diff: ComputedDiff = { type: 'edit', originalCode: 'C', originalStartLine: 3, originalEndLine: 3, code: 'Z', startLine: 3, endLine: 3 };
		assert.strictEqual(computeAcceptedOriginalCode('A\nB\nC', diff), 'A\nB\nZ');
	});

	test('multi-line edit', () => {
		const diff: ComputedDiff = { type: 'edit', originalCode: 'B\nC', originalStartLine: 2, originalEndLine: 3, code: 'X\nY\nZ', startLine: 2, endLine: 4 };
		assert.strictEqual(computeAcceptedOriginalCode('A\nB\nC\nD', diff), 'A\nX\nY\nZ\nD');
	});
});

suite('perHunkAccept.computeRejectWrite - golden range math', () => {

	test('edit: writes originalCode over [startLine..endLine]', () => {
		const diff: ComputedDiff = { type: 'edit', originalCode: 'B', originalStartLine: 2, originalEndLine: 2, code: 'X', startLine: 2, endLine: 2 };
		assert.deepStrictEqual(computeRejectWrite(diff, 5), {
			writeText: 'B',
			toRange: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: Number.MAX_SAFE_INTEGER },
		});
	});

	test('deletion (normal): re-inserts originalCode + newline at startLine', () => {
		const diff: ComputedDiff = { type: 'deletion', originalCode: 'B', originalStartLine: 2, originalEndLine: 2, startLine: 2 };
		assert.deepStrictEqual(computeRejectWrite(diff, 5), {
			writeText: 'B\n',
			toRange: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1 },
		});
	});

	test('deletion at end-of-zone (startLine-1 === diffAreaEndLine): inserts after the previous line', () => {
		// diffAreaEndLine = 4, diff.startLine = 5 -> startLine-1 === endLine -> the special branch
		const diff: ComputedDiff = { type: 'deletion', originalCode: 'E', originalStartLine: 5, originalEndLine: 5, startLine: 5 };
		assert.deepStrictEqual(computeRejectWrite(diff, 4), {
			writeText: '\nE',
			toRange: { startLineNumber: 4, startColumn: Number.MAX_SAFE_INTEGER, endLineNumber: 4, endColumn: Number.MAX_SAFE_INTEGER },
		});
	});

	test('insertion (normal): deletes [startLine .. endLine+1)', () => {
		const diff: ComputedDiff = { type: 'insertion', originalStartLine: 2, code: 'X', startLine: 2, endLine: 2 };
		assert.deepStrictEqual(computeRejectWrite(diff, 5), {
			writeText: '',
			toRange: { startLineNumber: 2, startColumn: 1, endLineNumber: 3, endColumn: 1 },
		});
	});

	test('insertion at end-of-zone (endLine === diffAreaEndLine): deletes the line before instead', () => {
		const diff: ComputedDiff = { type: 'insertion', originalStartLine: 5, code: 'X', startLine: 5, endLine: 5 };
		assert.deepStrictEqual(computeRejectWrite(diff, 5), {
			writeText: '',
			toRange: { startLineNumber: 4, startColumn: Number.MAX_SAFE_INTEGER, endLineNumber: 5, endColumn: 1 },
		});
	});
});

function mulberry32(a: number): () => number {
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

suite('perHunkAccept - accept-convergence property fuzz', () => {

	// Mirror the service: accept the first hunk, RE-DIFF the (changed) baseline against the target, repeat.
	function acceptAll(originalCode: string, newCode: string): string {
		let cur = originalCode;
		for (let guard = 0; guard < 2000; guard++) {
			const diffs = findDiffs(cur, newCode);
			if (diffs.length === 0) { return cur; }
			cur = computeAcceptedOriginalCode(cur, diffs[0]);
		}
		throw new Error('did not converge');
	}

	test('accepting every hunk folds originalCode all the way to the new code (12k random edits)', () => {
		const rnd = mulberry32(0xACCE);
		const pick = (n: number) => Math.floor(rnd() * n);
		const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', ''];
		const randomFile = (max: number) => {
			const n = pick(max);
			const lines: string[] = [];
			for (let i = 0; i < n; i++) { lines.push(alphabet[pick(alphabet.length)]); }
			return lines.join('\n');
		};

		for (let iter = 0; iter < 12000; iter++) {
			const oldStr = randomFile(7);
			let lines = oldStr.length ? oldStr.split('\n') : [];
			const ops = pick(4);
			for (let o = 0; o < ops; o++) {
				const kind = pick(3);
				if (kind === 0 && lines.length) { lines.splice(pick(lines.length), 1); }
				else if (kind === 1) { lines.splice(pick(lines.length + 1), 0, alphabet[pick(alphabet.length)]); }
				else if (lines.length) { lines[pick(lines.length)] = alphabet[pick(alphabet.length)]; }
			}
			const newStr = lines.join('\n');
			assert.strictEqual(acceptAll(oldStr, newStr), newStr, `accept-convergence failed for ${JSON.stringify({ oldStr, newStr })}`);
		}
	});
});
