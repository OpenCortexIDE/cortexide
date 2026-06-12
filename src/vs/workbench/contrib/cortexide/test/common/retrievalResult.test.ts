/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { formatRetrievalResult, prioritizeSymbols, RetrievalResult } from '../../common/retrievalResult.js';

/**
 * Phase 4 (RAG): first tests for the codebase-retrieval result formatting (the path had ZERO tests
 * despite BM25 being the only live RAG path). Pins the citation block byte-for-byte against the
 * previous RepoIndexerService._formatResult so the extraction is provably behavior-preserving, and
 * documents the structured RetrievalResult shape that fixes the URI-consumer bug.
 */
suite('retrievalResult.formatRetrievalResult', () => {

	const base: RetrievalResult = { uri: 'file:///a/b.ts', symbols: [], snippet: '', startLine: 1, endLine: 1 };

	test('single-line citation: "File: <uri>:<line>"', () => {
		assert.strictEqual(formatRetrievalResult({ ...base, startLine: 7, endLine: 7 }, 'q'), 'File: file:///a/b.ts:7');
	});

	test('multi-line citation: "File: <uri>:<start>-<end>"', () => {
		assert.strictEqual(formatRetrievalResult({ ...base, startLine: 7, endLine: 12 }, 'q'), 'File: file:///a/b.ts:7-12');
	});

	test('symbols line only present when there are symbols, query-overlapping ranked first', () => {
		const r: RetrievalResult = { ...base, startLine: 1, endLine: 1, symbols: ['parseConfig', 'helper', 'configSchema'] };
		const out = formatRetrievalResult(r, 'config');
		assert.strictEqual(out,
			'File: file:///a/b.ts:1\nSymbols: parseConfig, configSchema, helper');
		// no symbols -> no Symbols line
		assert.strictEqual(formatRetrievalResult(base, 'q'), 'File: file:///a/b.ts:1');
	});

	test('content preview only present when there is a snippet', () => {
		const out = formatRetrievalResult({ ...base, snippet: 'const x = 1;' }, 'q');
		assert.strictEqual(out, 'File: file:///a/b.ts:1\nContent preview:\nconst x = 1;');
	});

	test('full block: file + symbols + content preview, in order', () => {
		const r: RetrievalResult = { uri: 'file:///x.ts', symbols: ['foo'], snippet: 'foo()', startLine: 3, endLine: 5 };
		assert.strictEqual(formatRetrievalResult(r, 'foo'),
			'File: file:///x.ts:3-5\nSymbols: foo\nContent preview:\nfoo()');
	});

	// The structured-vs-string consistency the queryStructured() fix relies on: the discrete `uri`
	// field is EXACTLY the path the citation block embeds. Consumers (codebaseQueryCommands, the
	// agent's search_for_files) URI.file() the discrete field; if a future change relativized or
	// URI-encoded the citation path it must stay equal to `uri`, or the two forms silently diverge.
	test('CONSISTENCY: the formatted citation begins with the exact discrete uri field', () => {
		for (const uri of ['/abs/path/to/file.ts', 'file:///a/b.ts', 'C:\\win\\path.ts', '/p/with space.ts']) {
			const out = formatRetrievalResult({ uri, symbols: ['s'], snippet: 'x', startLine: 4, endLine: 9 }, 'q');
			assert.ok(out.startsWith(`File: ${uri}:`), `citation must embed the discrete uri verbatim, got: ${out}`);
		}
	});
});

suite('retrievalResult.prioritizeSymbols', () => {
	test('empty -> empty', () => {
		assert.deepStrictEqual(prioritizeSymbols([], 'q'), []);
	});

	test('symbol-contains-query: a symbol containing the query is ranked first', () => {
		// 'getUser' contains query 'user'; the others do not overlap
		const r = prioritizeSymbols(['render', 'getUser', 'config', 'helper'], 'user');
		assert.deepStrictEqual(r, ['getUser', 'render', 'config', 'helper']);
	});

	test('query-contains-symbol: symbols that are substrings of the query are ranked first', () => {
		// query 'getuserlist' contains 'user' and 'list'
		const r = prioritizeSymbols(['render', 'user', 'list', 'helper'], 'getuserlist');
		assert.deepStrictEqual(r, ['user', 'list', 'render', 'helper']);
	});

	test('caps matching at 5, others at 5, total at 10', () => {
		const matching = Array.from({ length: 8 }, (_, i) => `xq${i}`); // all contain 'xq'
		const others = Array.from({ length: 8 }, (_, i) => `z${i}`);
		const r = prioritizeSymbols([...matching, ...others], 'xq');
		assert.strictEqual(r.length, 10);
		assert.deepStrictEqual(r.slice(0, 5), matching.slice(0, 5));
		assert.deepStrictEqual(r.slice(5), others.slice(0, 5));
	});
});
