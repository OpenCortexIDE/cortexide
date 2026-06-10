/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure tool-call recognition for the agent loop's TEXT-fallback path.
 *
 * Many models (notably local Ollama coders, which return NO structured tool_calls and dump JSON in
 * the message content, plus gateways like Pollinations that pass Claude's XML through as text) emit
 * a tool call INSIDE the assistant text instead of via native tool calling. This module recognizes
 * that call and, crucially, computes the "preamble" - the assistant prose BEFORE the first tool-call
 * marker - so the model's HALLUCINATED multi-tool transcript (a single message that contains
 * <tool_call>{json}</tool_call> followed by fake <tool_response> results and more fake calls) does
 * not leak into the shown text or the conversation history. We execute the FIRST real call and
 * re-prompt with the REAL result; the hallucinated tail must be dropped or it reinforces the
 * hallucination and re-triggers bogus errors next turn.
 *
 * Layer: `common/`. Pure. No I/O, no vs/service imports. The CALLER owns id generation (generateUuid)
 * and the downstream ToolName/RawToolParamsObj casts; this module only recognizes + trims so it stays
 * node-unit-testable. Tested in `test/common/toolCallRecognition.test.ts`.
 *
 * This is the seed of the Phase 2 "parse-classifier" (ToolCallParser). A future, DELIBERATE change
 * (the B1 fix) belongs here: today an unparseable would-be tool call is silently treated as natural
 * text; the spec wants it classified as an agent error. That is NOT done here - this extraction is
 * strictly behavior-preserving (it mirrors chatThreadService's inline parse block byte-for-byte).
 */

import { parseTextToolCall, type ParsedJsonToolCall } from './parseJsonToolCall.js';

export interface TextToolCallRecognition {
	/** the tool call parsed from the assistant's text (JSON or Anthropic-XML shapes), or null */
	readonly parsed: ParsedJsonToolCall | null;
	/**
	 * The assistant text to KEEP. When a tool call IS parsed, this is the preamble before the first
	 * tool-call marker (so a hallucinated multi-tool transcript after the real call is discarded);
	 * when nothing is parsed, this is the original text unchanged.
	 */
	readonly preamble: string;
}

/**
 * Recognize a tool call embedded in free assistant text and compute the preamble to retain.
 * Mirrors the inline block in chatThreadService (the `if (!toolCall && info.fullText.trim())` path):
 *  - parse via the canonical pure `parseTextToolCall` (JSON shapes + Anthropic <function_calls> XML);
 *  - if nothing parsed, return the text unchanged (no trim);
 *  - if parsed, cut at the FIRST of: the first `{`, `<tool_call`, `<function_calls`, `<invoke` marker.
 *    cutIdx > 0  -> keep the trimmed prose before it; cutIdx === 0 -> keep nothing ('');
 *    cutIdx === -1 (no marker found, e.g. a non-brace JSON shape) -> keep the full text.
 */
export function recognizeTextToolCall(fullText: string): TextToolCallRecognition {
	const parsed = parseTextToolCall(fullText);
	if (!parsed) {
		return { parsed: null, preamble: fullText };
	}
	const markers = [
		fullText.indexOf('{'),
		fullText.search(/<\s*tool_call\b/i),
		fullText.search(/<\s*function_calls\b/i),
		fullText.search(/<\s*invoke\b/i),
	].filter(i => i >= 0);
	const cutIdx = markers.length ? Math.min(...markers) : -1;
	const preamble = cutIdx > 0 ? fullText.substring(0, cutIdx).trim() : (cutIdx === 0 ? '' : fullText);
	return { parsed, preamble };
}
