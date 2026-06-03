/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Model Capabilities and Configuration
 *
 * This file centralizes all model definitions and capabilities for CortexIDE.
 *
 * Structure:
 * 1. defaultModelsOfProvider: Default model lists per provider (shown in UI)
 * 2. Model-specific options (e.g., openAIModelOptions): Detailed capabilities per model
 * 3. Provider settings: Fallback logic and provider-specific configurations
 *
 * When adding a new model:
 * 1. Add to defaultModelsOfProvider[providerName] if it should appear by default
 * 2. Add detailed capabilities to provider-specific modelOptions
 * 3. Update fallback logic in modelOptionsFallback if needed
 * 4. Update routing logic in modelRouter.ts if model has special characteristics
 *
 * IMPORTANT: Only add models that actually exist. Do not invent model names.
 * Reference official provider documentation before adding models.
 */

import { FeatureName, ModelSelectionOptions, OverridesOfModel, ProviderName } from './cortexideSettingsTypes.js';





export const defaultProviderSettings = {
	anthropic: {
		apiKey: '',
	},
	openAI: {
		apiKey: '',
	},
	deepseek: {
		apiKey: '',
	},
	ollama: {
		endpoint: 'http://127.0.0.1:11434',
	},
	vLLM: {
		endpoint: 'http://localhost:8000',
	},
	openRouter: {
		apiKey: '',
	},
	openAICompatible: {
		endpoint: '',
		apiKey: '',
		headersJSON: '{}', // default to {}
	},
	gemini: {
		apiKey: '',
	},
	groq: {
		apiKey: '',
	},
	xAI: {
		apiKey: '',
	},
	mistral: {
		apiKey: '',
	},
	lmStudio: {
		endpoint: 'http://localhost:1234',
	},
	liteLLM: { // https://docs.litellm.ai/docs/providers/openai_compatible
		endpoint: '',
	},
	googleVertex: { // google https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library
		region: 'us-west2',
		project: '',
	},
	microsoftAzure: { // microsoft Azure Foundry
		project: '', // really 'resource'
		apiKey: '',
		azureApiVersion: '2024-05-01-preview',
	},
	awsBedrock: {
		apiKey: '',
		region: 'us-east-1', // add region setting
		endpoint: '', // optionally allow overriding default
	},
	pollinations: {
		apiKey: '',
	},
	// allow-any-unicode-next-line
	moonshot: { // Kimi K2 — free tier available at platform.moonshot.ai
		apiKey: '',
	},
	cerebras: { // Cerebras Cloud - OpenAI-compatible, 1M tokens/day free tier, 8K context cap
		apiKey: '',
	},

} as const




