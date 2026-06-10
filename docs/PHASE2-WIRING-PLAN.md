# Phase 2 - Agent-Loop Wiring Plan (saved from the mapping workflow, 2026-06-10)

> The pure module `common/agentLoopDecisions.ts` + tests are ALREADY LANDED (committed).
> This is the remaining WIRING plan: replace the inline loop logic in chatThreadService.ts
> with calls to those pure functions, behavior-preserving, in the safe order below.
> Each edit = its own commit + tsgo + a live check. Defer the parse-classifier + llmError-gate.

I now have everything verified against real source: exact line numbers, behavior, constants (100/30, 6/3, CHAT_RETRIES=3, MAX_MODEL_ESCALATIONS=4, MAX_FILES_READ_PER_QUERY=10), the pure dependencies (`shouldCompactConversation`, `canonicalizeToolName/Params`, `parseTextToolCall`, `getModelCapabilities`), and the test/import conventions. Here is the concrete, conservative implementation plan.

---

# Implementation Plan: `common/agentLoopDecisions.ts`

## Verification summary (against actual source)

All line numbers in the task spec are accurate **except** the "completion" section's claim of `MAX_AGENT_LOOP_ITERATIONS=77 / MAX_LOCAL=78`. The real values (chatThreadService.ts:77-80) are **100 (cloud) / 30 (local)** iterations and **6 (cloud) / 3 (local)** consecutive tool errors. `CHAT_RETRIES=3` (line 74), `MAX_MODEL_ESCALATIONS=4` (line 3296), `MAX_FILES_READ_PER_QUERY=10` (line 81). The pure module hard-codes none of these - it receives them as parameters, so the discrepancy does not affect the module, only test fixtures (which use the verified 100/30, 6/3).

Confirmed pure dependencies already in `common/`: `shouldCompactConversation` (compactionPolicy.ts:44), `canonicalizeToolName`/`canonicalizeToolParams`/`parseTextToolCall` (parseJsonToolCall.ts), `getModelCapabilities` (modelCapabilities.ts). Test convention: `import * as assert from 'assert'; import { suite, test } from 'mocha';` with `.js` extension imports.

---

## 1. `common/agentLoopDecisions.ts` - full content sketch

File path: `/Users/tajudeentajudeen/CodeBase/cortexide/cortexide/src/vs/workbench/contrib/cortexide/common/agentLoopDecisions.ts`

