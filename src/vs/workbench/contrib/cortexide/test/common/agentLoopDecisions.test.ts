/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	updateConsecutiveToolErrors,
	shouldEscalateModel, EscalateInputs,
	computePostEscalationCounters, EscalationResetSite,
	decideLoopContinuation, LoopContinuationInputs,
	classifyCompletionState, CompletionInputs,
	computeCompactionOverflowDecision, CompactionOverflowInputs,
	decideFileReadGate, FileReadGateInputs,
	classifyToolStepOutcome, ToolMessageType,
} from '../../common/agentLoopDecisions.js';

/**
 * Phase 2: pins the agent loop's pure decision logic (extracted from the 6,217-line
 * chatThreadService god-file). Behavior is mirrored byte-for-byte from the inline loop; these
 * tests lock it so the eventual wiring (replacing inline logic with these calls) is provably
 * behavior-preserving, and so the two known latent behaviors (B1/B2) can't be silently "fixed".
 */

suite('Phase 2 - updateConsecutiveToolErrors', () => {
	const cases: [number, any, number, boolean, any][] = [
		[0, 'tool_error', 6, false, { nextConsecutiveToolErrors: 1, action: 'continue' }],
		[2, 'invalid_params', 3, false, { nextConsecutiveToolErrors: 3, action: 'halt' }],
		[2, 'invalid_params', 3, true, { nextConsecutiveToolErrors: 0, action: 'escalate_and_reset' }],
		[5, 'success', 6, false, { nextConsecutiveToolErrors: 0, action: 'continue' }],
		[0, 'success', 6, false, { nextConsecutiveToolErrors: 0, action: 'continue' }],
		[5, 'tool_error', 6, false, { nextConsecutiveToolErrors: 6, action: 'halt' }],
		[5, 'tool_error', 6, true, { nextConsecutiveToolErrors: 0, action: 'escalate_and_reset' }],
		[2, null, 3, false, { nextConsecutiveToolErrors: 2, action: 'continue' }], // B1
		[2, 'tool_request', 3, false, { nextConsecutiveToolErrors: 2, action: 'continue' }],
		[1, 'rejected', 6, true, { nextConsecutiveToolErrors: 1, action: 'continue' }],
		[1, 'running_now', 6, true, { nextConsecutiveToolErrors: 1, action: 'continue' }],
	];
	for (const [count, type, cap, esc, expected] of cases) {
		test(`(${count}, ${type}, cap=${cap}, esc=${esc})`, () => {
			assert.deepStrictEqual(updateConsecutiveToolErrors(count, type, cap, esc), expected);
		});
	}
});

