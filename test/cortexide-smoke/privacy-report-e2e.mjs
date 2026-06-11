/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Phase 8 live check: run the "CortexIDE: Show Privacy Report (What Can Leave My Machine)"
// command via the palette and confirm it opens an editor containing the egress posture report.
//
// Usage: launch the app first (test/cortexide-smoke/launch-dev.sh <port>), then:
//   node test/cortexide-smoke/privacy-report-e2e.mjs [--port 9222]

import { chromium } from 'playwright-core';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';

const rec = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);

const isWorkbench = (u) =>
	!u.startsWith('devtools://') &&
	/workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) &&
	(u.startsWith('vscode-file://') || u.startsWith('file://'));

let browser;
try {
	browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 15_000 });
	rec('connectOverCDP', true);
} catch (e) {
	rec('connectOverCDP', false, String(e).slice(0, 300));
	process.exit(2);
}

let win = null;
for (const ctx of browser.contexts()) {
	for (const p of ctx.pages()) {
		if (isWorkbench(p.url())) { win = p; break; }
	}
	if (win) { break; }
}
rec('found workbench page', !!win, win ? win.url() : 'no workbench page');
if (!win) { await browser.close(); process.exit(2); }

let ok = false;
try {
	await win.keyboard.press('Meta+Shift+P');
	await win.waitForSelector('.quick-input-widget', { timeout: 15_000 });
	await win.keyboard.type('Show Privacy Report');
	await win.waitForTimeout(1200);
	const rows = await win.locator('.quick-input-list .monaco-list-row').count();
	rec('privacy report command in palette', rows > 0, `rows=${rows}`);
	await win.keyboard.press('Enter');
	// The command opens an untitled editor with the report text; wait for the marker text.
	await win.waitForTimeout(2500);
	const bodyText = await win.evaluate(() => document.body.innerText || '');
	const hasTitle = bodyText.includes('What can leave my machine') || bodyText.includes('egress posture');
	const hasMarker = /\[OPEN\s*\]|\[BLOCK\]|\[LOCAL\]/.test(bodyText);
	rec('report editor opened with content', hasTitle && hasMarker, `title=${hasTitle} marker=${hasMarker}`);
	ok = hasTitle && hasMarker;
} catch (e) {
	rec('run command', false, String(e).slice(0, 400));
}

console.log(`\n==== ${ok ? 'PASS' : 'FAIL'}: privacy report command ====`);
process.exit(ok ? 0 : 1);