```ts
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
 * replace - see the per-function doc comments for the exact source lines mirrored.
 *
 * IMPORTANT: This module deliberately preserves two known latent bugs so the extraction
 * is behavior-preserving (a fix would be a separate, reviewable change):
 *   (B1) An unparseable text tool-call leaves the consecutive-error counter UNCHANGED
 *        (lastToolMessageType === null => no-op), so gibberish runs exhaust the iteration
 *        cap, not the tool-error cap.
 *   (B2) A synthesized-tool success does NOT reset consecutiveToolErrors (the caller
 *        `break`s before the counter logic); the pure fn never sees that path, so the
 *        elevated count persists - preserved by construction.
 */

import { shouldCompactConversation } from './compactionPolicy.js';
import { canonicalizeToolName, canonicalizeToolParams, parseTextToolCall } from './parseJsonToolCall.js';

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
 * Mirrors chatThreadService.ts:4808-4826. Updates the consecutive-tool-error counter
 * from the last thread-tail tool message type, then checks the cap.
 *  - 'tool_error' | 'invalid_params' => +1
 *  - 'success'                       => reset to 0
 *  - anything else (incl. null)      => UNCHANGED  (B1 preserved)
 * Then, if next >= cap: 'escalate_and_reset' (returns 0) when escalation is available,
 * else 'halt' (returns the incremented value, used verbatim in the user-facing message).
 *
 * The caller still owns tryEscalateModel; pass escalationAvailable=true to mirror current
 * behavior (the cap always *attempts* escalation) and fall through to the halt block if
 * the real tryEscalateModel returns false.
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
 * 2. model-escalation trigger  (chatThreadService.ts:3297-3321 guard + 3 call sites)
 * ========================================================================== */

export interface EscalateInputs {
	triggerSite: 'iterCap' | 'toolErrorCap' | 'llmError';
	// guard state (LAYER 1, lines 3298)
	modelFallbackEnabled: boolean;
	escalationCount: number;
	MAX_MODEL_ESCALATIONS: number;
	// iterCap inputs (3517)
	nMessagesSent: number;
	maxAgentIterations: number;
	// toolErrorCap inputs (4813) - counter already updated by caller / fn #1
	consecutiveToolErrors: number;
	maxConsecutiveToolErrors: number;
	// llmError inputs (4168/4344/4367-4370)
	isAutoMode: boolean;
	/** true whenever the auto-fallback chain found no nextModel, OR auto mode wasn't active. */
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
 * Mirrors the WHETHER-to-escalate decision at all three call sites plus the LAYER-1 guard
 * (line 3298: `!modelFallbackEnabled || escalationCount >= MAX_MODEL_ESCALATIONS`).
 * Pure; the caller still performs the async tryEscalateModel and all side effects.
 *
 * NOTE: the auto-mode llmError fallback (lines 4168-4332) is a SEPARATE mechanism
 * (triedModels, not escalationUsedModels; does not bump escalationCount). This fn models
 * its boundary with `autoFallbackExhausted` - set true only after that chain has fully run.
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
	// (C1) auto-fallback chain runs first; escalation only fires once it's exhausted.
	if (p.isAutoMode && !p.autoFallbackExhausted) { return none; }
	// (C2 retry gate) non-auto, retryable, non-rate-limited, attempts remaining => same-model retry, no escalate.
	if (!p.isAutoMode && !p.isNonRetryableError && !p.isRateLimitError && p.nAttempts < p.CHAT_RETRIES) {
		return none;
	}
	const avoidFreeTier = p.isRateLimitError;
	return { shouldCallEscalate: guardPasses, avoidFreeTier, escalationBlocked: !guardPasses };
}

/* ============================================================================
 * 3. loop continuation  (iter-cap 3517-3528 + post-tool-call 4807-4889)
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
	/** Resolved boolean: tryEscalateModel would be eligible & succeed (kept out of the pure fn). */
	canEscalate: boolean;
}

export interface LoopContinuationResult {
	action: LoopContinuationAction;
	nextNMessagesSent: number;
	nextConsecutiveToolErrors: number;
	isRunningWhenEnd: 'awaiting_user' | undefined;
}

/**
 * Mirrors the iteration-cap check (3517: `nMessagesSent >= maxAgentIterations`, evaluated
 * at the TOP of the iteration BEFORE the per-iteration reset) and the post-tool-call
 * branch (4808-4889). `completionSignaled` / `interrupted` are NOT inputs - the caller
 * handles them and returns before invoking this fn.
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
 * 4. completion detection  (chatThreadService.ts:4407-4894 routing decision)
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
	/** a synthesis gate (4A/4B) set shouldSendAnotherMessage = true this iteration */
	synthFired: boolean;
	synthCompletionSignaled: boolean;
	synthInterrupted: boolean;
}

/**
 * Classifies the loop's next action AFTER all side-effecting steps (synthesis dispatch,
 * real _runToolCall) have run. It ONLY routes; the caller already performed the work and
 * passes the resulting flags. Mirrors the scattered return/`shouldSendAnotherMessage=true`
 * assignments at 4604-4620, 4701-4721, 4732-4801, 4888-4889.
 */
export function classifyCompletionState(p: CompletionInputs): CompletionDecision {
	// Synthesized-tool outcomes (steps D/E) take precedence - they decided control flow first.
	if (p.synthInterrupted) { return { action: 'terminate_interrupted' }; }
	if (p.synthCompletionSignaled) { return { action: 'terminate_completion' }; }
	if (p.synthFired) { return { action: 'continue' }; }

	// No tool call (incl. unparseable text => toolCall stayed null). B1: natural exit.
	if (p.toolCall === null) { return { action: 'terminate_natural' }; }

	// Real toolCall present - skip paths before dispatch result (4732, 4742).
	if (p.fileReadLimitExceeded) { return { action: 'skip_to_next_llm' }; }
	if (p.readFileLimitReached) { return { action: 'skip_to_next_llm' }; }

	// _runToolCall result (4784/4798/4888).
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
	/** already resolved by caller: getModelCapabilities(...).contextWindow ?? 128_000 */
	contextWindow: number;
	/** modelSelection.providerName (resolved; 'auto' disables both blocks) */
	providerName: string;
	/** preprocessedMessages.length (compaction min-message guard) */
	messageCount: number;
	/** this.state.allThreads[threadId]?.messages ?? []  (PERSISTED thread, for alreadyWarned) */
	existingThreadMessages: ReadonlyArray<{ role: string; displayContent?: string }>;
}

export interface CompactionOverflowResult {
	shouldCompact: boolean;
	shouldWarnOverflow: boolean;
	/** rounded integer percent when shouldWarnOverflow, else null */
	overflowPct: number | null;
}

/**
 * Mirrors the compaction block (3721-3769) and the overflow-warning block (3782-3800).
 * The caller resolves contextWindow ONCE and passes it in (de-dupes the two dynamic
 * getModelCapabilities imports). Behavior preserved exactly, including:
 *  - compaction requires enableAutoCompaction; the warning does NOT (3782 omits it).
 *  - compaction passes iterationsSinceLastCompaction = +Infinity (the loop never tracks a
 *    real counter; the minIterationsBetween guard is permanently bypassed). 3732.
 *  - warn threshold 0.70 (3790); compact threshold 0.75 + bail >0.92 (compactionPolicy).
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
 * 6. (optional, phase 2) tool-call parse/classify/fallback - classifyToolCallFromLLMResponse
 *    DEFER: high-risk, dense heuristics + injected callbacks. See "Risk/ordering" below.
 * ========================================================================== */
```

