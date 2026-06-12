/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Validates the Phase 2 plan-gen fix: Plan mode with the *Auto* model selection (the default)
// must GENERATE a plan, not dead-end. _generatePlanFromUserRequest used to receive the raw
// modelSelection; prepareLLMChatMessages THROWS on a literal 'auto' ("must resolve to a real
// model first"), so Plan + Auto produced no plan. The fix passes resolvedModelSelection.
//
// PASS  = a plan appears (Approve & Execute / plan steps) AND the auto-resolve error is absent.
// Usage: node test/cortexide-smoke/plan-mode-auto-e2e.mjs [--port 9222]

import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';
const log = (...a) => console.log('[plan-e2e]', ...a);
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
log('attached', win.url().slice(0, 70));
const shot = (n) => win.screenshot({ path: join(tmpdir(), `cx-plan-${n}.png`) }).catch(() => {});

// Capture any renderer error mentioning the auto-resolve throw (the bug's signature).
let sawAutoThrow = false;
win.on('console', (m) => {
	const t = m.text() || '';
	if (/Cannot prepare messages for "auto"|must resolve to a real model/i.test(t)) { sawAutoThrow = true; }
});

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await win.keyboard.press('Meta+l'); await sleep(1800);
	for (const label of ['Skip for now', 'Skip', 'Get Started']) {
		const b = win.locator(`text=${label}`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(600); break; }
	}

	// Ensure the model selection is AUTO (the bug only fires on auto). Fresh profile defaults to Auto.
	const modelBtn = win.locator('button').filter({ hasText: /^(Auto|qwen|llama|deepseek|gemini|gpt|claude|mistral|grok)/i }).first();
	if (await modelBtn.count().then(c => c > 0).catch(() => false)) {
		let cur = ((await modelBtn.textContent().catch(() => '')) || '').trim();
		if (!/^Auto/i.test(cur)) {
			await modelBtn.click().catch(() => {}); await sleep(800);
			const autoOpt = win.locator('text=/^Auto$/').first();
			if (await autoOpt.count().then(c => c > 0).catch(() => false)) { await autoOpt.click().catch(() => {}); await sleep(600); }
			else { await win.keyboard.press('Escape').catch(() => {}); }
			cur = ((await modelBtn.textContent().catch(() => '')) || '').trim();
		}
		log('model =', cur, /^Auto/i.test(cur) ? '(AUTO - testing the fix)' : '(NOT auto - bug would not fire)');
	}

	// Switch mode to Plan.
	const modeBtn = win.locator('button').filter({ hasText: /^(Normal|Gather|Plan|Agent)$/ }).first();
	if (await modeBtn.count().then(c => c > 0).catch(() => false)) {
		const cur = ((await modeBtn.textContent().catch(() => '')) || '').trim();
		if (cur !== 'Plan') { await modeBtn.click().catch(() => {}); await sleep(700); await win.locator('text=/^Plan$/').last().click().catch(() => {}); await sleep(700); }
		log('mode =', ((await modeBtn.textContent().catch(() => '')) || '').trim());
	}

	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill('Create a small Python script hello.py that prints "hello world", then run it. Plan the steps first.');
	await sleep(300);
	await win.keyboard.press('Enter');
	log('submitted in Plan mode; watching 150s for a generated plan (Approve & Execute / steps)…');

	const deadline = Date.now() + 150000;
	let planGenerated = false, sawGenerating = false;
	while (Date.now() < deadline) {
		const genCount = await win.locator('text=/Generating execution plan/i').count().catch(() => 0);
		if (genCount > 0) { sawGenerating = true; }
		const approve = await win.locator('text=/Approve & Execute|Approve and Execute/i').count().catch(() => 0);
		const stepsUI = await win.locator('[class*="plan" i] [class*="step" i], [class*="planStep" i], [class*="plan-step" i]').count().catch(() => 0);
		const summaryUI = await win.locator('text=/Execution Plan|Plan Summary|Step 1|Approve/i').count().catch(() => 0);
		if (approve > 0 || stepsUI > 0 || (sawGenerating && summaryUI > 0)) { planGenerated = true; break; }
		await sleep(2500);
	}
	await sleep(1000);
	await shot('final');

	log('==== RESULT (plan mode + auto) ====');
	log('saw "Generating execution plan" :', sawGenerating, sawGenerating ? '✅' : '(transient, may miss)');
	log('plan generated (approve/steps)  :', planGenerated, planGenerated ? '✅' : '❌');
	log('auto-resolve THROW seen         :', sawAutoThrow, sawAutoThrow ? '❌ BUG STILL PRESENT' : '✅ none');
	const pass = planGenerated && !sawAutoThrow;
	await browser.close();
	process.exit(pass ? 0 : 1);
} catch (e) {
	log('HARNESS ERROR', String(e).slice(0, 300));
	try { await browser.close(); } catch {}
	process.exit(2);
}
