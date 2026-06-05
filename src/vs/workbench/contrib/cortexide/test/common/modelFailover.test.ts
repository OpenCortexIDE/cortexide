/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	pickNextFailoverModel,
	scoreFailoverCandidate,
	modelKeyOf,
	isLikelyCoderModelName,
	type FailoverCandidate,
} from '../../common/routing/modelFailover.js';

// Small builders to keep the cases readable.
const local = (modelName: string, ctx = 8_000, isCoder = false): FailoverCandidate => ({
	providerName: 'ollama', modelName, isLocal: true, contextWindow: ctx,
	hasNativeToolCalls: false, isKnownCapableProvider: false, isCoder, isFreeTierProvider: false,
});
const cloud = (providerName: FailoverCandidate['providerName'], modelName: string, ctx = 200_000, opts?: Partial<FailoverCandidate>): FailoverCandidate => ({
	providerName, modelName, isLocal: false, contextWindow: ctx,
	hasNativeToolCalls: true, isKnownCapableProvider: true, isCoder: false, isFreeTierProvider: false, ...opts,
});

suite('modelFailover.pickNextFailoverModel', () => {

	test('THE BIG ONE: a failing LOCAL model fails over to the configured cloud model', () => {
		const candidates = [local('llama3.2:3b'), cloud('anthropic', 'claude-sonnet-4-6')];
		const pick = pickNextFailoverModel(candidates, {
			excludeKeys: new Set([modelKeyOf(local('llama3.2:3b'))]),
			localOnly: false,
			preferNonLocal: true,
		});
		assert.ok(pick);
		assert.strictEqual(pick!.providerName, 'anthropic');
		assert.strictEqual(pick!.modelName, 'claude-sonnet-4-6');
	});

	test('never re-picks a model already in excludeKeys', () => {
		const a = cloud('anthropic', 'claude-sonnet-4-6');
		const b = cloud('openAI', 'gpt-5');
		const pick = pickNextFailoverModel([a, b], {
			excludeKeys: new Set([modelKeyOf(a)]),
			localOnly: false,
			preferNonLocal: true,
		});
		assert.ok(pick);
		assert.strictEqual(pick!.providerName, 'openAI');
	});

	test('localOnly (privacy): NEVER escalates to a cloud model even if one is configured', () => {
		const candidates = [local('qwen2.5-coder:7b', 32_000, true), cloud('anthropic', 'claude-sonnet-4-6')];
		const pick = pickNextFailoverModel(candidates, {
			excludeKeys: new Set([modelKeyOf(local('llama3.2:3b'))]), // a different local model failed
			localOnly: true,
			preferNonLocal: true,
		});
		assert.ok(pick);
		assert.strictEqual(pick!.isLocal, true, 'must stay local under localOnly');
		assert.strictEqual(pick!.providerName, 'ollama');
	});

	test('localOnly with NO other local model available returns null (does not leak to cloud)', () => {
		const onlyFailingLocalAndCloud = [local('llama3.2:3b'), cloud('anthropic', 'claude-sonnet-4-6')];
		const pick = pickNextFailoverModel(onlyFailingLocalAndCloud, {
			excludeKeys: new Set([modelKeyOf(local('llama3.2:3b'))]),
			localOnly: true,
			preferNonLocal: true,
		});
		assert.strictEqual(pick, null);
	});

	test('returns null when every candidate is excluded', () => {
		const a = cloud('anthropic', 'claude-sonnet-4-6');
		const pick = pickNextFailoverModel([a], {
			excludeKeys: new Set([modelKeyOf(a)]),
			localOnly: false,
			preferNonLocal: true,
		});
		assert.strictEqual(pick, null);
	});

	test('prefers a known-capable native provider over a non-capable cloud provider', () => {
		const capable = cloud('anthropic', 'claude-sonnet-4-6', 200_000);
		const obscure = cloud('openAICompatible', 'some-proxy-model', 200_000, { isKnownCapableProvider: false });
		const pick = pickNextFailoverModel([obscure, capable], {
			excludeKeys: new Set(), localOnly: false, preferNonLocal: true,
		});
		assert.strictEqual(pick!.providerName, 'anthropic');
	});

	test('among local-only candidates, prefers a coder + larger context (no preferNonLocal advantage)', () => {
		const general = local('llama3.2:3b', 8_000, false);
		const coderBig = local('qwen2.5-coder:7b', 32_000, true);
		const pick = pickNextFailoverModel([general, coderBig], {
			excludeKeys: new Set(), localOnly: true, preferNonLocal: false,
		});
		assert.strictEqual(pick!.modelName, 'qwen2.5-coder:7b');
	});

	test('free-tier exhausted (avoidFreeTier): prefers the BYO-key cloud model over local AND over other free-tier cloud', () => {
		// User's real scenario: gemini/groq free tiers are rate-limited, they have a Pollinations API key,
		// and a local model. Expectation: use Pollinations (BYO cloud) — NOT another rate-limited free tier,
		// NOT local.
		const rateLimitedGemini = cloud('gemini', 'gemini-2.5-flash', 1_000_000, { isFreeTierProvider: true });
		const rateLimitedGroq = cloud('groq', 'llama-3.3-70b', 128_000, { isFreeTierProvider: true });
		const pollinations = cloud('pollinations', 'openai', 128_000, { isKnownCapableProvider: false, isFreeTierProvider: false });
		const localModel = local('qwen2.5-coder:7b', 32_000, true);
		const pick = pickNextFailoverModel([rateLimitedGemini, rateLimitedGroq, pollinations, localModel], {
			excludeKeys: new Set([modelKeyOf(rateLimitedGemini)]), // gemini just failed
			localOnly: false,
			preferNonLocal: true,
			avoidFreeTier: true,
		});
		assert.ok(pick);
		assert.strictEqual(pick!.providerName, 'pollinations', 'should use the BYO cloud key, not local or another free tier');
	});

	test('avoidFreeTier with ONLY free-tier cloud + local falls back to LOCAL (free tiers are all throttled)', () => {
		const rateLimitedGemini = cloud('gemini', 'gemini-2.5-flash', 1_000_000, { isFreeTierProvider: true });
		const localModel = local('qwen2.5-coder:7b', 32_000, true);
		const pick = pickNextFailoverModel([rateLimitedGemini, localModel], {
			excludeKeys: new Set(), localOnly: false, preferNonLocal: true, avoidFreeTier: true,
		});
		assert.ok(pick);
		assert.strictEqual(pick!.isLocal, true, 'with no BYO cloud and throttled free tiers, local is the right target');
	});

	test('deterministic: equal scores break ties by stable key order', () => {
		const a = cloud('anthropic', 'aaa');
		const b = cloud('anthropic', 'bbb');
		const pick1 = pickNextFailoverModel([b, a], { excludeKeys: new Set(), localOnly: false, preferNonLocal: true });
		const pick2 = pickNextFailoverModel([a, b], { excludeKeys: new Set(), localOnly: false, preferNonLocal: true });
		assert.strictEqual(pick1!.modelName, pick2!.modelName);
		assert.strictEqual(pick1!.modelName, 'aaa');
	});
});

