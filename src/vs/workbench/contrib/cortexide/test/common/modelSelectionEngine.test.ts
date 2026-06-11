/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { resolveModelRuntimeCaps, buildFailoverCandidates, type FailoverProviderEntry, type CandidateCaps } from '../../common/modelSelectionEngine.js';
import { isLikelyCoderModelName, KNOWN_CAPABLE_AGENTIC_PROVIDERS } from '../../common/routing/modelFailover.js';
import { freeTierIdOfProviderName } from '../../common/routing/freeTierConstants.js';

// Mirrors the real chatThreadService constants (100/30 iterations, 6/3 tool errors).
const CAPS = {
	maxAgentIterations: 100,
	maxLocalAgentIterations: 30,
	maxConsecutiveToolErrors: 6,
	maxLocalConsecutiveToolErrors: 3,
};

suite('resolveModelRuntimeCaps', () => {
	test('null selection -> non-local, cloud caps', () => {
		assert.deepStrictEqual(resolveModelRuntimeCaps(null, CAPS), { isLocalModel: false, maxAgentIterations: 100, maxConsecutiveToolErrors: 6 });
	});
	test('local provider (ollama) -> local caps (tighter)', () => {
		assert.deepStrictEqual(resolveModelRuntimeCaps({ providerName: 'ollama', modelName: 'qwen2.5-coder:7b' }, CAPS), { isLocalModel: true, maxAgentIterations: 30, maxConsecutiveToolErrors: 3 });
	});
	test('vLLM and lmStudio are also local', () => {
		assert.strictEqual(resolveModelRuntimeCaps({ providerName: 'vLLM', modelName: 'x' }, CAPS).isLocalModel, true);
		assert.strictEqual(resolveModelRuntimeCaps({ providerName: 'lmStudio', modelName: 'x' }, CAPS).isLocalModel, true);
	});
	test('cloud provider (anthropic) -> non-local, cloud caps', () => {
		assert.deepStrictEqual(resolveModelRuntimeCaps({ providerName: 'anthropic', modelName: 'claude-opus-4-8' }, CAPS), { isLocalModel: false, maxAgentIterations: 100, maxConsecutiveToolErrors: 6 });
	});
	test('"auto" pseudo-selection is non-local', () => {
		assert.strictEqual(resolveModelRuntimeCaps({ providerName: 'auto', modelName: 'auto' }, CAPS).isLocalModel, false);
	});
});

const provider = (over: Partial<FailoverProviderEntry> = {}): FailoverProviderEntry => ({
	providerName: 'anthropic',
	didFillInProviderSettings: true,
	models: [{ modelName: 'claude-opus-4-8' }],
	...over,
});
const noCaps = () => null;
const capsFor = (m: Record<string, CandidateCaps>) => (_pn: string, mn: string): CandidateCaps | null => m[mn] ?? null;

suite('buildFailoverCandidates', () => {
	test('builds one candidate per visible model of a configured provider', () => {
		const out = buildFailoverCandidates([provider({ models: [{ modelName: 'a' }, { modelName: 'b' }] })], new Set(), noCaps);
		assert.deepStrictEqual(out.map(c => c.modelName), ['a', 'b']);
	});

	test('skips providers the user never configured', () => {
		const out = buildFailoverCandidates([provider({ didFillInProviderSettings: false })], new Set(), noCaps);
		assert.strictEqual(out.length, 0);
	});

	test('skips hidden models', () => {
		const out = buildFailoverCandidates([provider({ models: [{ modelName: 'a', isHidden: true }, { modelName: 'b' }] })], new Set(), noCaps);
		assert.deepStrictEqual(out.map(c => c.modelName), ['b']);
	});

	test('skips already-tried (excluded) keys', () => {
		const out = buildFailoverCandidates([provider({ models: [{ modelName: 'a' }, { modelName: 'b' }] })], new Set(['anthropic/a']), noCaps);
		assert.deepStrictEqual(out.map(c => c.modelName), ['b']);
	});

	test('RELIABILITY RULE: a LOCAL model never reports native tool calls, even with specialToolFormat', () => {
		const out = buildFailoverCandidates(
			[provider({ providerName: 'ollama', models: [{ modelName: 'qwen2.5-coder:7b' }] })],
			new Set(),
			capsFor({ 'qwen2.5-coder:7b': { specialToolFormat: 'openai-style', contextWindow: 32000 } }),
		);
		assert.strictEqual(out[0].isLocal, true);
		assert.strictEqual(out[0].hasNativeToolCalls, false); // forced false for local
		assert.strictEqual(out[0].contextWindow, 32000);
	});

	test('a CLOUD model with specialToolFormat reports native tool calls', () => {
		const out = buildFailoverCandidates(
			[provider({ providerName: 'anthropic', models: [{ modelName: 'claude' }] })],
			new Set(),
			capsFor({ 'claude': { specialToolFormat: 'anthropic', contextWindow: 200000 } }),
		);
		assert.strictEqual(out[0].isLocal, false);
		assert.strictEqual(out[0].hasNativeToolCalls, true);
		assert.strictEqual(out[0].contextWindow, 200000);
	});

	test('isCoder = name-heuristic OR FIM support', () => {
		// FIM caps flips isCoder true regardless of the name heuristic.
		const withFim = buildFailoverCandidates([provider({ models: [{ modelName: 'plain-model' }] })], new Set(), capsFor({ 'plain-model': { supportsFIM: true } }));
		assert.strictEqual(withFim[0].isCoder, true);
		// no caps -> isCoder is exactly the name heuristic for that name.
		const noFim = buildFailoverCandidates([provider({ models: [{ modelName: 'plain-model' }] })], new Set(), noCaps);
		assert.strictEqual(noFim[0].isCoder, isLikelyCoderModelName('plain-model'));
	});

	test('caps lookup returning null -> zero ctx, no native tools, name-only coder', () => {
		const out = buildFailoverCandidates([provider({ providerName: 'anthropic', models: [{ modelName: 'plain-model' }] })], new Set(), noCaps);
		assert.strictEqual(out[0].contextWindow, 0);
		assert.strictEqual(out[0].hasNativeToolCalls, false);
		assert.strictEqual(out[0].isCoder, isLikelyCoderModelName('plain-model'));
	});

	test('isKnownCapableProvider / isFreeTierProvider derive from the shared registries', () => {
		const out = buildFailoverCandidates([provider({ providerName: 'anthropic', models: [{ modelName: 'm' }] })], new Set(), noCaps);
		assert.strictEqual(out[0].isKnownCapableProvider, (KNOWN_CAPABLE_AGENTIC_PROVIDERS as readonly string[]).includes('anthropic'));
		assert.strictEqual(out[0].isFreeTierProvider, freeTierIdOfProviderName('anthropic') !== null);
	});

	test('preserves provider/model declaration order across providers', () => {
		const out = buildFailoverCandidates(
			[provider({ providerName: 'ollama', models: [{ modelName: 'o1' }] }), provider({ providerName: 'anthropic', models: [{ modelName: 'a1' }, { modelName: 'a2' }] })],
			new Set(),
			noCaps,
		);
		assert.deepStrictEqual(out.map(c => `${c.providerName}/${c.modelName}`), ['ollama/o1', 'anthropic/a1', 'anthropic/a2']);
	});
});
