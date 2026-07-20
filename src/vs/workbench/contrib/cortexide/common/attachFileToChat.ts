/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';

/** URI schemes the CortexIDE "Add File to Chat" action accepts. */
export const SUPPORTED_ATTACH_SCHEMES = new Set<string>([
	Schemas.file,
	Schemas.vscodeRemote,
	Schemas.untitled,
	Schemas.vscodeUserData,
]);

/**
 * Collect file URIs to attach from action arguments and an optional active-editor fallback.
 * Pure helper (issue #54) — tested in test/common/attachFileToChat.test.ts.
 */
export const collectAttachableUris = (
	args: unknown[],
	activeEditorUri: URI | undefined,
): URI[] => {
	const uris: URI[] = [];
	for (const arg of args) {
		if (URI.isUri(arg) && SUPPORTED_ATTACH_SCHEMES.has(arg.scheme)) {
			uris.push(arg);
		}
	}
	if (uris.length) {
		return uris;
	}
	if (activeEditorUri && SUPPORTED_ATTACH_SCHEMES.has(activeEditorUri.scheme)) {
		return [activeEditorUri];
	}
	return [];
};
