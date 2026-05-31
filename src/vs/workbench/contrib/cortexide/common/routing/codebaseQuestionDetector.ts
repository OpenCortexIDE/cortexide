/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure heuristic: does a user message look like a "codebase question" (one that
 * needs to understand the whole repo, so the router should prefer a large-context
 * / higher-quality model)?
 *
 * This used to live inline in chatThreadService in two slightly-divergent copies.
 * The bug it fixes: indicator words were matched with substring `includes()`, so
 * "ca[api]tal", "[repo]rt", "re[route]d" etc. falsely tripped codebase routing —
 * e.g. "What is the capital of France?" was classified as a code/codebase task,
 * inflating contextSize to 20k and escalating to the agent tool-loop. Indicators
 * are now matched on word boundaries.
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/codebaseQuestionDetector.test.ts`.
 */

/** Regex patterns that, on their own, mark a message as a codebase question. */
const CODEBASE_QUESTION_PATTERNS: readonly RegExp[] = [
	/\b(codebase|code base|repository|repo|project)\b/,
	/\b(architecture|structure|organization|layout)\b.*\b(project|codebase|repo|code)\b/,
	/\b(project|codebase|repo|code)\b.*\b(architecture|structure|organization|layout)\b/,
	// Trailing \b is load-bearing: without it "repo" matches the "repo" prefix of
	// "report", "code" matches "coder", "app" matches "apple", etc.
	/^what\s+(is|does|are)\s+(my|this|the)\s+(codebase|repo|project|code|app|application)\b/,
	/^what\s+(is|does|are)\s+(my|this|the)\s+\w+\s+(codebase|repo|project)\b/,
	/\bhow\s+many\s+(endpoint|api|route|file|function|class|component|module|service|controller)\b/i,
	/^(summarize|explain|describe|overview|analyze|break down)\s+(my|this|the)\s+(codebase|repo|project|code)\b/,
	/\b(what|which|how)\s+(feature|capability|functionality|endpoint|api|route)\s+(does|has|supports?)\s+(my|this|the)\s+(codebase|repo|project|app)\b/i,
	/\b(what|which)\s+(technology|framework|library|dependency|package|stack)\s+(does|uses?|has)\s+(my|this|the)\s+(codebase|repo|project|app)\b/i,
];

/**
 * Codebase indicator words/phrases. These only count when the message ALSO
 * starts with a question word (see `QUESTION_STARTERS`), and — crucially — they
 * are matched on word boundaries, not as substrings.
 */
const CODEBASE_INDICATORS: readonly string[] = [
	'codebase', 'code base', 'repository', 'repo', 'project structure', 'architecture',
	'endpoint', 'endpoints', 'api', 'apis', 'route', 'routes',
	'file structure', 'code organization', 'project layout',
];

const QUESTION_STARTERS: readonly string[] = [
	'what is', 'what does', 'what are', 'what do',
	'how many', 'how does', 'how do',
	'summarize', 'explain', 'describe', 'overview', 'analyze',
	'which', 'where',
];

/** Word-boundary indicator regexes, precomputed once. */
const INDICATOR_REGEXES: readonly RegExp[] = CODEBASE_INDICATORS.map(
	ind => new RegExp(`\\b${ind}\\b`),
);

/**
 * Returns true if the message reads like a question about the user's codebase.
 * A message qualifies if it matches a strong pattern, OR it contains a codebase
 * indicator word AND starts with a question word.
 */
export function looksLikeCodebaseQuestion(message: string): boolean {
	const lower = message.toLowerCase().trim();
	if (CODEBASE_QUESTION_PATTERNS.some(p => p.test(lower))) {
		return true;
	}
	const hasIndicator = INDICATOR_REGEXES.some(re => re.test(lower));
	const startsWithQuestion = QUESTION_STARTERS.some(s => lower.startsWith(s));
	return hasIndicator && startsWithQuestion;
}
