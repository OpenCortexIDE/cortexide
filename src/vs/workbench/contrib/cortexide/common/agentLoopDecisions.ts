/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure decision logic extracted from the chatThreadService agent loop (the
 * `while (shouldSendAnotherMessage)` block). Layer: `common/` - NO vs/service imports,
 * fully node-unit-testable. Each function CLASSIFIES; it performs no I/O and no side
 * effects. The caller in chatThreadService.ts owns every side effect (tryEscalateModel,
 * _runToolCall, _setStreamState, _addMessageToThread, _addUserCheckpoint, notifications)
 * and acts on the returned discriminant. Behavior is IDENTICAL to the inline code these
 * mirror (see the per-function doc comments for the exact source lines).
 *
 * IMPORTANT: this module deliberately PRESERVES two known latent behaviors so the eventual
 * extraction is behavior-preserving (fixing them is a separate, reviewable change):
 *   (B1) An unparseable text tool-call leaves the consecutive-error counter UNCHANGED
 *        (lastToolMessageType === null => no-op), so gibberish runs exhaust the iteration
 *        cap, not the tool-error cap.
 *   (B2) A synthesized-tool success does NOT reset consecutiveToolErrors (the caller
 *        `break`s before the counter logic); the pure fn never sees that path.
 */

import { shouldCompactConversation } from './compactionPolicy.js';

/* ============================================================================
 * 1. consecutive-tool-error counting  (chatThreadService.ts:4807-4826)
 * ========================================================================== */

export type ToolMessageType =
	| 'tool_error' | 'invalid_params' | 'success'
	| 'tool_request' | 'running_now' | 'rejected';

export type ToolErrorAction = 'continue' | 'escalate_and_reset' | 'halt';

export interface ToolErrorResult {
	nextConsecutiveToolErrors: number;
	action: ToolErrorAction;
}

/**
 * Mirrors chatThreadService.ts:4808-4826. Updates the consecutive-tool-error counter from
 * the last thread-tail tool message type, then checks the cap.
 *  - 'tool_error' | 'invalid_params' => +1
 *  - 'success'                       => reset to 0
 *  - anything else (incl. null)      => UNCHANGED  (B1 preserved)
 * If next >= cap: 'escalate_and_reset' (returns 0) when escalation is available, else 'halt'
 * (returns the incremented value, used verbatim in the user-facing message).
 */
export function updateConsecutiveToolErrors(
	consecutiveToolErrors: number,
	lastToolMessageType: ToolMessageType | null,
	maxConsecutiveToolErrors: number,
	escalationAvailable: boolean,
): ToolErrorResult {
	let next = consecutiveToolErrors;
	if (lastToolMessageType === 'tool_error' || lastToolMessageType === 'invalid_params') {
		next += 1;
	} else if (lastToolMessageType === 'success') {
		next = 0;
	}
	// all other values (null, 'tool_request', 'running_now', 'rejected'): no change

	if (next >= maxConsecutiveToolErrors) {
		if (escalationAvailable) {
			return { nextConsecutiveToolErrors: 0, action: 'escalate_and_reset' };
		}
		return { nextConsecutiveToolErrors: next, action: 'halt' };
	}
	return { nextConsecutiveToolErrors: next, action: 'continue' };
}

/* ============================================================================
 * 2. model-escalation trigger  (guard line 3298 + the 3 call sites)
 * ========================================================================== */

export interface EscalateInputs {
	triggerSite: 'iterCap' | 'toolErrorCap' | 'llmError';
	// LAYER-1 guard (line 3298)
	modelFallbackEnabled: boolean;
	escalationCount: number;
	MAX_MODEL_ESCALATIONS: number;
	// iterCap inputs
	nMessagesSent: number;
	maxAgentIterations: number;
	// toolErrorCap inputs (counter already updated by the caller / fn #1)
	consecutiveToolErrors: number;
	maxConsecutiveToolErrors: number;
	// llmError inputs
	isAutoMode: boolean;
	/** true once the auto-fallback chain found no nextModel, OR auto mode wasn't active. */
	autoFallbackExhausted: boolean;
	isRateLimitError: boolean;
	isNonRetryableError: boolean;
	nAttempts: number;
	CHAT_RETRIES: number;
}

export interface EscalateResult {
	shouldCallEscalate: boolean;
	avoidFreeTier: boolean;
	escalationBlocked: boolean;
}

