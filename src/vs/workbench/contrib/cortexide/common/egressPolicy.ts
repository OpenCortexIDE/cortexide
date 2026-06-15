/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { RoutingPolicy, ProviderName } from './cortexideSettingsTypes.js';
import { localProviderNames } from './cortexideSettingsTypes.js';

/**
 * Pure local-only / privacy EGRESS policy.
 *
 * This is the single source of truth for the question "is CortexIDE allowed to send
 * this byte off the user's machine right now?". It exists because the previous
 * `OfflinePrivacyGate` was FAKE SAFETY -- it only checked `navigator.onLine` and never
 * enforced privacy/local-only at all, while the only real enforcement (the model router
 * preferring local models) is a routing *preference*, not a hard egress boundary. A user
 * who enables local-only privacy mode must get a TESTED guarantee that nothing leaves the
 * machine: not a manually-selected cloud model, not web tools, not a remote MCP server,
 * not remote embeddings / vector stores, not remote model-catalog refreshes, not the
 * update check.
 *
 * The module is intentionally PURE (no VS Code runtime deps; type-only imports plus the
 * `localProviderNames` const) so it can be exhaustively node-unit-tested, mirroring
 * `toolPermissions.ts` / `agentLoopDecisions.ts`.
 *
 * The canonical hard boundary is `routingPolicy === 'local-only'` (the deprecated
 * `localFirstAI` flag migrates onto it). The decision is fundamentally DESTINATION based:
 * a request that provably never leaves the machine (`loopback`) is always allowed; every
 * other destination (`private` LAN, `remote` public, or `unknown`/unresolved) is blocked
 * under local-only -- fail-closed, the same philosophy as the SSRF guard.
 */

export type EgressModality =
	| 'cloud-llm'
	| 'web-tool'
	| 'mcp'
	| 'embeddings'
	| 'vector-store'
	| 'model-catalog'
	| 'update-check'
	| 'telemetry';

export type EgressDestinationKind =
	/** localhost / 127.0.0.0/8 / ::1 / 0.0.0.0 / *.localhost -- never leaves the machine. */
	| 'loopback'
	/** RFC1918 / link-local / IPv6 ULA / 169.254 -- LAN or metadata; off-machine. */
	| 'private'
	/** A public, off-machine address. */
	| 'remote'
	/** Unparseable, or a DNS hostname we did not resolve. Treated as off-machine (fail-closed). */
	| 'unknown';

export interface EgressContext {
	/** The canonical hard boundary. `'local-only'` means "never leaves this machine". */
	readonly routingPolicy: RoutingPolicy | undefined;
	/** Task-level privacy requirement (e.g. media present + remote-model use not permitted). */
	readonly requiresPrivacy?: boolean;
}

export interface EgressRequest {
	readonly modality: EgressModality;
	/** Destination classification. Defaults to `'unknown'` (fail-closed) when omitted. */
	readonly destinationKind?: EgressDestinationKind;
	/** For diagnostics in the block reason (cloud-llm / model-catalog). */
	readonly providerName?: ProviderName;
	/** MCP only: a stdio transport spawns a LOCAL child process and never reaches the network. */
	readonly isStdio?: boolean;
}

export interface EgressDecision {
	readonly allowed: boolean;
	/** Human-readable explanation when blocked. Undefined when allowed. */
	readonly reason?: string;
}

/**
 * The single boolean every egress gate keys off. Local-only privacy mode is active when the
 * routing policy is the hard `'local-only'` boundary, OR a specific task requires privacy.
 */
export function isLocalOnly(ctx: EgressContext): boolean {
	return ctx.routingPolicy === 'local-only' || ctx.requiresPrivacy === true;
}

/**
 * Resolve local-only for electron-main gates (telemetry, update check), which can't read the
 * renderer's GlobalSettings.routingPolicy directly. Reads the main-readable `cortexide.global.routingPolicy`
 * mirror with the deprecated `localFirstAI` flag as a fail-safe fallback (EITHER signal => local-only).
 */
export function resolveLocalOnlyForMainProcess(routingPolicyConfigValue: string | undefined, localFirstAIConfigValue: boolean | undefined): boolean {
	return routingPolicyConfigValue === 'local-only' || localFirstAIConfigValue === true;
}

/** Classify an IPv4 literal (by its first two octets) into a destination kind. */
function classifyV4(a: number, b: number): EgressDestinationKind {
	if (a === 0 || a === 127) { return 'loopback'; } // 0.0.0.0 unspecified + 127/8 loopback
	if (a === 10) { return 'private'; }
	if (a === 192 && b === 168) { return 'private'; }
	if (a === 172 && b >= 16 && b <= 31) { return 'private'; }
	if (a === 169 && b === 254) { return 'private'; } // link-local incl. cloud metadata
	return 'remote'; // any other IPv4 literal is public
}

