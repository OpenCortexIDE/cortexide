/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { buildTypedToolProperties, toOpenAICompatibleTool } from '../../common/providerToolFormat.js';
import { InternalToolInfo } from '../../common/prompt/prompts.js';

/**
 * The shared tool-schema property builder used by all three providers (OpenAI / Anthropic / Gemini).
 * Pins the "every property gets a JSON-Schema type" contract -- the regression that once shipped
 * type-less OpenAI tool schemas (fixed in ff1718a708d).
 */
suite('providerToolFormat.buildTypedToolProperties', () => {

	test('empty params -> empty properties', () => {
		assert.deepStrictEqual(buildTypedToolProperties({}), {});
	});

	test('single param gets type:string and keeps its description', () => {
		assert.deepStrictEqual(buildTypedToolProperties({ uri: { description: 'the file path' } }),
			{ uri: { description: 'the file path', type: 'string' } });
	});

	test('EVERY param gets a type field (the type-less-schema regression guard)', () => {
		const out = buildTypedToolProperties({ a: { description: 'A' }, b: { description: 'B' }, c: { description: 'C' } });
		for (const k of Object.keys(out)) {
			assert.strictEqual(out[k].type, 'string', `property ${k} must be typed`);
		}
		assert.deepStrictEqual(Object.keys(out), ['a', 'b', 'c']);
	});

	test('does NOT mutate the input params', () => {
		const params: InternalToolInfo['params'] = { x: { description: 'X' } };
		const snapshot = JSON.stringify(params);
		buildTypedToolProperties(params);
		assert.strictEqual(JSON.stringify(params), snapshot, 'input params must be untouched');
		assert.ok(!('type' in (params as Record<string, object>).x), 'no type leaked back into the source');
	});

	test('the OpenAI-compatible tool embeds the typed properties under function.parameters', () => {
		const tool = toOpenAICompatibleTool({ name: 'read_file', description: 'reads a file', params: { uri: { description: 'path' } } } as InternalToolInfo);
		assert.strictEqual(tool.type, 'function');
		assert.strictEqual(tool.function.parameters.type, 'object');
		assert.deepStrictEqual(tool.function.parameters.properties, { uri: { description: 'path', type: 'string' } });
	});
});
