/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { computeModelScore, ComputeModelScoreInputs } from '../../common/routing/computeModelScore.js';
import { oracleComputeModelScore } from './computeModelScore.oracle.js';
import { codingModelScoreBonus, localModelSizeBonus, smallLocalModelCodePenalty } from '../../common/routing/codingModelScore.js';
import { CortexideStaticModelInfo } from '../../common/modelCapabilities.js';
import type { TaskContext, TaskType } from '../../common/modelRouter.js';
import { ModelSelection, ProviderName } from '../../common/cortexideSettingsTypes.js';

/**
 * computeModelScore is the capability-scoring arithmetic of ModelRouter, extracted verbatim from the
 * private scoreModel method so the routing math is node-testable. The score decides which model Auto
 * picks, so its constants are a routing contract.
 *
 * Two-tier validation:
 *  1) Differential fuzz vs computeModelScore.oracle.ts -- a GENERATED, mechanically-faithful copy of
 *     the ORIGINAL scoreModel body (git HEAD at extraction time). Over tens of thousands of diverse
 *     inputs the extracted pure fn must reproduce the original byte-for-byte. This catches any future
 *     drift of computeModelScore away from the original arithmetic.
 *  2) Hand-traced goldens -- exact integer scores derived by tracing the spec, independent of both
 *     copies, pinning each major scoring axis (quality tier, privacy, code/codebase-question, local-
 *     first, low-latency, vision, free-tier exhaustion).
 */

// ---- deterministic PRNG (mulberry32) ---------------------------------------------------------
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ---- input builders --------------------------------------------------------------------------
const DEFAULT_CAPS: CortexideStaticModelInfo = {
	contextWindow: 8000,
	reservedOutputTokenSpace: 4096,
	supportsSystemMessage: false,
	supportsFIM: false,
	reasoningCapabilities: false,
	cost: { input: 0, output: 0 },
	downloadable: false,
};

function caps(over: Partial<CortexideStaticModelInfo>): CortexideStaticModelInfo {
	return { ...DEFAULT_CAPS, ...over };
}

function inp(over: Partial<ComputeModelScoreInputs> & { modelSelection?: ModelSelection }): ComputeModelScoreInputs {
	return {
		modelSelection: { providerName: 'anthropic', modelName: 'x' },
		context: { taskType: 'general' },
		capabilities: DEFAULT_CAPS,
		isVisionCapable: false,
		realParamSize: undefined,
		hasOnlineModels: false,
		localFirstAI: false,
		routingPolicy: undefined,
		localFirstAISetting: undefined,
		getFreeTierRemaining: () => ({ exhausted: false }),
		...over,
	};
}

// ---- fuzz vocabularies -----------------------------------------------------------------------
const NAME_POOL = [
	'opus', 'sonnet', 'claude-3', 'claude-3.5-sonnet', 'gpt-4o', 'gpt-4.1', 'gpt-4-turbo',
	'gpt-3.5-turbo', 'gemini-pro', 'gemini-flash', 'gemini-ultra', 'llama3', 'llama3-8b',
	'mistral-7b', 'mistral-large', 'mixtral', 'qwen2.5-coder:7b', 'qwen2.5-coder:1.5b',
	'qwen2.5-1.5b', 'qwen2.5-0.5b', 'codestral:22b', 'phi-3-mini', 'gemma-2b', 'deepseek-r1',
	'deepseek-coder-v2:16b', '13b-model', '70b-model', 'haiku', 'o3-mini', 'nano-model',
	'turbo-x', '7b-model', 'some-model', 'fast-tiny', 'small-thing', 'x',
];
const PROVIDER_POOL: ProviderName[] = [
	'anthropic', 'openAI', 'gemini', 'mistral', 'deepseek', 'groq', 'xAI', 'ollama', 'vLLM',
	'lmStudio', 'openRouter', 'cerebras', 'pollinations',
];
const TASK_TYPES: TaskType[] = ['chat', 'code', 'vision', 'pdf', 'web_search', 'eval', 'general'];
const CTX_WINDOWS = [1000, 4096, 8000, 16000, 31999, 32000, 32768, 64000, 127999, 128000, 199999, 200000, 300000];
const SYS_MSG: CortexideStaticModelInfo['supportsSystemMessage'][] = [false, 'system-role', 'developer-role', 'separated'];
const TOOL_FMT: (CortexideStaticModelInfo['specialToolFormat'])[] = [undefined, 'openai-style', 'anthropic-style', 'gemini-style'];
const PARAM_SIZES = [undefined, '0.5B', '1.5B', '3B', '7B', '8B', '13B', '70B', '8x7B'];
const TRI = [undefined, true, false];
const ROUTING = [undefined, 'local-only', 'default'];

