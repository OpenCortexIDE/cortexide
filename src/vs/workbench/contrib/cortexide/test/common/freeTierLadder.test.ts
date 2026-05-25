/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { buildFreeTierLadder, pickTopFromLadder } from '../../common/routing/freeTierLadder.js';
import { FreeTierRemaining } from '../../common/routing/freeTierQuotaService.js';
import { FREE_TIER_QUOTAS, FreeTierProviderId } from '../../common/routing/freeTierConstants.js';
import { ModelSelection } from '../../common/cortexideSettingsTypes.js';

/** Build a FreeTierRemaining snapshot for a provider with sensible defaults. */
function snap(
	providerId: FreeTierProviderId,
	overrides: Partial<Omit<FreeTierRemaining, 'providerId'>> = {},
): FreeTierRemaining {
	const base = FREE_TIER_QUOTAS[providerId];
	return {
		providerId,
		limits: { rpd: base.rpd, rpm: base.rpm, tpm: base.tpm },
		rpd: base.rpd,
		rpm: base.rpm,
		tpm: base.tpm,
		exhausted: false,
		resetAt: null,
		...overrides,
	};
}

suite('FreeTierLadder', () => {

	test('respects privacy gate: returns empty ladder regardless of configured providers', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'gemini', modelName: 'gemini-2.5-flash' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [snap('groq'), snap('gemini')],
			privacyMode: true,
		});
		assert.strictEqual(ladder.length, 0, 'privacy mode must produce an empty ladder');
		assert.strictEqual(pickTopFromLadder(ladder), null);
	});

	test('skips exhausted providers (429 marked) and falls through to next quality tier', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'gemini', modelName: 'gemini-2.5-flash' },
			{ providerName: 'openRouter', modelName: 'openrouter/auto' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [
				snap('groq', { exhausted: true, resetAt: Date.now() + 60_000 }),
				snap('gemini'),
				snap('openRouter'),
			],
			privacyMode: false,
		});
		assert.ok(ladder.length >= 2, 'gemini + openRouter should remain after groq is dropped');
		assert.notStrictEqual(ladder[0].providerId, 'groq', 'exhausted groq must not be top');
		assert.strictEqual(ladder[0].providerId, 'gemini', 'next-best quality should win');
	});

	test('picks highest-quality available provider when all have quota', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'openRouter', modelName: 'openrouter/auto' },
			{ providerName: 'gemini', modelName: 'gemini-2.5-flash-lite' },
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'mistral', modelName: 'mistral-large-latest' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [snap('groq'), snap('gemini'), snap('openRouter'), snap('mistral')],
			privacyMode: false,
		});
		assert.strictEqual(ladder.length, 4);
		// Expected order per FREE_TIER_QUOTAS qualityRank: groq(80) > gemini(60) > openRouter(40) > mistral(30)
		assert.strictEqual(ladder[0].providerId, 'groq');
		assert.strictEqual(ladder[1].providerId, 'gemini');
		assert.strictEqual(ladder[2].providerId, 'openRouter');
		assert.strictEqual(ladder[3].providerId, 'mistral');
	});

	test('zero remaining RPD removes provider from ladder', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'gemini', modelName: 'gemini-2.5-flash' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [
				snap('groq', { rpd: 0 }),
				snap('gemini'),
			],
			privacyMode: false,
		});
		assert.strictEqual(ladder.length, 1);
		assert.strictEqual(ladder[0].providerId, 'gemini');
	});

	test('non-free-tier providers (e.g. anthropic, openAI) are silently ignored', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' },
			{ providerName: 'openAI', modelName: 'gpt-4o' },
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [snap('groq')],
			privacyMode: false,
		});
		assert.strictEqual(ladder.length, 1);
		assert.strictEqual(ladder[0].providerId, 'groq');
	});

	test('empty configured list -> empty ladder', () => {
		const ladder = buildFreeTierLadder({
			configuredModels: [],
			quotas: [],
			privacyMode: false,
		});
		assert.strictEqual(ladder.length, 0);
		assert.strictEqual(pickTopFromLadder(ladder), null);
	});

	test('cerebras outranks groq when both have quota (quality rank 100 vs 80)', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'cerebras', modelName: 'llama-4-scout-17b-16e-instruct' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [snap('cerebras'), snap('groq')],
			privacyMode: false,
		});
		assert.strictEqual(ladder.length, 2);
		assert.strictEqual(ladder[0].providerId, 'cerebras', 'cerebras should win on quality rank');
		assert.strictEqual(ladder[1].providerId, 'groq');
		const top = pickTopFromLadder(ladder);
		assert.deepStrictEqual(top, { providerName: 'cerebras', modelName: 'llama-4-scout-17b-16e-instruct' });
	});

	test('cerebras exhausted -> groq becomes top of ladder', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'cerebras', modelName: 'qwen-3-32b' },
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
		];
		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas: [
				snap('cerebras', { exhausted: true, resetAt: Date.now() + 30_000 }),
				snap('groq'),
			],
			privacyMode: false,
		});
		assert.strictEqual(ladder.length, 1);
		assert.strictEqual(ladder[0].providerId, 'groq');
	});
});
