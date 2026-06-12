/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { findDiffs } from '../../browser/helpers/findDiffs.js';
import { ComputedDiff } from '../../common/editCodeServiceTypes.js';

/**
 * findDiffs is the line-diff engine that defines every hunk the apply/accept/reject UI operates on -- it
 * had no test. The golden cases pin the hunk type + line bookkeeping (incl. the internal trailing-\n hack);
 * the reconstruction property fuzz proves the diffs are SOUND: re-applying every returned hunk to the old
 * text must rebuild the new text exactly (over random line edits).
 */

// Reconstruct the new file from old + the diffs, mirroring findDiffs' internal model (it appends a \n to
// both sides before diffing, and reports 1-indexed line numbers into that). Verified against the goldens
// below before being used as the fuzz oracle.
function reconstruct(oldStr: string, diffs: readonly ComputedDiff[]): string {
	const oldLines = (oldStr + '\n').split('\n'); // line K (1-indexed) === oldLines[K-1]
	const out: string[] = [];
	let cursor = 1; // next 1-indexed old line to emit
	for (const d of diffs) {
		const origStart = d.originalStartLine;
		const origEnd = d.type === 'insertion' ? d.originalStartLine - 1 : d.originalEndLine;
		for (let k = cursor; k <= origStart - 1; k++) { out.push(oldLines[k - 1]); }
		if (d.type !== 'deletion') { out.push(...d.code.split('\n')); }
		cursor = origEnd + 1;
	}
	for (let k = cursor; k <= oldLines.length; k++) { out.push(oldLines[k - 1]); }
	return out.join('\n');
}

const A = 'A\nB\nC\nD\nE';
const inserted = 'A\nB\nC\nF\nD\nE';
const modified = 'A\nB\nC\nF\nE';

suite('findDiffs - golden cases', () => {

	test('insertion: one F added at line 4', () => {
		const diffs = findDiffs(A, inserted);
		assert.strictEqual(diffs.length, 1);
		assert.strictEqual(diffs[0].type, 'insertion');
		assert.strictEqual(diffs[0].startLine, 4);
		assert.strictEqual(diffs[0].originalStartLine, 4);
		assert.strictEqual(diffs[0].code, 'F');
	});

	test('deletion: F removed at line 4 (the deleted original line is reported)', () => {
		const diffs = findDiffs(inserted, A);
		assert.strictEqual(diffs.length, 1);
		assert.strictEqual(diffs[0].type, 'deletion');
		assert.strictEqual(diffs[0].originalStartLine, 4);
		assert.strictEqual(diffs[0].type === 'deletion' && diffs[0].originalCode, 'F');
	});

	test('edit: D -> F at line 4', () => {
		const diffs = findDiffs(A, modified);
		assert.strictEqual(diffs.length, 1);
		assert.strictEqual(diffs[0].type, 'edit');
		assert.strictEqual(diffs[0].originalStartLine, 4);
		assert.strictEqual(diffs[0].originalEndLine, 4);
		assert.strictEqual(diffs[0].code, 'F');
		assert.strictEqual(diffs[0].type === 'edit' && diffs[0].originalCode, 'D');
	});

	test('identical input -> no diffs', () => {
		assert.deepStrictEqual(findDiffs(A, A), []);
	});

	test('the trailing-newline hack: E vs E\\n is an insertion, not an edit', () => {
		const diffs = findDiffs('E', 'E\n');
		assert.strictEqual(diffs.length, 1);
		assert.strictEqual(diffs[0].type, 'insertion');
	});

	test('empty old / empty new produce a single hunk that reconstructs the target', () => {
		// '' has a single (empty) line, so '' -> 'X\nY' replaces it (an edit), and 'X\nY' -> '' likewise.
		const ins = findDiffs('', 'X\nY');
		assert.strictEqual(ins.length, 1);
		assert.strictEqual(reconstruct('', ins), 'X\nY\n');
		const del = findDiffs('X\nY', '');
		assert.strictEqual(del.length, 1);
		assert.strictEqual(reconstruct('X\nY', del), '\n');
	});

	test('reconstruct() oracle agrees with the goldens (sanity-check the fuzz oracle)', () => {
		for (const [o, n] of [[A, inserted], [inserted, A], [A, modified], [A, A], ['E', 'E\n'], ['', 'X\nY'], ['X\nY', '']] as const) {
			assert.strictEqual(reconstruct(o, findDiffs(o, n)), n + '\n', `oracle mismatch for ${JSON.stringify({ o, n })}`);
		}
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

suite('findDiffs - reconstruction property fuzz', () => {
	test('re-applying every hunk to the old text rebuilds the new text exactly (15k random edits)', () => {
		const rnd = mulberry32(0xD1FF);
		const pick = (n: number) => Math.floor(rnd() * n);
		const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', '']; // small alphabet incl. blank lines -> dense diffs
		const randomFile = (maxLines: number) => {
			const n = pick(maxLines);
			const lines: string[] = [];
			for (let i = 0; i < n; i++) { lines.push(alphabet[pick(alphabet.length)]); }
			return lines.join('\n');
		};

		for (let iter = 0; iter < 15000; iter++) {
			const oldStr = randomFile(8);
			// derive newStr by random line ops on oldStr so diffs are realistic and varied
			let lines = oldStr.length ? oldStr.split('\n') : [];
			const ops = pick(4);
			for (let o = 0; o < ops; o++) {
				const kind = pick(3);
				if (kind === 0 && lines.length) { lines.splice(pick(lines.length), 1); }                       // delete
				else if (kind === 1) { lines.splice(pick(lines.length + 1), 0, alphabet[pick(alphabet.length)]); } // insert
				else if (lines.length) { lines[pick(lines.length)] = alphabet[pick(alphabet.length)]; }          // edit
			}
			const newStr = lines.join('\n');

			const diffs = findDiffs(oldStr, newStr);
			assert.strictEqual(reconstruct(oldStr, diffs), newStr + '\n', `reconstruction failed for ${JSON.stringify({ oldStr, newStr, diffs })}`);
		}
	});
});