suite('Phase 2 - shouldEscalateModel', () => {
	const base: EscalateInputs = {
		triggerSite: 'iterCap', modelFallbackEnabled: true, escalationCount: 0, MAX_MODEL_ESCALATIONS: 4,
		nMessagesSent: 0, maxAgentIterations: 100, consecutiveToolErrors: 0, maxConsecutiveToolErrors: 6,
		isAutoMode: false, autoFallbackExhausted: true, isRateLimitError: false, isNonRetryableError: false, nAttempts: 0, CHAT_RETRIES: 3,
	};
	const e = (over: Partial<EscalateInputs>) => shouldEscalateModel({ ...base, ...over });

	test('iterCap at cap, guard passes -> escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'iterCap', nMessagesSent: 100, maxAgentIterations: 100 }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('iterCap below cap -> no escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'iterCap', nMessagesSent: 99, maxAgentIterations: 100 }), { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: false });
	});
	test('iterCap local cap (30/30) -> escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'iterCap', nMessagesSent: 30, maxAgentIterations: 30 }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('iterCap at cap, fallback disabled -> blocked', () => {
		assert.deepStrictEqual(e({ triggerSite: 'iterCap', nMessagesSent: 100, maxAgentIterations: 100, modelFallbackEnabled: false }), { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: true });
	});
	test('iterCap at cap, escalations exhausted -> blocked', () => {
		assert.deepStrictEqual(e({ triggerSite: 'iterCap', nMessagesSent: 100, maxAgentIterations: 100, escalationCount: 4, MAX_MODEL_ESCALATIONS: 4 }), { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: true });
	});
	test('toolErrorCap at cap -> escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'toolErrorCap', consecutiveToolErrors: 6, maxConsecutiveToolErrors: 6 }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('toolErrorCap local (3/3) -> escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'toolErrorCap', consecutiveToolErrors: 3, maxConsecutiveToolErrors: 3 }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('toolErrorCap below cap -> no escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'toolErrorCap', consecutiveToolErrors: 2, maxConsecutiveToolErrors: 3 }), { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: false });
	});
	test('llmError auto, fallback not exhausted -> no escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', isAutoMode: true, autoFallbackExhausted: false }), { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: false });
	});
	test('llmError auto, fallback exhausted -> escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', isAutoMode: true, autoFallbackExhausted: true }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('llmError non-auto rate-limit -> escalate + avoidFreeTier', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', isRateLimitError: true }), { shouldCallEscalate: true, avoidFreeTier: true, escalationBlocked: false });
	});
	test('llmError non-auto retryable, attempts remaining -> retry (no escalate)', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', nAttempts: 2, CHAT_RETRIES: 3 }), { shouldCallEscalate: false, avoidFreeTier: false, escalationBlocked: false });
	});
	test('llmError non-auto retryable, attempts exhausted -> escalate', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', nAttempts: 3, CHAT_RETRIES: 3 }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('llmError non-auto non-retryable -> escalate (skips retry gate)', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', isNonRetryableError: true, nAttempts: 0 }), { shouldCallEscalate: true, avoidFreeTier: false, escalationBlocked: false });
	});
	test('llmError rate-limit but escalations exhausted -> blocked, avoidFreeTier kept', () => {
		assert.deepStrictEqual(e({ triggerSite: 'llmError', isRateLimitError: true, escalationCount: 4, MAX_MODEL_ESCALATIONS: 4 }), { shouldCallEscalate: false, avoidFreeTier: true, escalationBlocked: true });
	});
});

suite('Phase 2 - decideLoopContinuation', () => {
	const base: LoopContinuationInputs = {
		nMessagesSent: 1, maxAgentIterations: 100, consecutiveToolErrors: 0, maxConsecutiveToolErrors: 6,
		lastToolMessageType: 'success', toolCallDispatched: true, awaitingUserApproval: false, canEscalate: false,
	};
	const d = (o: Partial<LoopContinuationInputs>) => decideLoopContinuation({ ...base, ...o });

	test('iter cap hard-stop', () => {
		assert.strictEqual(d({ nMessagesSent: 100, maxAgentIterations: 100 }).action, 'hard-stop-iter-cap');
	});
	test('iter cap escalate resets both counters', () => {
		assert.deepStrictEqual(d({ nMessagesSent: 30, maxAgentIterations: 30, canEscalate: true }), { action: 'escalate-iter-cap', nextNMessagesSent: 0, nextConsecutiveToolErrors: 0, isRunningWhenEnd: undefined });
	});
	test('tool success -> continue, counter reset', () => {
		assert.deepStrictEqual(d({ lastToolMessageType: 'success', consecutiveToolErrors: 4 }), { action: 'continue', nextNMessagesSent: 1, nextConsecutiveToolErrors: 0, isRunningWhenEnd: undefined });
	});
	test('tool_error increments counter, continues below cap', () => {
		assert.deepStrictEqual(d({ lastToolMessageType: 'tool_error', consecutiveToolErrors: 1 }), { action: 'continue', nextNMessagesSent: 1, nextConsecutiveToolErrors: 2, isRunningWhenEnd: undefined });
	});
	test('invalid_params reaching cap -> hard-stop (no escalate)', () => {
		assert.deepStrictEqual(d({ lastToolMessageType: 'invalid_params', consecutiveToolErrors: 5, maxConsecutiveToolErrors: 6 }), { action: 'hard-stop-tool-errors', nextNMessagesSent: 1, nextConsecutiveToolErrors: 6, isRunningWhenEnd: undefined });
	});
	test('tool-error cap with escalate -> resets counter', () => {
		assert.deepStrictEqual(d({ lastToolMessageType: 'tool_error', consecutiveToolErrors: 5, maxConsecutiveToolErrors: 6, canEscalate: true }), { action: 'escalate-tool-errors', nextNMessagesSent: 1, nextConsecutiveToolErrors: 0, isRunningWhenEnd: undefined });
	});
	test('await-user sets isRunningWhenEnd', () => {
		assert.deepStrictEqual(d({ lastToolMessageType: 'success', awaitingUserApproval: true }), { action: 'await-user', nextNMessagesSent: 1, nextConsecutiveToolErrors: 0, isRunningWhenEnd: 'awaiting_user' });
	});
	test('no tool dispatched -> no-more-messages', () => {
		assert.strictEqual(d({ toolCallDispatched: false }).action, 'no-more-messages');
	});
	test('unknown tail type -> counter unchanged (B1)', () => {
		assert.strictEqual(d({ lastToolMessageType: null, consecutiveToolErrors: 2 }).nextConsecutiveToolErrors, 2);
	});
	test('local exact cap -> hard-stop', () => {
		assert.strictEqual(d({ lastToolMessageType: 'tool_error', consecutiveToolErrors: 2, maxConsecutiveToolErrors: 3 }).action, 'hard-stop-tool-errors');
	});
});

