/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure helper: map an LLM-invented absolute path to a WORKSPACE-RELATIVE path.
 *
 * Weak / local models routinely emit an absolute path under a root they imagined — "/file",
 * "/workspace/fib.py", "/app/src/x.ts" — because nothing tells them the real workspace location
 * (ollama doesn't return structured tool_calls, so the path is whatever the model dreamed up). This
 * strips a leading fake root and any leading slashes so the caller can re-root it into the real
 * workspace.
 *
 * SECURITY: the caller MUST still verify the re-rooted result is inside the workspace. This helper
 * deliberately does NOT sanitize "../": "/../etc/passwd" maps to "../etc/passwd" and the caller's
 * isInsideWorkspace check rejects it (fail-closed). Do not use this as a security boundary.
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/coerceWorkspacePath.test.ts`.
 */

/** Roots a weak model commonly invents for the project it's editing. */
const FAKE_ROOTS = /^\/(workspaces?|repos?|projects?|app|home|root|code|src\/app|usr\/src\/app)(\/|$)/i;

/**
 * @returns the workspace-relative path (possibly '' meaning "the workspace root itself"), or `null`
 *   if `uriStr` is not an absolute path (and therefore needs no re-rooting).
 */
export function coerceAbsolutePathToWorkspaceRelative(uriStr: string): string | null {
	if (typeof uriStr !== 'string' || !uriStr.startsWith('/')) { return null; }
	return uriStr.replace(FAKE_ROOTS, '').replace(/^\/+/, '');
}