export const defaultModelsOfProvider = {
	openAI: [ // https://platform.openai.com/docs/models
		// NOTE: Keep this list in sync with OpenAI's current "production" models.
		// When adding a new model, make sure routing/risk policies are updated.
		// Reference: https://platform.openai.com/docs/models (checked 2025-11-30)
		// Latest GPT-5 series (best for coding and agentic tasks):
		'gpt-5.1', // Newest: Best model for coding and agentic tasks with configurable reasoning effort
		'gpt-5', // Previous intelligent reasoning model for coding and agentic tasks
		'gpt-5-mini', // Faster, cost-efficient version of GPT-5
		'gpt-5-nano', // Fastest, most cost-efficient version of GPT-5
		'gpt-5-pro', // Version of GPT-5 that produces smarter and more precise responses
		// GPT-4.1 series (smartest non-reasoning models):
		'gpt-4.1', // Smartest non-reasoning model
		'gpt-4.1-mini', // Smaller, faster version of GPT-4.1
		'gpt-4.1-nano', // Fastest, most cost-efficient version of GPT-4.1
		// GPT-4o series (fast, intelligent, flexible):
		'gpt-4o', // Fast, intelligent, flexible GPT model
		'gpt-4o-mini', // Fast, affordable small model for focused tasks
		// Reasoning models (o-series):
		'o3-deep-search', // Most powerful deep research model
		'o3-pro', // Version of o3 with more compute for better responses
		'o3', // Reasoning model for complex tasks, succeeded by GPT-5
		'o3-mini', // Small model alternative to o3
		'o4-mini', // Fast, cost-efficient reasoning model, succeeded by GPT-5 mini
		'o1-pro', // Version of o1 with more compute for better responses
		'o1', // Previous full o-series reasoning model
		'o1-mini', // Deprecated: Small model alternative to o1
	],
	anthropic: [ // https://docs.anthropic.com/en/docs/about-claude/models
		// NOTE: Keep this list in sync with Anthropic's current "production" models.
		// When adding a new model, make sure routing/risk policies are updated.
		// Reference: https://platform.claude.com/docs/en/about-claude/models/overview (checked 2025-11-30)
		// Latest Claude 4.5 series (best for complex reasoning, codebase questions):
		'claude-opus-4-5-20251101', // Latest Opus 4.5: Highest quality, best for complex tasks
		'claude-sonnet-4-5-20250929', // Latest Sonnet 4.5: High quality, balanced performance
		'claude-haiku-4-5-20251001', // Latest Haiku 4.5: Fast, cost-effective variant
		'claude-opus-4-1-20250805', // Opus 4.1: Previous high-quality model
		// Claude 3.7 series (reasoning capabilities):
		'claude-3-7-sonnet-20250219', // Latest Sonnet with reasoning capabilities
		// Claude 3.5 series (good for chat, code, autocomplete):
		'claude-3-5-sonnet-20241022', // Excellent for code and general tasks
		'claude-3-5-haiku-20241022', // Fast, cost-effective variant
		// Legacy models (still available in modelOptions for backward compatibility):
		// 'claude-3-opus-20240229', 'claude-3-sonnet-20240229',
	],
	xAI: [ // https://docs.x.ai/docs/models
		// NOTE: Keep this list in sync with xAI's current models.
		// Reference: https://docs.x.ai/docs/models (checked 2025-11-30)
		'grok-4', // Latest model (if available)
		'grok-3', // Main model
		'grok-3-mini', // Fast variant with reasoning
		'grok-3-fast', // Fastest variant
		'grok-2', // Legacy, still available
		// Additional variants (if available):
		// 'grok-beta', 'grok-vision-beta',
	],
	gemini: [ // https://ai.google.dev/gemini-api/docs/models/gemini
		// NOTE: Keep this list in sync with Google's current Gemini models.
		// Reference: https://ai.google.dev/gemini-api/docs/models/gemini (checked 2025-11-30)
		// Latest Gemini 3 series (preview):
		'gemini-3-pro-preview', // Preview: Latest Pro model with advanced capabilities (1M context, supports Text/Image/Video/Audio/PDF)
		'gemini-3-pro-image-preview', // Preview: Gemini 3 Pro with enhanced image understanding
		// Gemini 2.5 series:
		'gemini-2.5-pro', // Stable: Pro model with reasoning capabilities
		'gemini-2.5-flash', // Stable: Fast model with reasoning capabilities
		'gemini-2.5-flash-preview-09-2025', // Preview: Latest Flash preview
		'gemini-2.5-flash-image', // Stable: Flash model with image understanding
		'gemini-2.5-flash-lite', // Stable: Fastest, most cost-effective variant
		'gemini-2.5-flash-lite-preview-09-2025', // Preview: Flash Lite preview
		'gemini-2.5-flash-native-audio-preview-09-2025', // Preview: Flash with native audio support
		'gemini-2.5-flash-preview-tt', // Preview: Flash with thinking tokens
		// Legacy/experimental models (still available in modelOptions):
		// 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.5-pro-exp-03-25',
	],
	deepseek: [ // https://api-docs.deepseek.com/quick_start/pricing
		// NOTE: Keep this list in sync with DeepSeek's current models.
		// Reference: https://api-docs.deepseek.com/quick_start/pricing (checked 2025-11-30)
		'deepseek-chat', // Main chat/code model
		'deepseek-reasoner', // Reasoning model (R1)
		// Additional models (if available):
		// 'deepseek-chat-v3.1', // Latest chat model variant
	],
	// Local providers - models are autodetected dynamically
	// Users can add custom model IDs that will be recognized via fallback logic
	ollama: [ // Models autodetected from Ollama API
		// NOTE: Models are dynamically detected. Users can add custom model IDs.
		// Common models: qwen2.5-coder, llama3.1, deepseek-r1, devstral, etc.
	],
	vLLM: [ // Models autodetected from vLLM server
		// NOTE: Models are dynamically detected. Users can add custom model IDs.
	],
	lmStudio: [ // Models autodetected from LM Studio
		// NOTE: Models are dynamically detected. Users can add custom model IDs.
	],

	openRouter: [ // https://openrouter.ai/models
		// NOTE: Keep this list in sync with OpenRouter's popular models.
		// Reference: https://openrouter.ai/models (checked 2025-11-30)
		// Latest high-quality models:
		'anthropic/claude-opus-4-5', // Latest Claude Opus 4.5
		'anthropic/claude-sonnet-4-5', // Latest Claude Sonnet 4.5
		'anthropic/claude-haiku-4-5', // Latest Claude Haiku 4.5
		'anthropic/claude-opus-4-1', // Claude Opus 4.1
		'anthropic/claude-opus-4', // Claude Opus 4.0
		'anthropic/claude-sonnet-4', // Claude Sonnet 4.0
		'anthropic/claude-3.7-sonnet', // Claude 3.7 Sonnet with reasoning
		'anthropic/claude-3.5-sonnet', // Claude 3.5 Sonnet
		// OpenAI models:
		'openai/gpt-5.1', // Latest GPT-5.1
		'openai/gpt-5', // GPT-5
		'openai/gpt-4.1', // GPT-4.1
		'openai/gpt-4o', // GPT-4o
		// Google Gemini models:
		'google/gemini-3-pro-preview', // Latest Gemini 3 Pro (preview)
		'google/gemini-2.5-pro', // Gemini 2.5 Pro
		'google/gemini-2.5-flash', // Gemini 2.5 Flash
		'google/gemini-2.5-flash-lite', // Gemini 2.5 Flash Lite
		// xAI models:
		'x-ai/grok-4', // Latest Grok 4
		'x-ai/grok-3', // Grok 3
		// Open-source reasoning models:
		'qwen/qwen3-32b', // Qwen3-32B reasoning model
		'qwen/qwen3-235b-a22b', // Large reasoning model
		'deepseek/deepseek-r1', // DeepSeek R1 reasoning model
		'deepseek/deepseek-r1-zero:free', // Free reasoning model
		// Open-source code models:
		'mistralai/devstral-small-1.1:free', // Free code model (latest)
		'mistralai/devstral-small:free', // Free code model (legacy)
		'mistralai/codestral-latest', // Latest Codestral
		'mistralai/mistral-medium-3.1', // Mistral Medium 3.1
		'mistralai/magistral-medium-1.2', // Magistral Medium 1.2 (reasoning)
		// Additional models available in modelOptions:
		// 'anthropic/claude-3.7-sonnet:thinking',
		// 'openrouter/quasar-alpha',
		// 'openai/gpt-oss-120b', // Open-weight model
		// 'x-ai/grok-code-fast-1', // Code-specific model
	],
	groq: [ // https://console.groq.com/docs/models
		// NOTE: Keep this list in sync with Groq's current models.
		// Reference: https://console.groq.com/docs/models (checked 2025-11-30)
		// Latest Llama models:
		'llama-3.3-70b-versatile', // Large versatile model (300K TPM)
		'llama-3.1-8b-instant', // Fast, small model (250K TPM)
		// Latest Llama 4 models:
		'llama-4-maverick-17b-128e-instruct', // Llama 4 Maverick 17B 128E (300K TPM)
		'llama-4-scout-17b-16e-instruct', // Llama 4 Scout 17B 16E (300K TPM)
		// Reasoning models:
		'qwen/qwen3-32b', // Qwen3-32B reasoning model (300K TPM)
		// Safety models:
		'llama-guard-4-12b', // Llama Guard 4 12B for content moderation
		'llama-prompt-guard-2-22m', // Llama Prompt Guard 2 22M
		'llama-prompt-guard-2-86m', // Prompt Guard 2 86M
		// Legacy models (still available in modelOptions):
		// 'qwen-qwq-32b', 'qwen-2.5-coder-32b',
	],
	mistral: [ // https://docs.mistral.ai/getting-started/models/
		// NOTE: Keep this list in sync with Mistral's current models.
		// Reference: https://docs.mistral.ai/getting-started/models/ (checked 2025-11-30)
		// Latest general models:
		'mistral-large-latest',
		'mistral-medium-latest', // Premier: Frontier-class multimodal model (Aug 2025)
		'mistral-small-latest', // Open: Update to previous small model (June 2025)
		// Reasoning models:
		'magistral-medium-latest', // Premier: Frontier-class multimodal reasoning model (Sept 2025)
		'magistral-small-latest', // Open: Small multimodal reasoning model (Sept 2025)
		// Edge models:
		'ministral-8b', // Premier: Powerful edge model with high performance/price ratio
		'ministral-3b', // Premier: World's best edge model
		// Code models:
		'codestral-latest', // Premier: Cutting-edge language model for coding (July 2025)
		'devstral-medium-latest',// Premier: Enterprise-grade text model for SWE use cases (July 2025)
		'devstral-small-latest', // Open: Open source model that excels at SWE use cases (July 2025)
		// Audio models:
		'voxtral-mini-transcribe', // Premier: Efficient audio input model for transcription (July 2025)
		'voxtral-mini', // Open: Mini version of first audio input model (July 2025)
		'voxtral-small', // Open: First model with audio input capabilities (July 2025)
		// Vision models:
		'pixtral-large', // Premier: First frontier-class multimodal model (Nov 2024)
		'pixtral-12b', // Open: 12B model with image understanding capabilities (Sept 2024)
		// Legacy models (still available in modelOptions):
		// 'mistral-large-latest', 'mistral-medium-latest',
	],
	openAICompatible: [], // fallback
	googleVertex: [],
	microsoftAzure: [],
	awsBedrock: [],
	liteLLM: [],
	pollinations: [ // https://enter.pollinations.ai/api/docs, https://pollinations.ai/llms.txt
		'openai',
		'gemini',
		'gemini-large',
		'claude',
		'deepseek',
		'qwen3-coder-30b',
	],
	moonshot: [ // https://platform.moonshot.ai/docs/api/chat
		// allow-any-unicode-next-line
		// Kimi K2 — #1 SWE-bench agentic benchmark (June 2026). Modified MIT license, free tier available.
		'kimi-k2-0711-preview',  // Kimi K2 Preview: 1T MoE, best for agentic coding tasks
		'moonshot-v1-8k',        // Fast 8k context model
		'moonshot-v1-32k',       // 32k context model
		'moonshot-v1-128k',      // Long context (128k tokens)
	],
	cerebras: [ // https://inference-docs.cerebras.ai/introduction
		// Cerebras Cloud free tier: 1M tokens/day, ~2,600 tok/s, 8K context cap.
		// Reference: https://inference-docs.cerebras.ai/api-reference/models (checked 2026-05)
		'llama-4-scout-17b-16e-instruct', // Llama 4 Scout 17B 16E
		'qwen-3-32b',                     // Qwen 3 32B reasoning model
		'deepseek-r1-distill-llama-70b',  // DeepSeek R1 distilled into Llama 70B
		'llama-3.3-70b',                  // Llama 3.3 70B
	],


} as const satisfies Record<ProviderName, string[]>



