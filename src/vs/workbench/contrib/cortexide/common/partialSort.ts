/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Top-k-by-score selection, extracted verbatim from RepoIndexerService._partialSort so it is node-testable
 * (it was already fully pure). Used in the BM25 rerank to pick the highest-scoring candidates in O(n log k)
 * via a min-heap instead of O(n log n). Scores within 0.1 are treated as ties (order among them is not
 * meaningful), so the GUARANTEE is the set of returned scores, not their exact order.
 */
export function partialSort<T extends { score: number }>(items: T[], k: number): T[] {
	// k <= 0 -> nothing. (Found by the differential fuzz: the original crashed here -- with k === 0 and a
	// non-empty input the heap stays empty and `heap[0].score` threw. k === 0 is reachable, e.g. when the
	// rerank pool size Math.min(k*3, ...) is 0. Byte-identical for the k > 0 values used in practice.)
	if (k <= 0) {
		return [];
	}
	if (items.length <= k) {
		// Small array, just sort it
		return items.sort((a, b) => {
			if (Math.abs(a.score - b.score) < 0.1) {
				return 0; // Stable sort
			}
			return b.score - a.score;
		});
	}

	// Use min-heap for O(n log k) instead of O(n log n)
	// The heap maintains the k highest-scoring items
	const heap: Array<{ score: number; item: T }> = [];

	// Helper functions for min-heap operations
	const heapifyUp = (idx: number) => {
		while (idx > 0) {
			const parent = Math.floor((idx - 1) / 2);
			if (heap[parent].score <= heap[idx].score) { break; }
			[heap[parent], heap[idx]] = [heap[idx], heap[parent]];
			idx = parent;
		}
	};

	const heapifyDown = (idx: number) => {
		while (true) {
			let smallest = idx;
			const left = 2 * idx + 1;
			const right = 2 * idx + 2;

			if (left < heap.length && heap[left].score < heap[smallest].score) {
				smallest = left;
			}
			if (right < heap.length && heap[right].score < heap[smallest].score) {
				smallest = right;
			}
			if (smallest === idx) { break; }
			[heap[idx], heap[smallest]] = [heap[smallest], heap[idx]];
			idx = smallest;
		}
	};

	// Build min-heap of top k items
	for (const item of items) {
		if (heap.length < k) {
			heap.push({ score: item.score, item });
			heapifyUp(heap.length - 1);
		} else if (item.score > heap[0].score) {
			// Replace minimum (root) with new item if it's larger
			heap[0] = { score: item.score, item };
			heapifyDown(0);
		}
	}

	// Extract items from heap and sort descending
	const result = heap.map(h => h.item);
	return result.sort((a, b) => {
		if (Math.abs(a.score - b.score) < 0.1) {
			return 0;
		}
		return b.score - a.score;
	});
}
