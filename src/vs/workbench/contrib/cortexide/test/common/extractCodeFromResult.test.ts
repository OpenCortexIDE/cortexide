/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	extractSearchReplaceBlocks,
	extractCodeFromRegular,
	extractCodeFromFIM,
	endsWithAnyPrefixOf,
} from '../../common/helpers/extractCodeFromResult.js';

/**
 * Phase 5: pins the pure code-extraction parsers that the apply engine depends on. These were
 * previously UNTESTED (a load-bearing gap -- extractSearchReplaceBlocks is the streaming parser
 * that splits the model's SEARCH/REPLACE output into ORIGINAL/UPDATED blocks for fast-apply).
 * The expected shapes below are transcribed from the author's own (commented-out) test battery in
 * extractCodeFromResult.ts, so this locks the documented contract into the runnable suite.
 */
const sr = (...lines: string[]) => lines.join('\n');

function mulberry32(a: number): () => number {
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

suite('extractCodeFromResult - extractSearchReplaceBlocks', () => {

	test('partial / bare ORIGINAL marker -> no blocks yet', () => {
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINA')), []);
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL')), []); // needs the trailing \n
	});

	test('ORIGINAL\\n + content -> writingOriginal, orig grows', () => {
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A')),
			[{ state: 'writingOriginal', orig: 'A', final: '' }]);
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B')),
			[{ state: 'writingOriginal', orig: 'A\nB', final: '' }]);
	});

	test('trailing newline + partial divider stays writingOriginal (orig unchanged)', () => {
		for (const tail of ['', '===', '======', '=======']) {
			const blocks = extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', tail));
			assert.strictEqual(blocks.length, 1);
			assert.strictEqual(blocks[0].state, 'writingOriginal');
			assert.strictEqual(blocks[0].orig, 'A\nB', `tail=${JSON.stringify(tail)}`);
		}
	});

	test('full divider line -> writingFinal with empty final', () => {
		const blocks = extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', ''));
		assert.deepStrictEqual(blocks, [{ state: 'writingFinal', orig: 'A\nB', final: '' }]);
	});

	test('writingFinal accumulates the replacement, then partial FINAL marker stays writingFinal', () => {
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', 'X')),
			[{ state: 'writingFinal', orig: 'A\nB', final: 'X' }]);
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', 'X', 'Y')),
			[{ state: 'writingFinal', orig: 'A\nB', final: 'X\nY' }]);
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', 'X', 'Y', '>>>>>>> UPDAT')),
			[{ state: 'writingFinal', orig: 'A\nB', final: 'X\nY' }]);
	});

	test('complete block -> done; trailing fence ignored', () => {
		const done = [{ state: 'done', orig: 'A\nB', final: 'X\nY' }];
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', 'X', 'Y', '>>>>>>> UPDATED')), done);
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', 'X', 'Y', '>>>>>>> UPDATED', '```')), done);
	});

	test('empty replacement (delete) completes as done with final = ""', () => {
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('```', '<<<<<<< ORIGINAL', 'A', 'B', '=======', '>>>>>>> UPDATED')),
			[{ state: 'done', orig: 'A\nB', final: '' }]);
	});

	test('two blocks: a completed block plus a second in progress', () => {
		const blocks = extractSearchReplaceBlocks(sr(
			'<<<<<<< ORIGINAL', 'a', '=======', 'b', '>>>>>>> UPDATED',
			'<<<<<<< ORIGINAL', 'c',
		));
		assert.strictEqual(blocks.length, 2);
		assert.deepStrictEqual(blocks[0], { state: 'done', orig: 'a', final: 'b' });
		assert.deepStrictEqual(blocks[1], { state: 'writingOriginal', orig: 'c', final: '' });
	});

	test('STREAMING MONOTONICITY: as text is appended, block count never shrinks and state never regresses', () => {
		const full = sr(
			'```', '<<<<<<< ORIGINAL', 'a1', 'a2', '=======', 'b1', 'b2', '>>>>>>> UPDATED',
			'<<<<<<< ORIGINAL', 'c1', '=======', 'd1', '>>>>>>> UPDATED', '```',
		);
		const rank = { writingOriginal: 0, writingFinal: 1, done: 2 } as const;
		let prevLen = 0;
		const prevState: number[] = [];
		for (let n = 1; n <= full.length; n++) {
			const blocks = extractSearchReplaceBlocks(full.slice(0, n));
			assert.ok(blocks.length >= prevLen, `block count regressed at prefix len ${n}`);
			for (let b = 0; b < blocks.length; b++) {
				const s = rank[blocks[b].state];
				if (prevState[b] !== undefined) {
					assert.ok(s >= prevState[b], `block ${b} state regressed at prefix len ${n}`);
				}
				prevState[b] = s;
			}
			prevLen = blocks.length;
		}
		// final fully-parsed result
		const finalBlocks = extractSearchReplaceBlocks(full);
		assert.deepStrictEqual(finalBlocks, [
			{ state: 'done', orig: 'a1\na2', final: 'b1\nb2' },
			{ state: 'done', orig: 'c1', final: 'd1' },
		]);
	});

	test('CONTRACT: an empty ORIGINAL is mis-parsed (the divider is swallowed) -- ORIGINAL must be non-empty', () => {
		// `=======` on the line right after `<<<<<<< ORIGINAL` is treated as ORIGINAL content, not the
		// divider, so an empty-ORIGINAL block does not parse cleanly. Pinned so callers know the contract.
		const blocks = extractSearchReplaceBlocks(sr('<<<<<<< ORIGINAL', '=======', 'NEW', '>>>>>>> UPDATED'));
		assert.notDeepStrictEqual(blocks, [{ state: 'done', orig: '', final: 'NEW' }]);
		// an empty UPDATED, by contrast, parses fine:
		assert.deepStrictEqual(extractSearchReplaceBlocks(sr('<<<<<<< ORIGINAL', 'OLD', '=======', '>>>>>>> UPDATED')),
			[{ state: 'done', orig: 'OLD', final: '' }]);
	});

	test('STREAMING MONOTONICITY FUZZ: random multi-block SR text fed prefix-by-prefix never regresses (2k cases)', () => {
		const rnd = mulberry32(0x5E4C5);
		const pick = (n: number) => Math.floor(rnd() * n);
		const rank = { writingOriginal: 0, writingFinal: 1, done: 2 } as const;
		const origTok = ['x', 'y', 'z1', 'a_b', 'foo()']; // ORIGINAL must be non-empty (see the CONTRACT test)
		const finalTok = ['x', 'y', 'z1', 'a_b', 'foo()', '']; // UPDATED may be empty

		for (let iter = 0; iter < 2000; iter++) {
			const nBlocks = 1 + pick(3);
			const lines: string[] = [];
			if (rnd() < 0.5) { lines.push('```'); }
			for (let bi = 0; bi < nBlocks; bi++) {
				lines.push('<<<<<<< ORIGINAL');
				for (let i = 1 + pick(3); i > 0; i--) { lines.push(origTok[pick(origTok.length)]); } // >=1 non-empty
				lines.push('=======');
				for (let i = pick(4); i > 0; i--) { lines.push(finalTok[pick(finalTok.length)]); }
				lines.push('>>>>>>> UPDATED');
			}
			if (rnd() < 0.5) { lines.push('```'); }
			const full = lines.join('\n');

			let prevLen = 0;
			const prevState: number[] = [];
			for (let n = 1; n <= full.length; n++) {
				const blocks = extractSearchReplaceBlocks(full.slice(0, n));
				assert.ok(blocks.length >= prevLen, `count regressed (iter ${iter}, prefix ${n})`);
				for (let b = 0; b < blocks.length; b++) {
					const s = rank[blocks[b].state];
					if (prevState[b] !== undefined) { assert.ok(s >= prevState[b], `block ${b} state regressed (iter ${iter}, prefix ${n})`); }
					prevState[b] = s;
				}
				prevLen = blocks.length;
			}
			// the complete stream parses to exactly nBlocks, all done
			const finalBlocks = extractSearchReplaceBlocks(full);
			assert.strictEqual(finalBlocks.length, nBlocks, `expected ${nBlocks} blocks (iter ${iter}) for ${JSON.stringify(full)}`);
			assert.ok(finalBlocks.every(b => b.state === 'done'), `all blocks should be done (iter ${iter})`);
		}
	});
});

