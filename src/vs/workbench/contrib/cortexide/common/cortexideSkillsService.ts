/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  CortexIDE Skills Service
 *  ------------------------
 *  Reads `.cortexide/skills/<name>/SKILL.md` files from the workspace and surfaces them as
 *  user-invokable slash commands. Typing `/<skill-name> [args]` in the chat expands into the
 *  skill's instructions (the Markdown body) plus the user's args, then runs as a normal chat
 *  turn. Mirrors Claude Code's Agent Skills (`.claude/skills/<name>/SKILL.md`) and the sibling
 *  custom-agents feature (see cortexideAgentsService.ts). Each SKILL.md is Markdown with
 *  optional frontmatter:
 *
 *    ---
 *    name: review-pr
 *    description: Review the current diff for bugs and style
 *    ---
 *    Read the staged diff with get_diagnostics and read_file, then ... (this body is injected)
 *
 *  Design contract:
 *  - Each immediate sub-directory of `.cortexide/skills/` that contains a `SKILL.md` is one skill
 *    (no registration). `name` defaults to the DIRECTORY name; `description` is shown in the
 *    slash-command help. The body after frontmatter is the instruction block that gets injected.
 *  - Skills are workspace-authored project files (semi-trusted), so unlike fetched web content
 *    they are injected as plain instructions -- they are the user's own commands.
 *  - Max 64 skills; max 64 KB per file. Cached in memory, refreshed on FS events.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export const ICortexideSkillsService = createDecorator<ICortexideSkillsService>('cortexideSkillsService');

export interface Skill {
	/** Slash-command name the user types after `/` (defaults to the skill's directory name). */
	name: string;
	/** One-line description shown in slash-command help. */
	description: string;
	/** The instruction block (the Markdown body after frontmatter) injected when invoked. */
	instructions: string;
	/** Optional restricted tool list (from `allowed-tools`/`tools` frontmatter); undefined = unrestricted.
	 *  Parsed for parity with custom agents; enforcement at dispatch is a separate (not-yet-wired) step. */
	allowedTools?: string[];
	/** Absolute URI of the SKILL.md file. */
	uri: URI;
}

export interface ICortexideSkillsService {
	readonly _serviceBrand: undefined;
	/** All skills currently loaded from the workspace. */
	readonly skills: Skill[];
	/** Fired whenever the skill set changes (added, removed, or edited). */
	readonly onDidChangeSkills: Event<Skill[]>;
	/** Look up a skill by name (case-insensitive); undefined if not found. */
	getSkill(name: string): Skill | undefined;
}

// --- constants ---
const SKILLS_DIR = '.cortexide/skills';
const SKILL_FILE = 'SKILL.md';
const MAX_SKILLS = 64;
const MAX_SKILL_BYTES = 64 * 1024; // 64 KB

/** Parse a `SKILL.md` file into a Skill. Frontmatter is a simple `key: value` block between leading
 *  `---` fences; everything after is the instruction body. No external YAML dep (mirrors parseCustomAgentFile). */
export function parseSkillFile(dirName: string, text: string, uri: URI): Skill {
	const fm: Record<string, string> = {};
	let body = text;
	const fmMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(text);
	if (fmMatch) {
		body = text.slice(fmMatch[0].length);
		for (const rawLine of fmMatch[1].split('\n')) {
			const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(rawLine.trim());
			if (m) { fm[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, ''); }
		}
	}
	// allowed-tools / allowed_tools / tools -> a restricted tool list (mirrors parseCustomAgentFile's tokenizer).
	const toolsStr = fm['allowed-tools'] ?? fm['allowed_tools'] ?? fm['tools'];
	const allowedTools = toolsStr ? toolsStr.split(/[,\s]+/).map(s => s.trim()).filter(Boolean) : undefined;
	return {
		name: (fm['name'] || dirName).trim(),
		description: fm['description'] ?? '',
		instructions: body.trim(),
		allowedTools: allowedTools && allowedTools.length > 0 ? allowedTools : undefined,
		uri,
	};
}

/**
 * Parse a raw chat input into a skill invocation. Returns `{ name, args }` when the input is a
 * single-word slash command (`/<name>` optionally followed by args), else null. The name is
 * lower-cased so lookup is case-insensitive; args preserve the user's original text. Pure.
 */
export function parseSkillInvocation(input: string): { name: string; args: string } | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith('/')) { return null; }
	// The name is a single [A-Za-z0-9_-] run (matching skill directory names). This is deliberately tight
	// so a file path like `/src/foo.ts` or a doubled `//x` is NOT mistaken for a skill invocation.
	const m = /^\/([A-Za-z0-9_-]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
	if (!m) { return null; }
	return { name: m[1].toLowerCase(), args: (m[2] ?? '').trim() };
}