/**
 * The WHETHER-to-escalate decision at all three call sites plus the LAYER-1 guard
 * (`!modelFallbackEnabled || escalationCount >= MAX_MODEL_ESCALATIONS`). Pure; the caller
 * still performs the async tryEscalateModel and all side effects.
 */
export function shouldEscalateModel(p: EscalateInputs): EscalateResult {
	const guardPasses = p.modelFallbackEnabled && p.escalationCount < p.MAX_MODEL_ESCALATIONS;
	const none: EscalateResult = { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: false };

	if (p.triggerSite === 'iterCap') {
		if (!(p.nMessagesSent >= p.maxAgentIterations)) { return none; }
		return { shouldCallEscalate: guardPasses, avoidFreeTier: false, escalationBlocked: !guardPasses };
	}

	if (p.triggerSite === 'toolErrorCap') {
		if (!(p.consecutiveToolErrors >= p.maxConsecutiveToolErrors)) { return none; }
		return { shouldCallEscalate: guardPasses, avoidFreeTier: false, escalationBlocked: !guardPasses };
	}

	// triggerSite === 'llmError'
	// auto-fallback chain runs first; escalation only fires once it's exhausted.
	if (p.isAutoMode && !p.autoFallbackExhausted) { return none; }
	// non-auto, retryable, non-rate-limited, attempts remaining => same-model retry, no escalate.
	if (!p.isAutoMode && !p.isNonRetryableError && !p.isRateLimitError && p.nAttempts < p.CHAT_RETRIES) {
		return none;
	}
	const avoidFreeTier = p.isRateLimitError;
	return { shouldCallEscalate: guardPasses, avoidFreeTier, escalationBlocked: !guardPasses };
}

/** Where a SUCCESSFUL mid-task escalation fired from (the sites that reset the per-attempt loop counters). */
export type EscalationResetSite = 'iterCap' | 'toolErrorCap';

export interface PostEscalationCounters {
	readonly nMessagesSent: number;
	readonly consecutiveToolErrors: number;
}

/**
 * The per-attempt loop counters AFTER a successful mid-task model escalation (tryEscalateModel returned
 * true). Escalation hands the SAME task to a fresh, more capable model, so that model MUST start with a
 * clean budget at EVERY trigger site: both the iteration counter (nMessagesSent) and the consecutive-
 * tool-error counter reset to 0.
 *
 * This centralizes a real divergence: the iteration-cap site (chatThreadService ~3552) reset BOTH
 * counters, but the two tool-error escalation sites (~4747 unparseable, ~4865 failed) reset only
 * consecutiveToolErrors -- so a tool-error-escalated model silently inherited a SPENT iteration budget
 * and could hit the iteration cap and stop before it had a fair chance to finish the task. Routing every
 * reset site through this fn makes the reset uniform and pins it against regression.
 *
 * NOTE: the global escalation budget (escalationCount, bounded by MAX_MODEL_ESCALATIONS) is intentionally
 * NOT reset here -- it caps total cross-model work on the task and is owned by tryEscalateModel. Only the
 * per-attempt loop counters reset. The triggerSite is taken so each call site is self-documenting and the
 * golden table can enumerate every site; the reset is uniform across sites by contract.
 */
export function computePostEscalationCounters(triggerSite: EscalationResetSite): PostEscalationCounters {
	void triggerSite;
	return { nMessagesSent: 0, consecutiveToolErrors: 0 };
}

/* ============================================================================
 * 3. loop continuation  (iter-cap 3517 + post-tool-call 4807-4889)
 * ========================================================================== */

export type LoopContinuationAction =
	| 'continue'
	| 'escalate-iter-cap'
	| 'escalate-tool-errors'
	| 'hard-stop-iter-cap'
	| 'hard-stop-tool-errors'
	| 'await-user'
	| 'no-more-messages';

export interface LoopContinuationInputs {
	nMessagesSent: number;
	maxAgentIterations: number;
	consecutiveToolErrors: number;
	maxConsecutiveToolErrors: number;
	/** null when not in the post-tool-call branch, or the tail message isn't a tool message */
	lastToolMessageType: 'success' | 'tool_error' | 'invalid_params' | null;
	/** true only when _runToolCall returned without interrupted/completionSignaled */
	toolCallDispatched: boolean;
	awaitingUserApproval: boolean;
	/** resolved: tryEscalateModel would be eligible & succeed (kept out of the pure fn). */
	canEscalate: boolean;
}

