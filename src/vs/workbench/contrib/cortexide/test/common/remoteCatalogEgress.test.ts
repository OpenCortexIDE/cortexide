/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { RemoteCatalogService } from '../../common/remoteCatalogService.js';
import { ICortexideSettingsService } from '../../common/cortexideSettingsService.js';
import { ProviderName, RoutingPolicy } from '../../common/cortexideSettingsTypes.js';

/**
 * Phase 8 Inc 1: prove the remote model-catalog fetch (which contacts a cloud API with the
 * user's API key) is BLOCKED under local-only privacy mode -- a real egress that was
 * previously ungated. Spies on global fetch to assert no outbound call happens.
 */
suite('remoteCatalogService egress gate', () => {

	function makeService(routingPolicy: RoutingPolicy | undefined, provider: ProviderName = 'openAI') {
		const fakeSettings = {
			state: {
				globalSettings: { routingPolicy },
				settingsOfProvider: { [provider]: { _didFillInProviderSettings: true, apiKey: 'sk-test-key' } },
			},
		} as unknown as ICortexideSettingsService;
		return new RemoteCatalogService(fakeSettings);
	}

	function withFetchSpy<T>(impl: (url: string) => any, body: (calls: () => number) => Promise<T>): Promise<T> {
		const orig = (globalThis as any).fetch;
		let n = 0;
		(globalThis as any).fetch = async (url: string) => { n++; return impl(url); };
		return body(() => n).finally(() => { (globalThis as any).fetch = orig; });
	}

	test('local-only: catalog fetch is blocked, no outbound call, returns []', async () => {
		const svc = makeService('local-only');
		await withFetchSpy(
			() => ({ ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) }),
			async (calls) => {
				const models = await svc.fetchCatalog('openAI', true);
				assert.deepStrictEqual(models, [], 'should return empty under local-only');
				assert.strictEqual(calls(), 0, 'no network call should be made under local-only');
			}
		);
	});

	test('auto-cheapest: catalog fetch proceeds and parses models', async () => {
		const svc = makeService('auto-cheapest');
		await withFetchSpy(
			(url) => {
				assert.ok(url.includes('api.openai.com'), 'should hit the OpenAI catalog endpoint');
				return { ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'text-embedding-3' }] }) };
			},
			async (calls) => {
				const models = await svc.fetchCatalog('openAI', true);
				assert.strictEqual(calls(), 1, 'exactly one network call when not local-only');
				// embeddings model filtered out by isLikelyChatModel; gpt-4o kept
				assert.deepStrictEqual(models.map(m => m.id), ['gpt-4o']);
			}
		);
	});

	test('undefined routingPolicy (default) allows the fetch', async () => {
		const svc = makeService(undefined);
		await withFetchSpy(
			() => ({ ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) }),
			async (calls) => {
				await svc.fetchCatalog('openAI', true);
				assert.strictEqual(calls(), 1);
			}
		);
	});

	test('cached results are still served under local-only WITHOUT a new fetch', async () => {
		// Populate the cache while NOT local-only, then flip to local-only and read again.
		const fakeSettings = {
			state: {
				globalSettings: { routingPolicy: 'auto-cheapest' as RoutingPolicy | undefined },
				settingsOfProvider: { openAI: { _didFillInProviderSettings: true, apiKey: 'sk-test-key' } },
			},
		} as unknown as ICortexideSettingsService;
		const svc = new RemoteCatalogService(fakeSettings);

		await withFetchSpy(
			() => ({ ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) }),
			async (calls) => {
				const first = await svc.fetchCatalog('openAI', true); // populates cache, 1 call
				assert.deepStrictEqual(first.map(m => m.id), ['gpt-4o']);
				assert.strictEqual(calls(), 1);

				// Flip to local-only; a non-forced read should serve cache, no new fetch.
				(fakeSettings.state.globalSettings as any).routingPolicy = 'local-only';
				const cached = await svc.fetchCatalog('openAI', false);
				assert.deepStrictEqual(cached.map(m => m.id), ['gpt-4o'], 'cached models served');
				assert.strictEqual(calls(), 1, 'no new outbound call -- cache served, no egress');

				// But a FORCED refresh under local-only must NOT call out.
				const forced = await svc.fetchCatalog('openAI', true);
				assert.deepStrictEqual(forced, [], 'forced refresh blocked under local-only');
				assert.strictEqual(calls(), 1, 'still no new outbound call under local-only');
			}
		);
	});
});
