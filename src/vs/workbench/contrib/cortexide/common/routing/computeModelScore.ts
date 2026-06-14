/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ModelSelection, ProviderName, localProviderNames } from '../cortexideSettingsTypes.js';
import { CortexideStaticModelInfo } from '../modelCapabilities.js';
import { codingModelScoreBonus, localModelSizeBonus, smallLocalModelCodePenalty } from './codingModelScore.js';
import { freeTierIdOfProviderName, FreeTierProviderId } from './freeTierConstants.js';
import type { TaskContext } from '../modelRouter.js';

/**
 * The capability-scoring arithmetic of ModelRouter, extracted verbatim from the private
 * `scoreModel` method so the routing math is node-testable. The score decides which model
 * Auto picks, so its constants are a routing contract; a regression that re-ranks models
 * (e.g. a small local coder over a 7B, or a quota-exhausted free model) is a real bug.
 *
 * Byte-identical to the old inline body. The method's impure inputs are injected:
 *  - `capabilities`     pre-resolved by the caller (getCachedCapabilities).
 *  - `isVisionCapable`  pre-resolved by the caller (ModelRouter.isVisionCapable, which is pure
 *                       in name/provider; resolving it unconditionally is side-effect-free and
 *                       only consumed inside the vision/PDF branch, so the score is unchanged).
 *  - `realParamSize`    pre-resolved from settingsState (ollama details.parameter_size).
 *  - `routingPolicy` / `localFirstAISetting`  the two globalSettings reads used ONLY for the
 *                       backward-compat fallback when `localFirstAI` is undefined (production
 *                       callers always pass it, so the fallback is dead but preserved exactly).
 *  - `getFreeTierRemaining`  the impure quota lookup; the surrounding try/catch + fid resolution
 *                       stay here so a quota-service hiccup can never break scoring.
 */
export interface ComputeModelScoreInputs {
	readonly modelSelection: ModelSelection;
	readonly context: TaskContext;
	readonly capabilities: CortexideStaticModelInfo;
	readonly isVisionCapable: boolean;
	readonly realParamSize: string | undefined;
	readonly hasOnlineModels: boolean;
	readonly localFirstAI: boolean | undefined;
	readonly routingPolicy: string | undefined;
	readonly localFirstAISetting: boolean | undefined;
	readonly getFreeTierRemaining: (freeTierId: FreeTierProviderId, modelName: string) => { exhausted: boolean };
}

