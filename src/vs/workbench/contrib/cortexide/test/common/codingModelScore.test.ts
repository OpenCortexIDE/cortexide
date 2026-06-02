/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { codingModelScoreBonus, localModelSizeBonus } from '../../common/routing/codingModelScore.js';

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
