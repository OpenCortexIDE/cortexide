/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { LLAMA_SERVER_DEFAULT_ENDPOINT } from '../../common/onboardingHelpers.js';
import { CORTEXIDE_APP_DATA_DIR, CORTEXIDE_DATA_FOLDER } from '../../common/extensionTransferPaths.js';

suite('onboardingHelpers', () => {
	test('LLAMA_SERVER_DEFAULT_ENDPOINT targets llama.cpp default port', () => {
		assert.strictEqual(LLAMA_SERVER_DEFAULT_ENDPOINT, 'http://127.0.0.1:8080/v1');
	});
});

suite('extensionTransferPaths', () => {
	test('uses CortexIDE product folders not Void', () => {
		assert.strictEqual(CORTEXIDE_DATA_FOLDER, '.cortexide');
		assert.strictEqual(CORTEXIDE_APP_DATA_DIR, 'CortexIDE');
	});
});
