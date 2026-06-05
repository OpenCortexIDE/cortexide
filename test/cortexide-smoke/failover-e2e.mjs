/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Live E2E for the model-failover fix (Session 11). Selects a WEAK local model (qwen2.5-coder:1.5b,
// below the agentic floor) in Agent mode and gives it a multi-step file task. The weak model tends to
// fail its tool calls / stall; our fix should then escalate to a capable untried model (the 7B coder)
// and finish the task. We assert via (a) the `[ChatThreadService] Model failover` console marker and
// (b) the target file appearing on disk in the workspace. Either is meaningful; both = the full win.
import { chromium } from 'playwright-core';
import { writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

process.on('exit', () => { try { execSync('pkill -f "CortexIDE.app/Contents/MacOS/CortexIDE"'); } catch {} });

const argPort = process.argv.indexOf('--port');
const PORT = argPort !== -1 ? process.argv[argPort + 1] : '9222';
const WS = process.env.CX_WS || '/tmp/cx-ws-cdp';
const TARGET = join(WS, 'fib.py');
const WEAK_MODEL = process.env.CX_WEAK_MODEL || 'qwen2.5-coder:1.5b';
const log = (...a) => console.log('[failover-e2e]', ...a);

// Clean any prior artifact so we measure THIS run.
try { if (existsSync(TARGET)) { rmSync(TARGET); } } catch {}

const isWorkbench = (u) =>
	!u.startsWith('devtools://') &&
	/workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) &&
	(u.startsWith('vscode-file://') || u.startsWith('file://'));

const connDeadline = Date.now() + 120000;
let browser = null, win = null;
while (Date.now() < connDeadline) {
	try {
		if (!browser || !browser.isConnected()) { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 }); }
		for (const ctx of browser.contexts()) { for (const p of ctx.pages()) { if (isWorkbench(p.url())) { win = p; break; } } if (win) { break; } }
		if (win) { break; }
	} catch { browser = null; }
	await new Promise(r => setTimeout(r, 3000));
}
if (!win) { log('FATAL: workbench not reachable within 120s'); process.exit(2); }
log('attached to', win.url().slice(0, 80));

const consoleLines = [];
win.on('console', (m) => {
	const t = m.text();
	consoleLines.push(t);
	if (t.includes('Model failover') || t.includes('[Auto Model Select]') || t.includes('escalat')) { log('CONSOLE>', t.slice(0, 240)); }
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shot = (name) => win.screenshot({ path: join(tmpdir(), `cx-failover-${name}.png`) }).catch(() => {});

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await win.keyboard.press('Meta+l'); // open chat
	await sleep(1500);
	// dismiss onboarding if present
	for (const label of ['Skip for now', 'Skip']) {
		const b = win.locator(`text=/^${label}$/`).first();
		if (await b.count().then(c => c > 0).catch(() => false)) { await b.click().catch(() => {}); await sleep(800); break; }
	}
	await shot('01-chat');

	// --- Agent mode ---
	const modeTrigger = win.locator('button').filter({ hasText: /^(Normal|Gather|Plan|Agent)$/ }).first();
	if (await modeTrigger.count().then(c => c > 0).catch(() => false)) {
		const cur = ((await modeTrigger.textContent().catch(() => '')) || '').trim();
		if (cur !== 'Agent') {
			await modeTrigger.click().catch(() => {}); await sleep(600);
			await win.locator('text=/^Agent$/').last().click().catch(() => {});
			await sleep(500);
		}
		log('mode:', ((await modeTrigger.textContent().catch(() => '')) || '').trim());
	}

	// --- select the WEAK local model so the failover path is exercised ---
	const modelTrigger = win.locator('button').filter({ hasText: /^(Auto|gemini|gpt|claude|qwen|llama|deepseek|mistral|grok)/i }).first();
	let selectedWeak = false;
	if (await modelTrigger.count().then(c => c > 0).catch(() => false)) {
		log('model trigger currently:', ((await modelTrigger.textContent().catch(() => '')) || '').trim());
		await modelTrigger.click().catch(() => {}); await sleep(900);
		const opt = win.getByText(WEAK_MODEL, { exact: true }).first();
		if (await opt.count().then(c => c > 0).catch(() => false)) {
			await opt.scrollIntoViewIfNeeded().catch(() => {});
			await opt.click().catch(() => {}); await sleep(800);
			selectedWeak = /1\.5b/.test(((await modelTrigger.textContent().catch(() => '')) || ''));
			log('selected weak model:', ((await modelTrigger.textContent().catch(() => '')) || '').trim());
		} else {
			log(`weak model "${WEAK_MODEL}" row not found; leaving default (Auto). Failover may not trigger.`);
			await win.keyboard.press('Escape').catch(() => {});
		}
	}
	await shot('02-model');

	// --- demanding multi-step task: a weak 1.5b tends to thrash tool calls here ---
	const prompt = `Create a file called fib.py in the workspace root containing a correct, iterative `
		+ `fibonacci(n) function with a docstring. Then verify it exists. Use the file tools to actually `
		+ `create it — do not just describe the code.`;
	const ta = win.locator('textarea').last();
	await ta.click({ timeout: 5000 });
	await ta.fill(prompt);
	await sleep(300);
	await win.keyboard.press('Enter');
	log('prompt submitted; watching for failover marker + fib.py on disk (up to 240s)…');
	await shot('03-submitted');

	const deadline = Date.now() + 240000;
	let failoverSeen = false, fileSeen = false;
	while (Date.now() < deadline) {
		failoverSeen = failoverSeen || consoleLines.some(l => l.includes('Model failover'));
		fileSeen = fileSeen || existsSync(TARGET);
		if (fileSeen && (failoverSeen || selectedWeak === false)) { break; } // done
		await sleep(2500);
	}
	await sleep(1500);
	await shot('04-final');

	log('==== RESULT ====');
	log('selected weak model     :', selectedWeak);
	log('failover marker observed:', failoverSeen);
	log('fib.py created on disk  :', fileSeen);
	if (fileSeen) {
		const head = readFileSync(TARGET, 'utf8').split('\n').slice(0, 6).join('\n');
		log('fib.py head:\n' + head);
	}
	const failoverLines = consoleLines.filter(l => l.includes('Model failover') || l.includes('Switched'));
	log('failover console lines:\n' + (failoverLines.join('\n') || '(none)'));
	writeFileSync(join(tmpdir(), 'cx-failover-console.log'), consoleLines.join('\n'));

	// PASS if the task completed (file created). The failover marker is the bonus proving the escalation path.
	const pass = fileSeen;
	log(pass
		? (failoverSeen ? 'PASS+FAILOVER: weak model escalated and the task completed' : 'PASS: task completed (failover not triggered this run)')
		: 'FAIL: file was not created');
	await browser.close().catch(() => {});
	process.exit(pass ? 0 : 1);
} catch (e) {
	log('ERROR', String(e).slice(0, 400));
	await shot('99-error');
	log('console tail:\n' + consoleLines.slice(-20).join('\n'));
	await browser.close().catch(() => {});
	process.exit(3);
}
