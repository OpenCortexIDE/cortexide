/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// The app runs as the FOREGROUND process of the launching shell (so macOS grants it the
// window server). This harness runs as a background child. When the harness exits (any path),
// kill the app so the foreground launcher returns promptly.
process.on('exit', () => { try { execSync('pkill -f "CortexIDE.app/Contents/MacOS/CortexIDE"'); } catch {} });

const argPort = process.argv.indexOf('--port');
const PORT = argPort !== -1 ? process.argv[argPort + 1] : '9222';
const KEY = process.env.CORTEX_E2E_GEMINI_KEY || '';
const MODEL_HINT = 'gemini-2.5-flash';
const PROBE = 'CORTEX_SUBAGENT_PROBE_TOKEN_91723';
const DUMP_ONLY = process.argv.includes('--dump'); // explore DOM, don't send a prompt

const log = (...a) => console.log('[e2e]', ...a);
if (!KEY) { log('FATAL: CORTEX_E2E_GEMINI_KEY not set'); process.exit(2); }

const isWorkbench = (u) =>
	!u.startsWith('devtools://') &&
	/workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) &&
	(u.startsWith('vscode-file://') || u.startsWith('file://'));

// Retry connecting + locating the workbench page for up to 120s (the app may still be
// booting; this is a JS wait, not a shell sleep). Re-fetch contexts each poll.
const connDeadline = Date.now() + 120000;
let browser = null, win = null;
while (Date.now() < connDeadline) {
	try {
		if (!browser || !browser.isConnected()) browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 });
		for (const ctx of browser.contexts()) { for (const p of ctx.pages()) { if (isWorkbench(p.url())) { win = p; break; } } if (win) break; }
		if (win) break;
	} catch { browser = null; }
	await new Promise(r => setTimeout(r, 3000));
}
if (!win) { log('FATAL: workbench not reachable within 120s'); process.exit(2); }
log('attached to', win.url().slice(0, 80));

// ---- console capture (the run_subagent markers print here) -------------------
const consoleLines = [];
win.on('console', (m) => {
	const t = m.text();
	consoleLines.push(t);
	if (t.includes('[run_subagent]') || t.includes('[Auto Model Select]')) log('CONSOLE>', t.slice(0, 240));
});

const shot = (name) => win.screenshot({ path: join(tmpdir(), `cx-e2e-${name}.png`) }).then(() => log('screenshot', name)).catch(() => {});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runCommand(title) {
	await win.keyboard.press('Meta+Shift+P');
	await win.waitForSelector('.quick-input-widget', { timeout: 8000 });
	await win.keyboard.type(title);
	await sleep(900);
	await win.keyboard.press('Enter');
	await sleep(800);
}

async function dumpInteractive(scope) {
	// Print buttons / inputs / [role] / textareas with their text/placeholder/aria for selector discovery.
	return await win.evaluate((sel) => {
		const root = sel ? document.querySelector(sel) : document.body;
		if (!root) return `(${sel} not found)`;
		const out = [];
		for (const el of root.querySelectorAll('button,[role="button"],input,textarea,select,[role="combobox"],[class*="dropdown" i]')) {
			const r = el.getBoundingClientRect();
			if (r.width === 0 && r.height === 0) continue;
			out.push([
				el.tagName.toLowerCase(),
				el.getAttribute('role') || '',
				(el.getAttribute('placeholder') || '').slice(0, 40),
				(el.getAttribute('aria-label') || '').slice(0, 40),
				(el.className || '').toString().slice(0, 50),
				(el.textContent || '').trim().slice(0, 40),
			].join(' | '));
		}
		return out.slice(0, 80).join('\n');
	}, scope).catch(e => '(dump err ' + e.message + ')');
}