const BOOL_FLAGS: (keyof TaskContext)[] = [
	'hasImages', 'hasPDFs', 'hasCode', 'requiresPrivacy', 'preferLowLatency', 'preferLowCost',
	'requiresComplexReasoning', 'isLongMessage', 'isDebuggingTask', 'isCodeReviewTask',
	'isTestingTask', 'isDocumentationTask', 'isPerformanceTask', 'isSecurityTask',
	'isSimpleQuestion', 'isMathTask', 'isMultiLanguageTask', 'isMultiStepTask',
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
	return arr[Math.floor(rng() * arr.length)];
}

function genInputs(rng: () => number): ComputeModelScoreInputs {
	const context: TaskContext = { taskType: pick(rng, TASK_TYPES) };
	for (const f of BOOL_FLAGS) {
		if (rng() < 0.35) { (context as unknown as Record<string, unknown>)[f] = true; }
	}
	if (rng() < 0.6) { context.contextSize = Math.floor(rng() * 300000) + 1; }

	const reasoning = rng() < 0.5
		? false as const
		: { supportsReasoning: true as const, canTurnOffReasoning: rng() < 0.5, canIOReasoning: rng() < 0.5 };

	const capabilities: CortexideStaticModelInfo = {
		contextWindow: pick(rng, CTX_WINDOWS),
		reservedOutputTokenSpace: pick(rng, [null, 0, 4096, 8192]),
		supportsSystemMessage: pick(rng, SYS_MSG),
		specialToolFormat: pick(rng, TOOL_FMT),
		supportsFIM: rng() < 0.5,
		reasoningCapabilities: reasoning,
		cost: { input: Math.floor(rng() * 30), output: Math.floor(rng() * 30) },
		downloadable: false,
	};

	return {
		modelSelection: { providerName: pick(rng, PROVIDER_POOL), modelName: pick(rng, NAME_POOL) },
		context,
		capabilities,
		isVisionCapable: rng() < 0.5,
		realParamSize: pick(rng, PARAM_SIZES),
		hasOnlineModels: rng() < 0.5,
		localFirstAI: pick(rng, TRI) as boolean | undefined,
		routingPolicy: pick(rng, ROUTING) as string | undefined,
		localFirstAISetting: pick(rng, TRI) as boolean | undefined,
		getFreeTierRemaining: ((exhausted: boolean) => () => ({ exhausted }))(rng() < 0.5),
	};
}

function serialize(x: ComputeModelScoreInputs): string {
	const { getFreeTierRemaining, ...rest } = x;
	void getFreeTierRemaining;
	return JSON.stringify(rest);
}

suite('computeModelScore -- differential fuzz vs the original scoreModel arithmetic', () => {
	test('extracted fn reproduces the original byte-for-byte over 50k diverse inputs', () => {
		const rng = mulberry32(0x1234abcd);
		let mismatches = 0;
		let firstFail = '';
		for (let i = 0; i < 50000; i++) {
			const x = genInputs(rng);
			const got = computeModelScore(x);
			const want = oracleComputeModelScore(x);
			if (got !== want) {
				mismatches++;
				if (!firstFail) { firstFail = `got=${got} want=${want} input=${serialize(x)}`; }
			}
		}
		assert.strictEqual(mismatches, 0, `extracted score diverged from the original on ${mismatches} inputs. First: ${firstFail}`);
	});

	test('the fuzz exercises the load-bearing branches (sanity: scores vary, not all clamped to 0)', () => {
		const rng = mulberry32(99);
		const seen = new Set<number>();
		for (let i = 0; i < 3000; i++) { seen.add(computeModelScore(genInputs(rng))); }
		// A healthy fuzz produces a wide spread of distinct scores including > 0.
		assert.ok(seen.size > 30, `expected a wide score spread, got ${seen.size} distinct values`);
		assert.ok([...seen].some(s => s > 0), 'expected some positive scores');
	});
});

