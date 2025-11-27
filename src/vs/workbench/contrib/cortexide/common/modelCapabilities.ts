/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

} as const;




export const defaultModelsOfProvider = {
	openAI: [ // https://platform.openai.com/docs/models/gp
		// Latest models (Nov 2025)
		'gpt-5.1-thinking', // Released Nov 12, 2025 - flagship with enhanced reasoning
		'gpt-5.1-instant', // Released Nov 12, 2025 - fast responses
		'gpt-5.1-codex', // Released Nov 12, 2025 - advanced coding model
		'gpt-5.1-codex-mini', // Released Nov 12, 2025 - lightweight coding model
		'gpt-5-pro', // Premium model with enhanced reasoning
		// GPT-5 series (Aug 2025)
		'gpt-5', // Released Aug 7, 2025 - flagship multimodal model
		'gpt-5-mini', // Fast variant of GPT-5
		// GPT-4.1 series (Apr 2025)
		'gpt-4.1', // Enhanced coding, reasoning, multimodal
		'gpt-4.1-mini',
		'gpt-4.1-nano',
		// Reasoning models
		'o3', // Advanced reasoning model
		'o4-mini', // Fast reasoning model
		// Legacy models (deprecated)
		// 'o1', // Deprecated
		// 'o1-mini', // Deprecated
		// 'gpt-4o', // Deprecated - use GPT-5 or GPT-4.1
		// 'gpt-4o-mini', // Deprecated
	],
	anthropic: [ // https://docs.anthropic.com/en/docs/about-claude/models
		// Claude 4.5 series (Oct 2025)
		'claude-sonnet-4.5', // Released Oct 14, 2025 - optimized for coding and agents
		'claude-haiku-4.5', // Released Oct 15, 2025 - low latency, cost-efficient
		// Claude 4.1 series (May-Aug 2025)
		'claude-opus-4.1', // Released Aug 5, 2025 - enhanced coding and reasoning
		'claude-opus-4.0', // Released May 2025
		'claude-sonnet-4.0', // Released May 2025
		// Claude 3.7 series
		'claude-3-7-sonnet-latest', // Latest 3.7 sonnet
		// Claude 3.5 series
		'claude-3-5-sonnet-latest', // Latest 3.5 sonnet
		'claude-3-5-haiku-latest', // Latest 3.5 haiku
		// Legacy Claude 3
		'claude-3-opus-latest', // Latest 3.0 opus
	],
	xAI: [ // https://docs.x.ai/docs/models?cluster=us-east-1
		// Latest models (Nov 2025)
		'grok-4', // Flagship model - high performance in math, reasoning, NLP
		'grok-4-fast', // Cost-efficient for quick responses
		'grok-4-fast-reasoning', // Cost-efficient reasoning model
		'grok-4-heavy', // Real-time data processing and speed
		// Grok 3 series
		'grok-3',
		'grok-3-mini',
		'grok-3-fast',
		'grok-3-mini-fast',
		// Legacy
		'grok-2', // Older version
	],
	gemini: [ // https://ai.google.dev/gemini-api/docs/models/gemini
		// Gemini 2.5 series (generally available) - prefer these until 3.0 is confirmed available
		'gemini-2.5-pro', // Generally available - strong reasoning, coding, math
		'gemini-2.5-flash', // Generally available - balanced performance
		'gemini-2.5-flash-lite', // Generally available - fastest and most cost-efficient
		// Latest models (Nov 2025) - may not be available in all regions/API versions yet
		'gemini-3.0-pro', // Released Nov 18, 2025 - most advanced model (auto-fallback to 2.5-pro if unavailable)
		'gemini-3.0-deep-think', // Released Nov 18, 2025 - complex reasoning (auto-fallback to 2.5-pro if unavailable)
		// Preview/experimental models (may be less stable)
		'gemini-2.5-pro-preview-05-06',
		'gemini-2.5-flash-preview-04-17',
		// Deprecated models (scheduled for deprecation Feb 2026)
		// 'gemini-2.0-flash', // Deprecated - use 2.5 or 3.0 models instead
		'gemini-2.0-flash-lite', // Still available but consider migrating to 2.5-flash-lite
	],
	deepseek: [ // https://api-docs.deepseek.com/quick_start/pricing
		// Latest models (Nov 2025)
		'deepseek-r1', // Cost-efficient reasoning model - top performer
		'deepseek-r1-zero', // Free variant of R1
		'deepseek-v3.1', // Latest general model
		// Standard models
		'deepseek-chat', // General-purpose conversations, coding, summarization
		'deepseek-reasoner', // Complex step-by-step logical reasoning
	],
	ollama: [ // autodetected - common models listed for reference
		// Latest models (2025) - these are autodetected but listed for documentation
		// Coding models
		// 'qwen2.5-coder:32b', // Strong coding capabilities
		// 'qwen2.5-coder:7b', // Lightweight coding model
		// 'deepseek-r1:32b', // Reasoning and coding
		// 'deepseek-r1:1.5b', // Lightweight reasoning
		// 'codestral:latest', // Mistral's coding model
		// 'devstral:latest', // Mistral's development model
		// General models
		// 'llama3.3:70b', // Latest Llama model
		// 'llama3.1:70b', // Strong general purpose
		// 'llama3.1:8b', // Fast and efficient
		// 'mistral-large:latest', // High performance
		// 'mistral-medium:latest', // Balanced performance
		// 'qwen2.5:72b', // Multilingual model
		// Vision models
		// 'llava:latest', // Vision-language model
		// 'bakllava:latest', // Alternative vision model
	],
	vLLM: [ // autodetected - common models listed for reference
		// Latest models (2025) - these are autodetected but listed for documentation
		// 'meta-llama/Llama-3.3-70B-Instruct',
		// 'meta-llama/Llama-3.1-70B-Instruct',
		// 'meta-llama/Llama-3.1-8B-Instruct',
		// 'Qwen/Qwen2.5-72B-Instruct',
		// 'Qwen/Qwen2.5-Coder-32B-Instruct',
		// 'mistralai/Mistral-Large-2407',
		// 'mistralai/Codestral-2407',
		// 'deepseek-ai/DeepSeek-R1',
	],
	lmStudio: [], // autodetected - supports same models as vLLM

	openRouter: [ // https://openrouter.ai/models
		// Latest models (Nov 2025)
		'anthropic/claude-sonnet-4.5', // Latest Claude - optimized for coding
		'anthropic/claude-opus-4.1', // Enhanced reasoning
		'anthropic/claude-haiku-4.5', // Fast and cost-efficient
		'google/gemini-3.0-pro', // Latest Gemini
		'google/gemini-3.0-deep-think', // Complex reasoning
		'qwen/qwen3-max', // Latest Qwen - outperforms many models
		'qwen/qwen3-next', // Advanced Qwen variant
		'qwen/qwen3-235b-a22b', // Large Qwen model
		'deepseek/deepseek-r1', // Top-performing reasoning model
		'deepseek/deepseek-r1-zero:free', // Free reasoning model
		'deepseek/deepseek-v3.1', // Latest DeepSeek general model
		// Claude 4.0 series
		'anthropic/claude-opus-4',
		'anthropic/claude-sonnet-4',
		// Claude 3.7 series
		'anthropic/claude-3.7-sonnet',
		// 'anthropic/claude-3.7-sonnet:thinking', // Thinking variant
		// Claude 3.5 series
		'anthropic/claude-3.5-sonnet',
		// Mistral models
		'mistralai/devstral-small:free', // Free coding model
		'mistralai/mistral-large-2407', // Latest Mistral Large
		'mistralai/mistral-medium-3', // Latest Mistral Medium
		'mistralai/codestral-2407', // Latest Codestral
		// 'mistralai/mistral-small-3.1-24b-instruct:free', // Free small model
		// Google models
		'google/gemini-2.5-pro', // Generally available
		'google/gemini-2.5-flash', // Fast variant
		// 'google/gemini-2.5-pro-preview-03-25', // Preview
		// 'google/gemini-2.0-flash-lite-preview-02-05:free', // Free preview
		// 'google/gemini-2.0-pro-exp-02-05:free', // Experimental
		// 'google/gemini-2.0-flash-exp:free', // Experimental
		// Other models
		// 'openrouter/quasar-alpha', // Experimental
	],
	groq: [ // https://console.groq.com/docs/models
		// Latest models (2025)
		'llama-3.3-70b-versatile', // Latest Llama 3.3 - versatile capabilities
		'llama-3.1-70b-versatile', // Large Llama 3.1
		'llama-3.1-8b-instant', // Fast Llama 3.1
		'qwen-qwq-32b', // Qwen model optimized for Groq
		'qwen-2.5-coder-32b', // Coding model (now generally available)
		'qwen-2.5-72b-instruct', // Large Qwen model
		'mistral-large-2407', // Latest Mistral Large
		'mixtral-8x7b-32768', // Mixtral model
	],
	mistral: [ // https://docs.mistral.ai/getting-started/models/models_overview/
		// Latest models (2025)
		'mistral-medium-3', // Released 2025 - performs at 90%+ of Claude Sonnet 3.7
		'mistral-large-latest', // Latest large model
		'mistral-medium-latest', // Latest medium model
		// Coding models
		'codestral-latest', // AI-powered software development
		'devstral-small-latest', // Small development model
		// Small models
		'ministral-3b-latest', // 3B parameter model
		'ministral-8b-latest', // 8B parameter model
	],
	openAICompatible: [], // fallback
	googleVertex: [],
	microsoftAzure: [],
	awsBedrock: [],
	liteLLM: [],


} as const satisfies Record<ProviderName, string[]>;



