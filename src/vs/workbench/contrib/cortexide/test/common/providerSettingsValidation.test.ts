/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { isProviderSettingsComplete } from '../../common/providerSettingsValidation.js';
import type { SettingsOfProvider } from '../../common/cortexideSettingsTypes.js';

suite('providerSettingsValidation', () => {
	test('openAICompatible accepts empty apiKey when endpoint is set (llama-server)', () => {
		const settings = {
			endpoint: 'http://127.0.0.1:8080/v1',
			apiKey: '',
			headersJSON: '{}',
			models: [],
		} as unknown as SettingsOfProvider['openAICompatible'];
		assert.strictEqual(isProviderSettingsComplete('openAICompatible', settings), true);
	});

	test('openAICompatible requires endpoint', () => {
		const settings = {
			endpoint: '',
			apiKey: '',
			headersJSON: '{}',
			models: [],
		} as unknown as SettingsOfProvider['openAICompatible'];
		assert.strictEqual(isProviderSettingsComplete('openAICompatible', settings), false);
	});

	test('anthropic requires apiKey', () => {
		const settings = {
			apiKey: '',
			models: [],
		} as unknown as SettingsOfProvider['anthropic'];
		assert.strictEqual(isProviderSettingsComplete('anthropic', settings), false);
	});

	test('ollama accepts endpoint only', () => {
		const settings = {
			endpoint: 'http://127.0.0.1:11434',
			models: [],
		} as unknown as SettingsOfProvider['ollama'];
		assert.strictEqual(isProviderSettingsComplete('ollama', settings), true);
	});
});
