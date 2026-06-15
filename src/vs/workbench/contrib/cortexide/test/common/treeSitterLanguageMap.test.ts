/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { languageIdFromPath, treeSitterGrammarId, TREE_SITTER_LANGUAGE_BY_EXTENSION } from '../../common/treeSitterLanguageMap.js';

/**
 * Pins the extension -> tree-sitter grammar routing (extracted from TreeSitterService._getLanguageFromUri).
 * Tree-sitter is not yet activated, so this map is the contract for which grammar a file will route to.
 */
suite('treeSitterLanguageMap.languageIdFromPath', () => {

	test('every mapped extension resolves to its grammar id (golden table)', () => {
		const golden: Record<string, string> = {
			'/a/b.ts': 'typescript',
			'/a/b.tsx': 'tsx',
			'/a/b.js': 'javascript',
			'/a/b.jsx': 'javascript',
			'/a/b.py': 'python',
			'/a/b.java': 'java',
			'/a/b.go': 'go',
			'/a/b.rs': 'rust',
			'/a/b.cpp': 'cpp',
			'/a/b.c': 'c',
			'/a/b.cs': 'csharp',
			'/a/b.php': 'php',
			'/a/b.rb': 'ruby',
			'/a/b.swift': 'swift',
			'/a/b.kt': 'kotlin',
		};
		for (const [path, lang] of Object.entries(golden)) {
			assert.strictEqual(languageIdFromPath(path), lang, `${path} -> ${lang}`);
		}
	});

	test('the golden table covers EXACTLY the exported map (no drift)', () => {
		// jsx and js both map to javascript, so the set of language ids has one fewer entry than keys.
		assert.strictEqual(Object.keys(TREE_SITTER_LANGUAGE_BY_EXTENSION).length, 15);
	});

	test('extension match is case-insensitive (uses the lower-cased trailing segment)', () => {
		assert.strictEqual(languageIdFromPath('/A/B.TS'), 'typescript');
		assert.strictEqual(languageIdFromPath('/A/B.Py'), 'python');
	});

	test('uses the LAST dot-separated segment for multi-dot paths', () => {
		assert.strictEqual(languageIdFromPath('/a/b.test.ts'), 'typescript');
		assert.strictEqual(languageIdFromPath('/a.b/c.d/e.go'), 'go');
	});

	test('unknown / missing extensions return null', () => {
		assert.strictEqual(languageIdFromPath('/a/b.unknownext'), null);
		assert.strictEqual(languageIdFromPath('/a/b.md'), null);
		assert.strictEqual(languageIdFromPath('/a/noextension'), null); // pop() yields the whole basename
		assert.strictEqual(languageIdFromPath('/a/b.'), null);          // trailing dot -> '' -> null
		assert.strictEqual(languageIdFromPath(''), null);
	});

	test('a dotfile with no real extension routes to null (matches the original)', () => {
		// '/.gitignore'.split('.').pop() === 'gitignore' -> not in the map -> null
		assert.strictEqual(languageIdFromPath('/.gitignore'), null);
	});
});

suite('treeSitterLanguageMap.treeSitterGrammarId', () => {

	test('languages with a shipped @vscode/tree-sitter-wasm grammar map to their grammar id', () => {
		// identity for most; csharp -> the on-disk grammar name "c-sharp"
		assert.strictEqual(treeSitterGrammarId('typescript'), 'typescript');
		assert.strictEqual(treeSitterGrammarId('tsx'), 'tsx');
		assert.strictEqual(treeSitterGrammarId('javascript'), 'javascript');
		assert.strictEqual(treeSitterGrammarId('python'), 'python');
		assert.strictEqual(treeSitterGrammarId('java'), 'java');
		assert.strictEqual(treeSitterGrammarId('go'), 'go');
		assert.strictEqual(treeSitterGrammarId('rust'), 'rust');
		assert.strictEqual(treeSitterGrammarId('cpp'), 'cpp');
		assert.strictEqual(treeSitterGrammarId('php'), 'php');
		assert.strictEqual(treeSitterGrammarId('ruby'), 'ruby');
		assert.strictEqual(treeSitterGrammarId('csharp'), 'c-sharp');
	});

	test('languages with no shipped grammar (c, swift, kotlin) return null -> caller falls back to BM25/LSP', () => {
		assert.strictEqual(treeSitterGrammarId('c'), null);
		assert.strictEqual(treeSitterGrammarId('swift'), null);
		assert.strictEqual(treeSitterGrammarId('kotlin'), null);
	});

	test('null / unknown language ids return null', () => {
		assert.strictEqual(treeSitterGrammarId(null), null);
		assert.strictEqual(treeSitterGrammarId('cobol'), null);
	});

	test('every grammar id maps to a real extension in the language map (no orphan grammars)', () => {
		// Each language that has a grammar must be reachable from some file extension.
		const reachable = new Set(Object.values(TREE_SITTER_LANGUAGE_BY_EXTENSION));
		for (const lang of ['typescript', 'tsx', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'php', 'ruby', 'csharp']) {
			assert.ok(reachable.has(lang), `${lang} must be produced by some extension`);
		}
	});
});
