/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName } from './cortexideSettingsTypes.js';
import { ICortexideSettingsService } from './cortexideSettingsService.js';
import { canEgress } from './egressPolicy.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Model information from remote provider catalogs
 */
export interface RemoteModelInfo {
	id: string;
	name: string;
	description?: string;
	contextWindow?: number;
	supportsVision?: boolean;
	supportsPDF?: boolean;
	supportsCode?: boolean;
	cost?: {
		input: number;
		output: number;
	};
	deprecated?: boolean;
	beta?: boolean;
	preview?: boolean;
}

/**
 * Cached catalog entry with TTL
 */
interface CachedCatalog {
	models: RemoteModelInfo[];
	timestamp: number;
	ttl: number; // milliseconds
}

/**
 * Service for fetching and caching remote provider model catalogs
 */
export interface IRemoteCatalogService {
	readonly _serviceBrand: undefined;

	/**
	 * Fetch models from a remote provider's catalog
	 */
	fetchCatalog(providerName: ProviderName, forceRefresh?: boolean): Promise<RemoteModelInfo[]>;

	/**
	 * Health check a specific model
	 */
	healthCheck(providerName: ProviderName, modelId: string): Promise<boolean>;

	/**
	 * Clear cache for a provider
	 */
	clearCache(providerName: ProviderName): void;
}

export class RemoteCatalogService implements IRemoteCatalogService {
	readonly _serviceBrand: undefined;

	private cache: Map<ProviderName, CachedCatalog> = new Map();
	private readonly DEFAULT_TTL = 3600_000; // 1 hour

	constructor(
		@ICortexideSettingsService private readonly settingsService: ICortexideSettingsService
	) {}

	async fetchCatalog(providerName: ProviderName, forceRefresh: boolean = false): Promise<RemoteModelInfo[]> {
		// Check cache first
		if (!forceRefresh) {
			const cached = this.cache.get(providerName);
			if (cached && Date.now() - cached.timestamp < cached.ttl) {
				return cached.models;
			}
		}

		// Fetch from provider
		const models = await this.fetchFromProvider(providerName);

		// Cache result
		this.cache.set(providerName, {
			models,
			timestamp: Date.now(),
			ttl: this.DEFAULT_TTL,
		});

		return models;
	}

	private async fetchFromProvider(providerName: ProviderName): Promise<RemoteModelInfo[]> {
		// EGRESS GATE (Phase 8): every catalog endpoint below is a remote cloud API contacted
		// with the user's API key. Under local-only privacy mode we must not make that call.
		// (Cached results from a prior session are still returned by fetchCatalog -- returning
		// cache sends no bytes off the machine.) The hardcoded modelCapabilities list remains
		// the fallback when this returns [].
		const egress = canEgress(
			{ routingPolicy: this.settingsService.state.globalSettings.routingPolicy },
			{ modality: 'model-catalog', destinationKind: 'remote', providerName }
		);
		if (!egress.allowed) {
			return [];
		}

		const settings = this.settingsService.state.settingsOfProvider[providerName];

		// Only fetch if provider is configured
		if (!settings._didFillInProviderSettings) {
			return [];
		}

		// Get API key - it might be undefined
		const apiKey = settings.apiKey;
		if (!apiKey) {
			return [];
		}

		try {
			switch (providerName) {
				case 'openAI':
					return await this.fetchOpenAICatalog(apiKey);
				case 'anthropic':
					return await this.fetchAnthropicCatalog(apiKey);
				case 'gemini':
					return await this.fetchGeminiCatalog(apiKey);
				case 'mistral':
					return await this.fetchMistralCatalog(apiKey);
				case 'groq':
					return await this.fetchGroqCatalog(apiKey);
				case 'xAI':
					return await this.fetchXAICatalog(apiKey);
				case 'deepseek':
					return await this.fetchDeepSeekCatalog(apiKey);
				case 'openRouter':
					return await this.fetchOpenRouterCatalog(apiKey);
				default:
					// For providers without public catalog APIs, return empty
					// They rely on hardcoded lists in modelCapabilities.ts
					return [];
			}
		} catch (error) {
			console.error(`Failed to fetch catalog for ${providerName}:`, error);
			return [];
		}
	}

	// Exclude non-chat artifacts (embeddings, audio, image, moderation, legacy base models) so a refresh
	// doesn't flood the Chat model dropdown with models you can't chat with.
	private static readonly NON_CHAT_HINTS = [
		'embed', 'whisper', 'tts', 'audio', 'speech', 'transcrib', 'moderation', 'dall-e', 'dalle',
		'image', 'imagen', 'stable-diffusion', 'sdxl', 'rerank', 'guard', 'realtime', 'babbage',
		'davinci-002', 'text-davinci', 'clip', 'voice',
	];
	private static isLikelyChatModel(id: string): boolean {
		const l = (id || '').toLowerCase();
		if (!l) { return false; }
		return !RemoteCatalogService.NON_CHAT_HINTS.some(h => l.includes(h));
	}

