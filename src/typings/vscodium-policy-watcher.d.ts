/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module '@vscodium/policy-watcher' {
	export function createWatcher(settingsPath: string, callback: (settings: Record<string, unknown>) => void): { dispose(): void };
}