export type CortexideStaticModelInfo = { // not stateful
	// Void uses the information below to know how to handle each model.
	// for some examples, see openAIModelOptions and anthropicModelOptions (below).

	contextWindow: number; // input tokens
	reservedOutputTokenSpace: number | null; // reserve this much space in the context window for output, defaults to 4096 if null

	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated'; // typically you should use 'system-role'. 'separated' means the system message is passed as a separate field (e.g. anthropic)
	specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style'; // typically you should use 'openai-style'. null means "can't call tools by default", and asks the LLM to output XML in agent mode
	supportsFIM: boolean; // whether the model was specifically designed for autocomplete or "FIM" ("fill-in-middle" format)

	additionalOpenAIPayload?: { [key: string]: string }; // additional payload in the message body for requests that are openai-compatible (ollama, vllm, openai, openrouter, etc)

	// reasoning options
	reasoningCapabilities: false | {
		readonly supportsReasoning: true; // for clarity, this must be true if anything below is specified
		readonly canTurnOffReasoning: boolean; // whether or not the user can disable reasoning mode (false if the model only supports reasoning)
		readonly canIOReasoning: boolean; // whether or not the model actually outputs reasoning (eg o1 lets us control reasoning but not output it)
		readonly reasoningReservedOutputTokenSpace?: number; // overrides normal reservedOutputTokenSpace
		readonly reasoningSlider?:
		| undefined
		| { type: 'budget_slider'; min: number; max: number; default: number } // anthropic supports this (reasoning budget)
		| { type: 'effort_slider'; values: string[]; default: string }; // openai-compatible supports this (reasoning effort)

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
	};
	downloadable: false | {
		sizeGb: number | 'not-known';
	};
};
// if you change the above type, remember to update the Settings link



