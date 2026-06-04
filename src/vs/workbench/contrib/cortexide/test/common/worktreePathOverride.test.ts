/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { resolveWorktreeRootedURI } from '../../common/worktreePathOverride.js';

// Parallel-edit phase 2: a sub-agent's file paths resolve against (and are confined to) its git-
// worktree root instead of the workspace. These tests pin BOTH halves: correct re-rooting, and the
// fail-closed boundary that rejects anything escaping the worktree.
const ROOT = '/tmp/cx-wt';

suite('resolveWorktreeRootedURI', () => {

	test('a relative path resolves against the worktree root', () => {
		assert.strictEqual(resolveWorktreeRootedURI('src/app.ts', ROOT).fsPath, '/tmp/cx-wt/src/app.ts');
		assert.strictEqual(resolveWorktreeRootedURI('fib.py', ROOT).fsPath, '/tmp/cx-wt/fib.py');
		assert.strictEqual(resolveWorktreeRootedURI('./a/b/c.txt', ROOT).fsPath, '/tmp/cx-wt/a/b/c.txt');
	});

	test('an absolute-looking path the model invents is coerced to worktree-relative', () => {
		// Same coercion as the no-override path (shared coerceAbsolutePathToWorkspaceRelative).
		assert.strictEqual(resolveWorktreeRootedURI('/file', ROOT).fsPath, '/tmp/cx-wt/file');
		assert.strictEqual(resolveWorktreeRootedURI('/workspace/fib.py', ROOT).fsPath, '/tmp/cx-wt/fib.py');
		assert.strictEqual(resolveWorktreeRootedURI('/app/src/index.ts', ROOT).fsPath, '/tmp/cx-wt/src/index.ts');
	});

	test('a bare/empty path maps to the worktree root itself', () => {
		assert.strictEqual(resolveWorktreeRootedURI('', ROOT).fsPath, '/tmp/cx-wt');
		assert.strictEqual(resolveWorktreeRootedURI('/workspace', ROOT).fsPath, '/tmp/cx-wt');
		assert.strictEqual(resolveWorktreeRootedURI('.', ROOT).fsPath, '/tmp/cx-wt');
	});

	test('a file:// URI inside the worktree is accepted as-is', () => {
		assert.strictEqual(resolveWorktreeRootedURI('file:///tmp/cx-wt/deep/x.ts', ROOT).fsPath, '/tmp/cx-wt/deep/x.ts');
	});

	test('a file:// URI whose "." / ".." stay inside the worktree is normalized and accepted', () => {
		assert.strictEqual(resolveWorktreeRootedURI('file:///tmp/cx-wt/a/../b.ts', ROOT).fsPath, '/tmp/cx-wt/b.ts');
	});

	test('REGRESSION: a genuine in-worktree absolute path is NOT double-rooted', () => {
		// Before the fix this coerced to "tmp/cx-wt/src/app.ts" and re-rooted to a bogus nested path,
		// silently no-op'ing the edit. The already-in-root short-circuit keeps it verbatim.
		assert.strictEqual(resolveWorktreeRootedURI('/tmp/cx-wt/src/app.ts', ROOT).fsPath, '/tmp/cx-wt/src/app.ts');
	});

	test('REGRESSION: an in-root absolute path under a fake-root-NAMED root is not mangled by coercion', () => {
		// "/home/..." matches the coercion's FAKE_ROOTS set; the in-root short-circuit must win first.
		const homeRoot = '/home/user/proj';
		assert.strictEqual(resolveWorktreeRootedURI('/home/user/proj/src/app.ts', homeRoot).fsPath, '/home/user/proj/src/app.ts');
	});

	test('SECURITY: a relative "../" traversal that escapes the worktree is rejected (fail-closed)', () => {
		assert.throws(() => resolveWorktreeRootedURI('../etc/passwd', ROOT), /outside the sub-agent worktree root/);
		assert.throws(() => resolveWorktreeRootedURI('../../../../etc/passwd', ROOT), /outside the sub-agent worktree root/);
		assert.throws(() => resolveWorktreeRootedURI('a/../../escape.txt', ROOT), /outside the sub-agent worktree root/);
	});

	test('SECURITY: an absolute path that coerces to a "../" escape is rejected (fail-closed)', () => {
		assert.throws(() => resolveWorktreeRootedURI('/../etc/passwd', ROOT), /outside the sub-agent worktree root/);
	});

	test('SECURITY: a sibling worktree sharing a name prefix is NOT treated as inside', () => {
		// "/tmp/cx-wt2" string-prefixes "/tmp/cx-wt" but is a sibling, not a child — must be rejected.
		assert.throws(() => resolveWorktreeRootedURI('../cx-wt2/x.ts', ROOT), /outside the sub-agent worktree root/);
	});

	test('SECURITY: a file:// URI outside the worktree is rejected', () => {
		assert.throws(() => resolveWorktreeRootedURI('file:///tmp/other/x.ts', ROOT), /outside the sub-agent worktree root/);
		assert.throws(() => resolveWorktreeRootedURI('file:///etc/passwd', ROOT), /outside the sub-agent worktree root/);
	});

	test('SECURITY: a file:// URI that prefix-matches the root then traverses up with ".." is rejected', () => {
		// The critical bypass: URI.parse does NOT collapse "..", and the guard is a raw path-prefix
		// test, so without normalization these escape the worktree while passing containment.
		assert.throws(() => resolveWorktreeRootedURI('file:///tmp/cx-wt/../other/secret.txt', ROOT), /outside the sub-agent worktree root/);
		assert.throws(() => resolveWorktreeRootedURI('file:///tmp/cx-wt/./../../etc/passwd', ROOT), /outside the sub-agent worktree root/);
		assert.throws(() => resolveWorktreeRootedURI('file:///tmp/cx-wt/sub/../../cx-wt2/secret', ROOT), /outside the sub-agent worktree root/);
	});

	test('SECURITY: a file:// URI with a non-empty authority (remote/UNC look-alike) is rejected', () => {
		assert.throws(() => resolveWorktreeRootedURI('file://evil.com/tmp/cx-wt/x.ts', ROOT), /outside the sub-agent worktree root/);
	});

	test('SECURITY: a non-file scheme is rejected', () => {
		assert.throws(() => resolveWorktreeRootedURI('vscode-remote://ssh/tmp/cx-wt/x.ts', ROOT), /outside the sub-agent worktree root/);
	});

	test('the worktree root passes the containment check (boundary is inclusive of the root)', () => {
		// Resolving the root path itself must not throw.
		assert.doesNotThrow(() => resolveWorktreeRootedURI('', ROOT));
		assert.strictEqual(resolveWorktreeRootedURI('nested/dir/file.js', ROOT).fsPath, '/tmp/cx-wt/nested/dir/file.js');
	});
});
