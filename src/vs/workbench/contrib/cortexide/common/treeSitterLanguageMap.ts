/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The file-extension -> tree-sitter language id map, extracted verbatim from
 * TreeSitterService._getLanguageFromUri so it is node-testable. Tree-sitter parsing is not yet
 * activated (the parser load is a deferred item), but this map decides which grammar a file routes
 * to once it is, so pinning it now keeps that routing stable. Byte-identical to the old inline map.
 */
export const TREE_SITTER_LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
	'ts': 'typescript',
	'tsx': 'tsx',
	'js': 'javascript',
	'jsx': 'javascript',
	'py': 'python',
	'java': 'java',
	'go': 'go',
	'rs': 'rust',
	'cpp': 'cpp',
	'c': 'c',
	'cs': 'csharp',
	'php': 'php',
	'rb': 'ruby',
	'swift': 'swift',
	'kt': 'kotlin',
};

/**
 * The tree-sitter language id for a path, or null if the (lower-cased) trailing extension is unknown.
 * Uses the LAST dot-separated segment of the path, exactly like the original `uri.path` logic.
 */
export function languageIdFromPath(path: string): string | null {
	const ext = path.split('.').pop()?.toLowerCase();
	return TREE_SITTER_LANGUAGE_BY_EXTENSION[ext || ''] || null;
}

/**
 * Our language id -> the `@vscode/tree-sitter-wasm` grammar id (the `<id>` in `tree-sitter-<id>.wasm`,
 * loaded via ITreeSitterLibraryService.getLanguagePromise). Only languages whose grammar SHIPS in
 * @vscode/tree-sitter-wasm are listed: typescript/tsx/javascript/python/java/go/rust/cpp/php/ruby and
 * c-sharp. The grammar id differs from our id only for csharp ('c-sharp'). Languages with no shipped
 * grammar today -- c, swift, kotlin -- are intentionally absent so the caller falls back to BM25/LSP.
 */
const TREE_SITTER_GRAMMAR_ID_BY_LANGUAGE: Readonly<Record<string, string>> = {
	'typescript': 'typescript',
	'tsx': 'tsx',
	'javascript': 'javascript',
	'python': 'python',
	'java': 'java',
	'go': 'go',
	'rust': 'rust',
	'cpp': 'cpp',
	'php': 'php',
	'ruby': 'ruby',
	'csharp': 'c-sharp',
};

/**
 * The tree-sitter grammar id to load for a language id (or null if no grammar ships for it). null means
 * "no AST grammar available" -- the caller should fall back, not error.
 */
export function treeSitterGrammarId(languageId: string | null): string | null {
	if (!languageId) {
		return null;
	}
	return TREE_SITTER_GRAMMAR_ID_BY_LANGUAGE[languageId] ?? null;
}
