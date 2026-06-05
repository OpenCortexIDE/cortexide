/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { joinPath, isEqualOrParent, normalizePath } from '../../../../base/common/resources.js';
import { coerceAbsolutePathToWorkspaceRelative } from './coerceWorkspacePath.js';

/**
 * Pure helper: resolve a model-supplied file path against a sub-agent's git-worktree root instead of
 * the workspace root (parallel-edit phase 2). When a sub-agent runs in an isolated worktree, EVERY
 * file path it emits must land inside that worktree, never the real workspace — so the normal
 * `isInsideWorkspace` check (which would reject the worktree, since it lives outside the workspace)
 * is replaced by a containment check against the worktree root here.
 *
 * Resolution (mirroring the no-override path in toolsService `validateURI`):
 *  - a relative path joins the worktree root;
 *  - an absolute path that ALREADY points inside the worktree is kept as-is (so the worktree's own
 *    absolute paths are not double-rooted — important when the root itself sits under a name the
 *    coercion treats as a fake root, e.g. /home/.../proj);
 *  - any other absolute-looking path is coerced to worktree-relative first (weak models invent
 *    "/file", "/workspace/x", ...), via the shared {@link coerceAbsolutePathToWorkspaceRelative};
 *  - a full file:// URI (no authority) is parsed as-is; any other scheme/authority is rejected.
 *
 * SECURITY (fail-closed): every branch's result is PATH-NORMALIZED (collapsing "." / "..") BEFORE the
 * {@link isEqualOrParent} containment guard. This matters because the guard's file-scheme containment
 * is a raw path-prefix test that does NOT itself collapse "..": without normalization a parsed URI
 * like `file:///root/../escape` string-prefixes the root yet resolves OUTSIDE it at write time. With
 * normalization, any traversal escape ("../../etc/passwd", a sibling worktree, an absolute path
 * outside the root, a file:// with "..") resolves to a path outside the root and is rejected. The
 * normalization + guard — not the coercion — is the boundary; the function throws rather than
 * returning an out-of-root URI.
 *
 * Layer: `common/`. Pure. No I/O. Tested in `test/common/worktreePathOverride.test.ts`.
 *
 * @param uriStr the raw path/URI string from the model (already known to be a string).
 * @param workspaceRootOverride absolute fs path of the sub-agent's worktree root.
 * @returns a URI guaranteed to be equal to, or inside, the worktree root.
 * @throws if the resolved path escapes the worktree root.
 */
export function resolveWorktreeRootedURI(uriStr: string, workspaceRootOverride: string): URI {
	const rootUri = URI.file(workspaceRootOverride);
	const outsideError = () => new Error(`File ${uriStr} is outside the sub-agent worktree root ${rootUri.fsPath} and cannot be accessed. Only files within the worktree are allowed for safety.`);

	let uri: URI;
	if (uriStr.includes('://')) {
		// Already a full URI with a scheme. A worktree is always a LOCAL path, so only a plain file://
		// URI (no authority) can possibly be inside it; reject anything else outright rather than risk a
		// remote/UNC look-alike slipping past the containment check.
		const parsed = URI.parse(uriStr);
		if (parsed.scheme !== 'file' || parsed.authority) {
			throw outsideError();
		}
		uri = parsed;
	} else if (!uriStr.startsWith('/')) {
		// Relative path: resolve against the worktree root.
		uri = joinPath(rootUri, uriStr);
	} else {
		// Absolute-looking path. If it ALREADY points inside the worktree, keep it (the no-override path
		// has the same already-in-root short-circuit); otherwise coerce an imagined/fake root to
		// worktree-relative and re-root. A bare/fake root maps to '' (the worktree root itself).
		const asFile = URI.file(uriStr);
		if (isEqualOrParent(normalizePath(asFile), rootUri)) {
			uri = asFile;
		} else {
			const relativePath = coerceAbsolutePathToWorkspaceRelative(uriStr) ?? '';
			uri = relativePath ? joinPath(rootUri, relativePath) : rootUri;
		}
	}

	// Collapse any "." / ".." segments BEFORE the containment guard. joinPath already normalizes, but
	// the file:// and keep-absolute-as-is branches do not — and the guard does not collapse ".." on its
	// own. This normalization is the load-bearing step that makes the guard fail-closed against
	// traversal escapes.
	uri = normalizePath(uri);

	// Fail-closed boundary: the resolved path MUST be the worktree root or a descendant of it.
	if (!isEqualOrParent(uri, rootUri)) {
		throw outsideError();
	}

	return uri;
}
