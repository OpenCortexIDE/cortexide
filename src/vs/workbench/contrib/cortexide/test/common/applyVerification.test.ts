/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { diffDiagnostics, summarizeApplyVerification, VerificationDiagnostic } from '../../common/applyVerification.js';

/**
 * Phase 5: pins the pure apply-verification core -- the BEFORE/AFTER diagnostics diff that lets
 * the agent surface only the problems an edit INTRODUCED (not pre-existing noise), and the
 * concise model-facing summary.
 */
suite('applyVerification', () => {

	const err = (message: string, startLine: number, code?: string): VerificationDiagnostic => ({ message, severity: 'error', startLine, code });
	const warn = (message: string, startLine: number, code?: string): VerificationDiagnostic => ({ message, severity: 'warning', startLine, code });

	test('no diagnostics before or after -> nothing introduced', () => {
		const d = diffDiagnostics([], []);
		assert.deepStrictEqual(d.introduced, []);
		assert.deepStrictEqual(d.resolved, []);
		assert.strictEqual(d.preexistingCount, 0);
	});

	test('a brand-new error after a clean file is introduced', () => {
		const d = diffDiagnostics([], [err("Cannot find name 'foo'", 10, 'ts2304')]);
		assert.strictEqual(d.introduced.length, 1);
		assert.strictEqual(d.introduced[0].startLine, 10);
		assert.strictEqual(d.resolved.length, 0);
		assert.strictEqual(d.preexistingCount, 0);
	});

	test('a pre-existing error (same kind, shifted line) is NOT introduced', () => {
		// line moved 10 -> 14 after an edit above it; same message+code -> pre-existing
		const before = [err("Cannot find name 'foo'", 10, 'ts2304')];
		const after = [err("Cannot find name 'foo'", 14, 'ts2304')];
		const d = diffDiagnostics(before, after);
		assert.strictEqual(d.introduced.length, 0);
		assert.strictEqual(d.resolved.length, 0);
		assert.strictEqual(d.preexistingCount, 1);
	});

	test('multiset: 1 pre-existing + 1 new of the same message -> exactly 1 introduced', () => {
		const before = [err('Unexpected any', 3, 'ts7006')];
		const after = [err('Unexpected any', 3, 'ts7006'), err('Unexpected any', 9, 'ts7006')];
		const d = diffDiagnostics(before, after);
		assert.strictEqual(d.introduced.length, 1);
		assert.strictEqual(d.introduced[0].startLine, 9);
		assert.strictEqual(d.preexistingCount, 1);
	});

	test('DOCUMENTED LIMITATION: a new occurrence of an already-present message is under-reported', () => {
		// 3 identical errors before (lines 1,5,10); after the edit there are still 3 of the same
		// message but one is genuinely NEW (line 15) while another was fixed -- the multiset count is
		// unchanged (3 -> 3), so the diff reports nothing introduced. This is the intentional, safer
		// trade-off (no false alarms on line shifts) documented on keyOf(); pinned here so the
		// behavior is a deliberate choice, not an accident.
		const before = [err('dup', 1), err('dup', 5), err('dup', 10)];
		const after = [err('dup', 2), err('dup', 6), err('dup', 15)];
		const d = diffDiagnostics(before, after);
		assert.strictEqual(d.introduced.length, 0, 'count-preserving same-message set reports nothing introduced (documented under-report)');
		assert.strictEqual(d.preexistingCount, 3);
		// By contrast, a NET-NEW occurrence (count increases) IS reported:
		const d2 = diffDiagnostics([err('dup', 1)], [err('dup', 1), err('dup', 9)]);
		assert.strictEqual(d2.introduced.length, 1);
	});

	test('an edit that fixes an error -> resolved, none introduced', () => {
		const before = [err("Cannot find name 'foo'", 10, 'ts2304')];
		const after: VerificationDiagnostic[] = [];
		const d = diffDiagnostics(before, after);
		assert.strictEqual(d.introduced.length, 0);
		assert.strictEqual(d.resolved.length, 1);
		assert.strictEqual(d.preexistingCount, 0);
	});

	test('mixed: introduces one, resolves another, keeps a third', () => {
		const before = [err('A', 1, 'a'), err('B', 2, 'b')];
		const after = [err('B', 5, 'b'), err('C', 9, 'c')];
		const d = diffDiagnostics(before, after);
		assert.deepStrictEqual(d.introduced.map(x => x.message), ['C']);
		assert.deepStrictEqual(d.resolved.map(x => x.message), ['A']);
		assert.strictEqual(d.preexistingCount, 1); // B
	});

	test('severity is part of the identity (warning vs error of same text differ)', () => {
		const before = [warn('shadowed var', 4)];
		const after = [warn('shadowed var', 4), err('shadowed var', 4)];
		const d = diffDiagnostics(before, after);
		assert.strictEqual(d.introduced.length, 1);
		assert.strictEqual(d.introduced[0].severity, 'error');
	});

	test('summarize: no new problems -> message null', () => {
		const d = diffDiagnostics([err('A', 1)], [err('A', 3)]);
		const s = summarizeApplyVerification(d, 'foo.ts');
		assert.strictEqual(s.hasNewProblems, false);
		assert.strictEqual(s.message, null);
		assert.strictEqual(s.newErrorCount, 0);
	});

	test('summarize: new errors+warnings -> message lists errors first, with counts', () => {
		const d = diffDiagnostics([], [warn('w1', 7), err('e1', 3, 'ts1'), err('e2', 5)]);
		const s = summarizeApplyVerification(d, 'foo.ts');
		assert.strictEqual(s.hasNewProblems, true);
		assert.strictEqual(s.newErrorCount, 2);
		assert.strictEqual(s.newWarningCount, 1);
		assert.ok(s.message!.includes('foo.ts'));
		assert.ok(s.message!.includes('2 new errors, 1 new warning'));
		// errors listed before the warning
		const idxE1 = s.message!.indexOf('e1');
		const idxW1 = s.message!.indexOf('w1');
		assert.ok(idxE1 < idxW1 && idxE1 !== -1, 'errors should be listed before warnings');
		assert.ok(s.message!.includes('NOT present before'), 'message should attribute the problems to the edit');
		assert.ok(s.message!.includes('(ts1)'), 'should include the diagnostic code when present');
	});

	test('summarize: singular vs plural wording', () => {
		const s = summarizeApplyVerification(diffDiagnostics([], [err('only one', 1)]), 'x.ts');
		assert.ok(s.message!.includes('1 new error,'), 'singular error');
		assert.ok(s.message!.includes('0 new warnings'), 'plural zero warnings');
	});

	test('summarize: truncates a long list and notes the remainder', () => {
		const many: VerificationDiagnostic[] = [];
		for (let i = 0; i < 25; i++) { many.push(err(`e${i}`, i + 1)); }
		const s = summarizeApplyVerification(diffDiagnostics([], many), 'big.ts');
		assert.ok(s.message!.includes('... and 5 more'), 'should note 25 - 20 = 5 more');
		assert.strictEqual(s.newErrorCount, 25);
	});
});
