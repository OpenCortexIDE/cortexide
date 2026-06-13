/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RoutingPolicy } from './cortexideSettingsTypes.js';
import { canEgress } from './egressPolicy.js';

/**
 * The fail-closed decision of whether the repo indexer may compute embeddings, extracted from
 * RepoIndexerService._canComputeEmbeddings so it is node-testable. Embeddings go to an opaque,
 * extension-registered provider whose destination CortexIDE cannot classify, so under local-only privacy
 * mode they MUST be blocked (fall back to BM25-only) -- this is a privacy contract, hence fail-closed and
 * pinned. The impure inputs (is a provider enabled, the routing policy, are we offline) are read by the
 * service and passed in. Byte-identical to the inline guard.
 */
export interface EmbeddingsGateInput {
	/** an embedding provider exists AND is enabled. */
	readonly hasEnabledProvider: boolean;
	/** the current routing policy ('local-only' blocks embeddings). */
	readonly routingPolicy: RoutingPolicy | undefined;
	/** genuine offline detection (no network -> skip embeddings, use BM25). */
	readonly isOffline: boolean;
}

export function canUseEmbeddings(input: EmbeddingsGateInput): boolean {
	if (!input.hasEnabledProvider) {
		return false;
	}
	// Local-only fail-closed: the embedding destination is unknown/unclassifiable, so block under local-only.
	const egress = canEgress({ routingPolicy: input.routingPolicy }, { modality: 'embeddings', destinationKind: 'unknown' });
	if (!egress.allowed) {
		return false;
	}
	// Skip embeddings when offline (fall back to BM25-only).
	if (input.isOffline) {
		return false;
	}
	return true;
}
