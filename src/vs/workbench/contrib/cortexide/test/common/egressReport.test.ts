/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { buildEgressReport, formatEgressReport, EgressReportConfig } from '../../common/egressReport.js';

/**
 * Phase 8 Inc 7b: the "what can leave my machine" egress posture report. Also serves as the
 * consolidated GUARANTEE test: with a realistic configuration, flipping to local-only must
 * leave ZERO off-machine channels open while local (loopback/stdio) channels still work.
 */
suite('egressReport', () => {

	// A realistic, fully-loaded configuration touching every channel.
	const fullConfig = (routingPolicy: EgressReportConfig['routingPolicy'], localFirstAI = false): EgressReportConfig => ({
		routingPolicy,
		localFirstAI,
		configuredProviders: [
			{ providerName: 'anthropic' },                                   // cloud
			{ providerName: 'openAI' },                                      // cloud
			{ providerName: 'ollama', endpoint: 'http://127.0.0.1:11434' },  // local loopback
			{ providerName: 'openAICompatible', endpoint: 'https://api.together.xyz' }, // cloud via endpoint
		],
		embeddingsEnabled: true,
		vectorStore: 'qdrant',
		vectorStoreUrl: 'https://qdrant.example.com:6333',                  // remote
		mcpServers: [
			{ name: 'fs', isStdio: true },                                   // local stdio
			{ name: 'localdocs', url: 'http://localhost:3000/sse', isStdio: false }, // loopback
			{ name: 'remoteapi', url: 'https://mcp.example.com/sse', isStdio: false }, // remote
		],
	});

	test('GUARANTEE: under local-only, NO off-machine channel is open; local channels still work', () => {
		const report = buildEgressReport(fullConfig('local-only'));
		assert.strictEqual(report.localOnly, true);
		assert.strictEqual(report.openCount, 0, `expected 0 open channels under local-only, got ${report.openCount}: ${report.channels.filter(c => c.status === 'open').map(c => c.label).join(', ')}`);
		// loopback ollama, loopback MCP, stdio MCP stay local and usable
		assert.ok(report.localCount >= 3, `expected local channels to remain usable, got ${report.localCount}`);
		// every blocked channel has a reason
		for (const c of report.channels) {
			if (c.status === 'blocked') { assert.ok(c.reason && c.reason.length > 0, `blocked ${c.label} missing reason`); }
		}
		// specific off-machine channels are blocked
		const byLabel = (s: string) => report.channels.find(c => c.label.includes(s))!;
		assert.strictEqual(byLabel('anthropic').status, 'blocked');
		assert.strictEqual(byLabel('Model dispatch: openAI').status, 'blocked');
		assert.strictEqual(byLabel('openAICompatible').status, 'blocked');     // cloud via endpoint
		assert.strictEqual(byLabel('Web tools').status, 'blocked');
		assert.strictEqual(byLabel('RAG embeddings').status, 'blocked');
		assert.strictEqual(byLabel('Vector store').status, 'blocked');
		assert.strictEqual(byLabel('remoteapi').status, 'blocked');
		assert.strictEqual(byLabel('Update check').status, 'blocked');
		// local channels stay local
		assert.strictEqual(byLabel('Model dispatch: ollama').status, 'local');
		assert.strictEqual(byLabel('MCP server: fs').status, 'local');         // stdio
		assert.strictEqual(byLabel('MCP server: localdocs').status, 'local');  // loopback
	});

	test('under local-only via the localFirstAI flag, update check is also blocked', () => {
		const report = buildEgressReport(fullConfig('auto-cheapest', /*localFirstAI*/ true));
		const update = report.channels.find(c => c.modality === 'update-check')!;
		assert.strictEqual(update.status, 'blocked');
	});

	test('NOT local-only: cloud channels are open, local channels are local', () => {
		const report = buildEgressReport(fullConfig('auto-cheapest'));
		assert.strictEqual(report.localOnly, false);
		const byLabel = (s: string) => report.channels.find(c => c.label.includes(s))!;
		assert.strictEqual(byLabel('anthropic').status, 'open');
		assert.strictEqual(byLabel('Web tools').status, 'open');
		assert.strictEqual(byLabel('Vector store').status, 'open');
		assert.strictEqual(byLabel('remoteapi').status, 'open');
		assert.strictEqual(byLabel('Update check').status, 'open');
		// local stay local even when not local-only
		assert.strictEqual(byLabel('Model dispatch: ollama').status, 'local');
		assert.strictEqual(byLabel('MCP server: fs').status, 'local');
		assert.ok(report.openCount > 0);
	});

	test('an all-local setup reports zero off-machine egress even when NOT local-only', () => {
		const report = buildEgressReport({
			routingPolicy: 'auto-cheapest',
			configuredProviders: [{ providerName: 'ollama', endpoint: 'http://127.0.0.1:11434' }],
			embeddingsEnabled: false,
			vectorStore: 'qdrant',
			vectorStoreUrl: 'http://localhost:6333',
			mcpServers: [{ name: 'fs', isStdio: true }],
		});
		// only the always-present web-tool + update-check rows are off-machine-capable
		const offMachineOpen = report.channels.filter(c => c.status === 'open');
		// web tools + update check are 'open' (auto-cheapest); everything configured is local
		assert.ok(offMachineOpen.every(c => c.modality === 'web-tool' || c.modality === 'update-check'));
		assert.strictEqual(report.channels.find(c => c.label.includes('ollama'))!.status, 'local');
		assert.strictEqual(report.channels.find(c => c.label.includes('Vector store'))!.status, 'local');
	});

	test('formatEgressReport renders ASCII with markers and the posture disclaimer', () => {
		const text = formatEgressReport(buildEgressReport(fullConfig('local-only')));
		assert.ok(text.includes('[BLOCK]'), 'should mark blocked channels');
		assert.ok(text.includes('[LOCAL]'), 'should mark local channels');
		assert.ok(text.includes('does not log actual outbound requests'), 'should disclaim it is posture, not a traffic log');
		// ASCII only
		// eslint-disable-next-line no-control-regex
		assert.ok(/^[\x00-\x7F]*$/.test(text), 'report text must be ASCII');
	});

	test('report surfaces platform-inherited egress it does NOT govern (honesty, not over-claim)', () => {
		const report = buildEgressReport(fullConfig('local-only'));
		assert.ok(report.platformNotes.length >= 3, 'should list the known platform-inherited egress');
		assert.ok(report.platformNotes.some(n => n.includes('vscode-cdn.net')), 'webview CDN note');
		assert.ok(report.platformNotes.some(n => n.toLowerCase().includes('copilot')), 'built-in agent note');
		assert.ok(report.platformNotes.some(n => n.includes('curl')), 'on-demand installer note');
		// and it renders into the formatted text under a clear heading
		const text = formatEgressReport(report);
		assert.ok(text.includes('Platform-inherited egress NOT governed'), 'notes heading must render');
	});

	test('no configured providers + no extras: minimal report still total', () => {
		const report = buildEgressReport({
			routingPolicy: undefined,
			configuredProviders: [],
			embeddingsEnabled: false,
			vectorStore: 'none',
			mcpServers: [],
		});
		// web-tool + update-check + telemetry rows are always present
		assert.strictEqual(report.channels.length, 3);
		assert.ok(report.channels.some(c => c.modality === 'web-tool'));
		assert.ok(report.channels.some(c => c.modality === 'update-check'));
		assert.ok(report.channels.some(c => c.modality === 'telemetry'));
	});

	test('telemetry channel: off by default (opt-IN), opens only when explicitly opted in, local-only forces it off', () => {
		const base: EgressReportConfig = { routingPolicy: 'auto-cheapest', configuredProviders: [], embeddingsEnabled: false, vectorStore: 'none', mcpServers: [] };
		const tel = (cfg: EgressReportConfig) => buildEgressReport(cfg).channels.find(c => c.modality === 'telemetry')!;

		// default: OPT_OUT_KEY never set -> opted out -> nothing sent
		assert.strictEqual(tel(base).status, 'not-configured');
		// 'true' is also opted out
		assert.strictEqual(tel({ ...base, telemetryOptOutStoredValue: 'true' }).status, 'not-configured');
		// explicit opt-in ('false') and not local-only -> open
		assert.strictEqual(tel({ ...base, telemetryOptOutStoredValue: 'false' }).status, 'open');
		// opted in but local-only -> forced off (blocked) with a reason
		const blocked = tel({ ...base, routingPolicy: 'local-only', telemetryOptOutStoredValue: 'false' });
		assert.strictEqual(blocked.status, 'blocked');
		assert.ok(blocked.reason && blocked.reason.length > 0);
		// opted in but local-only via the localFirstAI flag -> also forced off
		assert.strictEqual(tel({ ...base, localFirstAI: true, telemetryOptOutStoredValue: 'false' }).status, 'blocked');
	});
});
