/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// disable foreign import complaints
/* eslint-disable */
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import OpenAI, { ClientOptions, AzureOpenAI } from 'openai';
import { MistralCore } from '@mistralai/mistralai/core.js';
import { fimComplete } from '@mistralai/mistralai/funcs/fimComplete.js';
import { Tool as GeminiTool, FunctionDeclaration, GoogleGenAI, ThinkingConfig, Schema, Type } from '@google/genai';
import { GoogleAuth } from 'google-auth-library'
/* eslint-enable */

import { GeminiLLMChatMessage, LLMChatMessage, LLMFIMMessage, ModelListParams, OllamaModelResponse, OnError, OnFinalMessage, OnText, RawToolCallObj } from '../../common/sendLLMMessageTypes.js';
import { rawToolCallObjOfParamsStr, buildRawToolCallObj, sanitizeOpenAIMessagesForEmptyContent, toOpenAICompatibleTool, accumulateOpenAIChatDelta, buildTypedToolProperties, extractToolCallFromNonStreamingChoice, reduceGeminiChunk, finalizeGeminiToolId, effectiveSpecialToolFormat, convertOpenAIMessagesToOllamaChat } from '../../common/providerToolFormat.js';
import { formatGeminiRateLimitError } from '../../common/providerErrorFormat.js';
import { ChatMode, displayInfoOfProviderName, FeatureName, ModelSelectionOptions, OverridesOfModel, ProviderName, SettingsOfProvider } from '../../common/cortexideSettingsTypes.js';
import { getSendableReasoningInfo, getModelCapabilities, getProviderCapabilities, defaultProviderSettings, getReservedOutputTokenSpace } from '../../common/modelCapabilities.js';
import { computeMaxTokensForLocalProvider } from '../../common/localProviderMaxTokens.js';
import { isLoopbackEndpoint } from '../../common/loopbackEndpoint.js';
import { extractEmbeddingVectors } from '../../common/ollamaEmbeddings.js';
import { extractReasoningWrapper, extractXMLToolsWrapper } from './extractGrammar.js';
import { availableTools, InternalToolInfo } from '../../common/prompt/prompts.js';
import { generateUuid } from '../../../../../base/common/uuid.js';

const getGoogleApiKey = async () => {
	// module-level singleton
	const auth = new GoogleAuth({ scopes: `https://www.googleapis.com/auth/cloud-platform` });
	const key = await auth.getAccessToken()
	if (!key) throw new Error(`Google API failed to generate a key.`)
	return key
}




type InternalCommonMessageParams = {
	onText: OnText;
	onFinalMessage: OnFinalMessage;
	onError: OnError;
	providerName: ProviderName;
	settingsOfProvider: SettingsOfProvider;
	modelSelectionOptions: ModelSelectionOptions | undefined;
	overridesOfModel: OverridesOfModel | undefined;
	modelName: string;
	_setAborter: (aborter: () => void) => void;
}

type SendChatParams_Internal = InternalCommonMessageParams & {
	messages: LLMChatMessage[];
	separateSystemMessage: string | undefined;
	chatMode: ChatMode | null;
	mcpTools: InternalToolInfo[] | undefined;
}
type SendFIMParams_Internal = InternalCommonMessageParams & { messages: LLMFIMMessage; separateSystemMessage: string | undefined; featureName?: FeatureName; }
export type ListParams_Internal<ModelResponse> = ModelListParams<ModelResponse>


const invalidApiKeyMessage = (providerName: ProviderName) => `Invalid ${displayInfoOfProviderName(providerName).title} API key.`

// ------------ SDK POOLING FOR LOCAL PROVIDERS ------------

/**
 * In-memory cache for OpenAI-compatible SDK clients (for local providers only).
 * Keyed by: `${providerName}:${endpoint}:${apiKeyHash}`
 * This avoids recreating clients on every request, improving connection reuse.
 */
const openAIClientCache = new Map<string, OpenAI>()

/**
 * In-memory cache for Ollama SDK clients.
 * Keyed by: `${endpoint}`
 */
const ollamaClientCache = new Map<string, Ollama>()

/**
 * Simple hash function for API keys (for cache key generation).
 * Only used for local providers where security is less critical.
 */
const hashApiKey = (apiKey: string | undefined): string => {
	if (!apiKey) return 'noop'
	// Simple hash - just use first 8 chars for cache key (not for security)
	return apiKey.substring(0, 8)
}

/**
 * Build cache key for OpenAI-compatible client.
 * Format: `${providerName}:${endpoint}:${apiKeyHash}`
 */
const buildOpenAICacheKey = (providerName: ProviderName, settingsOfProvider: SettingsOfProvider): string => {
	let endpoint = ''
	let apiKey = 'noop'

	if (providerName === 'openAI') {
		apiKey = settingsOfProvider[providerName]?.apiKey || ''
	} else if (providerName === 'ollama' || providerName === 'vLLM' || providerName === 'lmStudio') {
		endpoint = settingsOfProvider[providerName]?.endpoint || ''
	} else if (providerName === 'openAICompatible' || providerName === 'liteLLM') {
		endpoint = settingsOfProvider[providerName]?.endpoint || ''
		apiKey = settingsOfProvider[providerName]?.apiKey || ''
	}

	return `${providerName}:${endpoint}:${hashApiKey(apiKey)}`
}

/**
 * Get or create OpenAI-compatible client with caching for local providers.
 * For local providers (ollama, vLLM, lmStudio, localhost openAICompatible/liteLLM),
 * we cache clients to reuse connections. Cloud providers always get new instances.
 */
const getOpenAICompatibleClient = async ({ settingsOfProvider, providerName, includeInPayload }: { settingsOfProvider: SettingsOfProvider, providerName: ProviderName, includeInPayload?: { [s: string]: any } }): Promise<OpenAI> => {
	// Detect if this is a local provider
	const isExplicitLocalProvider = providerName === 'ollama' || providerName === 'vLLM' || providerName === 'lmStudio'
	const isLocalhostEndpoint = (providerName === 'openAICompatible' || providerName === 'liteLLM')
		&& isLoopbackEndpoint(settingsOfProvider[providerName]?.endpoint)
	const isLocalProvider = isExplicitLocalProvider || isLocalhostEndpoint

	// Only cache for local providers
	if (isLocalProvider) {
		const cacheKey = buildOpenAICacheKey(providerName, settingsOfProvider)
		const cached = openAIClientCache.get(cacheKey)
		if (cached) {
			return cached
		}
	}

	// Create new client (will cache if local)
	const client = await newOpenAICompatibleSDK({ settingsOfProvider, providerName, includeInPayload })

	// Cache if local provider
	if (isLocalProvider) {
		const cacheKey = buildOpenAICacheKey(providerName, settingsOfProvider)
		openAIClientCache.set(cacheKey, client)
	}

	return client
}

/**
 * Get or create Ollama client with caching.
 */
const getOllamaClient = ({ endpoint }: { endpoint: string }): Ollama => {
	if (!endpoint) throw new Error(`Ollama Endpoint was empty (please enter ${defaultProviderSettings.ollama.endpoint} in CortexIDE Settings if you want the default url).`)

	const cached = ollamaClientCache.get(endpoint)
	if (cached) {
		return cached
	}

	const ollama = new Ollama({ host: endpoint })
	ollamaClientCache.set(endpoint, ollama)
	return ollama
}

// ------------ OPENAI-COMPATIBLE (HELPERS) ------------

const parseHeadersJSON = (s: string | undefined): Record<string, string | null | undefined> | undefined => {
	if (!s) return undefined
	try {
		return JSON.parse(s)
	} catch (e) {
		throw new Error(`Error parsing OpenAI-Compatible headers: ${s} is not a valid JSON.`)
	}
}