export const modelOverrideKeys = [
	'contextWindow',
	'reservedOutputTokenSpace',
	'supportsSystemMessage',
	'specialToolFormat',
	'supportsFIM',
	'reasoningCapabilities',
	'additionalOpenAIPayload'
] as const;

export type ModelOverrides = Pick<
	CortexideStaticModelInfo,
	(typeof modelOverrideKeys)[number]
>;




type ProviderReasoningIOSettings = {
	// include this in payload to get reasoning
	input?: { includeInPayload?: (reasoningState: SendableReasoningInfo) => null | { [key: string]: unknown } };
	// nameOfFieldInDelta: reasoning output is in response.choices[0].delta[deltaReasoningField]
	// needsManualParse: whether we must manually parse out the <think> tags
	output?:
	| { nameOfFieldInDelta?: string; needsManualParse?: undefined }
	| { nameOfFieldInDelta?: undefined; needsManualParse?: true };
};

type VoidStaticProviderInfo = { // doesn't change (not stateful)
	providerReasoningIOSettings?: ProviderReasoningIOSettings; // input/output settings around thinking (allowed to be empty) - only applied if the model supports reasoning output
	modelOptions: { [key: string]: CortexideStaticModelInfo };
	modelOptionsFallback: (modelName: string, fallbackKnownValues?: Partial<CortexideStaticModelInfo>) => (CortexideStaticModelInfo & { modelName: string; recognizedModelName: string }) | null;
};



const defaultModelOptions = {
	contextWindow: 4_096,
	reservedOutputTokenSpace: 4_096,
	cost: { input: 0, output: 0 },
	downloadable: false,
	supportsSystemMessage: false,
	supportsFIM: false,
	reasoningCapabilities: false,
} as const satisfies CortexideStaticModelInfo;

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
} as const satisfies { [s: string]: Partial<CortexideStaticModelInfo> };




