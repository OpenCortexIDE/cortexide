/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Free-tier quota tracking service.
 *
 * Tracks per-provider request counts (RPD / RPM) and rough token counts (TPM)
 * for free-tier providers, persisted across restarts via VS Code's storage.
 *
 * The service is the in-process source of truth.  It has no network access of
 * its own; updates come from `recordCall(...)` and `markExhausted(...)` which
 * are invoked by the LLM message pipeline.
 *
 * Layer: `common/`. No DOM, Node, or Electron imports.
 */

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import {
	FREE_TIER_QUOTAS,
	FreeTierProviderId,
	resolveEffectiveQuota,
} from './freeTierConstants.js';

/** Persistent storage key.  Single JSON blob keyed by provider id. */
export const FREE_TIER_QUOTA_STORAGE_KEY = 'cortexide.freeTier.quotaState';

/** Public per-provider quota snapshot. */
export interface FreeTierRemaining {
	readonly providerId: FreeTierProviderId;
	/** Effective limits at the moment of query, after per-model overrides. */
	readonly limits: { rpd: number | null; rpm: number | null; tpm: number | null };
	/** Remaining requests today (null if uncapped). */
	readonly rpd: number | null;
	/** Remaining requests in the current minute window (null if uncapped). */
	readonly rpm: number | null;
	/** Remaining tokens in the current minute window (null if uncapped). */
	readonly tpm: number | null;
	/** True when provider returned 429 recently and resetAt is still in the future. */
	readonly exhausted: boolean;
	/** When the rate-limit reset is expected (epoch ms), or `null`. */
	readonly resetAt: number | null;
}

/** Internal persisted shape. */
interface PersistedProviderState {
	/** Window start (epoch ms, midnight UTC of the current RPD window). */
	rpdWindowStart: number;
	/** Requests sent today. */
	rpdUsed: number;
	/** Sliding 60s window start. */
	rpmWindowStart: number;
	/** Requests in the current 60s window. */
	rpmUsed: number;
	/** Tokens used in the current 60s window. */
	tpmUsed: number;
	/** Set by 429 handler; provider is considered exhausted until now() > resetAt. */
	exhaustedUntil: number | null;
}

interface PersistedState {
	/** Schema version - bump on breaking changes. */
	version: 1;
	providers: { [k in FreeTierProviderId]?: PersistedProviderState };
}

const ONE_MINUTE_MS = 60_000;

