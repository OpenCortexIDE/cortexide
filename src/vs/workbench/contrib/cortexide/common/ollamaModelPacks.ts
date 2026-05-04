/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 // allow-any-unicode-next-line
 *  Curated model packs ranked by capability tier. Pure data — no Node.js dependencies.
 *  Shared between common/ (renderer) and electron-main/ (main process).
 *
 *  Benchmarks (HumanEval, April 2026):
 // allow-any-unicode-next-line
 *   qwen2.5-coder:7b        88.4% — best for 8 GB VRAM
 // allow-any-unicode-next-line
 *   qwen2.5-coder:14b       91.2% — best for 16 GB VRAM (recommended default)
 // allow-any-unicode-next-line
 *   codestral:22b           93.1% — best for 24 GB+ VRAM, lowest latency
 // allow-any-unicode-next-line
 *   deepseek-coder-v2:16b   90.8% — best reasoning, 12 GB VRAM (MoE)
 // allow-any-unicode-next-line
 *   phi4-mini               82.1% — absolute minimum hardware (<6 GB)
 *--------------------------------------------------------------------------------------*/

export const MODEL_PACKS = {
	/** ~4 GB download. Needs 8 GB RAM/VRAM minimum. */
	fast: {
		label: 'Fast (7B)',
		tag: 'qwen2.5-coder:7b',
		requiredVramGB: 8,
		description: 'Best for MacBook Air M2/M3 or 8 GB RAM machines',
	},
	/** ~8 GB download. Needs 16 GB RAM/VRAM. Recommended default. */
	balanced: {
		label: 'Balanced (14B)',
		tag: 'qwen2.5-coder:14b',
		requiredVramGB: 16,
		description: 'Best all-round model for most developer hardware',
	},
	/** ~12 GB download. Needs 24 GB+ VRAM. */
	powerful: {
		label: 'Powerful (22B)',
		tag: 'codestral:22b',
		requiredVramGB: 24,
		description: 'Best performance, lowest latency on high-end GPUs',
	},
	/** ~9 GB download. Needs 12 GB VRAM. MoE architecture. */
	reasoning: {
		label: 'Reasoning (16B MoE)',
		tag: 'deepseek-coder-v2:16b',
		requiredVramGB: 12,
		description: 'Best for complex multi-step reasoning and architecture tasks',
	},
	/** ~2 GB download. Needs <6 GB RAM. Minimum viable. */
	minimal: {
		label: 'Minimal (Phi-4 Mini)',
		tag: 'phi4-mini',
		requiredVramGB: 4,
		description: 'For resource-constrained devices only',
	},
} as const;

export type ModelPackKey = keyof typeof MODEL_PACKS;