// keep modelName, but use the fallback's defaults
const extensiveModelOptionsFallback: VoidStaticProviderInfo['modelOptionsFallback'] = (modelName, fallbackKnownValues) => {

	const lower = modelName.toLowerCase();

	const toFallback = <T extends { [s: string]: Omit<CortexideStaticModelInfo, 'cost' | 'downloadable'> },>(obj: T, recognizedModelName: string & keyof T)
		: CortexideStaticModelInfo & { modelName: string; recognizedModelName: string } => {

		const opts = obj[recognizedModelName];
		const supportsSystemMessage = opts.supportsSystemMessage === 'separated'
			? 'system-role'
			: opts.supportsSystemMessage;

		return {
			recognizedModelName,
			modelName,
			...opts,
			supportsSystemMessage: supportsSystemMessage,
			cost: { input: 0, output: 0 },
			downloadable: false,
			...fallbackKnownValues
		};
	};

	// Gemini 3.0 models
	if (lower.includes('gemini') && (lower.includes('3.0') || lower.includes('3-0') || lower.includes('3'))) {
		if (lower.includes('deep') || lower.includes('think')) {
			return toFallback(geminiModelOptions, 'gemini-3.0-deep-think');
		}
		return toFallback(geminiModelOptions, 'gemini-3.0-pro');
	}
	// Gemini 2.5 models
	if (lower.includes('gemini') && (lower.includes('2.5') || lower.includes('2-5'))) {
		if (lower.includes('flash') && lower.includes('lite')) {
			return toFallback(geminiModelOptions, 'gemini-2.5-flash-lite');
		}
		if (lower.includes('flash')) {
			return toFallback(geminiModelOptions, 'gemini-2.5-flash');
		}
		return toFallback(geminiModelOptions, 'gemini-2.5-pro');
	}

	// Claude 4.5 series (Oct 2025)
	if (lower.includes('claude') && (lower.includes('4.5') || lower.includes('4-5'))) {
		if (lower.includes('haiku')) { return toFallback(anthropicModelOptions, 'claude-haiku-4.5-20251015'); }
		if (lower.includes('sonnet')) { return toFallback(anthropicModelOptions, 'claude-sonnet-4.5-20251014'); }
		return toFallback(anthropicModelOptions, 'claude-sonnet-4.5-20251014');
	}
	// Claude 4.1 series (May-Aug 2025)
	if (lower.includes('claude') && (lower.includes('4.1') || lower.includes('4-1'))) {
		if (lower.includes('opus')) { return toFallback(anthropicModelOptions, 'claude-opus-4.1-20250805'); }
		return toFallback(anthropicModelOptions, 'claude-opus-4.1-20250805');
	}
	// Claude 4.0 series
	if (lower.includes('claude') && (lower.includes('4.0') || lower.includes('4-0') || (lower.includes('4') && !lower.includes('3')))) {
		if (lower.includes('opus')) { return toFallback(anthropicModelOptions, 'claude-opus-4.0-20250503'); }
		if (lower.includes('sonnet')) { return toFallback(anthropicModelOptions, 'claude-sonnet-4.0-20250503'); }
		return toFallback(anthropicModelOptions, 'claude-sonnet-4.0-20250503');
	}
	// Claude 3.7 series
	if (lower.includes('claude') && (lower.includes('3.7') || lower.includes('3-7'))) {
		return toFallback(anthropicModelOptions, 'claude-3-7-sonnet-20250219');
	}
	// Claude 3.5 series
	if (lower.includes('claude-3-5') || lower.includes('claude-3.5')) { return toFallback(anthropicModelOptions, 'claude-3-5-sonnet-20241022'); }
	// Claude 3.x fallback
	if (lower.includes('claude')) { return toFallback(anthropicModelOptions, 'claude-3-7-sonnet-20250219'); }

	// Grok 4 series (Nov 2025)
	if (lower.includes('grok') && (lower.includes('4') || lower.includes('four'))) {
		if (lower.includes('heavy')) { return toFallback(xAIModelOptions, 'grok-4-heavy'); }
		if (lower.includes('fast') && lower.includes('reasoning')) { return toFallback(xAIModelOptions, 'grok-4-fast-reasoning'); }
		if (lower.includes('fast')) { return toFallback(xAIModelOptions, 'grok-4-fast'); }
		return toFallback(xAIModelOptions, 'grok-4');
	}
	// Grok 3 series
	if (lower.includes('grok') && (lower.includes('3') || lower.includes('three'))) {
		if (lower.includes('mini') && lower.includes('fast')) { return toFallback(xAIModelOptions, 'grok-3-mini-fast'); }
		if (lower.includes('mini')) { return toFallback(xAIModelOptions, 'grok-3-mini'); }
		if (lower.includes('fast')) { return toFallback(xAIModelOptions, 'grok-3-fast'); }
		return toFallback(xAIModelOptions, 'grok-3');
	}
	// Grok 2 (legacy)
	if (lower.includes('grok2') || (lower.includes('grok') && lower.includes('2'))) { return toFallback(xAIModelOptions, 'grok-2'); }
	// Generic Grok fallback
	if (lower.includes('grok')) { return toFallback(xAIModelOptions, 'grok-4'); }

	if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekR1'); }
	if (lower.includes('deepseek') && lower.includes('v2')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV2'); }
	if (lower.includes('deepseek')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV3'); }

	if (lower.includes('llama3')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3'); }
	if (lower.includes('llama3.1')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.1'); }
	if (lower.includes('llama3.2')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.2'); }
	if (lower.includes('llama3.3')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.3'); }
	if (lower.includes('llama') || lower.includes('scout')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout'); }
	if (lower.includes('llama') || lower.includes('maverick')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout'); }
	if (lower.includes('llama')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout'); }

	if (lower.includes('qwen') && lower.includes('2.5') && lower.includes('coder')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen2.5coder'); }
	if (lower.includes('qwen') && lower.includes('3')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3'); }
	if (lower.includes('qwen')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3'); }
	if (lower.includes('qwq')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'qwq'); }
	if (lower.includes('phi4')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'phi4'); }
	if (lower.includes('codestral')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'codestral'); }
	if (lower.includes('devstral')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'devstral'); }

	if (lower.includes('gemma')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'gemma'); }

	if (lower.includes('starcoder2')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'starcoder2'); }

	if (lower.includes('openhands')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'openhands-lm-32b'); } // max output uncler

	if (lower.includes('quasar') || lower.includes('quaser')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'quasar'); }

	// GPT-5.1 series (Nov 2025)
	if (lower.includes('gpt') && lower.includes('5.1')) {
		if (lower.includes('codex') && lower.includes('mini')) { return toFallback(openAIModelOptions, 'gpt-5.1-codex-mini'); }
		if (lower.includes('codex')) { return toFallback(openAIModelOptions, 'gpt-5.1-codex'); }
		if (lower.includes('thinking')) { return toFallback(openAIModelOptions, 'gpt-5.1-thinking'); }
		if (lower.includes('instant')) { return toFallback(openAIModelOptions, 'gpt-5.1-instant'); }
		return toFallback(openAIModelOptions, 'gpt-5.1-thinking'); // Default to thinking
	}
	// GPT-5 series (Aug 2025)
	if (lower.includes('gpt') && lower.includes('5') && lower.includes('pro')) { return toFallback(openAIModelOptions, 'gpt-5-pro'); }
	if (lower.includes('gpt') && lower.includes('mini') && (lower.includes('5') || lower.includes('5.0'))) { return toFallback(openAIModelOptions, 'gpt-5-mini'); }
	if (lower.includes('gpt') && (lower.includes('5') || lower.includes('5.0'))) { return toFallback(openAIModelOptions, 'gpt-5'); }
	if (lower.includes('gpt') && lower.includes('mini') && (lower.includes('4.1') || lower.includes('4-1'))) { return toFallback(openAIModelOptions, 'gpt-4.1-mini'); }
	if (lower.includes('gpt') && lower.includes('nano') && (lower.includes('4.1') || lower.includes('4-1'))) { return toFallback(openAIModelOptions, 'gpt-4.1-nano'); }
	if (lower.includes('gpt') && (lower.includes('4.1') || lower.includes('4-1'))) { return toFallback(openAIModelOptions, 'gpt-4.1'); }

	if (lower.includes('4o') && lower.includes('mini')) { return toFallback(openAIModelOptions, 'gpt-4o-mini'); }
	if (lower.includes('4o')) { return toFallback(openAIModelOptions, 'gpt-4o'); }

	if (lower.includes('o1') && lower.includes('mini')) { return toFallback(openAIModelOptions, 'o1-mini'); }
	if (lower.includes('o1')) { return toFallback(openAIModelOptions, 'o1'); }
	if (lower.includes('o3') && lower.includes('mini')) { return toFallback(openAIModelOptions, 'o3-mini'); }
	if (lower.includes('o3')) { return toFallback(openAIModelOptions, 'o3'); }
	if (lower.includes('o4') && lower.includes('mini')) { return toFallback(openAIModelOptions, 'o4-mini'); }


	if (Object.keys(openSourceModelOptions_assumingOAICompat).map(k => k.toLowerCase()).includes(lower)) { return toFallback(openSourceModelOptions_assumingOAICompat, lower as keyof typeof openSourceModelOptions_assumingOAICompat); }

	return null;
};






// ---------------- ANTHROPIC ----------------
const anthropicModelOptions = {
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
	'claude-sonnet-4.5-20251014': { // Released Oct 14, 2025 - optimized for coding and agents
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
	'claude-haiku-4.5-20251015': { // Released Oct 15, 2025 - low latency, cost-efficient
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-opus-4.1-20250805': { // Released Aug 5, 2025 - enhanced coding and reasoning
		contextWindow: 1_000_000, // 1M token context window
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
	'claude-opus-4.0-20250503': { // Released May 2025
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
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
		},
	},
	'claude-sonnet-4.0-20250503': { // Released May 2025
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
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
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
} as const satisfies { [s: string]: CortexideStaticModelInfo };

const anthropicSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) { return null; }

				if (reasoningInfo.type === 'budget_slider_value') {
					return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } };
				}
				return null;
			}
		},
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase();
		let fallbackName: keyof typeof anthropicModelOptions | null = null;
		if (lower.includes('claude-4-opus') || lower.includes('claude-opus-4')) { fallbackName = 'claude-opus-4-20250514'; }
		if (lower.includes('claude-4-sonnet') || lower.includes('claude-sonnet-4')) { fallbackName = 'claude-sonnet-4-20250514'; }


		if (lower.includes('claude-3-7-sonnet')) { fallbackName = 'claude-3-7-sonnet-20250219'; }
		if (lower.includes('claude-3-5-sonnet')) { fallbackName = 'claude-3-5-sonnet-20241022'; }
		if (lower.includes('claude-3-5-haiku')) { fallbackName = 'claude-3-5-haiku-20241022'; }
		if (lower.includes('claude-3-opus')) { fallbackName = 'claude-3-opus-20240229'; }
		if (lower.includes('claude-3-sonnet')) { fallbackName = 'claude-3-sonnet-20240229'; }
		if (fallbackName) { return { modelName: fallbackName, recognizedModelName: fallbackName, ...anthropicModelOptions[fallbackName] }; }
		return null;
	},
};