export function computeModelScore(inputs: ComputeModelScoreInputs): number {
	const {
		modelSelection,
		context,
		capabilities,
		isVisionCapable,
		realParamSize,
		hasOnlineModels,
		localFirstAI,
		routingPolicy,
		localFirstAISetting,
		getFreeTierRemaining,
	} = inputs;

	// Skip "auto" - it's not a real model
	if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') {
		return 0;
	}

	const name = modelSelection.modelName.toLowerCase();
	const provider = modelSelection.providerName.toLowerCase();
	const isLocal = (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);

	// Check Local-First AI setting
	// PERFORMANCE: Use pre-computed value if provided, otherwise lookup (for backward compatibility)
	// migrated from localFirstAI: also honour `routingPolicy === 'local-only'`.
	const localFirstAICached = localFirstAI !== undefined
		? localFirstAI
		: ((routingPolicy === 'local-only')
			|| (localFirstAISetting ?? false));

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
		// Boost local models that have useful capabilities (FIM, tools, reasoning)
		if (capabilities.supportsFIM || capabilities.specialToolFormat ||
			(capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning)) {
			score += 5; // Bonus for capable local models
		}
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
	// BUT: Only penalize if model doesn't have reasoning capabilities
	if (context.requiresComplexReasoning && isLocal) {
		const hasReasoningCapabilities = capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning;
		if (hasReasoningCapabilities) {
			// Local models with reasoning support (e.g., DeepSeek R1, QwQ) can handle complex reasoning
			if (localFirstAI) {
				score += 15; // Bonus for reasoning-capable local models in Local-First mode
			} else {
				score -= 10; // Small penalty - prefer online but allow capable local models
			}
		} else {
			if (localFirstAI) {
				score -= 10; // Reduced penalty in Local-First mode (still prefer capable models)
			} else {
				score -= 40; // Very strong penalty - complex reasoning needs high-quality models
			}
		}
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
		if (isVisionCapable) {
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

			// Reward code-tuned models here too (not only on regular-code tasks). Without this, a
			// coding-tuned local (qwen-coder, codestral, ...) and a weak general local tie on the
			// code axis and a context-window/learned-score coin-flip decides -- sending agentic/
			// codebase requests to a worse model. This makes the coder reliably win among locals.
			score += codingModelScoreBonus(name, capabilities.supportsFIM)

			// Among local coders (which often share identical capability data, e.g. qwen2.5-coder
			// :1.5b vs :latest both report 32k+FIM), prefer the larger as a tie-breaker, and
			// decisively demote a sub-7B local coder (below the agentic floor) so a lucky
			// learned-score swing can't hand an agentic codebase task to a 3B over a 7B.
			if (isLocal) { score += localModelSizeBonus(name, realParamSize) + smallLocalModelCodePenalty(name, realParamSize) }

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

			// FIM + code-tuned name bonus (shared with the codebase-question branch above).
			score += codingModelScoreBonus(name, capabilities.supportsFIM)
			// Among local coders, prefer the larger model as a tie-breaker, and decisively demote
			// a sub-7B local coder so it can't tie/beat a 7B+ coder on a code task.
			if (isLocal) { score += localModelSizeBonus(name, realParamSize) + smallLocalModelCodePenalty(name, realParamSize) }

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

			// Local code models: Only penalize if they lack required capabilities
			// Local models with FIM or tool support are actually good for edit flows
			if (isLocal) {
				const hasRequiredCapabilities = capabilities.supportsFIM || capabilities.specialToolFormat;
				if (hasRequiredCapabilities) {
					// Local models with FIM/tool support are competitive for edit flows
					// In Local-First mode, give bonus instead of penalty
					if (localFirstAI) {
						score += 20; // Bonus for capable local models in Local-First mode
					} else {
						score -= 5; // Minimal penalty - capable local models are viable for editing
					}
				} else {
					// Local models without FIM/tool support are less suitable for implementation
					if (localFirstAI) {
						score += 5; // Small bonus even without capabilities in Local-First mode
					} else {
						score -= 15; // Moderate penalty - online code models are often better
					}
				}

				// #9: when a capable ONLINE model is configured, prefer it for code generation / agentic
				// edits. The codebase-question branch above already does this (-100); the regular-code path
				// did NOT consider hasOnlineModels, so a local model could win an implementation/agentic task
				// even with a strong cloud key present -- and then lose the tool-loop, forcing a visible
				// mid-task failover. Lighter than -100 (capable FIM/tool locals are genuinely useful for
				// edits) and gated on !localFirstAICached so Local-First / local-only setups are untouched.
				if (hasOnlineModels && !localFirstAICached) {
					score -= 40;
				}
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
	// For local models, only enable tools in agent mode to reduce overhead
	if (capabilities.specialToolFormat) {
		if (isLocal) {
			// Local models: only give bonus for tools in agent mode (reduce overhead for normal chat)
			if (context.taskType === 'code' && context.requiresComplexReasoning) {
				// Agent mode or complex code tasks - tools are valuable
				score += 8;
				score += 5; // Extra bonus for local models with tool support in agent mode
			} else {
				// Normal chat - tools add overhead, small penalty
				score -= 5; // Small penalty to prefer models without tool overhead for simple tasks
			}
		} else {
			// Cloud models: tools are always valuable
			score += 8;
		}
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

	// ===== LOCAL-FIRST AI MODE =====
	// When Local-First AI is enabled, heavily bias toward local models
	// BUT: Reduce bias for heavy tasks that will be slow on local models
	// PERFORMANCE: Use pre-computed localFirstAICached instead of re-reading settings
	if (localFirstAICached) {
		// Estimate task size/complexity
		const estimatedPromptTokens = context.contextSize ||
			(context.isLongMessage ? 4000 : 1000) +
			(context.hasImages ? 2000 : 0) +
			(context.hasPDFs ? 5000 : 0) +
			(context.requiresComplexReasoning ? 3000 : 0)

		// Threshold for "heavy" tasks that should prefer cloud even in local-first mode
		const maxSafeLocalTokens = 4000 // Tasks over 4k tokens are heavy for local models
		const isHeavyTask = estimatedPromptTokens > maxSafeLocalTokens

		if (isLocal) {
			if (isHeavyTask) {
				// Heavy tasks: reduce local bonus significantly (still prefer local, but less aggressively)
				score += 30; // Reduced bonus for heavy tasks
				// Extra bonus only for very capable local models on heavy tasks
				if (capabilities.supportsFIM || capabilities.specialToolFormat ||
					(capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning)) {
					score += 20; // Smaller extra bonus
				}
			} else {
				// Light tasks: full local-first bonus
				score += 100; // Very strong bonus to prefer local models
				// Extra bonus for capable local models
				if (capabilities.supportsFIM || capabilities.specialToolFormat ||
					(capabilities.reasoningCapabilities && typeof capabilities.reasoningCapabilities === 'object' && capabilities.reasoningCapabilities.supportsReasoning)) {
					score += 50; // Extra bonus for capable local models
				}
			}
		} else {
			// Online models: reduce penalty for heavy tasks (allow cloud for heavy work)
			if (isHeavyTask) {
				score -= 50; // Reduced penalty for heavy tasks (cloud is acceptable)
			} else {
				score -= 150; // Full penalty for light tasks (prefer local)
			}
		}
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

	// SELF-HEALING: demote a free-tier provider whose quota is currently exhausted (a model that just
	// 429'd, e.g. gemini-2.5-pro on a free key with limit:0). markExhausted() is recorded on the 429
	// (sendLLMMessageService) but on the default 'auto-cheapest' scoring path was never consulted -- so
	// Auto kept re-picking the dead model every turn and chat never worked. The penalty pushes it below
	// any working model; it auto-clears when the quota window resets. If the WHOLE free-tier fleet is
	// exhausted they all get the same penalty, so the least-bad relative order is preserved. Cloud-only;
	// never break routing on a quota-service hiccup.
	if (!isLocal) {
		try {
			const fid = freeTierIdOfProviderName(modelSelection.providerName);
			if (fid && getFreeTierRemaining(fid, modelSelection.modelName).exhausted) {
				score -= 1000;
			}
		} catch { /* never let a quota lookup break model scoring */ }
	}

	return Math.max(0, score); // Ensure non-negative
}
