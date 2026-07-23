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

	test('.input:focus styles native inputs', () => {
		assert.ok(
			hasRule(/\.void-scope\s+\.input:focus,/s),
			'expected native input focus rule',
		);
	});
});

const expressOnboardingPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/onboarding/ExpressOnboardingFlow.tsx');
const localSetupPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/onboarding/LocalSetupWizard.tsx');

suite('designSystem (Phase 1 — onboarding adoption)', () => {

	test('Express onboarding uses btn-primary and btn-secondary', () => {
		const src = readFileSync(expressOnboardingPath, 'utf8');
		assert.ok(src.includes('btn btn-primary'), 'expected btn-primary in express onboarding');
		assert.ok(src.includes('btn btn-secondary'), 'expected btn-secondary in express onboarding');
		assert.ok(src.includes('className="input '), 'expected .input class on Groq key field');
	});

	test('Local setup wizard uses design-system nav buttons', () => {
		const src = readFileSync(localSetupPath, 'utf8');
		assert.ok(src.includes('btn btn-primary'), 'expected btn-primary in local setup wizard');
		assert.ok(src.includes('btn btn-secondary'), 'expected btn-secondary in local setup wizard');
	});
});

const voidOnboardingPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/onboarding/VoidOnboarding.tsx');
const settingsPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/settings/Settings.tsx');

suite('designSystem (Phase 1 — void onboarding adoption)', () => {

	test('Void onboarding welcome CTAs use design-system buttons', () => {
		const src = readFileSync(voidOnboardingPath, 'utf8');
		assert.ok(src.includes('btn btn-primary'), 'expected btn-primary in void onboarding');
		assert.ok(src.includes('btn btn-secondary'), 'expected btn-secondary in void onboarding');
	});
});

suite('designSystem (Phase 1 — settings adoption)', () => {

	test('Settings pane uses design-system button classes', () => {
		const src = readFileSync(settingsPath, 'utf8');
		assert.ok(src.includes('btn btn-primary'), 'expected btn-primary in settings');
		assert.ok(src.includes('btn btn-secondary'), 'expected btn-secondary in settings');
		assert.ok(src.includes('btn-stop'), 'expected btn-stop for destructive Ollama delete');
		assert.ok(src.includes("'dropdown "), 'expected dropdown class on Ollama selects');
	});
});
