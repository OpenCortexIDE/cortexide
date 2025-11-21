/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProviderName, ModelSelection, localProviderNames } from './cortexideSettingsTypes.js';
import { getModelCapabilities, CortexideStaticModelInfo } from './modelCapabilities.js';
import { ICortexideSettingsService, CortexideSettingsState } from './cortexideSettingsService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { RoutingEvaluationService } from './routingEvaluation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { shouldUseSpeculativeEscalation } from './routingEscalation.js';
import { getPerformanceHarness } from './performanceHarness.js';

/**
 * Task types for automatic model selection
 */
export type TaskType = 'chat' | 'code' | 'vision' | 'pdf' | 'web_search' | 'eval' | 'general';

/**
 * Task context for routing decisions
 */
export interface TaskContext {
	taskType: TaskType;
	hasImages?: boolean;
	hasPDFs?: boolean;
	hasCode?: boolean;
	contextSize?: number; // estimated tokens
	requiresPrivacy?: boolean; // offline/local only
	preferLowLatency?: boolean;
	preferLowCost?: boolean;
	userOverride?: ModelSelection | null; // user explicitly selected model
	requiresComplexReasoning?: boolean; // complex analysis/reasoning tasks
	isLongMessage?: boolean; // message length indicates complexity
	// Additional task-specific flags
	isDebuggingTask?: boolean; // debugging/error fixing
	isCodeReviewTask?: boolean; // code review/refactoring
	isTestingTask?: boolean; // testing tasks
	isDocumentationTask?: boolean; // documentation tasks
	isPerformanceTask?: boolean; // performance optimization
	isSecurityTask?: boolean; // security-related tasks
	isSimpleQuestion?: boolean; // simple/quick questions
	isMathTask?: boolean; // mathematical/computational tasks
	isMultiLanguageTask?: boolean; // multi-language codebases
	isMultiStepTask?: boolean; // complex multi-step tasks
}

/**
 * Quality tier for pre-flight routing decision
 */
export type QualityTier = 'cheap_fast' | 'standard' | 'escalate' | 'abstain';

/**
 * Routing decision with explanation
 */
export interface RoutingDecision {
	modelSelection: ModelSelection;
	confidence: number; // 0-1
	reasoning: string;
	fallbackChain?: ModelSelection[]; // ordered list of fallbacks
	qualityTier?: QualityTier; // pre-flight quality estimate
	shouldAbstain?: boolean; // true if should ask for clarification
	abstainReason?: string; // reason for abstaining
	timeoutMs?: number; // per-model timeout in milliseconds
}

export interface ITaskAwareModelRouter {
	readonly _serviceBrand: undefined;
	route(context: TaskContext): Promise<RoutingDecision>;
	getQualityReport(): import('./routingEvaluation.js').RoutingQualityReport;
	getRoutingExplanation(context: TaskContext): Promise<string>;
}

export const ITaskAwareModelRouter = createDecorator<ITaskAwareModelRouter>('TaskAwareModelRouter');

/**
 * Task-aware model router
 * Selects appropriate models based on task type, attachments, privacy, cost, and latency requirements
 */
export class TaskAwareModelRouter extends Disposable implements ITaskAwareModelRouter {
	readonly _serviceBrand: undefined;

	private readonly evaluationService: RoutingEvaluationService;
	// Cache capability lookups to avoid repeated expensive calls
	private readonly capabilityCache: Map<string, ReturnType<typeof getModelCapabilities>> = new Map();
	private capabilityCacheVersion: number = 0; // Increment to invalidate cache

	constructor(
		@ICortexideSettingsService private readonly settingsService: ICortexideSettingsService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
		this.evaluationService = new RoutingEvaluationService(this.storageService);
		// Invalidate cache when settings change
		this._register(this.settingsService.onDidChangeState(() => {
			this.capabilityCache.clear();
			this.capabilityCacheVersion++;
		}));
	}

	/**
	 * Get cached model capabilities (with fallback to lookup)
	 */
	private getCachedCapabilities(
		modelSelection: ModelSelection,
		settingsState: CortexideSettingsState
	): ReturnType<typeof getModelCapabilities> {
		const key = `${modelSelection.providerName}:${modelSelection.modelName}:${this.capabilityCacheVersion}`;
		if (this.capabilityCache.has(key)) {
			return this.capabilityCache.get(key)!;
		}
		const capabilities = getModelCapabilities(
			modelSelection.providerName as ProviderName,
			modelSelection.modelName,
			settingsState.overridesOfModel
		);
		this.capabilityCache.set(key, capabilities);
		// Limit cache size to prevent memory issues
		if (this.capabilityCache.size > 100) {
			const firstKey = this.capabilityCache.keys().next().value;
			if (firstKey !== undefined) {
				this.capabilityCache.delete(firstKey);
			}
		}
		return capabilities;
	}

	// Cache for common routing decisions (fast path optimization)
	private readonly routingCache: Map<string, { decision: RoutingDecision; timestamp: number }> = new Map();
	private readonly ROUTING_CACHE_TTL_DEFAULT = 2000; // 2 seconds default (configurable via cortexide.perf.routerCacheTtlMs)
	private readonly ROUTING_CACHE_TTL_SIMPLE = 60000; // 60 seconds for simple questions (very stable)

	/**
	 * Route to the best model for a given task context
	 */
	async route(context: TaskContext): Promise<RoutingDecision> {
		const startTime = performance.now();

		// User override always takes precedence
		if (context.userOverride) {
			return {
				modelSelection: context.userOverride,
				confidence: 1.0,
				reasoning: 'User explicitly selected this model',
				qualityTier: 'standard',
			};
		}

		// Fast path: Check cache for identical contexts
		const cacheKey = this.getCacheKey(context);
		const cached = this.routingCache.get(cacheKey);

		// Get configurable cache TTL from settings (default 2000ms)
		const perfSettings = this.settingsService.state.globalSettings.perf;
		const cacheTTLForCheck = context.isSimpleQuestion
			? this.ROUTING_CACHE_TTL_SIMPLE
			: (perfSettings?.routerCacheTtlMs ?? this.ROUTING_CACHE_TTL_DEFAULT);

		if (cached && (Date.now() - cached.timestamp) < cacheTTLForCheck) {
			// Record router metrics (cache hit)
			if (perfSettings?.enable) {
				const harness = getPerformanceHarness(true);
				harness.recordRouter(performance.now() - startTime, true);
			}
			return cached.decision;
		}

		const settingsState = this.settingsService.state;

		// Privacy/offline mode: only local models
		// requiresPrivacy is set only when images/PDFs are present and imageQAAllowRemoteModels is false
		if (context.requiresPrivacy) {
			const decision = this.routeToLocalModel(context);
			this.routingCache.set(cacheKey, { decision, timestamp: Date.now() });
			return decision;
		}

		// Quality gate: pre-flight quality estimate
		const qualityTier = this.estimateQualityTier(context);

		// Check if we should abstain (ask for clarification)
		const abstainCheck = this.shouldAbstain(context);
		if (abstainCheck.shouldAbstain) {
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' }, // Placeholder
				confidence: 0.0,
				reasoning: abstainCheck.reason || 'Request needs clarification',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: abstainCheck.reason || 'Request needs clarification',
			};
		}

