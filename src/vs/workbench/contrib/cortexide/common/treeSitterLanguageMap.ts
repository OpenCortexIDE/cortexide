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
