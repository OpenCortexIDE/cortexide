/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { RoutingEvaluationService, RoutingOutcome } from '../../common/routingEvaluation.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ModelSelection } from '../../common/cortexideSettingsTypes.js';

/**
 * The routing evaluation loop's aggregation math (win-rate, escalation-rate, per-model success-rate, the
 * neutral-default). Tested against a 10-line in-memory IStorageService stub so the real service runs.
 */

function fakeStorage(): IStorageService {
	const m = new Map<string, string>();
	return {
		get: (key: string) => m.get(key),
		store: (key: string, value: unknown) => { m.set(key, String(value)); },
	} as unknown as IStorageService;
}

const model = (providerName: string, modelName: string): ModelSelection => ({ providerName, modelName } as ModelSelection);
let ts = 0;
const outcome = (over: Partial<RoutingOutcome>): RoutingOutcome => ({
	timestamp: ts++, modelSelection: model('anthropic', 'claude'), taskType: 'code', confidence: 0.8, ...over,
});

suite('routingEvaluation.RoutingEvaluationService', () => {

	test('getModelSuccessRate returns the neutral 0.5 when there is no data for the model', () => {
		const svc = new RoutingEvaluationService(fakeStorage());
		assert.strictEqual(svc.getModelSuccessRate(model('anthropic', 'claude')), 0.5);
	});

	test('getModelSuccessRate is successes/total for the model (keyed provider:model)', () => {
		const svc = new RoutingEvaluationService(fakeStorage());
		svc.recordOutcome(outcome({ success: true }));
		svc.recordOutcome(outcome({ success: true }));
		svc.recordOutcome(outcome({ success: true }));
		svc.recordOutcome(outcome({ success: false }));
		assert.strictEqual(svc.getModelSuccessRate(model('anthropic', 'claude')), 0.75);
		// a different model has no data -> neutral
		assert.strictEqual(svc.getModelSuccessRate(model('openAI', 'gpt-4')), 0.5);
	});

	test('getQualityReport computes win/escalation/retry rates over the recent window', () => {
		const svc = new RoutingEvaluationService(fakeStorage());
		svc.recordOutcome(outcome({ success: true, latencyMs: 100 }));
		svc.recordOutcome(outcome({ success: true, escalated: true, latencyMs: 300 }));
		svc.recordOutcome(outcome({ success: false, retryCount: 2 }));
		svc.recordOutcome(outcome({ success: true }));

		const r = svc.getQualityReport();
		assert.strictEqual(r.totalRequests, 4);
		assert.strictEqual(r.winRate, 0.75);        // 3/4 success
		assert.strictEqual(r.escalationRate, 0.25); // 1/4 escalated
		assert.strictEqual(r.retryRate, 0.25);      // 1/4 retried
		assert.strictEqual(r.avgLatency, 200);      // (100 + 300) / 2 latencies present
	});

	test('modelPerformance is keyed provider:model with per-model count + successRate', () => {
		const svc = new RoutingEvaluationService(fakeStorage());
		svc.recordOutcome(outcome({ modelSelection: model('anthropic', 'claude'), success: true }));
		svc.recordOutcome(outcome({ modelSelection: model('anthropic', 'claude'), success: false }));
		svc.recordOutcome(outcome({ modelSelection: model('ollama', 'qwen'), success: true }));

		const perf = svc.getQualityReport().modelPerformance;
		assert.deepStrictEqual(perf.get('anthropic:claude'), { count: 2, successRate: 0.5, avgLatency: 0 });
		assert.deepStrictEqual(perf.get('ollama:qwen'), { count: 1, successRate: 1, avgLatency: 0 });
	});

	test('the report/success-rate use a last-100 window', () => {
		const svc = new RoutingEvaluationService(fakeStorage());
		// 150 outcomes: the first 50 all fail, the last 100 all succeed
		for (let i = 0; i < 50; i++) { svc.recordOutcome(outcome({ success: false })); }
		for (let i = 0; i < 100; i++) { svc.recordOutcome(outcome({ success: true })); }
		const r = svc.getQualityReport();
		assert.strictEqual(r.totalRequests, 100, 'recent window is capped at 100');
		assert.strictEqual(r.winRate, 1, 'only the last 100 (all success) count');
		assert.strictEqual(svc.getModelSuccessRate(model('anthropic', 'claude')), 1);
	});

	test('an empty service reports zeros', () => {
		const r = new RoutingEvaluationService(fakeStorage()).getQualityReport();
		assert.strictEqual(r.totalRequests, 0);
		assert.strictEqual(r.winRate, 0);
		assert.strictEqual(r.modelPerformance.size, 0);
	});
});