// ---------------- OPENAI ----------------
const openAIModelOptions = { // https://platform.openai.com/docs/pricing
	// GPT-5.1 series (Nov 2025)
	'gpt-5.1-thinking': { // Released Nov 12, 2025 - flagship with enhanced reasoning
		contextWindow: 196_000, // Enhanced context window
		reservedOutputTokenSpace: 32_768,
		cost: { input: 2.50, output: 10.00, cache_read: 0.625 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'medium' },
		},
	},
	'gpt-5.1-instant': { // Released Nov 12, 2025 - fast responses
		contextWindow: 196_000,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.50, output: 2.00, cache_read: 0.125 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5.1-codex': { // Released Nov 12, 2025 - advanced coding model
		contextWindow: 196_000,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 3.00, output: 12.00, cache_read: 0.75 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: true, // Coding models typically support FIM
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5.1-codex-mini': { // Released Nov 12, 2025 - lightweight coding model
		contextWindow: 196_000,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.60, output: 2.40, cache_read: 0.15 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: true,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5-pro': { // Premium model with enhanced reasoning
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 5.00, output: 20.00, cache_read: 1.25 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'medium' },
		},
	},
	'gpt-5': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 2.50, output: 10.00, cache_read: 0.625 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5-mini': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.50, output: 2.00, cache_read: 0.125 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'o3': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 10.00, output: 40.00, cache_read: 2.50 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'o4-mini': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 1.10, output: 4.40, cache_read: 0.275 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'gpt-4.1': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 2.00, output: 8.00, cache_read: 0.50 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-4.1-mini': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.40, output: 1.60, cache_read: 0.10 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-4.1-nano': {
		contextWindow: 1_047_576,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.10, output: 0.40, cache_read: 0.03 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
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
	'o3-mini': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 100_000,
		cost: { input: 1.10, cache_read: 0.55, output: 4.40, },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
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
	'o1-mini': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 1.10, cache_read: 0.55, output: 4.40, },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: false, // does not support any system
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'low' } },
	},
	'gpt-4o-mini': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 0.15, cache_read: 0.075, output: 0.60, },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'system-role', // ??
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: CortexideStaticModelInfo };


