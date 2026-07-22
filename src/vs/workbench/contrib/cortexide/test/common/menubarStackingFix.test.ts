/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { suite, test } from 'mocha';

/**
 * CSS contract for issues #8 / #68 — menubar dropdowns must not be clipped on Windows/Linux.
 * Runs in node (no Electron) so CI can gate Windows release behaviour without a Windows runner.
 */
const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/media/cortexide.css');
const css = readFileSync(cssPath, 'utf8');

const hasRule = (pattern: RegExp) => pattern.test(css);

suite('menubarStackingFix (#8 / #68 — Windows/Linux dropdown)', () => {

	test('titlebar backdrop-filter override exists (prevents stacking-context clip)', () => {
		assert.ok(
			hasRule(/\.monaco-workbench\s+\.part\.titlebar\s*\{[^}]*backdrop-filter:\s*none/s),
			'expected .monaco-workbench .part.titlebar { backdrop-filter: none; }',
		);
		assert.ok(
			hasRule(/\.monaco-workbench\s+\.part\.titlebar\s*\{[^}]*-webkit-backdrop-filter:\s*none/s),
			'expected webkit backdrop-filter none on titlebar',
		);
	});

	test('menubar menu container z-index is raised above title bar chrome', () => {
		assert.ok(
			hasRule(/\.monaco-workbench\s+\.monaco-menu-container[^}]*z-index:\s*2500/s),
			'expected .monaco-menu-container { z-index: 2500; }',
		);
	});

	test('status bar keeps blur (titlebar override must not remove status bar styling)', () => {
		assert.ok(
			hasRule(/\.monaco-workbench\s+\.part\.statusbar[^}]*backdrop-filter:\s*blur/s),
			'status bar should retain backdrop blur',
		);
	});

	test('titlebar blur rule is scoped separately from the none override', () => {
		// Both rules exist: shared blur on titlebar+statusbar, then titlebar-only reset.
		const titlebarNoneIdx = css.indexOf('.monaco-workbench .part.titlebar {\n\tbackdrop-filter: none');
		const sharedBlurIdx = css.indexOf('.monaco-workbench .part.titlebar,\n.monaco-workbench .part.statusbar');
		assert.ok(sharedBlurIdx >= 0, 'shared titlebar/statusbar blur block missing');
		assert.ok(titlebarNoneIdx >= 0, 'titlebar backdrop-filter:none block missing');
		assert.ok(titlebarNoneIdx > sharedBlurIdx, 'titlebar none override must come AFTER shared blur rule');
	});
});