/**
 * Compute max_tokens/num_predict for local providers based on feature.
 * For local models, we use smaller token limits to reduce latency:
 * - Autocomplete: 64-96 tokens (very small, fast completions)
 * - Ctrl+K / Apply: 150-250 tokens (small edits)
 * - Other/Cloud: 300 tokens (default)
 */
const newOpenAICompatibleSDK = async ({ settingsOfProvider, providerName, includeInPayload }: { settingsOfProvider: SettingsOfProvider, providerName: ProviderName, includeInPayload?: { [s: string]: any } }) => {
	// Network optimizations: timeouts and connection reuse
	// The OpenAI SDK handles HTTP keep-alive and connection pooling internally
	// Use shorter timeout for local models (they're on localhost, should be fast)

	// Detect local providers: explicit local providers + localhost endpoints
	const isExplicitLocalProvider = providerName === 'ollama' || providerName === 'vLLM' || providerName === 'lmStudio'
	const isLocalhostEndpoint = (providerName === 'openAICompatible' || providerName === 'liteLLM')
		&& isLoopbackEndpoint(settingsOfProvider[providerName]?.endpoint)
	const isLocalProvider = isExplicitLocalProvider || isLocalhostEndpoint

	const timeoutMs = isLocalProvider ? 30_000 : 60_000 // 30s for local, 60s for remote
	const commonPayloadOpts: ClientOptions = {
		dangerouslyAllowBrowser: true,
		timeout: timeoutMs,
		maxRetries: 1, // Reduce retries for local models (they fail fast if not available)
		// Enable HTTP/2 and connection reuse for better performance
		// For localhost, connection reuse is especially important to avoid TCP handshake overhead
		// The OpenAI SDK uses keep-alive by default, which is optimal for localhost
		httpAgent: undefined, // Let SDK handle connection pooling (optimized for localhost)
		...includeInPayload,
	}
	if (providerName === 'openAI') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'ollama') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: 'noop', ...commonPayloadOpts })
	}
	else if (providerName === 'vLLM') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: 'noop', ...commonPayloadOpts })
	}
	else if (providerName === 'liteLLM') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: 'noop', ...commonPayloadOpts })
	}
	else if (providerName === 'lmStudio') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: 'noop', ...commonPayloadOpts })
	}
	else if (providerName === 'openRouter') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({
			baseURL: 'https://openrouter.ai/api/v1',
			apiKey: thisConfig.apiKey,
			defaultHeaders: {
				'HTTP-Referer': 'https://cortexide.com', // Optional, for including your app on openrouter.ai rankings.
				'X-Title': 'CortexIDE', // Optional. Shows in rankings on openrouter.ai.
			},
			...commonPayloadOpts,
		})
	}
	else if (providerName === 'googleVertex') {
		// https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library
		const thisConfig = settingsOfProvider[providerName]
		const baseURL = `https://${thisConfig.region}-aiplatform.googleapis.com/v1/projects/${thisConfig.project}/locations/${thisConfig.region}/endpoints/${'openapi'}`
		const apiKey = await getGoogleApiKey()
		return new OpenAI({ baseURL: baseURL, apiKey: apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'microsoftAzure') {
		// https://learn.microsoft.com/en-us/rest/api/aifoundry/model-inference/get-chat-completions/get-chat-completions?view=rest-aifoundry-model-inference-2024-05-01-preview&tabs=HTTP
		//  https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
		const thisConfig = settingsOfProvider[providerName]
		const endpoint = `https://${thisConfig.project}.openai.azure.com/`;
		const apiVersion = thisConfig.azureApiVersion ?? '2024-04-01-preview';
		const options = { endpoint, apiKey: thisConfig.apiKey, apiVersion };
		return new AzureOpenAI({ ...options, ...commonPayloadOpts });
	}
	else if (providerName === 'awsBedrock') {
		/**
			* We treat Bedrock as *OpenAI-compatible only through a proxy*:
			*   • LiteLLM default → http://localhost:4000/v1
			*   • Bedrock-Access-Gateway → https://<api-id>.execute-api.<region>.amazonaws.com/openai/
			*
			* The native Bedrock runtime endpoint
			*   https://bedrock-runtime.<region>.amazonaws.com
			* is **NOT** OpenAI-compatible, so we do *not* fall back to it here.
			*/
		const { endpoint, apiKey } = settingsOfProvider.awsBedrock

		// 1) use the user-supplied proxy if present
		// 2) otherwise default to local LiteLLM
		let baseURL = endpoint || 'http://localhost:4000/v1'

		// Normalize: make sure we end with "/v1"
		if (!baseURL.endsWith('/v1'))
			baseURL = baseURL.replace(/\/+$/, '') + '/v1'

		return new OpenAI({ baseURL, apiKey, ...commonPayloadOpts })
	}


	else if (providerName === 'deepseek') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'openAICompatible') {
		const thisConfig = settingsOfProvider[providerName]
		const headers = parseHeadersJSON(thisConfig.headersJSON)
		return new OpenAI({ baseURL: thisConfig.endpoint, apiKey: thisConfig.apiKey, defaultHeaders: headers, ...commonPayloadOpts })
	}
	else if (providerName === 'groq') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'xAI') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'mistral') {
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://api.mistral.ai/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'pollinations') {
		// Inference is at gen.pollinations.ai; API keys are from enter.pollinations.ai
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://gen.pollinations.ai/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'moonshot') {
		// allow-any-unicode-next-line
		// Kimi K2 by Moonshot AI — OpenAI-compatible endpoint
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://api.moonshot.ai/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}
	else if (providerName === 'cerebras') {
		// Cerebras Cloud - OpenAI-compatible endpoint, 1M tokens/day free tier
		const thisConfig = settingsOfProvider[providerName]
		return new OpenAI({ baseURL: 'https://api.cerebras.ai/v1', apiKey: thisConfig.apiKey, ...commonPayloadOpts })
	}

	else throw new Error(`CortexIDE providerName was invalid: ${providerName}.`)
}


