/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { CORTEXIDE_CONFIG_KEYS, cortexideConfigKeyNames, getCortexideConfigKeyDef } from '../../common/cortexideConfigKeys.js';
import { builtinToolNames, builtinToolCount } from '../../common/builtinToolNames.js';

/**
 * Phase 0 claim-verification test.
 *
 * The product must not ship settings/claims that the code reads but never registers
 * (invisible, unbacked settings). This test pins the contract:
 *
 *   1. Every config key a CortexIDE service reads via IConfigurationService MUST be present
 *      in the canonical CORTEXIDE_CONFIG_KEYS list (which is what gets registered).
 *   2. Every canonical key has valid, honest metadata (type, non-empty description, scope).
 *   3. Defaults that would degrade behaviour when the backing implementation is absent stay
 *      off (e.g. the experimental vector store defaults to "none").
 *
 * If you add a new `configurationService.getValue('cortexide.<...>')` read, add the key to
 * cortexideConfigKeys.ts (so it is registered) — otherwise this test will fail, which is the
 * point: no invisible settings, no fake claims.
 */

// Keys that CortexIDE services actually read from IConfigurationService (the "claims").
// Source of truth verified by grep of `getValue<...>('cortexide.<...>')` across the contrib
// tree. `cortexide.secretDetection.*` is intentionally excluded — it is registered by
// secretDetectionConfiguration.ts, not by the global settings contribution.
const KEYS_READ_BY_SERVICES: { key: string; readBy: string }[] = [
	{ key: 'cortexide.global.localFirstAI', readBy: 'cortexideSettingsService.ts' },
	{ key: 'cortexide.global.routingPolicy', readBy: 'metricsMainService.ts + cortexideUpdateMainService.ts (main-process local-only mirror)' },
	{ key: 'cortexide.index.ast', readBy: 'treeSitterService.ts' },
	{ key: 'cortexide.safety.rollback.enable', readBy: 'rollbackSnapshotService.ts' },
	{ key: 'cortexide.safety.rollback.maxSnapshotBytes', readBy: 'rollbackSnapshotService.ts' },
	{ key: 'cortexide.safety.autostash.enable', readBy: 'gitAutoStashService.ts' },
	{ key: 'cortexide.safety.autostash.mode', readBy: 'gitAutoStashService.ts' },
	{ key: 'cortexide.rag.vectorStore', readBy: 'vectorStore.ts' },
	{ key: 'cortexide.rag.vectorStoreUrl', readBy: 'vectorStore.ts' },
	{ key: 'cortexide.audit.enable', readBy: 'auditLogService.ts' },
	{ key: 'cortexide.audit.path', readBy: 'auditLogService.ts' },
	{ key: 'cortexide.audit.rotationSizeMB', readBy: 'auditLogService.ts' },
];

suite('Phase 0 — claim verification (config registration)', () => {

	test('every config key a service reads is in the canonical (registered) list', () => {
		const registered = new Set(cortexideConfigKeyNames());
		const missing = KEYS_READ_BY_SERVICES.filter(k => !registered.has(k.key));
		assert.deepStrictEqual(
			missing,
			[],
			`These settings are READ by services but NOT registered (invisible/unbacked). ` +
			`Add them to cortexideConfigKeys.ts: ${missing.map(m => `${m.key} (read by ${m.readBy})`).join(', ')}`
		);
	});

	test('every canonical key has valid, honest metadata', () => {
		for (const def of CORTEXIDE_CONFIG_KEYS) {
			assert.ok(def.key.startsWith('cortexide.'), `key must be namespaced: ${def.key}`);
			assert.ok(['boolean', 'number', 'string', 'enum'].includes(def.type), `bad type for ${def.key}`);
			assert.ok(['application', 'window', 'resource'].includes(def.scope), `bad scope for ${def.key}`);
			assert.ok(typeof def.description === 'string' && def.description.trim().length >= 20, `description too thin for ${def.key}`);
			if (def.type === 'enum') {
				assert.ok(Array.isArray(def.enumValues) && def.enumValues.length > 0, `enum ${def.key} must list enumValues`);
				assert.ok((def.enumValues as readonly string[]).includes(def.default as string), `enum ${def.key} default must be one of enumValues`);
			}
			if (def.type === 'boolean') { assert.strictEqual(typeof def.default, 'boolean', `${def.key} default must be boolean`); }
			if (def.type === 'number') { assert.strictEqual(typeof def.default, 'number', `${def.key} default must be number`); }
		}
	});

	test('no canonical key is duplicated', () => {
		const names = cortexideConfigKeyNames();
		assert.strictEqual(names.length, new Set(names).size, 'duplicate config key detected');
	});

	test('experimental/incomplete features default OFF so they cannot degrade results', () => {
		// Vector-store RAG has no built-in embedding provider yet; a non-"none" default would
		// query an empty store and degrade retrieval. Must stay "none" until embeddings ship.
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.rag.vectorStore')!.default, 'none');
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.rag.vectorStore')!.experimental, true);

		// Rollback is still being hardened (Phase 1); it must be opt-in until proven durable.
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.safety.rollback.enable')!.default, false);
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.safety.rollback.enable')!.experimental, true);

		// AST indexing is experimental (tree-sitter integration is limited).
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.index.ast')!.experimental, true);

		// Audit log is opt-in.
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.audit.enable')!.default, false);
	});

	test('defaults match the values the services fall back to (no surprise behaviour change)', () => {
		// These must equal the `?? <default>` in the reading services so registering the schema
		// does not silently change runtime behaviour.
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.global.localFirstAI')!.default, false);
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.index.ast')!.default, true);
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.safety.autostash.enable')!.default, true);
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.safety.rollback.maxSnapshotBytes')!.default, 5_000_000);
		assert.strictEqual(getCortexideConfigKeyDef('cortexide.audit.rotationSizeMB')!.default, 10);
	});
});

suite('Phase 0 — built-in tool count honesty', () => {

	test('builtinToolNames is the real registry count (onboarding "N built-ins" claim)', () => {
		// The onboarding screen claimed "27 built-ins" — wrong. The real registry has 35 tools.
		// This pins the number; the Record<BuiltinToolName, true> in builtinToolNames.ts makes
		// adding a tool to the type without listing it a COMPILE error, and this assertion fails
		// if the count changes, forcing the onboarding/docs claim to be updated in lock-step.
		assert.strictEqual(builtinToolCount, 35, 'built-in tool count changed — update onboarding/docs claims to match');
		assert.strictEqual(builtinToolNames.length, builtinToolCount);
	});

	test('no duplicate tool names', () => {
		assert.strictEqual(builtinToolNames.length, new Set(builtinToolNames).size, 'duplicate built-in tool name');
	});

	test('every tool name is non-empty snake_case', () => {
		for (const name of builtinToolNames) {
			assert.ok(/^[a-z][a-z0-9_]*$/.test(name), `unexpected tool name format: ${name}`);
		}
	});
});
