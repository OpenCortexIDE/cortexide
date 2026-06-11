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
	/**
	 * B1: true when NOTHING parsed but the text still carries a STRUCTURED tool-call marker
	 * (<tool_call / <function_calls / <invoke) - i.e. the model ATTEMPTED a tool call but emitted
	 * unparseable markup. The loop treats this as an agent error (not a finished answer) so it doesn't
	 * silently no-op. Deliberately NOT set for a bare `{`: legitimate answers contain JSON/code that
	 * parses to no tool, and flagging those would misclassify real final answers.
	 */
	readonly attemptedButMalformed: boolean;
}

/**
 * The structured tool-call wrappers a correctly-formed call would have parsed from. Only the two
 * unambiguous WRAPPER tags: `<tool_call>` and Anthropic's `<function_calls>`. Standalone `<invoke>` is
 * deliberately EXCLUDED - it collides with legitimate content (JSX `<Invoke/>` components, SOAP/XML,
 * Apache config), and a real Anthropic attempt always carries the `<function_calls>` wrapper anyway.
 */
const STRUCTURED_TOOL_CALL_MARKERS: readonly RegExp[] = [/<\s*tool_call\b/i, /<\s*function_calls\b/i];

/** Strip fenced ```...``` blocks and inline `...` code so a marker that is merely QUOTED/illustrated in code does not count. */
function stripCodeSpans(text: string): string {
	return text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
}

/**
 * True iff the text contains a structured tool-call wrapper (`<tool_call` or `<function_calls`) OUTSIDE
 * of any code span. Used to tell an attempted-but-malformed tool call apart from a genuine prose answer.
 * A bare `{` is intentionally NOT a marker (legitimate answers contain JSON/code), standalone `<invoke>`
 * is excluded (JSX/XML collisions), and markers quoted inside code fences/backticks are ignored - so a
 * model that merely DOCUMENTS or shows the tool-call format is not misclassified as having botched one.
 */
export function hasStructuredToolCallMarker(text: string): boolean {
	const outsideCode = stripCodeSpans(text);
	return STRUCTURED_TOOL_CALL_MARKERS.some(re => re.test(outsideCode));
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
		// Nothing parsed. If the text still carries a structured tool-call marker, the model attempted a
		// tool call but botched the markup (B1) - flag it; otherwise it's a genuine prose answer.
		return { parsed: null, preamble: fullText, attemptedButMalformed: hasStructuredToolCallMarker(fullText) };
	}
	const markers = [
		fullText.indexOf('{'),
		fullText.search(/<\s*tool_call\b/i),
		fullText.search(/<\s*function_calls\b/i),
		fullText.search(/<\s*invoke\b/i),
	].filter(i => i >= 0);
	const cutIdx = markers.length ? Math.min(...markers) : -1;
	const preamble = cutIdx > 0 ? fullText.substring(0, cutIdx).trim() : (cutIdx === 0 ? '' : fullText);
	return { parsed, preamble, attemptedButMalformed: false };
}
