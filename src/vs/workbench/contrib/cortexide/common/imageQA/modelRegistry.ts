/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Model Registry for Image QA Pipeline
 * Provides capability metadata for code, vision, and OCR models
 */

export type ModelRole = 'code' | 'vlm' | 'ocr';
export type ImageType = 'document/receipt' | 'UI/app' | 'code_screenshot' | 'terminal/log' | 'chart/diagram' | 'photo' | 'unknown';
export type QuestionType = "what's_shown" | 'extract_text' | 'explain_error' | 'summarize_logs' | 'find_UI_element' | 'compare' | 'unknown';

export interface ModelCapability {
	role: ModelRole;
	modelName: string;
	providerName: string;
	max_px: number; // maximum pixels (width * height) the model can handle
	strong_at: string[]; // capabilities the model excels at
	weak_at: string[]; // capabilities the model struggles with
	cost: number; // cost per 1M tokens (0 for local)
	latency: 'low' | 'medium' | 'high'; // rough latency estimate
	contextWindow?: number; // context window in tokens
}

/**
 * In-memory registry of model capabilities
 * Used by router to select appropriate tools
 */
export class ImageQAModelRegistry {
	private models: Map<string, ModelCapability> = new Map();

	/**
	 * Register a model with its capabilities
	 */
	register(capability: ModelCapability): void {
		const key = `${capability.providerName}:${capability.modelName}`;
		this.models.set(key, capability);
	}

	/**
	 * Get a model by provider and name
	 */
	get(providerName: string, modelName: string): ModelCapability | undefined {
		const key = `${providerName}:${modelName}`;
		return this.models.get(key);
	}

	/**
	 * Find models by role
	 */
	findByRole(role: ModelRole): ModelCapability[] {
		return Array.from(this.models.values()).filter(m => m.role === role);
	}

	/**
	 * Find the best model for a given task
	 * @param preferOnline - If true, prefers online/remote models over local for image and code tasks
	 */
	findBestForTask(
		role: ModelRole,
		imageType: ImageType,
		questionType: QuestionType,
		maxPx: number,
		preferOnline: boolean = false
	): ModelCapability | null {
		const candidates = this.findByRole(role).filter(m => m.max_px >= maxPx);

		if (candidates.length === 0) return null;

		// Score each candidate based on strengths
		const scored = candidates.map(model => {
			let score = 0;

			// Prefer models strong at this image type
			if (model.strong_at.includes(imageType)) score += 10;
			if (model.strong_at.includes(questionType)) score += 10;

			// Penalize models weak at this task
			if (model.weak_at.includes(imageType)) score -= 5;
			if (model.weak_at.includes(questionType)) score -= 5;

			// For image and code tasks, prefer online models if preferOnline is true
			// For OCR tasks, always prefer local (Tesseract.js)
			if (role === 'ocr') {
				// OCR should always prefer local (Tesseract.js)
				if (model.cost === 0) score += 5;
			} else if (preferOnline) {
				// For image/code tasks, prefer online models when requested
				if (model.cost > 0) score += 8; // Strong preference for online
				if (model.cost === 0) score -= 3; // Penalize local
			} else {
				// Default: prefer local models
				if (model.cost === 0) score += 5;
			}

			// Prefer low latency
			if (model.latency === 'low') score += 3;
			if (model.latency === 'high') score -= 3;

			return { model, score };
		});

		scored.sort((a, b) => b.score - a.score);
		return scored[0]?.model || null;
	}

	/**
	 * List all registered models
	 */
	listAll(): ModelCapability[] {
		return Array.from(this.models.values());
	}
}

/**
 * Singleton registry instance
 */
export const imageQARegistry = new ImageQAModelRegistry();

/**
 * Initialize registry with common local models
 * Called during app startup
 */
export function initializeModelRegistry(): void {
	// OCR Models - browser-based Tesseract.js
	imageQARegistry.register({
		role: 'ocr',
		modelName: 'tesseract-js',
		providerName: 'local',
		max_px: 50_000_000, // effectively unlimited for tiling
		strong_at: ['OCR', 'text', 'code_screenshot', 'terminal/log', 'document/receipt'],
		weak_at: ['tiny_text', 'handwriting', 'complex_layouts'],
		cost: 0,
		latency: 'medium',
	});

	// Local Code Models - from Ollama/vLLM
	// These are registered dynamically when models are detected
	// Common ones (updated Nov 2025):
	const commonCodeModels = [
		// Latest models (2025)
		{ name: 'qwen2.5-coder:32b', ctx: 32_000 }, // Strong coding capabilities
		{ name: 'qwen2.5-coder:7b', ctx: 32_000 }, // Lightweight coding
		{ name: 'deepseek-r1:32b', ctx: 128_000 }, // Top reasoning model
		{ name: 'deepseek-r1:1.5b', ctx: 128_000 }, // Lightweight reasoning
		{ name: 'llama3.3:70b', ctx: 128_000 }, // Latest Llama
		{ name: 'llama3.1:70b', ctx: 128_000 }, // Large Llama
		{ name: 'llama3.1:8b', ctx: 128_000 }, // Fast Llama
		{ name: 'codestral:latest', ctx: 131_000 }, // Mistral coding model
		{ name: 'devstral:latest', ctx: 131_000 }, // Mistral dev model
		// Legacy names (for backward compatibility)
		{ name: 'qwen2.5-coder', ctx: 32_000 },
		{ name: 'deepseek-r1', ctx: 128_000 },
		{ name: 'llama3.1', ctx: 128_000 },
		{ name: 'devstral', ctx: 131_000 },
	];

	commonCodeModels.forEach(({ name, ctx }) => {
		imageQARegistry.register({
			role: 'code',
			modelName: name,
			providerName: 'ollama',
			max_px: 0, // doesn't process images directly
			strong_at: ['reasoning', 'code', 'terminal/log', 'error_analysis'],
			weak_at: ['visual_layout', 'non_text'],
			cost: 0,
			latency: 'medium',
			contextWindow: ctx,
		});
	});

	// Local Vision Models (updated Nov 2025)
	const visionModels = [
		// Latest vision models
		{ name: 'llava:latest', maxPx: 1_000_000 }, // Latest LLaVA
		{ name: 'llava:34b', maxPx: 1_000_000 }, // Large LLaVA
		{ name: 'llava:13b', maxPx: 1_000_000 }, // Medium LLaVA
		{ name: 'bakllava:latest', maxPx: 1_000_000 }, // Alternative vision model
		{ name: 'llama3.2-vision:11b', maxPx: 1_000_000 }, // Llama vision model
		// Legacy names (for backward compatibility)
		{ name: 'llava', maxPx: 1_000_000 },
		{ name: 'bakllava', maxPx: 1_000_000 },
	];

	visionModels.forEach(({ name, maxPx }) => {
		imageQARegistry.register({
			role: 'vlm',
			modelName: name,
			providerName: 'ollama',
			max_px: maxPx,
			strong_at: ['layout', 'region_proposals', 'charts', 'UI/app', 'diagrams'],
			weak_at: ['tiny_text', 'precise_OCR'],
			cost: 0,
			latency: 'high',
		});
	});
}

