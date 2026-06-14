/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	isLocalOnly,
	classifyDestination,
	classifyResolvedAddress,
	isPrivateResolvedIP,
	classifyProviderDestination,
	canEgress,
	canDispatchToProvider,
	resolveLocalOnlyForMainProcess,
	EgressModality,
	EgressDestinationKind,
} from '../../common/egressPolicy.js';
import { RoutingPolicy } from '../../common/cortexideSettingsTypes.js';

/**
 * Phase 8: pins the pure local-only / privacy EGRESS policy. This is the TESTED guarantee
 * behind "never leaks off the machine in local-only mode" -- it replaces the FAKE
 * `OfflinePrivacyGate` (which only checked navigator.onLine). The decision is destination
 * based: loopback is always allowed; private/remote/unknown are blocked under local-only.
 */
suite('egressPolicy', () => {

	const ALL_MODALITIES: EgressModality[] = [
		'cloud-llm', 'web-tool', 'mcp', 'embeddings', 'vector-store', 'model-catalog', 'update-check',
	];
	const ALL_KINDS: EgressDestinationKind[] = ['loopback', 'private', 'remote', 'unknown'];
	const ALL_POLICIES: (RoutingPolicy | undefined)[] = ['auto-cheapest', 'free-tier', 'local-only', undefined];

	// ---- isLocalOnly ---------------------------------------------------------------------

	test('isLocalOnly: only local-only routingPolicy (or requiresPrivacy) turns it on', () => {
		assert.strictEqual(isLocalOnly({ routingPolicy: 'local-only' }), true);
		assert.strictEqual(isLocalOnly({ routingPolicy: 'auto-cheapest' }), false);
		assert.strictEqual(isLocalOnly({ routingPolicy: 'free-tier' }), false);
		assert.strictEqual(isLocalOnly({ routingPolicy: undefined }), false);
		// task-level privacy flips it on regardless of policy
		assert.strictEqual(isLocalOnly({ routingPolicy: 'auto-cheapest', requiresPrivacy: true }), true);
		assert.strictEqual(isLocalOnly({ routingPolicy: undefined, requiresPrivacy: true }), true);
		assert.strictEqual(isLocalOnly({ routingPolicy: 'local-only', requiresPrivacy: false }), true);
	});

	// ---- resolveLocalOnlyForMainProcess (the main-process gate source-of-truth fix) ------

	test('resolveLocalOnlyForMainProcess: routingPolicy config drives the main-process gates', () => {
		// THE regression: UI selects "Local only" -> routingPolicy config 'local-only', but the
		// deprecated localFirstAI flag stays false. The gate must STILL be local-only.
		assert.strictEqual(resolveLocalOnlyForMainProcess('local-only', false), true);
		assert.strictEqual(resolveLocalOnlyForMainProcess('local-only', undefined), true);
		// non-local policies are not local-only
		assert.strictEqual(resolveLocalOnlyForMainProcess('auto-cheapest', false), false);
		assert.strictEqual(resolveLocalOnlyForMainProcess('free-tier', false), false);
		assert.strictEqual(resolveLocalOnlyForMainProcess(undefined, false), false);
		assert.strictEqual(resolveLocalOnlyForMainProcess(undefined, undefined), false);
	});

	test('resolveLocalOnlyForMainProcess: deprecated localFirstAI flag is a fail-SAFE fallback', () => {
		// a user who set only the old flag still gets local-only (OR semantics)
		assert.strictEqual(resolveLocalOnlyForMainProcess('auto-cheapest', true), true);
		assert.strictEqual(resolveLocalOnlyForMainProcess(undefined, true), true);
		assert.strictEqual(resolveLocalOnlyForMainProcess('local-only', true), true);
	});

	// ---- classifyDestination (mirrors assertNotSSRF IP rules) ----------------------------

	test('classifyDestination: loopback hosts', () => {
		assert.strictEqual(classifyDestination('http://localhost:11434'), 'loopback');
		assert.strictEqual(classifyDestination('http://foo.localhost/x'), 'loopback');
		assert.strictEqual(classifyDestination('http://127.0.0.1:8000'), 'loopback');
		assert.strictEqual(classifyDestination('http://127.5.5.5/'), 'loopback');
		assert.strictEqual(classifyDestination('http://0.0.0.0:9000'), 'loopback');
		assert.strictEqual(classifyDestination('http://[::1]:6333'), 'loopback');
		assert.strictEqual(classifyDestination('http://[::]:80'), 'loopback');
		// IPv4-mapped IPv6 loopback resolves through the v4 path
		assert.strictEqual(classifyDestination('http://[::ffff:127.0.0.1]:1234'), 'loopback');
	});

	test('classifyDestination: private / LAN / link-local', () => {
		assert.strictEqual(classifyDestination('http://10.0.0.5:11434'), 'private');
		assert.strictEqual(classifyDestination('http://192.168.1.50:11434'), 'private');
		assert.strictEqual(classifyDestination('http://172.16.0.1/'), 'private');
		assert.strictEqual(classifyDestination('http://172.31.255.255/'), 'private');
		assert.strictEqual(classifyDestination('http://169.254.169.254/latest/meta-data'), 'private'); // cloud metadata
		assert.strictEqual(classifyDestination('http://[fe80::1]/'), 'private');
		assert.strictEqual(classifyDestination('http://[fd00::1]/'), 'private');
		assert.strictEqual(classifyDestination('http://[fc00::1]/'), 'private');
		// IPv4-mapped IPv6 private resolves through the v4 path
		assert.strictEqual(classifyDestination('http://[::ffff:10.0.0.1]/'), 'private');
	});

	test('classifyDestination: 172.x outside 16-31 is public, not private', () => {
		assert.strictEqual(classifyDestination('http://172.15.0.1/'), 'remote');
		assert.strictEqual(classifyDestination('http://172.32.0.1/'), 'remote');
	});

	test('classifyDestination: remote public IPs', () => {
		assert.strictEqual(classifyDestination('http://8.8.8.8/'), 'remote');
		assert.strictEqual(classifyDestination('http://1.2.3.4:443/'), 'remote');
		assert.strictEqual(classifyDestination('http://[2606:4700::1]/'), 'remote'); // public IPv6
	});

	test('classifyDestination: DNS hostnames are unknown (fail-closed)', () => {
		assert.strictEqual(classifyDestination('https://api.openai.com/v1'), 'unknown');
		assert.strictEqual(classifyDestination('https://api.anthropic.com'), 'unknown');
		assert.strictEqual(classifyDestination('http://my-lan-box.local:11434'), 'unknown');
	});

	test('classifyDestination: ws/wss schemes classify by host like http (remote MCP fail-closed)', () => {
		assert.strictEqual(classifyDestination('ws://mcp.example.com/sse'), 'unknown');   // remote DNS -> blocked
		assert.strictEqual(classifyDestination('wss://mcp.example.com/sse'), 'unknown');
		assert.strictEqual(classifyDestination('ws://localhost:3000'), 'loopback');       // local MCP allowed
		assert.strictEqual(classifyDestination('ws://10.0.0.4:3000'), 'private');
	});

	test('classifyDestination: malformed / empty inputs are unknown', () => {
		assert.strictEqual(classifyDestination(''), 'unknown');
		assert.strictEqual(classifyDestination(undefined), 'unknown');
		assert.strictEqual(classifyDestination(null), 'unknown');
		assert.strictEqual(classifyDestination('not a url'), 'unknown');
		assert.strictEqual(classifyDestination('ftp://'), 'unknown'); // no hostname
	});

	// ---- SSRF-guard parity (classifyDestination is the SSOT behind assertNotSSRF) ---------
	// `assertNotSSRF` (browser/toolsService.ts) now DELEGATES to classifyDestination and throws
	// iff the kind is 'loopback' or 'private'. These vectors mirror test/browser/ssrfGuard.test.ts
	// so the contract is pinned in the NODE-runnable suite -- the browser test is EXCLUDED from
	// the node runner, which is exactly why the hex-canonicalized IPv4-mapped bypass shipped
	// unnoticed. SSRF-blocked == classifyDestination in { loopback, private }.
	const ssrfBlocked = (url: string) => {
		const kind = classifyDestination(url);
		assert.ok(kind === 'loopback' || kind === 'private', `expected ${url} to be SSRF-blocked, got '${kind}'`);
	};
	const ssrfAllowed = (url: string) => {
		const kind = classifyDestination(url);
		assert.ok(kind === 'remote' || kind === 'unknown', `expected ${url} to be SSRF-allowed, got '${kind}'`);
	};

	test('SSRF parity: blocks localhost / IPv4 loopback / private / link-local', () => {
		['http://localhost', 'http://localhost:8080/foo', 'https://api.localhost/v1',
			'http://127.0.0.1', 'http://127.1.2.3:9000/path', 'http://0.0.0.0',
			'http://10.0.0.1', 'http://10.255.255.255', 'http://192.168.1.1', 'http://172.16.0.1', 'http://172.31.255.255',
			'http://169.254.169.254/latest/meta-data/', 'http://169.254.0.1'].forEach(ssrfBlocked);
	});

	test('SSRF parity: blocks IPv6 loopback / link-local / unique-local', () => {
		['http://[::1]/', 'http://[::]/', 'http://[fe80::1]/', 'http://[fc00::1]/', 'http://[fd12:3456:789a::1]/'].forEach(ssrfBlocked);
	});

	test('SSRF parity (REGRESSION): blocks hex-canonicalized IPv4-mapped IPv6 -- the closed bypass', () => {
		// Node canonicalizes these to [::ffff:7f00:1] / [::ffff:a00:1] / [::ffff:a9fe:a9fe]; the
		// old dotted-only regex in assertNotSSRF missed them -> SSRF to loopback / cloud metadata.
		['http://[::ffff:127.0.0.1]/', 'http://[::ffff:10.0.0.1]/', 'http://[::ffff:169.254.169.254]/'].forEach(ssrfBlocked);
	});

	test('SSRF parity: allows public IPv4 / IPv6 / DNS hostnames / malformed', () => {
		['https://example.com', 'https://api.github.com/repos/foo/bar', 'http://8.8.8.8',
			'http://172.15.0.1', 'http://172.32.0.1', 'http://192.169.0.1',
			'https://[2606:4700:4700::1111]/', 'not a url'].forEach(ssrfAllowed);
	});

	// ---- classifyProviderDestination -----------------------------------------------------

	test('classifyProviderDestination: local-named providers default to loopback', () => {
		assert.strictEqual(classifyProviderDestination('ollama'), 'loopback');
		assert.strictEqual(classifyProviderDestination('vLLM'), 'loopback');
		assert.strictEqual(classifyProviderDestination('lmStudio'), 'loopback');
	});

	test('classifyProviderDestination: cloud providers with no endpoint are remote', () => {
		assert.strictEqual(classifyProviderDestination('openAI'), 'remote');
		assert.strictEqual(classifyProviderDestination('anthropic'), 'remote');
		assert.strictEqual(classifyProviderDestination('openAICompatible'), 'remote');
		assert.strictEqual(classifyProviderDestination('liteLLM'), 'remote');
	});

	test('classifyProviderDestination: explicit endpoint overrides the provider name', () => {
		// a "local" provider pointed at a remote box is NOT local
		assert.strictEqual(classifyProviderDestination('ollama', 'https://gpu.example.com:11434'), 'unknown');
		assert.strictEqual(classifyProviderDestination('ollama', 'http://192.168.1.9:11434'), 'private');
		// an openAI-compatible/liteLLM/bedrock pointed at localhost IS local
		assert.strictEqual(classifyProviderDestination('openAICompatible', 'http://localhost:4000'), 'loopback');
		assert.strictEqual(classifyProviderDestination('liteLLM', 'http://127.0.0.1:4000'), 'loopback');
		assert.strictEqual(classifyProviderDestination('awsBedrock', 'http://localhost:4000'), 'loopback');
	});

	// ---- canEgress: NOT local-only => everything allowed ---------------------------------

	test('canEgress: when not local-only, every modality/destination is allowed', () => {
		for (const policy of ['auto-cheapest', 'free-tier', undefined] as (RoutingPolicy | undefined)[]) {
			for (const modality of ALL_MODALITIES) {
				for (const kind of ALL_KINDS) {
					const d = canEgress({ routingPolicy: policy }, { modality, destinationKind: kind });
					assert.strictEqual(d.allowed, true, `expected allow for policy=${policy} modality=${modality} kind=${kind}`);
					assert.strictEqual(d.reason, undefined);
				}
			}
		}
	});

	// ---- canEgress: local-only => loopback allowed, else blocked -------------------------

	test('canEgress: under local-only, loopback is always allowed, everything else blocked', () => {
		for (const modality of ALL_MODALITIES) {
			for (const kind of ALL_KINDS) {
				const d = canEgress({ routingPolicy: 'local-only' }, { modality, destinationKind: kind });
				if (kind === 'loopback') {
					assert.strictEqual(d.allowed, true, `loopback should be allowed for ${modality}`);
					assert.strictEqual(d.reason, undefined);
				} else {
					assert.strictEqual(d.allowed, false, `${kind} should be blocked for ${modality}`);
					assert.ok(d.reason && d.reason.length > 0, `block reason missing for ${modality}/${kind}`);
				}
			}
		}
	});

	test('canEgress: requiresPrivacy alone (any policy) enforces the same blocks', () => {
		const d = canEgress({ routingPolicy: 'auto-cheapest', requiresPrivacy: true }, { modality: 'cloud-llm', destinationKind: 'remote' });
		assert.strictEqual(d.allowed, false);
	});

	// ---- canEgress: MCP stdio is exempt --------------------------------------------------

	test('canEgress: MCP stdio transport is always allowed (local child process)', () => {
		// stdio bypasses even a remote/unknown destinationKind under local-only
		assert.strictEqual(canEgress({ routingPolicy: 'local-only' }, { modality: 'mcp', isStdio: true, destinationKind: 'remote' }).allowed, true);
		assert.strictEqual(canEgress({ routingPolicy: 'local-only' }, { modality: 'mcp', isStdio: true }).allowed, true);
	});

	// ---- canEgress: omitted destinationKind is fail-closed under local-only --------------

	test('canEgress: missing destinationKind is treated as unknown (blocked under local-only)', () => {
		const d = canEgress({ routingPolicy: 'local-only' }, { modality: 'cloud-llm' });
		assert.strictEqual(d.allowed, false);
		// but allowed when not local-only
		assert.strictEqual(canEgress({ routingPolicy: 'auto-cheapest' }, { modality: 'cloud-llm' }).allowed, true);
	});

	// ---- canEgress: reasons mention the provider where given -----------------------------

	test('canEgress: block reason includes the provider name when supplied', () => {
		const d = canEgress({ routingPolicy: 'local-only' }, { modality: 'cloud-llm', destinationKind: 'remote', providerName: 'openAI' });
		assert.strictEqual(d.allowed, false);
		assert.ok(d.reason!.includes('openAI'), 'reason should name the provider');
	});

	// ---- exhaustive: full cross product is total (no throw, always a boolean) ------------

	test('canEgress: total over policy x modality x destinationKind x stdio', () => {
		let count = 0;
		for (const policy of ALL_POLICIES) {
			for (const modality of ALL_MODALITIES) {
				for (const kind of ALL_KINDS) {
					for (const isStdio of [true, false]) {
						const d = canEgress({ routingPolicy: policy }, { modality, destinationKind: kind, isStdio });
						assert.strictEqual(typeof d.allowed, 'boolean');
						if (d.allowed) { assert.strictEqual(d.reason, undefined); }
						else { assert.ok(typeof d.reason === 'string' && d.reason.length > 0); }
						count++;
					}
				}
			}
		}
		assert.strictEqual(count, ALL_POLICIES.length * ALL_MODALITIES.length * ALL_KINDS.length * 2);
	});

	// ---- end-to-end: the actual leak scenarios from the egress map -----------------------

	test('canEgress: real leak scenarios are blocked under local-only', () => {
		const localOnly = { routingPolicy: 'local-only' as const };
		// remote model catalog (api.openai.com) -- leaks the API key
		assert.strictEqual(canEgress(localOnly, { modality: 'model-catalog', destinationKind: classifyDestination('https://api.openai.com/v1/models'), providerName: 'openAI' }).allowed, false);
		// update check (api.github.com)
		assert.strictEqual(canEgress(localOnly, { modality: 'update-check', destinationKind: classifyDestination('https://api.github.com/repos/x/y/releases') }).allowed, false);
		// a forced cloud LLM dispatch
		assert.strictEqual(canEgress(localOnly, { modality: 'cloud-llm', destinationKind: classifyProviderDestination('anthropic'), providerName: 'anthropic' }).allowed, false);
		// remote MCP server
		assert.strictEqual(canEgress(localOnly, { modality: 'mcp', destinationKind: classifyDestination('https://mcp.example.com/sse') }).allowed, false);
		// remote vector store
		assert.strictEqual(canEgress(localOnly, { modality: 'vector-store', destinationKind: classifyDestination('https://qdrant.example.com:6333') }).allowed, false);
		// web search (duckduckgo)
		assert.strictEqual(canEgress(localOnly, { modality: 'web-tool', destinationKind: classifyDestination('https://api.duckduckgo.com/') }).allowed, false);
	});

	// ---- canDispatchToProvider: the LLM dispatch defense-in-depth gate -------------------

	test('canDispatchToProvider: not local-only allows every provider', () => {
		for (const p of ['openAI', 'anthropic', 'ollama', 'openAICompatible'] as const) {
			assert.strictEqual(canDispatchToProvider(false, p).allowed, true);
		}
	});

	test('canDispatchToProvider: local-only blocks cloud providers', () => {
		assert.strictEqual(canDispatchToProvider(true, 'openAI').allowed, false);
		assert.strictEqual(canDispatchToProvider(true, 'anthropic').allowed, false);
		assert.strictEqual(canDispatchToProvider(true, 'groq').allowed, false);
		// a cloud-capable compat provider with no endpoint resolved is also blocked (fail-closed)
		assert.strictEqual(canDispatchToProvider(true, 'openAICompatible').allowed, false);
	});

	test('canDispatchToProvider: local-only allows local providers on loopback', () => {
		assert.strictEqual(canDispatchToProvider(true, 'ollama', 'http://127.0.0.1:11434').allowed, true);
		assert.strictEqual(canDispatchToProvider(true, 'ollama').allowed, true); // default loopback
		assert.strictEqual(canDispatchToProvider(true, 'vLLM').allowed, true);
		assert.strictEqual(canDispatchToProvider(true, 'openAICompatible', 'http://localhost:4000').allowed, true);
		assert.strictEqual(canDispatchToProvider(true, 'awsBedrock', 'http://localhost:4000').allowed, true);
	});

	test('canDispatchToProvider: local-only blocks a LOCAL provider pointed at a remote box', () => {
		// ollama configured to a remote GPU host is NOT local -- must be blocked under local-only
		assert.strictEqual(canDispatchToProvider(true, 'ollama', 'https://gpu.example.com:11434').allowed, false);
		assert.strictEqual(canDispatchToProvider(true, 'ollama', 'http://192.168.1.9:11434').allowed, false);
	});

	// ---- MCP connect gate: exact composition used by mcpChannel ---------------------------

	test('mcp connect gate: localhost allowed, remote/private blocked under local-only', () => {
		const decide = (url: string) => canEgress({ routingPolicy: 'local-only' }, { modality: 'mcp', destinationKind: classifyDestination(url) });
		assert.strictEqual(decide('http://localhost:3000/sse').allowed, true);
		assert.strictEqual(decide('http://127.0.0.1:8080/mcp').allowed, true);
		assert.strictEqual(decide('https://mcp.example.com/sse').allowed, false);
		assert.strictEqual(decide('http://10.0.0.5:3000/sse').allowed, false); // LAN
		// stdio is handled by isStdio (no URL) -- always allowed
		assert.strictEqual(canEgress({ routingPolicy: 'local-only' }, { modality: 'mcp', isStdio: true }).allowed, true);
		// not local-only: remote MCP allowed
		assert.strictEqual(canEgress({ routingPolicy: 'auto-cheapest' }, { modality: 'mcp', destinationKind: classifyDestination('https://mcp.example.com/sse') }).allowed, true);
	});

	test('canEgress: legitimate local setups still work under local-only', () => {
		const localOnly = { routingPolicy: 'local-only' as const };
		// ollama on localhost
		assert.strictEqual(canEgress(localOnly, { modality: 'cloud-llm', destinationKind: classifyProviderDestination('ollama', 'http://127.0.0.1:11434'), providerName: 'ollama' }).allowed, true);
		// localhost Qdrant
		assert.strictEqual(canEgress(localOnly, { modality: 'vector-store', destinationKind: classifyDestination('http://localhost:6333') }).allowed, true);
		// local embeddings
		assert.strictEqual(canEgress(localOnly, { modality: 'embeddings', destinationKind: 'loopback' }).allowed, true);
		// stdio MCP
		assert.strictEqual(canEgress(localOnly, { modality: 'mcp', isStdio: true }).allowed, true);
	});
});