> Note: the file imports the *pure* `shouldCompactConversation`, `canonicalizeToolName`, `canonicalizeToolParams`, `parseTextToolCall`. It does **not** import `getModelCapabilities` (resolved by the caller and passed as `contextWindow` / `modelCapabilities`) so the module stays synchronous and VS-Code-free. Functions #1-#5 are recommended for the first PR. Function #6 (`classifyToolCallFromLLMResponse`) is sketched separately below and should be a **second**, independently-reviewed PR because it carries injected callbacks and the densest heuristics.

---

## 2. Exact wiring edits in `chatThreadService.ts`

Add to the import block near the other `common/` imports:

```ts
import {
	updateConsecutiveToolErrors,
	shouldEscalateModel,
	decideLoopContinuation,
	classifyCompletionState,
	computeCompactionOverflowDecision,
} from '../common/agentLoopDecisions.js';
```

### Edit A - consecutive-tool-error cap (lines 4807-4826)

Old:
```ts
const lastToolMsg = this.state.allThreads[threadId]?.messages.slice(-1)[0]
if (lastToolMsg?.role === 'tool') {
	const tt = (lastToolMsg as ToolMessage<ToolName>).type
	if (tt === 'tool_error' || tt === 'invalid_params') { consecutiveToolErrors += 1 }
	else if (tt === 'success') { consecutiveToolErrors = 0 }
}
if (consecutiveToolErrors >= maxConsecutiveToolErrors) {
	if (await tryEscalateModel(`the previous model failed ${consecutiveToolErrors} tool calls in a row`)) {
		consecutiveToolErrors = 0
		this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
		continue
	}
	this._addMessageToThread(threadId, { role: 'assistant', displayContent: `Stopped after ${consecutiveToolErrors} failed tool calls in a row.${isLocalModel ? ' ...' : ''}`, ... })
	this._setStreamState(threadId, { isRunning: undefined })
	this._addUserCheckpoint({ threadId })
	return
}
```

