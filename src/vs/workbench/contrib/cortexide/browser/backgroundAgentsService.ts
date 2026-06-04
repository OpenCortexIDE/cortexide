/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  Background agents registry (R7)
 *  -------------------------------
 *  A pure OBSERVABLE REGISTRY of background agent runs — no dependency on chatThreadService (which
 *  injects THIS service and drives the actual agent loop), so there is no DI cycle. chatThreadService
 *  registers a run, updates its status as it progresses, and supplies an abort callback the UI can
 *  invoke via `cancel`. The "Running agents" panel subscribes to `onDidChangeState`.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { BackgroundAgentState, BackgroundAgentStatus, BackgroundAgentsState } from '../common/backgroundAgentsServiceTypes.js';

export const IBackgroundAgentsService = createDecorator<IBackgroundAgentsService>('backgroundAgentsService');

export interface IBackgroundAgentsService {
	readonly _serviceBrand: undefined;

	/** Current snapshot (replaced on every change so React `useState` re-renders). NOT persisted. */
	readonly state: BackgroundAgentsState;
	readonly onDidChangeState: Event<void>;

	/** Register a newly-started background run. `abort` is invoked by `cancel(id)`. */
	register(agent: { id: string; description: string; threadId: string; startTime: number; abort: () => void }): void;
	/** Update a run's status (and optionally its summary/error/endTime). */
	setStatus(id: string, status: BackgroundAgentStatus, extra?: { resultSummary?: string; error?: string; endTime?: number }): void;
	/** Request cancellation of a running agent (calls its abort callback + marks it cancelled). */
	cancel(id: string): void;
	/** Drop all finished (completed/error/cancelled) runs from the list. */
	clearFinished(): void;
	/** Convenience accessor. */
	list(): readonly BackgroundAgentState[];
}

class BackgroundAgentsService extends Disposable implements IBackgroundAgentsService {
	declare readonly _serviceBrand: undefined;

	private readonly _agents = new Map<string, BackgroundAgentState>();
	private readonly _aborts = new Map<string, () => void>();

	state: BackgroundAgentsState = { agents: [] };

	private readonly _onDidChangeState = this._register(new Emitter<void>());
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event;

	private _publish(): void {
		this.state = { agents: [...this._agents.values()].sort((a, b) => b.startTime - a.startTime) };
		this._onDidChangeState.fire();
	}

	register(agent: { id: string; description: string; threadId: string; startTime: number; abort: () => void }): void {
		this._agents.set(agent.id, {
			id: agent.id,
			description: agent.description,
			threadId: agent.threadId,
			status: 'running',
			startTime: agent.startTime,
		});
		this._aborts.set(agent.id, agent.abort);
		this._publish();
	}

	setStatus(id: string, status: BackgroundAgentStatus, extra?: { resultSummary?: string; error?: string; endTime?: number }): void {
		const prev = this._agents.get(id);
		if (!prev) { return; }
		this._agents.set(id, {
			...prev,
			status,
			resultSummary: extra?.resultSummary ?? prev.resultSummary,
			error: extra?.error ?? prev.error,
			endTime: extra?.endTime ?? prev.endTime,
		});
		// Once a run is terminal, its abort callback is no longer needed.
		if (status !== 'running') { this._aborts.delete(id); }
		this._publish();
	}

	cancel(id: string): void {
		const prev = this._agents.get(id);
		if (!prev || prev.status !== 'running') { return; }
		const abort = this._aborts.get(id);
		try { abort?.(); } catch { /* ignore */ }
		this.setStatus(id, 'cancelled', { endTime: Date.now() });
	}

	clearFinished(): void {
		for (const [id, a] of [...this._agents.entries()]) {
			if (a.status !== 'running') { this._agents.delete(id); this._aborts.delete(id); }
		}
		this._publish();
	}

	list(): readonly BackgroundAgentState[] {
		return this.state.agents;
	}
}

registerSingleton(IBackgroundAgentsService, BackgroundAgentsService, InstantiationType.Delayed);