const _sendOpenAICompatibleFIM = async ({ messages: { prefix, suffix, stopTokens }, onFinalMessage, onError, settingsOfProvider, modelName: modelName_, _setAborter, providerName, overridesOfModel, onText, featureName }: SendFIMParams_Internal) => {

	const {
		modelName,
		supportsFIM,
		additionalOpenAIPayload,
	} = getModelCapabilities(providerName, modelName_, overridesOfModel)

	// Detect if this is a local provider for streaming optimization
	// Note: vLLM and lmStudio don't support FIM, so we only check for ollama here
	const isExplicitLocalProvider = providerName === 'ollama'
	const isLocalhostEndpoint = (providerName === 'openAICompatible' || providerName === 'liteLLM')
		&& isLoopbackEndpoint(settingsOfProvider[providerName]?.endpoint)
	const isLocalProvider = isExplicitLocalProvider || isLocalhostEndpoint

	// Check FIM support - only allow if model explicitly supports it OR if it's a provider that supports FIM
	// Providers with FIM support (that use this function):
	// - openRouter: May support FIM depending on backend model
	// - openAICompatible: May support FIM if backend supports it (e.g., local servers)
	// - liteLLM: May support FIM depending on backend
	// Note: mistral and ollama have their own FIM implementations (not this function)
	// Note: OpenAI's official API does NOT support suffix parameter (except gpt-3.5-turbo-instruct)
	// Note: vLLM and lmStudio do NOT support suffix parameter
	const providersWithFIMSupport = ['openRouter', 'openAICompatible', 'liteLLM']
	const hasFIMSupport = providersWithFIMSupport.includes(providerName) || isLocalhostEndpoint

	if (!supportsFIM && !hasFIMSupport) {
		if (modelName === modelName_)
			onError({ message: `Model ${modelName} does not support FIM. OpenAI's official API does not support FIM. Try Mistral (codestral) or local models (Ollama qwen2.5-coder).`, fullError: null })
		else
			onError({ message: `Model ${modelName_} (${modelName}) does not support FIM. OpenAI's official API does not support FIM. Try Mistral (codestral) or local models (Ollama qwen2.5-coder).`, fullError: null })
		return
	}

	const openai = await getOpenAICompatibleClient({ providerName, settingsOfProvider, includeInPayload: additionalOpenAIPayload })

	// Compute max_tokens based on feature and provider type
	const maxTokensForThisCall = computeMaxTokensForLocalProvider(isLocalProvider, featureName)

	// For local models, use streaming FIM for better responsiveness
	// Only stream if onText is provided and not empty (some consumers like autocomplete have empty onText)
	if (isLocalProvider && onText && typeof onText === 'function') {
		let fullText = ''
		let firstTokenReceived = false
		const firstTokenTimeout = 10_000 // 10 seconds for first token on local models

		const stream = await openai.completions.create({
			model: modelName,
			prompt: prefix,
			suffix: suffix,
			stop: stopTokens,
			max_tokens: maxTokensForThisCall,
			stream: true,
		})

		_setAborter(() => stream.controller?.abort())

		// Set up first token timeout for local models
		const firstTokenTimeoutId = setTimeout(() => {
			if (!firstTokenReceived) {
				stream.controller?.abort()
				onError({
					message: 'Local model took too long to respond for autocomplete. Try a smaller model or a cloud model.',
					fullError: null
				})
			}
		}, firstTokenTimeout)

		try {
			for await (const chunk of stream) {
				// Mark first token received
				if (!firstTokenReceived) {
					firstTokenReceived = true
					clearTimeout(firstTokenTimeoutId)
				}

				const newText = chunk.choices[0]?.text ?? ''
				fullText += newText
				onText({
					fullText,
					fullReasoning: '',
					toolCall: undefined,
				})
			}

			// Clear timeout on successful completion
			clearTimeout(firstTokenTimeoutId)
			onFinalMessage({ fullText, fullReasoning: '', anthropicReasoning: null });
		} catch (streamError) {
			clearTimeout(firstTokenTimeoutId)
			onError({ message: streamError + '', fullError: streamError instanceof Error ? streamError : new Error(String(streamError)) });
		}
	} else {
		// Non-streaming for remote models (fallback)
		openai.completions
			.create({
				model: modelName,
				prompt: prefix,
				suffix: suffix,
				stop: stopTokens,
				max_tokens: maxTokensForThisCall,
			})
			.then(async response => {
				const fullText = response.choices[0]?.text
				onFinalMessage({ fullText, fullReasoning: '', anthropicReasoning: null });
			})
			.catch(error => {
				if (error instanceof OpenAI.APIError && error.status === 401) { onError({ message: invalidApiKeyMessage(providerName), fullError: error }); }
				else { onError({ message: error + '', fullError: error }); }
			})
	}
}


const openAITools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined) => {
	const allowedTools = availableTools(chatMode, mcpTools)
	if (!allowedTools || Object.keys(allowedTools).length === 0) return null

	const openAITools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
	for (const t in allowedTools ?? {}) {
		openAITools.push(toOpenAICompatibleTool(allowedTools[t]))
	}
	return openAITools
}


// Convert an Anthropic tool-use block to our tool format (shared core lives in common/providerToolFormat).
const rawToolCallObjOfAnthropicParams = (toolBlock: Anthropic.Messages.ToolUseBlock): RawToolCallObj | null => {
	return buildRawToolCallObj(toolBlock.id, toolBlock.name, toolBlock.input)
}


// ------------ OPENAI-COMPATIBLE ------------