/** Built-in slash commands a skill must not shadow (the chat input handles these directly). */
export const RESERVED_SLASH_COMMANDS: ReadonlySet<string> = new Set(['clear', 'new', 'settings', 'model', 'help']);

/** Whether `name` collides with a reserved built-in slash command (case-insensitive). */
export function isReservedSkillName(name: string): boolean {
	return RESERVED_SLASH_COMMANDS.has(name.trim().toLowerCase());
}

/**
 * De-duplicate skills by name, case-insensitively, FIRST-WINS (matching getSkill's first-match lookup).
 * Returns the kept skills and the names that were dropped, so the loader can keep the set unambiguous.
 */
export function dedupeSkillsByName(skills: readonly Skill[]): { kept: Skill[]; conflicts: string[] } {
	const seen = new Set<string>();
	const kept: Skill[] = [];
	const conflicts: string[] = [];
	for (const skill of skills) {
		const key = skill.name.trim().toLowerCase();
		if (seen.has(key)) { conflicts.push(skill.name); continue; }
		seen.add(key);
		kept.push(skill);
	}
	return { kept, conflicts };
}

/**
 * Build the chat message a skill invocation expands into: a traceable header, the skill's
 * instructions, and the user's args (when present). Pure -- the caller submits the returned string
 * as the user turn. Skills are the user's own project files, so the body is injected as instructions.
 */
export function buildSkillInvocationMessage(skill: Skill, args: string): string {
	const parts = [`[Invoking skill: ${skill.name}]`, skill.instructions];
	const trimmedArgs = args.trim();
	if (trimmedArgs) { parts.push(`Additional input for this skill:\n${trimmedArgs}`); }
	return parts.join('\n\n');
}

// --- implementation ---

class CortexideSkillsService extends Disposable implements ICortexideSkillsService {
	declare readonly _serviceBrand: undefined;

	private _skills: Skill[] = [];
	private readonly _onDidChangeSkills = this._register(new Emitter<Skill[]>());
	readonly onDidChangeSkills: Event<Skill[]> = this._onDidChangeSkills.event;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this._initialize();
	}

	get skills(): Skill[] {
		return this._skills;
	}

	getSkill(name: string): Skill | undefined {
		if (!name) { return undefined; }
		const lower = name.trim().toLowerCase();
		return this._skills.find(s => s.name.toLowerCase() === lower);
	}

	private async _initialize(): Promise<void> {
		const workspaceFolders = this.workspaceService.getWorkspace().folders;
		if (workspaceFolders.length === 0) { return; }
		const skillsDirUri = URI.joinPath(workspaceFolders[0].uri, SKILLS_DIR);

		await this._loadAll(skillsDirUri);

		try {
			this._register(this.fileService.watch(skillsDirUri, { recursive: true, excludes: [] }));
			this._register(this.fileService.onDidFilesChange(async e => {
				if (e.affects(skillsDirUri)) { await this._loadAll(skillsDirUri); }
			}));
		} catch {
			// Skills directory doesn't exist yet -- fine, no watch needed.
		}
	}

	private async _loadAll(skillsDirUri: URI): Promise<void> {
		const newSkills: Skill[] = [];
		try {
			const stat = await this.fileService.resolve(skillsDirUri);
			if (!stat.isDirectory || !stat.children) {
				this._skills = [];
				this._onDidChangeSkills.fire(this._skills);
				return;
			}
			const skillDirs = stat.children
				.filter(child => child.isDirectory)
				.slice(0, MAX_SKILLS);
			for (const dir of skillDirs) {
				try {
					const skillFileUri = URI.joinPath(dir.resource, SKILL_FILE);
					const raw: VSBuffer = await this.fileService.readFile(skillFileUri).then(f => f.value);
					const text = raw.slice(0, MAX_SKILL_BYTES).toString();
					const skill = parseSkillFile(dir.name, text, skillFileUri);
					if (skill.name && skill.instructions) { newSkills.push(skill); }
				} catch {
					// No SKILL.md in this directory (or unreadable) -- skip it.
				}
			}
		} catch {
			// Directory doesn't exist -- emit empty so consumers get a clean state.
		}
		// Keep the set unambiguous: first-wins on a case-insensitive name clash (matches getSkill's lookup).
		this._skills = dedupeSkillsByName(newSkills).kept;
		this._onDidChangeSkills.fire(this._skills);
	}
}

registerSingleton(ICortexideSkillsService, CortexideSkillsService, InstantiationType.Delayed);