suite('egressPolicy.classifyResolvedAddress (SSRF DNS-rebind building block, raw IPs)', () => {

	test('loopback IPv4 + IPv4-mapped-IPv6 loopback', () => {
		assert.strictEqual(classifyResolvedAddress('127.0.0.1'), 'loopback');
		assert.strictEqual(classifyResolvedAddress('0.0.0.0'), 'loopback');
		assert.strictEqual(classifyResolvedAddress('::1'), 'loopback');
		assert.strictEqual(classifyResolvedAddress('::ffff:127.0.0.1'), 'loopback');
		assert.strictEqual(classifyResolvedAddress('::ffff:7f00:1'), 'loopback'); // hex-canonicalized form
	});

	test('private / link-local / cloud-metadata are private (incl. hex IPv4-mapped IPv6)', () => {
		assert.strictEqual(classifyResolvedAddress('10.0.0.5'), 'private');
		assert.strictEqual(classifyResolvedAddress('192.168.1.1'), 'private');
		assert.strictEqual(classifyResolvedAddress('172.16.0.1'), 'private');
		assert.strictEqual(classifyResolvedAddress('169.254.169.254'), 'private'); // cloud metadata
		assert.strictEqual(classifyResolvedAddress('::ffff:10.0.0.1'), 'private');
		assert.strictEqual(classifyResolvedAddress('::ffff:a9fe:a9fe'), 'private'); // 169.254.169.254
		assert.strictEqual(classifyResolvedAddress('fe80::1'), 'private');
		assert.strictEqual(classifyResolvedAddress('fc00::1'), 'private');
	});

	test('a public IP is remote; a bare hostname / empty is unknown', () => {
		assert.strictEqual(classifyResolvedAddress('8.8.8.8'), 'remote');
		assert.strictEqual(classifyResolvedAddress('2606:4700::1'), 'remote');
		assert.strictEqual(classifyResolvedAddress('example.com'), 'unknown');
		assert.strictEqual(classifyResolvedAddress(''), 'unknown');
		assert.strictEqual(classifyResolvedAddress(undefined), 'unknown');
	});

	test('isPrivateResolvedIP is true exactly for loopback + private (an SSRF guard would block these)', () => {
		assert.strictEqual(isPrivateResolvedIP('127.0.0.1'), true);
		assert.strictEqual(isPrivateResolvedIP('169.254.169.254'), true);
		assert.strictEqual(isPrivateResolvedIP('::ffff:10.0.0.1'), true);
		assert.strictEqual(isPrivateResolvedIP('8.8.8.8'), false);
		assert.strictEqual(isPrivateResolvedIP('example.com'), false); // unknown -> not blockable here (caller resolves)
	});
});
