/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName, ModelSelection } from './cortexideSettingsTypes.js';
import { getModelCapabilities, CortexideStaticModelInfo } from './modelCapabilities.js';
import { ICortexideSettingsService, CortexideSettingsState } from './cortexideSettingsService.js';
import { localProviderNames } from './cortexideSettingsTypes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { RoutingEvaluationService } from './routingEvaluation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { shouldUseSpeculativeEscalation } from './routingEscalation.js';
import { getPerformanceHarness } from './performanceHarness.js';
import { IFreeTierQuotaService } from './routing/freeTierQuotaService.js';
import { buildFreeTierLadder, pickTopFromLadder } from './routing/freeTierLadder.js';
import { describeFreeTierExhaustion, FreeTierExhaustionResult } from './routing/freeTierExhaustion.js';
import { computeModelScore } from './routing/computeModelScore.js';

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
 * Quality tier for pre-flight routing decision (definition + the pure estimator moved to ./routing/qualityTier.ts)
 */
export type { QualityTier } from './routing/qualityTier.js';
import type { QualityTier } from './routing/qualityTier.js';
import { estimateQualityTier } from './routing/qualityTier.js';

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
	/** Verdict on whether all configured free-tier providers are currently exhausted. */
	getFreeTierExhaustion(): FreeTierExhaustionResult;
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
		@IStorageService private readonly storageService: IStorageService,
		@IFreeTierQuotaService private readonly freeTierQuotaService: IFreeTierQuotaService,
	) {
		super();
		this.evaluationService = new RoutingEvaluationService(this.storageService);
		// Invalidate caches when settings change
		this._register(this.settingsService.onDidChangeState(() => {
			this.capabilityCache.clear();
			this.capabilityCacheVersion++;
			this.routingCache.clear(); // a provider/model/policy change can stale a cached routing decision
		}));
		// a free-tier quota change can stale a cached routing decision (point it at a 429'd provider)
		this._register(this.freeTierQuotaService.onQuotaChange(() => {
			this.routingCache.clear();
		}));
	}

	/**
	 * Get cached model capabilities (with fallback to lookup)
	 */
	private getCachedCapabilities(
		modelSelection: ModelSelection,
		settingsState: any
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

		// PERFORMANCE: Cache settings state lookup (accessed multiple times in this method)
		// Pre-compute config to avoid repeated lookups
		const settingsState = this.settingsService.state;
		const perfSettings = settingsState.globalSettings.perf;
		// migrated from localFirstAI: 'local-only' policy is the canonical signal
		// to bias toward local models. We continue to honour the deprecated
		// `localFirstAI` flag for installs that haven't migrated yet.
		const localFirstAI = (settingsState.globalSettings.routingPolicy === 'local-only')
			|| (settingsState.globalSettings.localFirstAI ?? false);

		// Fast path: Check cache for identical contexts
		const cacheKey = this.getCacheKey(context);
		const cached = this.routingCache.get(cacheKey);

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

		// Privacy/offline mode: only local models
		// requiresPrivacy is set only when images/PDFs are present and imageQAAllowRemoteModels is false
		if (context.requiresPrivacy) {
			const decision = this.routeToLocalModel(context);
			if (decision) {
				this.routingCache.set(cacheKey, { decision, timestamp: Date.now() });
				return decision;
			}
			// No local models available in privacy mode - return error decision
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' },
				confidence: 0.0,
				reasoning: 'Privacy mode requires local models, but no local models are configured. Please configure a local provider (Ollama, vLLM, or LM Studio).',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: 'No local models available for privacy mode',
			};
		}

		// Local-First AI mode: heavily bias toward local models
		// PERFORMANCE: localFirstAI already cached above, reuse it
		if (localFirstAI) {
			// In Local-First mode, prefer local models but allow cloud as fallback
			// This is handled in scoreModel by applying heavy bonuses to local models
		}

		// Routing policy: 'free-tier' -> consult the smart free-tier router first.
		// If the ladder is empty (no configured free-tier providers, all exhausted,
		// or privacy gate engaged), fall through to the standard scoring path so
		// the user is never stranded.
		const routingPolicy = settingsState.globalSettings.routingPolicy ?? 'auto-cheapest';
		if (routingPolicy === 'free-tier') {
			const ladderDecision = this.routeViaFreeTierLadder(context, settingsState);
			if (ladderDecision) {
				this.routingCache.set(cacheKey, { decision: ladderDecision, timestamp: Date.now() });
				return ladderDecision;
			}
		} else if (routingPolicy === 'local-only') {
			// Hard local-only: refuse to dispatch to any cloud provider.
			const localDecision = this.routeToLocalModel(context);
			if (localDecision) {
				this.routingCache.set(cacheKey, { decision: localDecision, timestamp: Date.now() });
				return localDecision;
			}
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' },
				confidence: 0.0,
				reasoning: 'Routing policy is local-only but no local models are configured.',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: 'No local models for local-only routing policy',
			};
		}

		// Quality gate: pre-flight quality estimate (pure, tested -- ./routing/qualityTier.ts)
		const qualityTier = estimateQualityTier(context);

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

		// Check if online models are available (for codebase questions, we strongly prefer online models)
		const hasOnlineModels = availableModels.some(m => {
			if (m.providerName === 'auto') return false;
			return !(localProviderNames as readonly ProviderName[]).includes(m.providerName as ProviderName);
		});

		// Debug: Log available models for codebase questions
		const isCodebaseQuestionCheck = (context.requiresComplexReasoning && context.taskType === 'code' && !context.hasCode) ||
			(context.contextSize && context.contextSize > 15000) ||
			(context.taskType === 'code' && context.isLongMessage && !context.hasCode);
		if (isCodebaseQuestionCheck) {
			const onlineModels = availableModels.filter(m => {
				if (m.providerName === 'auto') return false;
				return !(localProviderNames as readonly ProviderName[]).includes(m.providerName as ProviderName);
			});
			const localModels = availableModels.filter(m => {
				if (m.providerName === 'auto') return false;
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
				if (m.providerName === 'auto') return false;
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
				if (m.providerName === 'auto') return false;
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
				if (model.providerName === 'auto') return false;
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
				if (model.providerName === 'auto') return false;
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
				if (model.providerName === 'auto') return false;
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
		// PERFORMANCE: Batch capability lookups to reduce overhead, pass pre-computed localFirstAI
		const scored = candidateModels.map(model => {
			const ruleScore = this.scoreModel(model, context, settingsState, hasOnlineModels, localFirstAI);
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
				// Auto-mode failover (chatThreadService) reads this to recover when the chosen model errors
				// (e.g. a 429/quota-exhausted gemini). The normal path below populates it too; the early-exit
				// previously omitted it, so failover had nothing to fall back to and dead-ended on the error.
				fallbackChain: scored.slice(1, 4).map(s => s.model),
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
			// Fallback: try local models even if privacy not required
			const localDecision = this.routeToLocalModel(context);
			if (localDecision) {
				return localDecision;
			}
			// No models available at all - return error decision
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' },
				confidence: 0.0,
				reasoning: 'No models available. Please configure at least one model provider in settings.',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: 'No models configured',
			};
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
			// This should never happen, but if it does, try local models as fallback
			console.error('[ModelRouter] Error: Attempted to return "auto" model selection. Trying local model fallback.');
			const localDecision = this.routeToLocalModel(context);
			if (localDecision) {
				return localDecision;
			}
			// Last resort: return error
			return {
				modelSelection: { providerName: 'auto', modelName: 'auto' },
				confidence: 0.0,
				reasoning: 'Router error: No valid model could be selected. Please check your model configuration.',
				qualityTier: 'abstain',
				shouldAbstain: true,
				abstainReason: 'Router error: invalid model selection',
			};
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
		settingsState: any
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
	private getModelTimeout(model: ModelSelection, context: TaskContext, settingsState: any): number {
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
		if (context.hasImages) parts.push('with images');
		if (context.hasPDFs) parts.push('with PDFs');
		if (context.hasCode) parts.push('with code');
		if (context.requiresComplexReasoning) parts.push('complex reasoning');
		if (context.contextSize) parts.push(`~${Math.round(context.contextSize / 1000)}k tokens`);

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
	private getAvailableModels(settingsState: any): ModelSelection[] {
		const models: ModelSelection[] = [];

		for (const providerName of Object.keys(settingsState.settingsOfProvider) as ProviderName[]) {
			const providerSettings = settingsState.settingsOfProvider[providerName];
			if (!providerSettings._didFillInProviderSettings) continue;

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
		settingsState: any,
		hasOnlineModels: boolean = false,
		localFirstAI?: boolean // PERFORMANCE: Pre-computed localFirstAI passed as parameter to avoid repeated lookup
	): number {
		// Skip "auto" - it's not a real model (short-circuit before resolving capabilities, as before)
		if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') {
			return 0;
		}

		const capabilities = this.getCachedCapabilities(modelSelection, settingsState);
		const isLocal = (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);
		// Real parameter size the provider reported (ollama details.parameter_size), if known. Lets the
		// size bonus/penalty prefer a true 7B over a tiny ":latest" coder whose tag doesn't reveal size.
		const realParamSize: string | undefined = isLocal
			? settingsState?.settingsOfProvider?.[modelSelection.providerName]?.models?.find((m: { modelName: string; parameterSize?: string }) => m.modelName === modelSelection.modelName)?.parameterSize
			: undefined;

		// All capability scoring lives in the pure, node-tested common/routing/computeModelScore.ts.
		// Resolve the impure inputs here (capabilities cache, settings reads, quota service) and delegate.
		return computeModelScore({
			modelSelection,
			context,
			capabilities,
			isVisionCapable: this.isVisionCapable(modelSelection, capabilities),
			realParamSize,
			hasOnlineModels,
			localFirstAI,
			routingPolicy: settingsState?.globalSettings?.routingPolicy,
			localFirstAISetting: settingsState?.globalSettings?.localFirstAI,
			getFreeTierRemaining: (fid, modelName) => this.freeTierQuotaService.getRemaining(fid, modelName),
		});
	}

	/**
	 * Check if a model supports vision/image inputs
	 */
	private isVisionCapable(modelSelection: ModelSelection, capabilities: CortexideStaticModelInfo): boolean {
		const name = modelSelection.modelName.toLowerCase();
		const provider = modelSelection.providerName.toLowerCase();

		// Known vision-capable models
		if (provider === 'gemini') return true; // all Gemini models support vision
		if (provider === 'anthropic') {
			return name.includes('3.5') || name.includes('3.7') || name.includes('4') || name.includes('opus') || name.includes('sonnet');
		}
		if (provider === 'openai') {
			// GPT-5 series (all variants support vision)
			if (name.includes('gpt-5') || name.includes('gpt-5.1')) return true;
			// GPT-4.1 series
			if (name.includes('4.1')) return true;
			// GPT-4o series
			if (name.includes('4o')) return true;
			// o-series reasoning models (o1, o3, o4-mini support vision)
			if (name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4')) return true;
			// Legacy GPT-4 models
			if (name.includes('gpt-4')) return true;
		}
		if (provider === 'mistral') {
			// Pixtral models support vision
			if (name.includes('pixtral')) return true;
		}
		if (provider === 'ollama' || provider === 'vllm') {
			return name.includes('llava') || name.includes('bakllava') || name.includes('vision');
		}

		return false;
	}

	/**
	 * Route to a local model (privacy/offline mode)
	 * Returns null if no local models are available (caller must handle fallback)
	 */
	/**
	 * Route via the smart free-tier ladder.  Returns `null` when no free-tier
	 * provider is currently usable (caller should fall through to standard
	 * scoring or local fallback).
	 *
	 * Cloud providers are only considered when the privacy gate is NOT engaged
	 * - `requiresPrivacy` short-circuits to `null` here so callers can route
	 * to local.
	 */
	/**
	 * Public verdict on free-tier exhaustion, computed from live settings +
	 * quota state. Used by the chat UI to show an actionable "all free quotas
	 * exhausted" message (offer local / BYO) instead of a raw provider 429.
	 */
	getFreeTierExhaustion(): FreeTierExhaustionResult {
		const settingsState = this.settingsService.state;
		return describeFreeTierExhaustion({
			configuredModels: this.getAvailableModels(settingsState),
			quotas: this.freeTierQuotaService.getAllRemaining(),
			now: Date.now(),
		});
	}

	private routeViaFreeTierLadder(
		context: TaskContext,
		settingsState: CortexideSettingsState,
	): RoutingDecision | null {
		if (context.requiresPrivacy) {
			return null;
		}

		const configured = this.getAvailableModels(settingsState);
		const quotas = this.freeTierQuotaService.getAllRemaining();

		// Context floor: code/agentic/multi-step tasks run a tool loop whose
		// context GROWS every turn, so demote context-starved free providers
		// (e.g. Cerebras's 8K cap) below large-context ones (Gemini 1M, Groq
		// 128K). Without this, the highest-qualityRank free provider wins even
		// when its window can't hold an agentic run — the message + tool results
		// + sub-agent summaries blow past 8K and the whole thing stalls.
		const isAgenticOrLargeTask = context.taskType === 'code'
			|| !!context.isMultiStepTask
			|| !!context.requiresComplexReasoning
			|| !!context.hasCode;
		const minContextWindow = Math.max(
			context.contextSize ?? 0,
			isAgenticOrLargeTask ? 32_000 : 0,
		);

		const ladder = buildFreeTierLadder({
			configuredModels: configured,
			quotas,
			privacyMode: !!context.requiresPrivacy,
			minContextWindow,
		});

		const top = pickTopFromLadder(ladder);
		if (!top) {
			return null;
		}

		const fallbackChain: ModelSelection[] = ladder.slice(1, 4).map(c => ({
			providerName: c.providerName,
			modelName: c.modelName,
		}));

		const timeoutMs = this.getModelTimeout(top, context, settingsState);

		return {
			modelSelection: top,
			confidence: 0.75,
			reasoning: `Free-tier ladder selected ${top.providerName}/${top.modelName} (next: ${fallbackChain.map(m => m.providerName).join(', ') || 'none'})`,
			fallbackChain,
			qualityTier: 'cheap_fast',
			timeoutMs,
		};
	}

	private routeToLocalModel(context: TaskContext): RoutingDecision | null {
		const settingsState = this.settingsService.state;
		const localModels: ModelSelection[] = [];

		// Collect available local models
		for (const providerName of localProviderNames) {
			const providerSettings = settingsState.settingsOfProvider[providerName];
			if (!providerSettings._didFillInProviderSettings) continue;

			for (const modelInfo of providerSettings.models) {
				if (!modelInfo.isHidden) {
					localModels.push({
						providerName,
						modelName: modelInfo.modelName,
					});
				}
			}
		}

		// Return null if no local models available (don't return invalid hardcoded model)
		if (localModels.length === 0) {
			return null;
		}

		// Score local models using mixture policy
		// Note: hasOnlineModels is false here since we're in privacy/offline mode
		// PERFORMANCE: Pre-compute localFirstAI to pass to scoreModel
		// migrated from localFirstAI: also honour `routingPolicy === 'local-only'`.
		const localFirstAI = (settingsState.globalSettings.routingPolicy === 'local-only')
			|| (settingsState.globalSettings.localFirstAI ?? false);
		const scored = localModels.map(model => {
			const ruleScore = this.scoreModel(model, context, settingsState, false, localFirstAI);
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
		settingsState: any
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


