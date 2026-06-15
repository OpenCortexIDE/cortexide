/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { RoutingPolicy, ProviderName } from './cortexideSettingsTypes.js';
import { localProviderNames } from './cortexideSettingsTypes.js';
import { EgressModality, canEgress, classifyDestination, classifyProviderDestination, isLocalOnly } from './egressPolicy.js';
import { isTelemetryEnabled } from './telemetryConsent.js';

/**
 * "What can leave my machine" -- a PURE, tested egress POSTURE report.
 *
 * Given the user's current routing policy + configuration, it enumerates every network egress
 * channel CortexIDE has and says, for each, whether it is currently OPEN or BLOCKED (and why),
 * plus what data it would send and where. It is the user-facing payoff of the egress enforcement
 * wired across the app: a user who turns on local-only privacy mode can SEE that every off-machine
 * channel is blocked while local (loopback) channels still work.
 *
 * HONEST SCOPE: this reports POSTURE (what the current settings would allow/block), not a log of
 * actual past traffic -- CortexIDE does not record outbound requests. Action-level logging is a
 * separate opt-in feature (`cortexide.audit.enable`). Naming/wording must not imply a traffic audit.
 */

export interface EgressReportConfig {
	readonly routingPolicy: RoutingPolicy | undefined;
	/** The electron-main-readable local-first flag that drives the update-check gate. */
	readonly localFirstAI?: boolean;
	/** Providers the user has configured (has a key / endpoint). */
	readonly configuredProviders: ReadonlyArray<{ readonly providerName: ProviderName; readonly endpoint?: string }>;
	/** Whether an embedding provider is configured + enabled (RAG embeddings). */
	readonly embeddingsEnabled: boolean;
	readonly vectorStore: 'none' | 'qdrant' | 'chroma';
	readonly vectorStoreUrl?: string;
	/** Configured MCP servers (from mcp.json). */
	readonly mcpServers: ReadonlyArray<{ readonly name: string; readonly url?: string; readonly isStdio: boolean }>;
	/** Raw stored value of the telemetry opt-out key (OPT_OUT_KEY); undefined when never set (= opted out). */
	readonly telemetryOptOutStoredValue?: string;
}

export type EgressChannelStatus =
	/** This channel would send data off-machine and is currently allowed. */
	| 'open'
	/** This channel is blocked by the current policy (local-only). */
	| 'blocked'
	/** This channel stays on the machine (loopback / stdio) -- it never leaves. */
	| 'local'
	/** Not configured, so nothing would be sent. */
	| 'not-configured';

export interface EgressChannelReport {
	readonly modality: EgressModality;
	readonly label: string;
	readonly destination: string;
	/** What data this channel would send. */
	readonly data: string;
	readonly status: EgressChannelStatus;
	/** Why blocked, when status === 'blocked'. */
	readonly reason?: string;
}

export interface EgressReport {
	readonly localOnly: boolean;
	readonly openCount: number;
	readonly blockedCount: number;
	readonly localCount: number;
	readonly summary: string;
	readonly channels: ReadonlyArray<EgressChannelReport>;
	/** Platform-inherited egress that CortexIDE's routing gates do NOT control (honesty footnotes). */
	readonly platformNotes: ReadonlyArray<string>;
}

/**
 * Egress inherited from the VS Code platform that CortexIDE's local-only gate does NOT govern. Surfaced
 * so the report never implies local-only blocks literally everything -- these are out of CortexIDE's
 * control (or only fire on explicit user action). From the Phase 8 egress-leak audit's secondary findings.
 */
export const PLATFORM_INHERITED_EGRESS: ReadonlyArray<string> = [
	'Webviews may load UI assets from the VS Code CDN (vscode-cdn.net) -- a platform behavior, not routed through CortexIDE.',
	'If the built-in GitHub Copilot chat agent is enabled, it contacts its own endpoints, separate from CortexIDE model routing.',
	'Installing a local model from Settings runs an on-demand "curl | sh" script (ollama.com / Homebrew) -- only when you click it.',
];