const _sendOpenAICompatibleChat = async ({ messages, onText, onFinalMessage, onError, settingsOfProvider, modelSelectionOptions, modelName: modelName_, _setAborter, providerName, chatMode, separateSystemMessage, overridesOfModel, mcpTools }: SendChatParams_Internal) => {
	const {
		modelName,
		specialToolFormat,
		reasoningCapabilities,
		additionalOpenAIPayload,
	} = getModelCapabilities(providerName, modelName_, overridesOfModel)

	// Detect local inference early — local models use XML/JSON tool text, not native tool APIs.
	const isExplicitLocalProviderChat = providerName === 'ollama' || providerName === 'vLLM' || providerName === 'lmStudio'
	const isLocalhostEndpointChat = (providerName === 'openAICompatible' || providerName === 'liteLLM')
		&& isLoopbackEndpoint(settingsOfProvider[providerName]?.endpoint)
	const isLocalChat = isExplicitLocalProviderChat || isLocalhostEndpointChat
	const toolFormat = effectiveSpecialToolFormat(specialToolFormat, isLocalChat)

	// APIs like Vertex/Pollinations require non-empty content except for the optional final assistant message
	const messagesToSend = sanitizeOpenAIMessagesForEmptyContent(messages)

	const { providerReasoningIOSettings } = getProviderCapabilities(providerName)

	// reasoning
	const { canIOReasoning, openSourceThinkTags } = reasoningCapabilities || {}
	const reasoningInfo = getSendableReasoningInfo('Chat', providerName, modelName_, modelSelectionOptions, overridesOfModel) // user's modelName_ here

	const includeInPayload = {
		...providerReasoningIOSettings?.input?.includeInPayload?.(reasoningInfo),
		...additionalOpenAIPayload
	}

	// tools
	const potentialTools = openAITools(chatMode, mcpTools)
	const nativeToolsObj = potentialTools && toolFormat === 'openai-style' ?
		{ tools: potentialTools } as const
		: {}

	// instance
	const openai: OpenAI = await getOpenAICompatibleClient({ providerName, settingsOfProvider, includeInPayload })
	if (providerName === 'microsoftAzure') {
		// Required to select the model
		(openai as AzureOpenAI).deploymentName = modelName;
	}

	// open source models - manually parse think tokens
	const { needsManualParse: needsManualReasoningParse, nameOfFieldInDelta: nameOfReasoningFieldInDelta } = providerReasoningIOSettings?.output ?? {}
	const manuallyParseReasoning = needsManualReasoningParse && canIOReasoning && openSourceThinkTags
	if (manuallyParseReasoning) {
		const { newOnText, newOnFinalMessage } = extractReasoningWrapper(onText, onFinalMessage, openSourceThinkTags)
		onText = newOnText
		onFinalMessage = newOnFinalMessage
	}

	// manually parse out tool results if XML
	if (!toolFormat) {
		const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools)
		onText = newOnText
		onFinalMessage = newOnFinalMessage
	}

	// Variables for tracking response state
	let fullReasoningSoFar = ''
	let fullTextSoFar = ''
	let toolName = ''
	let toolId = ''
	let toolParamsStr = ''
	let isRetrying = false // Flag to prevent processing streaming chunks during retry
	let timeoutDeliveredPartial = false // Set when stall timeout fires with partial; outer catch skips onError

	// isLocalChat computed above for tool-format routing; reused for timeout tuning below.

	// Helper function to process streaming response
	const processStreamingResponse = async (response: any) => {
		_setAborter(() => response.controller.abort())

		// For local models: rolling stall timeout (reset on each chunk) so we only fire after no chunk for stallWindow.
		// This prevents premature onFinalMessage(partial) which would freeze the UI while the model keeps streaming.
		const stallWindowMs = isLocalChat ? 60_000 : 0 // 60s of no chunks = stall for local; remote uses one-shot below
		const oneShotTimeoutMs = isLocalChat ? 0 : 120_000 // remote: 120s from start
		const firstTokenTimeout = isLocalChat ? 10_000 : 30_000 // 10s for first token on local

		let firstTokenReceived = false
		let overallTimeoutId: ReturnType<typeof setTimeout> | null = null
		let timeoutFired = false

		const scheduleOverallTimeout = () => {
			if (overallTimeoutId) clearTimeout(overallTimeoutId)
			const delay = isLocalChat ? stallWindowMs : oneShotTimeoutMs
			if (delay <= 0) return
			overallTimeoutId = setTimeout(() => {
				timeoutFired = true
				if (fullTextSoFar || fullReasoningSoFar || toolName) {
					timeoutDeliveredPartial = true
					const toolCall = rawToolCallObjOfParamsStr(toolName, toolParamsStr, toolId)
					const toolCallObj = toolCall ? { toolCall } : {}
					onFinalMessage({
						fullText: fullTextSoFar,
						fullReasoning: fullReasoningSoFar,
						anthropicReasoning: null,
						...toolCallObj
					})
					response.controller?.abort()
				} else {
					response.controller?.abort()
					onError({
						message: isLocalChat
							? 'Local model timed out (no response for 60s). Try a smaller model or use a cloud model.'
							: 'Request timed out.',
						fullError: null
					})
				}
			}, delay)
		}

		// Start overall timeout: rolling for local (reset on each chunk), one-shot for remote
		scheduleOverallTimeout()

		// Set up first-token timeout. Armed for BOTH local and remote: a stalled cloud connection that never
		// sends its first byte should fail fast (30s) with an actionable error instead of hanging until the
		// 120s overall timeout — the latter reads to the user as "the model just doesn't work". (finding #14)
		let firstTokenTimeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
			if (!firstTokenReceived) {
				response.controller?.abort()
				onError({
					message: isLocalChat
						? 'Local model is too slow (no response after 10s). Try a smaller/faster model or use a cloud model.'
						: 'No response from the model provider (timed out waiting for the first token). Check your connection and API key, or try another model.',
					fullError: null
				})
			}
		}, firstTokenTimeout)

		try {
			// when receive text
			for await (const chunk of response) {
				// Check if we're retrying (another response is being processed)
				if (isRetrying) {
					if (overallTimeoutId) clearTimeout(overallTimeoutId)
					if (firstTokenTimeoutId) clearTimeout(firstTokenTimeoutId)
					return // Stop processing this streaming response, retry is in progress
				}

				// If timeout already fired with partial, stop processing (avoid double onFinalMessage)
				if (timeoutFired) break

				// Mark first token received
				if (!firstTokenReceived) {
					firstTokenReceived = true
					if (firstTokenTimeoutId) {
						clearTimeout(firstTokenTimeoutId)
						firstTokenTimeoutId = null
					}
				}

				// Rolling timeout: reset on each chunk for local so we only fire on real stall
				if (isLocalChat) scheduleOverallTimeout()

				// message + tool call + reasoning: accumulate this delta (pure reducer, byte-identical to the
				// previous inline logic - text/Mistral-parts/tool-call-fragments/reasoning).
				const _acc = accumulateOpenAIChatDelta(
					{ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, toolName, toolParamsStr, toolId },
					chunk.choices[0]?.delta,
					{ providerName, reasoningFieldName: nameOfReasoningFieldInDelta }
				)
				fullTextSoFar = _acc.fullText
				fullReasoningSoFar = _acc.fullReasoning
				toolName = _acc.toolName
				toolParamsStr = _acc.toolParamsStr
				toolId = _acc.toolId

				// call onText
				onText({
					fullText: fullTextSoFar,
					fullReasoning: fullReasoningSoFar,
					toolCall: !toolName ? undefined : { name: toolName, rawParams: {}, isDone: false, doneParams: [], id: toolId },
				})

			}

			// Clear timeouts on successful completion
			if (overallTimeoutId) clearTimeout(overallTimeoutId)
			if (firstTokenTimeoutId) clearTimeout(firstTokenTimeoutId)

			// on final (skip if timeout already fired and committed partial)
			if (timeoutFired) return
			if (!fullTextSoFar && !fullReasoningSoFar && !toolName) {
				onError({ message: 'CortexIDE: Response from model was empty.', fullError: null })
			}
			else {
				const toolCall = rawToolCallObjOfParamsStr(toolName, toolParamsStr, toolId)
				const toolCallObj = toolCall ? { toolCall } : {}
				onFinalMessage({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, anthropicReasoning: null, ...toolCallObj });
			}
		} catch (streamError) {
			if (overallTimeoutId) clearTimeout(overallTimeoutId)
			if (firstTokenTimeoutId) clearTimeout(firstTokenTimeoutId)
			// If error occurs during streaming, re-throw to be caught by outer catch handler
			throw streamError
		}
	}

	// Helper function to process non-streaming response
	const processNonStreamingResponse = async (response: any) => {
		const extracted = extractToolCallFromNonStreamingChoice(response.choices[0])
		if (extracted.empty) {
			onError({ message: 'CortexIDE: Response from model was empty.', fullError: null })
			return
		}

		const fullText = extracted.fullText
		// only overwrite the tool vars when THIS response has a tool call (same guard as before)
		if (extracted.hasToolCall) {
			toolName = extracted.toolName
			toolParamsStr = extracted.toolParamsStr
			toolId = extracted.toolId
		}

		// Call onText once with full text
		onText({
			fullText: fullText,
			fullReasoning: '',
			toolCall: !toolName ? undefined : { name: toolName, rawParams: {}, isDone: false, doneParams: [], id: toolId },
		})

		// Call onFinalMessage
		const toolCall = rawToolCallObjOfParamsStr(toolName, toolParamsStr, toolId)
		const toolCallObj = toolCall ? { toolCall } : {}
		onFinalMessage({ fullText: fullText, fullReasoning: '', anthropicReasoning: null, ...toolCallObj });
	}

	// Try streaming first
	const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
		model: modelName,
		messages: messagesToSend as any,
		stream: true,
		...nativeToolsObj,
		...additionalOpenAIPayload
		// max_completion_tokens: maxTokens,
	}

	// Flag to ensure we only process one response (prevent duplicate processing)
	// Use object reference to ensure atomic updates across async operations
	const processingState = { responseProcessed: false, isProcessing: false }
	let streamingResponse: any = null

	openai.chat.completions
		.create(options)
		.then(async response => {
			// Atomic check-and-set to prevent race conditions
			if (processingState.responseProcessed || processingState.isProcessing || isRetrying) {
				return // Guard against duplicate processing
			}
			processingState.isProcessing = true
			streamingResponse = response
			try {
				await processStreamingResponse(response)
				processingState.responseProcessed = true
			} finally {
				processingState.isProcessing = false
			}
		})
		// when error/fail - this catches errors of both .create() and .then(for await)
		.catch(async error => {
			// Stall timeout already delivered partial and aborted; don't show error
			if (timeoutDeliveredPartial) return

			// Abort streaming response if it's still running
			if (streamingResponse) {
				try {
					streamingResponse.controller?.abort()
				} catch (e) {
					// Ignore abort errors
				}
			}

			// Check if this is the organization verification error for streaming
			if (error instanceof OpenAI.APIError &&
				error.status === 400 &&
				error.code === 'unsupported_value' &&
				error.param === 'stream' &&
				error.message?.includes('organization must be verified')) {

				// Set retry flag to stop processing any remaining streaming chunks
				isRetrying = true

				// Reset state variables before retrying to prevent duplicate content
				fullTextSoFar = ''
				fullReasoningSoFar = ''
				toolName = ''
				toolId = ''
				toolParamsStr = ''

				// Retry with streaming disabled (only retry the API call, not the entire message flow)
				// Silently retry - don't show error notification for organization verification issues
				const nonStreamingOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
					model: modelName,
					messages: messagesToSend as any,
					stream: false,
					...nativeToolsObj,
					...additionalOpenAIPayload
				}

				try {
					const response = await openai.chat.completions.create(nonStreamingOptions)
					// Atomic check-and-set to prevent race conditions
					if (processingState.responseProcessed || processingState.isProcessing || !isRetrying) {
						return // Guard against duplicate processing
					}
					processingState.isProcessing = true
					try {
						await processNonStreamingResponse(response)
						processingState.responseProcessed = true
					} finally {
						processingState.isProcessing = false
					}
					isRetrying = false
					// Successfully retried with non-streaming - silently continue, no error notification
					return // Exit early to prevent showing any error
				} catch (retryError) {
					// Log the retry failure for debugging (but don't show confusing error to user)
					console.debug('[sendLLMMessage] Retry with non-streaming also failed:', retryError instanceof Error ? retryError.message : String(retryError))
					// If retry also fails, show a generic error instead of silently failing
					// This prevents users from wondering why the model isn't responding
					onError({
						message: 'Failed to get response from model. Please check your API key and organization settings.',
						fullError: retryError instanceof Error ? retryError : new Error(String(retryError))
					})
					return
				}
			}
			// Check if this is a "model does not support tools" error (e.g., from Ollama)
			else if (error instanceof OpenAI.APIError &&
				error.status === 400 &&
				(error.message?.toLowerCase().includes('does not support tools') ||
					error.message?.toLowerCase().includes('tool') && error.message?.toLowerCase().includes('not support'))) {

				// Set retry flag to stop processing any remaining streaming chunks
				isRetrying = true

				// Reset state variables before retrying to prevent duplicate content
				fullTextSoFar = ''
				fullReasoningSoFar = ''
				toolName = ''
				toolId = ''
				toolParamsStr = ''

				// Retry without tools - this model doesn't support native tool calling
				// Fall back to XML-based tool calling or regular chat
				// CRITICAL: Retry immediately without delay for tool support errors (they're fast to detect)
				const optionsWithoutTools: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
					model: modelName,
					messages: messagesToSend as any,
					stream: true,
					// Explicitly omit tools - don't include nativeToolsObj
					...additionalOpenAIPayload
				}

				try {
					// Use same timeout as original request (already optimized for local models)
					const response = await openai.chat.completions.create(optionsWithoutTools)
					// Atomic check-and-set to prevent race conditions
					if (processingState.responseProcessed || processingState.isProcessing || !isRetrying) {
						return // Guard against duplicate processing
					}
					processingState.isProcessing = true
					streamingResponse = response
					try {
						await processStreamingResponse(response)
						processingState.responseProcessed = true
					} finally {
						processingState.isProcessing = false
					}
					isRetrying = false
					// Successfully retried without tools - silently continue
					// Note: XML-based tool calling will still work if the model supports it
					return // Exit early to prevent showing any error
				} catch (retryError) {
					// Log the retry failure for debugging
					console.debug('[sendLLMMessage] Retry without tools also failed:', retryError instanceof Error ? retryError.message : String(retryError))
					// If retry also fails, show the original error
					onError({
						message: `Model does not support tool calling: ${error.message || 'Unknown error'}`,
						fullError: retryError instanceof Error ? retryError : new Error(String(retryError))
					})
					return
				}
			}
			else if (error instanceof OpenAI.APIError && error.status === 401) {
				onError({ message: invalidApiKeyMessage(providerName), fullError: error });
			}
			else if (error instanceof OpenAI.APIError && error.status === 429) {
				// Rate limit exceeded - don't retry immediately, show clear error
				const rateLimitMessage = error.message || 'Rate limit exceeded. Please wait a moment before trying again.';
				onError({ message: `Rate limit exceeded: ${rateLimitMessage}`, fullError: error });
			}
			else {
				onError({ message: error + '', fullError: error });
			}
		})
}



