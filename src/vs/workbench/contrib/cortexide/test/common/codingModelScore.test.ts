/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { codingModelScoreBonus } from '../../common/routing/codingModelScore.js';

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
