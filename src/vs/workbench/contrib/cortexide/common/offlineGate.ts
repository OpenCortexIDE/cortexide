/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

/**
 * Genuine OFFLINE detection only.
 *
 * This used to be `OfflinePrivacyGate` and claimed to enforce "privacy mode", but it only ever
 * checked `navigator.onLine` -- it never enforced privacy/local-only at all (FAKE SAFETY). The
 * real local-only / privacy ENFORCEMENT now lives in the pure, tested `egressPolicy.ts`
 * (`canEgress`) which is wired at every egress chokepoint (LLM dispatch, model catalogs,
 * embeddings, vector store, MCP connect, update check), plus `toolPermissions.ts` which blocks
 * network tools under local-only. This class is now honest: it answers ONLY "is the machine
 * currently offline?" so features that need the network can give a clear message.
 */
export class OfflineGate {
	constructor() { }

	/** True when the browser reports it is offline. */
	isOffline(): boolean {
		return typeof navigator !== 'undefined' && !navigator.onLine;
	}

	/**
	 * Throw a clear "you are offline" error if the machine is offline. Does NOT enforce privacy
	 * (that is `egressPolicy` / `toolPermissions`); use this only to fail fast on network-requiring
	 * features when there is genuinely no connection.
	 */
	ensureOnline(operationName: string): void {
		if (this.isOffline()) {
			throw new Error(localize('offlineBlocked', '{0} is unavailable: you are currently offline. Please check your internet connection.', operationName));
		}
	}
}
