/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// CortexIDE CDP smoke — connects to an ALREADY-RUNNING CortexIDE dev build over
// the Chrome DevTools Protocol and verifies core + CortexIDE surfaces render.
//
// Why CDP and not playwright _electron.launch(): VS Code / CortexIDE manages its
// own (re)launching, so Playwright's stdout-handshake launcher fails with
// "Process failed to launch!". The supported path is to launch the app ourselves
// with --remote-debugging-port and attach. See test/automation in upstream VS Code.
//
// Usage:
//   1) launch the app:  test/cortexide-smoke/launch-dev.sh 9222   (sets the debug port)
//   2) node test/cortexide-smoke/cdp-smoke.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';

const results = [];
const rec = (name, ok, detail = '') => {
	results.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
};

let browser;
try {
	browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 15_000 });
	rec('connectOverCDP', true);
} catch (e) {
	rec('connectOverCDP', false, String(e).slice(0, 300));
	console.log('\n==== SUMMARY: could not connect ====');
	process.exit(2);
}

// Find the workbench page among all contexts/pages. It must be the real workbench
// document (vscode-file://.../workbench[-dev].html), not a devtools:// page that
// merely carries workbench.html in a query string.
const isWorkbench = (u) =>
	!u.startsWith('devtools://') &&
	/workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) &&
	(u.startsWith('vscode-file://') || u.startsWith('file://'));

let win = null;
for (const ctx of browser.contexts()) {
	for (const p of ctx.pages()) {
		if (isWorkbench(p.url())) { win = p; break; }
	}
	if (win) { break; }
}
rec('found workbench page', !!win, win ? win.url() : 'no workbench page');
if (!win) { await browser.close(); process.exit(2); }

const consoleErrors = [];
win.on('console', (m) => { if (m.type() === 'error') { consoleErrors.push(m.text()); } });
win.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60_000 });
	rec('workbench shell (.monaco-workbench)', true);

	rec('activity bar', (await win.locator('.activitybar').count()) > 0);
	rec('status bar', (await win.locator('.statusbar').count()) > 0);
	rec('editor part', (await win.locator('.part.editor').count()) > 0);

	// CortexIDE aux-bar view container id is workbench.view.cortexide.
	const cortexSelectors = [
		'[id*="workbench.view.cortexide" i]',
		'[aria-label*="Cortex" i]',
		'[class*="void-scope" i]',
		'[class*="cortex" i]',
	];
	let cortexHit = '';
	for (const sel of cortexSelectors) {
		const c = await win.locator(sel).count();
		if (c > 0) { cortexHit += `${sel}=${c} `; }
	}
	rec('CortexIDE UI detectable in DOM', !!cortexHit, cortexHit || 'none matched');

	// Command palette + verify CortexIDE commands are registered.
	await win.keyboard.press('Meta+Shift+P');
	const paletteOpen = await win.waitForSelector('.quick-input-widget', { timeout: 15_000 }).then(() => true).catch(() => false);
	rec('command palette opens', paletteOpen);
	if (paletteOpen) {
		await win.keyboard.type('CortexIDE');
		await win.waitForTimeout(1200);
		const rows = await win.locator('.quick-input-list .monaco-list-row').count();
		rec('CortexIDE commands in palette', rows > 0, `rows=${rows}`);
		await win.keyboard.press('Escape');
	}

	const shot = join(tmpdir(), 'cortexide-cdp.png');
	await win.screenshot({ path: shot });
	rec('screenshot', true, shot);
} catch (e) {
	rec('workbench checks', false, String(e).slice(0, 400));
}

rec('no fatal console errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | ').slice(0, 600));

// Do NOT close the app (we only attached). Just disconnect.
await browser.close().catch(() => { });

const passed = results.filter((r) => r.ok).length;
writeFileSync(join(tmpdir(), 'cortexide-cdp-results.json'), JSON.stringify(results, null, 2));
console.log(`\n==== SUMMARY: ${passed}/${results.length} passed ====`);
process.exit(passed === results.length ? 0 : 2);