		// Get all available models
		const availableModels = this.getAvailableModels(settingsState);

		// Validate that we have at least one model available
		if (availableModels.length === 0) {
			console.error('[ModelRouter] ERROR: No models available for routing. All providers may be disabled or misconfigured.');
			// Return a decision that indicates failure (will be caught by caller)
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' }, // Placeholder to indicate failure
				confidence: 0.0,
				reasoning: 'No models available. Please configure at least one model provider in settings.',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: 'No models available. Please configure at least one model provider in settings.',
			};
		}

		// Check if online models are available (for codebase questions, we strongly prefer online models)
		const hasOnlineModels = availableModels.some(m => {
			if (m.providerName === 'auto') { return false; }
			return !(localProviderNames as readonly ProviderName[]).includes(m.providerName as ProviderName);
		});

		// Debug: Log available models for codebase questions
		const isCodebaseQuestionCheck = (context.requiresComplexReasoning && context.taskType === 'code' && !context.hasCode) ||
			(context.contextSize && context.contextSize > 15000) ||
			(context.taskType === 'code' && context.isLongMessage && !context.hasCode);
		if (isCodebaseQuestionCheck) {
			const onlineModels = availableModels.filter(m => {
				if (m.providerName === 'auto') { return false; }
				return !(localProviderNames as readonly ProviderName[]).includes(m.providerName as ProviderName);
			});
			const localModels = availableModels.filter(m => {
				if (m.providerName === 'auto') { return false; }
				return (localProviderNames as readonly ProviderName[]).includes(m.providerName as ProviderName);
			});
			console.log('[ModelRouter] Codebase question detected:', {
				hasOnlineModels,
				onlineModelCount: onlineModels.length,
				onlineModels: onlineModels.map(m => `${m.providerName}/${m.modelName}`),
				localModelCount: localModels.length,
				localModels: localModels.map(m => `${m.providerName}/${m.modelName}`),
				contextSize: context.contextSize,
				requiresComplexReasoning: context.requiresComplexReasoning,
			});
		}

		// Fast path: For simple questions without special requirements, use quick heuristic
		// EXPANDED: Also handle simple questions with code (just code snippets, not codebase questions)
		if (context.isSimpleQuestion && !context.hasImages && !context.hasPDFs && !context.requiresComplexReasoning && !context.contextSize) {
			// Quick heuristic: prefer fast online models for simple questions
			const fastModels = availableModels.filter(m => {
				if (m.providerName === 'auto') { return false; }
				const name = m.modelName.toLowerCase();
				return name.includes('mini') || name.includes('haiku') || name.includes('flash') || name.includes('nano') || name.includes('3.5-turbo');
			});
			if (fastModels.length > 0) {
				const selected = fastModels[0]; // Just pick first fast model
				const timeoutMs = this.getModelTimeout(selected, context, settingsState);
				const decision: RoutingDecision = {
					modelSelection: selected,
					confidence: 0.8,
					reasoning: 'Fast path: simple question → fast model',
					qualityTier: 'cheap_fast',
					timeoutMs,
				};
				// Cache fast path decisions longer (they're very stable)
				this.routingCache.set(cacheKey, { decision, timestamp: Date.now() });
				return decision;
			}
		}

		// Ultra-fast path: Vision tasks → vision model (skip all scoring)
		if ((context.taskType === 'vision' || context.hasImages) && !context.requiresComplexReasoning && !context.contextSize) {
			const visionModels = availableModels.filter(m => {
				if (m.providerName === 'auto') { return false; }
				const capabilities = this.getCachedCapabilities(m, settingsState);
				return this.isVisionCapable(m, capabilities);
			});
			if (visionModels.length > 0) {
				// Prefer fast vision models (haiku, flash, etc.)
				const fastVision = visionModels.find(m => {
					const name = m.modelName.toLowerCase();
					return name.includes('haiku') || name.includes('flash') || name.includes('mini');
				}) || visionModels[0];
				const timeoutMs = this.getModelTimeout(fastVision, context, settingsState);
				const decision: RoutingDecision = {
					modelSelection: fastVision,
					confidence: 0.85,
					reasoning: 'Ultra-fast path: vision task → vision model',
					qualityTier: 'standard',
					timeoutMs,
				};
				this.routingCache.set(cacheKey, { decision, timestamp: Date.now() });
				return decision;
			}
		}

		// Pre-filter models based on hard requirements (vision, context size) before expensive scoring
		let candidateModels = availableModels;

		// For codebase questions: STRONGLY prefer online models - filter out local models if online models exist
		// Detect codebase questions: complex reasoning + code task without code blocks, OR explicit context size requirement
		const isCodebaseQuestionForFilter = (context.requiresComplexReasoning && context.taskType === 'code' && !context.hasCode) ||
			(context.contextSize && context.contextSize > 15000) ||
			(context.taskType === 'code' && context.isLongMessage && !context.hasCode);

		if (isCodebaseQuestionForFilter && hasOnlineModels) {
			// For codebase questions with online models available, ONLY consider online models
			// This ensures we never select local models for codebase questions when better options exist
			const beforeFilter = candidateModels.length;
			candidateModels = candidateModels.filter(model => {
				if (model.providerName === 'auto') { return false; }
				const isLocal = (localProviderNames as readonly ProviderName[]).includes(model.providerName as ProviderName);
				return !isLocal;
			});
			const afterFilter = candidateModels.length;

			// Debug logging
			console.log('[ModelRouter] Filtering local models for codebase question:', {
				beforeFilter,
				afterFilter,
				filteredOut: beforeFilter - afterFilter,
				remainingModels: candidateModels.map(m => `${m.providerName}/${m.modelName}`),
			});

			// If filtering removed all models (shouldn't happen if hasOnlineModels is true), fall back
			if (candidateModels.length === 0) {
				console.error('[ModelRouter] ERROR: Filtering removed all models despite hasOnlineModels=true!', {
					hasOnlineModels,
					availableModels: availableModels.map(m => `${m.providerName}/${m.modelName}`),
				});
				candidateModels = availableModels; // Fallback to all models
			}
		}

		// Filter by vision requirement
		if (context.taskType === 'vision' || context.hasImages || context.taskType === 'pdf' || context.hasPDFs) {
			candidateModels = candidateModels.filter(model => {
				if (model.providerName === 'auto') { return false; }
				const capabilities = this.getCachedCapabilities(model, settingsState);
				return this.isVisionCapable(model, capabilities);
			});
			// If no vision-capable models, fall back to all models (will be penalized in scoring)
			if (candidateModels.length === 0) {
				candidateModels = availableModels;
			}
		}

		// Filter by context size requirement
		if (context.contextSize) {
			const requiredContextSize = context.contextSize; // Narrow type for TypeScript
			candidateModels = candidateModels.filter(model => {
				if (model.providerName === 'auto') { return false; }
				const capabilities = this.getCachedCapabilities(model, settingsState);
				const availableContext = capabilities.contextWindow - (capabilities.reservedOutputTokenSpace || 4096);
				return availableContext >= requiredContextSize;
			});
			// If no models meet context requirement, fall back to all (will be penalized)
			if (candidateModels.length === 0) {
				candidateModels = availableModels;
			}
		}

		// Score and rank models using mixture policy (rules + learned)
		// Only score candidate models to reduce overhead
		// PERFORMANCE: Batch capability lookups to reduce overhead
		const scored = candidateModels.map(model => {
			const ruleScore = this.scoreModel(model, context, settingsState, hasOnlineModels);
			const learnedScore = this.getLearnedScore(model, context);
			const finalScore = ruleScore * 0.7 + learnedScore * 0.3; // 70% rules, 30% learned
			return {
				model,
				score: finalScore,
				ruleScore,
				learnedScore,
			};
		});

		// PERFORMANCE: Early exit if we have a very high confidence model
		// Sort first to find best quickly
		scored.sort((a, b) => b.score - a.score);
		if (scored.length > 0 && scored[0].score > 80) {
			// Very high confidence - use it immediately without further processing
			const best = scored[0];
			const timeoutMs = this.getModelTimeout(best.model, context, settingsState);
			const decision = {
				modelSelection: best.model,
				confidence: Math.min(1.0, best.score / 100),
				reasoning: this.generateReasoning(best.model, context, best.score, settingsState),
				qualityTier,
				timeoutMs,
			};
			this.routingCache.set(cacheKey, { decision, timestamp: Date.now() });
			return decision;
		}

		// Already sorted above for early exit optimization

		// Debug: Log top 3 models for codebase questions
		if (isCodebaseQuestionCheck && scored.length > 0) {
			console.log('[ModelRouter] Top models after scoring:', scored.slice(0, 3).map(s => ({
				model: `${s.model.providerName}/${s.model.modelName}`,
				score: s.score,
				ruleScore: s.ruleScore,
				learnedScore: s.learnedScore,
			})));
		}

		if (scored.length === 0) {
			console.error('[ModelRouter] ERROR: No models passed scoring. This should not happen if models are available.');
			// Fallback: try local models even if privacy not required
			const localFallback = this.routeToLocalModel(context);
			// If local fallback also fails, return error indication
			if (localFallback.modelSelection.providerName === 'auto' && localFallback.modelSelection.modelName === 'auto') {
				return {
					modelSelection: { providerName: 'auto', modelName: 'auto' }, // Placeholder to indicate failure
					confidence: 0.0,
					reasoning: 'No suitable models found. Please configure at least one model provider in settings.',
					qualityTier: 'abstain',
					shouldAbstain: true,
					abstainReason: 'No suitable models found. Please configure at least one model provider in settings.',
				};
			}
			return localFallback;
		}

		const best = scored[0];
		const fallbackChain = scored.slice(1, 4).map(s => s.model); // top 3 fallbacks

		// Determine timeout based on model and task
		const timeoutMs = this.getModelTimeout(best.model, context, settingsState);

		const confidence = Math.min(1.0, best.score / 100);

		// Check if we should use speculative escalation
		const useSpeculativeEscalation = shouldUseSpeculativeEscalation(confidence, qualityTier);

		// If using speculative escalation, prefer a fast/cheap model first
		let finalModel = best.model;
		if (useSpeculativeEscalation && fallbackChain.length > 0) {
			// Find a fast/cheap model in the fallback chain
			const fastModel = this.findFastCheapModel(fallbackChain, settingsState);
			if (fastModel) {
				// Use fast model first, with best model as escalation target
				finalModel = fastModel;
				// Note: The escalation logic will be handled in chatThreadService
				// by monitoring early tokens and switching if needed
			}
		}

		// Safety check: ensure we never return 'auto' as a model selection
		// (This should never happen due to filtering, but add safeguard)
		if (finalModel.providerName === 'auto' && finalModel.modelName === 'auto') {
			// This should never happen, but if it does, try to find any available model
			console.error('[ModelRouter] ERROR: Attempted to return "auto" model selection. This indicates a bug in routing logic.');
			// Try local models as fallback
			const localFallback = this.routeToLocalModel(context);
			// If local fallback also returns invalid, return error indication
			if (localFallback.modelSelection.providerName === 'auto' && localFallback.modelSelection.modelName === 'auto') {
				return {
					modelSelection: { providerName: 'auto', modelName: 'auto' }, // Placeholder to indicate failure
					confidence: 0.0,
					reasoning: 'Routing failed: No valid models found. Please configure at least one model provider.',
					qualityTier: 'abstain',
					shouldAbstain: true,
					abstainReason: 'Routing failed: No valid models found. Please configure at least one model provider.',
				};
			}
			return localFallback;
		}

		// Record routing decision for evaluation
		this.evaluationService.recordOutcome({
			timestamp: startTime,
			modelSelection: finalModel,
			taskType: context.taskType,
			confidence,
		});

		const reasoning = this.generateReasoning(finalModel, context, best.score, settingsState);

		// Debug: Warn if local model selected for codebase question when online models available
		// Detect codebase questions: complex reasoning + code task without code blocks, OR explicit context size requirement
		const isCodebaseQuestionForDebug = (context.requiresComplexReasoning && context.taskType === 'code' && !context.hasCode) ||
			(context.contextSize && context.contextSize > 15000) ||
			(context.taskType === 'code' && context.isLongMessage && !context.hasCode);

		if (isCodebaseQuestionForDebug) {
			const isLocal = (localProviderNames as readonly ProviderName[]).includes(finalModel.providerName as ProviderName);
			if (isLocal && hasOnlineModels) {
				console.warn('[ModelRouter] WARNING: Selected local model for codebase question despite online models available!', {
					selectedModel: finalModel,
					hasOnlineModels,
					reasoning,
					score: best.score,
				});
			}
		}

		const decision = {
			modelSelection: finalModel,
			confidence,
			reasoning,
			fallbackChain: useSpeculativeEscalation && finalModel !== best.model
				? [best.model, ...fallbackChain.filter(m => m !== finalModel)]
				: fallbackChain,
			qualityTier,
			timeoutMs,
		};

		// Record router metrics (cache miss)
		const routerTime = performance.now() - startTime;
		if (perfSettings?.enable) {
			const harness = getPerformanceHarness(true);
			harness.recordRouter(routerTime, false);
		}

		// Cache the decision for fast path on similar requests
		const finalCacheKey = this.getCacheKey(context);
		this.routingCache.set(finalCacheKey, { decision, timestamp: Date.now() });

		// Clean up old cache entries (keep cache size reasonable)
		const cacheTTLForCleanup = perfSettings?.routerCacheTtlMs ?? this.ROUTING_CACHE_TTL_DEFAULT;
		if (this.routingCache.size > 50) {
			const now = Date.now();
			for (const [key, value] of this.routingCache.entries()) {
				if ((now - value.timestamp) >= cacheTTLForCleanup) {
					this.routingCache.delete(key);
				}
			}
		}

		return decision;
	}

	/**
	 * Generate cache key from context (for fast path routing)
	 */
	private getCacheKey(context: TaskContext): string {
		// Create a simple key from context properties that affect routing
		const parts = [
			context.taskType || 'unknown',
			context.hasImages ? 'img' : 'no-img',
			context.hasPDFs ? 'pdf' : 'no-pdf',
			context.hasCode ? 'code' : 'no-code',
			context.requiresPrivacy ? 'private' : 'public',
			context.requiresComplexReasoning ? 'complex' : 'simple',
			context.isSimpleQuestion ? 'simple-q' : 'not-simple',
			context.preferLowLatency ? 'low-lat' : 'normal',
			context.contextSize ? `ctx-${Math.floor(context.contextSize / 1000)}k` : 'no-ctx',
		];
		return parts.join('|');
	}

	/**
	 * Find a fast/cheap model suitable for speculative escalation
	 */
	private findFastCheapModel(
		models: ModelSelection[],
		settingsState: CortexideSettingsState
	): ModelSelection | null {
		// Filter out 'auto' provider
		const validModels = models.filter(m => m.providerName !== 'auto');

		for (const model of validModels) {
			const capabilities = this.getCachedCapabilities(model, settingsState);
			const name = model.modelName.toLowerCase();

			// Prefer fast models (mini, haiku, flash, nano)
			if (name.includes('mini') || name.includes('haiku') || name.includes('flash') || name.includes('nano')) {
				// Also check if it's cheap
				const costPerM = (capabilities.cost.input + capabilities.cost.output) / 2;
				if (costPerM < 5) { // Reasonable cost threshold
					return model;
				}
			}
		}

		// If no fast model found, return first cheap model
		for (const model of validModels) {
			const capabilities = this.getCachedCapabilities(model, settingsState);
			const costPerM = (capabilities.cost.input + capabilities.cost.output) / 2;
			if (costPerM < 2) {
				return model;
			}
		}

		return null;
	}

	/**
	 * Estimate quality tier for pre-flight routing decision
	 */
	private estimateQualityTier(context: TaskContext): QualityTier {
		// Simple questions can use cheap/fast models
		if (context.isSimpleQuestion && !context.requiresComplexReasoning && !context.hasImages && !context.hasPDFs) {
			return 'cheap_fast';
		}

		// Complex tasks need escalation
		if (context.requiresComplexReasoning ||
			context.isMultiStepTask ||
			(context.contextSize && context.contextSize > 100_000) ||
			context.isSecurityTask) {
			return 'escalate';
		}

		// Default to standard
		return 'standard';
	}

	/**
	 * Check if we should abstain and ask for clarification
	 */
	private shouldAbstain(context: TaskContext): { shouldAbstain: boolean; reason?: string } {
		// Don't abstain for PDF tasks - PDFs can be processed via text extraction even without specific pages
		// The model router will select an appropriate model (vision-capable if available, otherwise text-only)
		// Users should be able to ask general questions about PDFs without specifying pages

		// If vision task with multiple images but vague request
		if (context.taskType === 'vision' && context.hasImages && !context.contextSize) {
			// Only abstain if it's a complex vision task
			if (context.requiresComplexReasoning) {
				return {
					shouldAbstain: true,
					reason: 'Complex vision task detected. Please specify what you want to analyze in the image(s).',
				};
			}
		}

		// Codebase questions: Don't abstain - the router can handle them
		// Codebase questions are detected in chatThreadService and contextSize is set appropriately
		// Even if contextSize isn't set, the router will still select an appropriate model
		// Abstaining here would prevent valid codebase questions from being answered
		// (Removed the abstain check for codebase questions - they should always proceed to routing)

		return { shouldAbstain: false };
	}

	/**
	 * Get learned score based on historical success
	 */
	private getLearnedScore(model: ModelSelection, context: TaskContext): number {
		const successRate = this.evaluationService.getModelSuccessRate(model);
		// Convert success rate (0-1) to score (0-100)
		// Success rate of 0.5 (neutral) = score of 50
		// Success rate of 1.0 (perfect) = score of 100
		// Success rate of 0.0 (failure) = score of 0
		return successRate * 100;
	}

	/**
	 * Get per-model timeout based on task and model characteristics
	 */
	private getModelTimeout(model: ModelSelection, context: TaskContext, settingsState: CortexideSettingsState): number {
		// Skip 'auto' provider
		if (model.providerName === 'auto') {
			return 60_000; // Default timeout
		}

		const capabilities = this.getCachedCapabilities(model, settingsState);

		const name = model.modelName.toLowerCase();
		const isLocal = (localProviderNames as readonly ProviderName[]).includes(model.providerName as ProviderName);

		// Base timeout: 30s for local, 60s for online
		let timeout = isLocal ? 30_000 : 60_000;

		// Increase timeout for complex tasks
		if (context.requiresComplexReasoning || context.isMultiStepTask) {
			timeout *= 1.5;
		}

		// Increase timeout for large context
		if (context.contextSize && context.contextSize > 100_000) {
			timeout *= 1.5;
		}

		// Increase timeout for reasoning models (they take longer)
		if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
			timeout *= 1.5;
		}

		// Decrease timeout for fast models
		if (name.includes('mini') || name.includes('fast') || name.includes('haiku') || name.includes('flash')) {
			timeout *= 0.7;
		}

		return Math.round(timeout);
	}

	/**
	 * Get routing quality report
	 */
	getQualityReport(): import('./routingEvaluation.js').RoutingQualityReport {
		return this.evaluationService.getQualityReport();
	}

	/**
	 * Get human-readable explanation for why a model would be selected
	 * Useful for UI tooltips and "Why this model" displays
	 */
	async getRoutingExplanation(context: TaskContext): Promise<string> {
		const decision = await this.route(context);

		if (decision.shouldAbstain && decision.abstainReason) {
			return decision.abstainReason;
		}

		const parts: string[] = [];

		// Add task type
		parts.push(`Task: ${context.taskType}`);

		// Add key context
		if (context.hasImages) { parts.push('with images'); }
		if (context.hasPDFs) { parts.push('with PDFs'); }
		if (context.hasCode) { parts.push('with code'); }
		if (context.requiresComplexReasoning) { parts.push('complex reasoning'); }
		if (context.contextSize) { parts.push(`~${Math.round(context.contextSize / 1000)}k tokens`); }

		// Add quality tier
		if (decision.qualityTier) {
			parts.push(`quality tier: ${decision.qualityTier}`);
		}

		// Add confidence
		parts.push(`confidence: ${(decision.confidence * 100).toFixed(0)}%`);

		// Add reasoning
		parts.push(`→ ${decision.reasoning}`);

		return parts.join(' | ');
	}

	/**
	 * Get all available models from settings
	 */
	private getAvailableModels(settingsState: CortexideSettingsState): ModelSelection[] {
		const models: ModelSelection[] = [];

		for (const providerName of Object.keys(settingsState.settingsOfProvider) as ProviderName[]) {
			const providerSettings = settingsState.settingsOfProvider[providerName];
			if (!providerSettings._didFillInProviderSettings) { continue; }

			for (const modelInfo of providerSettings.models) {
				if (!modelInfo.isHidden) {
					models.push({
						providerName,
						modelName: modelInfo.modelName,
					});
				}
			}
		}

		return models;
	}

	/**
	 * Score a model for the given task context
	 * Prioritizes quality and task-specific capabilities over just being online
	 */
	private scoreModel(
		modelSelection: ModelSelection,
		context: TaskContext,
		settingsState: CortexideSettingsState,
		hasOnlineModels: boolean = false
	): number {
		// Skip "auto" - it's not a real model
		if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') {
			return 0;
		}

		const capabilities = this.getCachedCapabilities(modelSelection, settingsState);

		const name = modelSelection.modelName.toLowerCase();
		const provider = modelSelection.providerName.toLowerCase();
		const isLocal = (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);

		let score = 0; // Start from 0, build up based on quality and fit

		// ===== QUALITY TIER SCORING (Primary Factor) =====
		// Prefer high-quality models for better responses
		// Tier 1: Top-tier models (Claude 3.5/4, GPT-4, Gemini Pro)
		if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
			score += 50;
		} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1') || name.includes('gpt-4'))) {
			score += 50;
		} else if (provider === 'gemini' && (name.includes('pro') || name.includes('ultra'))) {
			score += 45;
		}
		// Tier 2: Good quality models (Claude 3, GPT-3.5-turbo, Gemini Flash)
		else if (provider === 'anthropic' && name.includes('3')) {
			score += 35;
		} else if (provider === 'openai' && (name.includes('3.5') || name.includes('turbo'))) {
			score += 35;
		} else if (provider === 'gemini' && name.includes('flash')) {
			score += 30;
		}
		// Tier 3: Other online models
		else if (!isLocal) {
			score += 20;
		}
		// Tier 4: Local models (baseline, can be boosted by capabilities)
		else {
			score += 10;
		}

		// ===== TASK-SPECIFIC LOCAL MODEL PENALTIES =====
		// Local models struggle with many tasks - apply penalties to prefer online models

		// Vision tasks: Local VLMs are often weaker than online models
		if ((context.taskType === 'vision' || context.hasImages) && isLocal) {
			score -= 30; // Strong penalty - prefer online vision models
		}

		// PDF tasks: Complex document understanding needs better models
		if ((context.taskType === 'pdf' || context.hasPDFs) && isLocal) {
			score -= 35; // Strong penalty - PDF analysis requires sophisticated understanding
		}

		// Complex reasoning tasks: Local models often lack depth
		if (context.requiresComplexReasoning && isLocal) {
			score -= 40; // Very strong penalty - complex reasoning needs high-quality models
		}

		// Long messages: Often indicate complex tasks that need better models
		if (context.isLongMessage && isLocal) {
			score -= 20; // Penalty for local models on long/complex queries
		}

		// Web search tasks: Require tool support and up-to-date knowledge
		if (context.taskType === 'web_search' && isLocal) {
			score -= 50; // Very strong penalty - local models can't do web search
		}

		// General chat: Strongly prefer online models for better UX (speed + quality)
		if (context.taskType === 'chat' && !context.requiresComplexReasoning && !context.isLongMessage) {
			// Simple chat: Strongly prefer fast online models over slow local models
			if (isLocal) {
				// Check if it's a slow local model
				const isSlowLocalModel = name.includes('13b') ||
					name.includes('70b') ||
					name.includes('llama3') && !name.includes('8b') ||
					name.includes('mistral') && !name.includes('7b') ||
					name.includes('mixtral');

				if (isSlowLocalModel) {
					score -= 50; // Very strong penalty for slow local models on simple chat
				} else {
					score -= 20; // Moderate penalty for local models - prefer online for speed
				}
			} else {
				// Bonus for fast online models on simple chat
				if (name.includes('mini') || name.includes('haiku') || name.includes('flash') || name.includes('nano')) {
					score += 30; // Strong bonus for fast online models
				} else if (name.includes('turbo') && !name.includes('4')) {
					score += 20; // Bonus for turbo models
				}
			}
		} else if (context.taskType === 'chat') {
			// Complex chat needs better models
			if (isLocal) {
				score -= 25;
			}
		}

		// ===== TASK-SPECIFIC REQUIREMENTS (Critical - Must Match) =====

		// Vision/PDF tasks: MUST have vision capability
		if (context.taskType === 'vision' || context.hasImages || context.taskType === 'pdf' || context.hasPDFs) {
			const visionCapable = this.isVisionCapable(modelSelection, capabilities);
			if (visionCapable) {
				score += 40; // Strong bonus for vision-capable models
			} else {
				score -= 100; // Heavy penalty - disqualify non-vision models
			}
		}

		// Code tasks: Prefer FIM and code-tuned models
		// Note: Some local code models (like DeepSeek, Qwen) are actually quite good
		// So we apply a smaller penalty here compared to other tasks
		if (context.taskType === 'code' || context.hasCode) {
			// Codebase questions need large context and good reasoning - prioritize accordingly
			// Detect codebase questions: complex reasoning + code task without code blocks, OR explicit context size requirement
			const isCodebaseQuestion = (context.requiresComplexReasoning && context.taskType === 'code' && !context.hasCode) ||
				(context.contextSize && context.contextSize > 15000) || // High context requirement suggests codebase question
				(context.taskType === 'code' && context.isLongMessage && !context.hasCode);

			if (isCodebaseQuestion) {
				// Codebase questions: prioritize large context windows and reasoning
				// Context window scoring (most important for codebase questions)
				if (capabilities.contextWindow >= 200_000) {
					score += 50; // Very large context is critical for codebase understanding
				} else if (capabilities.contextWindow >= 128_000) {
					score += 40; // Large context helps understand entire codebase
				} else if (capabilities.contextWindow >= 64_000) {
					score += 25; // Good context is helpful
				} else if (capabilities.contextWindow >= 32_000) {
					score += 10; // Moderate context is acceptable but not ideal
				} else {
					score -= 30; // Small context models struggle significantly with codebase questions
				}

				// Check if model meets context size requirement
				if (context.contextSize) {
					const availableContext = capabilities.contextWindow - (capabilities.reservedOutputTokenSpace || 4096);
					if (availableContext >= context.contextSize) {
						score += 30; // Strong bonus for meeting context requirement
					} else if (availableContext >= context.contextSize * 0.8) {
						score += 15; // Partial credit if close
					} else {
						score -= 50; // Heavy penalty if insufficient context
					}
				}

				// Reasoning capabilities are crucial for codebase analysis
				if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
					score += 30; // Strong bonus for reasoning models on codebase questions
					if (capabilities.reasoningCapabilities.canIOReasoning) {
						score += 15; // Extra bonus for models that output reasoning (helps with complex analysis)
					}
				}

				// Prefer high-quality models for codebase understanding
				// Top-tier models (Claude 3.5/4, GPT-4) are much better at codebase analysis
				if (provider === 'anthropic') {
					if (name.includes('4') || name.includes('opus')) {
						score += 30; // Claude 4/Opus - best for codebase analysis
					} else if (name.includes('3.5') || name.includes('sonnet')) {
						score += 25; // Claude 3.5 Sonnet - excellent for codebase
					} else if (name.includes('3')) {
						score += 15; // Claude 3 - good but not as strong
					}
				} else if (provider === 'openai') {
					if (name.includes('4o') || name.includes('4.1')) {
						score += 30; // GPT-4o/4.1 - best OpenAI models for codebase
					} else if (name.includes('gpt-4') && !name.includes('turbo')) {
						score += 25; // GPT-4 - excellent for codebase
					} else if (name.includes('4')) {
						score += 20; // Other GPT-4 variants
					}
				} else if (provider === 'gemini') {
					if (name.includes('pro') || name.includes('ultra')) {
						score += 20; // Gemini Pro/Ultra - good for codebase
					}
				}

				// System message support is valuable for structured codebase analysis
				if (capabilities.supportsSystemMessage) {
					score += 10; // Bonus for system message support
				}

				// Local models struggle more with codebase questions (need to understand many files)
				if (isLocal) {
					// If online models are available, strongly prefer them for codebase questions
					if (hasOnlineModels) {
						score -= 100; // Very strong penalty - online models should be used for codebase questions when available
					} else {
						score -= 35; // Moderate penalty if no online models available (still use local as fallback)
					}
				}
			} else {
				// Regular code tasks (writing/editing code, implementation tasks)
				// Implementation tasks need good code generation, not just large context

				// FIM (Fill-in-Middle) is very valuable for code editing
				if (capabilities.supportsFIM) {
					score += 30; // FIM is very valuable for code
				}

				// Code-tuned models are excellent for implementation
				if (name.includes('code') || name.includes('coder') || name.includes('devstral') || name.includes('codestral')) {
					score += 25; // Increased bonus for code-tuned models on implementation tasks
				}

				// High-quality models are better at code generation
				// Claude models are particularly good at understanding requirements and generating code
				if (provider === 'anthropic') {
					if (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet')) {
						score += 20; // Claude 3.5/4 are excellent for implementation
					} else if (name.includes('3')) {
						score += 15; // Claude 3 is good too
					}
				} else if (provider === 'openai') {
					if (name.includes('4o') || name.includes('4.1') || name.includes('gpt-4') && !name.includes('turbo')) {
						score += 18; // GPT-4 models are good for implementation
					}
				} else if (provider === 'gemini') {
					if (name.includes('pro') || name.includes('ultra')) {
						score += 15; // Gemini Pro/Ultra are good for code generation
					}
				}

				// Reasoning helps with complex implementations
				if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
					score += 12; // Reasoning helps understand requirements and plan implementation
				}

				// System message support helps with structured code generation
				if (capabilities.supportsSystemMessage) {
					score += 8; // System messages help guide code generation
				}

				// Local code models can be decent for simple tasks, but online models are generally better
				// Apply a moderate penalty (less than vision/PDF/reasoning)
				if (isLocal) {
					score -= 15; // Moderate penalty - online code models are often better for implementation
				}
			}
		}

		// Context size matching (critical - models must have enough context)
		if (context.contextSize) {
			const availableContext = capabilities.contextWindow - (capabilities.reservedOutputTokenSpace || 4096);
			if (availableContext >= context.contextSize) {
				score += 20; // Bonus for sufficient context
			} else {
				score -= 100; // Heavy penalty - disqualify if insufficient context
			}
		} else {
			// Estimate context needs for complex tasks
			// Complex reasoning, long messages, PDFs, and vision tasks often need larger context
			if (context.requiresComplexReasoning || context.isLongMessage || context.hasPDFs || context.hasImages) {
				// Prefer models with larger context windows for complex tasks
				if (capabilities.contextWindow >= 200_000) {
					score += 15; // Very large context is valuable for complex tasks
				} else if (capabilities.contextWindow >= 128_000) {
					score += 10; // Large context helps with complex tasks
				} else if (capabilities.contextWindow < 32_000 && isLocal) {
					// Small context local models struggle with complex tasks
					score -= 10;
				}
			}
		}

		// ===== CAPABILITY-BASED SCORING =====

		// Large context window (valuable for complex tasks)
		if (capabilities.contextWindow >= 200_000) {
			score += 15;
		} else if (capabilities.contextWindow >= 128_000) {
			score += 10;
		} else if (capabilities.contextWindow >= 32_000) {
			score += 5;
		}

		// System message support (important for structured tasks)
		if (capabilities.supportsSystemMessage) {
			score += 10;
		}

		// Tool format support (important for agent mode)
		if (capabilities.specialToolFormat) {
			score += 8;
		}

		// Reasoning capabilities (valuable for complex tasks)
		if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
			score += 12;
			if (capabilities.reasoningCapabilities.canIOReasoning) {
				score += 5; // bonus for models that output reasoning
			}
		}

		// ===== COST & LATENCY PREFERENCES (Secondary Factors) =====

		if (context.preferLowCost) {
			const costPerM = (capabilities.cost.input + capabilities.cost.output) / 2;
			if (costPerM === 0) {
				score += 10; // free models
			} else if (costPerM < 1) {
				score += 8;
			} else if (costPerM < 5) {
				score += 5;
			} else if (costPerM < 15) {
				score += 2;
			}
		}

		if (context.preferLowLatency) {
			// Strong preference for fast models when low latency is requested
			// Fast online models: mini, haiku, flash, nano, turbo (lightweight variants)
			if (name.includes('mini') || name.includes('haiku') || name.includes('flash') || name.includes('nano')) {
				score += 50; // Very strong bonus for fast online models (best choice for low latency)
			} else if (name.includes('turbo') && !name.includes('4')) {
				// GPT-3.5-turbo is fast, but GPT-4-turbo is slower
				score += 40; // Strong bonus for fast turbo models
			} else if (isLocal) {
				// Local models: Only give bonus if they're actually fast
				// Fast local models typically have "fast", "small", "tiny", "1b", "3b", "7b" in name
				// Slow local models are usually larger: "13b", "70b", "llama3", "mistral", etc.
				const isFastLocalModel = name.includes('fast') ||
					name.includes('small') ||
					name.includes('tiny') ||
					name.includes('1b') ||
					name.includes('3b') ||
					name.includes('7b') && !name.includes('70b') ||
					name.includes('qwen2.5-0.5b') ||
					name.includes('qwen2.5-1.5b') ||
					name.includes('phi-3-mini') ||
					name.includes('gemma-2b');

				const isSlowLocalModel = name.includes('13b') ||
					name.includes('70b') ||
					name.includes('llama3') && !name.includes('8b') ||
					name.includes('mistral') && !name.includes('7b') ||
					name.includes('mixtral');

				if (isFastLocalModel) {
					score += 25; // Bonus for fast local models
				} else if (isSlowLocalModel) {
					score -= 40; // Heavy penalty for slow local models when low latency is preferred
				} else {
					// Unknown local model - assume moderate speed, small bonus
					score += 10;
				}
			} else {
				// Penalize slow online models when low latency is preferred
				if (name.includes('opus') || name.includes('4') || name.includes('ultra')) {
					score -= 30; // Heavy penalty for slow heavy models
				} else if (name.includes('sonnet') || name.includes('3.5')) {
					score -= 15; // Moderate penalty for medium-speed models
				}
			}
		}

		// ===== PRIVACY MODE =====
		// If privacy is required, heavily penalize online models
		if (context.requiresPrivacy && !isLocal) {
			score -= 200; // Disqualify online models in privacy mode
		}

		// ===== ADDITIONAL TASK-SPECIFIC SCORING =====

		// Debugging/Error Fixing Tasks
		if (context.isDebuggingTask) {
			// Need strong reasoning to understand root cause
			if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
				score += 25; // Reasoning capabilities bonus
			}
			// Top-tier models excel at debugging
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 15; // Error analysis capability
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1') || name.includes('gpt-4'))) {
				score += 15;
			}
			// Local models struggle with debugging
			if (isLocal) {
				score -= 30;
			}
		}

		// Code Review/Refactoring Tasks
		if (context.isCodeReviewTask) {
			// Need understanding of code quality principles
			if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
				score += 20; // Reasoning for code quality understanding
			}
			// Claude models excel at code review
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 15; // Code quality understanding
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 12; // GPT-4o good at refactoring
			}
			// Local models struggle with code review
			if (isLocal) {
				score -= 25;
			}
		}

		// Testing Tasks
		if (context.isTestingTask) {
			// Need understanding of testing patterns
			score += 20; // Code generation bonus
			// Testing knowledge - prefer models good at code generation
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 15; // Testing knowledge
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 15;
			}
			// FIM support is valuable for editing existing tests
			if (capabilities.supportsFIM) {
				score += 10;
			}
		}

		// Documentation Tasks
		if (context.isDocumentationTask) {
			// Need good language generation
			score += 20; // Writing quality bonus
			// Claude models excel at writing
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 10; // Documentation understanding
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 8;
			}
			// Documentation can use slightly cheaper models (not as critical as code)
			// This is already handled by preferLowCost preference
		}

		// Performance Optimization Tasks
		if (context.isPerformanceTask) {
			// Need strong reasoning for analysis
			if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
				score += 25; // Reasoning for performance analysis
			}
			// Performance knowledge - prefer high-quality models
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 15; // Performance knowledge
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 15;
			}
			// Local models struggle with performance optimization
			if (isLocal) {
				score -= 30;
			}
		}

		// Security Tasks
		if (context.isSecurityTask) {
			// Need up-to-date security knowledge
			score += 25; // Security knowledge bonus
			// Recent training data - prefer newer models
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 15; // Recent training data
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 15;
			}
			// Security is critical - strongly penalize local/outdated models
			if (isLocal) {
				score -= 40;
			}
		}

		// Simple/Quick Questions
		if (context.isSimpleQuestion) {
			// Can use cheaper/faster models
			const costPerM = (capabilities.cost.input + capabilities.cost.output) / 2;
			if (costPerM === 0) {
				score += 15; // Free models
			} else if (costPerM < 1) {
				score += 12; // Low cost models
			} else if (costPerM < 5) {
				score += 8;
			}
			// Fast models (GPT-3.5-turbo, Claude Haiku, Gemini Flash)
			if (name.includes('mini') || name.includes('fast') || name.includes('haiku') || name.includes('nano') || name.includes('flash') || name.includes('3.5-turbo')) {
				score += 10;
			}
			// Reasoning models are overkill for simple questions
			if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
				score -= 5;
			}
			// Large context not needed
			if (capabilities.contextWindow >= 128_000) {
				score -= 5;
			}
		}

		// Mathematical/Computational Tasks
		if (context.isMathTask) {
			// Some models better at math
			score += 20; // Math capability bonus
			// GPT-4 is good at math
			if (provider === 'openai' && (name.includes('4o') || name.includes('4.1') || name.includes('gpt-4'))) {
				score += 15; // Algorithm understanding
			} else if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 12; // Claude models decent at math
			}
		}

		// Multi-Language Codebases
		if (context.isMultiLanguageTask) {
			// Models good at multiple languages
			score += 15; // Multilingual capability bonus
			// Claude models excellent multilingual
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 10;
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 8; // GPT-4o good multilingual
			}
		}

		// Complex Multi-Step Tasks
		if (context.isMultiStepTask) {
			// Need strong reasoning for planning
			if (capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning) {
				score += 25; // Reasoning for planning
			}
			// Planning capability - prefer high-quality models
			if (provider === 'anthropic' && (name.includes('3.5') || name.includes('4') || name.includes('opus') || name.includes('sonnet'))) {
				score += 15; // Planning capability
			} else if (provider === 'openai' && (name.includes('4o') || name.includes('4.1'))) {
				score += 15;
			}
		}

		return Math.max(0, score); // Ensure non-negative
	}

	/**
	 * Check if a model supports vision/image inputs
	 */
	private isVisionCapable(modelSelection: ModelSelection, capabilities: CortexideStaticModelInfo): boolean {
		const name = modelSelection.modelName.toLowerCase();
		const provider = modelSelection.providerName.toLowerCase();

		// Known vision-capable models
		if (provider === 'gemini') { return true; } // all Gemini models support vision
		if (provider === 'anthropic') {
			return name.includes('3.5') || name.includes('3.7') || name.includes('4') || name.includes('opus') || name.includes('sonnet');
		}
		if (provider === 'openai') {
			return name.includes('4o') || name.includes('4.1') || name.includes('gpt-4');
		}
		if (provider === 'ollama' || provider === 'vllm') {
			return name.includes('llava') || name.includes('bakllava') || name.includes('vision');
		}

		return false;
	}

	/**
	 * Route to a local model (privacy/offline mode)
	 */
	private routeToLocalModel(context: TaskContext): RoutingDecision {
		const settingsState = this.settingsService.state;
		const localModels: ModelSelection[] = [];

		// Collect available local models
		for (const providerName of localProviderNames) {
			const providerSettings = settingsState.settingsOfProvider[providerName];
			if (!providerSettings._didFillInProviderSettings) { continue; }

			for (const modelInfo of providerSettings.models) {
				if (!modelInfo.isHidden) {
					localModels.push({
						providerName,
						modelName: modelInfo.modelName,
					});
				}
			}
		}

		if (localModels.length === 0) {
			// Don't return a hardcoded model that might not exist - return error indication instead
			// This will trigger fallback logic in chatThreadService
			console.error('[ModelRouter] ERROR: No local models available for routeToLocalModel');
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' }, // Placeholder to indicate failure
				confidence: 0.0,
				reasoning: 'No local models available. Please configure a local provider.',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: 'No local models available. Please configure a local provider.',
			};
		}

		// Score local models using mixture policy
		// Note: hasOnlineModels is false here since we're in privacy/offline mode
		const scored = localModels.map(model => {
			const ruleScore = this.scoreModel(model, context, settingsState, false);
			const learnedScore = this.getLearnedScore(model, context);
			const finalScore = ruleScore * 0.7 + learnedScore * 0.3;
			return {
				model,
				score: finalScore,
			};
		});

		scored.sort((a, b) => b.score - a.score);
		const best = scored[0];

		const timeoutMs = this.getModelTimeout(best.model, context, settingsState);

		return {
			modelSelection: best.model,
			confidence: Math.min(1.0, best.score / 100),
			reasoning: `Privacy/offline mode: selected local model ${best.model.modelName}`,
			fallbackChain: scored.slice(1, 3).map(s => s.model),
			qualityTier: 'standard',
			timeoutMs,
		};
	}

	/**
	 * Generate human-readable reasoning for model selection
	 */
	private generateReasoning(
		modelSelection: ModelSelection,
		context: TaskContext,
		score: number,
		settingsState: CortexideSettingsState
	): string {
		// Guard: "auto" is not a real model
		if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') {
			return 'Auto model selection (should not reach here)';
		}

		const parts: string[] = [];
		const capabilities = this.getCachedCapabilities(modelSelection, settingsState);

		// Add capability highlights
		if (capabilities.contextWindow >= 128_000) {
			parts.push('large context');
		}
		if (capabilities.supportsFIM) {
			parts.push('FIM support');
		}
		if (capabilities.reasoningCapabilities && capabilities.reasoningCapabilities.supportsReasoning) {
			parts.push('reasoning');
		}
		if (capabilities.specialToolFormat) {
			parts.push('tool support');
		}

		// Add task type
		if (context.taskType === 'code') {
			parts.push('code task');
		}
		if (context.hasImages) {
			parts.push('image analysis');
		}
		if (context.hasPDFs) {
			parts.push('PDF analysis');
		}
		if (context.requiresComplexReasoning) {
			parts.push('complex reasoning');
		}
		if (context.isLongMessage) {
			parts.push('long message');
		}
		// Add additional task-specific flags
		if (context.isDebuggingTask) {
			parts.push('debugging');
		}
		if (context.isCodeReviewTask) {
			parts.push('code review');
		}
		if (context.isTestingTask) {
			parts.push('testing');
		}
		if (context.isDocumentationTask) {
			parts.push('documentation');
		}
		if (context.isPerformanceTask) {
			parts.push('performance optimization');
		}
		if (context.isSecurityTask) {
			parts.push('security');
		}
		if (context.isSimpleQuestion) {
			parts.push('simple question');
		}
		if (context.isMathTask) {
			parts.push('mathematical');
		}
		if (context.isMultiLanguageTask) {
			parts.push('multi-language');
		}
		if (context.isMultiStepTask) {
			parts.push('multi-step');
		}

		// Add preferences
		if (context.preferLowCost) {
			parts.push('cost-optimized');
		}
		if (context.preferLowLatency) {
			parts.push('low-latency');
		}

		// Add model type (online vs local)
		const isLocal = (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);
		if (!isLocal) {
			parts.push('online model');
		} else {
			parts.push('local model');
		}

		const reason = parts.length > 0 ? parts.join(', ') : 'general task';
		return `Selected ${modelSelection.modelName} (${reason}) - score: ${score.toFixed(1)}`;
	}
}

registerSingleton(ITaskAwareModelRouter, TaskAwareModelRouter, InstantiationType.Delayed);


