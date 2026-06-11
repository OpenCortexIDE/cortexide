/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { VectorStoreService } from '../../common/vectorStore.js';
import { RoutingPolicy } from '../../common/cortexideSettingsTypes.js';

/**
 * Phase 8 Inc 1b: prove a REMOTE vector store (which would ship redacted code text +
 * embeddings off the machine) is blocked under local-only privacy mode, while a localhost
 * vector store still works. Spies on global fetch to assert no outbound call.
 */
suite('vectorStore egress gate', () => {

	function makeService(opts: { routingPolicy: RoutingPolicy | undefined; vectorStore: 'none' | 'qdrant' | 'chroma'; vectorStoreUrl?: string }) {
		const config = {
			getValue: (key: string) => {
				if (key === 'cortexide.rag.vectorStore') { return opts.vectorStore; }
				if (key === 'cortexide.rag.vectorStoreUrl') { return opts.vectorStoreUrl ?? ''; }
				return undefined;
			},
			onDidChangeConfiguration: () => ({ dispose() { } }),
		};
		const log = { trace() { }, debug() { }, info() { }, warn() { }, error() { } };
		const settings = { state: { globalSettings: { routingPolicy: opts.routingPolicy } } };
		return new VectorStoreService(config as any, log as any, settings as any);
	}

	function withFetchSpy<T>(body: (calls: () => number) => Promise<T>): Promise<T> {
		const orig = (globalThis as any).fetch;
		let n = 0;
		(globalThis as any).fetch = async () => { n++; return { ok: true, status: 200, json: async () => ({}) }; };
		return body(() => n).finally(() => { (globalThis as any).fetch = orig; });
	}

	test('local-only + remote vectorStoreUrl: disabled, all ops no-op, zero fetch', async () => {
		const svc = makeService({ routingPolicy: 'local-only', vectorStore: 'qdrant', vectorStoreUrl: 'https://qdrant.example.com:6333' });
		await withFetchSpy(async (calls) => {
			assert.strictEqual(svc.isEnabled(), false, 'remote store disabled under local-only');
			await svc.initialize();
			await svc.index([{ id: 'a', text: 'secret code', embedding: [0.1, 0.2] }]);
			const r = await svc.query([0.1, 0.2], 5);
			assert.deepStrictEqual(r, [], 'query returns empty when blocked');
			await svc.delete(['a']);
			await svc.clear();
			assert.strictEqual(calls(), 0, 'no outbound call to the remote vector store under local-only');
		});
	});

	test('local-only + localhost vectorStoreUrl: still enabled (loopback never leaves machine)', async () => {
		const svc = makeService({ routingPolicy: 'local-only', vectorStore: 'qdrant', vectorStoreUrl: 'http://localhost:6333' });
		assert.strictEqual(svc.isEnabled(), true, 'localhost store allowed under local-only');
	});

	test('local-only + qdrant default (no url => localhost): still enabled', async () => {
		const svc = makeService({ routingPolicy: 'local-only', vectorStore: 'qdrant' });
		assert.strictEqual(svc.isEnabled(), true);
	});

	test('not local-only + remote vectorStoreUrl: enabled (no privacy restriction)', async () => {
		const svc = makeService({ routingPolicy: 'auto-cheapest', vectorStore: 'qdrant', vectorStoreUrl: 'https://qdrant.example.com:6333' });
		assert.strictEqual(svc.isEnabled(), true);
	});

	test('provider none: not blocked regardless of policy (NoOp store)', async () => {
		const svc = makeService({ routingPolicy: 'local-only', vectorStore: 'none' });
		assert.strictEqual(svc.isEnabled(), false); // NoOp is always disabled, but not via the egress gate
	});

	test('index() under local-only + remote makes no outbound call even if isEnabled() not consulted', async () => {
		const svc = makeService({ routingPolicy: 'local-only', vectorStore: 'chroma', vectorStoreUrl: 'https://chroma.example.com:8000' });
		await withFetchSpy(async (calls) => {
			await svc.index([{ id: 'x', text: 'proprietary', embedding: [1, 2, 3] }]);
			assert.strictEqual(calls(), 0, 'index must not contact the remote store under local-only');
		});
	});
});
