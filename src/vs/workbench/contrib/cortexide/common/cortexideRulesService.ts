/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  CortexIDE Project Rules Service
 *  --------------------------------
 *  Reads `.cortexide/rules/*.md` files from the workspace root and surfaces them as
 *  always-on instructions injected into every agent system prompt.  This mirrors
 *  Cursor's `.cursor/rules/*.mdc` pattern and gives teams a project-local way to
 *  encode coding standards, architecture decisions, and review policies without
 *  repeating them in every chat message.
 *
 *  Design contract:
 *  - Rules are plain Markdown files.  Any `.md` file placed in `.cortexide/rules/`
 *    is automatically picked up without any registration step.
 *  - File names become the rule title (stripped of the `.md` suffix).
 *  - A `<!-- scope: <glob> -->` comment on the first line scopes the rule to files
 *    matching that glob pattern.  Omitting the comment means the rule is global.
 *  - Max 32 rule files; max 8 KB per rule file.  Files exceeding these limits are
 *    silently truncated/skipped with a warning logged to the console.
 *  - Rules are cached in memory and refreshed on file-system events.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export const ICortexideRulesService = createDecorator<ICortexideRulesService>('cortexideRulesService');

export interface ProjectRule {
	/** Display name derived from the file name (without extension) */
	title: string;
	/** Raw Markdown content of the rule */
	content: string;
	// allow-any-unicode-next-line
	/** Optional glob pattern scoping the rule — undefined means global */
	scope: string | undefined;
	/** Absolute URI of the rule file */
	uri: URI;
}

export interface ICortexideRulesService {
	readonly _serviceBrand: undefined;

	/** All rules currently loaded from the workspace */
	readonly rules: ProjectRule[];

	/** Fired whenever the rules set changes (file added, removed, or edited) */
	readonly onDidChangeRules: Event<ProjectRule[]>;

	/**
	 * Returns rules that apply to the given file URI.
	 * Global rules (no scope) always apply.
	 * Scoped rules apply only when the URI matches their glob.
	 */
	getRulesForFile(fileUri: URI | undefined): ProjectRule[];

	/**
	 * Returns the concatenated rules block suitable for insertion into a system
	 * prompt, optionally scoped to a specific file.
	 */
	buildRulesBlock(fileUri?: URI): string;
}

// allow-any-unicode-next-line
// ─── constants ────────────────────────────────────────────────────────────────
const RULES_DIR = '.cortexide/rules';
const MAX_RULES = 32;
const MAX_RULE_BYTES = 8 * 1024; // 8 KB
const SCOPE_COMMENT_RE = /^<!--\s*scope:\s*(.+?)\s*-->/;

// allow-any-unicode-next-line
// ─── implementation ───────────────────────────────────────────────────────────

class CortexideRulesService extends Disposable implements ICortexideRulesService {
	declare readonly _serviceBrand: undefined;

