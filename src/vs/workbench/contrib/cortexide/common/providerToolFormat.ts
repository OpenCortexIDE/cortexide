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
import type { InternalToolInfo } from './prompt/prompts.js';

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

/**
 * Build an OpenAI-compatible function-tool schema (OpenAI / groq / deepSeek / mistral / openRouter /
 * xAI / ...) from our InternalToolInfo. Every param is given an explicit JSON-Schema `type: 'string'`:
 * the OpenAI-family schema expects typed properties, and the previous inline version built this
 * `paramsWithType` map but then emitted the raw (untyped) `params` - so tool schemas shipped with
 * type-less properties. This emits the typed properties. `as const` keeps the `type` literals so the
 * result is assignable to the SDK's ChatCompletionTool at the call site (kept out of this pure module).
 */
/**
 * Build the JSON-Schema `properties` map from an InternalToolInfo's params, giving EVERY param an explicit
 * `type: 'string'`. Shared by all three provider tool-schema builders (OpenAI-compatible here, Anthropic +
 * Gemini in electron-main) so the "every property is typed" contract -- the regression that shipped
 * type-less OpenAI schemas (fixed in ff1718a708d) -- is pinned in ONE tested place. Pure; never mutates `params`.
 */
export const buildTypedToolProperties = (params: InternalToolInfo['params']): { [s: string]: { description: string; type: 'string' } } => {
	const paramsWithType: { [s: string]: { description: string; type: 'string' } } = {}
	for (const key in params) { paramsWithType[key] = { ...params[key], type: 'string' } }
	return paramsWithType
}

export const toOpenAICompatibleTool = (toolInfo: InternalToolInfo) => {
	const { name, description, params } = toolInfo

	const paramsWithType = buildTypedToolProperties(params)

	return {
		type: 'function' as const,
		function: {
			name,
			description,
			parameters: {
				type: 'object' as const,
				properties: paramsWithType,
			},
		},
	}
}

export type SpecialToolFormat = 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined

/**
 * Local inference (Ollama, vLLM, LM Studio, loopback openAICompatible) parses tool calls from
 * XML/JSON text in the message body — never via native provider tool APIs. When both XML tool
 * definitions (system prompt) and a native `tools[]` array are sent, servers like llama.cpp reject
 * the request (issue #45). Force XML/text mode by clearing specialToolFormat for local providers.
 */
export const effectiveSpecialToolFormat = (
	specialToolFormat: SpecialToolFormat,
	isLocalInference: boolean,
): SpecialToolFormat => isLocalInference ? undefined : specialToolFormat

/** Ollama /api/chat message — content is string; optional base64 images for vision models. */
export type OllamaChatMessage = { role: string; content: string; images?: string[] }

/** Strip data-URL prefix from base64 image payloads for Ollama's `images` field. */
export const base64FromDataUrl = (url: string): string =>
	url.startsWith('data:') ? url.replace(/^data:[^;]+;base64,/, '') : url

/**
 * Flatten OpenAI-format messages for Ollama's native /api/chat.
 * Text parts join into `content`; image_url parts become base64 `images` (vision models).
 */
export const convertOpenAIMessagesToOllamaChat = (messages: LLMChatMessage[]): OllamaChatMessage[] =>
	messages.map((m) => {
		const c = (m as { content?: unknown }).content
		let content = ''
		const images: string[] = []
		if (typeof c === 'string') {
			content = c
		} else if (Array.isArray(c)) {
			for (const part of c) {
				if (typeof part === 'string') { content += part }
				else if (part?.type === 'text') { content += part.text ?? '' }
				else if (part?.type === 'image_url' && part.image_url?.url) {
					images.push(base64FromDataUrl(part.image_url.url))
				}
			}
		} else {
			content = c == null ? '' : String(c)
		}
		const out: OllamaChatMessage = { role: (m as { role: string }).role, content }
		if (images.length) { out.images = images }
		return out
	})

/**
 * The running accumulator for an OpenAI-compatible streaming chat response: text, reasoning, and the
 * single tool call (name / args-JSON-string / id) assembled across deltas. The OpenAI streaming
 * protocol delivers a tool call's `function.arguments` in fragments across many chunks, so the args
 * string is CONCATENATED (not replaced) - that string is JSON.parse'd by `rawToolCallObjOfParamsStr`
 * only after the stream finishes.
 */
export interface OpenAIChatAccumulator {
	fullText: string
	fullReasoning: string
	toolName: string
	toolParamsStr: string
	toolId: string
}

/** Minimal shape of a single tool-call entry inside a streaming delta (`delta.tool_calls[n]`). */
export interface OpenAIStreamToolCallDelta {
	index?: number
	id?: string | null
	function?: { name?: string | null; arguments?: string | null }
}

/** Minimal shape of `chunk.choices[0].delta` for an OpenAI-compatible streaming chunk. */
export interface OpenAIStreamDelta {
	content?: unknown
	tool_calls?: OpenAIStreamToolCallDelta[]
	[field: string]: unknown
}

