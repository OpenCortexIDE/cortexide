/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { mcpToolNamePrefix, removeMCPToolNamePrefix } from '../../common/mcpServiceTypes.js';

/**
 * Phase 7 (MCP): the per-server tool-name prefix used to be Math.random -- a different prefix per tool
 * that changed on every reconnect. These tests pin the deterministic replacement: stable, server-keyed,
 * and round-trippable through removeMCPToolNamePrefix (the call-time strip).
 */
suite('mcpToolNamePrefix', () => {

	test('deterministic: same server name -> same prefix', () => {
		assert.strictEqual(mcpToolNamePrefix('github'), mcpToolNamePrefix('github'));
		assert.strictEqual(mcpToolNamePrefix('my-server'), mcpToolNamePrefix('my-server'));
	});

	test('different server names generally produce different prefixes', () => {
		const names = ['github', 'filesystem', 'playwright', 'postgres', 'slack', 'my-server', 'a', 'b'];
		const prefixes = new Set(names.map(mcpToolNamePrefix));
		assert.strictEqual(prefixes.size, names.length, 'expected distinct prefixes for distinct server names');
	});

	test('prefix is exactly 6 chars from [0-9a-z] and contains no underscore', () => {
		for (const n of ['github', 'x', 'A Very Long Server Name With Spaces', 'srv_with_underscores', '', '0', 'zzzzzzzzzzzzz']) {
			const p = mcpToolNamePrefix(n);
			assert.strictEqual(p.length, 6, `prefix for ${JSON.stringify(n)} must be 6 chars, got ${p}`);
			assert.ok(/^[0-9a-z]{6}$/.test(p), `prefix ${p} must be lowercase base36`);
			assert.ok(!p.includes('_'), 'prefix must not contain underscore');
		}
	});

	test('round-trips through removeMCPToolNamePrefix (the call-time strip) for tool names with and without underscores', () => {
		for (const [server, tool] of [['github', 'search'], ['fs', 'list_files'], ['x', 'a_b_c_d']] as const) {
			const prefixed = `${mcpToolNamePrefix(server)}_${tool}`;
			assert.strictEqual(removeMCPToolNamePrefix(prefixed), tool, `failed to strip back ${tool}`);
		}
	});
});
