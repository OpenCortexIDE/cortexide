/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { languageIdFromPath } from '../common/treeSitterLanguageMap.js';

export interface ASTSymbol {
	name: string;
	kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method' | 'property' | 'enum' | 'module';
	startLine: number;
	endLine: number;
	startColumn: number;
	endColumn: number;
	children?: ASTSymbol[];
}

export interface ASTChunk {
	text: string;
	startLine: number;
	endLine: number;
	nodeType: string; // e.g., 'function_declaration', 'class_declaration'
	symbolName?: string; // If this chunk represents a symbol
}

export const ITreeSitterService = createDecorator<ITreeSitterService>('treeSitterService');

export interface ITreeSitterService {
	readonly _serviceBrand: undefined;
	isEnabled(): boolean;
	extractSymbols(uri: URI, content: string): Promise<ASTSymbol[]>;
	createASTChunks(uri: URI, content: string, symbols: ASTSymbol[]): Promise<ASTChunk[]>;
}

class TreeSitterService implements ITreeSitterService {
	declare readonly _serviceBrand: undefined;

	private _enabled = false;
	private _parserCache: Map<string, any> = new Map(); // language -> parser instance
	private _wasmModule: any = null;
	private _loadFailed = false; // Track if module loading has failed to prevent repeated warnings

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
	) {
		this._updateConfiguration();
		this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cortexide.index.ast')) {
				this._updateConfiguration();
			}
		});
	}

	private _updateConfiguration(): void {
		this._enabled = this._configurationService.getValue<boolean>('cortexide.index.ast') ?? true;
	}

	isEnabled(): boolean {
		return this._enabled;
	}

	private async _getWasmModule(): Promise<any> {
		if (this._wasmModule) {
			return this._wasmModule;
		}

		// If we've already failed to load, don't try again
		if (this._loadFailed) {
			return null;
		}

		try {
			// Dynamic import of tree-sitter-wasm
			// Note: This may fail in browser contexts if the module isn't properly bundled
			// In that case, TreeSitter features will be disabled gracefully
			const treeSitterWasm = await import('@vscode/tree-sitter-wasm');
			this._wasmModule = treeSitterWasm;
			return this._wasmModule;
		} catch (error) {
			// Only log the warning once to prevent spam
			if (!this._loadFailed) {
				this._logService.warn('[TreeSitter] Failed to load tree-sitter-wasm. AST indexing will be disabled. Error:', error);
				this._loadFailed = true;
			}
			return null;
		}
	}

	private _getLanguageFromUri(uri: URI): string | null {
		// The extension -> grammar map lives in the pure, node-tested common/treeSitterLanguageMap.ts.
		return languageIdFromPath(uri.path);
	}

	async extractSymbols(uri: URI, content: string): Promise<ASTSymbol[]> {
		if (!this._enabled) {
			return [];
		}

		const language = this._getLanguageFromUri(uri);
		if (!language) {
			return [];
		}

		try {
			const wasmModule = await this._getWasmModule();
			if (!wasmModule) {
				return [];
			}

			// Get or create parser for this language
			let parser = this._parserCache.get(language);
			if (!parser) {
				parser = await wasmModule.createParser(language);
				if (parser) {
					this._parserCache.set(language, parser);
				}
			}

			if (!parser) {
				return [];
			}

			// Parse the content
			const tree = parser.parse(content);
			if (!tree) {
				return [];
			}

			// Extract symbols from AST
			const symbols: ASTSymbol[] = [];
			this._traverseAST(tree.rootNode, content, symbols, null);

			return symbols;
		} catch (error) {
			this._logService.debug('[TreeSitter] Failed to extract symbols:', error);
			return [];
		}
	}

	private _traverseAST(node: any, content: string, symbols: ASTSymbol[], parent: ASTSymbol | null): void {
		if (!node) return;

		// Extract symbol based on node type
		const nodeType = node.type;
		let symbolKind: ASTSymbol['kind'] | null = null;
		let symbolName: string | null = null;

		// Map node types to symbol kinds (language-agnostic patterns)
		if (nodeType.includes('function') || nodeType.includes('method')) {
			symbolKind = nodeType.includes('method') ? 'method' : 'function';
			// Try to find name node
			symbolName = this._extractNameFromNode(node, content);
		} else if (nodeType.includes('class')) {
			symbolKind = 'class';
			symbolName = this._extractNameFromNode(node, content);
		} else if (nodeType.includes('interface')) {
			symbolKind = 'interface';
			symbolName = this._extractNameFromNode(node, content);
		} else if (nodeType.includes('type') && nodeType.includes('alias')) {
			symbolKind = 'type';
			symbolName = this._extractNameFromNode(node, content);
		} else if (nodeType.includes('variable') || nodeType.includes('declaration')) {
			// Check if it's a top-level variable
			if (parent === null || parent.kind === 'module') {
				symbolKind = 'variable';
				symbolName = this._extractNameFromNode(node, content);
			}
		} else if (nodeType.includes('enum')) {
			symbolKind = 'enum';
			symbolName = this._extractNameFromNode(node, content);
		} else if (nodeType.includes('property')) {
			symbolKind = 'property';
			symbolName = this._extractNameFromNode(node, content);
		}

		if (symbolKind && symbolName) {
			const startPosition = node.startPosition;
			const endPosition = node.endPosition;
			const symbol: ASTSymbol = {
				name: symbolName,
				kind: symbolKind,
				startLine: startPosition.row + 1, // tree-sitter uses 0-based, we use 1-based
				endLine: endPosition.row + 1,
				startColumn: startPosition.column,
				endColumn: endPosition.column,
				children: [],
			};

			// Traverse children to find nested symbols
			for (let i = 0; i < node.childCount; i++) {
				const child = node.child(i);
				if (child) {
					this._traverseAST(child, content, symbols, symbol);
				}
			}

			// Add to parent's children or top-level symbols
			if (parent) {
				if (!parent.children) {
					parent.children = [];
				}
				parent.children.push(symbol);
			} else {
				symbols.push(symbol);
			}
		} else {
			// Continue traversing even if this node isn't a symbol
			for (let i = 0; i < node.childCount; i++) {
				const child = node.child(i);
				if (child) {
					this._traverseAST(child, content, symbols, parent);
				}
			}
		}
	}

	private _extractNameFromNode(node: any, content: string): string | null {
		// Try common name field patterns
		const nameFields = ['name', 'identifier', 'declaration', 'definition'];
		for (const field of nameFields) {
			const nameNode = node.childForFieldName(field);
			if (nameNode) {
				return nameNode.text;
			}
		}

		// Fallback: look for first identifier child
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i);
			if (child && (child.type === 'identifier' || child.type === 'type_identifier')) {
				return child.text;
			}
		}

		return null;
	}

	async createASTChunks(uri: URI, content: string, symbols: ASTSymbol[]): Promise<ASTChunk[]> {
		if (!this._enabled || symbols.length === 0) {
			return [];
		}

		try {
			const wasmModule = await this._getWasmModule();
			if (!wasmModule) {
				return [];
			}

			const language = this._getLanguageFromUri(uri);
			if (!language) {
				return [];
			}

			let parser = this._parserCache.get(language);
			if (!parser) {
				parser = await wasmModule.createParser(language);
				if (parser) {
					this._parserCache.set(language, parser);
				}
			}

			if (!parser) {
				return [];
			}

			const tree = parser.parse(content);
			if (!tree) {
				return [];
			}

			const chunks: ASTChunk[] = [];
			const lines = content.split('\n');

			// Create chunks for each symbol
			for (const symbol of symbols) {
				const startLine = symbol.startLine - 1; // Convert to 0-based
				const endLine = symbol.endLine - 1;
				const chunkText = lines.slice(startLine, endLine + 1).join('\n');

				if (chunkText.trim().length > 10) { // Only add non-trivial chunks
					chunks.push({
						text: chunkText,
						startLine: symbol.startLine,
						endLine: symbol.endLine,
						nodeType: `${symbol.kind}_declaration`,
						symbolName: symbol.name,
					});
				}
			}

			// Also create chunks for top-level statements (not covered by symbols)
			// This ensures we don't miss code between symbols
			this._extractTopLevelChunks(tree.rootNode, content, lines, chunks, symbols);

			return chunks;
		} catch (error) {
			this._logService.debug('[TreeSitter] Failed to create AST chunks:', error);
			return [];
		}
	}

	private _extractTopLevelChunks(rootNode: any, content: string, lines: string[], chunks: ASTChunk[], symbols: ASTSymbol[]): void {
		// Find top-level nodes that aren't already covered by symbols
		const coveredRanges = new Set<string>();
		for (const symbol of symbols) {
			coveredRanges.add(`${symbol.startLine}-${symbol.endLine}`);
		}

		const processNode = (node: any) => {
			if (!node) return;

			// Check if this is a top-level statement/declaration
			const nodeType = node.type;
			if (nodeType.includes('statement') || nodeType.includes('declaration') || nodeType.includes('expression')) {
				const startPos = node.startPosition;
				const endPos = node.endPosition;
				const startLine = startPos.row + 1;
				const endLine = endPos.row + 1;
				const rangeKey = `${startLine}-${endLine}`;

				// Skip if already covered by a symbol
				if (!coveredRanges.has(rangeKey) && endLine - startLine > 0) {
					const chunkText = lines.slice(startPos.row, endPos.row + 1).join('\n');
					if (chunkText.trim().length > 50) {
						chunks.push({
							text: chunkText,
							startLine,
							endLine,
							nodeType,
						});
						coveredRanges.add(rangeKey);
					}
				}
			}

			// Process children
			for (let i = 0; i < node.childCount; i++) {
				const child = node.child(i);
				if (child) {
					processNode(child);
				}
			}
		};

		processNode(rootNode);
	}
}

registerSingleton(ITreeSitterService, TreeSitterService, InstantiationType.Delayed);

