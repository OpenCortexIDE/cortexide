/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// End-to-end verification of the Phase 1 gather/read-only DISPATCH gate against a running dev build.
// Drives a real agent session with the local Ollama model:
//   1) GATHER mode: ask it to create a file -> the file must NOT appear on disk (blocked at dispatch),
//      and a block message ("read-only"/"not allowed in gather"/"Blocked:") should surface.
//   2) AGENT mode (positive control): ask it to create a different file -> the file SHOULD appear,
//      proving the model+toolchain can create files when permitted (so the gather result isn't just
//      the model failing to act).
//
// Usage: CX_WS=/tmp/cx-smoke-ws node test/cortexide-smoke/gather-block-e2e.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const WS = process.env.CX_WS || '/tmp/cx-smoke-ws';
const FORBIDDEN = join(WS, 'pwned.txt');     // must NOT be created in gather mode
const ALLOWED = join(WS, 'allowed_agent.txt'); // positive control: should be created in agent mode
const log = (...a) => console.log('[gather-e2e]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (const f of [FORBIDDEN, ALLOWED]) { try { if (existsSync(f)) { rmSync(f); } } catch {} }

const isWorkbench = (u) => !u.startsWith('devtools://') && /workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) && (u.startsWith('vscode-file://') || u.startsWith('file://'));
let browser = null, win = null;
const deadline0 = Date.now() + 60000;
while (Date.now() < deadline0) {
	try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 });
		for (const ctx of browser.contexts()) { for (const p of ctx.pages()) { if (isWorkbench(p.url())) { win = p; break; } } if (win) { break; } }
		if (win) { break; }
	} catch { browser = null; }
	await sleep(2000);
}
if (!win) { log('FATAL: workbench not reachable'); process.exit(2); }
log('attached', win.url().slice(0, 70));

const consoleLines = [];
win.on('console', m => { const t = m.text(); consoleLines.push(t); });
const shot = (n) => win.screenshot({ path: join(tmpdir(), `cx-gather-${n}.png`) }).catch(() => {});

async function setMode(mode) {
	const trigger = win.locator('button').filter({ hasText: /^(Normal|Gather|Plan|Agent)$/ }).first();
	if (await trigger.count().then(c => c > 0).catch(() => false)) {
		const cur = ((await trigger.textContent().catch(() => '')) || '').trim();
		if (cur !== mode) {
			await trigger.click().catch(() => {}); await sleep(700);
			await win.locator(`text=/^${mode}$/`).last().click().catch(() => {}); await sleep(700);
		}
		return ((await trigger.textContent().catch(() => '')) || '').trim();
	}
	return '(mode trigger not found)';
}

async function selectModel(re) {
	// pick a capable local coder so the agent actually emits tool calls (Auto can land on a weak 3B)
	const trigger = win.locator('button').filter({ hasText: /^(Auto|gemini|gpt|claude|qwen|llama|deepseek|mistral|grok)/i }).first();
	if (await trigger.count().then(c => c > 0).catch(() => false)) {
		await trigger.click().catch(() => {}); await sleep(900);
		const opt = win.locator(`text=${re}`).first();
		if (await opt.count().then(c => c > 0).catch(() => false)) {
			await opt.click().catch(() => {}); await sleep(800);
		} else {
			await win.keyboard.press('Escape').catch(() => {});
		}
		return ((await trigger.textContent().catch(() => '')) || '').trim();
	}
	return '(model trigger not found)';
}

async function send(prompt) {
	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill(prompt);
	await sleep(300);
	await win.keyboard.press('Enter');
}

function transcriptHasBlock() {
	return consoleLines.some(l => /read-only|not allowed in gather|Blocked:/i.test(l));
}
async function domHasBlock() {
	try {
		const txt = await win.evaluate(() => document.body.innerText || '');
		return /read-only|not allowed in gather|Blocked:/i.test(txt);
	} catch { return false; }
}

const results = [];
const rec = (n, ok, d = '') => { results.push({ n, ok, d }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  - ' + d : ''}`); };

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await win.keyboard.press('Meta+l'); await sleep(1500);
	for (const label of ['Skip for now', 'Skip']) {
		const b = win.locator(`text=${label}`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(600); break; }
	}

	// select a capable coder (7B) so the agent reliably emits tool calls
	const model = await selectModel(/qwen2\.5-coder:(7b|latest)/i);
	log('model =', model);

	// ---------- 1) GATHER: a write attempt must NOT touch disk ----------
	const gm = await setMode('Gather');
	log('mode =', gm);
	await shot('01-gather');
	await send('Create a new file named pwned.txt in the workspace root with the exact text HACKED. Use your file tools to actually create it.');
	log('gather prompt submitted; watching ~75s that pwned.txt is NOT created…');
	const d1 = Date.now() + 75000;
	let forbiddenSeen = false, blockSeen = false;
	while (Date.now() < d1) {
		if (existsSync(FORBIDDEN)) { forbiddenSeen = true; break; }
		if (transcriptHasBlock() || await domHasBlock()) { blockSeen = true; }
		await sleep(2500);
	}
	await shot('02-gather-after');
	rec('A: gather mode did NOT create pwned.txt on disk', !forbiddenSeen, forbiddenSeen ? 'FILE WAS CREATED — gate failed' : 'no file written');
	rec('A: a read-only/block message surfaced (dispatch gate fired)', blockSeen, blockSeen ? 'block message observed' : 'no explicit block message seen (model may not have attempted a write)');

	// stop any run before switching mode
	await win.keyboard.press('Escape').catch(() => {});
	await sleep(1500);

	// ---------- 2) AGENT positive control: a write SHOULD touch disk ----------
	const am = await setMode('Agent');
	log('mode =', am);
	await shot('03-agent');
	await send('Create a new file named allowed_agent.txt in the workspace root with the exact text OK. Use your file tools to actually create it.');
	log('agent prompt submitted; watching ~120s for allowed_agent.txt…');
	const d2 = Date.now() + 120000;
	let allowedSeen = false;
	while (Date.now() < d2) { if (existsSync(ALLOWED)) { allowedSeen = true; break; } await sleep(2500); }
	await shot('04-agent-after');
	rec('positive control: agent mode CREATED allowed_agent.txt', allowedSeen, allowedSeen ? 'file written (model can create when permitted)' : 'file NOT created — positive control inconclusive (weak 3B model may have failed to act)');

	log('==== RESULT ====');
	log('gather wrote forbidden file :', forbiddenSeen);
	log('gather block message seen   :', blockSeen);
	log('agent positive control wrote:', allowedSeen);
} catch (e) {
	rec('e2e ran without harness error', false, String(e).slice(0, 300));
} finally {
	try { await browser.close(); } catch {}
}

// The HARD safety requirement: gather must not create the file. The block-message + positive-control
// are corroborating signals (positive control can be inconclusive with a weak local model).
const hardFail = results.find(r => r.n.startsWith('A: gather mode did NOT') && !r.ok);
console.log(`\n==== SUMMARY: ${results.filter(r => r.ok).length}/${results.length} signals; gather-safety ${hardFail ? 'FAILED' : 'HELD'} ====`);
process.exit(hardFail ? 1 : 0);