// https://platform.openai.com/docs/guides/reasoning?api-mode=chat
const openAICompatIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) { return null; }
	if (reasoningInfo.type === 'effort_slider_value') {
		return { reasoning_effort: reasoningInfo.reasoningEffort };
	}
	return null;

};

const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase();
		let fallbackName: keyof typeof openAIModelOptions | null = null;
		if (lower.includes('gpt-5') || (lower.includes('gpt') && lower.includes('5'))) { fallbackName = 'gpt-5'; }
		if (lower.includes('o1')) { fallbackName = 'o1'; }
		if (lower.includes('o3-mini')) { fallbackName = 'o3-mini'; }
		if (lower.includes('gpt-4o')) { fallbackName = 'gpt-4o'; }
		if (fallbackName) { return { modelName: fallbackName, recognizedModelName: fallbackName, ...openAIModelOptions[fallbackName] }; }
		return null;
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};

// ---------------- XAI ----------------
const xAIModelOptions = {
	// https://docs.x.ai/docs/guides/reasoning#reasoning
	// https://docs.x.ai/docs/models#models-and-pricing
	// Grok 4 series (Nov 2025)
	'grok-4': { // Flagship model - high performance in math, reasoning, NLP
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 3.50, output: 17.50 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'medium' },
		},
	},
	'grok-4-fast': { // Cost-efficient for quick responses
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 1.00, output: 5.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-4-fast-reasoning': { // Cost-efficient reasoning model
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 1.50, output: 7.50 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningSlider: { type: 'effort_slider', values: ['low', 'medium'], default: 'low' },
		},
	},
	'grok-4-heavy': { // Real-time data processing and speed
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 5.00, output: 25.00 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningSlider: { type: 'effort_slider', values: ['low', 'medium', 'high'], default: 'high' },
		},
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
} as const satisfies { [s: string]: CortexideStaticModelInfo };

const xAISettings: VoidStaticProviderInfo = {
	modelOptions: xAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase();
		let fallbackName: keyof typeof xAIModelOptions | null = null;
		if (lower.includes('grok-2')) { fallbackName = 'grok-2'; }
		if (lower.includes('grok-3')) { fallbackName = 'grok-3'; }
		if (lower.includes('grok')) { fallbackName = 'grok-3'; }
		if (fallbackName) { return { modelName: fallbackName, recognizedModelName: fallbackName, ...xAIModelOptions[fallbackName] }; }
		return null;
	},
	// same implementation as openai
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};


// ---------------- GEMINI ----------------
const geminiModelOptions = { // https://ai.google.dev/gemini-api/docs/pricing
	// https://ai.google.dev/gemini-api/docs/thinking#set-budget

	// Gemini 3.0 series (Nov 2025)
	'gemini-3.0-pro': {
		contextWindow: 1_048_576, // 1M tokens
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 }, // TODO: Update with actual pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-3.0-deep-think': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 }, // TODO: Update with actual pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
			reasoningReservedOutputTokenSpace: 8192,
		},
	},

	// Gemini 2.5 series (generally available)
	'gemini-2.5-pro': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 }, // TODO: Update with actual pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.5-flash': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.15, output: 0.60 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: false,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 },
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.5-flash-lite': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.075, output: 0.30 }, // TODO: Verify pricing
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: false,
	},

	// Preview/experimental models
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
} as const satisfies { [s: string]: CortexideStaticModelInfo };

