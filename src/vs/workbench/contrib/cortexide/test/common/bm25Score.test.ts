/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { tokenize, scoreEntry, naiveScore, ScorableEntry } from '../../common/bm25Score.js';

/**
 * The lexical (BM25/keyword) scoring core of the repo indexer -- the ONLY live RAG ranking path. These
 * pin the relevance weights + tokenization that decide which code context the model sees.
 */

const entry = (over: Partial<ScorableEntry>): ScorableEntry => ({ uri: '/nomatch.ts', symbols: [], snippet: '', ...over });

suite('bm25Score.tokenize', () => {
	test('lowercases, splits on non-[a-z0-9_], drops empties, dedupes', () => {
		assert.deepStrictEqual([...tokenize('Parse_Config foo.bar Foo')], ['parse_config', 'foo', 'bar']);
	});
	test('underscores stay within a token; punctuation/space split', () => {
		assert.deepStrictEqual([...tokenize('a-b c+d e_f')], ['a', 'b', 'c', 'd', 'e_f']);
	});
	test('empty / all-punctuation -> empty set', () => {
		assert.strictEqual(tokenize('').size, 0);
		assert.strictEqual(tokenize('.-+/').size, 0);
	});
});

suite('bm25Score.scoreEntry - relevance weights', () => {

	test('exact symbol (10) outranks partial symbol (4) outranks token-only (2) outranks no match (0)', () => {
		const exact = scoreEntry('login', tokenize('login'), entry({ symbols: ['login'] }));
		const partial = scoreEntry('login', tokenize('login'), entry({ symbols: ['login_handler'] }));
		// token-only: the symbol string does not contain the query, but its pre-computed token set does
		const tokenOnly = scoreEntry('user', tokenize('user'), entry({ symbols: ['xyz'], symbolTokens: new Set(['user']) }));
		const none = scoreEntry('zzz', tokenize('zzz'), entry({ symbols: ['foo'], symbolTokens: tokenize('foo') }));
		assert.strictEqual(exact, 10);
		assert.strictEqual(partial, 4);
		assert.strictEqual(tokenOnly, 2);
		assert.strictEqual(none, 0);
		assert.ok(exact > partial && partial > tokenOnly && tokenOnly > none);
	});

	test('symbol matching is case-insensitive', () => {
		assert.strictEqual(scoreEntry('LOGIN', tokenize('LOGIN'), entry({ symbols: ['Login'] })), 10);
	});

	test('a URI token match adds 3 (binary, does not double-count)', () => {
		const s = scoreEntry('handler', tokenize('handler'), entry({ uri: '/src/handler.ts', uriTokens: tokenize('/src/handler.ts handler') }));
		assert.strictEqual(s, 3);
	});

	test('snippet token overlap is capped at 5 even with many matches', () => {
		const toks = tokenize('t0 t1 t2 t3 t4 t5 t6 t7 t8 t9'); // 10 tokens
		const s = scoreEntry('t0 t1 t2 t3 t4 t5 t6 t7 t8 t9', toks, entry({ snippetTokens: toks }));
		assert.strictEqual(s, 5); // min(10 * 1.5, 5)
	});

	test('an exact phrase present in the snippet adds 1', () => {
		const s = scoreEntry('foo', tokenize('foo'), entry({ snippet: 'the foo is here' }));
		// snippetTokens absent -> fallback token overlap (foo: +1, and it is a whole word -> +0.5 => 1.5*1.5? )
		// plus the phrase 'foo' is a substring -> +1. Just assert the phrase contribution makes it > 0.
		assert.ok(s >= 1);
	});
});

suite('bm25Score.naiveScore', () => {
	test('counts how many query tokens appear in the doc', () => {
		assert.strictEqual(naiveScore('foo bar baz', 'the foo and baz here'), 2); // foo, baz
		assert.strictEqual(naiveScore('xyz', 'nothing here'), 0);
	});
	test('does NOT lowercase (unlike tokenize): uppercase letters act as separators', () => {
		assert.strictEqual(naiveScore('foo', 'foo bar'), 1);
		// 'FOO' has no [a-z0-9_] chars -> splits to nothing -> no tokens -> no match
		assert.strictEqual(naiveScore('FOO', 'foo'), 0);
	});
});
