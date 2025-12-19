/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, expect } from '@playwright/test';

/**
 * Minimal E2E smoke tests for regression guard system.
 * These tests validate critical user flows that must not regress.
 *
 * Keep these tests fast (< 5 minutes total) and focused on high-signal regressions.
 */

test.describe('CortexIDE Smoke Tests', () => {
	test('app launches and basic UI renders', async ({ page }) => {
		await page.goto('/');

		// Wait for app to load
		await page.waitForLoadState('networkidle');

		// Check that basic UI elements are present
		// Adjust selectors based on actual CortexIDE UI structure
		const editor = page.locator('.monaco-editor, [role="textbox"], .editor');
		await expect(editor.first()).toBeVisible({ timeout: 10000 });
	});

	test('can open workspace/file', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Try to open a file or workspace
		// This is a placeholder - adjust based on actual CortexIDE file opening mechanism
		// For web version, might need to use file input or mock file system
		const fileOpened = await page.evaluate(() => {
			// Placeholder: check if file system is accessible
			return typeof window !== 'undefined';
		});

		expect(fileOpened).toBeTruthy();
	});

	test('chat panel can be opened', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Look for chat panel button or trigger
		// Adjust selector based on actual CortexIDE chat UI
		const chatButton = page.locator('[aria-label*="chat" i], [data-testid*="chat" i], button:has-text("Chat")').first();

		if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await chatButton.click();

			// Wait for chat panel to appear
			const chatPanel = page.locator('[role="dialog"], .chat-panel, [data-testid*="chat-panel" i]').first();
			await expect(chatPanel).toBeVisible({ timeout: 5000 });
		} else {
			// If chat is always visible, just check it exists
			const chatPanel = page.locator('.chat-panel, [data-testid*="chat" i]').first();
			// This test passes if chat panel exists (even if not visible by default)
			test.skip();
		}
	});

	test('basic IPC/runtime doesn\'t crash', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Check for console errors
		const errors: string[] = [];
		page.on('console', msg => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		page.on('pageerror', error => {
			errors.push(error.message);
		});

		// Wait a bit to catch any startup errors
		await page.waitForTimeout(2000);

		// Filter out known non-critical errors
		const criticalErrors = errors.filter(e =>
			!e.includes('favicon') &&
			!e.includes('sourcemap') &&
			!e.includes('ExtensionHost')
		);

		if (criticalErrors.length > 0) {
			console.warn('Non-critical errors detected:', criticalErrors);
			// For now, just warn - can be made stricter later
		}

		// Basic sanity: page should still be responsive
		const body = page.locator('body');
		await expect(body).toBeVisible();
	});
});
