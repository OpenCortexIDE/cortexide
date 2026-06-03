/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { codingModelScoreBonus, localModelSizeBonus, smallLocalModelCodePenalty, pickBestCoderModelName } from '../../common/routing/codingModelScore.js';

suite('codingModelScoreBonus', () => {

	test('coding-tuned model with FIM gets the full bonus (FIM + name)', () => {
		assert.strictEqual(codingModelScoreBonus('qwen2.5-coder:7b', true), 55);
		assert.strictEqual(codingModelScoreBonus('codestral:22b', true), 55);
	});

	test('coder name alone (no FIM) still earns the name bonus', () => {
		assert.strictEqual(codingModelScoreBonus('qwen2.5-coder', false), 25);
		assert.strictEqual(codingModelScoreBonus('deepseek-coder-v2:16b', false), 25);
	});

	test('FIM alone (general model that does FIM) earns the FIM bonus', () => {
		assert.strictEqual(codingModelScoreBonus('some-fim-model', true), 30);
	});

	test('REGRESSION: a weak general model gets ZERO so a coder reliably outranks it', () => {
		assert.strictEqual(codingModelScoreBonus('llama3.2:3b', false), 0);
		assert.strictEqual(codingModelScoreBonus('mistral:7b', false), 0);
		// The whole point: coder (>=25) must beat general (0) on the code axis.
		assert.ok(codingModelScoreBonus('qwen2.5-coder:7b', true) > codingModelScoreBonus('llama3.2:3b', false));
	});

	test('matches the devstral/codestral hints too', () => {
		assert.strictEqual(codingModelScoreBonus('devstral', false), 25);
	});
});

suite('localModelSizeBonus', () => {
	test('parses param counts and scales (capped)', () => {
		assert.strictEqual(localModelSizeBonus('qwen2.5-coder:1.5b'), 0.75);
		assert.strictEqual(localModelSizeBonus('qwen2.5-coder:3b'), 1.5);
		assert.strictEqual(localModelSizeBonus('qwen2.5-coder:7b'), 3.5);
		assert.strictEqual(localModelSizeBonus('codestral:22b'), 11);
		assert.strictEqual(localModelSizeBonus('llama3.1:70b'), 16); // capped at 32*0.5
	});

	test('is not fooled by the version number (2.5)', () => {
		// must read the :1.5b tag, not the "2.5" in the family name
		assert.strictEqual(localModelSizeBonus('qwen2.5-coder:1.5b'), 0.75);
	});

	test('unnumbered tag (":latest") is treated as a capable flagship, not the smallest', () => {
		assert.strictEqual(localModelSizeBonus('qwen2.5-coder:latest'), 4); // 8 * 0.5
		// REGRESSION: :latest (7B) must outrank :1.5b so the router stops preferring the tiny coder
		assert.ok(localModelSizeBonus('qwen2.5-coder:latest') > localModelSizeBonus('qwen2.5-coder:1.5b'));
		assert.ok(localModelSizeBonus('qwen2.5-coder:3b') > localModelSizeBonus('qwen2.5-coder:1.5b'));
	});
});

suite('smallLocalModelCodePenalty', () => {
	test('demotes sub-7B local coders decisively on code tasks', () => {
		assert.strictEqual(smallLocalModelCodePenalty('qwen2.5-coder:1.5b'), -15);
		assert.strictEqual(smallLocalModelCodePenalty('qwen2.5-coder:3b'), -15);
		assert.strictEqual(smallLocalModelCodePenalty('some-coder:5b'), -8);
	});

	test('does NOT penalize a 7B+ coder or an unnumbered/flagship tag', () => {
		assert.strictEqual(smallLocalModelCodePenalty('qwen2.5-coder:7b'), 0);
		assert.strictEqual(smallLocalModelCodePenalty('codestral:22b'), 0);
		assert.strictEqual(smallLocalModelCodePenalty('qwen2.5-coder:latest'), 0);
	});

	test('REGRESSION: the 3B can no longer tie/beat the 7B on a code task (delta exceeds learned-score noise)', () => {
		// rule score = coderBonus + sizeBonus + penalty
		const score7b = codingModelScoreBonus('qwen2.5-coder:7b', true) + localModelSizeBonus('qwen2.5-coder:7b') + smallLocalModelCodePenalty('qwen2.5-coder:7b');
		const score3b = codingModelScoreBonus('qwen2.5-coder:3b', true) + localModelSizeBonus('qwen2.5-coder:3b') + smallLocalModelCodePenalty('qwen2.5-coder:3b');
		assert.ok(score7b - score3b >= 14, `delta ${score7b - score3b} must exceed the ~6pt learned swing /0.7`);
	});
});

suite('pickBestCoderModelName', () => {
	test('picks the largest coder among mixed local models', () => {
		assert.strictEqual(
			pickBestCoderModelName(['qwen2.5-coder:3b', 'qwen2.5-coder:latest', 'llama3.2:3b']),
			'qwen2.5-coder:latest'
		);
	});

	test('prefers a coder over a larger non-coder', () => {
		// the coder name bonus (+25) outweighs any size bonus a non-coder can earn
		assert.strictEqual(pickBestCoderModelName(['llama3:70b', 'qwen2.5-coder:3b']), 'qwen2.5-coder:3b');
	});

	test('falls back to the sole installed model (small-only user is NOT excluded)', () => {
		assert.strictEqual(pickBestCoderModelName(['qwen2.5-coder:1.5b']), 'qwen2.5-coder:1.5b');
		assert.strictEqual(pickBestCoderModelName(['llama3.2:3b']), 'llama3.2:3b');
	});

	test('null only for an empty list', () => {
		assert.strictEqual(pickBestCoderModelName([]), null);
	});
});