New (semantically identical - `escalationAvailable: true` keeps `tryEscalateModel` authoritative, falling through to halt when it returns false):
```ts
const lastToolMsg = this.state.allThreads[threadId]?.messages.slice(-1)[0]
const lastToolMessageType = lastToolMsg?.role === 'tool'
	? (lastToolMsg as ToolMessage<ToolName>).type
	: null
const errDec = updateConsecutiveToolErrors(
	consecutiveToolErrors,
	lastToolMessageType as ToolMessageType | null,
	maxConsecutiveToolErrors,
	/* escalationAvailable */ true,
)
consecutiveToolErrors = errDec.nextConsecutiveToolErrors
if (errDec.action !== 'continue') {
	// At the cap: try to escalate; on success reset (already 0) and continue, else halt.
	if (errDec.action === 'escalate_and_reset'
		&& await tryEscalateModel(`the previous model failed ${maxConsecutiveToolErrors} tool calls in a row`)) {
		consecutiveToolErrors = 0
		this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
		continue
	}
	// halt (escalation disabled or returned false)
	this._addMessageToThread(threadId, { role: 'assistant', displayContent: `Stopped after ${maxConsecutiveToolErrors} failed tool calls in a row.${isLocalModel ? ' Small/local models can struggle with multi-step tool use - try Ask/Normal mode for a direct answer, or a larger model.' : ''}`, reasoning: '', anthropicReasoning: null })
	this._setStreamState(threadId, { isRunning: undefined })
	this._addUserCheckpoint({ threadId })
	return
}
```

> Behavior note: the original message interpolates `consecutiveToolErrors` (the already-incremented value), which at the cap equals `maxConsecutiveToolErrors`. The new code uses `maxConsecutiveToolErrors` directly - **identical string** at the only point this runs (`next >= cap`, and `next` is always exactly `cap` on the first crossing since it increments by 1). If you want a byte-identical message even in the unreachable `next > cap` case, set `escalationAvailable: false` and read `errDec.nextConsecutiveToolErrors` for the message instead. The recommended form above is exact for all reachable states.

Add the type import alongside the function imports if not already exported from the tool-message module:
```ts
import type { ToolMessageType } from '../common/agentLoopDecisions.js'
```

### Edit B - iteration cap (lines 3517-3529)

Old: `if (nMessagesSent >= maxAgentIterations) { if (await tryEscalateModel(...)) {...continue} warn; setStreamState(undefined); return }`

New (use `shouldEscalateModel` for the gate decision; `tryEscalateModel` still does the work):
```ts
if (nMessagesSent >= maxAgentIterations) {
	const esc = shouldEscalateModel({
		triggerSite: 'iterCap', modelFallbackEnabled, escalationCount, MAX_MODEL_ESCALATIONS,
		nMessagesSent, maxAgentIterations,
		consecutiveToolErrors, maxConsecutiveToolErrors,
		isAutoMode, autoFallbackExhausted: true, isRateLimitError: false, isNonRetryableError: false,
		nAttempts: 0, CHAT_RETRIES,
	})
	if (esc.shouldCallEscalate && await tryEscalateModel(`the previous model used all ${maxAgentIterations} steps without finishing`)) {
		nMessagesSent = 0
		consecutiveToolErrors = 0
		this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
		continue
	}
	this._notificationService.warn(`Agent stopped after ${maxAgentIterations} tool iterations.${isLocalModel ? ' Small/local models can struggle with multi-step tool use - try Ask/Normal mode for a direct answer, or use a larger model.' : ''}`)
	this._setStreamState(threadId, { isRunning: undefined })
	return
}
```

> `esc.shouldCallEscalate` is `false` exactly when `modelFallbackEnabled` is off or `escalationCount >= MAX`. In those cases the original code would have called `tryEscalateModel`, which **also** returns `false` immediately (its line-3298 guard). So short-circuiting on `shouldCallEscalate` is behavior-identical and just avoids a no-op await.

### Edit C - llmError escalation gate (lines 4344-4382)

Keep the retry block (4344-4359) **structurally unchanged** but make the gate explicit and consistent with the pure fn. Wrap the escalation decision:

```ts
const isNonRetryable = this._isNonRetryableModelError(error)
const esc = shouldEscalateModel({
	triggerSite: 'llmError', modelFallbackEnabled, escalationCount, MAX_MODEL_ESCALATIONS,
	nMessagesSent, maxAgentIterations, consecutiveToolErrors, maxConsecutiveToolErrors,
	isAutoMode,
	// the auto chain already ran above; it set nextModel. In the non-auto path it never ran.
	autoFallbackExhausted: !isAutoMode || nextModel === null,
	isRateLimitError, isNonRetryableError: isNonRetryable, nAttempts, CHAT_RETRIES,
})
// Retry gate (mirrors 4344). When shouldCallEscalate is false AND not blocked AND not auto-still-has-options,
// it means the retry path should run - preserve the EXISTING retry block verbatim:
if (!isAutoMode && !isNonRetryable && !isRateLimitError && nAttempts < CHAT_RETRIES) {
	/* ...unchanged retry block 4345-4358... */
}
// Escalation (mirrors 4366-4382):
for (const k of triedModels) { escalationUsedModels.add(k) }
const escalationReason = isRateLimitError ? 'the previous model was rate-limited'
	: isNonRetryable ? 'the previous model was unavailable' : 'the previous model errored'
if (esc.shouldCallEscalate && await tryEscalateModel(escalationReason, { avoidFreeTier: esc.avoidFreeTier })) {
	/* ...unchanged success block 4371-4381... */
}
/* ...unchanged exhaustion-error block 4387-4395... */
```

> **Conservative recommendation:** for the llmError site, do Edit C in a **later** PR or skip it. The auto-mode branch (4168-4332) sets `nextModel` through multiple paths; threading `autoFallbackExhausted: nextModel === null` correctly requires care that `nextModel` is in scope at line 4366 and reflects the final state after all three auto attempts. The pure `shouldEscalateModel` is fully tested regardless; wiring it here is the highest-risk of the five and yields the least simplification. Land A, B, and the compaction/completion wiring first.

### Edit D - compaction + overflow (lines 3721-3800)

Resolve `contextWindow` once (de-dupes the two dynamic imports), then call the pure fn:

```ts
let contextWindow = 128_000
if ((chatMode === 'agent' || chatMode === 'plan') && promptTokens > 0 && modelSelection.providerName !== 'auto') {
	try {
		const { getModelCapabilities } = await import('../common/modelCapabilities.js')
		const caps = getModelCapabilities(modelSelection.providerName, modelSelection.modelName, this._settingsService.state.overridesOfModel)
		contextWindow = (caps as any).contextWindow ?? 128_000
	} catch { /* keep 128k default */ }
}
const co = computeCompactionOverflowDecision({
	chatMode,
	enableAutoCompaction: this._settingsService.state.globalSettings.enableAutoCompaction,
	promptTokens,
	contextWindow,
	providerName: modelSelection.providerName,
	messageCount: preprocessedMessages.length,
	existingThreadMessages: this.state.allThreads[threadId]?.messages ?? [],
})
if (co.shouldCompact) {
	try {
		const win = selectCompactionWindow(preprocessedMessages.length)
		if (win) { /* ...unchanged marker + prepareLLMChatMessages block 3736-3763... */ }
	} catch { /* best-effort */ }
}
if (co.shouldWarnOverflow && co.overflowPct != null) {
	this._notificationService.warn(
		`Context is ${co.overflowPct}% full (~${Math.round(promptTokens / 1000)}k / ${Math.round(contextWindow / 1000)}k tokens). ` +
		`The agent may start losing earlier context. Consider starting a new thread.`
	)
}
```

> Subtle preserved behavior: the original computed `contextWindow` separately inside each `try` (and each defaulted to 128k on import failure). Resolving once and defaulting to 128k on failure yields the **same value** in every reachable branch (the import is module-cached; both blocks used identical args). The `try/catch` that previously wrapped the import now only wraps the resolution; the compaction `prepareLLMChatMessages` work keeps its own `try/catch`. Net behavior identical.

### Edit E - completion routing (lines 4730-4892, and synth gates 4604-4620 / 4701-4721)

This is the highest-value but most delicate wiring. The **side effects stay inline**; only the final routing collapses to a `switch`. After the real `_runToolCall` at 4783 (and after the synth gates have set their flags), collect flags and route:

```ts
const dec = classifyCompletionState({
	toolCall: toolCall ? { name: toolCall.name } : null,
	completionSignaled, interrupted, awaitingUserApproval,
	fileReadLimitExceeded,
	readFileLimitReached: !!toolCall && toolCall.name === 'read_file' && filesReadInQuery >= MAX_FILES_READ_PER_QUERY,
	synthFired, synthCompletionSignaled, synthInterrupted,
})
switch (dec.action) {
	case 'terminate_interrupted': this._setStreamState(threadId, undefined); /*plan-step mark*/ return
	case 'terminate_completion':  this._setStreamState(threadId, { isRunning: undefined }); return
	case 'skip_to_next_llm':      shouldSendAnotherMessage = true; continue
	case 'await_user':            isRunningWhenEnd = 'awaiting_user'; break
	case 'continue':              shouldSendAnotherMessage = true; break
	case 'terminate_natural':     /* fall through; shouldSendAnotherMessage stays false */ break
}
```

> **Strong recommendation:** do Edit E **last** and incrementally. The current `if (toolCall) { ... }` block interleaves plan-step bookkeeping (4828-4886) and the tool-error counter (Edit A) between the `_runToolCall` return and the final `shouldSendAnotherMessage=true`. A full collapse to the `switch` above requires hoisting `synthFired`/`synthCompletionSignaled`/`synthInterrupted` tracking variables and reordering. The safest first step is to wire **only Edit A and B** (the caps) plus **Edit D** (compaction), validate, then introduce `classifyCompletionState` as a *non-behavioral assertion* (compute `dec` and `assert` it matches the existing inline branch in dev builds) before actually switching control flow on it.

---

## 3. Unit test plan

New file: `/Users/tajudeentajudeen/CodeBase/cortexide/cortexide/src/vs/workbench/contrib/cortexide/test/common/agentLoopDecisions.test.ts` (mocha `suite`/`test`, `assert.deepStrictEqual`).

### `updateConsecutiveToolErrors` (12 cases)
| input `(count, type, cap, esc)` | expected |
|---|---|
| `0,'tool_error',6,false` | `{next:1,'continue'}` |
| `0,'tool_error',3,false` | `{next:1,'continue'}` |
| `2,'invalid_params',3,false` | `{next:3,'halt'}` |
| `2,'invalid_params',3,true` | `{next:0,'escalate_and_reset'}` |
| `5,'success',6,false` | `{next:0,'continue'}` |
| `0,'success',6,false` | `{next:0,'continue'}` |
| `5,'tool_error',6,false` | `{next:6,'halt'}` |
| `5,'tool_error',6,true` | `{next:0,'escalate_and_reset'}` |
| `2,null,3,false` | `{next:2,'continue'}` (B1) |
| `2,'tool_request',3,false` | `{next:2,'continue'}` |
| `1,'rejected',6,true` | `{next:1,'continue'}` |
| `1,'running_now',6,true` | `{next:1,'continue'}` |

### `shouldEscalateModel` (18 cases)
| input | expected |
|---|---|
| iterCap, `nSent=100,max=100`, guardPasses | `{true,false,false}` |
| iterCap, `nSent=99,max=100`, guardPasses | `{false,false,false}` |
| iterCap, `nSent=30,max=30` (local), guardPasses | `{true,false,false}` |
| iterCap, at cap, `modelFallbackEnabled=false` | `{false,false,true}` |
| iterCap, at cap, `escalationCount=4,MAX=4` | `{false,false,true}` |
| toolErrorCap, `cte=6,max=6`, guardPasses | `{true,false,false}` |
| toolErrorCap, `cte=3,max=3` (local), guardPasses | `{true,false,false}` |
| toolErrorCap, `cte=2,max=3` | `{false,false,false}` |
| toolErrorCap, at cap, `modelFallbackEnabled=false` | `{false,false,true}` |
| llmError, `isAutoMode=true, autoFallbackExhausted=false` | `{false,false,false}` |
| llmError, `isAutoMode=true, autoFallbackExhausted=true`, guardPasses | `{true,false,false}` |
| llmError, `!auto, isRateLimit=true`, guardPasses | `{true,true,false}` |
| llmError, `!auto, isNonRetryable=true`, guardPasses | `{true,false,false}` |
| llmError, `!auto, rate=false, nonretry=false, nAttempts=2, CHAT_RETRIES=3` | `{false,false,false}` (retry) |
| llmError, `!auto, ..., nAttempts=3, CHAT_RETRIES=3`, guardPasses | `{true,false,false}` |
| llmError, `!auto, isRateLimit=true, escalationCount=4,MAX=4` | `{false,true,true}` |
| llmError, `!auto, nonretry=true, nAttempts=0` (skips retry) | `{true,false,false}` (guardPasses) |
| llmError, `auto=true, exhausted=true, modelFallbackEnabled=false` | `{false,false,true}` |

