/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { createXmlToolCallScanner, XmlToolScanResult } from '../../common/xmlToolCallScanner.js';
import type { InternalToolInfo } from '../../common/prompt/prompts.js';

/**
 * The streaming XML tool-call scanner (extracted verbatim from electron-main extractGrammar.ts's
 * extractXMLToolsWrapper). Models without native function-calling emit tool calls as XML text; this is
 * what turns that stream into a structured tool call while hiding the markup. Load-bearing for agentic
 * use on local models, so its partial-tag buffering, first-complete-tag latching, param trimming, and
 * never-throw-on-malformed-markup behavior are pinned here against fragment streams.
 */

const TOOLS: InternalToolInfo[] = [
	{ name: 'read_file', description: 'd', params: { uri: { description: 'p' } } },
	{ name: 'ls_dir', description: 'd', params: { uri: { description: 'p' } } },
	{ name: 'run_command', description: 'd', params: { command: { description: 'p' } } },
	{ name: 'edit_file', description: 'd', params: { uri: { description: 'p' }, search: { description: 'p' }, replace: { description: 'p' } } },
];

const TID = 'TEST-TOOL-ID';

/** Feed a sequence of ACCUMULATED-text snapshots (each is the full text so far), then finalize. */
function runAccumulated(snapshots: string[]): XmlToolScanResult {
	const scanner = createXmlToolCallScanner(TOOLS, TID);
	for (const s of snapshots) { scanner.push(s); }
	return scanner.trimAndGetFinal();
}

/** Turn a list of deltas into accumulated snapshots, then stream them. */
function streamDeltas(deltas: string[]): XmlToolScanResult {
	const snaps: string[] = [];
	let acc = '';
	for (const d of deltas) { acc += d; snaps.push(acc); }
	return runAccumulated(snaps.length ? snaps : ['']);
}

/** Stream a string one character at a time (worst-case fragmentation). */
function streamCharByChar(full: string): XmlToolScanResult {
	return streamDeltas([...full]);
}

suite('xmlToolCallScanner -- complete tool calls', () => {

	test('a complete call in a single chunk: markup hidden, params parsed, isDone true', () => {
		const r = runAccumulated(['Sure!\n<read_file><uri>/a/b.ts</uri></read_file>']);
		assert.strictEqual(r.displayText, 'Sure!');
		assert.deepStrictEqual(r.toolCall, {
			name: 'read_file', rawParams: { uri: '/a/b.ts' }, doneParams: ['uri'], isDone: true, id: TID,
		});
	});

	test('newline-padded param values are trimmed (the common LLM formatting)', () => {
		const r = runAccumulated(['<read_file><uri>\n/a/b.ts\n</uri></read_file>']);
		assert.strictEqual(r.toolCall?.rawParams.uri, '/a/b.ts');
	});

	test('multiple params on one tool are all captured in order', () => {
		const r = runAccumulated(['<edit_file><uri>/a.ts</uri><search>foo</search><replace>bar</replace></edit_file>']);
		assert.deepStrictEqual(r.toolCall?.rawParams, { uri: '/a.ts', search: 'foo', replace: 'bar' });
		assert.deepStrictEqual(r.toolCall?.doneParams, ['uri', 'search', 'replace']);
		assert.strictEqual(r.toolCall?.isDone, true);
	});

	test('a param value containing a JSON blob with angle brackets survives verbatim', () => {
		const json = '{"key": "val with <angle> brackets", "n": 1}';
		const r = runAccumulated([`<run_command><command>${json}</command></run_command>`]);
		assert.strictEqual(r.toolCall?.rawParams.command, json);
		assert.strictEqual(r.toolCall?.name, 'run_command');
	});
});

