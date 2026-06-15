/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure helpers for the local Ollama embedding provider that powers hybrid RAG (BM25 + vectors). The
 * provider runs the actual embed call in electron-main (the renderer can't reach Ollama); these are the
 * node-testable decision + validation pieces: when the provider is eligible, and how to safely read the
 * /api/embed response. Ollama runs on loopback, so embeddings stay on-machine (local-only safe).
 */

export interface OllamaEmbedResponseLike {
	readonly embeddings?: unknown;
}

/**
 * Validate + extract the embedding vectors from an Ollama /api/embed response. Throws on a malformed,
 * empty, ragged (inconsistent-dimension), or non-finite response so the caller never feeds garbage into
 * cosine similarity (which would silently corrupt retrieval). When `expectedCount` is given, asserts one
 * vector per input string.
 */
export function extractEmbeddingVectors(response: OllamaEmbedResponseLike | null | undefined, expectedCount?: number): number[][] {
	const e = response?.embeddings;
	if (!Array.isArray(e) || e.length === 0) {
		throw new Error('Ollama embed: response contained no embeddings');
	}
	const first = e[0];
	const dim = Array.isArray(first) ? first.length : -1;
	if (dim <= 0) {
		throw new Error('Ollama embed: empty or invalid embedding vector');
	}
	for (const v of e) {
		if (!Array.isArray(v) || v.length !== dim || v.some(x => typeof x !== 'number' || !Number.isFinite(x))) {
			throw new Error('Ollama embed: ragged or non-numeric embedding vectors');
		}
	}
	if (expectedCount !== undefined && e.length !== expectedCount) {
		throw new Error(`Ollama embed: expected ${expectedCount} vector(s), got ${e.length}`);
	}
	return e as number[][];
}

/**
 * Whether a local Ollama embedding provider should be ACTIVE: a non-empty embedding model is configured
 * AND the Ollama endpoint is dispatchable under the current privacy policy (the caller computes
 * `endpointDispatchAllowed` from canDispatchToProvider -- loopback is always allowed; a remote endpoint
 * under local-only is refused). Keeps RAG on BM25-only until a real local embedding backend is reachable.
 */
export function canUseOllamaEmbeddings(modelName: string | undefined, endpointDispatchAllowed: boolean): boolean {
	return !!modelName && modelName.trim().length > 0 && endpointDispatchAllowed;
}