/** Returns the most recent UTC midnight, in epoch ms, at or before `now`. */
function utcDayStart(now: number): number {
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function emptyProviderState(now: number): PersistedProviderState {
	return {
		rpdWindowStart: utcDayStart(now),
		rpdUsed: 0,
		rpmWindowStart: now,
		rpmUsed: 0,
		tpmUsed: 0,
		exhaustedUntil: null,
	};
}

/** Roll over windows in-place if they've elapsed. */
function rollWindows(state: PersistedProviderState, now: number): void {
	const currentDayStart = utcDayStart(now);
	if (currentDayStart > state.rpdWindowStart) {
		state.rpdWindowStart = currentDayStart;
		state.rpdUsed = 0;
	}
	if (now - state.rpmWindowStart >= ONE_MINUTE_MS) {
		state.rpmWindowStart = now;
		state.rpmUsed = 0;
		state.tpmUsed = 0;
	}
	if (state.exhaustedUntil !== null && now >= state.exhaustedUntil) {
		state.exhaustedUntil = null;
	}
}

export interface IFreeTierQuotaService {
	readonly _serviceBrand: undefined;

	/** Fires whenever quota state changes (recordCall, markExhausted, rollover). */
	readonly onQuotaChange: Event<void>;

	/** Returns remaining quota for a provider+model.  Snapshot, not live. */
	getRemaining(providerId: FreeTierProviderId, modelName: string): FreeTierRemaining;

	/** Returns remaining quota for every free-tier provider we know about. */
	getAllRemaining(modelName?: string): readonly FreeTierRemaining[];

	/**
	 * Increment counters after a successful call.  `tokensUsed` is the best
	 * estimate available (output text length / 4 is a common cheap proxy).
	 */
	recordCall(providerId: FreeTierProviderId, modelName: string, tokensUsed: number): void;

	/**
	 * Mark a provider as exhausted (rate-limited).  `resetAt` may be null when
	 * the provider didn't tell us when to retry; in that case we use a 60s
	 * conservative default.
	 */
	markExhausted(providerId: FreeTierProviderId, resetAt: number | null): void;

	/** Test helper: clear all state. */
	resetAll(): void;
}

export const IFreeTierQuotaService = createDecorator<IFreeTierQuotaService>('FreeTierQuotaService');

export class FreeTierQuotaService extends Disposable implements IFreeTierQuotaService {
	readonly _serviceBrand: undefined;

	private readonly _onQuotaChange = this._register(new Emitter<void>());
	readonly onQuotaChange: Event<void> = this._onQuotaChange.event;

	private _state: PersistedState;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this._state = this._readState();
	}

	private _readState(): PersistedState {
		const raw = this._storageService.get(
			FREE_TIER_QUOTA_STORAGE_KEY,
			StorageScope.APPLICATION,
		);
		if (!raw) {
			return { version: 1, providers: {} };
		}
		try {
			const parsed = JSON.parse(raw) as PersistedState;
			if (parsed && parsed.version === 1 && typeof parsed.providers === 'object') {
				return parsed;
			}
		} catch (_err) {
			// Corrupt JSON - silently reset rather than block startup.
		}
		return { version: 1, providers: {} };
	}

	private _writeState(): void {
		this._storageService.store(
			FREE_TIER_QUOTA_STORAGE_KEY,
			JSON.stringify(this._state),
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);
	}

	private _getOrCreate(providerId: FreeTierProviderId, now: number): PersistedProviderState {
		let s = this._state.providers[providerId];
		if (!s) {
			s = emptyProviderState(now);
			this._state.providers[providerId] = s;
		}
		rollWindows(s, now);
		return s;
	}

	getRemaining(providerId: FreeTierProviderId, modelName: string): FreeTierRemaining {
		const now = Date.now();
		const s = this._getOrCreate(providerId, now);
		const limits = resolveEffectiveQuota(providerId, modelName);

		const rpdRemaining = limits.rpd === null ? null : Math.max(0, limits.rpd - s.rpdUsed);
		const rpmRemaining = limits.rpm === null ? null : Math.max(0, limits.rpm - s.rpmUsed);
		const tpmRemaining = limits.tpm === null ? null : Math.max(0, limits.tpm - s.tpmUsed);

		return {
			providerId,
			limits,
			rpd: rpdRemaining,
			rpm: rpmRemaining,
			tpm: tpmRemaining,
			exhausted: s.exhaustedUntil !== null && now < s.exhaustedUntil,
			resetAt: s.exhaustedUntil,
		};
	}

	getAllRemaining(modelName: string = ''): readonly FreeTierRemaining[] {
		const out: FreeTierRemaining[] = [];
		for (const id of Object.keys(FREE_TIER_QUOTAS) as FreeTierProviderId[]) {
			out.push(this.getRemaining(id, modelName));
		}
		return out;
	}

	recordCall(providerId: FreeTierProviderId, modelName: string, tokensUsed: number): void {
		const now = Date.now();
		const s = this._getOrCreate(providerId, now);
		s.rpdUsed += 1;
		s.rpmUsed += 1;
		if (tokensUsed > 0) {
			s.tpmUsed += tokensUsed;
		}
		// modelName is currently unused for the increment but reserved for
		// future per-model accounting; reference it to satisfy linters.
		void modelName;
		this._writeState();
		this._onQuotaChange.fire();
	}

	markExhausted(providerId: FreeTierProviderId, resetAt: number | null): void {
		const now = Date.now();
		const s = this._getOrCreate(providerId, now);
		// If the provider didn't tell us, assume 60s.
		const effectiveResetAt = resetAt !== null && resetAt > now ? resetAt : now + ONE_MINUTE_MS;
		s.exhaustedUntil = effectiveResetAt;
		this._writeState();
		this._onQuotaChange.fire();
	}

	resetAll(): void {
		this._state = { version: 1, providers: {} };
		this._writeState();
		this._onQuotaChange.fire();
	}
}

registerSingleton(IFreeTierQuotaService, FreeTierQuotaService, InstantiationType.Delayed);