export type CortexideStaticModelInfo = { // not stateful
	// Void uses the information below to know how to handle each model.
	// for some examples, see openAIModelOptions and anthropicModelOptions (below).

	contextWindow: number; // input tokens
	reservedOutputTokenSpace: number | null; // reserve this much space in the context window for output, defaults to 4096 if null

	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated'; // typically you should use 'system-role'. 'separated' means the system message is passed as a separate field (e.g. anthropic)
	specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style', // typically you should use 'openai-style'. null means "can't call tools by default", and asks the LLM to output XML in agent mode
	supportsFIM: boolean; // whether the model was specifically designed for autocomplete or "FIM" ("fill-in-middle" format)

	additionalOpenAIPayload?: { [key: string]: string } // additional payload in the message body for requests that are openai-compatible (ollama, vllm, openai, openrouter, etc)

	// reasoning options
	reasoningCapabilities: false | {
		readonly supportsReasoning: true; // for clarity, this must be true if anything below is specified
		readonly canTurnOffReasoning: boolean; // whether or not the user can disable reasoning mode (false if the model only supports reasoning)
		readonly canIOReasoning: boolean; // whether or not the model actually outputs reasoning (eg o1 lets us control reasoning but not output it)
		readonly reasoningReservedOutputTokenSpace?: number; // overrides normal reservedOutputTokenSpace
		readonly reasoningSlider?:
		| undefined
		| { type: 'budget_slider'; min: number; max: number; default: number } // anthropic supports this (reasoning budget)
		| { type: 'effort_slider'; values: string[]; default: string } // openai-compatible supports this (reasoning effort)

		// if it's open source and specifically outputs think tags, put the think tags here and we'll parse them out (e.g. ollama)
		readonly openSourceThinkTags?: [string, string];

		// the only other field related to reasoning is "providerReasoningIOSettings", which varies by provider.
	};


	// --- below is just informative, not used in sending / receiving, cannot be customized in settings ---
	cost: {
		input: number;
		output: number;
		cache_read?: number;
		cache_write?: number;
	}
	downloadable: false | {
		sizeGb: number | 'not-known'
	}
}
// if you change the above type, remember to update the Settings link



export const modelOverrideKeys = [
	'contextWindow',
	'reservedOutputTokenSpace',
	'supportsSystemMessage',
	'specialToolFormat',
	'supportsFIM',
	'reasoningCapabilities',
	'additionalOpenAIPayload'
] as const

export type ModelOverrides = Pick<
	CortexideStaticModelInfo,
	(typeof modelOverrideKeys)[number]
>




type ProviderReasoningIOSettings = {
	// include this in payload to get reasoning
	input?: { includeInPayload?: (reasoningState: SendableReasoningInfo) => null | { [key: string]: any }, };
	// nameOfFieldInDelta: reasoning output is in response.choices[0].delta[deltaReasoningField]
	// needsManualParse: whether we must manually parse out the <think> tags
	output?:
	| { nameOfFieldInDelta?: string, needsManualParse?: undefined, }
	| { nameOfFieldInDelta?: undefined, needsManualParse?: true, };
}

type VoidStaticProviderInfo = { // doesn't change (not stateful)
	providerReasoningIOSettings?: ProviderReasoningIOSettings; // input/output settings around thinking (allowed to be empty) - only applied if the model supports reasoning output
	modelOptions: { [key: string]: CortexideStaticModelInfo };
	modelOptionsFallback: (modelName: string, fallbackKnownValues?: Partial<CortexideStaticModelInfo>) => (CortexideStaticModelInfo & { modelName: string, recognizedModelName: string }) | null;
}



const defaultModelOptions = {
	contextWindow: 4_096,
	reservedOutputTokenSpace: 4_096,
	cost: { input: 0, output: 0 },
	downloadable: false,
	supportsSystemMessage: false,
	supportsFIM: false,
	reasoningCapabilities: false,
} as const satisfies CortexideStaticModelInfo

// TODO!!! double check all context sizes below
// TODO!!! add openrouter common models
// TODO!!! allow user to modify capabilities and tell them if autodetected model or falling back
const openSourceModelOptions_assumingOAICompat = {
	'deepseekR1': {
		supportsFIM: false,
		supportsSystemMessage: false,
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'deepseekCoderV3': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'deepseekCoderV2': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'codestral': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'devstral': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 131_000, reservedOutputTokenSpace: 8_192,
	},
	'openhands-lm-32b': { // https://www.all-hands.dev/blog/introducing-openhands-lm-32b----a-strong-open-coding-agent-model
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false, // built on qwen 2.5 32B instruct
		contextWindow: 128_000, reservedOutputTokenSpace: 4_096
	},

	// really only phi4-reasoning supports reasoning... simpler to combine them though
	'phi4': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 16_000, reservedOutputTokenSpace: 4_096,
	},

	'gemma': { // https://news.ycombinator.com/item?id=43451406
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	// llama 4 https://ai.meta.com/blog/llama-4-multimodal-intelligence/
	'llama4-scout': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, reservedOutputTokenSpace: 4_096,
	},
	'llama4-maverick': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, reservedOutputTokenSpace: 4_096,
	},

	// llama 3
	'llama3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.1': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.2': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	// qwen
	'qwen2.5coder': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'qwq': {
		supportsFIM: false, // no FIM, yes reasoning
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,
	},
	'qwen3': {
		supportsFIM: false, // replaces QwQ
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_768, reservedOutputTokenSpace: 8_192,
	},
	// FIM only
	'starcoder2': {
		supportsFIM: true,
		supportsSystemMessage: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,

	},
	'codegemma:2b': {
		supportsFIM: true,
		supportsSystemMessage: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,

	},
	'quasar': { // openrouter/quasar-alpha
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 1_000_000, reservedOutputTokenSpace: 32_000,
	}
} as const satisfies { [s: string]: Partial<CortexideStaticModelInfo> }




