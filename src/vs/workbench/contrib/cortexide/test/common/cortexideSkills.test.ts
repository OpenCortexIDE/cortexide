/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { parseSkillFile, parseSkillInvocation, buildSkillInvocationMessage, Skill, RESERVED_SLASH_COMMANDS, isReservedSkillName, dedupeSkillsByName } from '../../common/cortexideSkillsService.js';

/**
 * Phase 6 (Skills): pure tests for the `.cortexide/skills/<name>/SKILL.md` parser + slash-command
 * dispatch core. Mirrors the cortexideAgentsService parser; the discovery service itself is browser
 * I/O (FS watch) and not node-testable, so the parse + invocation logic lives in these pure fns.
 */

const u = URI.file('/ws/.cortexide/skills/review/SKILL.md');

suite('cortexideSkills.parseSkillFile', () => {

	test('name defaults to the directory name when frontmatter omits it', () => {
		const s = parseSkillFile('my-skill', 'Do the thing.', u);
		assert.strictEqual(s.name, 'my-skill');
		assert.strictEqual(s.description, '');
		assert.strictEqual(s.instructions, 'Do the thing.');
	});

	test('frontmatter name/description override; body becomes instructions', () => {
		const text = `---\nname: review-pr\ndescription: Review the diff\n---\nRead the diff, then report bugs.`;
		const s = parseSkillFile('review', text, u);
		assert.strictEqual(s.name, 'review-pr');
		assert.strictEqual(s.description, 'Review the diff');
		assert.strictEqual(s.instructions, 'Read the diff, then report bugs.');
	});

	test('strips surrounding quotes on frontmatter values and is case-insensitive on keys', () => {
		const text = `---\nNAME: "quoted-name"\nDescription: 'quoted desc'\n---\nbody`;
		const s = parseSkillFile('dir', text, u);
		assert.strictEqual(s.name, 'quoted-name');
		assert.strictEqual(s.description, 'quoted desc');
	});

	test('CRLF frontmatter fences are handled', () => {
		const text = `---\r\nname: crlf\r\ndescription: d\r\n---\r\nbody here`;
		const s = parseSkillFile('dir', text, u);
		assert.strictEqual(s.name, 'crlf');
		assert.strictEqual(s.instructions, 'body here');
	});

	test('no frontmatter: whole file is the instruction body, name from directory', () => {
		const s = parseSkillFile('helper', '   just instructions   ', u);
		assert.strictEqual(s.name, 'helper');
		assert.strictEqual(s.instructions, 'just instructions');
	});

	test('records the SKILL.md uri', () => {
		const s = parseSkillFile('review', 'x', u);
		assert.strictEqual(s.uri.toString(), u.toString());
	});
});

suite('cortexideSkills.parseSkillInvocation', () => {

	test('non-slash input is not an invocation', () => {
		assert.strictEqual(parseSkillInvocation('hello world'), null);
		assert.strictEqual(parseSkillInvocation('  plain text /not-at-start'), null);
	});

	test('bare /name (no args)', () => {
		assert.deepStrictEqual(parseSkillInvocation('/review'), { name: 'review', args: '' });
	});

	test('/name with args preserves the args text', () => {
		assert.deepStrictEqual(parseSkillInvocation('/review the auth module please'), { name: 'review', args: 'the auth module please' });
	});

	test('name is lower-cased for case-insensitive lookup; args keep original case', () => {
		assert.deepStrictEqual(parseSkillInvocation('/Review Fix The API'), { name: 'review', args: 'Fix The API' });
	});

	test('leading/trailing whitespace is tolerated', () => {
		assert.deepStrictEqual(parseSkillInvocation('   /review   extra   '), { name: 'review', args: 'extra' });
	});

	test('a lone slash is not a valid invocation', () => {
		assert.strictEqual(parseSkillInvocation('/'), null);
		assert.strictEqual(parseSkillInvocation('/   '), null);
	});

	test('multi-line args are preserved', () => {
		const r = parseSkillInvocation('/review line one\nline two');
		assert.deepStrictEqual(r, { name: 'review', args: 'line one\nline two' });
	});
});

