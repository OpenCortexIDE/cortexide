/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure shell-command risk classifier used by the terminal approval gate.
 *
 * The audit found the previous `_detectCommandDanger` only fired a non-blocking notification — so
 * with `autoApprove.terminal` on, `rm -rf /`, `curl | sh`, `git push --force`, etc. ran anyway.
 * This classifier returns an actionable decision the gate enforces:
 *   - `hardBlock`: catastrophic, never sensible from a coding agent — refused outright (no approval).
 *   - `requiresApproval`: dangerous — can NEVER be auto-approved; always needs explicit user approval,
 *     even when `autoApprove.terminal` is true (mirrors the HIGH-risk-edit override).
 *
 * Pure module (no imports) → node-unit-testable.
 */

export type CommandRiskLevel = 'safe' | 'normal' | 'dangerous' | 'critical';

export interface CommandRisk {
	level: CommandRiskLevel;
	/** Risk categories matched (for telemetry / UI). */
	categories: string[];
	/** Dangerous+: must NOT be auto-approved — force explicit user approval. */
	requiresApproval: boolean;
	/** Catastrophic: refuse outright (don't even offer approval). */
	hardBlock: boolean;
	reason?: string;
}

// Catastrophic, essentially never legitimate from an in-editor coding agent. Hard-blocked.
const CRITICAL: { re: RegExp; why: string }[] = [
	{ re: /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|\/\*|~|~\/|\$home|\.\.)(\s|$)/i, why: 'recursive delete of the filesystem root / home directory' },
	{ re: /\brm\s+-[a-z]*f[a-z]*r?\s+(\/|\/\*|~|~\/|\$home)(\s|$)/i, why: 'recursive force delete of root / home' },
	{ re: /\bmkfs(\.\w+)?\b/i, why: 'formatting a filesystem' },
	{ re: /\bdd\b[^\n]*\bof=\/dev\/(sd|nvme|disk|hd|vd)/i, why: 'writing raw data to a disk device' },
	{ re: />\s*\/dev\/(sd|nvme|disk|hd|vd)\w*/i, why: 'redirecting output onto a disk device' },
	{ re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, why: 'fork bomb' },
	{ re: /\bformat\s+[a-z]:/i, why: 'formatting a Windows drive' },
	{ re: /\bdel\s+\/[fsq]\b[^\n]*[a-z]:\\?(\s|$)/i, why: 'recursive delete of a Windows drive' },
	{ re: /\bchmod\s+-[a-z]*r[a-z]*\s+777\s+\/(\s|$)/i, why: 'recursive 777 on the filesystem root' },
];

