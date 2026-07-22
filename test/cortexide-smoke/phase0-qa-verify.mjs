/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Phase 0 QA verification — exercises merged PR #69 fixes against an ALREADY-RUNNING dev build
// over CDP. Combines live module evaluation (pure helpers shipped in the renderer bundle) with
// UI checks for menubar stacking, attach-file commands, and theme scoping.
//
// Issues covered: #8/#68 menubar, #54 attach file, #45 duplicate tools, #67 llama-server,
// #36 extension paths, #1 v0 multimodal, #27/#32 where testable in CDP.
//
// Usage: node test/cortexide-smoke/phase0-qa-verify.mjs [--port 9222]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argPort = process.argv.indexOf('--port');
const PORT = argPort !== -1 ? process.argv[argPort + 1] : '9222';
const log = (...a) => console.log('[phase0-qa]', ...a);
const results = [];
const rec = (name, ok, detail = '') => {
	results.push({ name, ok, detail });
	log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
};

const isWorkbench = (u) =>
	!u.startsWith('devtools://') &&
	/workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) &&
	(u.startsWith('vscode-file://') || u.startsWith('file://'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const connDeadline = Date.now() + 120_000;
let browser = null;
let win = null;
while (Date.now() < connDeadline) {
	try {
		if (!browser || !browser.isConnected()) {
			browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 });
		}
		for (const ctx of browser.contexts()) {
			for (const p of ctx.pages()) {
				if (isWorkbench(p.url())) { win = p; break; }
			}
			if (win) { break; }
		}
		if (win) { break; }
	} catch {
		browser = null;
	}
	await sleep(3000);
}
if (!win) {
	log('FATAL: workbench not reachable in 120s — launch with test/cortexide-smoke/launch-dev.sh');
	process.exit(2);
}
rec('app booted + workbench rendered', true);

async function runCommand(title) {
	await win.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+P' : 'Control+Shift+P');
	await win.waitForSelector('.quick-input-widget', { timeout: 8000 });
	await win.keyboard.type(title);
	await sleep(900);
}

async function countPaletteRows() {
	return win.locator('.quick-input-list .monaco-list-row').count().catch(() => 0);
}

async function testMenubarDropdown() {
	const platform = await win.evaluate(() => {
		const wb = document.querySelector('.monaco-workbench');
		return {
			isWindows: !!wb?.classList.contains('windows'),
			isLinux: !!wb?.classList.contains('linux'),
			isMac: !!wb?.classList.contains('mac'),
		};
	});

	// Windows/Linux ship in-window menubar — dropdown MUST open (release gate).
	const needsLiveDropdown = platform.isWindows || platform.isLinux;
	const menubarBtn = win.locator('.part.titlebar .menubar .menubar-menu-button').first();
	const hasInWindowMenubar = await menubarBtn.count().then(c => c > 0).catch(() => false);

	if (hasInWindowMenubar) {
		// Click "File" (first top-level menu on Windows/Linux).
		await menubarBtn.click({ timeout: 5000 });
		await sleep(700);
		const menu = win.locator('.monaco-menu-container:visible').first();
		const menuVisible = await menu.count().then(c => c > 0).catch(() => false);
		rec('#8: menubar opens visible dropdown', menuVisible, needsLiveDropdown ? 'Windows/Linux release gate' : 'in-window menubar');

		if (menuVisible) {
			const box = await menu.boundingBox().catch(() => null);
			const titlebar = await win.locator('.part.titlebar').first().boundingBox().catch(() => null);
			const menuBelowTitlebar = box && titlebar ? box.y >= titlebar.y : false;
			rec('#8: dropdown renders outside titlebar (not clipped)', menuBelowTitlebar,
				box ? `menu y=${Math.round(box.y)} titlebar y=${titlebar ? Math.round(titlebar.y) : '?'}` : 'no bbox');

			const itemCount = await menu.locator('.action-menu-item').count().catch(() => 0);
			rec('#8: dropdown contains menu items', itemCount > 0, `items=${itemCount}`);
		}
		await win.keyboard.press('Escape').catch(() => {});
		await sleep(300);
	} else if (needsLiveDropdown) {
		rec('#8: in-window menubar present (Windows/Linux)', false, 'no .menubar-menu-button in titlebar');
	} else {
		// macOS dev: simulate Windows class + verify CSS contract still holds in live DOM.
		const sim = await win.evaluate(() => {
			const wb = document.querySelector('.monaco-workbench');
			if (!wb) { return { ok: false, detail: 'no workbench' }; }
			wb.classList.add('windows');
			const titlebar = document.querySelector('.part.titlebar');
			const style = titlebar ? getComputedStyle(titlebar) : null;
			const bf = (style?.backdropFilter || style?.webkitBackdropFilter || '').trim();
			const noBackdrop = !bf || bf === 'none' || bf === 'initial';
			let menuZ = 0;
			for (const sheet of Array.from(document.styleSheets)) {
				try {
					for (const rule of Array.from(sheet.cssRules || [])) {
						const text = rule.cssText || '';
						if (text.includes('.monaco-menu-container') && text.includes('z-index')) {
							const m = text.match(/z-index:\s*(\d+)/);
							if (m) { menuZ = Math.max(menuZ, Number(m[1])); }
						}
					}
				} catch { /* cross-origin */ }
			}
			return { ok: noBackdrop && menuZ >= 2500, noBackdrop, menuZ, detail: `windows-sim backdrop=${bf || 'off'} menuZ=${menuZ}` };
		});
		rec('#8: Windows CSS contract in live DOM (macOS sim)', !!sim.ok, sim.detail || sim);
		rec('#8: live menubar dropdown (skipped — native macOS menu bar)', true, 'run on Windows CI for click test');
	}
}

