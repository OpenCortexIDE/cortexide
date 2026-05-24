/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 // allow-any-unicode-next-line
 *  modelPacks.ts — Human-readable catalogue of model packs for the setup wizard.
 *  Used by LocalSetupWizard.tsx to render pack selection cards.
 *  Actual Ollama pull tags are defined in electron-main/ollamaInstallerChannel.ts.
 *--------------------------------------------------------------------------------------*/

import { ModelPackType } from './localSetupServiceTypes.js';

export interface ModelPackInfo {
	id: ModelPackType;
	name: string;
	description: string;
	/** Estimated download size in GB */
	estimatedSizeGb: number;
	/** Minimum RAM/VRAM required in GB */
	minRamGb: number;
	/** Model tag used with Ollama (undefined for cloud-only packs) */
	ollamaTag?: string;
	/** Whether this is a cloud provider (not downloaded locally) */
	isCloud: boolean;
	/** Provider API endpoint base URL (for cloud packs) */
	cloudProvider?: string;
	/** Highlight badge text shown next to the pack name */
	badge?: string;
	/** Benchmark score string for display */
	benchmark?: string;
}

const MODEL_PACK_CATALOGUE: ModelPackInfo[] = [
	{
		id: 'minimal',
		name: 'Phi-4 Mini',
		description: 'Lightweight model for resource-constrained devices. Works on any modern laptop.',
		estimatedSizeGb: 2.2,
		minRamGb: 4,
		ollamaTag: 'phi4-mini',
		isCloud: false,
		benchmark: '82% HumanEval',
	},
	{
		id: 'fast',
		name: 'Qwen 2.5 Coder 7B',
		description: 'Great performance on MacBook Air M2/M3 and 8 GB RAM machines. Best for quick responses.',
		estimatedSizeGb: 4.4,
		minRamGb: 8,
		ollamaTag: 'qwen2.5-coder:7b',
		isCloud: false,
		benchmark: '88% HumanEval',
	},
	{
		id: 'balanced',
		name: 'Qwen 2.5 Coder 14B',
		description: 'Best all-round model for most developer hardware. Excellent code understanding and generation.',
		estimatedSizeGb: 8.5,
		minRamGb: 16,
		ollamaTag: 'qwen2.5-coder:14b',
		isCloud: false,
		badge: 'Recommended',
		benchmark: '91% HumanEval',
	},
	{
		id: 'reasoning',
		name: 'DeepSeek Coder V2 16B',
		description: 'MoE architecture for complex multi-step reasoning. Best for architecture tasks and debugging.',
		estimatedSizeGb: 9.0,
		minRamGb: 12,
		ollamaTag: 'deepseek-coder-v2:16b',
		isCloud: false,
		benchmark: '91% HumanEval',
	},
	{
		id: 'powerful',
		name: 'Codestral 22B',
		description: 'Best performance and lowest latency on high-end GPUs. Supports 80+ programming languages.',
		estimatedSizeGb: 12.0,
		minRamGb: 24,
		ollamaTag: 'codestral:22b',
		isCloud: false,
		benchmark: '93% HumanEval',
	},
	{
		id: 'kimi',
		name: 'Kimi K2 (Cloud)',
		// allow-any-unicode-next-line
		description: 'Free cloud AI by Moonshot AI. #1 on SWE-bench agentic coding benchmarks. No download needed — requires a free API key.',
		estimatedSizeGb: 0,
		minRamGb: 0,
		isCloud: true,
		cloudProvider: 'moonshot',
		badge: 'Free Cloud',
		benchmark: '#1 SWE-bench Agentic',
	},
];

/** Returns the full model pack catalogue sorted by minRamGb ascending (cloud last). */
export function getAllModelPacks(): ModelPackInfo[] {
	return MODEL_PACK_CATALOGUE;
}

/** Returns a single pack by id, or undefined if not found. */
export function getModelPackById(id: ModelPackType): ModelPackInfo | undefined {
	return MODEL_PACK_CATALOGUE.find(p => p.id === id);
}