// Dangerous: legitimate sometimes, but irreversible / destructive / exfiltration-prone.
// Never auto-approvable — always require explicit user approval.
const DANGEROUS: { re: RegExp; cat: string }[] = [
	{ re: /\brm\s+-[a-z]*r/i, cat: 'recursive-delete' },
	{ re: /\brm\s+-[a-z]*f/i, cat: 'force-delete' },
	{ re: /\bdd\s+if=/i, cat: 'disk-write' },
	{ re: /\bsudo\b/i, cat: 'privilege-escalation' },
	{ re: /\bchmod\s+[0-7]*7{2,3}/i, cat: 'permissions' },
	{ re: /\bchmod\s+-[a-z]*r/i, cat: 'recursive-permissions' },
	{ re: /\bchown\s+-[a-z]*r/i, cat: 'recursive-ownership' },
	{ re: /\b(fdisk|parted|wipefs)\b/i, cat: 'disk-partition' },
	{ re: /\bgit\s+reset\s+--hard\b/i, cat: 'git-destructive' },
	{ re: /\bgit\s+clean\s+-[a-z]*f/i, cat: 'git-destructive' },
	{ re: /\bgit\s+push\s+(--force\b|--force-with-lease\b|-f\b)/i, cat: 'git-force-push' },
	{ re: /\bcurl\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i, cat: 'remote-code-exec' },
	{ re: /\bwget\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i, cat: 'remote-code-exec' },
	{ re: /\$\(\s*(curl|wget)\b/i, cat: 'remote-code-exec' },
	{ re: /\b(npm|pnpm|yarn)\s+uninstall\s+-g\b/i, cat: 'global-uninstall' },
	{ re: /\bpip[23]?\s+uninstall\b/i, cat: 'package-uninstall' },
	{ re: /\b(apt|apt-get|yum|dnf)\s+(remove|purge)\b/i, cat: 'package-removal' },
	{ re: /\bpacman\s+-R/i, cat: 'package-removal' },
	// credential / env exfiltration: reading secrets and sending them out
	{ re: /(\.env|\.netrc|\.aws\/credentials|id_rsa|id_ed25519|\.ssh\/)[^\n]*\|\s*(curl|wget|nc|netcat|ncat)\b/i, cat: 'credential-exfiltration' },
	{ re: /\b(env|printenv|set)\b[^\n]*\|\s*(curl|wget|nc|netcat|ncat)\b/i, cat: 'env-exfiltration' },
	{ re: /\b(cat|less|more|head|tail)\b[^\n]*\.(env|pem|key)\b[^\n]*\|\s*(curl|wget|nc)\b/i, cat: 'credential-exfiltration' },
];

// Normal: worth the standard terminal approval, but not "force-approval / block".
const NORMAL: RegExp[] = [
	/\brm\b/i, /\bdel\b/i, /\brmdir\b/i, /\bunlink\b/i,
	/\bchmod\b/i, /\bchown\b/i,
	/\bgit\s+(push|reset|rebase|checkout\s+--)/i,
	/\b(npm|pnpm|yarn)\s+install\s+-g\b/i,
	/\bdocker\s+(rm|rmi|system\s+prune)\b/i,
	/\bkubectl\s+delete\b/i,
	/\b(systemctl|service)\b/i,
	/\bmv\b[^\n]*\s\.\.\//i, /\bcp\b[^\n]*\s\.\.\//i,
];

/**
 * True if an explicit terminal `cwd` escapes the workspace. A relative cwd (or none) resolves
 * inside the workspace and is fine; an ABSOLUTE cwd is an escape unless it is at/under a workspace
 * folder. Used to force explicit approval for commands that would run outside the workspace
 * (the audit found terminal cwd was an unvalidated raw string — a model could `cwd: '/etc'`).
 */
export function cwdEscapesWorkspace(cwd: string | null | undefined, workspaceFsPaths: readonly string[]): boolean {
	const c = (cwd ?? '').trim();
	if (!c) { return false; } // no cwd -> default to the workspace/terminal cwd
	const isAbsolute = c.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(c) || c.startsWith('\\\\');
	if (!isAbsolute) { return false; } // relative paths resolve within the workspace
	if (!workspaceFsPaths.length) { return true; } // absolute cwd with no workspace -> treat as escape
	// Collapse '.'/'..' before the prefix check, else '/ws/project/../../etc' looks contained but
	// resolves to '/etc'. (No node 'path' import -- this is in the browser bundle.)
	const norm = (p: string) => collapseDotSegments(p.replace(/\\/g, '/').replace(/\/+$/, ''));
	const cn = norm(c);
	return !workspaceFsPaths.some(root => {
		const rn = norm(root);
		return cn === rn || cn.startsWith(rn + '/');
	});
}

/** Resolve '.'/'..' path segments without touching the filesystem (POSIX-style, '/'-separated). */
function collapseDotSegments(p: string): string {
	const isAbs = p.startsWith('/');
	const out: string[] = [];
	for (const seg of p.split('/')) {
		if (seg === '' || seg === '.') { continue; }
		if (seg === '..') {
			if (out.length && out[out.length - 1] !== '..') { out.pop(); }
			else if (!isAbs) { out.push('..'); } // a relative path may legitimately rise above its base
			// at an absolute root, '..' is a no-op (can't go above '/')
			continue;
		}
		out.push(seg);
	}
	return (isAbs ? '/' : '') + out.join('/');
}

export function classifyCommandRisk(command: string): CommandRisk {
	const cmd = (command ?? '').trim();
	if (!cmd) { return { level: 'safe', categories: [], requiresApproval: false, hardBlock: false }; }

	for (const { re, why } of CRITICAL) {
		if (re.test(cmd)) {
			return { level: 'critical', categories: ['catastrophic'], requiresApproval: true, hardBlock: true, reason: why };
		}
	}

	const categories: string[] = [];
	for (const { re, cat } of DANGEROUS) {
		if (re.test(cmd) && !categories.includes(cat)) { categories.push(cat); }
	}
	if (categories.length > 0) {
		return { level: 'dangerous', categories, requiresApproval: true, hardBlock: false, reason: `matches ${categories.join(', ')}` };
	}

	for (const re of NORMAL) {
		if (re.test(cmd)) {
			return { level: 'normal', categories: ['mutating'], requiresApproval: false, hardBlock: false };
		}
	}

	return { level: 'safe', categories: [], requiresApproval: false, hardBlock: false };
}
