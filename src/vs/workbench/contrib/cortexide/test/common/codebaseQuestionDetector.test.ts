/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { looksLikeCodebaseQuestion } from '../../common/routing/codebaseQuestionDetector.js';

suite('codebaseQuestionDetector', () => {

	test('REGRESSION: substring indicators must not false-positive on ordinary words', () => {
		// "capital" contains "api"; this used to be misrouted as a codebase/code task.
		assert.strictEqual(looksLikeCodebaseQuestion('What is the capital of France? Reply with exactly one word.'), false);
		// "report" contains "repo"; "rerouted" contains "route"; "therapist" contains "api".
		assert.strictEqual(looksLikeCodebaseQuestion('What does this report say?'), false);
		assert.strictEqual(looksLikeCodebaseQuestion('How do I become a therapist?'), false);
		assert.strictEqual(looksLikeCodebaseQuestion('Where was the package rerouted to?'), false);
	});

	test('ordinary general questions are not codebase questions', () => {
		assert.strictEqual(looksLikeCodebaseQuestion('hello'), false);
		assert.strictEqual(looksLikeCodebaseQuestion('What is the weather today?'), false);
		assert.strictEqual(looksLikeCodebaseQuestion('Explain quantum entanglement.'), false);
		assert.strictEqual(looksLikeCodebaseQuestion('Write a haiku about the sea.'), false);
	});

	test('genuine codebase questions are detected (strong patterns)', () => {
		assert.strictEqual(looksLikeCodebaseQuestion('What is this codebase about?'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('Summarize my repo'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('How many endpoints does the API have?'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('Describe the project architecture'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('what is the repository structure'), true);
	});

	test('indicator word + question starter is detected (word-boundary match)', () => {
		// "api" as a whole word, with a question starter.
		assert.strictEqual(looksLikeCodebaseQuestion('What does the api expose?'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('Which routes are defined?'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('Explain the architecture'), true);
	});

	test('indicator word WITHOUT a question starter is not enough on its own', () => {
		// Has the standalone word "api" but is an imperative, not a question.
		assert.strictEqual(looksLikeCodebaseQuestion('Add an api key to the env file'), false);
	});

	test('case-insensitive', () => {
		assert.strictEqual(looksLikeCodebaseQuestion('WHAT IS THIS CODEBASE'), true);
		assert.strictEqual(looksLikeCodebaseQuestion('What Is The Capital Of France'), false);
	});

	// Parity with the (now-removed) inline failover-routing regex in chatThreadService: every phrasing
	// that regex matched must still be detected here, since both paths now use this one detector.
	test('PARITY: the phrasings the old inline failover regex matched are still detected', () => {
		for (const m of [
			'tell me about the codebase',
			'explain this code base',
			'what does the repository do',
			'summarize the repo',
			'describe the project',
			'the architecture of this project',
			'this project structure and organization',
			'the layout of the codebase',
		]) {
			assert.strictEqual(looksLikeCodebaseQuestion(m), true, `should detect: ${m}`);
		}
	});
});
