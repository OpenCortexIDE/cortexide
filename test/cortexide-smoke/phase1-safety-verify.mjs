/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Phase 1 safety verification against an ALREADY-RUNNING CortexIDE dev build (CDP).
// Unlike cdp-smoke.mjs (which checks UI surfaces), this loads the REAL transpiled safety modules
// inside the live Electron renderer and exercises their decisions, and queries the live VS Code
// configuration registry to confirm the cortexide.* safety settings were actually registered at
// startup. This proves the shipped artifacts (not a piecemeal esbuild) behave correctly in the
// real runtime + that config registration ran.
//
// Usage: node test/cortexide-smoke/phase1-safety-verify.mjs [--port 9222]

import { chromium } from 'playwright-core';

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? process.argv[portArg + 1] : '9222';

const results = [];
const rec = (name, ok, detail = '') => {
	results.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
};

let browser;
try {
	browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 15_000 });
} catch (e) {
	console.log('FAIL  connectOverCDP - ' + String(e).slice(0, 200));
	process.exit(2);
}

const isWorkbench = (u) => !u.startsWith('devtools://') && /workbench(-dev|-monkey-patch)?\.html(\?|#|$)/.test(u) && (u.startsWith('vscode-file://') || u.startsWith('file://'));
let win = null;
for (const ctx of browser.contexts()) { for (const p of ctx.pages()) { if (isWorkbench(p.url())) { win = p; break; } } if (win) { break; } }
if (!win) { console.log('FAIL  found workbench page'); await browser.close(); process.exit(2); }

// Evaluate inside the renderer: import the REAL transpiled modules + the live config registry.
const out = await win.evaluate(async () => {
	const base = window.location.href.replace(/out\/vs\/code\/.*$/, 'out/'); // .../out/
	const url = (rel) => base + rel;
	const r = {};
	try {
		const tp = await import(url('vs/workbench/contrib/cortexide/common/toolPermissions.js'));
		const cr = await import(url('vs/workbench/contrib/cortexide/common/commandRisk.js'));

		// A. gather/read-only dispatch decision (the REAL built module)
		r.gather_blocks_edit = tp.checkToolAllowedInMode('edit_file', 'gather').allowed === false;
		r.gather_blocks_delete = tp.checkToolAllowedInMode('delete_file_or_folder', 'gather').allowed === false;
		r.gather_blocks_terminal = tp.checkToolAllowedInMode('run_command', 'gather').allowed === false;
		r.gather_blocks_mcp = tp.checkToolAllowedInMode('x', 'gather', { isMCPTool: true }).allowed === false;
		r.gather_allows_read = tp.checkToolAllowedInMode('read_file', 'gather').allowed === true;
		r.agent_allows_edit = tp.checkToolAllowedInMode('edit_file', 'agent').allowed === true;

		// D. workspace-trust dispatch decision
		r.untrusted_blocks_edit = tp.checkToolAllowedInMode('edit_file', 'agent', { workspaceTrusted: false }).allowed === false;
		r.untrusted_allows_read = tp.checkToolAllowedInMode('read_file', 'agent', { workspaceTrusted: false }).allowed === true;

		// local-only network block
		r.localonly_blocks_web = tp.checkToolAllowedInMode('web_search', 'agent', { localOnly: true }).allowed === false;

		// B. command risk (REAL built module)
		r.cmd_rmrf_root_hardblock = cr.classifyCommandRisk('rm -rf /').hardBlock === true;
		r.cmd_forcepush_needs_approval = cr.classifyCommandRisk('git push --force').requiresApproval === true && cr.classifyCommandRisk('git push --force').hardBlock === false;
		r.cmd_ls_safe = cr.classifyCommandRisk('ls -la').requiresApproval === false;

		// C. cwd containment (REAL built module)
		r.cwd_etc_escapes = cr.cwdEscapesWorkspace('/etc', ['/tmp/cx-smoke-ws']) === true;
		r.cwd_inside_ok = cr.cwdEscapesWorkspace('/tmp/cx-smoke-ws/sub', ['/tmp/cx-smoke-ws']) === false;
	} catch (e) {
		r.moduleError = String(e && e.stack || e).slice(0, 400);
	}

	// E. config registration — query the live configuration registry
	try {
		const platform = await import(url('vs/platform/registry/common/platform.js'));
		const cfgExt = await import(url('vs/platform/configuration/common/configurationRegistry.js'));
		const registry = platform.Registry.as(cfgExt.Extensions.Configuration);
		const props = registry.getConfigurationProperties();
		r.registeredKeys = {};
		for (const k of [
			'cortexide.global.localFirstAI', 'cortexide.audit.enable', 'cortexide.safety.rollback.enable',
			'cortexide.safety.autostash.enable', 'cortexide.rag.vectorStore', 'cortexide.index.ast',
			'cortexide.secretDetection.enabled', 'cortexide.secretDetection.mode',
		]) {
			r.registeredKeys[k] = !!props[k];
		}
		// confirm the experimental vector store default is 'none' (not a degrading default) in the live schema
		r.vectorStoreDefault = props['cortexide.rag.vectorStore'] ? props['cortexide.rag.vectorStore'].default : '(missing)';
		r.secretDetectionEnabledDefault = props['cortexide.secretDetection.enabled'] ? props['cortexide.secretDetection.enabled'].default : '(missing)';
		r.secretDetectionModeDefault = props['cortexide.secretDetection.mode'] ? props['cortexide.secretDetection.mode'].default : '(missing)';
	} catch (e) {
		r.registryError = String(e && e.stack || e).slice(0, 400);
	}
	return r;
});

// Report
if (out.moduleError) { rec('load real safety modules', false, out.moduleError); }
else { rec('load real safety modules', true); }

rec('A: gather blocks edit_file (real module)', !!out.gather_blocks_edit);
rec('A: gather blocks delete_file_or_folder', !!out.gather_blocks_delete);
rec('A: gather blocks run_command', !!out.gather_blocks_terminal);
rec('A: gather blocks MCP tools', !!out.gather_blocks_mcp);
rec('A: gather ALLOWS read_file', !!out.gather_allows_read);
rec('A: agent allows edit_file', !!out.agent_allows_edit);
rec('D: untrusted workspace blocks edit_file', !!out.untrusted_blocks_edit);
rec('D: untrusted workspace allows read_file', !!out.untrusted_allows_read);
rec('local-only blocks web_search', !!out.localonly_blocks_web);
rec('B: rm -rf / is hard-blocked', !!out.cmd_rmrf_root_hardblock);
rec('B: git push --force needs approval (not blocked)', !!out.cmd_forcepush_needs_approval);
rec('B: ls is safe (no force-approval)', !!out.cmd_ls_safe);
rec('C: cwd /etc escapes workspace', !!out.cwd_etc_escapes);
rec('C: cwd inside workspace ok', !!out.cwd_inside_ok);

if (out.registryError) { rec('E: query config registry', false, out.registryError); }
else {
	const rk = out.registeredKeys || {};
	for (const [k, v] of Object.entries(rk)) { rec(`E: registered ${k}`, !!v); }
	rec('E: rag.vectorStore default is "none" (non-degrading)', out.vectorStoreDefault === 'none', `default=${out.vectorStoreDefault}`);
	rec('F: secretDetection.enabled default true (secure-by-default)', out.secretDetectionEnabledDefault === true, `default=${out.secretDetectionEnabledDefault}`);
	rec('F: secretDetection.mode default "redact"', out.secretDetectionModeDefault === 'redact', `default=${out.secretDetectionModeDefault}`);
}

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} passed ====`);
process.exit(failed.length ? 1 : 0);
