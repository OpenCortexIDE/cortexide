/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// E2E for Phase 1 #2 durable create/delete rollback. An agent deletes an existing file and creates
// a new one; then we click the earliest checkpoint to roll back. Expected ON DISK after rollback:
//   - the DELETED file is RECREATED with its original content (no data loss),
//   - the CREATED file is REMOVED.
//
// Usage: CX_WS=/tmp/cx-cp-ws node test/cortexide-smoke/checkpoint-rollback-e2e.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const WS = process.env.CX_WS || '/tmp/cx-cp-ws';
const KEEP = join(WS, 'keep.txt');
const KEEP_CONTENT = 'ORIGINAL_KEEP_CONTENT';
const CREATED = join(WS, 'created_by_agent.txt');
const log = (...a) => console.log('[cp-e2e]', ...a);
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
const shot = (n) => win.screenshot({ path: join(tmpdir(), `cx-cp-${n}.png`) }).catch(() => {});
const rec = [];
const R = (n, ok, d = '') => { rec.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  - ' + d : ''}`); };

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
	}
	const modeBtn = win.locator('button').filter({ hasText: /^(Normal|Gather|Plan|Agent)$/ }).first();
	if (await modeBtn.count().then(c => c > 0).catch(() => false)) {
		const cur = ((await modeBtn.textContent().catch(() => '')) || '').trim();
		if (cur !== 'Agent') { await modeBtn.click().catch(() => {}); await sleep(700); await win.locator('text=/^Agent$/').last().click().catch(() => {}); await sleep(700); }
	}

	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill('Two file operations: (1) delete the existing file keep.txt, and (2) create a new file created_by_agent.txt containing the text NEW. Use your file tools to actually do both now, and approve/execute any plan.');
	await sleep(300);
	await win.keyboard.press('Enter');
	log('submitted create+delete; watching up to 150s…');

	const d1 = Date.now() + 150000;
	while (Date.now() < d1) {
		for (const re of ['Approve & Execute', 'Approve and Execute']) {
			const b = win.locator(`text=${re}`).first();
			if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(500); }
		}
		if (!existsSync(KEEP) && existsSync(CREATED)) { break; }
		await sleep(2500);
	}
	await sleep(2000);
	await shot('01-after-ops');
	const deletedHappened = !existsSync(KEEP);
	const createdHappened = existsSync(CREATED);
	log('agent deleted keep.txt:', deletedHappened, '| agent created created_by_agent.txt:', createdHappened);
	if (!deletedHappened && !createdHappened) { R('agent performed at least one file op (precondition)', false, 'agent did neither — cannot test rollback'); throw new Error('precondition failed'); }

	// --- roll back: click the EARLIEST checkpoint in the chat ---
	await sleep(1000);
	const checkpoints = win.locator('text=/^Checkpoint$/');
	const n = await checkpoints.count().catch(() => 0);
	log('checkpoint elements in chat:', n);
	if (n === 0) { R('a checkpoint exists to roll back to', false); throw new Error('no checkpoint'); }
	await checkpoints.first().click().catch(() => {});
	log('clicked earliest checkpoint; watching 60s for disk restore…');
	const d2 = Date.now() + 60000;
	let restored = false;
	while (Date.now() < d2) {
		const keepBack = existsSync(KEEP);
		const createdGone = !existsSync(CREATED);
		if ((!deletedHappened || keepBack) && (!createdHappened || createdGone)) { restored = true; break; }
		await sleep(2500);
	}
	await sleep(1500);
	await shot('02-after-rollback');

	const keepBack = existsSync(KEEP);
	const keepContent = keepBack ? readFileSync(KEEP, 'utf8') : '(missing)';
	const createdGone = !existsSync(CREATED);

	log('==== RESULT (durable checkpoint rollback) ====');
	if (deletedHappened) { R('rollback RECREATED the deleted keep.txt on disk', keepBack, keepBack ? `content=${JSON.stringify(keepContent.slice(0, 40))}` : 'still missing — data loss!'); }
	if (deletedHappened && keepBack) { R('recreated keep.txt has its ORIGINAL content', keepContent.includes(KEEP_CONTENT), `content=${JSON.stringify(keepContent.slice(0, 40))}`); }
	if (createdHappened) { R('rollback REMOVED the agent-created file on disk', createdGone, createdGone ? 'removed' : 'still present'); }
	log('workspace dir now:', readdirSync(WS).join(', '));

	await browser.close();
	const failed = rec.filter(r => !r.ok);
	console.log(`\n==== SUMMARY: ${rec.length - failed.length}/${rec.length} passed; rollback ${restored && !failed.length ? 'OK' : 'CHECK'} ====`);
	process.exit(failed.length ? 1 : 0);
} catch (e) {
	log('HARNESS/PRECONDITION:', String(e).slice(0, 200));
	try { await browser.close(); } catch {}
	process.exit(2);
}