/**
 * Decode an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) into octets. Handles BOTH the
 * dotted-decimal form and the hex-canonicalized form (`::ffff:7f00:1`) that Node's WHATWG
 * URL parser produces, so a mapped loopback/private address is never mis-seen as public.
 * Returns null when the compact string is not an IPv4-mapped address.
 */
function decodeV4Mapped(compact: string): [number, number, number, number] | null {
	const m = compact.match(/^::ffff:(.+)$/i);
	if (!m) { return null; }
	const rest = m[1];
	const dotted = rest.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (dotted) { return [Number(dotted[1]), Number(dotted[2]), Number(dotted[3]), Number(dotted[4])]; }
	const groups = rest.split(':');
	if (groups.length < 1 || groups.length > 2) { return null; }
	for (const g of groups) { if (!/^[0-9a-f]{1,4}$/i.test(g)) { return null; } }
	const hi = groups.length === 2 ? parseInt(groups[0], 16) : 0;
	const lo = parseInt(groups[groups.length - 1], 16);
	const val = (((hi << 16) >>> 0) + lo) >>> 0;
	return [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
}

/**
 * Classify a URL string into an {@link EgressDestinationKind} without doing DNS resolution.
 * The IP/loopback rules follow `assertNotSSRF` (toolsService.ts) so SSRF and egress agree on
 * what "local" means, and additionally decode IPv4-mapped IPv6 correctly (the dotted regex in
 * `assertNotSSRF` misses Node's hex-canonicalized form). A bare/unparseable URL or a
 * non-localhost DNS hostname is `'unknown'` (fail-closed under local-only).
 */
export function classifyDestination(rawUrl: string | undefined | null): EgressDestinationKind {
	if (!rawUrl) { return 'unknown'; }
	let parsed: URL;
	try { parsed = new URL(rawUrl); } catch { return 'unknown'; }
	const host = parsed.hostname.toLowerCase();
	if (!host) { return 'unknown'; }

	// localhost variants.
	if (host === 'localhost' || host.endsWith('.localhost')) { return 'loopback'; }

	// The IP-literal / IPv6 / unknown-hostname rules are shared with classifyResolvedAddress.
	return classifyResolvedAddress(host);
}

/**
 * Classify a RAW resolved IP string (NOT a URL) into an {@link EgressDestinationKind}. This is the
 * building block for an SSRF DNS-rebind preflight: resolve a hostname to its IP, then classify that IP so
 * a name that points at a loopback/private/cloud-metadata address is caught even though the hostname looked
 * public. Reuses the exact IPv4 / IPv4-mapped-IPv6 / IPv6 rules as classifyDestination; a non-IP string
 * (a bare hostname) is 'unknown'. Brackets around an IPv6 literal are tolerated.
 */
export function classifyResolvedAddress(ip: string | undefined | null): EgressDestinationKind {
	const host = (ip ?? '').trim().toLowerCase();
	if (!host) { return 'unknown'; }

	// IPv6 literals (with or without brackets).
	if (host.includes(':')) {
		const compact = host.replace(/^\[|\]$/g, '');
		const mapped = decodeV4Mapped(compact);
		if (mapped) { return classifyV4(mapped[0], mapped[1]); }
		if (compact === '::' || compact === '::1') { return 'loopback'; }
		if (/^fe[89ab][0-9a-f]?:/i.test(compact)) { return 'private'; } // fe80::/10 link-local
		if (/^f[cd][0-9a-f]{2}:/i.test(compact)) { return 'private'; } // fc00::/7 unique-local
		return 'remote';
	}

	// IPv4 literal.
	const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) { return classifyV4(Number(v4[1]), Number(v4[2])); }

	// Not an IP literal (a bare hostname) -- caller resolves it; here we cannot say.
	return 'unknown';
}

/** Whether a resolved IP is an internal target an SSRF guard must block (loopback or private/link-local). */
export function isPrivateResolvedIP(ip: string | undefined | null): boolean {
	const kind = classifyResolvedAddress(ip);
	return kind === 'loopback' || kind === 'private';
}

/**
 * Classify where a model provider would dispatch to. `ollama`/`vLLM`/`lmStudio` default to
 * loopback; `openAICompatible`/`liteLLM`/`awsBedrock` and all cloud providers are classified
 * from their configured endpoint URL when one is given (else treated as remote). This lets
 * the dispatch-layer gate work from the resolved endpoint, so even a `local` provider that
 * has been pointed at a remote host is correctly blocked under local-only.
 */
