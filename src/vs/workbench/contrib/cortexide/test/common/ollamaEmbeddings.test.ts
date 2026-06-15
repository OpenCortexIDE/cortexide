/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { extractEmbeddingVectors, canUseOllamaEmbeddings } from '../../common/ollamaEmbeddings.js';

suite('ollamaEmbeddings.extractEmbeddingVectors', () => {

	test('returns well-formed, consistent-dimension vectors', () => {
		const out = extractEmbeddingVectors({ embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]] });
		assert.deepStrictEqual(out, [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
	});

	test('enforces one vector per input when expectedCount is given', () => {
		assert.deepStrictEqual(extractEmbeddingVectors({ embeddings: [[1, 2]] }, 1), [[1, 2]]);
		assert.throws(() => extractEmbeddingVectors({ embeddings: [[1, 2]] }, 2), /expected 2 vector/);
	});

	test('throws on a missing / empty / non-array embeddings field', () => {
		assert.throws(() => extractEmbeddingVectors({}), /no embeddings/);
		assert.throws(() => extractEmbeddingVectors({ embeddings: [] }), /no embeddings/);
		assert.throws(() => extractEmbeddingVectors(null), /no embeddings/);
		assert.throws(() => extractEmbeddingVectors({ embeddings: 'nope' as unknown as number[][] }), /no embeddings/);
	});

	test('throws on ragged (inconsistent-dimension) vectors -- never feed cosine similarity garbage', () => {
		assert.throws(() => extractEmbeddingVectors({ embeddings: [[1, 2, 3], [4, 5]] }), /ragged/);
	});

	test('throws on non-finite or non-numeric components', () => {
		assert.throws(() => extractEmbeddingVectors({ embeddings: [[1, NaN, 3]] }), /ragged|non-numeric/);
		assert.throws(() => extractEmbeddingVectors({ embeddings: [[1, Infinity]] }), /ragged|non-numeric/);
		assert.throws(() => extractEmbeddingVectors({ embeddings: [['a', 'b'] as unknown as number[]] }), /ragged|non-numeric/);
	});

	test('throws on an empty first vector (zero dimension)', () => {
		assert.throws(() => extractEmbeddingVectors({ embeddings: [[]] }), /empty or invalid/);
	});
});

suite('ollamaEmbeddings.canUseOllamaEmbeddings', () => {

	test('active only with a configured model AND a dispatchable endpoint', () => {
		assert.strictEqual(canUseOllamaEmbeddings('nomic-embed-text', true), true);
		assert.strictEqual(canUseOllamaEmbeddings('nomic-embed-text', false), false); // endpoint blocked (e.g. remote under local-only)
		assert.strictEqual(canUseOllamaEmbeddings('', true), false);
		assert.strictEqual(canUseOllamaEmbeddings('   ', true), false);
		assert.strictEqual(canUseOllamaEmbeddings(undefined, true), false);
	});
});
