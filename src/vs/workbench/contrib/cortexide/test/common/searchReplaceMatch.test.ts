/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { findTextInCode, computeSearchReplaceResult } from '../../common/searchReplaceMatch.js';

const lines = (opts?: { startingAtLine?: number }) => ({ startingAtLine: opts?.startingAtLine, returnType: 'lines' as const });

suite('findTextInCode - exact match', () => {
	test('single-line ORIGINAL returns its 1-indexed line', () => {
		const file = 'line1\nline2\nline3';
		assert.deepStrictEqual(findTextInCode('line2', file, true, lines()), [2, 2]);
	});

	test('first line', () => {
		const file = 'alpha\nbeta\ngamma';
		assert.deepStrictEqual(findTextInCode('alpha', file, true, lines()), [1, 1]);
	});

	test('multi-line ORIGINAL returns the full [start,end] range', () => {
		const file = 'a\nb\nc\nd';
		assert.deepStrictEqual(findTextInCode('b\nc', file, true, lines()), [2, 3]);
	});

	test('whole-file ORIGINAL', () => {
		const file = 'one\ntwo';
		assert.deepStrictEqual(findTextInCode('one\ntwo', file, true, lines()), [1, 2]);
	});
});

suite('findTextInCode - uniqueness (the SR-uniqueness fix)', () => {
	test('FIX: a non-unique EXACT match in a whole-file search is rejected as Not unique (was silently picking the first)', () => {
		const file = 'x\ny\nx\nz';
		assert.strictEqual(findTextInCode('x', file, true, lines()), 'Not unique');
	});

	test('FIX: holds even when fallback is disabled (exact path now checks uniqueness itself)', () => {
		const file = 'dup\ndup';
		assert.strictEqual(findTextInCode('dup', file, false, lines()), 'Not unique');
	});

	test('a unique exact match still resolves normally', () => {
		const file = 'unique-a\nunique-b\nunique-a-extra';
		assert.deepStrictEqual(findTextInCode('unique-b', file, true, lines()), [2, 2]);
	});

	test('a substring that appears once as the search but is contained in another line is matched by exact text only', () => {
		// "return" appears once exactly; "returning" does not equal "return" via indexOf line semantics here
		const file = 'const a = 1\nreturn a\nconst b = 2';
		assert.deepStrictEqual(findTextInCode('return a', file, true, lines()), [2, 2]);
	});
});

suite('findTextInCode - startingAtLine (positional / streaming) bypasses uniqueness', () => {
	test('with startingAtLine set, a repeated ORIGINAL resolves to the first match AT/AFTER that line (no Not unique)', () => {
		const file = 'x\ny\nx\nz';
		// without startingAtLine this is Not unique; with it, positional matching returns the 2nd x (line 3)
		assert.deepStrictEqual(findTextInCode('x', file, false, lines({ startingAtLine: 2 })), [3, 3]);
	});

	test('the same content without startingAtLine IS Not unique (contrast)', () => {
		const file = 'x\ny\nx\nz';
		assert.strictEqual(findTextInCode('x', file, false, lines()), 'Not unique');
	});
});

suite('findTextInCode - not found + whitespace fallback', () => {
	test('text absent, fallback enabled -> Not found', () => {
		assert.strictEqual(findTextInCode('zzz', 'a\nb\nc', true, lines()), 'Not found');
	});

	test('text whitespace-differs, fallback disabled -> Not found (no fallback)', () => {
		assert.strictEqual(findTextInCode('foo(a)', 'foo( a )', false, lines()), 'Not found');
	});

	test('text whitespace-differs, fallback enabled -> matched ignoring non-newline whitespace', () => {
		const r = findTextInCode('foo(a, b)', 'foo(  a,  b  )', true, lines());
		assert.deepStrictEqual(r, [1, 1]);
	});

	test('whitespace-fallback match that is non-unique -> Not unique', () => {
		// exact "f( a )" is absent (no line has a space before the close paren); the whitespace-stripped
		// "f(a)" appears twice, so the fallback path reports Not unique
		assert.strictEqual(findTextInCode('f( a )', 'f(a)\nf( a)', true, lines()), 'Not unique');
	});
});

