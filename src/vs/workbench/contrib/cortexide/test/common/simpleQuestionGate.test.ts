/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { looksLikeSimpleQuestion, isTriviaQuestion } from '../../common/routing/simpleQuestionGate.js';

suite('simpleQuestionGate', () => {

	suite('looksLikeSimpleQuestion', () => {
		test('short general-knowledge questions are simple', () => {
			assert.strictEqual(looksLikeSimpleQuestion('What is the capital of France?'), true);
			assert.strictEqual(looksLikeSimpleQuestion('Explain closures in JavaScript'), true);
			assert.strictEqual(looksLikeSimpleQuestion('How do I center a div in CSS?'), true);
		});
		test('complexity/coding terms disqualify', () => {
			assert.strictEqual(looksLikeSimpleQuestion('Explain my codebase'), false);
			assert.strictEqual(looksLikeSimpleQuestion('How do I fix this error?'), false);
			assert.strictEqual(looksLikeSimpleQuestion('What is the architecture here?'), false);
		});
		test('long messages are not simple', () => {
			assert.strictEqual(looksLikeSimpleQuestion('What is ' + 'x'.repeat(250) + '?'), false);
		});
		test('non-questions are not simple', () => {
			assert.strictEqual(looksLikeSimpleQuestion('Add a health endpoint'), false);
		});
	});

	suite('isTriviaQuestion (the no-tools gate)', () => {
		test('GATES: trivial general-knowledge questions (no tool can help)', () => {
			assert.strictEqual(isTriviaQuestion('What is the capital of France? Reply with exactly one word.'), true);
			assert.strictEqual(isTriviaQuestion('Explain what a closure is'), true);
			assert.strictEqual(isTriviaQuestion('Why is the sky blue?'), true);
			assert.strictEqual(isTriviaQuestion('Who wrote Hamlet?'), true);
		});

		test('DOES NOT gate: anything referencing the workspace / wanting an action', () => {
			// The workflow flagged this exact false-gate risk:
			assert.strictEqual(isTriviaQuestion('What is failing in my build?'), false);
			assert.strictEqual(isTriviaQuestion('How do I run the tests?'), false);
			assert.strictEqual(isTriviaQuestion('What does this function do?'), false);
			assert.strictEqual(isTriviaQuestion('Where is the api defined?'), false);
			assert.strictEqual(isTriviaQuestion('Explain the error in the log'), false); // 'error' + 'log'
		});

		test('DOES NOT gate: codebase questions (handled by codebaseQuestionDetector)', () => {
			assert.strictEqual(isTriviaQuestion('What is this codebase about?'), false);
			assert.strictEqual(isTriviaQuestion('Summarize my repo'), false);
		});

		test('DOES NOT gate: action requests / statements', () => {
			assert.strictEqual(isTriviaQuestion('Add a /health endpoint to the server'), false);
			assert.strictEqual(isTriviaQuestion('Refactor the parser'), false);
		});

		test('errs toward NOT gating when a workspace term is present, even in a general question', () => {
			// Over-conservative is safe: keeps agent tools rather than risk stripping them.
			assert.strictEqual(isTriviaQuestion('What is the fetch api in javascript?'), false);
		});
	});
});