suite('cortexideSkills.buildSkillInvocationMessage', () => {

	const skill: Skill = { name: 'review', description: 'd', instructions: 'Read the diff and report bugs.', uri: u };

	test('no args: header + instructions only', () => {
		assert.strictEqual(
			buildSkillInvocationMessage(skill, ''),
			'[Invoking skill: review]\n\nRead the diff and report bugs.'
		);
	});

	test('with args: header + instructions + the user args block', () => {
		assert.strictEqual(
			buildSkillInvocationMessage(skill, 'focus on auth.ts'),
			'[Invoking skill: review]\n\nRead the diff and report bugs.\n\nAdditional input for this skill:\nfocus on auth.ts'
		);
	});

	test('whitespace-only args are treated as no args', () => {
		assert.strictEqual(
			buildSkillInvocationMessage(skill, '   '),
			'[Invoking skill: review]\n\nRead the diff and report bugs.'
		);
	});
});

suite('cortexideSkills.parseSkillFile - allowedTools (agent parity)', () => {
	const u = URI.file('/ws/.cortexide/skills/x/SKILL.md');
	test('allowed-tools / allowed_tools / tools all parse into a token list', () => {
		assert.deepStrictEqual(parseSkillFile('x', '---\nallowed-tools: read_file, grep_search\n---\nbody', u).allowedTools, ['read_file', 'grep_search']);
		assert.deepStrictEqual(parseSkillFile('x', '---\nallowed_tools: read_file grep_search\n---\nbody', u).allowedTools, ['read_file', 'grep_search']);
		assert.deepStrictEqual(parseSkillFile('x', '---\ntools: read_file\n---\nbody', u).allowedTools, ['read_file']);
	});
	test('no tools frontmatter -> allowedTools undefined (unrestricted), empty -> undefined', () => {
		assert.strictEqual(parseSkillFile('x', 'just a body', u).allowedTools, undefined);
		assert.strictEqual(parseSkillFile('x', '---\ntools:\n---\nbody', u).allowedTools, undefined);
	});
});

suite('cortexideSkills.parseSkillInvocation - tightened name', () => {
	test('a file path or doubled slash is NOT a skill invocation', () => {
		assert.strictEqual(parseSkillInvocation('/src/foo.ts'), null);
		assert.strictEqual(parseSkillInvocation('//x'), null);
		assert.strictEqual(parseSkillInvocation('/a.b'), null); // '.' is not in the name charset
	});
	test('hyphen/underscore/digits in the name still parse', () => {
		assert.deepStrictEqual(parseSkillInvocation('/review-pr_2 fix it'), { name: 'review-pr_2', args: 'fix it' });
	});
});

suite('cortexideSkills hardening helpers', () => {
	const sk = (name: string): Skill => ({ name, description: '', instructions: 'x', uri: URI.file('/ws/.cortexide/skills/' + name + '/SKILL.md') });

	test('RESERVED_SLASH_COMMANDS / isReservedSkillName flag built-ins (case-insensitive)', () => {
		assert.ok(RESERVED_SLASH_COMMANDS.has('help'));
		assert.strictEqual(isReservedSkillName('Help'), true);
		assert.strictEqual(isReservedSkillName('clear'), true);
		assert.strictEqual(isReservedSkillName('review'), false);
	});

	test('dedupeSkillsByName keeps the FIRST of a case-insensitive name clash and reports conflicts', () => {
		const { kept, conflicts } = dedupeSkillsByName([sk('Review'), sk('review'), sk('deploy')]);
		assert.deepStrictEqual(kept.map(s => s.name), ['Review', 'deploy']);
		assert.deepStrictEqual(conflicts, ['review']);
	});
});
