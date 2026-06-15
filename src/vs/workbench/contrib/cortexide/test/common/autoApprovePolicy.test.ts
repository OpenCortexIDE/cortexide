/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { decideAutoApprove, computeAutoApproveBaseline, AutoApproveInputs } from '../../common/autoApprovePolicy.js';

/**
 * The auto-approve safety boundary (extracted from chatThreadService). The golden table pins each
 * override; the differential fuzz re-implements the OLD inline mutation order independently and asserts
 * the extracted decision matches it on every input combination (byte-identity of the safety decision).
 */

const base: AutoApproveInputs = {
	approvalType: 'MCP tools',
	autoApproveSetting: undefined,
	isEditOperation: false,
};

suite('autoApprovePolicy.computeAutoApproveBaseline', () => {
	test("'edits' defaults to TRUE when the setting is unset", () => {
		assert.strictEqual(computeAutoApproveBaseline('edits', undefined), true);
	});
	test('every other type defaults to FALSE when unset', () => {
		assert.strictEqual(computeAutoApproveBaseline('terminal', undefined), false);
		assert.strictEqual(computeAutoApproveBaseline('MCP tools', undefined), false);
	});
	test('an explicit setting wins for any type', () => {
		assert.strictEqual(computeAutoApproveBaseline('edits', false), false);
		assert.strictEqual(computeAutoApproveBaseline('terminal', true), true);
	});
});

suite('autoApprovePolicy.decideAutoApprove - golden table', () => {

	test('unset non-edit type -> require approval', () => {
		assert.strictEqual(decideAutoApprove(base).outcome, 'require-approval');
	});

	test('edits unset -> auto-approve (the backward-compatible default)', () => {
		assert.strictEqual(decideAutoApprove({ ...base, approvalType: 'edits', isEditOperation: true }).outcome, 'auto-approve');
	});

	test('CATASTROPHIC terminal command -> hard-block (never even offered)', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'terminal', autoApproveSetting: true, commandRisk: { hardBlock: true, requiresApproval: true } });
		assert.strictEqual(d.outcome, 'hard-block');
	});

	test('DANGEROUS terminal command cannot be auto-approved even when the setting is true', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'terminal', autoApproveSetting: true, commandRisk: { hardBlock: false, requiresApproval: true } });
		assert.strictEqual(d.outcome, 'require-approval');
		assert.strictEqual(d.dangerousCommandForcedApproval, true);
	});

	test('dangerous-command flag does NOT fire when the baseline was already off (mirrors the && guard)', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'terminal', autoApproveSetting: false, commandRisk: { hardBlock: false, requiresApproval: true } });
		assert.strictEqual(d.dangerousCommandForcedApproval, false);
	});

	test('cwd escaping the workspace forces approval', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'terminal', autoApproveSetting: true, commandRisk: { hardBlock: false, requiresApproval: false }, cwdEscapes: true });
		assert.strictEqual(d.outcome, 'require-approval');
		assert.strictEqual(d.cwdEscapeForcedApproval, true);
	});

	test('YOLO NL-command heuristic auto-approves', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'terminal', autoApproveSetting: false, nlCommandYoloSafe: true });
		assert.strictEqual(d.outcome, 'auto-approve');
		assert.strictEqual(d.yoloNlAutoApproved, true);
	});

	test('HIGH-risk edit cannot be auto-approved despite the setting being true', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'edits', autoApproveSetting: true, isEditOperation: true, editRisk: { riskLevel: 'HIGH', riskScore: 0.8, confidenceScore: 0.9 } });
		assert.strictEqual(d.outcome, 'require-approval');
		assert.strictEqual(d.highRiskBlockedDespiteAutoApprove, true);
	});

	test('YOLO low-risk + high-confidence edit auto-approves even when the setting is false', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'edits', autoApproveSetting: false, isEditOperation: true, editRisk: { riskLevel: 'LOW', riskScore: 0.1, confidenceScore: 0.9 }, yolo: { enabled: true, riskThreshold: 0.2, confidenceThreshold: 0.7 } });
		assert.strictEqual(d.outcome, 'auto-approve');
		assert.strictEqual(d.yoloEditAutoApproved, true);
	});

	test('YOLO thresholds at the boundary do NOT approve (strict <, strict >)', () => {
		// riskScore == threshold (not <) and confidence == threshold (not >)
		const d = decideAutoApprove({ ...base, approvalType: 'edits', autoApproveSetting: false, isEditOperation: true, editRisk: { riskLevel: 'LOW', riskScore: 0.2, confidenceScore: 0.7 }, yolo: { enabled: true, riskThreshold: 0.2, confidenceThreshold: 0.7 } });
		assert.strictEqual(d.outcome, 'require-approval');
		assert.strictEqual(d.yoloEditAutoApproved, false);
	});

	test('edit-risk overrides are skipped when scoring failed (editRisk undefined)', () => {
		const d = decideAutoApprove({ ...base, approvalType: 'edits', autoApproveSetting: true, isEditOperation: true, editRisk: undefined });
		assert.strictEqual(d.outcome, 'auto-approve'); // baseline survives
	});
});