type OpenAIModel = {
	id: string;
	created: number;
	object: 'model';
	owned_by: string;
}
const _openaiCompatibleList = async ({ onSuccess: onSuccess_, onError: onError_, settingsOfProvider, providerName }: ListParams_Internal<OpenAIModel>) => {
	const onSuccess = ({ models }: { models: OpenAIModel[] }) => {
		onSuccess_({ models })
	}
	const onError = ({ error }: { error: string }) => {
		onError_({ error })
	}
	try {
		const openai = await getOpenAICompatibleClient({ providerName, settingsOfProvider })
		openai.models.list()
			.then(async (response) => {
				const models: OpenAIModel[] = []
				models.push(...response.data)
				while (response.hasNextPage()) {
					models.push(...(await response.getNextPage()).data)
				}
				onSuccess({ models })
			})
			.catch((error) => {
				onError({ error: error + '' })
			})
	}
	catch (error) {
		onError({ error: error + '' })
	}
}




// ------------ ANTHROPIC (HELPERS) ------------
const toAnthropicTool = (toolInfo: InternalToolInfo) => {
	const { name, description, params } = toolInfo
	const paramsWithType = buildTypedToolProperties(params)
	return {
		name: name,
		description: description,
		input_schema: {
			type: 'object',
			properties: paramsWithType,
			// required: Object.keys(params),
		},
	} satisfies Anthropic.Messages.Tool
}

const anthropicTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined) => {
	const allowedTools = availableTools(chatMode, mcpTools)
	if (!allowedTools || Object.keys(allowedTools).length === 0) return null

	const anthropicTools: Anthropic.Messages.ToolUnion[] = []
	for (const t in allowedTools ?? {}) {
		anthropicTools.push(toAnthropicTool(allowedTools[t]))
	}
	return anthropicTools
}



