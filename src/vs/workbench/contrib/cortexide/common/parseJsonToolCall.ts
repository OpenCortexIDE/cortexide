/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure parser: pull a tool call out of free model text.
 *
 * Weak / local models that don't follow the XML tool format often emit a JSON tool call as
 * plain text (sometimes inside a ```json block) and use whatever field names they were trained
 * on. We accept the common shapes for the NAME field (name / function_name / tool_name / tool /
 * action) and the ARGS field (arguments / params / parameters / input) so those calls actually
 * execute instead of being rendered as inert text. Tool-name validity + param coercion are
 * handled downstream (an unknown name yields a recoverable "no such tool" result).
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/parseJsonToolCall.test.ts`.
 */

export interface ParsedJsonToolCall {
	readonly toolName: string;
	readonly toolParams: Record<string, unknown>;
}

export function parseJsonToolCallFromText(text: string): ParsedJsonToolCall | null {
	try {
		let jsonStr = text.trim();

		// Unwrap a ```json ... ``` (or bare ``` ... ```) code block if present.
		const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		// Find the first balanced { ... } object.
		const openBraceIdx = jsonStr.indexOf('{');
		if (openBraceIdx === -1) {
			return null;
		}
		let braceCount = 0;
		let closeBraceIdx = -1;
		for (let i = openBraceIdx; i < jsonStr.length; i++) {
			if (jsonStr[i] === '{') { braceCount++; }
			if (jsonStr[i] === '}') {
				braceCount--;
				if (braceCount === 0) { closeBraceIdx = i; break; }
			}
		}
		if (closeBraceIdx === -1) {
			return null;
		}

		const parsed = JSON.parse(jsonStr.substring(openBraceIdx, closeBraceIdx + 1));
		if (typeof parsed === 'object' && parsed !== null) {
			const toolName = parsed.name ?? parsed.function_name ?? parsed.tool_name ?? parsed.tool ?? parsed.action;
			const toolParams = parsed.arguments || parsed.params || parsed.parameters || parsed.input || {};
			if (typeof toolName === 'string' && typeof toolParams === 'object' && toolParams !== null) {
				return { toolName, toolParams: toolParams as Record<string, unknown> };
			}
		}
	} catch {
		// Not valid JSON / not a tool call — fall through.
	}
	return null;
}
