/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { computeMultiEditResult, MultiEditSpec } from '../../common/multiEdit.js';
import { computeSearchReplaceResult } from '../../common/searchReplaceMatch.js';

/**
 * Tests for the multi_edit transaction. The headline case is replace_all, which was DEAD in the old
 * implementation (it expanded N identical Search/Replace blocks, which the span engine rejected as
 * 'Not unique'/'Has overlap'). The differential-fuzz suite below proves the new sequential engine is a
 * superset: on the inputs the old single-edit engine accepts (unique full-line edits) it produces a
 * byte-identical result, so swapping multi_edit onto it is non-regressing.
 */

const edit = (oldString: string, newString: string, replaceAll = false): MultiEditSpec => ({ oldString, newString, replaceAll });

suite('multiEdit.computeMultiEditResult - core semantics', () => {

	test('empty edit list leaves the content unchanged', () => {
		assert.deepStrictEqual(computeMultiEditResult('abc', []), { ok: true, newContent: 'abc', replacements: 0 });
	});

	test('single unique non-replaceAll edit replaces the one occurrence', () => {
		const r = computeMultiEditResult('let x = 1;', [edit('x = 1', 'x = 42')]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'let x = 42;', replacements: 1 });
	});

	test('non-replaceAll edit on a NON-unique old_string fails Not unique (never edits the wrong one)', () => {
		const r = computeMultiEditResult('foo\nfoo', [edit('foo', 'bar')]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not unique', editIndex: 0, oldString: 'foo' });
	});

	test('edit whose old_string is absent fails Not found', () => {
		const r = computeMultiEditResult('hello world', [edit('xyz', 'q')]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not found', editIndex: 0, oldString: 'xyz' });
	});

	// --- THE FIX: replace_all ---

	test('replace_all replaces EVERY occurrence (the case that used to die as Not unique)', () => {
		const r = computeMultiEditResult('a.b.a.b.a', [edit('a', 'Z', true)]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'Z.b.Z.b.Z', replacements: 3 });
	});

	test('replace_all on a single occurrence behaves like a normal replace', () => {
		const r = computeMultiEditResult('only one here', [edit('one', '1', true)]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'only 1 here', replacements: 1 });
	});

	test('replace_all with zero occurrences fails Not found', () => {
		const r = computeMultiEditResult('abc', [edit('z', 'Z', true)]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not found', editIndex: 0, oldString: 'z' });
	});

	test('replace_all is left-to-right non-overlapping (aaaa / aa -> two replacements)', () => {
		const r = computeMultiEditResult('aaaa', [edit('aa', 'X', true)]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'XX', replacements: 2 });
	});

	test('non-replaceAll treats overlapping matches as ambiguous (aaa / aa -> Not unique, same as edit_file)', () => {
		const r = computeMultiEditResult('aaa', [edit('aa', 'X')]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not unique', editIndex: 0, oldString: 'aa' });
	});

	// --- SEQUENTIAL semantics ---

	test('edits apply IN SEQUENCE: a later edit can target text an earlier edit produced', () => {
		const r = computeMultiEditResult('foo', [edit('foo', 'bar'), edit('bar', 'baz')]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'baz', replacements: 2 });
	});

	test('a later edit can NOT target text an earlier edit consumed (fails Not found on the second)', () => {
		const r = computeMultiEditResult('foo', [edit('foo', 'bar'), edit('foo', 'qux')]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not found', editIndex: 1, oldString: 'foo' });
	});

	test('an earlier edit can make a later old_string unique (so the second edit succeeds)', () => {
		// 'foo' starts non-unique; the first edit removes one copy, so the second 'foo' is now unique.
		const r = computeMultiEditResult('foo\nfoo', [edit('foo\nfoo', 'foo\nbar'), edit('foo', 'X')]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'X\nbar', replacements: 2 });
	});

	test('ATOMIC: a failing later edit yields ok:false and NO partial content', () => {
		const r = computeMultiEditResult('a\nb\nc', [edit('a', 'A'), edit('missing', 'X'), edit('c', 'C')]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not found', editIndex: 1, oldString: 'missing' });
		// the result carries no newContent the caller could accidentally write
		assert.ok(!('newContent' in r));
	});

	test('multiple independent edits in one call all apply', () => {
		const r = computeMultiEditResult('alpha beta gamma', [edit('alpha', 'A'), edit('gamma', 'G')]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'A beta G', replacements: 2 });
	});

	test('a mix of replace_all and unique edits, in sequence', () => {
		const r = computeMultiEditResult('x x x y', [edit('x', 'Q', true), edit('y', 'Z')]);
		assert.deepStrictEqual(r, { ok: true, newContent: 'Q Q Q Z', replacements: 4 });
	});
});

