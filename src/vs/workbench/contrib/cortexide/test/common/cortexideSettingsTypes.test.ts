/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { isAutoModelSelection, isValidProviderModelSelection, ModelSelection } from '../../common/cortexideSettingsTypes.js';

/**
 * Pins the "is this the Auto selection?" predicate. chatThreadService routes its two isAutoMode sites
 * (the per-request check and the broader no-selection-or-auto-or-Chat-feature-auto check) through this
 * helper, so its exact semantics -- including the null/undefined cases via optional chaining -- are a
 * routing contract.
 */
suite('cortexideSettingsTypes.isAutoModelSelection', () => {

	test('the literal Auto selection is auto', () => {
		assert.strictEqual(isAutoModelSelection({ providerName: 'auto', modelName: 'auto' }), true);
	});

	test('null is NOT auto (optional chaining short-circuits to false)', () => {
		assert.strictEqual(isAutoModelSelection(null), false);
	});

	test('a concrete provider/model selection is NOT auto', () => {
		assert.strictEqual(isAutoModelSelection({ providerName: 'anthropic', modelName: 'claude-opus-4' }), false);
		assert.strictEqual(isAutoModelSelection({ providerName: 'ollama', modelName: 'qwen2.5-coder:7b' }), false);
	});

	test('BOTH fields must be "auto" (a half-auto selection is not auto)', () => {
		// These shapes are off the ModelSelection union, but the runtime predicate must still demand both.
		assert.strictEqual(isAutoModelSelection({ providerName: 'auto', modelName: 'gpt-4o' } as unknown as ModelSelection), false);
		assert.strictEqual(isAutoModelSelection({ providerName: 'openAI', modelName: 'auto' } as unknown as ModelSelection), false);
	});

	test('isAutoModelSelection and isValidProviderModelSelection are complementary on the Auto selection', () => {
		const auto: ModelSelection = { providerName: 'auto', modelName: 'auto' };
		const concrete: ModelSelection = { providerName: 'anthropic', modelName: 'claude-opus-4' };
		assert.strictEqual(isAutoModelSelection(auto), true);
		assert.strictEqual(isValidProviderModelSelection(auto), false);
		assert.strictEqual(isAutoModelSelection(concrete), false);
		assert.strictEqual(isValidProviderModelSelection(concrete), true);
	});
});