// ------------ ANTHROPIC ------------
const sendAnthropicChat = async ({ messages, providerName, onText, onFinalMessage, onError, settingsOfProvider, modelSelectionOptions, overridesOfModel, modelName: modelName_, _setAborter, separateSystemMessage, chatMode, mcpTools }: SendChatParams_Internal) => {
	const {
		modelName,
		specialToolFormat,
	} = getModelCapabilities(providerName, modelName_, overridesOfModel)

	const thisConfig = settingsOfProvider.anthropic
	const { providerReasoningIOSettings } = getProviderCapabilities(providerName)

	// reasoning
	const reasoningInfo = getSendableReasoningInfo('Chat', providerName, modelName_, modelSelectionOptions, overridesOfModel) // user's modelName_ here
	const includeInPayload = providerReasoningIOSettings?.input?.includeInPayload?.(reasoningInfo) || {}

	// anthropic-specific - max tokens
	const maxTokens = getReservedOutputTokenSpace(providerName, modelName_, { isReasoningEnabled: !!reasoningInfo?.isReasoningEnabled, overridesOfModel })

	// tools
	const potentialTools = anthropicTools(chatMode, mcpTools)
	const nativeToolsObj = potentialTools && specialToolFormat === 'anthropic-style' ?
		{ tools: potentialTools, tool_choice: { type: 'auto' } } as const
		: {}


	// instance
	const anthropic = new Anthropic({
		apiKey: thisConfig.apiKey,
		dangerouslyAllowBrowser: true,
		timeout: 60_000, // 60s timeout
		maxRetries: 2, // Fast retries for transient errors
		// Connection reuse is handled internally by the SDK
	});

	const stream = anthropic.messages.stream({
		system: separateSystemMessage ?? undefined,
		messages: messages as any, // AnthropicLLMChatMessage type may not exactly match SDK's MessageParam, but is compatible at runtime
		model: modelName,
		max_tokens: maxTokens ?? 4_096, // anthropic requires this
		...includeInPayload,
		...nativeToolsObj,

	})

	// manually parse out tool results if XML
	if (!specialToolFormat) {
		const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools)
		onText = newOnText
		onFinalMessage = newOnFinalMessage
	}

	// when receive text
	let fullText = ''
	let fullReasoning = ''

	let fullToolName = ''
	let fullToolParams = ''


	const runOnText = () => {
		onText({
			fullText,
			fullReasoning,
			toolCall: !fullToolName ? undefined : { name: fullToolName, rawParams: {}, isDone: false, doneParams: [], id: 'dummy' },
		})
	}
	// there are no events for tool_use, it comes in at the end
	stream.on('streamEvent', e => {
		// start block
		if (e.type === 'content_block_start') {
			if (e.content_block.type === 'text') {
				if (fullText) fullText += '\n\n' // starting a 2nd text block
				fullText += e.content_block.text
				runOnText()
			}
			else if (e.content_block.type === 'thinking') {
				if (fullReasoning) fullReasoning += '\n\n' // starting a 2nd reasoning block
				fullReasoning += e.content_block.thinking
				runOnText()
			}
			else if (e.content_block.type === 'redacted_thinking') {
				console.log('delta', e.content_block.type)
				if (fullReasoning) fullReasoning += '\n\n' // starting a 2nd reasoning block
				fullReasoning += '[redacted_thinking]'
				runOnText()
			}
			else if (e.content_block.type === 'tool_use') {
				// Keep only the FIRST tool_use block's name: the agent loop runs one tool per turn and
				// finalMessage (below) uses tools[0], so `+=` concatenated parallel tool names into garbage
				// like "read_filelist_dir" in the streamed toolCall.
				if (!fullToolName) fullToolName = e.content_block.name ?? '' // anthropic gives us the tool name in the start block
				runOnText()
			}
		}

		// delta
		else if (e.type === 'content_block_delta') {
			if (e.delta.type === 'text_delta') {
				fullText += e.delta.text
				runOnText()
			}
			else if (e.delta.type === 'thinking_delta') {
				fullReasoning += e.delta.thinking
				runOnText()
			}
			else if (e.delta.type === 'input_json_delta') { // tool use
				fullToolParams += e.delta.partial_json ?? '' // anthropic gives us the partial delta (string) here - https://docs.anthropic.com/en/api/messages-streaming
				runOnText()
			}
		}
	})

	// on done - (or when error/fail) - this is called AFTER last streamEvent
	stream.on('finalMessage', (response) => {
		const anthropicReasoning = response.content.filter(c => c.type === 'thinking' || c.type === 'redacted_thinking')
		const tools = response.content.filter(c => c.type === 'tool_use')
		// console.log('TOOLS!!!!!!', JSON.stringify(tools, null, 2))
		// console.log('TOOLS!!!!!!', JSON.stringify(response, null, 2))
		const toolCall = tools[0] && rawToolCallObjOfAnthropicParams(tools[0])
		const toolCallObj = toolCall ? { toolCall } : {}

		onFinalMessage({ fullText, fullReasoning, anthropicReasoning, ...toolCallObj })
	})
	// on error
	stream.on('error', (error) => {
		if (error instanceof Anthropic.APIError && error.status === 401) { onError({ message: invalidApiKeyMessage(providerName), fullError: error }) }
		else { onError({ message: error + '', fullError: error }) }
	})
	_setAborter(() => stream.controller.abort())
}



// ------------ MISTRAL ------------
// https://docs.mistral.ai/api/#tag/fim
const sendMistralFIM = ({ messages, onFinalMessage, onError, settingsOfProvider, overridesOfModel, modelName: modelName_, _setAborter, providerName }: SendFIMParams_Internal) => {
	const { modelName, supportsFIM } = getModelCapabilities(providerName, modelName_, overridesOfModel)
	if (!supportsFIM) {
		if (modelName === modelName_)
			onError({ message: `Model ${modelName} does not support FIM.`, fullError: null })
		else
			onError({ message: `Model ${modelName_} (${modelName}) does not support FIM.`, fullError: null })
		return
	}

	const mistral = new MistralCore({ apiKey: settingsOfProvider.mistral.apiKey })
	fimComplete(mistral,
		{
			model: modelName,
			prompt: messages.prefix,
			suffix: messages.suffix,
			stream: false,
			maxTokens: 300,
			stop: messages.stopTokens,
		})
		.then(async response => {

			// unfortunately, _setAborter() does not exist
			let content = response?.ok ? response.value.choices?.[0]?.message?.content ?? '' : '';
			const fullText = typeof content === 'string' ? content
				: content.map(chunk => (chunk.type === 'text' ? chunk.text : '')).join('')

			onFinalMessage({ fullText, fullReasoning: '', anthropicReasoning: null });
		})
		.catch(error => {
			onError({ message: error + '', fullError: error });
		})
}


// ------------ OLLAMA ------------

const ollamaList = async ({ onSuccess: onSuccess_, onError: onError_, settingsOfProvider }: ListParams_Internal<OllamaModelResponse>) => {
	const onSuccess = ({ models }: { models: OllamaModelResponse[] }) => {
		onSuccess_({ models })
	}
	const onError = ({ error }: { error: string }) => {
		onError_({ error })
	}
	try {
		const thisConfig = settingsOfProvider.ollama
		const ollama = getOllamaClient({ endpoint: thisConfig.endpoint })
		ollama.list()
			.then((response) => {
				const { models } = response
				onSuccess({ models })
			})
			.catch((error) => {
				onError({ error: error + '' })
			})
	}
	catch (error) {
		onError({ error: error + '' })
	}
}

const sendOllamaFIM = ({ messages, onFinalMessage, onError, settingsOfProvider, modelName, _setAborter, featureName, onText }: SendFIMParams_Internal) => {
	const thisConfig = settingsOfProvider.ollama
	const ollama = getOllamaClient({ endpoint: thisConfig.endpoint })

	// Compute num_predict based on feature (Ollama is always local)
	const numPredictForThisCall = computeMaxTokensForLocalProvider(true, featureName)

	let fullText = ''
	ollama.generate({
		model: modelName,
		prompt: messages.prefix,
		suffix: messages.suffix,
		options: {
			stop: messages.stopTokens,
			num_predict: numPredictForThisCall,
			// repeat_penalty: 1,
		},
		raw: true,
		stream: true, // stream is not necessary but lets us expose the
	})
		.then(async stream => {
			_setAborter(() => stream.abort())
			for await (const chunk of stream) {
				const newText = chunk.response
				fullText += newText
				// Call onText during streaming for incremental UI updates (like OpenAI-compatible FIM)
				// This enables true streaming UX for Ollama autocomplete
				if (onText && typeof onText === 'function') {
					onText({
						fullText,
						fullReasoning: '',
						toolCall: undefined,
					})
				}
			}
			onFinalMessage({ fullText, fullReasoning: '', anthropicReasoning: null })
		})
		// when error/fail
		.catch((error) => {
			onError({ message: error + '', fullError: error })
		})
}