suite('Phase 2 - classifyCompletionState', () => {
	const base: CompletionInputs = {
		toolCall: { name: 'edit_file' }, completionSignaled: false, interrupted: false, awaitingUserApproval: false,
		fileReadLimitExceeded: false, readFileLimitReached: false, synthFired: false, synthCompletionSignaled: false, synthInterrupted: false,
	};
	const c = (o: Partial<CompletionInputs>) => classifyCompletionState({ ...base, ...o }).action;

	test('natural exit on no tool call (B1 unparseable)', () => { assert.strictEqual(c({ toolCall: null }), 'terminate_natural'); });
	test('attempt_completion -> terminate_completion', () => { assert.strictEqual(c({ completionSignaled: true }), 'terminate_completion'); });
	test('interrupted -> terminate_interrupted', () => { assert.strictEqual(c({ interrupted: true }), 'terminate_interrupted'); });
	test('awaiting approval -> await_user', () => { assert.strictEqual(c({ awaitingUserApproval: true }), 'await_user'); });
	test('continue when tool dispatched, nothing special', () => { assert.strictEqual(c({}), 'continue'); });
	test('fileReadLimitExceeded -> skip_to_next_llm', () => { assert.strictEqual(c({ fileReadLimitExceeded: true }), 'skip_to_next_llm'); });
	test('readFileLimitReached -> skip_to_next_llm', () => { assert.strictEqual(c({ readFileLimitReached: true }), 'skip_to_next_llm'); });
	test('synthFired -> continue', () => { assert.strictEqual(c({ synthFired: true, toolCall: null }), 'continue'); });
	test('synthCompletionSignaled -> terminate_completion', () => { assert.strictEqual(c({ synthCompletionSignaled: true }), 'terminate_completion'); });
	test('synthInterrupted wins over synthCompletionSignaled', () => { assert.strictEqual(c({ synthInterrupted: true, synthCompletionSignaled: true }), 'terminate_interrupted'); });
	test('synth precedence over null toolCall', () => { assert.strictEqual(c({ synthFired: true, toolCall: null }), 'continue'); });
});

suite('Phase 2 - computeCompactionOverflowDecision', () => {
	const base: CompactionOverflowInputs = {
		chatMode: 'agent', enableAutoCompaction: true, promptTokens: 78_000, contextWindow: 100_000,
		providerName: 'openAI', messageCount: 40, existingThreadMessages: [],
	};
	const f = (o: Partial<CompactionOverflowInputs>) => computeCompactionOverflowDecision({ ...base, ...o });

	test('normal chat (not agent/plan) -> both off', () => {
		assert.deepStrictEqual(f({ chatMode: 'normal' }), { shouldCompact: false, shouldWarnOverflow: false, overflowPct: null });
	});
	test('providerName auto -> both off (unresolved)', () => {
		assert.deepStrictEqual(f({ providerName: 'auto' }), { shouldCompact: false, shouldWarnOverflow: false, overflowPct: null });
	});
	test('promptTokens 0 -> both off', () => {
		assert.deepStrictEqual(f({ promptTokens: 0 }), { shouldCompact: false, shouldWarnOverflow: false, overflowPct: null });
	});
	test('warn fires but compaction OFF when enableAutoCompaction=false', () => {
		assert.deepStrictEqual(f({ enableAutoCompaction: false }), { shouldCompact: false, shouldWarnOverflow: true, overflowPct: 78 });
	});
	test('below warn threshold (69%) -> no warn', () => {
		assert.deepStrictEqual(f({ promptTokens: 69_000 }), { shouldCompact: false, shouldWarnOverflow: false, overflowPct: null });
	});
	test('at warn threshold (70%) -> warn', () => {
		const r = f({ promptTokens: 70_000 });
		assert.strictEqual(r.shouldWarnOverflow, true);
		assert.strictEqual(r.overflowPct, 70);
	});
	test('already-warned thread -> no warn (overflowPct null), compaction may still fire', () => {
		const r = f({ promptTokens: 80_000, existingThreadMessages: [{ role: 'assistant', displayContent: 'note: approaching the context window' }] });
		assert.strictEqual(r.shouldWarnOverflow, false);
		assert.strictEqual(r.overflowPct, null);
	});
	test('overflow percent is rounded', () => {
		assert.strictEqual(f({ promptTokens: 76_500 }).overflowPct, 77);
	});
	test('compaction fires at high usage (agent + enabled + resolved)', () => {
		// 80% > 0.75 threshold and < 0.92 bail, messageCount ok, iterations=Infinity bypasses guard
		assert.strictEqual(f({ promptTokens: 80_000 }).shouldCompact, true);
	});
	test('compaction bails above 92% (warn still fires)', () => {
		const r = f({ promptTokens: 93_000 });
		assert.strictEqual(r.shouldCompact, false);
		assert.strictEqual(r.shouldWarnOverflow, true);
	});
});

