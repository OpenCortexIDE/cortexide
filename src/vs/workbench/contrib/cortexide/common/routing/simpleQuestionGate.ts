/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure heuristics for taming agent-mode on weak/free models.
 *
 * `looksLikeSimpleQuestion` is the canonical port of chatThreadService's old inline
 * `_detectSimpleQuestion` (kept here so it is unit-testable and there is ONE copy).
 *
 * `isTriviaQuestion` is the stricter gate used to decide whether a turn should run
 * WITHOUT the agent tool-loop: a short general-knowledge question that no workspace
 * tool could answer better. It is deliberately conservative — when unsure it returns
 * false (keep tools), because wrongly stripping tools from a real task is worse than
 * leaving them on for a question the model could have answered directly.
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/simpleQuestionGate.test.ts`.
 */

import { looksLikeCodebaseQuestion } from './codebaseQuestionDetector.js';

/** Terms that mark a request as non-trivial (matches the old _detectSimpleQuestion excludes). */
const COMPLEX_TERMS: readonly string[] = [
	'codebase', 'repository', 'architecture', 'analyze', 'refactor', 'implement', 'debug', 'error', 'fix', 'review',
];

const SIMPLE_STARTERS: readonly string[] = [
	'what is', 'what does', 'what are', 'what do',
	'how do i', 'how to', 'how does', 'how can',
	'explain', 'tell me', 'describe',
	'when', 'where', 'why', 'who',
	'can you', 'could you', 'would you',
];

const SIMPLE_PATTERNS: readonly RegExp[] = [
	/^what\s+(is|does|are|do)\s+/,
	/^how\s+(do|does|can|to)\s+/,
	/^explain\s+/,
	/^tell\s+me\s+/,
	/^describe\s+/,
];

/**
 * Faithful pure port of the old `_detectSimpleQuestion`: a short question that does not
 * contain obvious complexity/coding terms. Used for low-latency routing AND as the base
 * of the trivia gate.
 */
export function looksLikeSimpleQuestion(message: string): boolean {
	const lower = message.toLowerCase().trim();
	if (COMPLEX_TERMS.some(t => lower.includes(t))) {
		return false;
	}
	if (message.length >= 200) {
		return false;
	}
	const isQuestion = SIMPLE_STARTERS.some(s => lower.startsWith(s));
	const matchesPattern = SIMPLE_PATTERNS.some(p => p.test(lower));
	return isQuestion || matchesPattern;
}

/**
 * Word-boundary signals that the user wants the agent to act ON the workspace, so we must
 * NOT strip its tools. Word boundaries avoid the substring trap ("api" in "capital").
 */
const WORKSPACE_ACTION_REGEXES: readonly RegExp[] = [
	/\b(build|compile|lint|deploy|install|commit|push|rebase|merge)\b/,
	/\b(test|tests|run|running|execute)\b/,
	/\b(terminal|shell|command|script)\b/,
	/\b(file|files|folder|directory|function|class|method|variable|module|package|dependency|endpoint|route|api|server)\b/,
	/\b(bug|crash|stack\s*trace|log|logs|output|failing|failed|broken)\b/,
	/\bgit\b/,
	/\b(my|this|the)\s+(code|codebase|project|app|repo|repository|file|function|component|module|service)\b/,
];

function mentionsWorkspaceOrAction(message: string): boolean {
	const lower = message.toLowerCase();
	return WORKSPACE_ACTION_REGEXES.some(re => re.test(lower));
}

/**
 * True when the message is a trivial general-knowledge question that the model should
 * answer directly — no agent tool-loop. Conservative: a codebase question or any
 * workspace/action signal disqualifies it (keep tools).
 */
export function isTriviaQuestion(message: string): boolean {
	return looksLikeSimpleQuestion(message)
		&& !looksLikeCodebaseQuestion(message)
		&& !mentionsWorkspaceOrAction(message);
}