/**
 * Native Ollama chat (via the Ollama SDK's /api/chat) instead of the OpenAI-compatible endpoint.
 *
 * WHY: ollama's OpenAI-compatible `/v1/chat/completions` IGNORES `num_ctx`, so chat always ran at
 * ollama's 4096 default and silently truncated longer agent prompts (system prompt + tool catalog +
 * accumulating tool results), which can make even a capable model lose its own earlier context and
 * loop. The native `/api/chat` honors `options.num_ctx`, so we set it to the model's advertised
 * context window (clamped to avoid KV-cache OOM on modest hardware).
 *
 * Ollama does NOT return structured tool_calls (it emits the call as JSON in message.content), so —
 * unlike the OpenAI-compatible path — there are no native tool_calls to stream here; tool parsing
 * happens downstream in chatThreadService (the JSON-in-text parser). We stream content, split out
 * <think> reasoning the same way, and apply first-token + rolling-stall timeouts for local UX.
 */
/**
 * Local embedding vectors via Ollama (powers hybrid RAG). Runs in electron-main because the renderer
 * cannot reach the Ollama endpoint. Ollama is loopback, so embeddings stay on-machine; the renderer
 * gates this under the local-only egress policy before calling. Returns one vector per input string;
 * extractEmbeddingVectors throws on a malformed/ragged response so retrieval never gets garbage.
 */
export const sendOllamaEmbed = async ({ settingsOfProvider, modelName, input }: { settingsOfProvider: SettingsOfProvider, modelName: string, input: string[] }): Promise<number[][]> => {
	const thisConfig = settingsOfProvider.ollama
	const ollama = getOllamaClient({ endpoint: thisConfig.endpoint })
	const res = await ollama.embed({ model: modelName, input })
	return extractEmbeddingVectors(res, input.length)
}

const sendOllamaChat = async ({ messages, onText, onFinalMessage, onError, settingsOfProvider, modelName: modelName_, _setAborter, overridesOfModel, chatMode, mcpTools }: SendChatParams_Internal) => {
	const thisConfig = settingsOfProvider.ollama
	const { modelName, contextWindow, reasoningCapabilities } = getModelCapabilities('ollama', modelName_, overridesOfModel)
	const ollama = getOllamaClient({ endpoint: thisConfig.endpoint })

	// Use the model's real context window (clamped). The 16k cap balances "don't truncate agent
	// prompts" against KV-cache memory on modest GPUs; floor of 4096 means never worse than before.
	const numCtx = Math.min(Math.max(contextWindow || 8192, 4096), 16384)
	const numPredict = computeMaxTokensForLocalProvider(true, undefined)

	// Reasoning: split out <think>...</think> tags exactly like the OpenAI-compatible path. No-op for
	// non-reasoning models (openSourceThinkTags undefined).
	const { canIOReasoning, openSourceThinkTags } = reasoningCapabilities || {}
	const { providerReasoningIOSettings } = getProviderCapabilities('ollama')
	const needsManualReasoningParse = providerReasoningIOSettings?.output?.needsManualParse
	if (needsManualReasoningParse && canIOReasoning && openSourceThinkTags) {
		const { newOnText, newOnFinalMessage } = extractReasoningWrapper(onText, onFinalMessage, openSourceThinkTags)
		onText = newOnText
		onFinalMessage = newOnFinalMessage
	}

	// Parse XML tool calls out of the streamed text. Ollama returns NO structured tool_calls (it emits
	// the call as text), and the model may use the XML format from the prompt's tool catalog
	// (<tool><param>...) OR a JSON blob. extractXMLToolsWrapper catches the XML form here; the JSON
	// form is caught downstream in chatThreadService. Without this, an XML tool call is inert text.
	{
		const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools)
		onText = newOnText
		onFinalMessage = newOnFinalMessage
	}

	const messagesToSend = sanitizeOpenAIMessagesForEmptyContent(messages)
	const ollamaMessages = convertOpenAIMessagesToOllamaChat(messagesToSend)

	let fullTextSoFar = ''
	let firstTokenReceived = false
	let timeoutFired = false
	let stallId: ReturnType<typeof setTimeout> | null = null
	let firstId: ReturnType<typeof setTimeout> | null = null
	const STALL_MS = 60_000
	const FIRST_MS = 10_000
	const clearTimers = () => { if (stallId) { clearTimeout(stallId); stallId = null } if (firstId) { clearTimeout(firstId); firstId = null } }

	try {
		const stream = await ollama.chat({
			model: modelName,
			messages: ollamaMessages as any,
			stream: true,
			options: { num_ctx: numCtx, num_predict: numPredict },
		})
		_setAborter(() => { try { stream.abort() } catch { /* ignore */ } })

		const scheduleStall = () => {
			if (stallId) clearTimeout(stallId)
			stallId = setTimeout(() => {
				timeoutFired = true
				try { stream.abort() } catch { /* ignore */ }
				if (fullTextSoFar) { onFinalMessage({ fullText: fullTextSoFar, fullReasoning: '', anthropicReasoning: null }) }
				else { onError({ message: 'Local model timed out (no response for 60s). Try a smaller model or a cloud model.', fullError: null }) }
			}, STALL_MS)
		}
		firstId = setTimeout(() => {
			if (!firstTokenReceived) {
				timeoutFired = true
				try { stream.abort() } catch { /* ignore */ }
				onError({ message: 'Local model is too slow (no response after 10s). Try a smaller/faster model or a cloud model.', fullError: null })
			}
		}, FIRST_MS)
		scheduleStall()

		for await (const chunk of stream) {
			if (timeoutFired) break
			if (!firstTokenReceived) { firstTokenReceived = true; if (firstId) { clearTimeout(firstId); firstId = null } }
			scheduleStall()
			const newText = chunk.message?.content ?? ''
			if (newText) {
				fullTextSoFar += newText
				onText({ fullText: fullTextSoFar, fullReasoning: '', toolCall: undefined })
			}
		}

		clearTimers()
		if (timeoutFired) return
		if (!fullTextSoFar) { onError({ message: 'CortexIDE: Response from model was empty.', fullError: null }) }
		else { onFinalMessage({ fullText: fullTextSoFar, fullReasoning: '', anthropicReasoning: null }) }
	} catch (error) {
		clearTimers()
		if (timeoutFired) return
		onError({ message: error + '', fullError: error })
	}
}

// ---------------- GEMINI NATIVE IMPLEMENTATION ----------------

const toGeminiFunctionDecl = (toolInfo: InternalToolInfo) => {
	const { name, description, params } = toolInfo
	// Same typed-properties core as the other providers, mapped to the Gemini SDK's Type.STRING at this boundary.
	const properties = Object.entries(buildTypedToolProperties(params)).reduce((acc, [key, value]) => {
		acc[key] = { type: Type.STRING, description: value.description };
		return acc;
	}, {} as Record<string, Schema>)
	return {
		name,
		description,
		parameters: {
			type: Type.OBJECT,
			properties,
		}
	} satisfies FunctionDeclaration
}

const geminiTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined): GeminiTool[] | null => {
	const allowedTools = availableTools(chatMode, mcpTools)
	if (!allowedTools || Object.keys(allowedTools).length === 0) return null
	const functionDecls: FunctionDeclaration[] = []
	for (const t in allowedTools ?? {}) {
		functionDecls.push(toGeminiFunctionDecl(allowedTools[t]))
	}
	const tools: GeminiTool = { functionDeclarations: functionDecls, }
	return [tools]
}