suite('Phase 2 - decideFileReadGate', () => {
	const base: FileReadGateInputs = {
		hasToolCall: true, toolName: 'read_file', fileReadLimitExceeded: false,
		filesReadInQuery: 0, maxFilesReadPerQuery: 10,
	};
	const g = (o: Partial<FileReadGateInputs>) => decideFileReadGate({ ...base, ...o });

	test('no tool call -> no_tool, counters unchanged (defensive arm)', () => {
		const r = g({ hasToolCall: false, filesReadInQuery: 5 });
		assert.strictEqual(r.action, 'no_tool');
		assert.strictEqual(r.nextFilesReadInQuery, 5);
		assert.strictEqual(r.nextFileReadLimitExceeded, false);
	});

	test('limit already exceeded -> skip_already_exceeded even for read_file, counters unchanged', () => {
		const r = g({ fileReadLimitExceeded: true, filesReadInQuery: 10, toolName: 'read_file' });
		assert.strictEqual(r.action, 'skip_already_exceeded');
		assert.strictEqual(r.nextFilesReadInQuery, 10);
		assert.strictEqual(r.nextFileReadLimitExceeded, true);
	});

	test('skip_already_exceeded takes precedence over a non-read tool too', () => {
		const r = g({ fileReadLimitExceeded: true, toolName: 'run_command', filesReadInQuery: 3 });
		assert.strictEqual(r.action, 'skip_already_exceeded');
		assert.strictEqual(r.nextFilesReadInQuery, 3);
	});

	test('read_file just BELOW the limit -> proceed, counter increments', () => {
		const r = g({ toolName: 'read_file', filesReadInQuery: 9, maxFilesReadPerQuery: 10 });
		assert.strictEqual(r.action, 'proceed');
		assert.strictEqual(r.nextFilesReadInQuery, 10);
		assert.strictEqual(r.nextFileReadLimitExceeded, false);
	});

	test('read_file AT the limit -> hit_limit_now (the Nth read is BLOCKED, off-by-one PINNED)', () => {
		const r = g({ toolName: 'read_file', filesReadInQuery: 10, maxFilesReadPerQuery: 10 });
		assert.strictEqual(r.action, 'hit_limit_now');
		assert.strictEqual(r.filesReadCount, 10);          // the value interpolated into the user message
		assert.strictEqual(r.nextFilesReadInQuery, 10);    // NOT incremented (the read is blocked)
		assert.strictEqual(r.nextFileReadLimitExceeded, true);
	});

	test('read_file OVER the limit -> hit_limit_now, filesReadCount is the pre-block value', () => {
		const r = g({ toolName: 'read_file', filesReadInQuery: 11, maxFilesReadPerQuery: 10 });
		assert.strictEqual(r.action, 'hit_limit_now');
		assert.strictEqual(r.filesReadCount, 11);
		assert.strictEqual(r.nextFilesReadInQuery, 11);
		assert.strictEqual(r.nextFileReadLimitExceeded, true);
	});

	test('non-read tool AT the read limit -> proceed, counter untouched (limit is read_file-scoped)', () => {
		const r = g({ toolName: 'run_command', filesReadInQuery: 10, maxFilesReadPerQuery: 10 });
		assert.strictEqual(r.action, 'proceed');
		assert.strictEqual(r.nextFilesReadInQuery, 10);
		assert.strictEqual(r.nextFileReadLimitExceeded, false);
	});

	test('non-read tool below the limit -> proceed, counter unchanged (no increment for non-reads)', () => {
		const r = g({ toolName: 'edit_file', filesReadInQuery: 4 });
		assert.strictEqual(r.action, 'proceed');
		assert.strictEqual(r.nextFilesReadInQuery, 4);
	});

	test('boundary: a fresh read at 0 with limit 10 proceeds to 1', () => {
		const r = g({ toolName: 'read_file', filesReadInQuery: 0 });
		assert.strictEqual(r.action, 'proceed');
		assert.strictEqual(r.nextFilesReadInQuery, 1);
	});
});

