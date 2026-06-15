/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The pre-flight quality-tier estimate of the task router, extracted from ModelRouter so it is
 * node-testable. The tier biases model selection (cheap/fast vs standard vs escalate) before any
 * capability scoring, so its boundaries are a routing contract. Byte-identical to the old inline
 * estimateQualityTier; takes the structural subset of TaskContext it reads.
 */

export type QualityTier = 'cheap_fast' | 'standard' | 'escalate' | 'abstain';

export interface QualityTierContext {
	readonly isSimpleQuestion?: boolean;
	readonly requiresComplexReasoning?: boolean;
	readonly hasImages?: boolean;
	readonly hasPDFs?: boolean;
	readonly isMultiStepTask?: boolean;
	readonly contextSize?: number;
	readonly isSecurityTask?: boolean;
}

/**
 * - cheap_fast: a simple question with no complex reasoning, images, or PDFs.
 * - escalate:   complex reasoning OR multi-step OR a large (>100k token) context OR a security task.
 * - standard:   everything else.
 */
export function estimateQualityTier(context: QualityTierContext): QualityTier {
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
