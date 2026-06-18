/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { extractWebSearchQuery } from '../../common/webSearchQuery.js';

suite('webSearchQuery - extractWebSearchQuery', () => {

	test('REGRESSION: "check online and tell me when SpaceX IPO\'d" keeps the subject, drops the framing', () => {
		const q = extractWebSearchQuery('check online and tell me when SpaceX IPO\'d');
		// must contain the real subject...
		assert.ok(/spacex/i.test(q), q);
		assert.ok(/ipo/i.test(q), q);
		// ...and must NOT be the command framing that returned DVLA "check online" results
		assert.ok(!/check online/i.test(q), q);
		assert.ok(!/tell me/i.test(q), q);
	});

	test('strips "tell me what you know about X" -> X', () => {
		assert.strictEqual(extractWebSearchQuery('tell me what you know about quantum computing'), 'quantum computing');
	});

	test('strips "what do you know about X" -> X', () => {
		assert.strictEqual(extractWebSearchQuery('what do you know about the James Webb telescope'), 'James Webb telescope');
	});

	test('strips a leading "google" verb', () => {
		const q = extractWebSearchQuery('google the latest react version');
		assert.ok(!/^google/i.test(q), q);
		assert.ok(/react/i.test(q) && /version/i.test(q), q);
	});

	test('strips "search the web for X" -> X', () => {
		assert.strictEqual(extractWebSearchQuery('search the web for best pizza in NYC'), 'best pizza in NYC');
	});

	test('strips "look up online the X" -> X', () => {
		assert.strictEqual(extractWebSearchQuery('look up online the population of Tokyo'), 'population of Tokyo');
	});

	test('strips trailing politeness framing', () => {
		const q = extractWebSearchQuery('search online for the current bitcoin price please');
		assert.ok(!/please/i.test(q), q);
		assert.ok(/bitcoin/i.test(q), q);
	});

	test('keeps a query that has no framing unchanged-ish', () => {
		const q = extractWebSearchQuery('latest stable node.js LTS version');
		assert.ok(/node\.js/i.test(q) && /lts/i.test(q), q);
	});

	test('does not strip "search" inside "research"', () => {
		const q = extractWebSearchQuery('find information on cancer research funding 2026');
		assert.ok(/research/i.test(q), q);
		assert.ok(/cancer/i.test(q), q);
		assert.ok(!/find information/i.test(q), q);
	});

	test('falls back to the original when stripping leaves nothing', () => {
		assert.strictEqual(extractWebSearchQuery('check online'), 'check online');
		assert.strictEqual(extractWebSearchQuery('google'), 'google');
	});

	test('empty input returns empty', () => {
		assert.strictEqual(extractWebSearchQuery(''), '');
		assert.strictEqual(extractWebSearchQuery('   '), '');
	});

	test('result never contains leftover double spaces or leading conjunctions', () => {
		const q = extractWebSearchQuery('check the internet and tell me about the SpaceX Starship test flight');
		assert.ok(!/ {2,}/.test(q), q);
		assert.ok(!/^(and|the|about)\b/i.test(q), q);
		assert.ok(/starship/i.test(q), q);
	});
});
