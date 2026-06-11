/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Validates the Phase 1 #1 atomic-save change end-to-end: an agent edit (which persists via
// cortexideModelService.saveModel -> textFileService.save with atomicWrite) must (a) write the
// correct content to disk, (b) leave NO leftover .vsctmp temp file, (c) keep the editor stable.
//
// Usage: CX_WS=/tmp/cx-atomic-ws node test/cortexide-smoke/atomic-edit-e2e.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const WS = process.env.CX_WS || '/tmp/cx-atomic-ws';
const TARGET = join(WS, 'target.txt');
const MARKER = 'MODIFIED_BY_AGENT_ATOMIC';
const log = (...a) => console.log('[atomic-e2e]', ...a);
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
const shot = (n) => win.screenshot({ path: join(tmpdir(), `cx-atomic-${n}.png`) }).catch(() => {});

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await win.keyboard.press('Meta+l'); await sleep(1800);
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

	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill(`Replace the entire contents of the existing file target.txt with exactly this single line: ${MARKER}. Use your file tools (edit or rewrite) to actually modify the file, and approve/execute any plan.`);
	await sleep(300);
	await win.keyboard.press('Enter');
	log(`submitted; watching 150s for target.txt to contain "${MARKER}"…`);

	const deadline = Date.now() + 150000;
	let ok = false;
	while (Date.now() < deadline) {
		// auto-approve any plan so the edit reaches the save path
		for (const re of ['Approve & Execute', 'Approve and Execute']) {
			const b = win.locator(`text=${re}`).first();
			if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(500); }
		}
		try { if (existsSync(TARGET) && readFileSync(TARGET, 'utf8').includes(MARKER)) { ok = true; break; } } catch {}
		await sleep(2500);
	}
	await sleep(1500);
	await shot('final');

	const content = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '(missing)';
	const dir = readdirSync(WS);
	const leftoverTmp = dir.filter(f => f.includes('.vsctmp') || f.endsWith('.tmp'));
	const empty = content === '';

	log('==== RESULT (atomic agent edit) ====');
	log('target.txt contains marker :', ok, ok ? '✅' : '❌');
	log('target.txt NOT empty       :', !empty, empty ? '❌ EMPTY (corruption!)' : '✅');
	log('no leftover .vsctmp/.tmp   :', leftoverTmp.length === 0, leftoverTmp.length ? ('❌ leftover: ' + leftoverTmp.join(',')) : '✅');
	log('workspace dir              :', dir.join(', '));
	log('target.txt content         :', JSON.stringify(content.slice(0, 80)));
	await browser.close();
	process.exit((ok && !empty && leftoverTmp.length === 0) ? 0 : 1);
} catch (e) {
	log('HARNESS ERROR', String(e).slice(0, 300));
	try { await browser.close(); } catch {}
	process.exit(2);
}