/**
 * Section 7: classifyToolStepOutcome -- the plan-step outcome read from the tail tool message.
 * Pins the EXACT mapping the main agent loop uses, so the pre-loop callThisToolFirst twin (which
 * previously marked any non-interrupted tool as a completed step) now agrees: only 'success'
 * completes the step, only 'tool_error' fails it, everything else leaves it unchanged.
 */
suite('classifyToolStepOutcome', () => {
	test("'success' -> 'succeeded'", () => {
		assert.strictEqual(classifyToolStepOutcome('success'), 'succeeded');
	});

	test("'tool_error' -> 'failed' (the bug fix: an errored pre-loop tool is NOT a completed step)", () => {
		assert.strictEqual(classifyToolStepOutcome('tool_error'), 'failed');
	});

	test("null -> 'indeterminate' (no tail tool message)", () => {
		assert.strictEqual(classifyToolStepOutcome(null), 'indeterminate');
	});

	test("every non-success/non-tool_error type -> 'indeterminate' (matches the main loop verbatim)", () => {
		const indeterminate: ToolMessageType[] = ['invalid_params', 'tool_request', 'running_now', 'rejected'];
		for (const t of indeterminate) {
			assert.strictEqual(classifyToolStepOutcome(t), 'indeterminate', `expected ${t} -> indeterminate`);
		}
	});

	test('exhaustive: exactly one type completes and one fails; the rest are indeterminate', () => {
		const all: (ToolMessageType | null)[] = ['success', 'tool_error', 'invalid_params', 'tool_request', 'running_now', 'rejected', null];
		const succeeded = all.filter(t => classifyToolStepOutcome(t) === 'succeeded');
		const failed = all.filter(t => classifyToolStepOutcome(t) === 'failed');
		assert.deepStrictEqual(succeeded, ['success']);
		assert.deepStrictEqual(failed, ['tool_error']);
	});
});

suite('computePostEscalationCounters', () => {
	// The CONTRACT this pins: a successful mid-task escalation resets BOTH per-attempt loop counters to 0
	// at EVERY trigger site. The bug it fixes: the two tool-error escalation sites used to reset only
	// consecutiveToolErrors, so the fresh model inherited a spent nMessagesSent budget.
	const ALL_SITES: EscalationResetSite[] = ['iterCap', 'toolErrorCap'];

	test('every trigger site resets both nMessagesSent and consecutiveToolErrors to 0 (uniform)', () => {
		for (const site of ALL_SITES) {
			assert.deepStrictEqual(
				computePostEscalationCounters(site),
				{ nMessagesSent: 0, consecutiveToolErrors: 0 },
				`escalation from '${site}' must grant the fresh model a clean budget`,
			);
		}
	});

	test('the tool-error site is NOT special-cased to skip the nMessagesSent reset (regression guard)', () => {
		// The original divergence was exactly this: toolErrorCap kept nMessagesSent. Pin that it does not.
		assert.strictEqual(computePostEscalationCounters('toolErrorCap').nMessagesSent, 0);
		assert.strictEqual(computePostEscalationCounters('iterCap').nMessagesSent, 0);
	});

	test('the two sites agree (no per-site divergence)', () => {
		assert.deepStrictEqual(
			computePostEscalationCounters('iterCap'),
			computePostEscalationCounters('toolErrorCap'),
		);
	});
});