	private _rules: ProjectRule[] = [];
	// Content of a root-level AGENTS.md (the emerging cross-tool standard, used by Cursor/Codex/etc.).
	// Folded into the rules block alongside .cortexide/rules so users migrating from other tools get
	// their repo agent instructions honored with no extra setup.
	private _agentsMd: string = '';
	private readonly _onDidChangeRules = this._register(new Emitter<ProjectRule[]>());
	readonly onDidChangeRules: Event<ProjectRule[]> = this._onDidChangeRules.event;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this._initialize();
	}

	get rules(): ProjectRule[] {
		return this._rules;
	}

	getRulesForFile(fileUri: URI | undefined): ProjectRule[] {
		return this._rules.filter(rule => {
			// allow-any-unicode-next-line
			if (!rule.scope) return true; // global rule — always applies
			if (!fileUri) return false;
			return matchGlob(rule.scope, fileUri.path);
		});
	}

	buildRulesBlock(fileUri?: URI): string {
		const applicable = this.getRulesForFile(fileUri);
		if (applicable.length === 0 && !this._agentsMd) return '';

		const parts: string[] = [];
		// AGENTS.md first (repo-wide agent instructions), then the structured .cortexide rules.
		if (this._agentsMd) {
			parts.push(`### AGENTS.md\n${this._agentsMd.trim()}`);
		}
		for (const r of applicable) {
			parts.push(`### Rule: ${r.title}\n${r.content.trim()}`);
		}
		if (parts.length === 0) return '';

		return `\n\n## Project Rules\n\nThe following rules are defined by the project maintainers. Follow them precisely.\n\n${parts.join('\n\n---\n\n')}\n`;
	}

	// allow-any-unicode-next-line
	// ─── internals ──────────────────────────────────────────────────────────────

	private async _initialize(): Promise<void> {
		const workspaceFolders = this.workspaceService.getWorkspace().folders;
		if (workspaceFolders.length === 0) return;

		const rootUri = workspaceFolders[0].uri;
		const rulesDirUri = URI.joinPath(rootUri, RULES_DIR);
		const agentsMdUri = URI.joinPath(rootUri, 'AGENTS.md');

		await this._loadAll(rulesDirUri);
		await this._loadAgentsMd(agentsMdUri);

		// Watch for changes inside the rules directory + the root AGENTS.md
		try {
			this._register(this.fileService.watch(rulesDirUri));
			this._register(this.fileService.watch(agentsMdUri));
			this._register(
				this.fileService.onDidFilesChange(async e => {
					if (e.affects(rulesDirUri)) {
						await this._loadAll(rulesDirUri);
					}
					if (e.affects(agentsMdUri)) {
						await this._loadAgentsMd(agentsMdUri);
						this._onDidChangeRules.fire(this._rules);
					}
				})
			);
		} catch {
			// allow-any-unicode-next-line
			// Rules directory / AGENTS.md doesn't exist yet — that's fine, watch isn't needed
		}
	}

	private async _loadAll(rulesDirUri: URI): Promise<void> {
		const newRules: ProjectRule[] = [];

		try {
			const stat = await this.fileService.resolve(rulesDirUri);
			if (!stat.isDirectory || !stat.children) {
				this._rules = [];
				this._onDidChangeRules.fire(this._rules);
				return;
			}

			const mdFiles = stat.children
				.filter(child => !child.isDirectory && child.name.endsWith('.md'))
				.slice(0, MAX_RULES);

			for (const child of mdFiles) {
				try {
					const raw: VSBuffer = await this.fileService.readFile(child.resource)
						.then(f => f.value);

					const text = raw.slice(0, MAX_RULE_BYTES).toString();
					const firstLine = text.split('\n')[0] ?? '';
					const scopeMatch = SCOPE_COMMENT_RE.exec(firstLine);
					const scope = scopeMatch ? scopeMatch[1] : undefined;
					const content = scopeMatch
						? text.slice(firstLine.length + 1) // strip the scope comment line
						: text;

					newRules.push({
						title: child.name.replace(/\.md$/, ''),
						content,
						scope,
						uri: child.resource,
					});
				} catch (err) {
					console.warn(`[CortexIDE Rules] Failed to read rule file ${child.name}:`, err);
				}
			}
		} catch {
			// allow-any-unicode-next-line
			// Directory doesn't exist — emit empty rules so consumers get a clean state
		}

		this._rules = newRules;
		this._onDidChangeRules.fire(this._rules);
	}

	private async _loadAgentsMd(agentsMdUri: URI): Promise<void> {
		try {
			const stat = await this.fileService.resolve(agentsMdUri);
			if (stat.isDirectory) { this._agentsMd = ''; return; }
			const raw = await this.fileService.readFile(agentsMdUri).then(f => f.value);
			this._agentsMd = raw.slice(0, 16 * 1024).toString().trim();
		} catch {
			// AGENTS.md doesn't exist — fine, no repo-wide instructions.
			this._agentsMd = '';
		}
	}
}

/**
 * Minimal glob matcher supporting `*`, `**`, and `?` wildcards.
 * Production-grade glob matching is handled by the platform already; this is a
 * lightweight fallback for the rules scoping check only.
 */
function matchGlob(glob: string, filePath: string): boolean {
	// Convert glob to regex
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*/g, '@@DOUBLE@@')
		.replace(/\*/g, '[^/]*')
		.replace(/@@DOUBLE@@/g, '.*')
		.replace(/\?/g, '[^/]');
	try {
		return new RegExp(`(^|/)${escaped}($|/)`).test(filePath);
	} catch {
		return false;
	}
}

registerSingleton(ICortexideRulesService, CortexideRulesService, InstantiationType.Delayed);