### `decideLoopContinuation` (10 cases - the spec's verified set)
All 10 from the task `tests:` list, verbatim, using `assert.deepStrictEqual`. Key ones: iter-cap hard-stop (`100/100/...->hard-stop-iter-cap`), iter-cap escalate (`30/30,canEscalate->escalate-iter-cap, nSent=0,cte=0`), tool success continue, tool_error increment, invalid_params exact-cap escalate, tool-error hard-stop, await-user, no-more-messages, unknown-type no-op, local exact-cap hard-stop.

### `classifyCompletionState` (11 cases)
All 11 from the task list: natural (clean text), natural (B1 unparseable), continue (text-parsed dispatched), terminate_completion (attempt_completion), terminate_interrupted, await_user, skip_to_next_llm (fileReadLimitExceeded), skip_to_next_llm (readFileLimitReached), continue (synthFired), terminate_completion (synthCompletionSignaled), terminate_interrupted (synthInterrupted). Add precedence cases: `synthFired=true` **and** `toolCall=null` -> `continue` (synth wins); `synthInterrupted=true` with `synthCompletionSignaled=true` -> `terminate_interrupted` (interrupted checked first).

### `computeCompactionOverflowDecision` (11 cases)
All 11 from the task list (corrected): mode-guard fail; `enableAutoCompaction=false` -> `{compact:false, warn:true, pct:78}`; `providerName='auto'` -> both false; `promptTokens=0` -> both false; 70% boundary -> `{false,true,70}`; 75% -> `{true,true,75}`; 92% -> `{false,true,92}` (bail); 93% -> `{false,true,93}`; alreadyWarned -> `{true,false,null}`; `messageCount=8` -> `{false,true,75}`; `enableAutoCompaction=false` at 78% -> `{false,true,78}`. Add a boundary case at exactly 92% (`117760/128000`) confirming `shouldCompact` is **true** (bail is `> 0.92`, strict) and 93%+ is false.

Run with the repo's node test harness (same as the other `test/common/*.test.ts`): `node` via the project's mocha runner over `out/` after `node build/next/index.ts transpile`, or the existing per-file run command used for `compactionPolicy.test.ts` / `modelFailover.test.ts`.

---

## 4. Risk / ordering / live validation

**Safest-first ordering (do as separate commits, validate between):**

1. **Land the pure module + all unit tests first** (zero wiring). No runtime behavior changes; pure functions are dead code until wired. tsgo-clean gate: `tsgo --project ./src/tsconfig.json --noEmit --skipLibCheck`.
2. **Edit A (tool-error cap)** - lowest risk: a localized block with one `await` and clear exits. The only subtlety (message interpolation) is addressed above; the new code is byte-identical for all reachable states.
3. **Edit D (compaction/overflow)** - low risk and a real cleanup (removes the duplicate `getModelCapabilities` import). Pure-value-passed; import failure still defaults to 128k.
4. **Edit B (iter-cap)** - low risk; `shouldCallEscalate=false` is provably equivalent to `tryEscalateModel` returning false on its own guard.
5. **Edit E (completion routing)** - do LAST and in two steps: first as a **dev-only assertion** that `classifyCompletionState` agrees with the existing inline branch, then flip control flow once the assertion has run clean across real tasks.
6. **Edit C (llmError gate)** - OPTIONAL / defer. Highest risk, lowest payoff (the auto-fallback mechanism is separate and `nextModel`-scope-sensitive). The pure fn is tested regardless; wiring can wait.