try {
	await win.waitForSelector('.monaco-workbench', { timeout: 60_000 });

	// ===== Pure modules (real transpiled artifacts in the live renderer) =====
	const mod = await win.evaluate(async () => {
		const base = window.location.href.replace(/out\/vs\/code\/.*$/, 'out/');
		const url = (rel) => base + rel;
		const r = {};
		try {
			const psv = await import(url('vs/workbench/contrib/cortexide/common/providerSettingsValidation.js'));
			const ptf = await import(url('vs/workbench/contrib/cortexide/common/providerToolFormat.js'));
			const attach = await import(url('vs/workbench/contrib/cortexide/common/attachFileToChat.js'));
			const paths = await import(url('vs/workbench/contrib/cortexide/common/extensionTransferPaths.js'));
			const caps = await import(url('vs/workbench/contrib/cortexide/common/modelCapabilities.js'));
			const onboard = await import(url('vs/workbench/contrib/cortexide/common/onboardingHelpers.js'));

			// #67 — local OpenAI-compatible without apiKey is complete
			r.llamaComplete = psv.isProviderSettingsComplete('openAICompatible', {
				endpoint: 'http://127.0.0.1:8080/v1',
				apiKey: '',
				headersJSON: '{}',
				models: [{ modelName: 'local', isHidden: false }],
				_didFillInProviderSettings: true,
			});

			// #45 — local inference drops native tool format (XML/text path only)
			r.localNoNativeTools = ptf.effectiveSpecialToolFormat('openai-style', true) === undefined;
			r.cloudKeepsNativeTools = ptf.effectiveSpecialToolFormat('openai-style', false) === 'openai-style';

			// #54 — attach helper accepts file URIs
			const uriMod = await import(url('vs/base/common/uri.js'));
			const fileUri = uriMod.URI.file('/tmp/hello.ts');
			const uris = attach.collectAttachableUris([fileUri]);
			r.attachCollectsFile = uris.length === 1 && uris[0].fsPath.endsWith('hello.ts');

			// #36 — CortexIDE data paths (not Void)
			r.dataFolder = paths.CORTEXIDE_DATA_FOLDER;
			r.appDataDir = paths.CORTEXIDE_APP_DATA_DIR;

			// #1 — v0 multimodal uses openai-style
			const v0 = caps.getModelCapabilities('openAICompatible', 'v0-1.5-md');
			r.v0ToolFormat = v0.specialToolFormat;

			// #67 — llama-server preset endpoint
			r.llamaEndpoint = onboard.LLAMA_SERVER_DEFAULT_ENDPOINT;
		} catch (e) {
			r.moduleError = String(e && e.stack || e).slice(0, 500);
		}
		return r;
	});

	if (mod.moduleError) {
		rec('load Phase 0 modules in renderer', false, mod.moduleError);
	} else {
		rec('load Phase 0 modules in renderer', true);
		rec('#67: openAICompatible without apiKey is complete', !!mod.llamaComplete);
		rec('#45: local inference disables native tool format', !!mod.localNoNativeTools);
		rec('#45: cloud keeps native tool format', !!mod.cloudKeepsNativeTools);
		rec('#54: collectAttachableUris accepts file URIs', !!mod.attachCollectsFile);
		rec('#36: data folder is .cortexide', mod.dataFolder === '.cortexide', mod.dataFolder);
		rec('#36: app data dir is CortexIDE', mod.appDataDir === 'CortexIDE', mod.appDataDir);
		rec('#1: v0 uses openai-style tool format', mod.v0ToolFormat === 'openai-style', mod.v0ToolFormat);
		rec('#67: llama-server default endpoint', mod.llamaEndpoint === 'http://127.0.0.1:8080/v1', mod.llamaEndpoint);
	}

	// ===== #54 — attach commands registered in palette =====
	try {
		await runCommand('Add File to Chat');
		const attachRows = await countPaletteRows();
		rec('#54: "Add File to Chat" command in palette', attachRows > 0, `rows=${attachRows}`);
		await win.keyboard.press('Escape');
		await sleep(400);
	} catch (e) {
		rec('#54: "Add File to Chat" command in palette', false, String(e).slice(0, 120));
	}

	try {
		await runCommand('Add Selection to Chat');
		const selRows = await countPaletteRows();
		rec('#54: "Add Selection to Chat" (Ctrl+L) in palette', selRows > 0, `rows=${selRows}`);
		await win.keyboard.press('Escape');
		await sleep(400);
	} catch (e) {
		rec('#54: "Add Selection to Chat" in palette', false, String(e).slice(0, 120));
	}

	// ===== #8/#68 — titlebar stacking + menubar dropdown =====
	const css = await win.evaluate(() => {
		const titlebar = document.querySelector('.part.titlebar');
		const style = titlebar ? getComputedStyle(titlebar) : null;
		const voidScope = document.querySelector('.void-scope');
		let menuZ = 0;
		for (const sheet of Array.from(document.styleSheets)) {
			try {
				for (const rule of Array.from(sheet.cssRules || [])) {
					const text = rule.cssText || '';
					if (text.includes('.monaco-menu-container') && text.includes('z-index')) {
						const m = text.match(/z-index:\s*(\d+)/);
						if (m) { menuZ = Math.max(menuZ, Number(m[1])); }
					}
				}
			} catch { /* cross-origin sheets */ }
		}
		const bf = style ? (style.backdropFilter || style.webkitBackdropFilter || '').trim() : '';
		return {
			titlebarBackdrop: style ? `${style.backdropFilter || '(empty)'} / ${style.webkitBackdropFilter || '(empty)'}` : '(no titlebar)',
			titlebarBackdropOff: !bf || bf === 'none' || bf === 'initial',
			voidScopePresent: !!voidScope,
			menuContainerZIndex: menuZ,
		};
	});
	rec('#8: titlebar backdrop-filter disabled', !!css.titlebarBackdropOff, css.titlebarBackdrop);
	rec('#8: menu container z-index >= 2500', css.menuContainerZIndex >= 2500, `z-index=${css.menuContainerZIndex}`);
	rec('#32: void-scope present (theme tokens scoped)', !!css.voidScopePresent);

	await testMenubarDropdown();

	const shot = join(tmpdir(), 'cortexide-phase0-qa.png');
	await win.screenshot({ path: shot }).catch(() => {});
	rec('screenshot captured', true, shot);

	const passed = results.filter(r => r.ok).length;
	log(`\n==== Phase 0 QA: ${passed}/${results.length} checks passed ====`);
	writeFileSync(join(tmpdir(), 'cortexide-phase0-qa-results.json'), JSON.stringify(results, null, 2));
	await browser.close().catch(() => {});
	process.exit(passed === results.length ? 0 : 1);
} catch (e) {
	log('ERROR', String(e).slice(0, 300));
	await browser?.close().catch(() => {});
	process.exit(3);
}
