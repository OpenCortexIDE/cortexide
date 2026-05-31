/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { describeFreeTierExhaustion } from '../../common/routing/freeTierExhaustion.js';
import { FreeTierRemaining } from '../../common/routing/freeTierQuotaService.js';
import { FREE_TIER_QUOTAS, FreeTierProviderId } from '../../common/routing/freeTierConstants.js';
import { ModelSelection } from '../../common/cortexideSettingsTypes.js';

const NOW = 1_700_000_000_000;

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

/** Snapshots for every provider in the table, all healthy unless overridden. */
function allSnaps(overrides: Partial<Record<FreeTierProviderId, Partial<Omit<FreeTierRemaining, 'providerId'>>>> = {}): FreeTierRemaining[] {
	return (Object.keys(FREE_TIER_QUOTAS) as FreeTierProviderId[]).map(id => snap(id, overrides[id] ?? {}));
}

suite('FreeTierExhaustion', () => {

	test('no free-tier providers configured -> not exhausted, empty message', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' },
			{ providerName: 'ollama', modelName: 'qwen2.5-coder' },
		];
		const r = describeFreeTierExhaustion({ configuredModels: configured, quotas: allSnaps(), now: NOW });
		assert.strictEqual(r.allExhausted, false);
		assert.strictEqual(r.message, '');
	});

	test('a free-tier provider still has quota -> not exhausted', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'gemini', modelName: 'gemini-2.5-flash' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({ groq: { exhausted: true, resetAt: NOW + 60_000 } }), // gemini still healthy
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, false);
		assert.strictEqual(r.message, '');
	});

	test('all configured free-tier exhausted with a local fallback -> recommends local model', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'gemini', modelName: 'gemini-2.5-flash' },
			{ providerName: 'ollama', modelName: 'qwen2.5-coder:7b' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({
				groq: { exhausted: true, resetAt: NOW + 45_000 },
				gemini: { exhausted: true, resetAt: NOW + 30_000 },
			}),
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, true);
		assert.deepStrictEqual(r.localFallback, { providerName: 'ollama', modelName: 'qwen2.5-coder:7b' });
		assert.strictEqual(r.byoFallback, null);
		assert.strictEqual(r.soonestResetAt, NOW + 30_000, 'soonest reset is gemini at +30s');
		assert.ok(r.message.includes('ollama/qwen2.5-coder:7b'), 'message should name the local model');
		assert.ok(r.message.includes('~30s'), 'message should mention the soonest reset in seconds');
	});

	test('all exhausted, no local but a BYO cloud key -> recommends the BYO model', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({ groq: { exhausted: true, resetAt: NOW + 200_000 } }),
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, true);
		assert.strictEqual(r.localFallback, null);
		assert.deepStrictEqual(r.byoFallback, { providerName: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' });
		assert.ok(r.message.includes('anthropic/claude-3-5-sonnet-20241022'));
		assert.ok(r.message.includes('~4 min'), '200s rounds up to ~4 min');
	});

	test('local fallback wins over BYO when both are present', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
			{ providerName: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' },
			{ providerName: 'lmStudio', modelName: 'local-model' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({ groq: { exhausted: true, resetAt: NOW + 60_000 } }),
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, true);
		assert.deepStrictEqual(r.localFallback, { providerName: 'lmStudio', modelName: 'local-model' });
		assert.ok(r.message.includes('lmStudio/local-model'));
		assert.ok(!r.message.includes('anthropic'), 'should not recommend BYO when a local model exists');
	});

	test('all exhausted, no fallback at all -> recommends adding a local model or key', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({ groq: { exhausted: true, resetAt: NOW + 60_000 } }),
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, true);
		assert.strictEqual(r.localFallback, null);
		assert.strictEqual(r.byoFallback, null);
		assert.ok(r.message.includes('Add a local model'));
		assert.ok(r.message.includes('CortexIDE Settings'));
	});

	test('exhaustion via zero RPD (not a 429) -> exhausted, no reset time, no reset clause', () => {
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({ groq: { rpd: 0 } }), // out of daily requests, no 429 resetAt
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, true);
		assert.strictEqual(r.soonestResetAt, null);
		assert.ok(!/resets in/.test(r.message), 'no reset clause when no reset time is known');
	});

	test('soonest reset ignores non-configured providers', () => {
		// gemini is NOT configured; its (sooner) reset must not be reported.
		const configured: ModelSelection[] = [
			{ providerName: 'groq', modelName: 'llama-3.3-70b-versatile' },
		];
		const r = describeFreeTierExhaustion({
			configuredModels: configured,
			quotas: allSnaps({
				groq: { exhausted: true, resetAt: NOW + 90_000 },
				gemini: { exhausted: true, resetAt: NOW + 5_000 }, // sooner, but not configured
			}),
			now: NOW,
		});
		assert.strictEqual(r.allExhausted, true);
		assert.strictEqual(r.soonestResetAt, NOW + 90_000, 'only the configured groq reset counts');
	});
});