**What could regress (watch closely):**
- **B1/B2 preservation:** the latent bugs MUST remain. If a reviewer "fixes" the `null` no-op or the synth-success reset inside the pure fn, the loop's convergence behavior changes (gibberish would suddenly hit the tool-error cap instead of the iteration cap). Tests pin the current behavior explicitly so any such change fails CI.
- **Tool-error message string** (Edit A): verify the interpolated number stays `maxConsecutiveToolErrors` at the cap. Covered by the byte-identical analysis above; add a snapshot assertion in a follow-up if paranoid.
- **`contextWindow` resolution moving earlier** (Edit D): the await now happens before the compaction `prepareLLMChatMessages` instead of inside each block. Safe (module-cached import) but is the one ordering change - confirm no code between old and new positions reads a stale `contextWindow`.
- **`isRunningWhenEnd` semantics** (Edits B/E): `await-user` must set `isRunningWhenEnd='awaiting_user'` and let the loop exit (NOT continue); the post-loop line 4899 surfaces it. Don't convert `await-user` into a `continue`.
- **Escalation short-circuit** (Edits B/C): `esc.shouldCallEscalate && await tryEscalateModel(...)` - ensure the `&&` does not skip a side effect the original always ran. The original `tryEscalateModel` is side-effect-free when its guard fails (returns false before mutating), so short-circuiting is safe.

**Live validation (post-wiring, CDP harness):**
- A **normal agent task completes** end-to-end (e.g. "create fib.py" on a 7B local or a cloud key) - confirms `continue` / `terminate_completion` routing and the tool-error counter still reset on success.
- **Iteration cap fires:** force a spinning model (or temporarily lower `MAX_AGENT_LOOP_ITERATIONS` in a scratch build) and confirm the warn notification + clean stop (no checkpoint) - exercises Edit B.
- **Tool-error cap fires:** prompt a weak model to repeatedly invent bad tool names; confirm it halts at 3 (local)/6 (cloud) with the assistant "Stopped after N failed tool calls" message + checkpoint - exercises Edit A.
- **Escalation path:** with `enableModelFallback` on and a second configured model, confirm the cap triggers a `Switched to ...` info notification and the task continues - confirms `shouldCallEscalate` gating didn't break the real escalation.
- **Compaction/overflow:** with `enableAutoCompaction` on, run a long agent thread past ~75% context and confirm the auto-compaction metric fires once and the overflow warning fires once (not per-iteration spam from the `alreadyWarned` persisted-thread scan) - exercises Edit D.
- **Restart note:** changes to `chatThreadService.ts` (browser layer) need a rebuild (`node build/next/index.ts transpile`, ~5s) and a fresh dev launch (`env -u ELECTRON_RUN_AS_NODE`, foreground); a relaunch no-ops if an old instance holds CDP port 9222.

---

### Files
- New module: `/Users/tajudeentajudeen/CodeBase/cortexide/cortexide/src/vs/workbench/contrib/cortexide/common/agentLoopDecisions.ts`
- New tests: `/Users/tajudeentajudeen/CodeBase/cortexide/cortexide/src/vs/workbench/contrib/cortexide/test/common/agentLoopDecisions.test.ts`
- Wiring target: `/Users/tajudeentajudeen/CodeBase/cortexide/cortexide/src/vs/workbench/contrib/cortexide/browser/chatThreadService.ts` (Edit A @4807-4826, Edit B @3517-3529, Edit C @4344-4382 [defer], Edit D @3721-3800, Edit E @4730-4892 [last])
- Pure deps reused (no change): `common/compactionPolicy.ts`, `common/parseJsonToolCall.ts`, `common/modelCapabilities.ts`

One correction to the brief worth flagging to whoever implements: the "completion" decision area lists `MAX_AGENT_LOOP_ITERATIONS=77 / MAX_LOCAL=78` - the real constants are **100 / 30** (chatThreadService.ts:77-78); use those in any fixtures. The pure module hard-codes neither.
