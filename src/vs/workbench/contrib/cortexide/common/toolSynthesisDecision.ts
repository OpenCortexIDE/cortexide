/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure decision: should the agent loop SYNTHESIZE a tool call from the model's plain-text reply?
 *
 * Weak/local models in agent or plan mode often describe what they intend to do in prose without
 * emitting a tool call. To keep the agent moving (instead of stalling on a chatty reply) the loop can
 * fabricate the most plausible tool call from the user's intent. But over-eager synthesis is harmful:
 * it can fire AFTER a task already completed, spin the loop on a final/closer message, or hijack an
 * image-analysis turn. This module is the GATE that decides whether synthesis is warranted; the loop
 * owns the synthesis ACTION (_synthesizeToolCallFromIntent + _runToolCall) and applies its own
 * result-dependent guard (e.g. don't run search_for_files when images are present).
 *
 * Layer: `common/`. Pure - string/boolean/regex only, no I/O, no vs/service imports. Mirrors the
 * inline gate in chatThreadService byte-for-byte (the outer guard + the inner `shouldUseTools && ...`
 * condition); behavior-preserving by construction. Part of the Phase 2 parse-classifier (ToolCallParser)
 * surface and the synthesis machinery that is latent bug B1's runtime vector. Tested in
 * `test/common/toolSynthesisDecision.test.ts`.
 */

/** Verbs that signal the user wants the agent to DO something (mirrors chatThreadService:4508). */
const ACTION_WORDS = ['add', 'create', 'edit', 'delete', 'remove', 'update', 'modify', 'change', 'make', 'write', 'build', 'implement', 'fix', 'run', 'execute', 'install', 'setup', 'configure'];
/** Terms that signal a question that needs reading the codebase to answer (4509). */
const CODEBASE_QUERY_WORDS = ['codebase', 'code base', 'repository', 'repo', 'project', 'endpoint', 'endpoints', 'api', 'route', 'routes', 'files', 'structure', 'architecture', 'what is', 'about'];
/** Phrases that signal a web/online lookup (4510). */
const WEB_QUERY_WORDS = ['search the web', 'search online', 'check online', 'check the web', 'check the internet', 'check internet', 'go online', 'look online', 'search the internet', 'on the internet', 'look up', 'google', 'duckduckgo', 'browse url', 'fetch url', 'open url'];

export interface ToolSynthesisInputs {
	/** the active chat mode; synthesis only applies in 'agent' or 'plan' */
	readonly chatMode: string;
	/** whether the model already produced a (real or text-parsed) tool call this turn */
	readonly hasToolCall: boolean;
	/** the model's full text reply (raw; this module lowercases where the inline code did) */
	readonly fullText: string;
	/** whether an originating user message exists (no message => never synthesize) */
	readonly hasOriginalUserMessage: boolean;
	/** originalUserMessage.displayContent?.toLowerCase() || '' (the caller lowercases, matching 4507) */
	readonly userRequest: string;
	/** whether the originating user message carries image attachments */
	readonly hasImages: boolean;
	/** true once a tool was synthesized for this request already (one-shot guard) */
	readonly hasSynthesizedForRequest: boolean;
	readonly filesReadInQuery: number;
	readonly maxFilesReadPerQuery: number;
	readonly fileReadLimitExceeded: boolean;
	/** whether the model has a native tool format (only synthesize for tool-capable models) */
	readonly modelSupportsTools: boolean;
	/** LLM attempt count this turn; synthesis only fires after the first attempt (>=1) */
	readonly nAttempts: number;
	/** toolsExecutedInRequest.length - if the model already acted, its trailing prose is not intent */
	readonly toolsExecutedCount: number;
}

export interface ToolSynthesisDecision {
	readonly shouldSynthesize: boolean;
	// intermediate classifications, exposed for testing/transparency:
	readonly isActionRequest: boolean;
	readonly isCodebaseQuery: boolean;
	readonly isWebQuery: boolean;
	readonly shouldUseTools: boolean;
	readonly isImageAnalysisQuery: boolean;
	readonly looksFinal: boolean;
	readonly alreadyActed: boolean;
}

/**
 * Mirrors chatThreadService's synthesis gate: the outer guard (line 4505: agent/plan mode, no tool
 * call yet, non-empty reply, not already synthesized, under the file-read cap, model supports tools)
 * plus an existing user message (4506), then the inner condition (4563: shouldUseTools && nAttempts>=1
 * && !isImageAnalysisQuery && !alreadyActed && !looksFinal && under the file-read cap).
 */
export function decideToolSynthesis(p: ToolSynthesisInputs): ToolSynthesisDecision {
	const none: ToolSynthesisDecision = {
		shouldSynthesize: false,
		isActionRequest: false, isCodebaseQuery: false, isWebQuery: false,
		shouldUseTools: false, isImageAnalysisQuery: false, looksFinal: false,
		alreadyActed: p.toolsExecutedCount > 0,
	};

	// OUTER guard (4505) + an originating user message (4506).
	const outerOk = (p.chatMode === 'agent' || p.chatMode === 'plan')
		&& !p.hasToolCall
		&& p.fullText.trim().length > 0
		&& !p.hasSynthesizedForRequest
		&& p.filesReadInQuery < p.maxFilesReadPerQuery
		&& !p.fileReadLimitExceeded
		&& p.modelSupportsTools;
	if (!outerOk || !p.hasOriginalUserMessage) {
		return none;
	}

	const userRequest = p.userRequest;
	const isActionRequest = ACTION_WORDS.some(word => userRequest.includes(word)) &&
		!userRequest.startsWith('explain') &&
		!userRequest.startsWith('what') &&
		!userRequest.startsWith('how') &&
		!userRequest.startsWith('why');

	const isCodebaseQuery = CODEBASE_QUERY_WORDS.some(word => userRequest.includes(word)) &&
		(userRequest.includes('what') || userRequest.includes('how many') || userRequest.includes('about')) &&
		!(p.hasImages && (userRequest.includes('image') || userRequest.includes('this') || userRequest.includes('that')));

	const isWebQuery = WEB_QUERY_WORDS.some(word => userRequest.includes(word)) ||
		(userRequest.includes('search for') && (userRequest.includes('on the web') || userRequest.includes('on the internet'))) ||
		(userRequest.includes('tell me what you know about') || userRequest.includes('what do you know about')) ||
		((userRequest.includes('what is') || userRequest.includes('who is') || userRequest.includes('when did')) &&
			(userRequest.includes('latest') || userRequest.includes('current') || userRequest.includes('recent') || userRequest.includes('2024') || userRequest.includes('2025')));

	const lowerFull = p.fullText.toLowerCase();
	const shouldUseTools = (isActionRequest || isCodebaseQuery || isWebQuery) &&
		!lowerFull.includes('<read_file>') &&
		!lowerFull.includes('<edit_file>') &&
		!lowerFull.includes('<search_for_files>') &&
		!lowerFull.includes('<create_file') &&
		!lowerFull.includes('<run_command>') &&
		!lowerFull.includes('<web_search>') &&
		!lowerFull.includes('<browse_url>');

	const isEmptyOrShort = !userRequest || userRequest.trim().length < 20;
	const isImageAnalysisQuery = p.hasImages && (
		isEmptyOrShort ||
		userRequest.toLowerCase().includes('image') ||
		userRequest.toLowerCase().includes('what') && (userRequest.toLowerCase().includes('about') || userRequest.toLowerCase().includes('show')) ||
		userRequest.toLowerCase().includes('describe') ||
		userRequest.toLowerCase().includes('analyze')
	);

	const looksFinal = /\b(if you'?d like|let me know|feel free|would you like|could you (please )?(let me know|share|tell)|here are (the|your)|i'?ve (deleted|created|removed|completed|finished)|all (files|done))\b/.test(lowerFull);
	const alreadyActed = p.toolsExecutedCount > 0;

	const shouldSynthesize = shouldUseTools
		&& p.nAttempts >= 1
		&& !isImageAnalysisQuery
		&& !alreadyActed
		&& !looksFinal
		&& p.filesReadInQuery < p.maxFilesReadPerQuery;

	return { shouldSynthesize, isActionRequest, isCodebaseQuery, isWebQuery, shouldUseTools, isImageAnalysisQuery, looksFinal, alreadyActed };
}

/** Nouns a "how many X" question can count - if any appears, the question needs a codebase search (4625-4630). */
const HOW_MANY_NOUNS = ['endpoint', 'api', 'route', 'file', 'function', 'class', 'method', 'component', 'module', 'service', 'controller', 'handler'];
/** Phrases/nouns whose presence (with a digit) means the reply already answered the count (4638-4642). */
const COUNT_IN_RESPONSE_TERMS = ['endpoint', 'api', 'route', 'file', 'function', 'class', 'there are', 'i found', 'total'];

export interface HowManySearchInputs {
	/** whether the model already produced a tool call this turn */
	readonly hasToolCall: boolean;
	/** the model's full text reply (raw; lowercased internally where the inline code did) */
	readonly fullText: string;
	/** whether an originating user message exists */
	readonly hasOriginalUserMessage: boolean;
	/** originalUserMessage.displayContent?.toLowerCase() || '' (caller lowercases, matching 4621) */
	readonly userRequest: string;
	/** toolsExecutedInRequest - this gate only applies AFTER at least one tool ran */
	readonly toolsExecuted: readonly string[];
	readonly hasSynthesizedForRequest: boolean;
	readonly filesReadInQuery: number;
	readonly maxFilesReadPerQuery: number;
}

export interface HowManySearchDecision {
	readonly isHowManyQuestion: boolean;
	readonly needsMoreSearch: boolean;
}

/**
 * The SECOND synthesis trigger (chatThreadService:4620-4645): after the model executed at least one
 * tool but replied with text and no tool call, a "how many X" question that hasn't actually searched or
 * read - and whose reply has no count - should be nudged into one more search_for_files. Mirrors the
 * inline gate byte-for-byte; the caller owns the synthesis action + its search_for_files-only guard.
 */
export function decideHowManySearch(p: HowManySearchInputs): HowManySearchDecision {
	// Outer guard (4620): no tool call yet, non-empty reply, at least one tool already ran, a user message.
	if (p.hasToolCall || p.fullText.trim().length === 0 || p.toolsExecuted.length === 0 || !p.hasOriginalUserMessage) {
		return { isHowManyQuestion: false, needsMoreSearch: false };
	}

	const userRequest = p.userRequest;
	const isHowManyQuestion = userRequest.includes('how many') && HOW_MANY_NOUNS.some(n => userRequest.includes(n));

	const hasSearched = p.toolsExecuted.includes('search_for_files') || p.toolsExecuted.includes('search_pathnames_only');
	const hasRead = p.toolsExecuted.includes('read_file');

	const responseText = p.fullText.toLowerCase();
	const hasCountInResponse = /\d+/.test(responseText) && COUNT_IN_RESPONSE_TERMS.some(t => responseText.includes(t));

	const needsMoreSearch = isHowManyQuestion && !hasSearched && !hasRead && !hasCountInResponse
		&& !p.hasSynthesizedForRequest && p.filesReadInQuery < p.maxFilesReadPerQuery;

	return { isHowManyQuestion, needsMoreSearch };
}
