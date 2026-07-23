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
const sidebarChatPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/sidebar-tsx/SidebarChat.tsx');
const stagingContextChipsPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/sidebar-tsx/composer/StagingContextChips.tsx');
const voidChatAreaPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/sidebar-tsx/composer/VoidChatArea.tsx');
const toolHeaderPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/sidebar-tsx/tools/ToolHeader.tsx');
const commandBarInChatPath = join(dirname(fileURLToPath(import.meta.url)), '../../browser/react/src/sidebar-tsx/composer/CommandBarInChat.tsx');

suite('designSystem (Phase 1 — void onboarding adoption)', () => {

	test('Void onboarding welcome CTAs use design-system buttons', () => {
		const src = readFileSync(voidOnboardingPath, 'utf8');
		assert.ok(src.includes('btn btn-primary'), 'expected btn-primary in void onboarding');
		assert.ok(src.includes('btn btn-secondary'), 'expected btn-secondary in void onboarding');
	});

	test('Void onboarding uses design-system card chrome', () => {
		const src = readFileSync(voidOnboardingPath, 'utf8');
		assert.ok(src.includes('cortex-card'), 'expected cortex-card panels in void onboarding');
		assert.ok(src.includes('cortex-card-muted'), 'expected muted cards for nested sections');
		assert.ok(src.includes('cortex-chip'), 'expected cortex-chip highlight pills');
		assert.ok(!src.includes('bg-gradient-to-r from-[#0e70c0]'), 'tab rail should use btn-primary, not legacy gradient');
	});
});

suite('designSystem (Phase 1 — onboarding card tokens)', () => {

	test('.cortex-card uses cortex surface tokens', () => {
		assert.ok(
			hasRule(/\.void-scope\s+\.cortex-card\s*\{[^}]*background:\s*color-mix\([^)]*var\(--cortex-surface-2\)/s),
			'expected cortex-card background token',
		);
		assert.ok(
			hasRule(/\.void-scope\s+\.cortex-card\s*\{[^}]*border:\s*1px solid var\(--cortex-border-base\)/s),
			'expected cortex-card border token',
		);
	});
});

suite('designSystem (Phase 1 — settings adoption)', () => {

	test('Settings pane uses design-system button classes', () => {
		const src = readFileSync(settingsPath, 'utf8');
		assert.ok(src.includes('btn btn-primary'), 'expected btn-primary in settings');
		assert.ok(src.includes('btn btn-secondary'), 'expected btn-secondary in settings');
		assert.ok(!src.includes('VoidButtonBgDarken'), 'settings should use native buttons, not VoidButtonBgDarken');
		assert.ok((src.match(/btn btn-secondary/g) ?? []).length >= 10, 'expected direct btn-secondary usage');
		assert.ok(src.includes('btn-stop'), 'expected btn-stop for destructive Ollama delete');
		assert.ok(src.includes("'dropdown "), 'expected dropdown class on Ollama selects');
	});
});

suite('designSystem (Phase 1 — sidebar chat shell)', () => {

	test('SidebarChat has no legacy re-exports', () => {
		const src = readFileSync(sidebarChatPath, 'utf8');
		assert.ok(!src.includes('Re-export shared modules'), 'SidebarChat should not re-export extracted modules');
		assert.ok(!src.includes('export { IconX'), 'SidebarChat should not re-export icons');
		assert.ok(src.includes('export const SidebarChat'), 'SidebarChat remains the sidebar entry component');
	});

	test('StagingContextChips removes by index', () => {
		const src = readFileSync(stagingContextChipsPath, 'utf8');
		assert.ok(src.includes('onRemoveAt'), 'expected index-based chip removal');
		assert.ok(src.includes('onRemoveAt(idx)'), 'remove button should target clicked chip');
	});
});

suite('designSystem (Phase 1 — composer tool headers)', () => {

	test('.cortex-tool-header uses cortex surface tokens', () => {
		assert.ok(
			hasRule(/\.void-scope\s+\.cortex-tool-header\s*\{[^}]*background:\s*var\(--cortex-surface-3\)/s),
			'expected cortex-tool-header background token',
		);
		assert.ok(
			hasRule(/\.void-scope\s+\.cortex-tool-header-bar\s*\{[^}]*background:\s*var\(--cortex-surface-3\)/s),
			'expected cortex-tool-header-bar background token',
		);
	});

	test('VoidChatArea composer footer uses design-system controls', () => {
		const src = readFileSync(voidChatAreaPath, 'utf8');
		assert.ok(src.includes('cortex-composer-toolbar'), 'expected composer toolbar class');
		assert.ok(src.includes('cortex-composer-icon-btn'), 'expected composer icon button class');
		assert.ok(src.includes('cortex-composer-control'), 'expected composer control class');
		assert.ok(!src.includes('border-void-border-3/50'), 'toolbar should not use legacy void border');
	});

	test('Tool and command bar headers use cortex-tool-header tokens', () => {
		const toolHeaderSrc = readFileSync(toolHeaderPath, 'utf8');
		const commandBarSrc = readFileSync(commandBarInChatPath, 'utf8');
		assert.ok(toolHeaderSrc.includes('cortex-tool-header'), 'ToolHeaderWrapper should use cortex-tool-header');
		assert.ok(commandBarSrc.includes('cortex-tool-header-bar'), 'CommandBarInChat should use cortex-tool-header-bar');
		assert.ok(!commandBarSrc.includes('bg-void-bg-3'), 'CommandBarInChat should not use legacy void background');
	});
});