const geminiSettings: VoidStaticProviderInfo = {
	modelOptions: geminiModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
};



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
} as const satisfies { [s: string]: CortexideStaticModelInfo };


const deepseekSettings: VoidStaticProviderInfo = {
	modelOptions: deepseekModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
	providerReasoningIOSettings: {
		// reasoning: OAICompat +  response.choices[0].delta.reasoning_content // https://api-docs.deepseek.com/guides/reasoning_model
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
};



// ---------------- MISTRAL ----------------

const mistralModelOptions = { // https://mistral.ai/products/la-plateforme#pricing https://docs.mistral.ai/getting-started/models/models_overview/#premier-models
	'mistral-large-latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 2.00, output: 6.00 },
		supportsFIM: false,
		downloadable: { sizeGb: 73 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'mistral-medium-latest': { // https://openrouter.ai/mistralai/mistral-medium-3
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.40, output: 2.00 },
		supportsFIM: false,
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
} as const satisfies { [s: string]: CortexideStaticModelInfo };

const mistralSettings: VoidStaticProviderInfo = {
	modelOptions: mistralModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};


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
} as const satisfies { [s: string]: CortexideStaticModelInfo };
const groqSettings: VoidStaticProviderInfo = {
	modelOptions: groqModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
	providerReasoningIOSettings: {
		// Must be set to either parsed or hidden when using tool calling https://console.groq.com/docs/reasoning
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) { return null; }
				if (reasoningInfo.type === 'budget_slider_value') {
					return { reasoning_format: 'parsed' };
				}
				return null;
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
};


// ---------------- GOOGLE VERTEX ----------------
const googleVertexModelOptions = {
} as const satisfies Record<string, CortexideStaticModelInfo>;
const googleVertexSettings: VoidStaticProviderInfo = {
	modelOptions: googleVertexModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};

// ---------------- MICROSOFT AZURE ----------------
const microsoftAzureModelOptions = {
} as const satisfies Record<string, CortexideStaticModelInfo>;
const microsoftAzureSettings: VoidStaticProviderInfo = {
	modelOptions: microsoftAzureModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};

// ---------------- AWS BEDROCK ----------------
const awsBedrockModelOptions = {
} as const satisfies Record<string, CortexideStaticModelInfo>;

const awsBedrockSettings: VoidStaticProviderInfo = {
	modelOptions: awsBedrockModelOptions,
	modelOptionsFallback: (modelName) => { return null; },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};


// ---------------- VLLM, OLLAMA, OPENAICOMPAT (self-hosted / local) ----------------
const ollamaModelOptions = {
	'qwen2.5-coder:7b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.9 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:3b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.9 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:1.5b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: .986 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'llama3.1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.9 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.7 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwq': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 32_000,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 20 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'deepseek-r1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.7 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'devstral:latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 14 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'llama3.3:70b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 40 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:32b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 19 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'deepseek-r1:32b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 19 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'deepseek-r1:1.5b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.0 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'codestral:latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 7 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},

} as const satisfies Record<string, CortexideStaticModelInfo>;

export const ollamaRecommendedModels = [
	// Latest models (2025)
	'llama3.3:70b', // Latest Llama - versatile capabilities
	'qwen2.5-coder:32b', // Strong coding capabilities
	'qwen2.5-coder:7b', // Lightweight coding
	'deepseek-r1:32b', // Top reasoning model
	'deepseek-r1:1.5b', // Lightweight reasoning
	'codestral:latest', // Mistral coding model
	'devstral:latest', // Mistral dev model
	// Legacy names (for backward compatibility)
	'llama3.1',
	'qwq',
	'deepseek-r1',
	'qwen2.5-coder:1.5b',
] as const satisfies (keyof typeof ollamaModelOptions)[];


const vLLMSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: {},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning_content // https://docs.vllm.ai/en/stable/features/reasoning_outputs.html#streaming-chat-completions
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
};

const lmStudioSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' }, contextWindow: 4_096 }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
};

const ollamaSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: ollamaModelOptions,
	providerReasoningIOSettings: {
		// reasoning: we need to filter out reasoning <think> tags manually
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
};

const openaiCompatible: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => {
		const result = extensiveModelOptionsFallback(modelName, { specialToolFormat: 'openai-style' });
		if (result) {
			// Ensure OpenAI-compatible models use openai-style tool format
			if (!result.specialToolFormat) {
				result.specialToolFormat = 'openai-style';
			}
			return result;
		}
		// For unrecognized models, return a default with openai-style tool format
		// since they're supposed to be OpenAI-compatible
		return {
			modelName,
			recognizedModelName: modelName,
			...defaultModelOptions,
			specialToolFormat: 'openai-style',
		};
	},
	modelOptions: {},
	providerReasoningIOSettings: {
		// reasoning: we have no idea what endpoint they used, so we can't consistently parse out reasoning
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
};