try {
	// ===== 1. open chat sidebar (Cmd+L) =====
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await win.keyboard.press('Meta+l');
	await sleep(1500);
	await shot('01-chat-open');

	// ===== 2. inject the Gemini key via Settings =====
	await runCommand('CortexIDE: Open Settings');
	await sleep(1500);
	await shot('02-settings');
	const keyInput = win.locator('input[placeholder*="AIzaSy"]').first();
	const haveKeyInput = await keyInput.count().then(c => c > 0).catch(() => false);
	log('gemini key input present:', haveKeyInput);
	if (haveKeyInput) {
		await keyInput.scrollIntoViewIfNeeded().catch(() => {});
		await keyInput.click({ timeout: 5000 }).catch(() => {});
		await keyInput.fill(KEY).catch(async () => { await win.keyboard.type(KEY); });
		await win.keyboard.press('Tab'); // blur -> commit
		await sleep(2500); // allow provider enable + model autodetect
		log('key entered (masked):', KEY.slice(0, 6) + '…' + KEY.slice(-3));
	} else {
		log('DOM dump (settings):'); log(await dumpInteractive(null));
	}
	await shot('03-after-key');

	// Close the Settings editor so its model list (ModelDump) can't shadow the chat model dropdown:
	// both render rows with identical classes, and the settings rows come first in the DOM, so a
	// getByText match would click the settings row (which does NOT change the Chat selection).
	await win.keyboard.press('Escape').catch(() => {});
	await win.keyboard.press('Meta+w').catch(() => {});
	await sleep(1000);

	// ===== 3. back to chat; set Agent mode + Gemini model =====
	await win.keyboard.press('Meta+l');
	await sleep(1200);

	if (DUMP_ONLY) {
		log('=== chat sidebar interactive DOM ==='); log(await dumpInteractive(null));
		await shot('04-chat-dump');
		await browser.close(); process.exit(0);
	}

	// dismiss onboarding overlay if present (it can sit over the chat controls)
	for (const label of ['Skip for now', 'Skip']) {
		const b = win.locator(`text=/^${label}$/`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(900); log('dismissed onboarding via', label); break; }
	}

	// dump visible elements whose text contains a needle (for diagnosing dropdown contents)
	const dumpMatching = (needle) => win.evaluate((n) => {
		const out = [];
		for (const el of document.querySelectorAll('div,button,span,li,a')) {
			const t = (el.textContent || '').trim();
			const r = el.getBoundingClientRect();
			if (t && t.toLowerCase().includes(n.toLowerCase()) && t.length < 70 && r.height > 0) {
				out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean)[0] || ''} :: ${t}`);
			}
		}
		return [...new Set(out)].slice(0, 30).join('\n') || '(none)';
	}, needle).catch(() => '(dump err)');

	// --- set Agent mode (trigger button shows the active mode name) ---
	const modeTrigger = win.locator('button').filter({ hasText: /^(Normal|Gather|Plan|Agent)$/ }).first();
	if (await modeTrigger.count().then(c => c > 0).catch(() => false)) {
		const cur = ((await modeTrigger.textContent().catch(() => '')) || '').trim();
		log('mode trigger currently:', cur);
		if (cur !== 'Agent') {
			await modeTrigger.click().catch(() => {}); await sleep(700);
			const agentItem = win.locator('text=/^Agent$/');
			log('Agent options after opening mode dropdown:', await agentItem.count().catch(() => 0));
			await agentItem.last().click().catch(() => log('failed clicking Agent'));
			await sleep(600);
		}
		log('mode now:', ((await modeTrigger.textContent().catch(() => '')) || '').trim());
	} else log('mode trigger not found');

	// --- set a Gemini model (must be cloud; run_subagent is curated out of local models) ---
	const modelTrigger = win.locator('button').filter({ hasText: /^(Auto|gemini|gpt|claude|qwen|llama|deepseek|mistral|grok)/i }).first();
	if (await modelTrigger.count().then(c => c > 0).catch(() => false)) {
		log('model trigger currently:', ((await modelTrigger.textContent().catch(() => '')) || '').trim());
		await modelTrigger.click().catch(() => {}); await sleep(900);
		log('elements containing "gemini" after opening model dropdown:\n' + await dumpMatching('gemini'));
		// Click the EXACT Gemini-provider row "gemini-2.5-flash" — NOT "google/gemini-2.5-flash" (OpenRouter),
		// NOT the -lite/-image/-preview variants. Ambiguous .first() matching is what failed before.
		let opt = win.locator('div.void-flex').filter({ hasText: /^gemini-2\.5-flash$/ }).first();
		if (!(await opt.count().then(c => c > 0).catch(() => false))) {
			opt = win.getByText('gemini-2.5-flash', { exact: true }).first();
		}
		if (await opt.count().then(c => c > 0).catch(() => false)) {
			await opt.scrollIntoViewIfNeeded().catch(() => {});
			await opt.click().catch(() => {}); await sleep(900); log('clicked exact gemini-2.5-flash row');
		} else { log('exact gemini-2.5-flash row NOT found'); await win.keyboard.press('Escape').catch(() => {}); }
		let mt = ((await modelTrigger.textContent().catch(() => '')) || '').trim();
		log('model trigger now:', mt);
		// Retry once via keyboard nav if it didn't take.
		if (!/gemini/i.test(mt)) {
			log('retrying gemini selection…');
			await modelTrigger.click().catch(() => {}); await sleep(700);
			await win.getByText('gemini-2.5-flash', { exact: true }).first().click().catch(() => {});
			await sleep(900);
			mt = ((await modelTrigger.textContent().catch(() => '')) || '').trim();
			log('model trigger after retry:', mt);
		}
	} else log('model trigger not found');
	await shot('05-mode-model');

	// ===== 4. send the run_subagent prompt =====
	const prompt = `You are in AGENT mode. Use the run_subagent tool to delegate a task. `
		+ `Spawn ONE sub-agent whose prompt instructs it to read the file "probe.txt" in the workspace root `
		+ `and report the EXACT token string it contains, then call attempt_completion with that token. `
		+ `After the sub-agent returns, tell me the token it found. Do not read the file yourself — you MUST delegate via run_subagent.`;
	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill(prompt);
	await sleep(300);
	await win.keyboard.press('Enter');
	log('prompt submitted; waiting for [run_subagent] markers (up to 180s)…');
	await shot('06-submitted');

	// ===== 5. wait for the spawn + finish markers =====
	const deadline = Date.now() + 180000;
	let spawned = false, finished = false;
	while (Date.now() < deadline) {
		spawned = spawned || consoleLines.some(l => l.includes('[run_subagent] spawning child'));
		finished = finished || consoleLines.some(l => l.includes('[run_subagent] child') && l.includes('finished'));
		if (spawned && finished) break;
		await sleep(2000);
	}
	await sleep(2500);
	await shot('07-final');

	// probe token in the rendered chat?
	const bodyText = await win.evaluate(() => document.body.innerText).catch(() => '');
	const tokenInReply = bodyText.includes(PROBE);

	log('==== RESULT ====');
	log('run_subagent spawn marker :', spawned);
	log('run_subagent finish marker:', finished);
	log('probe token visible in UI :', tokenInReply);
	const markerLines = consoleLines.filter(l => l.includes('[run_subagent]'));
	log('marker lines:\n' + (markerLines.join('\n') || '(none)'));
	writeFileSync(join(tmpdir(), 'cx-e2e-console.log'), consoleLines.join('\n'));
	const pass = spawned && finished;
	log(pass ? 'PASS: run_subagent executed end-to-end' : 'FAIL: run_subagent did not run (see screenshots + cx-e2e-console.log)');
	await browser.close().catch(() => {});
	process.exit(pass ? 0 : 1);
} catch (e) {
	log('ERROR', String(e).slice(0, 400));
	await shot('99-error');
	log('console tail:\n' + consoleLines.slice(-25).join('\n'));
	await browser.close().catch(() => {});
	process.exit(3);
}