// keep modelName, but use the fallback's defaults
const extensiveModelOptionsFallback: VoidStaticProviderInfo['modelOptionsFallback'] = (modelName, fallbackKnownValues) => {

	const lower = modelName.toLowerCase()

	const toFallback = <T extends { [s: string]: Omit<CortexideStaticModelInfo, 'cost' | 'downloadable'> },>(obj: T, recognizedModelName: string & keyof T)
		: CortexideStaticModelInfo & { modelName: string, recognizedModelName: string } => {

		const opts = obj[recognizedModelName]
		const supportsSystemMessage = opts.supportsSystemMessage === 'separated'
			? 'system-role'
			: opts.supportsSystemMessage

		return {
			recognizedModelName,
			modelName,
			...opts,
			supportsSystemMessage: supportsSystemMessage,
			cost: { input: 0, output: 0 },
			downloadable: false,
			...fallbackKnownValues
		};
	}

	// Gemini 3 models (latest):
	if (lower.includes('gemini-3') && lower.includes('image')) return toFallback(geminiModelOptions, 'gemini-3-pro-image-preview')
	if (lower.includes('gemini-3')) return toFallback(geminiModelOptions, 'gemini-3-pro-preview')
	// Gemini 2.5 models:
	if (lower.includes('gemini') && (lower.includes('2.5') || lower.includes('2-5'))) {
		if (lower.includes('pro') && !lower.includes('preview')) return toFallback(geminiModelOptions, 'gemini-2.5-pro')
		return toFallback(geminiModelOptions, 'gemini-2.5-pro-preview-05-06')
	}

	// Claude 4.5 models (latest):
	if (lower.includes('claude-opus-4-5') || lower.includes('claude-4-5-opus') || (lower.includes('claude-opus') && lower.includes('4.5'))) return toFallback(anthropicModelOptions, 'claude-opus-4-5-20251101')
	if (lower.includes('claude-sonnet-4-5') || lower.includes('claude-4-5-sonnet') || (lower.includes('claude-sonnet') && lower.includes('4.5'))) return toFallback(anthropicModelOptions, 'claude-sonnet-4-5-20250929')
	if (lower.includes('claude-haiku-4-5') || lower.includes('claude-4-5-haiku') || (lower.includes('claude-haiku') && lower.includes('4.5'))) return toFallback(anthropicModelOptions, 'claude-haiku-4-5-20251001')
	// Claude 4.1 models:
	if (lower.includes('claude-opus-4-1') || lower.includes('claude-4-1-opus') || (lower.includes('claude-opus') && lower.includes('4.1'))) return toFallback(anthropicModelOptions, 'claude-opus-4-1-20250805')
	// Claude 4.0 models (legacy):
	if (lower.includes('claude-4-opus') || lower.includes('claude-opus-4')) return toFallback(anthropicModelOptions, 'claude-opus-4-20250514')
	if (lower.includes('claude-4-sonnet') || lower.includes('claude-sonnet-4')) return toFallback(anthropicModelOptions, 'claude-sonnet-4-20250514')
	// Claude 3.7 models
	if (lower.includes('claude-3-7') || lower.includes('claude-3.7')) return toFallback(anthropicModelOptions, 'claude-3-7-sonnet-20250219')
	// Claude 3.5 models
	if (lower.includes('claude-3-5') || lower.includes('claude-3.5')) return toFallback(anthropicModelOptions, 'claude-3-5-sonnet-20241022')
	// Claude 3 models (legacy)
	if (lower.includes('claude')) return toFallback(anthropicModelOptions, 'claude-3-7-sonnet-20250219')

	// xAI models (check latest first):
	if (lower.includes('grok-4')) return toFallback(xAIModelOptions, 'grok-4')
	if (lower.includes('grok-2') || lower.includes('grok2')) return toFallback(xAIModelOptions, 'grok-2')
	if (lower.includes('grok-3') || lower.includes('grok3')) return toFallback(xAIModelOptions, 'grok-3')
	if (lower.includes('grok')) return toFallback(xAIModelOptions, 'grok-3')

	if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner')) return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekR1')
	if (lower.includes('deepseek') && lower.includes('v2')) return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV2')
	if (lower.includes('deepseek')) return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV3')

	if (lower.includes('llama3')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3')
	if (lower.includes('llama3.1')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.1')
	if (lower.includes('llama3.2')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.2')
	if (lower.includes('llama3.3')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.3')
	if (lower.includes('llama') || lower.includes('scout')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout')
	if (lower.includes('llama') || lower.includes('maverick')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout')
	if (lower.includes('llama')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout')

	if (lower.includes('qwen') && lower.includes('2.5') && lower.includes('coder')) return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen2.5coder')
	if (lower.includes('qwen') && lower.includes('3')) return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3')
	if (lower.includes('qwen')) return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3')
	if (lower.includes('qwq')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'qwq') }
	if (lower.includes('phi4')) return toFallback(openSourceModelOptions_assumingOAICompat, 'phi4')
	if (lower.includes('codestral')) return toFallback(openSourceModelOptions_assumingOAICompat, 'codestral')
	if (lower.includes('devstral')) return toFallback(openSourceModelOptions_assumingOAICompat, 'devstral')

	if (lower.includes('gemma')) return toFallback(openSourceModelOptions_assumingOAICompat, 'gemma')

	if (lower.includes('starcoder2')) return toFallback(openSourceModelOptions_assumingOAICompat, 'starcoder2')

	if (lower.includes('openhands')) return toFallback(openSourceModelOptions_assumingOAICompat, 'openhands-lm-32b') // max output uncler

	if (lower.includes('quasar') || lower.includes('quaser')) return toFallback(openSourceModelOptions_assumingOAICompat, 'quasar')

	// OpenAI models (check latest first, then reasoning models, then main models):
	// GPT-5.1 series (latest):
	if (lower.includes('gpt-5.1') || (lower.includes('gpt') && lower.includes('5.1'))) return toFallback(openAIModelOptions, 'gpt-5.1')
	// GPT-5 series:
	if (lower.includes('gpt-5') && lower.includes('pro')) return toFallback(openAIModelOptions, 'gpt-5-pro')
	if (lower.includes('gpt-5') && lower.includes('nano')) return toFallback(openAIModelOptions, 'gpt-5-nano')
	if (lower.includes('gpt-5') && lower.includes('mini')) return toFallback(openAIModelOptions, 'gpt-5-mini')
	if (lower.includes('gpt-5') || (lower.includes('gpt') && lower.includes('5'))) return toFallback(openAIModelOptions, 'gpt-5')
	// GPT-4.1 series:
	if (lower.includes('gpt-4.1') && lower.includes('nano')) return toFallback(openAIModelOptions, 'gpt-4.1-nano')
	if (lower.includes('gpt-4.1') && lower.includes('mini')) return toFallback(openAIModelOptions, 'gpt-4.1-mini')
	if (lower.includes('gpt-4.1') || (lower.includes('gpt') && lower.includes('4.1'))) return toFallback(openAIModelOptions, 'gpt-4.1')
	// Reasoning models (o-series):
	if (lower.includes('o3') && lower.includes('deep') && lower.includes('search')) return toFallback(openAIModelOptions, 'o3-deep-search')
	if (lower.includes('o3') && lower.includes('pro')) return toFallback(openAIModelOptions, 'o3-pro')
	if (lower.includes('o3') && lower.includes('mini')) return toFallback(openAIModelOptions, 'o3-mini')
	if (lower.includes('o3')) return toFallback(openAIModelOptions, 'o3')
	if (lower.includes('o4') && lower.includes('mini')) return toFallback(openAIModelOptions, 'o4-mini')
	if (lower.includes('o1') && lower.includes('pro')) return toFallback(openAIModelOptions, 'o1-pro')
	if (lower.includes('o1') && lower.includes('mini')) return toFallback(openAIModelOptions, 'o1-mini')
	if (lower.includes('o1')) return toFallback(openAIModelOptions, 'o1')
	// GPT-4o series:
	if (lower.includes('gpt-4o') && lower.includes('mini')) return toFallback(openAIModelOptions, 'gpt-4o-mini')
	if (lower.includes('gpt-4o') || lower.includes('4o')) return toFallback(openAIModelOptions, 'gpt-4o')
	// Legacy GPT-3.5 fallback:
	if (lower.includes('gpt') && (lower.includes('3.5') || lower.includes('turbo'))) return toFallback(openAIModelOptions, 'gpt-4o-mini')


	if (Object.keys(openSourceModelOptions_assumingOAICompat).map(k => k.toLowerCase()).includes(lower))
		return toFallback(openSourceModelOptions_assumingOAICompat, lower as keyof typeof openSourceModelOptions_assumingOAICompat)

	return null
}






// ---------------- ANTHROPIC ----------------
// Reference: https://platform.claude.com/docs/en/about-claude/models/overview (checked 2025-11-30)
const anthropicModelOptions = {
	// Latest Claude 4.5 series:
	'claude-opus-4-5-20251101': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 30.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
		},
	},
	'claude-sonnet-4-5-20250929': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 6.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
		},
	},
	'claude-haiku-4-5-20251001': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-opus-4-1-20250805': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 30.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
		},
	},
	// Claude 3.7 series:
	'claude-3-7-sonnet-20250219': { // https://docs.anthropic.com/en/docs/about-claude/models/all-models#model-comparison-table
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192, // can bump it to 128_000 with beta mode output-128k-2025-02-19
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // they recommend batching if max > 32_000. we cap at 8192 because above is typically not necessary (often even buggy)
		},

	},
	// Legacy Claude 4.0 series (still available):
	'claude-opus-4-20250514': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 30.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192, // can bump it to 128_000 with beta mode output-128k-2025-02-19
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // they recommend batching if max > 32_000. we cap at 8192 because above is typically not necessary (often even buggy)
		},

	},
	'claude-sonnet-4-20250514': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 6.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192, // can bump it to 128_000 with beta mode output-128k-2025-02-19
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // they recommend batching if max > 32_000. we cap at 8192 because above is typically not necessary (often even buggy)
		},

	},
	'claude-3-5-sonnet-20241022': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-5-haiku-20241022': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-opus-20240229': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-sonnet-20240229': { // no point of using this, but including this for people who put it in
		contextWindow: 200_000, cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		reservedOutputTokenSpace: 4_096,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	}
} as const satisfies { [s: string]: CortexideStaticModelInfo }

const anthropicSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null

				if (reasoningInfo.type === 'budget_slider_value') {
					return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
				}
				return null
			}
		},
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof anthropicModelOptions | null = null
		// Claude 4.5 models (latest):
		if (lower.includes('claude-opus-4-5') || lower.includes('claude-4-5-opus') || (lower.includes('claude-opus') && lower.includes('4.5'))) fallbackName = 'claude-opus-4-5-20251101'
		if (lower.includes('claude-sonnet-4-5') || lower.includes('claude-4-5-sonnet') || (lower.includes('claude-sonnet') && lower.includes('4.5'))) fallbackName = 'claude-sonnet-4-5-20250929'
		if (lower.includes('claude-haiku-4-5') || lower.includes('claude-4-5-haiku') || (lower.includes('claude-haiku') && lower.includes('4.5'))) fallbackName = 'claude-haiku-4-5-20251001'
		// Claude 4.1 models:
		if (lower.includes('claude-opus-4-1') || lower.includes('claude-4-1-opus') || (lower.includes('claude-opus') && lower.includes('4.1'))) fallbackName = 'claude-opus-4-1-20250805'
		// Claude 4.0 models (legacy):
		if (lower.includes('claude-4-opus') || lower.includes('claude-opus-4') || lower.includes('claude-opus-4-0')) fallbackName = 'claude-opus-4-20250514'
		if (lower.includes('claude-4-sonnet') || lower.includes('claude-sonnet-4') || lower.includes('claude-sonnet-4-0')) fallbackName = 'claude-sonnet-4-20250514'
		// Claude 3.7 models
		if (lower.includes('claude-3-7-sonnet') || lower.includes('claude-3-7-sonnet-latest')) fallbackName = 'claude-3-7-sonnet-20250219'
		// Claude 3.5 models
		if (lower.includes('claude-3-5-sonnet') || lower.includes('claude-3-5-sonnet-latest')) fallbackName = 'claude-3-5-sonnet-20241022'
		if (lower.includes('claude-3-5-haiku') || lower.includes('claude-3-5-haiku-latest')) fallbackName = 'claude-3-5-haiku-20241022'
		// Claude 3 models (legacy)
		if (lower.includes('claude-3-opus') || lower.includes('claude-3-opus-latest')) fallbackName = 'claude-3-opus-20240229'
		if (lower.includes('claude-3-sonnet') || lower.includes('claude-3-sonnet-latest')) fallbackName = 'claude-3-sonnet-20240229'
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...anthropicModelOptions[fallbackName] }
		return null
	},
}


// ---------------- OPENAI ----------------
// NOTE: Keep this list in sync with OpenAI's current "production" models.
// When adding a new model, make sure routing/risk policies are updated.
// Reference: https://platform.openai.com/docs/models (checked 2025-11-30)
const openAIModelOptions = { // https://platform.openai.com/docs/pricing
	// Latest GPT-5 series (best for coding and agentic tasks):
	'gpt-5.1': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 2.50, output: 10.00, cache_read: 0.625 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'gpt-5': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 2.50, output: 10.00, cache_read: 0.625 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'gpt-5-mini': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.50, output: 2.00, cache_read: 0.125 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5-nano': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.10, output: 0.40, cache_read: 0.03 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5-pro': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 5.00, output: 20.00, cache_read: 1.25 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	// GPT-4.1 series (smartest non-reasoning models):
	'gpt-4.1': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 2.00, output: 8.00, cache_read: 0.50 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-4.1-mini': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.40, output: 1.60, cache_read: 0.10 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-4.1-nano': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.10, output: 0.40, cache_read: 0.03 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	// GPT-4o series (fast, intelligent, flexible):
	'gpt-4o': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 2.50, cache_read: 1.25, output: 10.00, },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'gpt-4o-mini': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 0.15, cache_read: 0.075, output: 0.60, },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	// Reasoning models (o-series):
	'o3-deep-search': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 20.00, output: 80.00, cache_read: 5.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o3-pro': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 15.00, output: 60.00, cache_read: 3.75 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o3': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 10.00, output: 40.00, cache_read: 2.50 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o3-mini': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 100_000,
		cost: { input: 1.10, cache_read: 0.55, output: 4.40, },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o4-mini': {
		contextWindow: 1_047_576, // TODO: Verify actual context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 1.10, output: 4.40, cache_read: 0.275 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o1-pro': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 100_000,
		cost: { input: 20.00, cache_read: 10.00, output: 80.00, }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 100_000,
		cost: { input: 15.00, cache_read: 7.50, output: 60.00, },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o1-mini': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 1.10, cache_read: 0.55, output: 4.40, },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: false, // does not support any system
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	// Legacy models (still available for backward compatibility):
	// 'gpt-3.5-turbo': // Legacy chat model, not recommended for new usage
} as const satisfies { [s: string]: CortexideStaticModelInfo }


// https://platform.openai.com/docs/guides/reasoning?api-mode=chat
const openAICompatIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null
	if (reasoningInfo.type === 'effort_slider_value') {
		return { reasoning_effort: reasoningInfo.reasoningEffort }
	}
	return null

}

