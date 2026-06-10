/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure provider request/response helpers extracted from the electron-main provider dispatch
 * (sendLLMMessage.impl.ts) so they are node-unit-testable (the electron-main layer pulls in the
 * Anthropic/OpenAI/Gemini/Ollama SDKs and is excluded from the node test runner). These are the pieces
 * that govern tool-call CAPTURE and message-format correctness across the OpenAI-compatible provider
 * family (openAI / groq / deepSeek / mistral / openRouter / xAI / ...) and Anthropic:
 *
 *  - buildRawToolCallObj      - turn a provider's (id, name, parsed-args) into our RawToolCallObj.
 *  - rawToolCallObjOfParamsStr - the OpenAI-compatible streaming path: JSON.parse the accumulated
 *                                args string, then buildRawToolCallObj. Returns null on bad JSON /
 *                                non-object args (so a malformed tool call is dropped, not crash).
 *  - sanitizeOpenAIMessagesForEmptyContent - some APIs (Vertex, Pollinations) reject empty/whitespace
 *                                content in any message except the optional final assistant turn;
 *                                this substitutes a placeholder.
 *
 * Layer: `common/`. Pure - no I/O, no SDK imports. Byte-for-byte the same logic as the inline
 * originals. Tested in `test/common/providerToolFormat.test.ts`.
 */

import { LLMChatMessage, RawToolCallObj, RawToolParamsObj } from './sendLLMMessageTypes.js';

/** Build our RawToolCallObj from a provider tool call whose args are ALREADY parsed (object | unknown). */
export const buildRawToolCallObj = (id: string, name: string, input: unknown): RawToolCallObj | null => {
	if (input === null) return null
	if (typeof input !== 'object') return null

	const rawParams: RawToolParamsObj = input
	return { id, name, rawParams, doneParams: Object.keys(rawParams), isDone: true }
}

/** OpenAI-compatible path: parse the accumulated tool-args JSON string into our tool format. */
export const rawToolCallObjOfParamsStr = (name: string, toolParamsStr: string, id: string): RawToolCallObj | null => {
	let input: unknown
	try { input = JSON.parse(toolParamsStr) }
	catch (e) { return null }

	return buildRawToolCallObj(id, name, input)
}

// Placeholder for empty message content; Vertex/Pollinations require "non-whitespace text", not just a space.
export const EMPTY_CONTENT_PLACEHOLDER = '(no content)'

/**
 * Sanitize messages for APIs (e.g. Vertex, Pollinations) that require non-empty, non-whitespace content
 * in every message except the optional final assistant message.
 * Only mutates messages that have a 'content' field (OpenAI/Anthropic style); Gemini-style (parts) are passed through.
 */
export const sanitizeOpenAIMessagesForEmptyContent = (messages: LLMChatMessage[]): LLMChatMessage[] => {
	if (!messages?.length) return messages
	const lastIdx = messages.length - 1
	const result = messages.map((msg, i) => {
		if (!('content' in msg)) return msg
		const content = (msg as { role: string; content: string | unknown[] }).content
		const isLastAndAssistant = i === lastIdx && msg.role === 'assistant'
		if (typeof content === 'string') {
			if (content.trim().length > 0) return msg
			if (isLastAndAssistant) return msg
			return { ...msg, content: EMPTY_CONTENT_PLACEHOLDER }
		}
		if (Array.isArray(content)) {
			const hasNonEmptyPart = content.some((p: any) => (p.type === 'text' && p.text?.trim?.()) || (p.type === 'image_url' && p.image_url?.url))
			if (hasNonEmptyPart || isLastAndAssistant) return msg
			return { ...msg, content: [{ type: 'text', text: EMPTY_CONTENT_PLACEHOLDER }] }
		}
		return msg
	})
	return result as LLMChatMessage[]
}
