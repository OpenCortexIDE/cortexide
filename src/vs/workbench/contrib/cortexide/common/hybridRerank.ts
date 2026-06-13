/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The BM25 + vector blend of the repo indexer's hybrid rerank, extracted from RepoIndexerService so it is
 * node-testable. Both hybrid variants (_rerankHybrid with computed cosine similarity, and
 * _rerankHybridWithVectorStore with vector-store lookups) shared this exact math; the only difference --
 * WHERE the per-item vector score comes from -- is now a `vectorScoreOf` callback the caller supplies.
 * That decouples the (fragile, object-identity-based) docId derivation from the pure blend.
 *
 * Byte-identical to the inline code, INCLUDING the score clamping: BM25 is min-max normalized against
 * [min(scores, 0), max(scores, 1)]. Because the range is clamped to include 0 and 1, max > min is always
 * true, so the `0.5` all-equal fallback is effectively unreachable (kept for fidelity); all-equal positive
 * scores normalize to 1.0 (relative to the 0 floor), not 0.5.
 */

export interface BlendWeights {
	readonly bm25Weight: number;
	readonly vectorWeight: number;
}

/** Blend each item's (min-max normalized) BM25 score with its vector score: bm25*w_bm25 + vector*w_vec. */
export function blendScores<T extends { score: number }>(
	items: readonly T[],
	vectorScoreOf: (item: T) => number,
	weights: BlendWeights
): T[] {
	if (items.length === 0) { return []; }

	// Normalize BM25 scores to 0-1 range for blending (clamped to include 0 and 1, as the original did).
	const bm25Scores = items.map(item => item.score);
	const maxBm25 = Math.max(...bm25Scores, 1); // Avoid division by zero
	const minBm25 = Math.min(...bm25Scores, 0);

	return items.map((item) => {
		const normalizedBm25 = maxBm25 > minBm25
			? (item.score - minBm25) / (maxBm25 - minBm25)
			: 0.5; // Default to middle if all scores are same (unreachable given the 0/1 clamp above)

		const vectorScore = vectorScoreOf(item);

		// Weighted blend
		const hybridScore = (normalizedBm25 * weights.bm25Weight) + (vectorScore * weights.vectorWeight);

		return { ...item, score: hybridScore };
	});
}