const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof openAIModelOptions | null = null
		// GPT-5.1 series (latest, check first):
		if (lower.includes('gpt-5.1') || (lower.includes('gpt') && lower.includes('5.1'))) { fallbackName = 'gpt-5.1' }
		// GPT-5 series:
		if (lower.includes('gpt-5') && lower.includes('pro')) { fallbackName = 'gpt-5-pro' }
		if (lower.includes('gpt-5') && lower.includes('nano')) { fallbackName = 'gpt-5-nano' }
		if (lower.includes('gpt-5') && lower.includes('mini')) { fallbackName = 'gpt-5-mini' }
		if (lower.includes('gpt-5') || (lower.includes('gpt') && lower.includes('5'))) { fallbackName = 'gpt-5' }
		// GPT-4.1 series:
		if (lower.includes('gpt-4.1') && lower.includes('nano')) { fallbackName = 'gpt-4.1-nano' }
		if (lower.includes('gpt-4.1') && lower.includes('mini')) { fallbackName = 'gpt-4.1-mini' }
		if (lower.includes('gpt-4.1') || (lower.includes('gpt') && lower.includes('4.1'))) { fallbackName = 'gpt-4.1' }
		// Reasoning models (o-series, check before GPT-4o):
		if (lower.includes('o3') && lower.includes('deep') && lower.includes('search')) { fallbackName = 'o3-deep-search' }
		if (lower.includes('o3') && lower.includes('pro')) { fallbackName = 'o3-pro' }
		if (lower.includes('o3') && lower.includes('mini')) { fallbackName = 'o3-mini' }
		if (lower.includes('o3')) { fallbackName = 'o3' }
		if (lower.includes('o4') && lower.includes('mini')) { fallbackName = 'o4-mini' }
		if (lower.includes('o1') && lower.includes('pro')) { fallbackName = 'o1-pro' }
		if (lower.includes('o1') && lower.includes('mini')) { fallbackName = 'o1-mini' }
		if (lower.includes('o1')) { fallbackName = 'o1' }
		// GPT-4o series:
		if (lower.includes('gpt-4o') && lower.includes('mini')) { fallbackName = 'gpt-4o-mini' }
		if (lower.includes('gpt-4o') || lower.includes('4o')) { fallbackName = 'gpt-4o' }
		// Legacy models:
		if (lower.includes('gpt-3.5') || lower.includes('3.5-turbo')) {
			// Fallback to gpt-4o-mini for legacy 3.5-turbo requests
			fallbackName = 'gpt-4o-mini'
		}
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...openAIModelOptions[fallbackName] }
		return null
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// ---------------- XAI ----------------
const xAIModelOptions = {
	// https://docs.x.ai/docs/guides/reasoning#reasoning
	// https://docs.x.ai/docs/models#models-and-pricing
	// Reference: https://docs.x.ai/docs/models (checked 2025-11-30)
	'grok-4': {
		contextWindow: 131_072, // TODO: Verify actual context window
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false, // TODO: Verify if grok-4 supports reasoning
	},
	'grok-3': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-3-fast': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 5.00, output: 25.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	// only mini supports thinking
	'grok-3-mini': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 0.30, output: 0.50 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'high'], default: 'low' } },
	},
	'grok-3-mini-fast': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 0.60, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'high'], default: 'low' } },
	},
	'grok-2': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 2.00, output: 10.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo }

const xAISettings: VoidStaticProviderInfo = {
	modelOptions: xAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof xAIModelOptions | null = null
		// Check latest first:
		if (lower.includes('grok-4')) fallbackName = 'grok-4'
		if (lower.includes('grok-2')) fallbackName = 'grok-2'
		if (lower.includes('grok-3')) fallbackName = 'grok-3'
		if (lower.includes('grok')) fallbackName = 'grok-3'
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...xAIModelOptions[fallbackName] }
		return null
	},
	// same implementation as openai
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


// ---------------- GEMINI ----------------
const geminiModelOptions = { // https://ai.google.dev/gemini-api/docs/pricing
	// https://ai.google.dev/gemini-api/docs/thinking#set-budget
	// Latest Gemini 3 series (preview):
	'gemini-3-pro-preview': {
		contextWindow: 1_048_576, // 1M tokens input
		reservedOutputTokenSpace: 65_536, // 65K tokens output
		cost: { input: 0, output: 0 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false, // TODO: Verify if Gemini 3 supports reasoning
	},
	'gemini-3-pro-image-preview': {
		contextWindow: 1_048_576, // 1M tokens input
		reservedOutputTokenSpace: 65_536, // 65K tokens output
		cost: { input: 0, output: 0 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false, // TODO: Verify if Gemini 3 supports reasoning
	},
	// Gemini 2.5 series:
	'gemini-2.5-pro': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // max is really 24576
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.5-pro-preview-05-06': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // max is really 24576
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.0-flash-lite': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false, // no reasoning
	},
	'gemini-2.5-flash-preview-04-17': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.15, output: .60 }, // TODO $3.50 output with thinking not included
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // max is really 24576
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.5-pro-exp-03-25': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // max is really 24576
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.0-flash': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192, // 8_192,
		cost: { input: 0.10, output: 0.40 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false,
	},
	'gemini-2.0-flash-lite-preview-02-05': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192, // 8_192,
		cost: { input: 0.075, output: 0.30 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false,
	},
	'gemini-1.5-flash': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192, // 8_192,
		cost: { input: 0.075, output: 0.30 },  // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false,
	},
	'gemini-1.5-pro': {
		contextWindow: 2_097_152,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 1.25, output: 5.00 },  // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false,
	},
	'gemini-1.5-flash-8b': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.0375, output: 0.15 },  // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo }

const geminiSettings: VoidStaticProviderInfo = {
	modelOptions: geminiModelOptions,
	modelOptionsFallback: (modelName) => { return null },
}



// ---------------- DEEPSEEK API ----------------
const deepseekModelOptions = {
	'deepseek-chat': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 64_000, // https://api-docs.deepseek.com/quick_start/pricing
		reservedOutputTokenSpace: 8_000, // 8_000,
		cost: { cache_read: .07, input: .27, output: 1.10, },
		downloadable: false,
	},
	'deepseek-reasoner': {
		...openSourceModelOptions_assumingOAICompat.deepseekCoderV2,
		contextWindow: 64_000,
		reservedOutputTokenSpace: 8_000, // 8_000,
		cost: { cache_read: .14, input: .55, output: 2.19, },
		downloadable: false,
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo }


const deepseekSettings: VoidStaticProviderInfo = {
	modelOptions: deepseekModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		// reasoning: OAICompat +  response.choices[0].delta.reasoning_content // https://api-docs.deepseek.com/guides/reasoning_model
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}



// ---------------- MISTRAL ----------------