// ---- Differential fuzz: re-implement the OLD inline order independently and compare ----

// Faithful re-implementation of the pre-extraction inline mutation order (only the final boolean +
// outcome; this is the oracle the extracted fn must match).
function oldInlineOutcome(inp: AutoApproveInputs): 'hard-block' | 'auto-approve' | 'require-approval' {
	if (inp.commandRisk?.hardBlock) { return 'hard-block'; }
	let shouldAutoApprove: boolean | undefined = inp.autoApproveSetting;
	if (inp.approvalType === 'edits' && shouldAutoApprove === undefined) { shouldAutoApprove = true; }
	if (inp.commandRisk?.requiresApproval && shouldAutoApprove) { shouldAutoApprove = false; }
	if (shouldAutoApprove && inp.cwdEscapes) { shouldAutoApprove = false; }
	if (inp.nlCommandYoloSafe) { shouldAutoApprove = true; }
	if (inp.isEditOperation && inp.editRisk) {
		if (shouldAutoApprove && inp.editRisk.riskLevel === 'HIGH') { shouldAutoApprove = false; }
		if (inp.yolo?.enabled && inp.editRisk.riskScore < inp.yolo.riskThreshold && inp.editRisk.confidenceScore > inp.yolo.confidenceThreshold) { shouldAutoApprove = true; }
	}
	return shouldAutoApprove ? 'auto-approve' : 'require-approval';
}

function mulberry32(a: number): () => number {
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

suite('autoApprovePolicy.decideAutoApprove - differential fuzz vs the old inline order', () => {
	test('matches the original mutation order on every input combination (30k random cases)', () => {
		const rnd = mulberry32(0xA117);
		const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
		const maybe = <T>(x: T): T | undefined => rnd() < 0.5 ? x : undefined;
		const levels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
		const types = ['edits', 'terminal', 'MCP tools', 'other'];

		for (let i = 0; i < 30000; i++) {
			const inp: AutoApproveInputs = {
				approvalType: pick(types),
				autoApproveSetting: pick([true, false, undefined as unknown as boolean]),
				isEditOperation: rnd() < 0.5,
				commandRisk: maybe({ hardBlock: rnd() < 0.3, requiresApproval: rnd() < 0.5 }),
				cwdEscapes: rnd() < 0.5,
				nlCommandYoloSafe: rnd() < 0.3,
				editRisk: maybe({ riskLevel: pick(levels), riskScore: Math.floor(rnd() * 100) / 100, confidenceScore: Math.floor(rnd() * 100) / 100 }),
				yolo: maybe({ enabled: rnd() < 0.6, riskThreshold: pick([0.1, 0.2, 0.3]), confidenceThreshold: pick([0.6, 0.7, 0.8]) }),
			};
			assert.strictEqual(decideAutoApprove(inp).outcome, oldInlineOutcome(inp), `mismatch for ${JSON.stringify(inp)}`);
		}
	});
});
