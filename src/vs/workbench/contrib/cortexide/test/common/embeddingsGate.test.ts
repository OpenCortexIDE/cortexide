/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { canUseEmbeddings } from '../../common/embeddingsGate.js';

/**
 * The fail-closed gate on computing embeddings. It is a privacy contract: under local-only mode the
 * (unclassifiable) embedding provider must NOT receive code text, so the indexer falls back to BM25.
 */
suite('embeddingsGate.canUseEmbeddings', () => {

	test('no enabled provider -> false (regardless of policy / offline)', () => {
		assert.strictEqual(canUseEmbeddings({ hasEnabledProvider: false, routingPolicy: 'auto-cheapest', isOffline: false }), false);
		assert.strictEqual(canUseEmbeddings({ hasEnabledProvider: false, routingPolicy: 'local-only', isOffline: true }), false);
	});

	test('local-only privacy mode blocks embeddings (fail-closed) even with a provider and online', () => {
		assert.strictEqual(canUseEmbeddings({ hasEnabledProvider: true, routingPolicy: 'local-only', isOffline: false }), false);
	});

	test('offline blocks embeddings (BM25 fallback) even when not local-only', () => {
		assert.strictEqual(canUseEmbeddings({ hasEnabledProvider: true, routingPolicy: 'auto-cheapest', isOffline: true }), false);
	});

	test('all-clear (provider enabled, not local-only, online) -> true', () => {
		assert.strictEqual(canUseEmbeddings({ hasEnabledProvider: true, routingPolicy: 'auto-cheapest', isOffline: false }), true);
		assert.strictEqual(canUseEmbeddings({ hasEnabledProvider: true, routingPolicy: undefined, isOffline: false }), true);
	});
});