const mistralModelOptions = { // https://mistral.ai/products/la-plateforme#pricing https://docs.mistral.ai/getting-started/models/models_overview/#premier-models
	'mistral-large-latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 2.00, output: 6.00 },
		supportsFIM: true,
		downloadable: { sizeGb: 73 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'mistral-medium-latest': { // https://openrouter.ai/mistralai/mistral-medium-3
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.40, output: 2.00 },
		supportsFIM: true,
		downloadable: { sizeGb: 'not-known' },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'codestral-latest': {
		contextWindow: 256_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.30, output: 0.90 },
		supportsFIM: true,
		downloadable: { sizeGb: 13 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'magistral-medium-latest': {
		contextWindow: 256_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.30, output: 0.90 }, // TODO: check this
		supportsFIM: true,
		downloadable: { sizeGb: 13 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'magistral-small-latest': {
		contextWindow: 40_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.30, output: 0.90 }, // TODO: check this
		supportsFIM: true,
		downloadable: { sizeGb: 13 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'devstral-small-latest': { //https://openrouter.ai/mistralai/devstral-small:free
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		downloadable: { sizeGb: 14 }, //https://ollama.com/library/devstral
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'ministral-8b-latest': { // ollama 'mistral'
		contextWindow: 131_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 0.10, output: 0.10 },
		supportsFIM: false,
		downloadable: { sizeGb: 4.1 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'ministral-3b-latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 0.04, output: 0.04 },
		supportsFIM: false,
		downloadable: { sizeGb: 'not-known' },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo }

const mistralSettings: VoidStaticProviderInfo = {
	modelOptions: mistralModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


// ---------------- GROQ ----------------
const groqModelOptions = { // https://console.groq.com/docs/models, https://groq.com/pricing/
	'llama-3.3-70b-versatile': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 32_768, // 32_768,
		cost: { input: 0.59, output: 0.79 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'llama-3.1-8b-instant': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.05, output: 0.08 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen-2.5-coder-32b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null, // not specified?
		cost: { input: 0.79, output: 0.79 },
		downloadable: false,
		supportsFIM: false, // unfortunately looks like no FIM support on groq
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen-qwq-32b': { // https://huggingface.co/Qwen/QwQ-32B
		contextWindow: 128_000,
		reservedOutputTokenSpace: null, // not specified?
		cost: { input: 0.29, output: 0.39 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] }, // we're using reasoning_format:parsed so really don't need to know openSourceThinkTags
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo }
const groqSettings: VoidStaticProviderInfo = {
	modelOptions: groqModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		// Must be set to either parsed or hidden when using tool calling https://console.groq.com/docs/reasoning
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null
				if (reasoningInfo.type === 'budget_slider_value') {
					return { reasoning_format: 'parsed' }
				}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
}


// ---------------- GOOGLE VERTEX ----------------
const googleVertexModelOptions = {
} as const satisfies Record<string, CortexideStaticModelInfo>
const googleVertexSettings: VoidStaticProviderInfo = {
	modelOptions: googleVertexModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// ---------------- MICROSOFT AZURE ----------------
const microsoftAzureModelOptions = {
} as const satisfies Record<string, CortexideStaticModelInfo>
const microsoftAzureSettings: VoidStaticProviderInfo = {
	modelOptions: microsoftAzureModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// ---------------- AWS BEDROCK ----------------
const awsBedrockModelOptions = {
} as const satisfies Record<string, CortexideStaticModelInfo>

const awsBedrockSettings: VoidStaticProviderInfo = {
	modelOptions: awsBedrockModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


// ---------------- VLLM, OLLAMA, OPENAICOMPAT (self-hosted / local) ----------------
const ollamaModelOptions = {
	'qwen2.5-coder:7b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.9 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:3b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.9 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:1.5b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: .986 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: false,
	},
	'llama3.1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.9 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: false,
	},
	'qwen2.5-coder': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.7 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: false,
	},
	'qwq': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 32_000,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 20 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'deepseek-r1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.7 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'devstral:latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 14 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style', // Ollama is OpenAI-compatible and supports tool calling
		reasoningCapabilities: false,
	},

} as const satisfies Record<string, CortexideStaticModelInfo>

// Lead with a 7B coder: a 1.5B is below the agentic floor (it fumbles multi-step tool loops), so
// recommending it first undermines the out-of-the-box agentic experience. Hardware-tiered auto-pull
// still gates smaller packs by VRAM (see ollamaModelPacks.ts MODEL_PACKS).
export const ollamaRecommendedModels = ['qwen2.5-coder:7b', 'qwen2.5-coder:1.5b', 'llama3.1', 'qwq', 'deepseek-r1', 'devstral:latest'] as const satisfies (keyof typeof ollamaModelOptions)[]


const vLLMSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		const fallback = extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } });
		// vLLM is OpenAI-compatible, so all models should support tool calling via OpenAI-style format
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	modelOptions: {},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning_content // https://docs.vllm.ai/en/stable/features/reasoning_outputs.html#streaming-chat-completions
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

const lmStudioSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		const fallback = extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' }, contextWindow: 4_096 });
		// LM Studio is OpenAI-compatible, so all models should support tool calling via OpenAI-style format
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
}

const ollamaSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		const fallback = extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } });
		// Ollama is OpenAI-compatible, so all models should support tool calling via OpenAI-style format
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	modelOptions: ollamaModelOptions,
	providerReasoningIOSettings: {
		// reasoning: we need to filter out reasoning <think> tags manually
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
}

const openaiCompatible: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		const fallback = extensiveModelOptionsFallback(modelName);
		// OpenAI-compatible providers should support tool calling via OpenAI-style format
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	modelOptions: {},
	providerReasoningIOSettings: {
		// reasoning: we have no idea what endpoint they used, so we can't consistently parse out reasoning
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

const liteLLMSettings: VoidStaticProviderInfo = { // https://docs.litellm.ai/docs/reasoning_content
	modelOptionsFallback: (modelName) => {
		const fallback = extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } });
		// LiteLLM is OpenAI-compatible, so all models should support tool calling via OpenAI-style format
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

// ---------------- POLLINATIONS ----------------
const pollinationsSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		const fallback = extensiveModelOptionsFallback(modelName);
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}


// ---------------- MOONSHOT (KIMI) ----------------
const moonshotSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		// Kimi K2 has a very large context window and supports tool calling
		const base = extensiveModelOptionsFallback(modelName);
		if (base) {
			base.specialToolFormat = 'openai-style';
		}
		return base;
	},
	modelOptions: {
		'kimi-k2-0711-preview': {
			contextWindow: 131_072,
			reservedOutputTokenSpace: 8192,
			cost: { input: 0.14, output: 0.14 }, // USD per 1M tokens (free tier available)
			downloadable: false,
			supportsFIM: false,
			supportsSystemMessage: 'system-role',
			specialToolFormat: 'openai-style',
			reasoningCapabilities: false,
		},
		'moonshot-v1-8k': {
			contextWindow: 8_192,
			reservedOutputTokenSpace: null,
			cost: { input: 0.12, output: 0.12 },
			downloadable: false,
			supportsFIM: false,
			supportsSystemMessage: 'system-role',
			specialToolFormat: 'openai-style',
			reasoningCapabilities: false,
		},
		'moonshot-v1-32k': {
			contextWindow: 32_768,
			reservedOutputTokenSpace: null,
			cost: { input: 0.24, output: 0.24 },
			downloadable: false,
			supportsFIM: false,
			supportsSystemMessage: 'system-role',
			specialToolFormat: 'openai-style',
			reasoningCapabilities: false,
		},
		'moonshot-v1-128k': {
			contextWindow: 131_072,
			reservedOutputTokenSpace: null,
			cost: { input: 0.60, output: 0.60 },
			downloadable: false,
			supportsFIM: false,
			supportsSystemMessage: 'system-role',
			specialToolFormat: 'openai-style',
			reasoningCapabilities: false,
		},
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

// ---------------- CEREBRAS ----------------
// Cerebras Cloud is OpenAI-compatible. Free tier: 1M tokens/day, ~2,600 tok/s,
// 8K context cap. Reference: https://inference-docs.cerebras.ai
// Per Cerebras docs, the documented models support tool calling via the
// standard OpenAI-style `tools` parameter.
const cerebrasModelOptions = {
	'llama-4-scout-17b-16e-instruct': {
		contextWindow: 8_192,
		reservedOutputTokenSpace: 2_048,
		cost: { input: 0, output: 0 }, // free tier
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'qwen-3-32b': {
		contextWindow: 8_192,
		reservedOutputTokenSpace: 2_048,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'deepseek-r1-distill-llama-70b': {
		contextWindow: 8_192,
		reservedOutputTokenSpace: 2_048,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'llama-3.3-70b': {
		contextWindow: 8_192,
		reservedOutputTokenSpace: 2_048,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo }

const cerebrasSettings: VoidStaticProviderInfo = {
	modelOptions: cerebrasModelOptions,
	modelOptionsFallback: (modelName) => {
		// Conservative fallback: assume the 8K context-cap free-tier behaviour
		// rather than letting an unknown model claim 128K. Tool calling is
		// supported by the documented models so default to openai-style.
		const fallback = extensiveModelOptionsFallback(modelName, { contextWindow: 8_192 });
		if (fallback && !fallback.specialToolFormat) {
			fallback.specialToolFormat = 'openai-style';
		}
		return fallback;
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

// ---------------- OPENROUTER ----------------
const openRouterModelOptions_assumingOpenAICompat = {
	'qwen/qwen3-235b-a22b': {
		contextWindow: 40_960,
		reservedOutputTokenSpace: null,
		cost: { input: .10, output: .10 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false },
	},
	'microsoft/phi-4-reasoning-plus:free': { // a 14B model...
		contextWindow: 32_768,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false },
	},
	'mistralai/mistral-small-3.1-24b-instruct:free': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-lite-preview-02-05:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-pro-exp-02-05:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-exp:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'deepseek/deepseek-r1': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.8, output: 2.4 },
		downloadable: false,
	},
	'deepseek/deepseek-r1-zero:free': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
	},
	'anthropic/claude-opus-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 30.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
		},
	},
	'anthropic/claude-sonnet-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 6.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
		},
	},
	'anthropic/claude-3.7-sonnet:thinking': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { // same as anthropic, see above
			supportsReasoning: true,
			canTurnOffReasoning: false,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // they recommend batching if max > 32_000.
		},
	},
	'anthropic/claude-3.7-sonnet': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false, // stupidly, openrouter separates thinking from non-thinking
	},
	'anthropic/claude-3.5-sonnet': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'mistralai/codestral-2501': {
		...openSourceModelOptions_assumingOAICompat.codestral,
		contextWindow: 256_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.3, output: 0.9 },
		downloadable: false,
		reasoningCapabilities: false,
	},
	'mistralai/devstral-small:free': {
		...openSourceModelOptions_assumingOAICompat.devstral,
		contextWindow: 130_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		reasoningCapabilities: false,
	},
	'qwen/qwen-2.5-coder-32b-instruct': {
		...openSourceModelOptions_assumingOAICompat['qwen2.5coder'],
		contextWindow: 33_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.07, output: 0.16 },
		downloadable: false,
	},
	'qwen/qwq-32b': {
		...openSourceModelOptions_assumingOAICompat['qwq'],
		contextWindow: 33_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.07, output: 0.16 },
		downloadable: false,
	}
} as const satisfies { [s: string]: CortexideStaticModelInfo }

