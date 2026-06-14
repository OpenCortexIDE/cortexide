/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { isLoopbackEndpoint } from '../../common/loopbackEndpoint.js';

/**
 * The local-endpoint detector for openAICompatible/liteLLM providers (extracted from 4 byte-identical
 * inline copies in sendLLMMessage.impl.ts). It drives local-provider optimizations, and crucially matches
 * by HOSTNAME (not substring) so a remote host whose name merely contains "localhost" is NOT treated as
 * local. Not a security boundary (egress is gated by egressPolicy).
 */
suite('loopbackEndpoint.isLoopbackEndpoint', () => {

	test('localhost / 127.0.0.1 / 0.0.0.0 endpoints are local (the common Ollama/local-server cases)', () => {
		assert.strictEqual(isLoopbackEndpoint('http://localhost:11434/v1'), true);
		assert.strictEqual(isLoopbackEndpoint('http://127.0.0.1:1234/v1'), true);
		assert.strictEqual(isLoopbackEndpoint('http://0.0.0.0:8080'), true);
		assert.strictEqual(isLoopbackEndpoint('https://localhost'), true);
	});

	test('hostname match is case-insensitive', () => {
		assert.strictEqual(isLoopbackEndpoint('http://LOCALHOST:11434'), true);
		assert.strictEqual(isLoopbackEndpoint('HTTP://LocalHost/v1'), true);
	});

	test('a remote host is NOT local -- matched by hostname, never by substring', () => {
		assert.strictEqual(isLoopbackEndpoint('https://api.openai.com/v1'), false);
		assert.strictEqual(isLoopbackEndpoint('http://localhost.evil.com/v1'), false);   // substring "localhost" must NOT match
		assert.strictEqual(isLoopbackEndpoint('http://127.0.0.1.evil.com'), false);
		assert.strictEqual(isLoopbackEndpoint('http://192.168.1.5:1234'), false);        // LAN is not loopback
		assert.strictEqual(isLoopbackEndpoint('http://10.0.0.1'), false);
	});

	test('missing, empty, or unparseable endpoints are non-local (the safe default)', () => {
		assert.strictEqual(isLoopbackEndpoint(undefined), false);
		assert.strictEqual(isLoopbackEndpoint(''), false);
		assert.strictEqual(isLoopbackEndpoint('not a url'), false);
		assert.strictEqual(isLoopbackEndpoint('localhost:11434'), false); // no scheme -> URL parse treats "localhost" as the scheme, not the host
	});
});