suite('computeSearchReplaceResult - multi-edit transaction', () => {
	test('single block replaces the located lines', () => {
		const r = computeSearchReplaceResult('line1\nline2\nline3', [{ orig: 'line2', final: 'REPLACED' }]);
		assert.deepStrictEqual(r, { ok: true, newCode: 'line1\nREPLACED\nline3' });
	});

	test('block at the start of the file', () => {
		const r = computeSearchReplaceResult('first\nsecond', [{ orig: 'first', final: '1ST' }]);
		assert.deepStrictEqual(r, { ok: true, newCode: '1ST\nsecond' });
	});

	test('multi-line ORIGINAL replaced', () => {
		const r = computeSearchReplaceResult('a\nb\nc\nd', [{ orig: 'b\nc', final: 'X' }]);
		assert.deepStrictEqual(r, { ok: true, newCode: 'a\nX\nd' });
	});

	test('multiple non-overlapping blocks given out of order are sorted and all applied (right-to-left, no index shift)', () => {
		const r = computeSearchReplaceResult('a\nb\nc\nd\ne', [
			{ orig: 'd', final: 'D' },
			{ orig: 'b', final: 'B' },
		]);
		assert.deepStrictEqual(r, { ok: true, newCode: 'a\nB\nc\nD\ne' });
	});

	test('a longer replacement does not corrupt a later block (right-to-left apply)', () => {
		const r = computeSearchReplaceResult('AAA\nBBB\nCCC', [
			{ orig: 'AAA', final: 'a-much-longer-replacement' },
			{ orig: 'CCC', final: 'c' },
		]);
		assert.deepStrictEqual(r, { ok: true, newCode: 'a-much-longer-replacement\nBBB\nc' });
	});

	test('empty block list leaves the file unchanged', () => {
		assert.deepStrictEqual(computeSearchReplaceResult('abc', []), { ok: true, newCode: 'abc' });
	});

	test('overlapping blocks are rejected (all-or-nothing), reporting the offending ORIGINAL', () => {
		const r = computeSearchReplaceResult('xx\nyy', [
			{ orig: 'xx\nyy', final: 'Z' },
			{ orig: 'yy', final: 'W' },
		]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Has overlap', blockOrig: 'yy' });
	});

	test('a not-found block fails the whole transaction (no partial apply)', () => {
		const r = computeSearchReplaceResult('a\nb\nc', [
			{ orig: 'b', final: 'B' },
			{ orig: 'zzz', final: 'X' },
		]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not found', blockOrig: 'zzz' });
	});

	test('a non-unique block fails the whole transaction', () => {
		const r = computeSearchReplaceResult('dup\ndup', [{ orig: 'dup', final: 'x' }]);
		assert.deepStrictEqual(r, { ok: false, reason: 'Not unique', blockOrig: 'dup' });
	});

	test('all-or-nothing: a failing 2nd block means the 1st is NOT applied (caller throws before writing)', () => {
		// The function returns ok:false; the caller never writes, so the file is untouched. Prove the
		// result carries no newCode (it is the error variant).
		const r = computeSearchReplaceResult('keep me\nx', [
			{ orig: 'keep me', final: 'CHANGED' },
			{ orig: 'not-present', final: 'Y' },
		]);
		assert.strictEqual(r.ok, false);
		assert.ok(!('newCode' in r));
	});

	// ---- REGRESSION: a partial-line ORIGINAL must replace ONLY the matched text (no data loss) ----

	test('mid-line ORIGINAL replaces only the matched substring, NOT the whole line', () => {
		const r = computeSearchReplaceResult(`export const API_KEY = process.env.SECRET || 'default';`, [
			{ orig: `'default'`, final: `'newdefault'` },
		]);
		assert.deepStrictEqual(r, { ok: true, newCode: `export const API_KEY = process.env.SECRET || 'newdefault';` });
	});

	test('cross-line partial ORIGINAL preserves the unmatched prefix/suffix of the boundary lines', () => {
		const r = computeSearchReplaceResult('alpha\nfoo BAR\nBAZ qux\nomega', [
			{ orig: 'BAR\nBAZ', final: 'REPLACED' },
		]);
		assert.deepStrictEqual(r, { ok: true, newCode: 'alpha\nfoo REPLACED qux\nomega' });
	});

	test('full-line ORIGINAL is unchanged by the fix (exact span equals the line)', () => {
		assert.deepStrictEqual(
			computeSearchReplaceResult('line1\nline2\nline3', [{ orig: 'line2', final: 'LINE2' }]),
			{ ok: true, newCode: 'line1\nLINE2\nline3' });
	});

	test('two non-overlapping edits on the SAME line both apply (exact spans no longer falsely overlap)', () => {
		const r = computeSearchReplaceResult('let a = 1, b = 2;', [
			{ orig: 'a = 1', final: 'a = 10' },
			{ orig: 'b = 2', final: 'b = 20' },
		]);
		assert.deepStrictEqual(r, { ok: true, newCode: 'let a = 10, b = 20;' });
	});

	test('genuinely overlapping exact spans are still rejected', () => {
		const r = computeSearchReplaceResult('abcdef', [
			{ orig: 'abcd', final: 'X' },
			{ orig: 'cdef', final: 'Y' },
		]);
		assert.strictEqual(r.ok, false);
		if (!r.ok) { assert.strictEqual(r.reason, 'Has overlap'); }
	});
});

suite('searchReplaceMatch - CRLF contract (callers always pass LF; this documents what happens if not)', () => {
	// Callers feed getValue(LF), so CRLF should never reach the matcher. These pin the consequence if it did.
	const crlf = 'a\r\nb\r\nc';

	test('a single-line LF needle IS still found in CRLF source (no newline in the needle to mismatch)', () => {
		const res = findTextInCode('b', crlf, false, { returnType: 'lines' });
		assert.deepStrictEqual(res, [2, 2]);
	});

	test('a MULTI-line LF needle is NOT found by exact match against CRLF source (the CR breaks it)', () => {
		assert.strictEqual(findTextInCode('b\nc', crlf, false, { returnType: 'lines' }), 'Not found');
	});

	test('the whitespace fallback recovers a multi-line needle by stripping CR', () => {
		// with fallback enabled, CR is non-newline whitespace -> removed -> the needle matches on line span
		const res = findTextInCode('b\nc', crlf, true, { returnType: 'lines' });
		assert.deepStrictEqual(res, [2, 3]);
	});
});

suite('searchReplaceMatch - sequential compose (apply A, then B on the output of A)', () => {
	test('B that matches text A PRODUCED resolves against the new content', () => {
		const a = computeSearchReplaceResult('a\nb\nc', [{ orig: 'b', final: 'X' }]);
		assert.ok(a.ok);
		if (a.ok) {
			assert.strictEqual(a.newCode, 'a\nX\nc');
			const b = computeSearchReplaceResult(a.newCode, [{ orig: 'X', final: 'Y' }]);
			assert.ok(b.ok);
			if (b.ok) { assert.strictEqual(b.newCode, 'a\nY\nc'); }
		}
	});

	test('B whose ORIGINAL A CONSUMED returns Not found against the new content (no stale edit)', () => {
		const a = computeSearchReplaceResult('a\nb\nc', [{ orig: 'b', final: 'X' }]);
		assert.ok(a.ok);
		if (a.ok) {
			const b = computeSearchReplaceResult(a.newCode, [{ orig: 'b', final: 'Z' }]);
			assert.strictEqual(b.ok, false);
			if (!b.ok) { assert.strictEqual(b.reason, 'Not found'); }
		}
	});
});