suite('extractCodeFromResult - extractCodeFromRegular', () => {
	test('strips a fenced code block (with and without language)', () => {
		assert.strictEqual(extractCodeFromRegular({ text: '```\nhello\n```', recentlyAddedTextLen: 0 })[0], 'hello');
		assert.strictEqual(extractCodeFromRegular({ text: '```python\nx = 1\n```', recentlyAddedTextLen: 0 })[0], 'x = 1');
	});
	test('passes through text with no code fence', () => {
		assert.strictEqual(extractCodeFromRegular({ text: 'plain text', recentlyAddedTextLen: 0 })[0], 'plain text');
	});
	test('returns [full, delta, ignoredSuffix] -- delta is the recently-added tail', () => {
		const [full, delta] = extractCodeFromRegular({ text: 'abcdef', recentlyAddedTextLen: 3 });
		assert.strictEqual(full, 'abcdef');
		assert.strictEqual(delta, 'def');
	});
});

suite('extractCodeFromResult - extractCodeFromFIM', () => {
	test('extracts content between <MID> tags', () => {
		assert.strictEqual(extractCodeFromFIM({ text: '<MID>hello</MID>', recentlyAddedTextLen: 0, midTag: 'MID' })[0], 'hello');
	});
	test('strips a newline AFTER the closing tag ("sometimes outputs \\n"); keeps one before it', () => {
		// removeSuffix('\\n') runs before removeSuffix('</MID>'), so a trailing \n after the tag is
		// dropped, but a \n that is part of the content (before the tag) is preserved.
		assert.strictEqual(extractCodeFromFIM({ text: '<MID>hi</MID>\n', recentlyAddedTextLen: 0, midTag: 'MID' })[0], 'hi');
		assert.strictEqual(extractCodeFromFIM({ text: '<MID>hi\n</MID>', recentlyAddedTextLen: 0, midTag: 'MID' })[0], 'hi\n');
	});
});

suite('extractCodeFromResult - endsWithAnyPrefixOf', () => {
	test('returns the longest suffix that is a prefix of the target', () => {
		assert.strictEqual(endsWithAnyPrefixOf('abcde', 'def'), 'de');
		assert.strictEqual(endsWithAnyPrefixOf('foo=', '======='), '='); // partial-divider streaming detection
	});
	test('returns null when no prefix matches', () => {
		assert.strictEqual(endsWithAnyPrefixOf('hello', 'xyz'), null);
	});
});