const liteLLMSettings: VoidStaticProviderInfo = { // https://docs.litellm.ai/docs/reasoning_content
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
};


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
	'anthropic/claude-opus-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'anthropic/claude-sonnet-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
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
} as const satisfies { [s: string]: CortexideStaticModelInfo };

const openRouterSettings: VoidStaticProviderInfo = {
	modelOptions: openRouterModelOptions_assumingOpenAICompat,
	modelOptionsFallback: (modelName) => {
		const res = extensiveModelOptionsFallback(modelName);
		// openRouter does not support gemini-style, use openai-style instead
		if (res?.specialToolFormat === 'gemini-style') {
			res.specialToolFormat = 'openai-style';
		}
		return res;
	},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning : payload should have {include_reasoning: true} https://openrouter.ai/announcements/reasoning-tokens-for-thinking-models
		input: {
			// https://openrouter.ai/docs/use-cases/reasoning-tokens
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) { return null; }

				if (reasoningInfo.type === 'budget_slider_value') {
					return {
						reasoning: {
							max_tokens: reasoningInfo.reasoningBudget
						}
					};
				}
				if (reasoningInfo.type === 'effort_slider_value') {
					return {
						reasoning: {
							effort: reasoningInfo.reasoningEffort
						}
					};
				}
				return null;
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
};




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

	googleVertex: googleVertexSettings,
	microsoftAzure: microsoftAzureSettings,
	awsBedrock: awsBedrockSettings,
} as const;


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

	const lowercaseModelName = modelName.toLowerCase();

	const { modelOptions, modelOptionsFallback } = modelSettingsOfProvider[providerName];

	// Get any override settings for this model
	const overrides = overridesOfModel?.[providerName]?.[modelName];

	// search model options object directly first
	for (const modelName_ in modelOptions) {
		const lowercaseModelName_ = modelName_.toLowerCase();
		if (lowercaseModelName === lowercaseModelName_) {
			return { ...modelOptions[modelName], ...overrides, modelName, recognizedModelName: modelName, isUnrecognizedModel: false };
		}
	}

	const result = modelOptionsFallback(modelName);
	if (result) {
		return { ...result, ...overrides, modelName: result.modelName, isUnrecognizedModel: false };
	}

	return { modelName, ...defaultModelOptions, ...overrides, isUnrecognizedModel: true };
};

// non-model settings
export const getProviderCapabilities = (providerName: ProviderName) => {
	const { providerReasoningIOSettings } = modelSettingsOfProvider[providerName];
	return { providerReasoningIOSettings };
};


export type SendableReasoningInfo = {
	type: 'budget_slider_value';
	isReasoningEnabled: true;
	reasoningBudget: number;
} | {
	type: 'effort_slider_value';
	isReasoningEnabled: true;
	reasoningEffort: string;
} | null;



export const getIsReasoningEnabledState = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
) => {
	const { supportsReasoning, canTurnOffReasoning } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {};
	if (!supportsReasoning) { return false; }

	// default to enabled if can't turn off, or if the featureName is Chat.
	const defaultEnabledVal = featureName === 'Chat' || !canTurnOffReasoning;

	const isReasoningEnabled = modelSelectionOptions?.reasoningEnabled ?? defaultEnabledVal;
	return isReasoningEnabled;
};


export const getReservedOutputTokenSpace = (providerName: ProviderName, modelName: string, opts: { isReasoningEnabled: boolean; overridesOfModel: OverridesOfModel | undefined }) => {
	const {
		reasoningCapabilities,
		reservedOutputTokenSpace,
	} = getModelCapabilities(providerName, modelName, opts.overridesOfModel);
	return opts.isReasoningEnabled && reasoningCapabilities ? reasoningCapabilities.reasoningReservedOutputTokenSpace : reservedOutputTokenSpace;
};

// used to force reasoning state (complex) into something simple we can just read from when sending a message
export const getSendableReasoningInfo = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
): SendableReasoningInfo => {

	const { reasoningSlider: reasoningBudgetSlider } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {};
	const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel);
	if (!isReasoningEnabled) { return null; }

	// check for reasoning budget
	const reasoningBudget = reasoningBudgetSlider?.type === 'budget_slider' ? modelSelectionOptions?.reasoningBudget ?? reasoningBudgetSlider?.default : undefined;
	if (reasoningBudget) {
		return { type: 'budget_slider_value', isReasoningEnabled: isReasoningEnabled, reasoningBudget: reasoningBudget };
	}

	// check for reasoning effort
	const reasoningEffort = reasoningBudgetSlider?.type === 'effort_slider' ? modelSelectionOptions?.reasoningEffort ?? reasoningBudgetSlider?.default : undefined;
	if (reasoningEffort) {
		return { type: 'effort_slider_value', isReasoningEnabled: isReasoningEnabled, reasoningEffort: reasoningEffort };
	}

	return null;
};