/**
 * Apply one OpenAI-compatible streaming delta to the accumulator and return the updated state (pure -
 * the input is not mutated). Mirrors the inline logic in `_sendOpenAICompatibleChat`'s stream loop
 * byte-for-byte:
 *  - text: `delta.content` is appended; Mistral can send `content` as a parts ARRAY (text / thinking)
 *    rather than a string, which is decomposed into text vs reasoning. A non-string content from any
 *    OTHER provider falls through to string coercion (preserving the original `+=` behavior).
 *  - tool call: only the `index === 0` tool call is captured (the agent loop handles one tool call per
 *    turn); name / arguments / id are CONCATENATED across deltas. A delta entry whose index is absent
 *    (`!== 0`) is skipped, exactly as before.
 *  - reasoning: when the provider exposes a dedicated reasoning field name, its delta value is appended
 *    (using `|| ''` then string coercion, matching the original).
 */
export const accumulateOpenAIChatDelta = (
	state: OpenAIChatAccumulator,
	delta: OpenAIStreamDelta | null | undefined,
	opts: { providerName: string; reasoningFieldName?: string | null }
): OpenAIChatAccumulator => {
	let { fullText, fullReasoning, toolName, toolParamsStr, toolId } = state

	// message
	const newText = delta?.content ?? ''

	// Handle Mistral's object content
	if (opts.providerName === 'mistral' && typeof newText === 'object' && newText !== null) {
		// Parse Mistral's content object
		if (Array.isArray(newText)) {
			for (const item of newText as any[]) {
				if (item.type === 'text' && item.text) {
					fullText += item.text
				} else if (item.type === 'thinking' && item.thinking) {
					for (const thinkingItem of item.thinking as any[]) {
						if (thinkingItem.type === 'text' && thinkingItem.text) {
							fullReasoning += thinkingItem.text
						}
					}
				}
			}
		}
	} else {
		fullText += newText as any
	}

	// tool call
	for (const tool of delta?.tool_calls ?? []) {
		const index = tool.index
		if (index !== 0) continue

		toolName += tool.function?.name ?? ''
		toolParamsStr += tool.function?.arguments ?? ''
		toolId += tool.id ?? ''
	}

	// reasoning
	if (opts.reasoningFieldName) {
		const newReasoning = ((delta as any)?.[opts.reasoningFieldName] || '') + ''
		fullReasoning += newReasoning
	}

	return { fullText, fullReasoning, toolName, toolParamsStr, toolId }
}


/**
 * Pull the text + first tool call out of an OpenAI-compatible NON-streaming response choice. Pure;
 * mirrors processNonStreamingResponse's extraction byte-for-byte: `empty` when the choice is missing,
 * and `hasToolCall` (only the FIRST tool call is captured) so the caller updates its tool vars under the
 * SAME `if (toolCalls.length > 0)` guard the inline code used (leaving an earlier streaming attempt's
 * values untouched when this response has none).
 */
export interface NonStreamingExtract {
	readonly empty: boolean;
	readonly hasToolCall: boolean;
	readonly fullText: string;
	readonly toolName: string;
	readonly toolParamsStr: string;
	readonly toolId: string;
}
export const extractToolCallFromNonStreamingChoice = (choice: any): NonStreamingExtract => {
	if (!choice) {
		return { empty: true, hasToolCall: false, fullText: '', toolName: '', toolParamsStr: '', toolId: '' }
	}
	const fullText = choice.message?.content ?? ''
	const toolCalls = choice.message?.tool_calls ?? []
	if (toolCalls.length > 0) {
		const toolCall = toolCalls[0]
		return {
			empty: false,
			hasToolCall: true,
			fullText,
			toolName: toolCall.function?.name ?? '',
			toolParamsStr: toolCall.function?.arguments ?? '',
			toolId: toolCall.id ?? '',
		}
	}
	return { empty: false, hasToolCall: false, fullText, toolName: '', toolParamsStr: '', toolId: '' }
}


/**
 * The running Gemini tool-capture state. Unlike OpenAI's CONCATENATING deltas, each Gemini chunk's
 * functionCall REPLACES the captured tool (last chunk wins) -- pure reducer, mirrors the inline loop.
 */
export interface GeminiToolState {
	readonly fullTextSoFar: string;
	readonly toolName: string;
	readonly toolParamsStr: string;
	readonly toolId: string;
}
export const reduceGeminiChunk = (
	state: GeminiToolState,
	chunk: { text?: string; functionCalls?: Array<{ name?: string; args?: unknown; id?: string }> }
): GeminiToolState => {
	const fullTextSoFar = state.fullTextSoFar + (chunk.text ?? '')
	const functionCalls = chunk.functionCalls
	if (functionCalls && functionCalls.length > 0) {
		const functionCall = functionCalls[0] // Get the first function call
		return {
			fullTextSoFar,
			toolName: functionCall.name ?? '',
			toolParamsStr: JSON.stringify(functionCall.args ?? {}),
			toolId: functionCall.id ?? '',
		}
	}
	return { fullTextSoFar, toolName: state.toolName, toolParamsStr: state.toolParamsStr, toolId: state.toolId }
}

/** Gemini ids can be empty; other providers expect one, so fall back to a generated id at finalization. */
export const finalizeGeminiToolId = (toolId: string, uuidGen: () => string): string => toolId ? toolId : uuidGen()
