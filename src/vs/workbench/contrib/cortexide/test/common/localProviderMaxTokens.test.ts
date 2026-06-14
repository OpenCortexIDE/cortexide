/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { computeMaxTokensForLocalProvider } from '../../common/localProviderMaxTokens.js';

/**
 * The per-call output-token budget (max_tokens / num_predict), extracted from sendLLMMessage.impl.ts.
 * Local models are slow per token, so autocomplete asks for very few and quick edits a moderate amount;
 * cloud uses a flat default. Used by the FIM, Ollama-FIM, and Ollama-chat paths.
 */
suite('localProviderMaxTokens.computeMaxTokensForLocalProvider', () => {

	test('cloud providers (isLocal=false) always get the flat 300 default, regardless of feature', () => {
		assert.strictEqual(computeMaxTokensForLocalProvider(false, 'Autocomplete'), 300);
		assert.strictEqual(computeMaxTokensForLocalProvider(false, 'Ctrl+K'), 300);
		assert.strictEqual(computeMaxTokensForLocalProvider(false, 'Apply'), 300);
		assert.strictEqual(computeMaxTokensForLocalProvider(false, undefined), 300);
	});

	test('local autocomplete gets a tiny budget for fast suggestions (96)', () => {
		assert.strictEqual(computeMaxTokensForLocalProvider(true, 'Autocomplete'), 96);
	});

	test('local quick-edit features (Ctrl+K, Apply) get a medium budget (200)', () => {
		assert.strictEqual(computeMaxTokensForLocalProvider(true, 'Ctrl+K'), 200);
		assert.strictEqual(computeMaxTokensForLocalProvider(true, 'Apply'), 200);
	});

	test('local Chat (and any other / unknown feature) falls back to the 300 default', () => {
		assert.strictEqual(computeMaxTokensForLocalProvider(true, 'Chat'), 300);
		assert.strictEqual(computeMaxTokensForLocalProvider(true, 'SCM'), 300);
		assert.strictEqual(computeMaxTokensForLocalProvider(true, undefined), 300);
	});
});
