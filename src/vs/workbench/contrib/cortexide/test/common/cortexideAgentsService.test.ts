/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { parseCustomAgentFile, resolveAgentModelSelection } from '../../common/cortexideAgentsService.js';

// Minimal fake providers map — resolveAgentModelSelection only reads settingsOfProvider[p]?.models[].modelName.
const FAKE_PROVIDERS = {
	anthropic: { models: [{ modelName: 'claude-3-5-sonnet' }] },
	ollama: { models: [{ modelName: 'qwen2.5-coder:7b' }, { modelName: 'llama3.2:3b' }] },
} as any;

suite('parseCustomAgentFile', () => {
	const u = URI.file('/ws/.cortexide/agents/code-reviewer.md');

	test('parses frontmatter (name/description/tools/model) and body as system prompt', () => {
		const text = `---\nname: code-reviewer\ndescription: Reviews a diff for bugs and style\ntools: read_file, grep_search, get_diagnostics\nmodel: qwen2.5-coder:7b\n---\nYou are a meticulous senior code reviewer.`;
		const a = parseCustomAgentFile('code-reviewer.md', text, u);
		assert.strictEqual(a.name, 'code-reviewer');
		assert.strictEqual(a.description, 'Reviews a diff for bugs and style');
		assert.deepStrictEqual(a.allowedTools, ['read_file', 'grep_search', 'get_diagnostics']);
		assert.strictEqual(a.model, 'qwen2.5-coder:7b');
		assert.strictEqual(a.systemPrompt, 'You are a meticulous senior code reviewer.');
	});

	test('name defaults to the file name; no frontmatter => the whole body is the prompt', () => {
		const a = parseCustomAgentFile('explorer.md', 'You explore the codebase and report back.', u);
		assert.strictEqual(a.name, 'explorer');
		assert.strictEqual(a.systemPrompt, 'You explore the codebase and report back.');
		assert.strictEqual(a.allowedTools, undefined);
		assert.strictEqual(a.model, undefined);
		assert.strictEqual(a.description, '');
	});

	test('strips quotes; empty/absent tools => undefined; accepts allowed_tools alias', () => {
		assert.strictEqual(parseCustomAgentFile('x.md', `---\nname: "x"\ntools:\n---\nbody`, u).allowedTools, undefined);
		assert.deepStrictEqual(parseCustomAgentFile('x.md', `---\nallowed_tools: read_file ls_dir\n---\nbody`, u).allowedTools, ['read_file', 'ls_dir']);
		assert.strictEqual(parseCustomAgentFile('x.md', `---\nname: 'quoted'\n---\nb`, u).name, 'quoted');
	});

	test('handles CRLF frontmatter fences', () => {
		const a = parseCustomAgentFile('y.md', `---\r\nname: y\r\ndescription: d\r\n---\r\nbody here`, u);
		assert.strictEqual(a.name, 'y');
		assert.strictEqual(a.description, 'd');
		assert.strictEqual(a.systemPrompt, 'body here');
	});
});

suite('resolveAgentModelSelection', () => {
	test('provider:model with a colon-in-tag model resolves when installed', () => {
		assert.deepStrictEqual(
			resolveAgentModelSelection('ollama:qwen2.5-coder:7b', FAKE_PROVIDERS),
			{ providerName: 'ollama', modelName: 'qwen2.5-coder:7b' }
		);
	});

	test('bare model name resolves via provider scan', () => {
		assert.deepStrictEqual(
			resolveAgentModelSelection('claude-3-5-sonnet', FAKE_PROVIDERS),
			{ providerName: 'anthropic', modelName: 'claude-3-5-sonnet' }
		);
	});

	test('bare ollama tag (colon in tag, prefix is NOT a provider) resolves via bare scan', () => {
		assert.deepStrictEqual(
			resolveAgentModelSelection('qwen2.5-coder:7b', FAKE_PROVIDERS),
			{ providerName: 'ollama', modelName: 'qwen2.5-coder:7b' }
		);
	});

	test('provider known but model not installed => null (falls back to parent)', () => {
		assert.strictEqual(resolveAgentModelSelection('ollama:not-installed', FAKE_PROVIDERS), null);
	});

	test('unknown / empty / undefined => null', () => {
		assert.strictEqual(resolveAgentModelSelection('totally-unknown-model', FAKE_PROVIDERS), null);
		assert.strictEqual(resolveAgentModelSelection('', FAKE_PROVIDERS), null);
		assert.strictEqual(resolveAgentModelSelection(undefined, FAKE_PROVIDERS), null);
	});
});