suite('modelFailover.scoreFailoverCandidate', () => {
	test('preferNonLocal puts any cloud model above any local model', () => {
		const bestLocal = local('qwen2.5-coder:32b', 128_000, true);
		const worstCloud = cloud('openAICompatible', 'x', 8_000, { isKnownCapableProvider: false, hasNativeToolCalls: false });
		assert.ok(
			scoreFailoverCandidate(worstCloud, { preferNonLocal: true }) >
			scoreFailoverCandidate(bestLocal, { preferNonLocal: true }),
			'a cloud model must outrank any local model when escalating away from local'
		);
	});

	test('native tool-calling and known-capable providers raise the score', () => {
		const base = cloud('groq', 'llama', 32_000, { hasNativeToolCalls: false, isKnownCapableProvider: false });
		const better = cloud('groq', 'llama', 32_000, { hasNativeToolCalls: true, isKnownCapableProvider: true });
		assert.ok(scoreFailoverCandidate(better, { preferNonLocal: false }) > scoreFailoverCandidate(base, { preferNonLocal: false }));
	});
});

suite('modelFailover.isLikelyCoderModelName', () => {
	test('recognizes common coder model names', () => {
		for (const n of ['qwen2.5-coder:7b', 'deepseek-coder-v2', 'codellama:13b', 'codestral', 'starcoder2']) {
			assert.strictEqual(isLikelyCoderModelName(n), true, n);
		}
	});
	test('does not flag general chat models', () => {
		for (const n of ['llama3.2:3b', 'gpt-5', 'claude-sonnet-4-6', 'gemini-2.5-flash']) {
			assert.strictEqual(isLikelyCoderModelName(n), false, n);
		}
	});
});
