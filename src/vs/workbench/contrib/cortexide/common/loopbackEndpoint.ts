/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Whether an OpenAI-compatible / liteLLM endpoint URL points at the local machine, extracted from the
 * four byte-identical copies that lived inline in sendLLMMessage.impl.ts. This drives local-provider
 * optimizations (shorter timeouts, streaming FIM, the local max-tokens budget), so the URL parsing must
 * be done by HOSTNAME, not substring matching (so a remote host named "localhost.evil.com" is NOT local).
 * A missing/empty endpoint or an unparseable URL is treated as non-local (the safe default).
 *
 * NOTE: this is a responsiveness/UX gate, NOT a security boundary -- egress is gated separately by
 * egressPolicy.classifyDestination. The loopback set (localhost/127.0.0.1/0.0.0.0/::1) is preserved
 * verbatim from the original inline checks.
 */
export function isLoopbackEndpoint(endpoint: string | undefined): boolean {
	if (!endpoint) {
		return false
	}
	try {
		const url = new URL(endpoint)
		const hostname = url.hostname.toLowerCase()
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1'
	} catch {
		return false
	}
}
