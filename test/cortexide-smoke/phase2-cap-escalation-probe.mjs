/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Phase 2 wiring probe: try to drive the agent loop into a CAP / ESCALATION outcome live, to
// confirm the wired decision fns (updateConsecutiveToolErrors / shouldEscalateModel) still fire.
// Strategy: pick a small/local coder (qwen2.5-coder:1.5b) that tends to thrash on multi-step
// agentic tasks, give it a multi-file task, and watch the rendered chat/notifications for any of:
//   - "Switched to ..."         => escalation fired (tool-error cap or iter cap -> tryEscalateModel)
//   - "Stopped after N failed"  => tool-error cap halt
//   - "Agent stopped after N tool iterations" => iter cap halt
//   - task completion           => loop ran clean (no cap; still a valid loop outcome)
// Any cap/escalation marker is a positive confirmation that the wired path executes live.
//
// Usage: CX_WS=/tmp/cx-p2-cap-ws node test/cortexide-smoke/phase2-cap-escalation-probe.mjs [--port 9222] [--model 1.5b]

import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const modelArg = process.argv.indexOf('--model');
const MODEL_RE = modelArg !== -1 ? process.argv[modelArg + 1] : '1\\.5b';
const log = (...a) => console.log('[p2-cap]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const isWB = (u) => !u.startsWith('devtools://') && /workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) && (u.startsWith('vscode-file://') || u.startsWith('file://'));
let browser = null, win = null;
const dl0 = Date.now() + 60000;
while (Date.now() < dl0) {
	try {
		browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 });
		for (const c of browser.contexts()) { for (const p of c.pages()) { if (isWB(p.url())) { win = p; break; } } if (win) { break; } }
		if (win) { break; }
	} catch { browser = null; }
	await sleep(2000);
}
if (!win) { log('FATAL: workbench not reachable'); process.exit(2); }
log('attached', win.url().slice(0, 60));

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await win.keyboard.press('Meta+l'); await sleep(1800);
	for (const label of ['Skip for now', 'Skip', 'Get Started']) {
		const b = win.locator(`text=${label}`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(600); break; }
	}
	// select the small local coder
	const modelBtn = win.locator('button').filter({ hasText: /^(Auto|qwen|llama|deepseek|gemini|gpt|claude|mistral|grok)/i }).first();
	if (await modelBtn.count().then(c => c > 0).catch(() => false)) {
		await modelBtn.click().catch(() => {}); await sleep(900);
		const opt = win.locator(`text=/qwen2\\.5-coder:${MODEL_RE}/i`).first();
		if (await opt.count().then(c => c > 0).catch(() => false)) { await opt.click().catch(() => {}); await sleep(700); }
		else { log(`WARN: model matching ${MODEL_RE} not in list; leaving current`); await win.keyboard.press('Escape').catch(() => {}); }
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
	await ta.fill('Build a small Flask project in this workspace: create app.py with a working "/" route returning "hi", create requirements.txt listing flask, create README.md describing how to run it, then run the server and curl http://127.0.0.1:5000/ to confirm it responds. Use your file and terminal tools for every step and approve any plan.');
	await sleep(300);
	await win.keyboard.press('Enter');
	log('submitted; watching 180s for a cap/escalation marker or completion…');

	const markers = {
		escalation: /Switched to .+ (the previous model|model)/i,
		toolErrCap: /Stopped after \d+ failed tool calls/i,
		iterCap: /Agent stopped after \d+ tool iterations/i,
	};
	const seen = {};
	const deadline = Date.now() + 180000;
	let lastLen = 0;
	while (Date.now() < deadline) {
		for (const re of ['Approve & Execute', 'Approve and Execute']) {
			const b = win.locator(`text=${re}`).first();
			if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(400); }
		}
		const body = (await win.evaluate(() => document.body.innerText).catch(() => '')) || '';
		for (const [k, re] of Object.entries(markers)) {
			if (!seen[k] && re.test(body)) { seen[k] = true; log(`>>> MARKER: ${k} detected`); }
		}
		if (body.length !== lastLen) { lastLen = body.length; }
		// stop early once we have a definitive cap/escalation signal
		if (seen.escalation || seen.toolErrCap || seen.iterCap) { await sleep(2000); break; }
		await sleep(2500);
	}
	await win.screenshot({ path: join(tmpdir(), 'cx-p2-cap-final.png') }).catch(() => {});

	const anyCap = !!(seen.escalation || seen.toolErrCap || seen.iterCap);
	log('==== RESULT (cap/escalation probe) ====');
	log('escalation (Switched to)        :', !!seen.escalation);
	log('tool-error cap halt             :', !!seen.toolErrCap);
	log('iteration cap halt              :', !!seen.iterCap);
	log('ANY cap/escalation marker fired :', anyCap, anyCap ? '✅ (wired path confirmed live)' : '— (no cap; small model completed or still running)');
	await browser.close();
	// exit 0 if a cap/escalation fired (positive confirmation); 3 = inconclusive (not a failure)
	process.exit(anyCap ? 0 : 3);
} catch (e) {
	log('HARNESS ERROR', String(e).slice(0, 300));
	try { await browser.close(); } catch {}
	process.exit(2);
}
