/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Workspace-Trust dispatch-gate E2E. Launch with CX_KEEP_TRUST=1 so the workspace opens UNTRUSTED.
// In AGENT mode (writes ARE offered), a real model-emitted write must be REFUSED at dispatch because
// the workspace is untrusted — no file on disk + a trust block message. We do NOT grant trust.
//
// Usage: CX_WS=/tmp/cx-untrusted-ws node test/cortexide-smoke/trust-block-e2e.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const WS = process.env.CX_WS || '/tmp/cx-untrusted-ws';
const FORBIDDEN = join(WS, 'trusttest.txt');
const log = (...a) => console.log('[trust-e2e]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const isWB = (u) => !u.startsWith('devtools://') && /workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) && (u.startsWith('vscode-file://') || u.startsWith('file://'));
let browser = null, win = null;
const dl0 = Date.now() + 60000;
while (Date.now() < dl0) {
	try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 });
		for (const c of browser.contexts()) { for (const p of c.pages()) { if (isWB(p.url())) { win = p; break; } } if (win) { break; } }
		if (win) { break; }
	} catch { browser = null; }
	await sleep(2000);
}
if (!win) { log('FATAL: workbench not reachable'); process.exit(2); }
log('attached', win.url().slice(0, 70));
const consoleLines = [];
win.on('console', (m) => { consoleLines.push(m.text()); });
const shot = (n) => win.screenshot({ path: join(tmpdir(), `cx-trust-${n}.png`) }).catch(() => {});

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await sleep(1500);

	// Confirm we are actually UNTRUSTED, and do NOT grant trust. Dismiss the trust dialog by choosing
	// "don't trust" / closing — never click a "trust" affirmative.
	const trustState = await win.evaluate(() => document.body.innerText || '');
	const looksRestricted = /Restricted Mode|do you trust|not trust/i.test(trustState);
	log('trust banner/dialog detected:', looksRestricted);
	for (const re of ['No, I don\'t trust', 'don\'t trust the authors', 'Manage', 'Close']) {
		const b = win.locator(`text=${re}`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { log('dismissing trust dialog via', re); await b.click().catch(() => {}); await sleep(700); break; }
	}
	await win.keyboard.press('Escape').catch(() => {});

	await win.keyboard.press('Meta+l'); await sleep(1500);
	for (const label of ['Skip for now', 'Skip', 'Get Started']) {
		const b = win.locator(`text=${label}`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(600); break; }
	}

	const modelBtn = win.locator('button').filter({ hasText: /^(Auto|qwen|llama|deepseek|gemini|gpt|claude|mistral|grok)/i }).first();
	if (await modelBtn.count().then(c => c > 0).catch(() => false)) {
		await modelBtn.click().catch(() => {}); await sleep(900);
		const opt = win.locator('text=/qwen2\\.5-coder:(7b|latest)/i').first();
		if (await opt.count().then(c => c > 0).catch(() => false)) { await opt.click().catch(() => {}); await sleep(700); }
		else { await win.keyboard.press('Escape').catch(() => {}); }
		log('model =', ((await modelBtn.textContent().catch(() => '')) || '').trim());
	}
	const modeBtn = win.locator('button').filter({ hasText: /^(Normal|Gather|Plan|Agent)$/ }).first();
	if (await modeBtn.count().then(c => c > 0).catch(() => false)) {
		const cur = ((await modeBtn.textContent().catch(() => '')) || '').trim();
		if (cur !== 'Agent') { await modeBtn.click().catch(() => {}); await sleep(700); await win.locator('text=/^Agent$/').last().click().catch(() => {}); await sleep(700); }
		log('mode =', ((await modeBtn.textContent().catch(() => '')) || '').trim());
	}
	await shot('01');

	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill('Create a new file named trusttest.txt in the workspace root with the text OK. Use your file tools to create it now, and approve/execute any plan.');
	await sleep(300);
	await win.keyboard.press('Enter');
	log('submitted (AGENT mode, UNTRUSTED ws); watching 110s — trusttest.txt must NOT appear…');

	const deadline = Date.now() + 110000;
	let forbiddenSeen = false, trustBlockSeen = false;
	while (Date.now() < deadline) {
		if (existsSync(FORBIDDEN)) { forbiddenSeen = true; break; }
		// auto-approve any plan so the write actually reaches dispatch
		for (const re of ['Approve & Execute', 'Approve and Execute']) {
			const b = win.locator(`text=${re}`).first();
			if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(500); }
		}
		const txt = (await win.evaluate(() => document.body.innerText || '').catch(() => '')) + '\n' + consoleLines.join('\n');
		if (/not trusted|Workspace Trust|trust this workspace/i.test(txt)) { trustBlockSeen = true; }
		await sleep(2500);
	}
	await sleep(1500);
	await shot('02');
	const transcript = await win.evaluate(() => { const el = document.querySelector('[id*="cortexide" i]') || document.body; return (el.innerText || '').slice(-2200); }).catch(() => '');

	log('==== RESULT (UNTRUSTED workspace, AGENT mode) ====');
	log('trusttest.txt created  :', forbiddenSeen, forbiddenSeen ? '❌ TRUST GATE FAILED' : '✅ trust gate blocked the write');
	log('trust block message    :', trustBlockSeen);
	log('workspace dir          :', readdirSync(WS).join(', '));
	log('--- transcript tail ---\n' + transcript);
	await browser.close();
	process.exit(forbiddenSeen ? 1 : 0);
} catch (e) {
	log('HARNESS ERROR', String(e).slice(0, 300));
	try { await browser.close(); } catch {}
	process.exit(2);
}
