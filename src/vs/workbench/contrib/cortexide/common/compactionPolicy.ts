/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure decision logic for automatic conversation compaction (R8).
 *
 * Layer: `common/`. No I/O, no service deps — fully unit-testable. The agent loop in
 * chatThreadService consults `shouldCompactConversation` once per iteration (after it knows the
 * prepared-message token count) and, when it returns true, summarizes the middle of the thread
 * (see `selectCompactionWindow`) before continuing. Compaction is OPT-IN and only ever runs inside
 * an agent/plan loop, so normal chat is unaffected.
 */

export interface CompactionDecisionInput {
	/** The `enableAutoCompaction` global setting. */
	readonly enabled: boolean;
	/** Current chat mode; compaction only applies to 'agent' / 'plan'. */
	readonly chatMode: string;
	/** Estimated prompt tokens of the prepared messages. */
	readonly promptTokens: number;
	/** The model's context window (tokens). */
	readonly contextWindow: number;
	/** Number of messages currently in the thread. */
	readonly messageCount: number;
	/** Agent-loop iterations since the last successful compaction (Infinity if never). */
	readonly iterationsSinceLastCompaction: number;
	/** Fraction of the window at which to compact. Default 0.75. */
	readonly thresholdPct?: number;
	/** Don't compact a conversation with fewer than this many messages. Default 12. */
	readonly minMessagesToCompact?: number;
	/** Minimum agent iterations between two compactions (prevents tight re-compaction loops). Default 4. */
	readonly minIterationsBetween?: number;
	/** Above this fraction the window is too full to even fit a summary call; bail and warn instead. Default 0.92. */
	readonly bailAbovePct?: number;
}

/**
 * Decide whether the agent loop should compact now. Conservative by construction: returns false
 * unless the feature is on, we're in an agent/plan loop, the conversation is long enough, enough
 * iterations have passed since the last compaction, and usage is in the [threshold, bail] band.
 */
export function shouldCompactConversation(i: CompactionDecisionInput): boolean {
	if (!i.enabled) { return false; }
	if (i.chatMode !== 'agent' && i.chatMode !== 'plan') { return false; }
	if (i.contextWindow <= 0 || i.promptTokens <= 0) { return false; }

	const threshold = i.thresholdPct ?? 0.75;
	const minMsgs = i.minMessagesToCompact ?? 12;
	const minIters = i.minIterationsBetween ?? 4;
	const bailAbove = i.bailAbovePct ?? 0.92;

	if (i.messageCount < minMsgs) { return false; }
	if (i.iterationsSinceLastCompaction < minIters) { return false; }

	const usage = i.promptTokens / i.contextWindow;
	// Too full to safely run a summary call — let the existing overflow warning handle it.
	if (usage > bailAbove) { return false; }
	return usage >= threshold;
}

export interface CompactionWindow {
	/** First message index to summarize (inclusive). */
	readonly start: number;
	/** One past the last message index to summarize (exclusive). */
	readonly end: number;
}

/**
 * Choose the contiguous middle window of messages to summarize: keep the first `keepHead` messages
 * (the original task framing) and the last `keepRecent` messages (live working context), summarize
 * everything between. Returns null when there isn't a worthwhile middle to compact.
 */
export function selectCompactionWindow(
	messageCount: number,
	keepRecent: number = 6,
	keepHead: number = 1,
	minWindow: number = 3,
): CompactionWindow | null {
	const start = Math.max(0, keepHead);
	const end = messageCount - Math.max(0, keepRecent);
	if (end - start < minWindow) { return null; }
	return { start, end };
}