suite('computeModelScore -- invariants', () => {
	test('the "auto" pseudo-model always scores 0', () => {
		assert.strictEqual(computeModelScore(inp({ modelSelection: { providerName: 'auto', modelName: 'auto' } })), 0);
	});

	test('score is never negative (clamped at 0)', () => {
		const rng = mulberry32(7);
		for (let i = 0; i < 5000; i++) {
			assert.ok(computeModelScore(genInputs(rng)) >= 0);
		}
	});

	test('a thrown quota lookup never breaks scoring (try/catch swallows it)', () => {
		const score = computeModelScore(inp({
			modelSelection: { providerName: 'gemini', modelName: 'gemini-flash' },
			getFreeTierRemaining: () => { throw new Error('quota service down'); },
		}));
		assert.strictEqual(score, 30); // tier-2 flash bonus, no quota penalty applied
	});
});

suite('computeModelScore -- hand-traced goldens (each pins one scoring axis)', () => {
	test('A: cloud tier-1 model on a general task = 50 (top-tier quality bonus only)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'anthropic', modelName: 'opus' },
		})), 50);
	});

	test('B: privacy mode disqualifies a cloud model (-200 -> clamped 0)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'anthropic', modelName: 'opus' },
			context: { taskType: 'general', requiresPrivacy: true },
		})), 0);
	});

	test('C: cloud GPT-4o on a regular code task = 78 (tier 50 + code 18 + 128k ctx 10)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'openAI', modelName: 'gpt-4o' },
			context: { taskType: 'code' },
			capabilities: caps({ contextWindow: 128000 }),
		})), 78);
	});

	test('D: codebase question (complex reasoning + code, no code blocks) on GPT-4o 200k = 180', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'openAI', modelName: 'gpt-4o' },
			context: { taskType: 'code', requiresComplexReasoning: true, hasCode: false },
			capabilities: caps({ contextWindow: 200000, supportsSystemMessage: 'system-role' }),
		})), 180);
	});

	test('E: local-first light task gives a local model a +100 bonus (10 baseline + 100)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'ollama', modelName: 'llama3' },
			context: { taskType: 'general' },
			localFirstAI: true,
		})), 110);
	});

	test('F: local-first light task penalizes a cloud model (-150 -> clamped 0)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'anthropic', modelName: 'opus' },
			context: { taskType: 'general' },
			localFirstAI: true,
		})), 0);
	});

	test('G: low-latency strongly rewards a fast online model (+50)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'openAI', modelName: 'gpt-4o-mini' },
			context: { taskType: 'general', preferLowLatency: true },
		})), 100); // tier 50 + low-latency 'mini' 50
	});

	test('H: vision task disqualifies a non-vision model (-100 -> clamped 0)', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'anthropic', modelName: 'opus' },
			context: { taskType: 'vision' },
			isVisionCapable: false,
		})), 0);
	});

	test('I: vision task rewards a vision-capable model (+40) -- gemini-pro 128k = 95', () => {
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'gemini', modelName: 'gemini-pro' },
			context: { taskType: 'vision' },
			isVisionCapable: true,
			capabilities: caps({ contextWindow: 128000 }),
		})), 95); // tier 45 + vision 40 + 128k ctx 10
	});

	test('J: an exhausted free-tier model is demoted by -1000 (gemini-flash 30 -> 0)', () => {
		const base = inp({
			modelSelection: { providerName: 'gemini', modelName: 'gemini-flash' },
			context: { taskType: 'general' },
		});
		assert.strictEqual(computeModelScore({ ...base, getFreeTierRemaining: () => ({ exhausted: false }) }), 30);
		assert.strictEqual(computeModelScore({ ...base, getFreeTierRemaining: () => ({ exhausted: true }) }), 0);
	});

	test('K: local coder on a code task composes the coder bonus + size tie-breaker (10 + helpers)', () => {
		const name = 'qwen2.5-coder:7b';
		const expected = 10
			+ codingModelScoreBonus(name, true)
			+ localModelSizeBonus(name, '7B')
			+ smallLocalModelCodePenalty(name, '7B');
		assert.strictEqual(computeModelScore(inp({
			modelSelection: { providerName: 'ollama', modelName: name },
			context: { taskType: 'code' },
			capabilities: caps({ contextWindow: 32768, supportsFIM: true, specialToolFormat: 'openai-style' }),
			realParamSize: '7B',
		})), expected);
	});
});
