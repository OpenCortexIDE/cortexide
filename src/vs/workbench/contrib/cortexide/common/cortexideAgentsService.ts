/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  CortexIDE Custom Agents Service
 *  -------------------------------
 *  Reads `.cortexide/agents/*.md` files from the workspace root and surfaces them as
 *  reusable SUB-AGENT definitions the orchestrator can delegate to via the run_subagent
 *  tool (agentType = the agent's name). Mirrors Claude Code's `.claude/agents/*.md` and
 *  Roo's `.roomodes`. Each file is Markdown with optional YAML-ish frontmatter:
 *
 *    ---
 *    name: code-reviewer
 *    description: Reviews a diff for bugs, security, and style
 *    tools: read_file, grep_search, get_diagnostics, read_lint_errors
 *    model: qwen2.5-coder:7b
 *    ---
 *    You are a meticulous senior code reviewer. ... (this body is the agent's system prompt)
 *
 *  Design contract:
 *  - Any `.md` file in `.cortexide/agents/` is picked up automatically (no registration).
 *  - `name` defaults to the file name (without `.md`). `description` guides the orchestrator
 *    on when to pick this agent. `tools` (comma/space separated) restricts the agent's
 *    toolset (omit = the full agent toolset). `model` pins a model (omit = inherit the parent's).
 *  - The body (after frontmatter) is the agent's system prompt.
 *  - Max 32 agents; max 16 KB per file. Cached in memory, refreshed on FS events.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { SettingsOfProvider, ProviderName, providerNames } from './cortexideSettingsTypes.js';

export const ICortexideAgentsService = createDecorator<ICortexideAgentsService>('cortexideAgentsService');

export interface CustomAgent {
	/** Identifier the orchestrator passes as run_subagent's agentType (defaults to the file name). */
	name: string;
	/** One-line description of what this agent is for — helps the orchestrator choose it. */
	description: string;
	/** The agent's system prompt (the Markdown body after frontmatter). */
	systemPrompt: string;
	/** Restricted builtin tool names, or undefined for the full agent toolset. */
	allowedTools: string[] | undefined;
	/** Pinned model "provider:model" or bare model name, or undefined to inherit the parent's. */
	model: string | undefined;
	/** Absolute URI of the agent file. */
	uri: URI;
}

export interface ICortexideAgentsService {
	readonly _serviceBrand: undefined;
	/** All custom agents currently loaded from the workspace. */
	readonly agents: CustomAgent[];
	/** Fired whenever the agent set changes (file added, removed, or edited). */
	readonly onDidChangeAgents: Event<CustomAgent[]>;
	/** Look up an agent by name (case-insensitive); undefined if not found. */
	getAgent(name: string): CustomAgent | undefined;
}

// --- constants ---
const AGENTS_DIR = '.cortexide/agents';
const MAX_AGENTS = 32;
const MAX_AGENT_BYTES = 16 * 1024; // 16 KB (system prompts can be longer than rules)

/** Parse a `.cortexide/agents/*.md` file into a CustomAgent. Frontmatter is a simple `key: value`
 *  block between leading `---` fences; everything after is the system prompt. No external YAML dep. */
export function parseCustomAgentFile(fileName: string, text: string, uri: URI): CustomAgent {
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
	const toolsStr = fm['tools'] ?? fm['allowed_tools'] ?? fm['allowedtools'];
	const allowedTools = toolsStr ? toolsStr.split(/[,\s]+/).map(s => s.trim()).filter(Boolean) : undefined;
	return {
		name: (fm['name'] || fileName.replace(/\.md$/, '')).trim(),
		description: fm['description'] ?? '',
		systemPrompt: body.trim(),
		allowedTools: allowedTools && allowedTools.length > 0 ? allowedTools : undefined,
		model: fm['model'] || undefined,
		uri,
	};
}

/**
 * Resolve a custom agent's `model` string to a concrete ModelSelection, or null if it can't be
 * resolved (the caller then falls back to the parent's model). Accepts:
 *  - "provider:model" — split on the FIRST colon; the left must be a known provider AND the right an
 *    INSTALLED model (e.g. "ollama:qwen2.5-coder:7b").
 *  - a bare model name — scanned across providers in priority order (online first, then local),
 *    mirroring resolveAutoModelSelection's ordering.
 * Ollama tags contain colons, so a bare "qwen2.5-coder:7b" (whose "qwen2.5-coder" prefix is NOT a
 * provider) correctly falls through to the bare-name scan. Pure; unit-tested.
 */
export function resolveAgentModelSelection(modelStr: string | undefined, settingsOfProvider: SettingsOfProvider): { providerName: ProviderName, modelName: string } | null {
	const s = (modelStr ?? '').trim();
	if (!s) { return null; }
	const colon = s.indexOf(':');
	if (colon > 0) {
		const left = s.slice(0, colon);
		const right = s.slice(colon + 1);
		if (right && (providerNames as readonly string[]).includes(left)) {
			const models = settingsOfProvider[left as ProviderName]?.models ?? [];
			if (models.some(m => m.modelName === right)) {
				return { providerName: left as ProviderName, modelName: right };
			}
		}
	}
	const priority: ProviderName[] = ['anthropic', 'openAI', 'gemini', 'xAI', 'mistral', 'deepseek', 'groq', 'ollama', 'vLLM', 'lmStudio', 'openAICompatible', 'openRouter', 'liteLLM', 'pollinations'] as ProviderName[];
	const order = priority.filter(p => (providerNames as readonly string[]).includes(p));
	for (const p of order) {
		const models = settingsOfProvider[p]?.models ?? [];
		if (models.some(m => m.modelName === s)) {
			return { providerName: p, modelName: s };
		}
	}
	return null;
}

// --- implementation ---

class CortexideAgentsService extends Disposable implements ICortexideAgentsService {
	declare readonly _serviceBrand: undefined;

	private _agents: CustomAgent[] = [];
	private readonly _onDidChangeAgents = this._register(new Emitter<CustomAgent[]>());
	readonly onDidChangeAgents: Event<CustomAgent[]> = this._onDidChangeAgents.event;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this._initialize();
	}

	get agents(): CustomAgent[] {
		return this._agents;
	}

	getAgent(name: string): CustomAgent | undefined {
		if (!name) { return undefined; }
		const lower = name.trim().toLowerCase();
		return this._agents.find(a => a.name.toLowerCase() === lower);
	}

	private async _initialize(): Promise<void> {
		const workspaceFolders = this.workspaceService.getWorkspace().folders;
		if (workspaceFolders.length === 0) { return; }
		const agentsDirUri = URI.joinPath(workspaceFolders[0].uri, AGENTS_DIR);

		await this._loadAll(agentsDirUri);

		try {
			this._register(this.fileService.watch(agentsDirUri));
			this._register(this.fileService.onDidFilesChange(async e => {
				if (e.affects(agentsDirUri)) { await this._loadAll(agentsDirUri); }
			}));
		} catch {
			// Agents directory doesn't exist yet — fine, no watch needed.
		}
	}

	private async _loadAll(agentsDirUri: URI): Promise<void> {
		const newAgents: CustomAgent[] = [];
		try {
			const stat = await this.fileService.resolve(agentsDirUri);
			if (!stat.isDirectory || !stat.children) {
				this._agents = [];
				this._onDidChangeAgents.fire(this._agents);
				return;
			}
			const mdFiles = stat.children
				.filter(child => !child.isDirectory && child.name.endsWith('.md'))
				.slice(0, MAX_AGENTS);
			for (const child of mdFiles) {
				try {
					const raw: VSBuffer = await this.fileService.readFile(child.resource).then(f => f.value);
					const text = raw.slice(0, MAX_AGENT_BYTES).toString();
					const agent = parseCustomAgentFile(child.name, text, child.resource);
					if (agent.name && agent.systemPrompt) { newAgents.push(agent); }
				} catch (err) {
					console.warn(`[CortexIDE Agents] Failed to read agent file ${child.name}:`, err);
				}
			}
		} catch {
			// Directory doesn't exist — emit empty so consumers get a clean state.
		}
		this._agents = newAgents;
		this._onDidChangeAgents.fire(this._agents);
	}
}

registerSingleton(ICortexideAgentsService, CortexideAgentsService, InstantiationType.Delayed);