export interface LoopContinuationResult {
	action: LoopContinuationAction;
	nextNMessagesSent: number;
	nextConsecutiveToolErrors: number;
	isRunningWhenEnd: 'awaiting_user' | undefined;
}

/**
 * Mirrors the iteration-cap check (3517: `nMessagesSent >= maxAgentIterations`, evaluated at
 * the TOP of the iteration before the per-iteration reset) and the post-tool-call branch
 * (4808-4889). `completionSignaled` / `interrupted` are NOT inputs - the caller handles them
 * and returns before invoking this fn.
 */
export function decideLoopContinuation(inputs: LoopContinuationInputs): LoopContinuationResult {
	const {
		nMessagesSent, maxAgentIterations,
		consecutiveToolErrors, maxConsecutiveToolErrors,
		lastToolMessageType, toolCallDispatched,
		awaitingUserApproval, canEscalate,
	} = inputs;

	// --- ITER CAP (line 3517) ---
	if (nMessagesSent >= maxAgentIterations) {
		if (canEscalate) {
			return { action: 'escalate-iter-cap', nextNMessagesSent: 0, nextConsecutiveToolErrors: 0, isRunningWhenEnd: undefined };
		}
		return { action: 'hard-stop-iter-cap', nextNMessagesSent: nMessagesSent, nextConsecutiveToolErrors: consecutiveToolErrors, isRunningWhenEnd: undefined };
	}

	// --- POST-TOOL-CALL BRANCH (4808-4889) ---
	if (toolCallDispatched) {
		let nextConsecutiveToolErrors = consecutiveToolErrors;
		if (lastToolMessageType === 'tool_error' || lastToolMessageType === 'invalid_params') {
			nextConsecutiveToolErrors += 1;
		} else if (lastToolMessageType === 'success') {
			nextConsecutiveToolErrors = 0;
		}
		// else: no update (B1 preserved)

		if (nextConsecutiveToolErrors >= maxConsecutiveToolErrors) {
			if (canEscalate) {
				return { action: 'escalate-tool-errors', nextNMessagesSent: nMessagesSent, nextConsecutiveToolErrors: 0, isRunningWhenEnd: undefined };
			}
			return { action: 'hard-stop-tool-errors', nextNMessagesSent: nMessagesSent, nextConsecutiveToolErrors, isRunningWhenEnd: undefined };
		}

		if (awaitingUserApproval) {
			return { action: 'await-user', nextNMessagesSent: nMessagesSent, nextConsecutiveToolErrors, isRunningWhenEnd: 'awaiting_user' };
		}
		return { action: 'continue', nextNMessagesSent: nMessagesSent, nextConsecutiveToolErrors, isRunningWhenEnd: undefined };
	}

	// --- NO TOOL DISPATCHED - natural exit ---
	return { action: 'no-more-messages', nextNMessagesSent: nMessagesSent, nextConsecutiveToolErrors: consecutiveToolErrors, isRunningWhenEnd: undefined };
}

/* ============================================================================
 * 4. completion detection  (the loop's routing decision)
 * ========================================================================== */

export type CompletionDecision =
	| { action: 'terminate_completion' }
	| { action: 'terminate_natural' }
	| { action: 'terminate_interrupted' }
	| { action: 'await_user' }
	| { action: 'continue' }
	| { action: 'skip_to_next_llm' };

export interface CompletionInputs {
	toolCall: { name: string } | null;
	completionSignaled: boolean;
	interrupted: boolean;
	awaitingUserApproval: boolean;
	fileReadLimitExceeded: boolean;
	/** toolCall.name === 'read_file' && filesReadInQuery >= MAX_FILES_READ_PER_QUERY */
	readFileLimitReached: boolean;
	/** a synthesis gate set shouldSendAnotherMessage = true this iteration */
	synthFired: boolean;
	synthCompletionSignaled: boolean;
	synthInterrupted: boolean;
}

/**
 * Classifies the loop's next action AFTER all side-effecting steps (synthesis dispatch, real
 * _runToolCall) have run. It ONLY routes; the caller already performed the work and passes
 * the resulting flags.
 */
