/*---------------------------------------------------------------------------------------------
 *  CortexIDE roadmap live-verify — drives an ALREADY-RUNNING dev build over CDP to confirm the new
 *  features render/work: R10 (one-click Playwright MCP), R3/R8 settings toggles, R7 (background agent
 *  command + Running-agents panel + cancel). The app booting at all also proves the new DI singletons
 *  registered (a missing registration would crash startup before CDP came up).
 *
 *  Usage: node test/cortexide-smoke/roadmap-verify.mjs [--port 9222]
 *--------------------------------------------------------------------------------------------*/
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const argPort = process.argv.indexOf('--port');
const PORT = argPort !== -1 ? process.argv[argPort + 1] : '9222';
const log = (...a) => console.log('[verify]', ...a);
const results = [];
const rec = (name, ok, detail = '') => { results.push({ name, ok }); log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); };

process.on('exit', () => { try { execSync('pkill -f "CortexIDE.app/Contents/MacOS/CortexIDE"'); } catch {} });

const isWorkbench = (u) => !u.startsWith('devtools://') && /workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) && (u.startsWith('vscode-file://') || u.startsWith('file://'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const connDeadline = Date.now() + 120000;
let browser = null, win = null;
while (Date.now() < connDeadline) {
	try {
		if (!browser || !browser.isConnected()) browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 });
		for (const ctx of browser.contexts()) { for (const p of ctx.pages()) { if (isWorkbench(p.url())) { win = p; break; } } if (win) break; }
		if (win) break;
	} catch { browser = null; }
	await sleep(3000);
}
if (!win) { log('FATAL: workbench not reachable in 120s'); process.exit(2); }
rec('app booted + workbench rendered (DI singletons resolved at startup)', true);

const consoleLines = [];
win.on('console', m => consoleLines.push(m.text()));
const shot = (n) => win.screenshot({ path: join(tmpdir(), `cx-verify-${n}.png`) }).catch(() => {});
async function runCommand(title) {
	await win.keyboard.press('Meta+Shift+P');
	await win.waitForSelector('.quick-input-widget', { timeout: 8000 });
	await win.keyboard.type(title); await sleep(900);
	await win.keyboard.press('Enter'); await sleep(900);
}
const clickByText = async (re, opts = {}) => { const l = win.locator(`text=${re}`).first(); if (await l.count().then(c => c > 0).catch(() => false)) { await l.click(opts).catch(() => {}); return true; } return false; };

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60000 });

	// ===== R3/R8: settings toggles exist (do FIRST, before R10 opens a file editor) =====
	try {
		await runCommand('CortexIDE: Open Settings'); await sleep(1200);
		await clickByText('/^General$/'); await sleep(900); // General tab
		await shot('r38-general');
		const compaction = await win.locator('text=/Auto-compact long agent runs/').count().then(c => c > 0).catch(() => false);
		const hooks = await win.locator('text=/Lifecycle hooks/').count().then(c => c > 0).catch(() => false);
		rec('R8: "Auto-compact long agent runs" toggle present', compaction);
		rec('R3: "Lifecycle hooks" toggle present', hooks);
	} catch (e) { rec('R3/R8 toggles', false, String(e).slice(0, 150)); }

	// ===== R10: one-click Playwright MCP =====
	try {
		await runCommand('CortexIDE: Open Settings'); await sleep(1200);
		await clickByText('/^MCP$/'); await sleep(800); // MCP tab
		await shot('r10-mcp-tab');
		const clicked = await clickByText('/Playwright \\(browser automation\\)/');
		rec('R10: "+ Playwright" button present + clickable', clicked);
		await sleep(2500);
		// Read the mcp.json the dev build uses (.cortexide or .cortexide-dev).
		let found = false, where = '';
		for (const d of ['.cortexide-dev', '.cortexide']) {
			const p = join(homedir(), d, 'mcp.json');
			if (existsSync(p)) { try { const j = JSON.parse(readFileSync(p, 'utf8')); if (j?.mcpServers?.playwright) { found = true; where = p; } } catch {} }
		}
		rec('R10: playwright entry written to mcp.json', found, where);
		// cleanup: remove the entry so we don't pollute the user's config
		for (const d of ['.cortexide-dev', '.cortexide']) {
			const p = join(homedir(), d, 'mcp.json');
			if (existsSync(p)) { try { const j = JSON.parse(readFileSync(p, 'utf8')); if (j?.mcpServers?.playwright) { delete j.mcpServers.playwright; writeFileSync(p, JSON.stringify(j, null, 2)); } } catch {} }
		}
	} catch (e) { rec('R10', false, String(e).slice(0, 150)); }

	// ===== R7: background agent command + panel + cancel =====
	try {
		// close settings so the sidebar/panel is visible
		await win.keyboard.press('Escape').catch(() => {});
		await win.keyboard.press('Meta+w').catch(() => {});
		await sleep(800);
		await win.keyboard.press('Meta+l').catch(() => {}); // focus chat sidebar
		await sleep(1000);
		await runCommand('CortexIDE: Start a Background Agent');
		// a quick-input prompt should appear; type a task + Enter
		const qi = await win.waitForSelector('.quick-input-widget', { timeout: 6000 }).then(() => true).catch(() => false);
		if (qi) { await win.keyboard.type('List the files in the workspace root and report them'); await sleep(500); await win.keyboard.press('Enter'); }
		rec('R7: "Start a Background Agent" command opens an input', qi);
		await sleep(2500);
		await shot('r7-after-start');
		// The Running-agents panel should now show the agent (registered 'running' immediately).
		const panel = await win.locator('text=/Running agents/i').count().then(c => c > 0).catch(() => false);
		rec('R7: "Running agents" panel appeared', panel);
		// The agent should appear with a status tag ([Running]/[Done]/[Error]/[Cancelled]) — registry works.
		const statusTag = await win.locator('text=/\\[(Running|Done|Error|Cancelled)\\]/').count().then(c => c > 0).catch(() => false);
		rec('R7: agent shown in panel with a status', statusTag);
		// Best-effort cancel (only present while running — agent may already be finished/errored).
		const cancelled = await clickByText('/^Cancel$/').catch(() => false);
		log(cancelled ? '[verify] (cancel button clicked)' : '[verify] (no cancel button — agent already terminal, OK)');
		await sleep(1000);
		await shot('r7-after-cancel');
	} catch (e) { rec('R7', false, String(e).slice(0, 150)); }

	await shot('final');
	const passed = results.filter(r => r.ok).length;
	log(`\n==== ${passed}/${results.length} checks passed ====`);
	writeFileSync(join(tmpdir(), 'cx-verify-results.json'), JSON.stringify(results, null, 2));
	await browser.close().catch(() => {});
	process.exit(passed === results.length ? 0 : 1);
} catch (e) {
	log('ERROR', String(e).slice(0, 300)); await shot('error');
	await browser.close().catch(() => {});
	process.exit(3);
}