// Implementation for Gemini using Google's native API
const sendGeminiChat = async ({
	messages,
	separateSystemMessage,
	onText,
	onFinalMessage,
	onError,
	settingsOfProvider,
	overridesOfModel,
	modelName: modelName_,
	_setAborter,
	providerName,
	modelSelectionOptions,
	chatMode,
	mcpTools,
}: SendChatParams_Internal) => {

	if (providerName !== 'gemini') throw new Error(`Sending Gemini chat, but provider was ${providerName}`)

	const thisConfig = settingsOfProvider[providerName]

	const {
		modelName,
		specialToolFormat,
		// reasoningCapabilities,
	} = getModelCapabilities(providerName, modelName_, overridesOfModel)

	// const { providerReasoningIOSettings } = getProviderCapabilities(providerName)

	// reasoning
	// const { canIOReasoning, openSourceThinkTags, } = reasoningCapabilities || {}
	const reasoningInfo = getSendableReasoningInfo('Chat', providerName, modelName_, modelSelectionOptions, overridesOfModel) // user's modelName_ here
	// const includeInPayload = providerReasoningIOSettings?.input?.includeInPayload?.(reasoningInfo) || {}

	const thinkingConfig: ThinkingConfig | undefined = !reasoningInfo?.isReasoningEnabled ? undefined
		: reasoningInfo.type === 'budget_slider_value' ?
			{ thinkingBudget: reasoningInfo.reasoningBudget }
			: undefined

	// tools
	const potentialTools = geminiTools(chatMode, mcpTools)
	const toolConfig = potentialTools && specialToolFormat === 'gemini-style' ?
		potentialTools
		: undefined

	// instance
	const genAI = new GoogleGenAI({ apiKey: thisConfig.apiKey });


	// manually parse out tool results if XML
	if (!specialToolFormat) {
		const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools)
		onText = newOnText
		onFinalMessage = newOnFinalMessage
	}

	// when receive text
	let fullReasoningSoFar = ''
	let fullTextSoFar = ''

	let toolName = ''
	let toolParamsStr = ''
	let toolId = ''


	genAI.models.generateContentStream({
		model: modelName,
		config: {
			systemInstruction: separateSystemMessage,
			thinkingConfig: thinkingConfig,
			tools: toolConfig,
		},
		contents: messages as GeminiLLMChatMessage[],
	})
		.then(async (stream) => {
			_setAborter(() => { stream.return(fullTextSoFar); });

			// Process the stream (pure per-chunk reducer: text appends, functionCall REPLACES -- last wins)
			for await (const chunk of stream) {
				const next = reduceGeminiChunk({ fullTextSoFar, toolName, toolParamsStr, toolId }, chunk)
				fullTextSoFar = next.fullTextSoFar
				toolName = next.toolName
				toolParamsStr = next.toolParamsStr
				toolId = next.toolId

				// (do not handle reasoning yet)

				// call onText
				onText({
					fullText: fullTextSoFar,
					fullReasoning: fullReasoningSoFar,
					toolCall: !toolName ? undefined : { name: toolName, rawParams: {}, isDone: false, doneParams: [], id: toolId },
				})
			}

			// on final
			if (!fullTextSoFar && !fullReasoningSoFar && !toolName) {
				onError({ message: 'CortexIDE: Response from model was empty.', fullError: null })
			} else {
				toolId = finalizeGeminiToolId(toolId, generateUuid) // ids are empty, but other providers might expect an id
				const toolCall = rawToolCallObjOfParamsStr(toolName, toolParamsStr, toolId)
				const toolCallObj = toolCall ? { toolCall } : {}
				onFinalMessage({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, anthropicReasoning: null, ...toolCallObj });
			}
		})
		.catch(error => {
			const message = error?.message
			if (typeof message === 'string') {

				if (error.message?.includes('API key')) {
					onError({ message: invalidApiKeyMessage(providerName), fullError: error });
				}
				else if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('quota')) {
					// Parse Gemini rate limit error to extract a user-friendly message + retry delay
					// (pure, byte-identical, node-tested formatter; never throws).
					onError({ message: formatGeminiRateLimitError(error.message), fullError: error });
				}
				else
					onError({ message: error + '', fullError: error });
			}
			else {
				onError({ message: error + '', fullError: error });
			}
		})
};



type CallFnOfProvider = {
	[providerName in ProviderName]: {
		sendChat: (params: SendChatParams_Internal) => Promise<void>;
		sendFIM: ((params: SendFIMParams_Internal) => void) | null;
		list: ((params: ListParams_Internal<any>) => void) | null;
	}
}

export const sendLLMMessageToProviderImplementation = {
	anthropic: {
		sendChat: sendAnthropicChat,
		sendFIM: null,
		list: null,
	},
	openAI: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null, // OpenAI's official API doesn't support suffix parameter for FIM
		list: null,
	},
	xAI: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null, // xAI uses OpenAI-compatible API which doesn't support suffix parameter
		list: null,
	},
	gemini: {
		sendChat: (params) => sendGeminiChat(params),
		sendFIM: null,
		list: null,
	},
	mistral: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: (params) => sendMistralFIM(params),
		list: null,
	},
	ollama: {
		// Native /api/chat (not the OpenAI-compatible endpoint) so we can set num_ctx — ollama's
		// /v1 endpoint ignores it and would pin context to its 4096 default. See sendOllamaChat.
		sendChat: (params) => sendOllamaChat(params),
		sendFIM: sendOllamaFIM,
		list: ollamaList,
	},
	openAICompatible: {
		sendChat: (params) => _sendOpenAICompatibleChat(params), // using openai's SDK is not ideal (your implementation might not do tools, reasoning, FIM etc correctly), talk to us for a custom integration
		sendFIM: (params) => _sendOpenAICompatibleFIM(params),
		list: null,
	},
	openRouter: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: (params) => _sendOpenAICompatibleFIM(params),
		list: null,
	},
	vLLM: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null, // vLLM's OpenAI-compatible server does not support suffix parameter according to docs
		list: (params) => _openaiCompatibleList(params),
	},
	deepseek: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null, // DeepSeek uses OpenAI-compatible API which doesn't support suffix parameter
		list: null,
	},
	groq: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},

	lmStudio: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null, // lmStudio has no suffix parameter in /completions endpoint, so FIM does not work
		list: (params) => _openaiCompatibleList(params),
	},
	liteLLM: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: (params) => _sendOpenAICompatibleFIM(params),
		list: null,
	},
	googleVertex: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},
	microsoftAzure: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},
	awsBedrock: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},
	pollinations: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},
	moonshot: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},
	cerebras: {
		sendChat: (params) => _sendOpenAICompatibleChat(params),
		sendFIM: null,
		list: null,
	},

} satisfies CallFnOfProvider




/*
FIM info (this may be useful in the future with vLLM, but in most cases the only way to use FIM is if the provider explicitly supports it):

qwen2.5-coder https://ollama.com/library/qwen2.5-coder/blobs/e94a8ecb9327
<|fim_prefix|>{{ .Prompt }}<|fim_suffix|>{{ .Suffix }}<|fim_middle|>

codestral https://ollama.com/library/codestral/blobs/51707752a87c
[SUFFIX]{{ .Suffix }}[PREFIX] {{ .Prompt }}

deepseek-coder-v2 https://ollama.com/library/deepseek-coder-v2/blobs/22091531faf0
<|fim_begin|>{{ .Prompt }}<|fim_hole|>{{ .Suffix }}<|fim_end|>

starcoder2 https://ollama.com/library/starcoder2/blobs/3b190e68fefe
<file_sep>
<fim_prefix>
{{ .Prompt }}<fim_suffix>{{ .Suffix }}<fim_middle>
<|end_of_text|>

codegemma https://ollama.com/library/codegemma:2b/blobs/48d9a8140749
<|fim_prefix|>{{ .Prompt }}<|fim_suffix|>{{ .Suffix }}<|fim_middle|>

*/
