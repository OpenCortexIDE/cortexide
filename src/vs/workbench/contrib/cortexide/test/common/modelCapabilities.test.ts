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

suite('getModelCapabilities - fallback ordering (variant/dated names)', () => {
	const rec = (p: string, m: string) => caps(p, m).recognizedModelName;

	test('FIXED: anthropic variant names resolve to the SPECIFIC entry, not legacy 4.0', () => {
		assert.strictEqual(rec('anthropic', 'claude-opus-4-8-latest'), 'claude-opus-4-8');
		assert.strictEqual(rec('anthropic', 'claude-sonnet-4-6-latest'), 'claude-sonnet-4-6');
		assert.strictEqual(rec('anthropic', 'claude-opus-4-5-latest'), 'claude-opus-4-5-20251101');
		assert.strictEqual(rec('anthropic', 'claude-opus-4-1-20250805-x'), 'claude-opus-4-1-20250805');
		// legacy 4.0 broad match still works for an actual 4.0 name:
		assert.strictEqual(rec('anthropic', 'claude-4-opus-preview'), 'claude-opus-4-20250514');
	});

	test('FIXED: openAI variant names resolve to the specific sub-model, not the broad parent', () => {
		assert.strictEqual(rec('openAI', 'gpt-5.1-preview'), 'gpt-5.1');
		assert.strictEqual(rec('openAI', 'gpt-5-mini-2025-08'), 'gpt-5-mini');
		assert.strictEqual(rec('openAI', 'gpt-5-nano-x'), 'gpt-5-nano');
		assert.strictEqual(rec('openAI', 'gpt-4.1-mini-2025'), 'gpt-4.1-mini');
		assert.strictEqual(rec('openAI', 'o3-mini-2025-01'), 'o3-mini');
		assert.strictEqual(rec('openAI', 'o3-pro-preview'), 'o3-pro');
		assert.strictEqual(rec('openAI', 'gpt-4o-mini-2024'), 'gpt-4o-mini'); // was collapsing to gpt-4o
		// broad parents still resolve when no specific sub-model is named:
		assert.strictEqual(rec('openAI', 'gpt-5-2025-08'), 'gpt-5');
	});

	test('PRESERVED: legacy gpt-3.5 still maps to gpt-4o-mini (not the broad gpt-5)', () => {
		// the broad gpt-5 check matches "...5"; moving the 3.5 check first keeps this correct under return-early
		assert.strictEqual(rec('openAI', 'gpt-3.5-turbo'), 'gpt-4o-mini');
		assert.strictEqual(rec('openAI', 'gpt-3.5-turbo-0125'), 'gpt-4o-mini');
	});

	test('FIXED: xAI variant names resolve to the right grok generation, not the broad grok-3', () => {
		assert.strictEqual(rec('xAI', 'grok-4-0709'), 'grok-4'); // was collapsing to grok-3
		assert.strictEqual(rec('xAI', 'grok-2-vision-1212'), 'grok-2');
		assert.strictEqual(rec('xAI', 'grok-3-0625'), 'grok-3'); // a dated grok-3 variant (non-exact) falls back to grok-3
		assert.strictEqual(rec('xAI', 'grok-beta'), 'grok-3'); // broad fallback for an unversioned grok
	});
});

// extensiveModelOptionsFallback is the shared open-source recognizer; gemini's modelOptionsFallback
// calls it directly, so a non-gemini (llama) name on the gemini provider exercises it cleanly.
suite('extensiveModelOptionsFallback - llama ordering', () => {
	const recLlama = (m: string) => caps('gemini', m).recognizedModelName;

	test('FIXED: specific llama 3.x resolve to their own entry (was shadowed by bare llama3)', () => {
		assert.strictEqual(recLlama('llama3.1'), 'llama3.1');
		assert.strictEqual(recLlama('llama3.2'), 'llama3.2');
		assert.strictEqual(recLlama('llama3.3'), 'llama3.3');
	});

	test('FIXED: hyphenated llama-3.x names resolve to 3.x, NOT the 10M-ctx llama4-scout', () => {
		assert.strictEqual(recLlama('llama-3.1-8b'), 'llama3.1'); // was 'llama4-scout' (10M ctx)
		assert.strictEqual(recLlama('llama-3.3-70b-instruct'), 'llama3.3');
	});

	test('FIXED: maverick resolves to llama4-maverick, not llama4-scout', () => {
		assert.strictEqual(recLlama('llama-4-maverick'), 'llama4-maverick');
		assert.strictEqual(recLlama('maverick'), 'llama4-maverick');
	});

	test('PRESERVED: scout, plain llama3, and bare/unversioned llama', () => {
		assert.strictEqual(recLlama('llama-4-scout-17b'), 'llama4-scout');
		assert.strictEqual(recLlama('llama-3-70b'), 'llama3');
		assert.strictEqual(recLlama('llama2-uncensored'), 'llama4-scout'); // unversioned/other -> newest default
	});
});

suite('extensiveModelOptionsFallback - v0 multimodal', () => {
	test('v0 models use openai-style tool/image format (issue #1)', () => {
		const r = caps('openAICompatible', 'v0-1.5-md');
		assert.strictEqual(r.specialToolFormat, 'openai-style');
		assert.strictEqual(r.recognizedModelName, 'v0');
	});
});
