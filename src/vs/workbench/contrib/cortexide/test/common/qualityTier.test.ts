/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { estimateQualityTier, QualityTierContext } from '../../common/routing/qualityTier.js';

/**
 * The router's pre-flight quality tier (extracted from ModelRouter). It biases model selection before
 * capability scoring, so each tier boundary is pinned here.
 */

const ctx = (over: QualityTierContext): QualityTierContext => ({ ...over });

suite('qualityTier.estimateQualityTier', () => {

	test('a simple question with no media -> cheap_fast', () => {
		assert.strictEqual(estimateQualityTier(ctx({ isSimpleQuestion: true })), 'cheap_fast');
	});

	test('a simple question is NOT cheap_fast when it has images or PDFs (falls back to standard)', () => {
		assert.strictEqual(estimateQualityTier(ctx({ isSimpleQuestion: true, hasImages: true })), 'standard');
		assert.strictEqual(estimateQualityTier(ctx({ isSimpleQuestion: true, hasPDFs: true })), 'standard');
	});

	test('a simple question that also requires complex reasoning -> escalate (reasoning wins)', () => {
		assert.strictEqual(estimateQualityTier(ctx({ isSimpleQuestion: true, requiresComplexReasoning: true })), 'escalate');
	});

	test('escalate triggers: complex reasoning, multi-step, security, or a large context', () => {
		assert.strictEqual(estimateQualityTier(ctx({ requiresComplexReasoning: true })), 'escalate');
		assert.strictEqual(estimateQualityTier(ctx({ isMultiStepTask: true })), 'escalate');
		assert.strictEqual(estimateQualityTier(ctx({ isSecurityTask: true })), 'escalate');
		assert.strictEqual(estimateQualityTier(ctx({ contextSize: 100_001 })), 'escalate');
	});

	test('context-size boundary: exactly 100k is NOT large (strict >), so it stays standard', () => {
		assert.strictEqual(estimateQualityTier(ctx({ contextSize: 100_000 })), 'standard');
		assert.strictEqual(estimateQualityTier(ctx({ contextSize: 100_001 })), 'escalate');
	});

	test('an empty / ordinary context -> standard', () => {
		assert.strictEqual(estimateQualityTier(ctx({})), 'standard');
		assert.strictEqual(estimateQualityTier(ctx({ contextSize: 5000 })), 'standard');
	});
});
