/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *
 *  Background agents (R7) — shared state types.
 *  --------------------------------------------
 *  A background agent is a top-level agent run on a hidden thread that does NOT block the active
 *  chat. The service (browser/backgroundAgentsService.ts) is a pure observable registry; the agent
 *  loop itself runs in chatThreadService. The "Running agents" sidebar panel renders this state.
 *--------------------------------------------------------------------------------------*/

export type BackgroundAgentStatus = 'running' | 'completed' | 'error' | 'cancelled';

export interface BackgroundAgentState {
	/** Stable id for this background run. */
	readonly id: string;
	/** Short, human-readable description (shown in the panel). */
	readonly description: string;
	/** The hidden thread this agent runs on. */
	readonly threadId: string;
	readonly status: BackgroundAgentStatus;
	/** Epoch ms when the run started. */
	readonly startTime: number;
	/** Epoch ms when the run finished (completed/error/cancelled). */
	readonly endTime?: number;
	/** Final summary text (on completion). */
	readonly resultSummary?: string;
	/** Error message (on error). */
	readonly error?: string;
}

export interface BackgroundAgentsState {
	readonly agents: readonly BackgroundAgentState[];
}
