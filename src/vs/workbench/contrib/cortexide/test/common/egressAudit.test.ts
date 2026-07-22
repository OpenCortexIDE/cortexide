/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { buildEgressAuditEvent, isOffMachine } from '../../common/egressAudit.js';

/**
 * Pins the egress-ledger event builder: every outbound LLM decision (allowed AND blocked) is
 * recorded with provider, destination, off-machine flag, block status, and redaction status --
 * the tamper-evident "verify us" trail neither Cursor nor Claude Code offers.
 */
suite('egressAudit.buildEgressAuditEvent', () => {

	test('an allowed remote call is recorded as off-machine, not blocked', () => {
		const e = buildEgressAuditEvent({
			ts: 1700000000000, providerName: 'anthropic', modelName: 'claude-opus-4-8',
			destinationKind: 'remote', allowed: true, redactionApplied: false,
		});
		assert.strictEqual(e.action, 'egress');
		assert.strictEqual(e.ok, true);
		assert.strictEqual(e.model, 'claude-opus-4-8');
		assert.strictEqual(e.meta!.provider, 'anthropic');
		assert.strictEqual(e.meta!.destination, 'remote');
		assert.strictEqual(e.meta!.offMachine, true);
		assert.strictEqual(e.meta!.blocked, false);
		assert.strictEqual(e.meta!.redactionApplied, false);
		assert.strictEqual(e.meta!.modality, 'cloud-llm');
	});

	test('a blocked call (local-only + remote) records ok=false, blocked=true, and the reason', () => {
		const e = buildEgressAuditEvent({
			ts: 1, providerName: 'openai', modelName: 'gpt-x',
			destinationKind: 'remote', allowed: false, reason: 'Local-only privacy mode is on.',
			redactionApplied: false,
		});
		assert.strictEqual(e.ok, false);
		assert.strictEqual(e.meta!.blocked, true);
		assert.strictEqual(e.meta!.reason, 'Local-only privacy mode is on.');
	});

	test('a loopback (Ollama) call is recorded as on-machine (offMachine=false)', () => {
		const e = buildEgressAuditEvent({
			ts: 1, providerName: 'ollama', modelName: 'qwen2.5-coder',
			destinationKind: 'loopback', allowed: true, redactionApplied: false,
		});
		assert.strictEqual(e.meta!.offMachine, false);
		assert.strictEqual(e.meta!.blocked, false);
	});

	test('redactionApplied is propagated (a secret was scrubbed from the payload)', () => {
		const e = buildEgressAuditEvent({
			ts: 1, providerName: 'anthropic', modelName: 'm',
			destinationKind: 'remote', allowed: true, redactionApplied: true,
		});
		assert.strictEqual(e.meta!.redactionApplied, true);
	});

	test('no reason field is added when the call is allowed', () => {
		const e = buildEgressAuditEvent({
			ts: 1, providerName: 'a', modelName: 'm', destinationKind: 'remote',
			allowed: true, redactionApplied: false,
		});
		assert.ok(!('reason' in e.meta!), 'reason should be omitted when there is none');
	});

	test('isOffMachine: only loopback is on-machine', () => {
		assert.strictEqual(isOffMachine('loopback'), false);
		assert.strictEqual(isOffMachine('remote'), true);
		assert.strictEqual(isOffMachine('private'), true);
		assert.strictEqual(isOffMachine('unknown'), true);
	});
});
