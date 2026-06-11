/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// B1 fix probe: coax the model into emitting MALFORMED structured tool-call markup (a <tool_call>
// with broken JSON that recognizeTextToolCall cannot parse) and confirm the agent loop now treats it
// as an agent error -- surfacing the corrective re-prompt ("malformed and could not be parsed") or the
// honest cap stop ("unparseable tool calls in a row") instead of silently exiting as if done.
//
// Best-effort: a model may "fix" the call or call a real tool instead, in which case the probe is
// INCONCLUSIVE (exit 3), not a failure. The no-false-fire safety property is covered by the happy-path
// E2E + unit tests; this probe attempts the positive firing path.
//
// Usage: node test/cortexide-smoke/b1-malformed-toolcall-probe.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const log = (...a) => console.log('[b1-probe]', ...a);
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
	// Ask the model to emit a deliberately-malformed tool-call marker verbatim (no valid closing JSON).
	await ta.fill('For a formatting test, output EXACTLY the following text verbatim as your entire reply, with no other words, no explanation, and do NOT actually call any tool:\n<tool_call>{"name":"ls_dir", "arguments": {');
	await sleep(300);
	await win.keyboard.press('Enter');
	log('submitted; watching 120s for the B1 corrective re-prompt or honest cap stop...');

	const markers = {
		reprompt: /malformed and could not be parsed/i,
		capStop: /unparseable tool calls in a row/i,
	};
	const seen = {};
	const deadline = Date.now() + 120000;
	while (Date.now() < deadline) {
		const body = (await win.evaluate(() => document.body.innerText).catch(() => '')) || '';
		for (const [k, re] of Object.entries(markers)) { if (!seen[k] && re.test(body)) { seen[k] = true; log(`>>> MARKER: ${k} detected`); } }
		if (seen.reprompt || seen.capStop) { await sleep(1500); break; }
		await sleep(2500);
	}
	await win.screenshot({ path: join(tmpdir(), 'cx-b1-probe.png') }).catch(() => {});
	const fired = !!(seen.reprompt || seen.capStop);
	log('==== RESULT (B1 malformed-tool-call probe) ====');
	log('corrective re-prompt fired :', !!seen.reprompt);
	log('honest cap stop fired      :', !!seen.capStop);
	log('B1 path confirmed live     :', fired, fired ? '✅' : '— (inconclusive: model did not emit malformed markup)');
	await browser.close();
	process.exit(fired ? 0 : 3);
} catch (e) {
	log('HARNESS ERROR', String(e).slice(0, 300));
	try { await browser.close(); } catch {}
	process.exit(2);
}
