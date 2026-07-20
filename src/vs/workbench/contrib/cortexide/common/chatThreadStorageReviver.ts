/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { MarshalledId } from '../../../../base/common/marshallingIds.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * JSON.parse reviver for persisted chat threads. Restores marshalled URIs via URI.revive
 * (not URI.from — revive preserves VS Code URI metadata correctly) and image byte payloads.
 */
export const reviveChatThreadStorageValue = (key: string, value: unknown): unknown => {
	if (value && typeof value === 'object' && (value as { $mid?: number }).$mid === MarshalledId.Uri) {
		return URI.revive(value as Parameters<typeof URI.revive>[0]);
	}
	if (key === 'data') {
		if (typeof value === 'string' && value.startsWith('__base64__:')) {
			try {
				const base64 = value.substring('__base64__:'.length);
				const binaryString = atob(base64);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				return bytes;
			} catch {
				return value;
			}
		}
		if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'number' && v >= 0 && v <= 255)) {
			return new Uint8Array(value as number[]);
		}
	}
	return value;
};

export const parseChatThreadsFromStorage = <T>(threadsStr: string): T =>
	JSON.parse(threadsStr, reviveChatThreadStorageValue) as T;
