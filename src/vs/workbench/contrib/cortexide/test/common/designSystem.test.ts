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
 * CSS contract for Phase 1 Sprint 2 design system classes.
 */
const stylesPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/styles.css');
const styles = readFileSync(stylesPath, 'utf8');

const hasRule = (pattern: RegExp) => pattern.test(styles);

suite('designSystem (Phase 1 Sprint 2 — composer tokens)', () => {

	test('.btn-primary uses cortex brand tokens', () => {
		assert.ok(
			hasRule(/\.void-scope\s+\.btn-primary\s*\{[^}]*background:\s*var\(--cortex-brand\)/s),
			'expected .void-scope .btn-primary to use --cortex-brand',
		);
	});

	test('.btn-submit is theme-aware (light override)', () => {
		assert.ok(
			hasRule(/body\.vscode-light\s+\.void-scope\s+\.btn-submit/s),
			'expected light-theme submit button override',
		);
	});

	test('.cortex-composer-shell uses cortex surface tokens', () => {
		assert.ok(
			hasRule(/\.void-scope\s+\.cortex-composer-shell\s*\{[^}]*background:\s*var\(--cortex-surface-2\)/s),
			'expected composer shell background token',
		);
	});

	test('.input uses cortex border tokens', () => {
		assert.ok(
			hasRule(/\.void-scope\s+\.input[^}]*border:\s*1px solid var\(--cortex-border-weak\)/s),
			'expected input border token',
		);
	});
});
