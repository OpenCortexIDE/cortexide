/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { AuditEvent } from './auditLogService.js';
import type { EgressDestinationKind } from './egressPolicy.js';

/**
 * Builds an audit event recording a single egress DECISION -- the building block of the
 * tamper-evident egress ledger ("verify us, don't trust us"): a complete record of every
 * outbound call (allowed AND blocked), where it went, and whether secrets were redacted
 * from it. Reuses the SAME classification the egress gate enforces (classifyProviderDestination
 * + canDispatchToProvider) so the ledger never disagrees with what actually happened.
 *
 * Pure (no I/O) so it is node-unit-testable. Type-only imports => no runtime cycle with the
 * audit service.
 */

export interface EgressAuditInput {
	/** Event timestamp (ms since epoch). Passed in so this stays pure/deterministic for tests. */
	ts: number;
	providerName: string;
	modelName: string;
	/** loopback | private | remote | unknown -- from egressPolicy.classifyProviderDestination. */
	destinationKind: EgressDestinationKind;
	/** The gate's decision (canDispatchToProvider). false => blocked by local-only / privacy. */
	allowed: boolean;
	/** Block reason when not allowed. */
	reason?: string;
	/** Whether secret redaction actually rewrote the outbound payload before this call. */
	redactionApplied: boolean;
	/** Defaults to 'cloud-llm'. */
	modality?: string;
}

/** True for any destination that leaves the machine (everything except loopback). */
export function isOffMachine(kind: EgressDestinationKind): boolean {
	return kind !== 'loopback';
}

export function buildEgressAuditEvent(input: EgressAuditInput): AuditEvent {
	const event: AuditEvent = {
		ts: input.ts,
		action: 'egress',
		model: input.modelName,
		ok: input.allowed,
		meta: {
			provider: input.providerName,
			modality: input.modality ?? 'cloud-llm',
			destination: input.destinationKind,
			offMachine: isOffMachine(input.destinationKind),
			blocked: !input.allowed,
			redactionApplied: input.redactionApplied,
		},
	};
	if (input.reason) {
		event.meta!.reason = input.reason;
	}
	return event;
}
