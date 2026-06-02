/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { coerceAbsolutePathToWorkspaceRelative } from '../../common/coerceWorkspacePath.js';

suite('coerceAbsolutePathToWorkspaceRelative', () => {

	test('REGRESSION: the exact bad path the 7B emitted ("/file") becomes workspace-relative', () => {
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/file'), 'file');
	});

	test('strips a leading fake root the model imagined', () => {
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/workspace/fib.py'), 'fib.py');
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/app/src/index.ts'), 'src/index.ts');
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/project/a/b.txt'), 'a/b.txt');
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/usr/src/app/main.py'), 'main.py');
	});

	test('a bare fake root maps to "" (the workspace root itself)', () => {
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/workspace'), '');
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/'), '');
	});

	test('a plain absolute path just loses its leading slash(es)', () => {
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/notes/todo.md'), 'notes/todo.md');
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('//double'), 'double');
	});

	test('does NOT strip a real top-level dir that merely looks similar', () => {
		// "appsmith" must not be mangled by the "app" root; the regex requires a boundary.
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/appsmith/x.ts'), 'appsmith/x.ts');
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/code-server/x'), 'code-server/x');
	});

	test('SECURITY: traversal is NOT sanitized here — left for the caller to reject (fail-closed)', () => {
		// The helper only re-roots; the caller's isInsideWorkspace check rejects the escape.
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('/../etc/passwd'), '../etc/passwd');
	});

	test('returns null for a non-absolute path (needs no re-rooting)', () => {
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('src/app.ts'), null);
		assert.strictEqual(coerceAbsolutePathToWorkspaceRelative('fib.py'), null);
	});
});