const openRouterSettings: VoidStaticProviderInfo = {
	modelOptions: openRouterModelOptions_assumingOpenAICompat,
	modelOptionsFallback: (modelName) => {
		const res = extensiveModelOptionsFallback(modelName)
		// openRouter does not support gemini-style, use openai-style instead
		if (res?.specialToolFormat === 'gemini-style') {
			res.specialToolFormat = 'openai-style'
		}
		return res
	},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning : payload should have {include_reasoning: true} https://openrouter.ai/announcements/reasoning-tokens-for-thinking-models
		input: {
			// https://openrouter.ai/docs/use-cases/reasoning-tokens
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null

				if (reasoningInfo.type === 'budget_slider_value') {
					return {
						reasoning: {
							max_tokens: reasoningInfo.reasoningBudget
						}
					}
				}
				if (reasoningInfo.type === 'effort_slider_value')
					return {
						reasoning: {
							effort: reasoningInfo.reasoningEffort
						}
					}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
}




// ---------------- model settings of everything above ----------------

const modelSettingsOfProvider: { [providerName in ProviderName]: VoidStaticProviderInfo } = {
	openAI: openAISettings,
	anthropic: anthropicSettings,
	xAI: xAISettings,
	gemini: geminiSettings,

	// open source models
	deepseek: deepseekSettings,
	groq: groqSettings,

	// open source models + providers (mixture of everything)
	openRouter: openRouterSettings,
	vLLM: vLLMSettings,
	ollama: ollamaSettings,
	openAICompatible: openaiCompatible,
	mistral: mistralSettings,

	liteLLM: liteLLMSettings,
	lmStudio: lmStudioSettings,

	pollinations: pollinationsSettings,
	moonshot: moonshotSettings,
	cerebras: cerebrasSettings,

	googleVertex: googleVertexSettings,
	microsoftAzure: microsoftAzureSettings,
	awsBedrock: awsBedrockSettings,
} as const


// ---------------- exports ----------------

// returns the capabilities and the adjusted modelName if it was a fallback
export const getModelCapabilities = (
	providerName: ProviderName,
	modelName: string,
	overridesOfModel: OverridesOfModel | undefined
): CortexideStaticModelInfo & (
	| { modelName: string; recognizedModelName: string; isUnrecognizedModel: false }
	| { modelName: string; recognizedModelName?: undefined; isUnrecognizedModel: true }
) => {
	// Guard: Check if provider exists in modelSettingsOfProvider (handles "auto" and other invalid providers)
	if (!(providerName in modelSettingsOfProvider) || !modelSettingsOfProvider[providerName]) {
		// Return default capabilities for invalid provider names
		return { modelName, ...defaultModelOptions, isUnrecognizedModel: true };
	}

	const lowercaseModelName = modelName.toLowerCase()

	const { modelOptions, modelOptionsFallback } = modelSettingsOfProvider[providerName]

	// Get any override settings for this model
	const overrides = overridesOfModel?.[providerName]?.[modelName];

	// search model options object directly first
	for (const modelName_ in modelOptions) {
		const lowercaseModelName_ = modelName_.toLowerCase()
		if (lowercaseModelName === lowercaseModelName_) {
			return { ...modelOptions[modelName], ...overrides, modelName, recognizedModelName: modelName, isUnrecognizedModel: false };
		}
	}

	const result = modelOptionsFallback(modelName)
	if (result) {
		return { ...result, ...overrides, modelName: result.modelName, isUnrecognizedModel: false };
	}

	return { modelName, ...defaultModelOptions, ...overrides, isUnrecognizedModel: true };
}

// non-model settings
export const getProviderCapabilities = (providerName: ProviderName) => {
	const { providerReasoningIOSettings } = modelSettingsOfProvider[providerName]
	return { providerReasoningIOSettings }
}


export type SendableReasoningInfo = {
	type: 'budget_slider_value',
	isReasoningEnabled: true,
	reasoningBudget: number,
} | {
	type: 'effort_slider_value',
	isReasoningEnabled: true,
	reasoningEffort: string,
} | null



export const getIsReasoningEnabledState = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
) => {
	const { supportsReasoning, canTurnOffReasoning } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {}
	if (!supportsReasoning) return false

	// default to enabled if can't turn off, or if the featureName is Chat.
	const defaultEnabledVal = featureName === 'Chat' || !canTurnOffReasoning

	const isReasoningEnabled = modelSelectionOptions?.reasoningEnabled ?? defaultEnabledVal
	return isReasoningEnabled
}


export const getReservedOutputTokenSpace = (providerName: ProviderName, modelName: string, opts: { isReasoningEnabled: boolean, overridesOfModel: OverridesOfModel | undefined }) => {
	const {
		reasoningCapabilities,
		reservedOutputTokenSpace,
	} = getModelCapabilities(providerName, modelName, opts.overridesOfModel)
	return opts.isReasoningEnabled && reasoningCapabilities ? reasoningCapabilities.reasoningReservedOutputTokenSpace : reservedOutputTokenSpace
}

// used to force reasoning state (complex) into something simple we can just read from when sending a message
export const getSendableReasoningInfo = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
): SendableReasoningInfo => {

	const { reasoningSlider: reasoningBudgetSlider } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {}
	const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)
	if (!isReasoningEnabled) return null

	// check for reasoning budget
	const reasoningBudget = reasoningBudgetSlider?.type === 'budget_slider' ? modelSelectionOptions?.reasoningBudget ?? reasoningBudgetSlider?.default : undefined
	if (reasoningBudget) {
		return { type: 'budget_slider_value', isReasoningEnabled: isReasoningEnabled, reasoningBudget: reasoningBudget }
	}

	// check for reasoning effort
	const reasoningEffort = reasoningBudgetSlider?.type === 'effort_slider' ? modelSelectionOptions?.reasoningEffort ?? reasoningBudgetSlider?.default : undefined
	if (reasoningEffort) {
		return { type: 'effort_slider_value', isReasoningEnabled: isReasoningEnabled, reasoningEffort: reasoningEffort }
	}

	return null
}
