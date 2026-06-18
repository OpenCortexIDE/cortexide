/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { codingModelScoreBonus, localModelSizeBonus, smallLocalModelCodePenalty, pickBestCoderModelName, isCapableLocalCoder, isCapableLocalModel, parseParamSizeBillions } from '../../common/routing/codingModelScore.js';

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

suite('isCapableLocalCoder', () => {
	test('true for a 7B+ coder or an unnumbered flagship coder tag', () => {
		assert.strictEqual(isCapableLocalCoder('qwen2.5-coder:7b'), true);
		assert.strictEqual(isCapableLocalCoder('qwen2.5-coder:latest'), true);
		assert.strictEqual(isCapableLocalCoder('codestral:22b'), true);
		assert.strictEqual(isCapableLocalCoder('deepseek-coder-v2:16b'), true);
	});

	test('false for a sub-7B coder (below the agentic floor)', () => {
		assert.strictEqual(isCapableLocalCoder('qwen2.5-coder:3b'), false);
		assert.strictEqual(isCapableLocalCoder('qwen2.5-coder:1.5b'), false);
	});

	test('false for a non-coder regardless of size', () => {
		assert.strictEqual(isCapableLocalCoder('llama3.1:70b'), false);
		assert.strictEqual(isCapableLocalCoder('llama3.2:3b'), false);
		assert.strictEqual(isCapableLocalCoder('mistral:7b'), false);
	});

	test('a tiny ":latest" coder is NOT capable once the REAL size is known', () => {
		assert.strictEqual(isCapableLocalCoder('deepseek-coder:latest'), true); // name alone: assume flagship
		assert.strictEqual(isCapableLocalCoder('deepseek-coder:latest', '1.3B'), false); // real size: it's tiny
		assert.strictEqual(isCapableLocalCoder('qwen2.5-coder:latest', '7.6B'), true);
	});
});

suite('isCapableLocalModel (web-tool gate -- size only, NOT coder-specific)', () => {
	test('true for a capable GENERAL (non-coder) model -- this is the Auto/llama3 fix', () => {
		// llama3:latest is 8B but not a coder -> isCapableLocalCoder was false (denied web tools);
		// isCapableLocalModel is TRUE so Auto resolving to llama3 still gets web_search.
		assert.strictEqual(isCapableLocalModel('llama3:latest', '8.0B'), true);
		assert.strictEqual(isCapableLocalModel('llama3:latest'), true); // name alone -> assume capable
		assert.strictEqual(isCapableLocalModel('llama3.1:70b'), true);
		assert.strictEqual(isCapableLocalModel('mistral:7b'), true);
		assert.strictEqual(isCapableLocalModel('gemma2:9b'), true);
	});

	test('true for a capable coder too (superset of isCapableLocalCoder by size)', () => {
		assert.strictEqual(isCapableLocalModel('qwen2.5-coder:7b'), true);
		assert.strictEqual(isCapableLocalModel('qwen2.5-coder:latest', '7.6B'), true);
		assert.strictEqual(isCapableLocalModel('codestral:22b'), true);
	});

	test('false for small (<=3B) models -- they stay on the COMPACT toolset (no web)', () => {
		assert.strictEqual(isCapableLocalModel('llama3.2:3b'), false);
		assert.strictEqual(isCapableLocalModel('qwen2.5-coder:1.5b'), false);
		assert.strictEqual(isCapableLocalModel('phi3:3.8b'), false); // 3.8 < 7
	});

	test('real size overrides an optimistic ":latest" tag', () => {
		assert.strictEqual(isCapableLocalModel('tinyllama:latest', '1.1B'), false);
		assert.strictEqual(isCapableLocalModel('llama3:latest', '8.0B'), true);
	});
});

suite('parseParamSizeBillions + real-size routing (rank 6)', () => {
	test('parses ollama parameter_size strings and tags; null for unnumbered/none', () => {
		assert.strictEqual(parseParamSizeBillions('7.6B'), 7.6);
		assert.strictEqual(parseParamSizeBillions('1.3B'), 1.3);
		assert.strictEqual(parseParamSizeBillions('32B'), 32);
		assert.strictEqual(parseParamSizeBillions('qwen2.5-coder:1.5b'), 1.5); // not fooled by the 2.5 version
		assert.strictEqual(parseParamSizeBillions('qwen2.5-coder:latest'), null);
		assert.strictEqual(parseParamSizeBillions(undefined), null);
	});

	test('REAL size overrides the ":latest"->8 assumption in localModelSizeBonus', () => {
		assert.strictEqual(localModelSizeBonus('deepseek-coder:latest'), 4); // name-only: assume 8 -> 4
		assert.strictEqual(localModelSizeBonus('deepseek-coder:latest', '1.3B'), 0.65); // real: 1.3 -> 0.65
	});

	test('REGRESSION: a tiny ":latest" coder is penalized once the real size is known', () => {
		assert.strictEqual(smallLocalModelCodePenalty('deepseek-coder:latest'), 0); // name-only: assume flagship
		assert.strictEqual(smallLocalModelCodePenalty('deepseek-coder:latest', '1.3B'), -15); // real: tiny
	});

	test('REGRESSION: with real sizes, qwen2.5-coder:latest (7.6B) DECISIVELY beats deepseek-coder:latest (1.3B)', () => {
		const score = (name: string, size: string) =>
			codingModelScoreBonus(name, true) + localModelSizeBonus(name, size) + smallLocalModelCodePenalty(name, size);
		const qwen = score('qwen2.5-coder:latest', '7.6B');
		const deepseek = score('deepseek-coder:latest', '1.3B');
		assert.ok(qwen - deepseek >= 14, `qwen ${qwen} must decisively beat deepseek ${deepseek}`);
	});

	test('pickBestCoderModelName uses the real-size lookup to avoid the tiny ":latest" trap', () => {
		const sizeOf = (n: string) => ({ 'deepseek-coder:latest': '1.3B', 'qwen2.5-coder:latest': '7.6B' } as Record<string, string>)[n];
		// deepseek-coder:latest is listed FIRST, but the real size makes qwen win
		assert.strictEqual(
			pickBestCoderModelName(['deepseek-coder:latest', 'qwen2.5-coder:latest'], sizeOf),
			'qwen2.5-coder:latest'
		);
	});
});