function statusOf(allowed: boolean, kind: 'loopback' | 'private' | 'remote' | 'unknown' | 'stdio'): EgressChannelStatus {
	if (kind === 'loopback' || kind === 'stdio') { return 'local'; }
	return allowed ? 'open' : 'blocked';
}

/** Build the egress posture report. Pure and total. */
export function buildEgressReport(cfg: EgressReportConfig): EgressReport {
	const ctx = { routingPolicy: cfg.routingPolicy };
	const localOnly = isLocalOnly(ctx);
	const channels: EgressChannelReport[] = [];

	// 1) Cloud LLM dispatch + model-catalog refresh, per configured provider.
	for (const p of cfg.configuredProviders) {
		const kind = classifyProviderDestination(p.providerName, p.endpoint);
		const isLocalName = (localProviderNames as readonly string[]).includes(p.providerName);
		const dispatch = canEgress(ctx, { modality: 'cloud-llm', destinationKind: kind, providerName: p.providerName });
		channels.push({
			modality: 'cloud-llm',
			label: `Model dispatch: ${p.providerName}`,
			destination: p.endpoint || (isLocalName ? 'localhost (default)' : `${p.providerName} cloud API`),
			data: 'your prompts, code context, and (for cloud) the API key',
			status: statusOf(dispatch.allowed, kind),
			reason: dispatch.allowed ? undefined : dispatch.reason,
		});
		// Catalog refresh only happens for non-local cloud providers.
		if (!isLocalName) {
			const cat = canEgress(ctx, { modality: 'model-catalog', destinationKind: 'remote', providerName: p.providerName });
			channels.push({
				modality: 'model-catalog',
				label: `Model-catalog refresh: ${p.providerName}`,
				destination: `${p.providerName} cloud API`,
				data: 'the API key (to list available models)',
				status: cat.allowed ? 'open' : 'blocked',
				reason: cat.allowed ? undefined : cat.reason,
			});
		}
	}

	// 2) Web tools (web_search / browse_url) -- always present, reach the public web.
	{
		const d = canEgress(ctx, { modality: 'web-tool', destinationKind: 'remote' });
		channels.push({
			modality: 'web-tool',
			label: 'Web tools (web_search / browse_url)',
			destination: 'public web (search engines, fetched URLs)',
			data: 'your search queries and the URLs/pages the agent fetches',
			status: d.allowed ? 'open' : 'blocked',
			reason: d.allowed ? undefined : d.reason,
		});
	}

	// 3) RAG embeddings (extension-provided; destination unclassifiable -> treated as off-machine).
	if (cfg.embeddingsEnabled) {
		const d = canEgress(ctx, { modality: 'embeddings', destinationKind: 'unknown' });
		channels.push({
			modality: 'embeddings',
			label: 'RAG embeddings',
			destination: 'the configured embedding provider',
			data: 'redacted code/text to vectorize',
			status: d.allowed ? 'open' : 'blocked',
			reason: d.allowed ? undefined : d.reason,
		});
	}

	// 4) Vector store.
	if (cfg.vectorStore !== 'none') {
		const url = cfg.vectorStoreUrl || (cfg.vectorStore === 'chroma' ? 'http://localhost:8000' : 'http://localhost:6333');
		const kind = classifyDestination(url);
		const d = canEgress(ctx, { modality: 'vector-store', destinationKind: kind });
		channels.push({
			modality: 'vector-store',
			label: `Vector store (${cfg.vectorStore})`,
			destination: url,
			data: 'redacted code/text + embeddings + metadata',
			status: statusOf(d.allowed, kind),
			reason: d.allowed ? undefined : d.reason,
		});
	}

	// 5) MCP servers.
	for (const s of cfg.mcpServers) {
		const kind = s.isStdio ? 'stdio' : classifyDestination(s.url);
		const d = canEgress(ctx, { modality: 'mcp', destinationKind: s.isStdio ? undefined : classifyDestination(s.url), isStdio: s.isStdio });
		channels.push({
			modality: 'mcp',
			label: `MCP server: ${s.name}`,
			destination: s.isStdio ? 'local process (stdio)' : (s.url || 'unknown'),
			data: 'tool-call arguments and results',
			status: statusOf(d.allowed, kind),
			reason: d.allowed ? undefined : d.reason,
		});
	}

	// 6) Update check.
	{
		const d = canEgress({ routingPolicy: cfg.localFirstAI ? 'local-only' : cfg.routingPolicy }, { modality: 'update-check', destinationKind: 'remote' });
		channels.push({
			modality: 'update-check',
			label: 'Update check',
			destination: 'GitHub releases API',
			data: 'your IP address and the app version',
			status: d.allowed ? 'open' : 'blocked',
			reason: d.allowed ? undefined : d.reason,
		});
	}

	// 7) Product telemetry. Off by default (opt-IN); local-only forces it off. Mirror the SAME
	//    resolution the electron-main metrics gate uses (routingPolicy==='local-only' OR localFirstAI),
	//    via the telemetryConsent SSOT, so the report can't disagree with what actually ships.
	{
		const telemetryLocalOnly = localOnly || cfg.localFirstAI === true;
		const enabled = isTelemetryEnabled(cfg.telemetryOptOutStoredValue, telemetryLocalOnly);
		const status: EgressChannelStatus = enabled ? 'open' : (telemetryLocalOnly ? 'blocked' : 'not-configured');
		channels.push({
			modality: 'telemetry',
			label: 'Product telemetry',
			destination: 'PostHog (us.i.posthog.com)',
			data: 'anonymous usage events, app version, OS, and a generated machine id',
			status,
			reason: status === 'blocked' ? 'local-only privacy mode forces telemetry off' : undefined,
		});
	}

	const openCount = channels.filter(c => c.status === 'open').length;
	const blockedCount = channels.filter(c => c.status === 'blocked').length;
	const localCount = channels.filter(c => c.status === 'local').length;

	const summary = localOnly
		? `Local-only privacy mode is ON. ${blockedCount} off-machine channel(s) blocked; ${localCount} local channel(s) still work; ${openCount} open.`
		: `Local-only privacy mode is OFF. ${openCount} channel(s) can send data off-machine; ${localCount} stay local. Enable local-only to block all off-machine egress.`;

	return { localOnly, openCount, blockedCount, localCount, summary, channels, platformNotes: PLATFORM_INHERITED_EGRESS };
}

/** Render the report as plain ASCII text (for an output channel / copy-paste). */
export function formatEgressReport(report: EgressReport): string {
	const lines: string[] = [];
	lines.push('CortexIDE - What can leave my machine (egress posture)');
	lines.push('='.repeat(56));
	lines.push(report.summary);
	lines.push('');
	const mark = (s: EgressChannelStatus) => s === 'open' ? '[OPEN ]' : s === 'blocked' ? '[BLOCK]' : s === 'local' ? '[LOCAL]' : '[ n/a ]';
	for (const c of report.channels) {
		lines.push(`${mark(c.status)} ${c.label}`);
		lines.push(`         -> ${c.destination}`);
		lines.push(`         sends: ${c.data}`);
		if (c.reason) { lines.push(`         note: ${c.reason}`); }
	}
	if (report.platformNotes.length > 0) {
		lines.push('');
		lines.push('Platform-inherited egress NOT governed by CortexIDE local-only mode:');
		for (const note of report.platformNotes) { lines.push(`  - ${note}`); }
	}
	lines.push('');
	lines.push('Posture report only -- CortexIDE does not log actual outbound requests.');
	return lines.join('\n');
}
