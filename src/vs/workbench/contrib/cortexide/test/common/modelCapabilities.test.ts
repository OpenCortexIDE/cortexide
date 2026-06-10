/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { getModelCapabilities } from '../../common/modelCapabilities.js';
import type { ProviderName } from '../../common/cortexideSettingsTypes.js';

// getModelCapabilities is the central capability REGISTRY (Phase 3). It is pure (imports only types)
// and node-testable. These tests pin the resolution contract (exact match / fallback / unrecognized),
// the override-precedence, and guard two fixed bugs (mixed-case resolution; deepseek reasoning).
const caps = (p: string, m: string, ov?: any) => getModelCapabilities(p as ProviderName, m, ov);

suite('getModelCapabilities - resolution contract', () => {
	test('an exactly-registered model resolves to full caps (isUnrecognizedModel false)', () => {
		const r = caps('openAI', 'gpt-4o');
		assert.strictEqual(r.isUnrecognizedModel, false);
		assert.strictEqual(r.recognizedModelName, 'gpt-4o');
		assert.ok((r.contextWindow ?? 0) > 0, 'expected a real context window');
		assert.ok(r.specialToolFormat, 'expected a native tool format for a known cloud model');
	});

	test('a truly-unknown model on a KNOWN provider gets unrecognizedModelDefaults, not the 4k default', () => {
		const r = caps('anthropic', 'some-brand-new-claude-zzz');
		assert.strictEqual(r.isUnrecognizedModel, true);
		assert.strictEqual(r.specialToolFormat, 'anthropic-style'); // inferred from the provider family
		assert.strictEqual(r.contextWindow, 32_000);
		assert.strictEqual(r.supportsSystemMessage, 'system-role');
	});

	test('unrecognized tool-format is inferred per provider family', () => {
		assert.strictEqual(caps('openAI', 'unknown-x').specialToolFormat, 'openai-style');
		assert.strictEqual(caps('groq', 'unknown-x').specialToolFormat, 'openai-style');
		assert.strictEqual(caps('deepseek', 'unknown-x').specialToolFormat, 'openai-style');
		assert.strictEqual(caps('gemini', 'unknown-x').specialToolFormat, 'gemini-style');
		assert.strictEqual(caps('ollama', 'unknown-x').specialToolFormat, undefined); // local: text/XML
	});

	test('a local unrecognized model gets the local defaults (8k ctx, no system role)', () => {
		const r = caps('ollama', 'unknown-local-model');
		assert.strictEqual(r.isUnrecognizedModel, true);
		assert.strictEqual(r.contextWindow, 8_192);
		assert.strictEqual(r.supportsSystemMessage, false);
	});

	test('an invalid/unknown provider falls to the safe default (isUnrecognizedModel true, no tool format)', () => {
		const r = caps('auto', 'whatever');
		assert.strictEqual(r.isUnrecognizedModel, true);
		assert.strictEqual(r.specialToolFormat, undefined);
	});

	test('overridesOfModel wins on the exact-match path', () => {
		const r = caps('openAI', 'gpt-4o', { openAI: { 'gpt-4o': { contextWindow: 12345 } } });
		assert.strictEqual(r.contextWindow, 12345);
		assert.strictEqual(r.isUnrecognizedModel, false);
	});

	test('overridesOfModel wins on the unrecognized path', () => {
		const r = caps('anthropic', 'brand-new-zzz', { anthropic: { 'brand-new-zzz': { contextWindow: 99999 } } });
		assert.strictEqual(r.contextWindow, 99999);
		assert.strictEqual(r.isUnrecognizedModel, true);
	});
});

suite('getModelCapabilities - bug regressions', () => {
	test('FIXED: a mixed-case registered name resolves to the SAME full caps as the canonical key', () => {
		const lower = caps('openAI', 'gpt-4o');
		const mixed = caps('openAI', 'GPT-4o');
		assert.strictEqual(mixed.isUnrecognizedModel, false);
		assert.strictEqual(mixed.contextWindow, lower.contextWindow);
		assert.strictEqual(mixed.specialToolFormat, lower.specialToolFormat); // was undefined before the fix (forced XML)
		assert.strictEqual(mixed.recognizedModelName, 'gpt-4o'); // canonical key, not the caller's casing
	});

	test('FIXED: deepseek-chat (V3) is NON-reasoning; deepseek-reasoner (R1) IS reasoning', () => {
		const chat = caps('deepseek', 'deepseek-chat').reasoningCapabilities;
		const reasoner = caps('deepseek', 'deepseek-reasoner').reasoningCapabilities;
		// chat must NOT advertise reasoning
		assert.ok(!chat || (chat as any).supportsReasoning !== true, 'deepseek-chat should not support reasoning');
		// reasoner MUST advertise reasoning
		assert.ok(reasoner && (reasoner as any).supportsReasoning === true, 'deepseek-reasoner should support reasoning');
	});
});
