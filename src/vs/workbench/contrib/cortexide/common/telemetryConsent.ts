/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Telemetry is opt-IN: OFF unless the user explicitly opted in, and always OFF under local-only.
 * The stored OPT_OUT_KEY is tri-state: absent / 'true' => OFF; 'false' (explicit opt-in) => ON.
 */
export function isTelemetryEnabled(optOutStoredValue: string | undefined, localOnly: boolean): boolean {
	if (localOnly) { return false; }
	return optOutStoredValue === 'false';
}