export function classifyCompletionState(p: CompletionInputs): CompletionDecision {
	// Synthesized-tool outcomes take precedence - they decided control flow first.
	if (p.synthInterrupted) { return { action: 'terminate_interrupted' }; }
	if (p.synthCompletionSignaled) { return { action: 'terminate_completion' }; }
	if (p.synthFired) { return { action: 'continue' }; }

	// No tool call (incl. unparseable text => toolCall stayed null). B1: natural exit.
	if (p.toolCall === null) { return { action: 'terminate_natural' }; }

	// Real toolCall present - skip paths before dispatch result.
	if (p.fileReadLimitExceeded) { return { action: 'skip_to_next_llm' }; }
	if (p.readFileLimitReached) { return { action: 'skip_to_next_llm' }; }

	// _runToolCall result.
	if (p.interrupted) { return { action: 'terminate_interrupted' }; }
	if (p.completionSignaled) { return { action: 'terminate_completion' }; }
	if (p.awaitingUserApproval) { return { action: 'await_user' }; }
	return { action: 'continue' };
}

/* ============================================================================
 * 5. compaction / overflow trigger  (chatThreadService.ts:3721-3800)
 * ========================================================================== */

export interface CompactionOverflowInputs {
	chatMode: string;
	enableAutoCompaction: boolean;
	promptTokens: number;
	/** already resolved by the caller: getModelCapabilities(...).contextWindow ?? 128_000 */
	contextWindow: number;
	/** modelSelection.providerName (resolved; 'auto' disables both blocks) */
	providerName: string;
	/** preprocessedMessages.length (compaction min-message guard) */
	messageCount: number;
	/** the PERSISTED thread's messages (for the alreadyWarned scan) */
	existingThreadMessages: ReadonlyArray<{ role: string; displayContent?: string }>;
}

export interface CompactionOverflowResult {
	shouldCompact: boolean;
	shouldWarnOverflow: boolean;
	/** rounded integer percent when shouldWarnOverflow, else null */
	overflowPct: number | null;
}

/**
 * Mirrors the compaction block (3721-3769) and the overflow-warning block (3782-3800). The
 * caller resolves contextWindow ONCE and passes it in. Behavior preserved exactly, including:
 *  - compaction requires enableAutoCompaction; the warning does NOT.
 *  - compaction passes iterationsSinceLastCompaction = +Infinity (the loop never tracks a
 *    real counter; the minIterationsBetween guard is permanently bypassed).
 *  - warn threshold 0.70; compact thresholds live in compactionPolicy.
 *  - alreadyWarned scans the PERSISTED thread for any assistant msg containing 'context window'.
 */
export function computeCompactionOverflowDecision(p: CompactionOverflowInputs): CompactionOverflowResult {
	const isAgentOrPlan = p.chatMode === 'agent' || p.chatMode === 'plan';
	const isResolved = p.providerName !== 'auto';
	const hasTokens = p.promptTokens > 0;

	let shouldCompact = false;
	if (isAgentOrPlan && p.enableAutoCompaction && hasTokens && isResolved) {
		shouldCompact = shouldCompactConversation({
			enabled: true,
			chatMode: p.chatMode,
			promptTokens: p.promptTokens,
			contextWindow: p.contextWindow,
			messageCount: p.messageCount,
			iterationsSinceLastCompaction: Number.POSITIVE_INFINITY,
		});
	}

	let shouldWarnOverflow = false;
	let overflowPct: number | null = null;
	if (isAgentOrPlan && hasTokens && isResolved) {
		const usagePct = p.promptTokens / p.contextWindow;
		const alreadyWarned = p.existingThreadMessages.some(
			m => m.role === 'assistant' && !!m.displayContent && m.displayContent.includes('context window')
		);
		if (usagePct >= 0.7 && !alreadyWarned) {
			shouldWarnOverflow = true;
			overflowPct = Math.round(usagePct * 100);
		}
	}

	return { shouldCompact, shouldWarnOverflow, overflowPct };
}

/* ============================================================================
 * 6. file-read gate  (chatThreadService.ts:4716-4753)
 * ========================================================================== */

export type FileReadGateAction =
	| 'no_tool'                // no tool call present (defensive; the inline call site is inside `if (toolCall)`)
	| 'skip_already_exceeded'  // the per-query read limit was already hit on a prior iteration
	| 'hit_limit_now'          // this read_file call reaches the limit; block it, make one final LLM call
	| 'proceed';               // execute the tool (read_file below the limit, or any non-read tool)