// Deterministic PRNG (mulberry32) so the fuzz is reproducible and CI-stable.
function mulberry32(a: number): () => number {
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

suite('multiEdit.computeMultiEditResult - differential fuzz vs computeSearchReplaceResult', () => {

	test('single verbatim-substring edit agrees with the existing engine (ok + bytes, or Not unique)', () => {
		const rnd = mulberry32(0x51A4E3);
		const alphabet = 'ab \n'; // tiny alphabet -> lots of non-unique cases, exercising both branches
		const pick = (n: number) => Math.floor(rnd() * n);
		let compared = 0;

		for (let iter = 0; iter < 20000; iter++) {
			const len = 1 + pick(40);
			let content = '';
			for (let i = 0; i < len; i++) { content += alphabet[pick(alphabet.length)]; }

			// old_string = a non-empty verbatim slice (so it always exists; tool forbids empty old_string)
			const start = pick(content.length);
			const end = start + 1 + pick(content.length - start);
			const oldString = content.slice(start, end);
			const newString = 'R' + pick(99); // 'R' never appears in the alphabet, so no accidental re-match

			const mer = computeMultiEditResult(content, [edit(oldString, newString)]);
			const sr = computeSearchReplaceResult(content, [{ orig: oldString, final: newString }]);

			assert.strictEqual(mer.ok, sr.ok, `ok mismatch for ${JSON.stringify({ content, oldString })}`);
			if (mer.ok && sr.ok) {
				assert.strictEqual(mer.newContent, sr.newCode, `bytes mismatch for ${JSON.stringify({ content, oldString, newString })}`);
			} else if (!mer.ok && !sr.ok) {
				// the only failure a single verbatim-substring edit can hit is Not unique
				assert.strictEqual(mer.reason, sr.reason, `reason mismatch for ${JSON.stringify({ content, oldString })}`);
			}
			compared++;
		}
		assert.strictEqual(compared, 20000);
	});

	test('independent unique full-line edits match the existing engine byte-for-byte', () => {
		const rnd = mulberry32(0x0C0FFEE);
		const pick = (n: number) => Math.floor(rnd() * n);
		// fixed-width unique tokens so no token is a substring of another; disjoint L/R prefixes so a
		// replacement can never manufacture (or destroy) another edit's old_string -> sequential == parallel.
		const tok = (prefix: string, id: number) => prefix + String(id).padStart(5, '0');

		for (let iter = 0; iter < 5000; iter++) {
			const nLines = 1 + pick(12);
			const lineIds: number[] = [];
			for (let i = 0; i < nLines; i++) { lineIds.push(iter * 100 + i); }
			const content = lineIds.map(id => tok('L', id)).join('\n');

			// choose a random subset of lines to edit, in random order
			const order = lineIds.slice();
			for (let i = order.length - 1; i > 0; i--) { const j = pick(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
			const chosen = order.slice(0, 1 + pick(order.length));

			const edits = chosen.map(id => edit(tok('L', id), tok('R', id)));
			const blocks = chosen.map(id => ({ orig: tok('L', id), final: tok('R', id) }));

			const mer = computeMultiEditResult(content, edits);
			const sr = computeSearchReplaceResult(content, blocks);

			assert.ok(mer.ok, `multiEdit should accept independent unique edits (iter ${iter})`);
			assert.ok(sr.ok, `searchReplace should accept independent unique edits (iter ${iter})`);
			if (mer.ok && sr.ok) {
				assert.strictEqual(mer.newContent, sr.newCode, `bytes mismatch (iter ${iter})`);
			}
		}
	});
});