export function classifyProviderDestination(providerName: ProviderName, endpointUrl?: string | null): EgressDestinationKind {
	// When a NON-EMPTY endpoint is configured, the endpoint is the truth (a "local" provider
	// pointed at a remote box is NOT local). An empty/absent endpoint (e.g. openAICompatible's
	// default '') intentionally falls through to the provider-name default below -- so a local
	// provider with no explicit endpoint still resolves to its loopback default rather than being
	// mis-classified as 'unknown'. (A truthy check, not `!= null`, is required for this.)
	if (endpointUrl) { return classifyDestination(endpointUrl); }
	// No endpoint configured: local-named providers default to their loopback endpoint.
	if ((localProviderNames as readonly string[]).includes(providerName)) { return 'loopback'; }
	// Everything else (cloud providers, or an OpenAI-compatible/LiteLLM/Bedrock with no
	// endpoint resolved here) is treated as remote -- fail-closed.
	return 'remote';
}

/**
 * Defense-in-depth gate for the LLM dispatch layer: compose provider/endpoint classification
 * with the cloud-llm egress decision. `localOnly` is computed by the caller directly from the
 * routing policy (NOT from the router's model choice), so even a router bug or a manually
 * selected cloud model is blocked before any prompt or API key leaves the machine. A local
 * provider on loopback (the common case) is allowed.
 */
export function canDispatchToProvider(localOnly: boolean, providerName: ProviderName, endpointUrl?: string | null): EgressDecision {
	return canEgress(
		{ routingPolicy: localOnly ? 'local-only' : undefined },
		{ modality: 'cloud-llm', destinationKind: classifyProviderDestination(providerName, endpointUrl), providerName }
	);
}

function kindLabel(kind: EgressDestinationKind): string {
	switch (kind) {
		case 'private': return 'private-network';
		case 'remote': return 'remote';
		case 'unknown': return 'non-local';
		case 'loopback': return 'local';
	}
}

/**
 * THE egress decision. Pure and total. When local-only is NOT active, everything is allowed.
 * When it IS active: stdio MCP and any `loopback` destination are allowed (they never leave
 * the machine); everything else is blocked with a modality-specific reason.
 */
export function canEgress(ctx: EgressContext, req: EgressRequest): EgressDecision {
	if (!isLocalOnly(ctx)) { return { allowed: true }; }

	// MCP stdio spawns a local child process -- it never touches the network.
	if (req.isStdio) { return { allowed: true }; }

	const kind: EgressDestinationKind = req.destinationKind ?? 'unknown';

	// A loopback destination provably never leaves the machine.
	if (kind === 'loopback') { return { allowed: true }; }

	const provider = req.providerName ? ` (${req.providerName})` : '';
	switch (req.modality) {
		case 'cloud-llm':
			return { allowed: false, reason: `Local-only privacy mode is on: refusing to send your prompt to a ${kindLabel(kind)} model endpoint${provider}. Select a local model (Ollama, vLLM, LM Studio) or turn off local-only mode.` };
		case 'web-tool':
			return { allowed: false, reason: `Local-only privacy mode is on: web tools (web_search / browse_url) are disabled because they would contact a ${kindLabel(kind)} server. Turn off local-only mode to use them.` };
		case 'mcp':
			return { allowed: false, reason: `Local-only privacy mode is on: refusing to connect to a ${kindLabel(kind)} MCP server${provider}. Only stdio and loopback MCP servers are allowed.` };
		case 'embeddings':
			return { allowed: false, reason: `Local-only privacy mode is on: refusing to send code to a ${kindLabel(kind)} embeddings provider. Indexing falls back to local lexical (BM25) retrieval.` };
		case 'vector-store':
			return { allowed: false, reason: `Local-only privacy mode is on: refusing to use a ${kindLabel(kind)} vector store. Use a localhost vector store or turn off local-only mode.` };
		case 'model-catalog':
			return { allowed: false, reason: `Local-only privacy mode is on: skipping the ${kindLabel(kind)} model-catalog refresh${provider} (it would send your API key off the machine).` };
		case 'update-check':
			return { allowed: false, reason: `Local-only privacy mode is on: skipping the ${kindLabel(kind)} update check.` };
		case 'telemetry':
			return { allowed: false, reason: `Local-only privacy mode is on: product telemetry is disabled (it would send usage data to a ${kindLabel(kind)} analytics endpoint).` };
	}
}