	/**
	 * Fetch an OpenAI-compatible `/models` list (`{ data: [{ id, ... }] }`). Used by OpenAI, Groq, xAI,
	 * DeepSeek and Mistral, which all expose the same shape. Errors (incl. CORS / bad key) bubble to the
	 * caller's try/catch, which returns [] so the hardcoded catalog remains the fallback.
	 */
	private async fetchOpenAIStyleModels(url: string, apiKey: string, headers?: Record<string, string>): Promise<RemoteModelInfo[]> {
		const response = await fetch(url, {
			headers: { 'Authorization': `Bearer ${apiKey}`, ...(headers || {}) },
		});
		if (!response.ok) {
			throw new Error(`models endpoint ${url} returned ${response.status}`);
		}
		const data = await response.json();
		const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
		return list
			.map((m: any) => (typeof m === 'string' ? { id: m } : m))
			.filter((m: any) => m?.id && RemoteCatalogService.isLikelyChatModel(m.id))
			.map((m: any) => ({
				id: m.id,
				name: m.id,
				// Some OpenAI-compatible providers (e.g. Mistral) include context_length / max_context_length.
				contextWindow: m.context_length ?? m.max_context_length ?? m.max_model_len ?? undefined,
				supportsCode: /code|coder/.test(String(m.id).toLowerCase()) || undefined,
			}));
	}

	private async fetchOpenAICatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		return this.fetchOpenAIStyleModels('https://api.openai.com/v1/models', apiKey);
	}

	private async fetchGroqCatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		return this.fetchOpenAIStyleModels('https://api.groq.com/openai/v1/models', apiKey);
	}

	private async fetchXAICatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		return this.fetchOpenAIStyleModels('https://api.x.ai/v1/models', apiKey);
	}

	private async fetchDeepSeekCatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		return this.fetchOpenAIStyleModels('https://api.deepseek.com/models', apiKey);
	}

	private async fetchMistralCatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		return this.fetchOpenAIStyleModels('https://api.mistral.ai/v1/models', apiKey);
	}

	private async fetchAnthropicCatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		// Anthropic exposes GET /v1/models (x-api-key + anthropic-version). Shape: { data: [{ id, display_name }] }.
		const response = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			},
		});
		if (!response.ok) {
			throw new Error(`Anthropic models endpoint returned ${response.status}`);
		}
		const data = await response.json();
		return (data?.data || [])
			.filter((m: any) => m?.id && RemoteCatalogService.isLikelyChatModel(m.id))
			.map((m: any) => ({ id: m.id, name: m.display_name || m.id }));
	}

	private async fetchGeminiCatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		// Google's list endpoint: GET /v1beta/models?key=. Names look like "models/gemini-1.5-pro";
		// keep only models that support generateContent (i.e. chat), and strip the "models/" prefix.
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`);
		if (!response.ok) {
			throw new Error(`Gemini models endpoint returned ${response.status}`);
		}
		const data = await response.json();
		return (data?.models || [])
			.filter((m: any) => (m?.supportedGenerationMethods || []).includes('generateContent'))
			.map((m: any) => {
				const id = String(m.name || '').replace(/^models\//, '');
				return { id, name: m.displayName || id, contextWindow: m.inputTokenLimit };
			})
			.filter((m: RemoteModelInfo) => m.id && RemoteCatalogService.isLikelyChatModel(m.id));
	}

	private async fetchOpenRouterCatalog(apiKey: string): Promise<RemoteModelInfo[]> {
		// OpenRouter has a public models endpoint
		try {
			const response = await fetch('https://openrouter.ai/api/v1/models', {
				headers: apiKey ? {
					'Authorization': `Bearer ${apiKey}`,
				} : {},
			});

			if (!response.ok) {
				throw new Error(`OpenRouter API returned ${response.status}`);
			}

			const data = await response.json();
			return (data.data || [])
				.filter((model: any) => model?.id && RemoteCatalogService.isLikelyChatModel(model.id))
				.map((model: any) => ({
					id: model.id,
					name: model.name,
					description: model.description,
					contextWindow: model.context_length,
					supportsVision: model.architecture?.modalities?.includes('image'),
					supportsCode: model.name?.toLowerCase().includes('code') || model.name?.toLowerCase().includes('coder'),
					cost: model.pricing ? {
						input: model.pricing.prompt || 0,
						output: model.pricing.completion || 0,
					} : undefined,
				}));
		} catch (error) {
			console.error('Failed to fetch OpenRouter catalog:', error);
			return [];
		}
	}

	async healthCheck(providerName: ProviderName, modelId: string): Promise<boolean> {
		// Simple health check: try to make a minimal API call
		// This is a placeholder - actual implementation would vary by provider
		try {
			// For now, assume models are healthy if they're in the catalog
			const catalog = await this.fetchCatalog(providerName);
			return catalog.some(m => m.id === modelId && !m.deprecated);
		} catch {
			return false;
		}
	}

	clearCache(providerName: ProviderName): void {
		this.cache.delete(providerName);
	}
}

export const IRemoteCatalogService = createDecorator<IRemoteCatalogService>('RemoteCatalogService');

registerSingleton(IRemoteCatalogService, RemoteCatalogService, InstantiationType.Delayed);