suite('xmlToolCallScanner -- fragment streaming', () => {

	test('a call split mid-tag across two chunks resolves identically to one chunk', () => {
		const split = streamDeltas(['Hi <read_', 'file><uri>/x</uri></read_file>']);
		const oneShot = runAccumulated(['Hi <read_file><uri>/x</uri></read_file>']);
		assert.strictEqual(split.displayText, 'Hi');
		assert.deepStrictEqual(split.toolCall, oneShot.toolCall);
		assert.strictEqual(split.toolCall?.rawParams.uri, '/x');
	});

	test('character-by-character streaming converges to the one-shot result', () => {
		const full = 'Let me look.\n<read_file><uri>/src/index.ts</uri></read_file>';
		const charByChar = streamCharByChar(full);
		const oneShot = runAccumulated([full]);
		assert.strictEqual(charByChar.displayText, oneShot.displayText);
		assert.deepStrictEqual(charByChar.toolCall, oneShot.toolCall);
		assert.strictEqual(charByChar.displayText, 'Let me look.');
	});

	test('the tool call grows monotonically as the stream arrives (partial -> done)', () => {
		const scanner = createXmlToolCallScanner(TOOLS, TID);
		// before the open tag completes, no tool call and the prose is held back (partial tag buffered)
		const a = scanner.push('answer <read_fi');
		assert.strictEqual(a.toolCall, undefined);
		// open tag + partial param: tool detected, not done
		const b = scanner.push('answer <read_file><uri>/a');
		assert.strictEqual(b.toolCall?.name, 'read_file');
		assert.strictEqual(b.toolCall?.isDone, false);
		// closed: done
		const c = scanner.push('answer <read_file><uri>/a</uri></read_file>');
		assert.strictEqual(c.toolCall?.isDone, true);
		assert.strictEqual(c.toolCall?.rawParams.uri, '/a');
		const fin = scanner.trimAndGetFinal();
		assert.strictEqual(fin.displayText, 'answer');
	});

	test('push() hides the markup DURING streaming, not only at finalization (mid-stream displayText)', () => {
		// Each push() return is exactly what onText forwards on every streamed chunk (the live, progressively
		// rendered text), so assert the INTERMEDIATE displayText -- not just the finalized value. Guards against
		// a regression that breaks mid-stream markup-hiding (e.g. dropping the partial-tag buffer) but still
		// happens to converge at finalization.
		const scanner = createXmlToolCallScanner(TOOLS, TID);
		// a half-written open tag is buffered, so the partial markup is NOT shown mid-stream
		assert.strictEqual(scanner.push('answer <read_fi').displayText, '');
		// once the open tag completes, display is exactly the pre-tag prose (untrimmed until finalization)
		assert.strictEqual(scanner.push('answer <read_file><uri>/a').displayText, 'answer ');
		// and it stays hidden as the rest of the call streams in
		assert.strictEqual(scanner.push('answer <read_file><uri>/a</uri></read_file>').displayText, 'answer ');
	});
});

suite('xmlToolCallScanner -- robustness (never throws on malformed markup)', () => {

	const MALFORMED = [
		'<read_file>',                                   // open tag only, no params/close
		'<read_file><uri>/a',                            // unclosed param
		'<read_file><uri>/a</uri>',                      // param closed, tool not
		'<<<>>> garbage <read_file <uri',                // junk angle brackets
		'<read_file></read_file>',                       // empty body
		'<read_file><unknownparam>x</unknownparam></read_file>', // param not in the tool schema
		'<notatool><uri>/a</uri></notatool>',            // tag that is not a known tool
		'plain text with a < but no tag',                // a lone angle bracket
		'',                                              // empty stream
	];

	for (const m of MALFORMED) {
		test(`does not throw on: ${JSON.stringify(m).slice(0, 50)}`, () => {
			assert.doesNotThrow(() => {
				runAccumulated([m]);
				streamCharByChar(m); // also fuzz the fragmented path
			});
		});
	}

	test('an unknown tool tag is NOT treated as a tool call (passes through as text)', () => {
		const r = runAccumulated(['<notatool><uri>/a</uri></notatool>']);
		assert.strictEqual(r.toolCall, undefined);
		assert.strictEqual(r.displayText, '<notatool><uri>/a</uri></notatool>');
	});

	test('a JSON-style tool blob (no XML tag) is left untouched as display text, no tool call', () => {
		const blob = '{"name":"read_file","arguments":{"uri":"/a"}}';
		const r = runAccumulated([blob]);
		assert.strictEqual(r.toolCall, undefined);
		assert.strictEqual(r.displayText, blob);
	});

	test('an unclosed tool call still yields a partial tool call (isDone false), no throw', () => {
		const r = runAccumulated(['<read_file><uri>/a/b.ts']);
		assert.strictEqual(r.toolCall?.name, 'read_file');
		assert.strictEqual(r.toolCall?.isDone, false);
	});
});

suite('xmlToolCallScanner -- no-tool passthrough', () => {

	test('plain prose with no tool call is returned verbatim (trimmed) with no tool call', () => {
		const r = runAccumulated(['The answer is 42.   ']);
		assert.strictEqual(r.displayText, 'The answer is 42.');
		assert.strictEqual(r.toolCall, undefined);
	});

	test('the first COMPLETE tool open tag latches; text before it is the display', () => {
		const r = runAccumulated(['before <ls_dir><uri>/</uri></ls_dir> after']);
		assert.strictEqual(r.toolCall?.name, 'ls_dir');
		assert.strictEqual(r.displayText, 'before');
	});
});
