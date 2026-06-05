/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { parseHooksConfigFile } from '../../common/hooksServiceTypes.js';

suite('parseHooksConfigFile', () => {
	test('parses the documented { hooks: [...] } shape', () => {
		const cfg = parseHooksConfigFile(JSON.stringify({
			hooks: [
				{ event: 'pre-tool', command: ['echo', 'hi'] },
				{ event: 'post-tool', command: ['node', 'report.js'], timeoutMs: 2000 },
			]
		}));
		assert.strictEqual(cfg.hooks.length, 2);
		assert.deepStrictEqual(cfg.hooks[0], { event: 'pre-tool', command: ['echo', 'hi'], timeoutMs: 5000 });
		assert.strictEqual(cfg.hooks[1].timeoutMs, 2000);
	});

	test('accepts a bare array of hook entries', () => {
		const cfg = parseHooksConfigFile(JSON.stringify([{ event: 'agent-stop', command: ['./on-stop.sh'] }]));
		assert.strictEqual(cfg.hooks.length, 1);
		assert.strictEqual(cfg.hooks[0].event, 'agent-stop');
	});

	test('coerces a string command to a single-element argv (still shell-free)', () => {
		const cfg = parseHooksConfigFile(JSON.stringify({ hooks: [{ event: 'pre-tool', command: 'mytool' }] }));
		assert.deepStrictEqual(cfg.hooks[0].command, ['mytool']);
	});

	test('drops malformed entries (bad event, empty/missing command) without throwing', () => {
		const cfg = parseHooksConfigFile(JSON.stringify({
			hooks: [
				{ event: 'not-an-event', command: ['x'] },
				{ event: 'pre-tool' },                      // no command
				{ event: 'pre-tool', command: [] },          // empty command
				{ event: 'pre-tool', command: [123, ''] },   // non-string / empty filtered out -> empty -> dropped
				{ event: 'post-tool', command: ['ok'] },     // valid
			]
		}));
		assert.strictEqual(cfg.hooks.length, 1);
		assert.strictEqual(cfg.hooks[0].command[0], 'ok');
	});

	test('invalid JSON => empty config (never throws)', () => {
		assert.deepStrictEqual(parseHooksConfigFile('{ not json'), { hooks: [] });
		assert.deepStrictEqual(parseHooksConfigFile(''), { hooks: [] });
	});

	test('caps timeout at 60s and ignores non-positive timeouts', () => {
		const cfg = parseHooksConfigFile(JSON.stringify({
			hooks: [
				{ event: 'pre-tool', command: ['a'], timeoutMs: 999999 },
				{ event: 'post-tool', command: ['b'], timeoutMs: -5 },
			]
		}));
		assert.strictEqual(cfg.hooks[0].timeoutMs, 60000);
		assert.strictEqual(cfg.hooks[1].timeoutMs, 5000); // invalid -> default
	});

	test('caps the number of hooks at 50', () => {
		const many = Array.from({ length: 80 }, () => ({ event: 'pre-tool', command: ['x'] }));
		const cfg = parseHooksConfigFile(JSON.stringify({ hooks: many }));
		assert.strictEqual(cfg.hooks.length, 50);
	});
});
