/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { decideToolSynthesis, type ToolSynthesisInputs } from '../../common/toolSynthesisDecision.js';

// A baseline that DOES synthesize: agent mode, action request, first retry done, model supports tools.
const base = (over: Partial<ToolSynthesisInputs> = {}): ToolSynthesisInputs => ({
	chatMode: 'agent',
	hasToolCall: false,
	fullText: 'I will create the file for you.',
	hasOriginalUserMessage: true,
	userRequest: 'create a file called fib.py', // already lowercased (caller lowercases)
	hasImages: false,
	hasSynthesizedForRequest: false,
	filesReadInQuery: 0,
	maxFilesReadPerQuery: 10,
	fileReadLimitExceeded: false,
	modelSupportsTools: true,
	nAttempts: 1,
	toolsExecutedCount: 0,
	...over,
});

suite('decideToolSynthesis', () => {

	test('baseline action request synthesizes', () => {
		const d = decideToolSynthesis(base());
		assert.strictEqual(d.isActionRequest, true);
		assert.strictEqual(d.shouldUseTools, true);
		assert.strictEqual(d.looksFinal, false);
		assert.strictEqual(d.shouldSynthesize, true);
	});

	// ---- outer-gate failures ----
	test('chatMode normal: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ chatMode: 'normal' })).shouldSynthesize, false);
	});
	test('plan mode is allowed (same as agent)', () => {
		assert.strictEqual(decideToolSynthesis(base({ chatMode: 'plan' })).shouldSynthesize, true);
	});
	test('already has a tool call: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ hasToolCall: true })).shouldSynthesize, false);
	});
	test('empty/whitespace reply: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ fullText: '   ' })).shouldSynthesize, false);
	});
	test('already synthesized this request: no synthesis (one-shot)', () => {
		assert.strictEqual(decideToolSynthesis(base({ hasSynthesizedForRequest: true })).shouldSynthesize, false);
	});
	test('file-read limit exceeded: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ fileReadLimitExceeded: true })).shouldSynthesize, false);
	});
	test('files read at cap: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ filesReadInQuery: 10, maxFilesReadPerQuery: 10 })).shouldSynthesize, false);
	});
	test('model does not support tools: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ modelSupportsTools: false })).shouldSynthesize, false);
	});
	test('no original user message: no synthesis', () => {
		assert.strictEqual(decideToolSynthesis(base({ hasOriginalUserMessage: false })).shouldSynthesize, false);
	});

	// ---- inner-gate logic ----
	test('nAttempts 0: gate not yet open even though shouldUseTools is true', () => {
		const d = decideToolSynthesis(base({ nAttempts: 0 }));
		assert.strictEqual(d.shouldUseTools, true);
		assert.strictEqual(d.shouldSynthesize, false);
	});
	test('already acted (a tool ran this turn): trailing prose is not unfulfilled intent', () => {
		const d = decideToolSynthesis(base({ toolsExecutedCount: 1 }));
		assert.strictEqual(d.alreadyActed, true);
		assert.strictEqual(d.shouldSynthesize, false);
	});
	test('action word but a question framing (what/how/why/explain) is NOT an action request', () => {
		assert.strictEqual(decideToolSynthesis(base({ userRequest: 'what should i change in the config' })).isActionRequest, false);
		assert.strictEqual(decideToolSynthesis(base({ userRequest: 'explain how to build it' })).isActionRequest, false);
		assert.strictEqual(decideToolSynthesis(base({ userRequest: 'why did you remove that' })).isActionRequest, false);
	});

	test('codebase query (what is the api structure) requires tools', () => {
		const d = decideToolSynthesis(base({ userRequest: 'what is the api structure of this project' }));
		assert.strictEqual(d.isCodebaseQuery, true);
		assert.strictEqual(d.shouldSynthesize, true);
	});
	test('web query (look up / latest) requires tools', () => {
		assert.strictEqual(decideToolSynthesis(base({ userRequest: 'look up the cortexide docs online' })).isWebQuery, true);
		const d = decideToolSynthesis(base({ userRequest: 'what is the latest react version' }));
		assert.strictEqual(d.isWebQuery, true);
		assert.strictEqual(d.shouldSynthesize, true);
	});

	test('shouldUseTools is false when the reply already contains a tool tag', () => {
		const d = decideToolSynthesis(base({ fullText: 'Sure: <read_file>src/a.ts</read_file>' }));
		assert.strictEqual(d.isActionRequest, true);
		assert.strictEqual(d.shouldUseTools, false);
		assert.strictEqual(d.shouldSynthesize, false);
	});

	test('looksFinal reply (completed + closer) blocks synthesis', () => {
		const d = decideToolSynthesis(base({ fullText: "I've created the file. Let me know if you'd like anything else." }));
		assert.strictEqual(d.looksFinal, true);
		assert.strictEqual(d.shouldSynthesize, false);
	});

	test('image-analysis query (images + describe) blocks synthesis', () => {
		const d = decideToolSynthesis(base({ hasImages: true, userRequest: 'describe this image please' }));
		assert.strictEqual(d.isImageAnalysisQuery, true);
		assert.strictEqual(d.shouldSynthesize, false);
	});
	test('images + short/empty request is treated as image analysis', () => {
		const d = decideToolSynthesis(base({ hasImages: true, userRequest: 'fix' }));
		assert.strictEqual(d.isImageAnalysisQuery, true);
		assert.strictEqual(d.shouldSynthesize, false);
	});
	test('codebase query is suppressed when images present and the question is about "this"', () => {
		// hasImages + userRequest includes 'this' negates isCodebaseQuery (likely about the image)
		const d = decideToolSynthesis(base({ hasImages: true, userRequest: 'what is this in the codebase' }));
		assert.strictEqual(d.isCodebaseQuery, false);
	});
});