export interface FileReadGateInputs {
	hasToolCall: boolean;
	toolName: string;
	fileReadLimitExceeded: boolean;
	filesReadInQuery: number;
	maxFilesReadPerQuery: number;
}

export interface FileReadGateResult {
	action: FileReadGateAction;
	/** the count to interpolate into the user-facing limit message (the PRE-increment value at the limit). */
	filesReadCount: number;
	/** the value to assign back to filesReadInQuery (incremented only on a read_file 'proceed'). */
	nextFilesReadInQuery: number;
	/** the value to assign back to fileReadLimitExceeded (set true only on 'hit_limit_now'). */
	nextFileReadLimitExceeded: boolean;
}

/**
 * Mirrors chatThreadService.ts:4716-4753 byte-for-byte: the excessive-file-read guard that runs after a
 * tool call is recognized but BEFORE it executes. Pure - the caller keeps every side effect
 * (_addMessageToThread for the limit notice, the 'LLM' _setStreamState, `shouldSendAnotherMessage = true`
 * + `continue`, and assigning the two `next*` values back to its loop vars).
 *
 *  - no tool call           => 'no_tool'                (passthrough; counters unchanged)
 *  - limit already exceeded => 'skip_already_exceeded'  (counters unchanged; caller does another LLM call)
 *  - read_file AT/OVER limit => 'hit_limit_now'         (blocks the read; sets the exceeded flag true;
 *                              filesReadCount = the pre-increment filesReadInQuery for the message)
 *  - read_file below limit  => 'proceed'                (nextFilesReadInQuery = filesReadInQuery + 1)
 *  - any non-read tool      => 'proceed'                (counters unchanged)
 *
 * PRESERVED off-by-one (do NOT "fix" here): the limit fires at `filesReadInQuery >= max` and the counter
 * only increments on the read_file proceed path, so the max-th read is BLOCKED, not performed. Fixing
 * that boundary is a separate reviewable change; pinning it in a test keeps the eventual fix provably safe.
 */
export function decideFileReadGate(p: FileReadGateInputs): FileReadGateResult {
	if (!p.hasToolCall) {
		return {
			action: 'no_tool',
			filesReadCount: p.filesReadInQuery,
			nextFilesReadInQuery: p.filesReadInQuery,
			nextFileReadLimitExceeded: p.fileReadLimitExceeded,
		};
	}

	if (p.fileReadLimitExceeded) {
		return {
			action: 'skip_already_exceeded',
			filesReadCount: p.filesReadInQuery,
			nextFilesReadInQuery: p.filesReadInQuery,
			nextFileReadLimitExceeded: p.fileReadLimitExceeded,
		};
	}

	if (p.toolName === 'read_file') {
		if (p.filesReadInQuery >= p.maxFilesReadPerQuery) {
			return {
				action: 'hit_limit_now',
				filesReadCount: p.filesReadInQuery,
				nextFilesReadInQuery: p.filesReadInQuery,
				nextFileReadLimitExceeded: true,
			};
		}
		return {
			action: 'proceed',
			filesReadCount: p.filesReadInQuery,
			nextFilesReadInQuery: p.filesReadInQuery + 1,
			nextFileReadLimitExceeded: p.fileReadLimitExceeded,
		};
	}

	// any non-read tool: proceed, counters untouched
	return {
		action: 'proceed',
		filesReadCount: p.filesReadInQuery,
		nextFilesReadInQuery: p.filesReadInQuery,
		nextFileReadLimitExceeded: p.fileReadLimitExceeded,
	};
}

/* ============================================================================
 * 7. plan-step outcome from the tail tool message
 * ========================================================================== */

export type ToolStepOutcome = 'succeeded' | 'failed' | 'indeterminate';

/**
 * Classify the plan-step outcome from the tail tool message type (shared by the main loop + the
 * pre-loop callThisToolFirst path): 'success' => succeeded, 'tool_error' => failed, everything else
 * (incl. null / invalid_params) => indeterminate (leave as-is).
 */
export function classifyToolStepOutcome(lastToolMessageType: ToolMessageType | null): ToolStepOutcome {
	if (lastToolMessageType === 'success') { return 'succeeded'; }
	if (lastToolMessageType === 'tool_error') { return 'failed'; }
	return 'indeterminate';
}
