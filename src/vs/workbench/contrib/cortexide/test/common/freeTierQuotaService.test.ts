/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test, setup, teardown } from 'mocha';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { InMemoryStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { FreeTierQuotaService, FREE_TIER_QUOTA_STORAGE_KEY } from '../../common/routing/freeTierQuotaService.js';
import { FREE_TIER_QUOTAS, FreeTierProviderId, resolveEffectiveQuota } from '../../common/routing/freeTierConstants.js';

/**
 * Unit tests for FreeTierQuotaService — the per-provider quota accounting that backs the
 * "free models out of the box" router. The service had ZERO coverage; these tests lock in
 * the recordCall / markExhausted / rollover / persistence semantics the free-tier ladder
 * relies on.
 *
 * Assertions reference FREE_TIER_QUOTAS[id] (not hardcoded numbers) so they survive
 * quota-constant changes. The 60s RPM/TPM and daily RPD windows don't elapse during a fast
 * unit test, so recorded usage is deterministic within a test.
 */
suite('FreeTierQuotaService', () => {
	let disposables: DisposableStore;
	let storage: InMemoryStorageService;
	let service: FreeTierQuotaService;

	const PROVIDERS = Object.keys(FREE_TIER_QUOTAS) as FreeTierProviderId[];
	// A provider that has a finite RPD cap, so we can exercise clamping cheaply.
	const CAPPED = PROVIDERS.find(id => FREE_TIER_QUOTAS[id].rpd !== null)!;

	setup(() => {
		disposables = new DisposableStore();
		storage = disposables.add(new InMemoryStorageService());
		service = disposables.add(new FreeTierQuotaService(storage));
	});

	teardown(() => {
		// Manual teardown (not ensureNoDisposablesAreLeakedInTestSuite): the storage
		// service registers internal Storage disposables that the leak-checker flags.
		disposables.dispose();
	});

	test('fresh state: every provider reports full effective limits and is not exhausted', () => {
		for (const id of PROVIDERS) {
			const r = service.getRemaining(id, 'some-model');
			const eff = resolveEffectiveQuota(id, 'some-model');
			assert.strictEqual(r.providerId, id);
			assert.strictEqual(r.rpd, eff.rpd, `${id} rpd`);
			assert.strictEqual(r.rpm, eff.rpm, `${id} rpm`);
			assert.strictEqual(r.tpm, eff.tpm, `${id} tpm`);
			assert.strictEqual(r.exhausted, false, `${id} should not start exhausted`);
			assert.strictEqual(r.resetAt, null, `${id} no reset pending`);
		}
	});

	test('recordCall decrements remaining RPD and RPM by one', () => {
		const before = service.getRemaining(CAPPED, 'm');
		service.recordCall(CAPPED, 'm', 0);
		const after = service.getRemaining(CAPPED, 'm');
		if (before.rpd !== null) {
			assert.strictEqual(after.rpd, before.rpd - 1, 'rpd decremented');
		}
		if (before.rpm !== null) {
			assert.strictEqual(after.rpm, before.rpm - 1, 'rpm decremented');
		}
	});

	test('recordCall with tokensUsed decrements remaining TPM by that amount', () => {
		// groq is the provider with a finite tpm in the published table.
		const id = PROVIDERS.find(p => FREE_TIER_QUOTAS[p].tpm !== null);
		if (!id) { return; } // no capped-tpm provider; nothing to assert
		const before = service.getRemaining(id, 'm');
		service.recordCall(id, 'm', 100);
		const after = service.getRemaining(id, 'm');
		assert.strictEqual(after.tpm, (before.tpm as number) - 100, 'tpm decremented by tokensUsed');
	});

	test('remaining RPD clamps at 0 and never goes negative', () => {
		const cap = FREE_TIER_QUOTAS[CAPPED].rpd as number;
		for (let i = 0; i < cap + 5; i++) {
			service.recordCall(CAPPED, 'm', 0);
		}
		const r = service.getRemaining(CAPPED, 'm');
		assert.strictEqual(r.rpd, 0, 'rpd clamped at 0');
	});

	test('markExhausted(null) sets a ~60s cooldown: exhausted=true with a future resetAt', () => {
		const before = service.getRemaining(CAPPED, 'm');
		assert.strictEqual(before.exhausted, false);
		const t0 = Date.now();
		service.markExhausted(CAPPED, null);
		const r = service.getRemaining(CAPPED, 'm');
		assert.strictEqual(r.exhausted, true, 'a 429 marks the provider exhausted');
		assert.ok(r.resetAt !== null && r.resetAt > t0, 'resetAt is in the future');
		assert.ok((r.resetAt as number) - t0 <= 61_000, 'default cooldown is ~60s, not longer');
	});

	test('markExhausted honours a provider-supplied future resetAt', () => {
		const future = Date.now() + 5 * 60_000;
		service.markExhausted(CAPPED, future);
		const r = service.getRemaining(CAPPED, 'm');
		assert.strictEqual(r.resetAt, future, 'uses the provider-supplied resetAt');
		assert.strictEqual(r.exhausted, true);
	});

	test('markExhausted with a past resetAt falls back to the 60s default (not already-elapsed)', () => {
		const t0 = Date.now();
		service.markExhausted(CAPPED, t0 - 10_000); // already in the past
		const r = service.getRemaining(CAPPED, 'm');
		// Implementation ignores a non-future resetAt and uses now+60s, so the provider
		// is exhausted with a future reset rather than instantly available.
		assert.strictEqual(r.exhausted, true, 'a past resetAt does not leave it exhausted-forever or instantly-clear');
		assert.ok((r.resetAt as number) > t0, 'resetAt advanced to a sane future default');
	});

	test('getAllRemaining returns exactly one snapshot per published provider', () => {
		const all = service.getAllRemaining('m');
		assert.strictEqual(all.length, PROVIDERS.length);
		assert.deepStrictEqual(new Set(all.map(r => r.providerId)), new Set(PROVIDERS));
	});

	test('resetAll wipes usage and cooldowns back to full quota', () => {
		service.recordCall(CAPPED, 'm', 500);
		service.markExhausted(CAPPED, null);
		assert.strictEqual(service.getRemaining(CAPPED, 'm').exhausted, true);

		service.resetAll();

		for (const id of PROVIDERS) {
			const r = service.getRemaining(id, 'm');
			const eff = resolveEffectiveQuota(id, 'm');
			assert.strictEqual(r.rpd, eff.rpd, `${id} rpd reset`);
			assert.strictEqual(r.exhausted, false, `${id} not exhausted after reset`);
		}
	});

	test('onQuotaChange fires on recordCall, markExhausted and resetAll', () => {
		let fired = 0;
		disposables.add(service.onQuotaChange(() => { fired++; }));
		service.recordCall(CAPPED, 'm', 1);
		service.markExhausted(CAPPED, null);
		service.resetAll();
		assert.strictEqual(fired, 3, 'one event per mutating call');
	});

	test('gemini per-model overrides tighten the effective RPD/RPM (resolveEffectiveQuota)', () => {
		// Only assert if gemini is a known provider (it is, per the table).
		if (!PROVIDERS.includes('gemini' as FreeTierProviderId)) { return; }
		const pro = service.getRemaining('gemini' as FreeTierProviderId, 'gemini-2.5-pro');
		const flashLite = service.getRemaining('gemini' as FreeTierProviderId, 'gemini-2.5-flash-lite');
		// 'pro' override is tighter (rpd 100) than flash-lite (rpd 1000).
		assert.ok((pro.rpd as number) < (flashLite.rpd as number), 'pro model has a tighter daily cap than flash-lite');
	});

	test('usage persists across service instances sharing the same storage', () => {
		service.recordCall(CAPPED, 'm', 250);
		const expected = service.getRemaining(CAPPED, 'm');

		const reloaded = disposables.add(new FreeTierQuotaService(storage));
		const r = reloaded.getRemaining(CAPPED, 'm');
		assert.strictEqual(r.rpd, expected.rpd, 'rpd persisted');
		assert.strictEqual(r.rpm, expected.rpm, 'rpm persisted');
		assert.strictEqual(r.tpm, expected.tpm, 'tpm persisted');
	});

	test('corrupt persisted state is ignored and the service starts at full quota (no throw)', () => {
		storage.store(FREE_TIER_QUOTA_STORAGE_KEY, '{ not valid json', StorageScope.APPLICATION, StorageTarget.MACHINE);
		const fresh = disposables.add(new FreeTierQuotaService(storage));
		const r = fresh.getRemaining(CAPPED, 'm');
		assert.strictEqual(r.rpd, FREE_TIER_QUOTAS[CAPPED].rpd, 'corrupt state → full quota, no throw');
		assert.strictEqual(r.exhausted, false);
	});

	test('a persisted blob with the wrong version is discarded (starts fresh)', () => {
		storage.store(FREE_TIER_QUOTA_STORAGE_KEY, JSON.stringify({ version: 999, providers: {} }), StorageScope.APPLICATION, StorageTarget.MACHINE);
		const fresh = disposables.add(new FreeTierQuotaService(storage));
		const r = fresh.getRemaining(CAPPED, 'm');
		assert.strictEqual(r.rpd, FREE_TIER_QUOTAS[CAPPED].rpd, 'unknown version → full quota');
	});
});
