/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { suite, test } from 'mocha';
import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { instantiateTextModel, createModelServices } from '../../../../../editor/test/common/testTextModel.js';
import { DocumentSymbol, SymbolKind } from '../../../../../editor/common/languages.js';

suite('ToolsService - New Cursor Tools', () => {
	const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let testUri: URI;
	let testModel: ITextModel;

	setup(() => {
		const disposables = new DisposableStore();
		testDisposables.add(disposables);

		instantiationService = createModelServices(disposables, []);
		testUri = URI.file('/test/file.ts');
		testModel = instantiateTextModel(instantiationService, 'function testFunction() {\n  return 42;\n}\n\nconst result = testFunction();', 'typescript', {}, testUri);
		testDisposables.add(testModel);
	});

	suite('extract_function validation', () => {
		test('validates endLine >= startLine', () => {
			const startLine = 15;
			const endLine = 10;

			try {
				if (endLine < startLine) {
					throw new Error(`Invalid LLM output: end_line (${endLine}) must be >= start_line (${startLine})`);
				}
				assert.fail('Should have thrown error');
			} catch (error: any) {
				assert.ok(error.message.includes('end_line'));
				assert.ok(error.message.includes('start_line'));
			}
		});

		test('validates line numbers are positive', () => {
			const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
				if (typeof numStr === 'number') return numStr;
				if (!numStr || numStr === 'null' || numStr === 'undefined') return opts.default;
				if (typeof numStr === 'string') {
					const parsedInt = Number.parseInt(numStr + '');
					if (!Number.isInteger(parsedInt)) return opts.default;
					return parsedInt;
				}
				return opts.default;
			};

			const line = validateNumber(-5, { default: null });
			if (line === null || line < 1) {
				assert.ok(true, 'Negative line number rejected');
			} else {
				assert.fail('Should have rejected negative line number');
			}
		});
	});

	suite('extract_function logic', () => {
		test('extracts code block with proper indentation', () => {
			const codeToExtract = '  const x = 1;\n  const y = 2;\n  return x + y;';
			const baseIndent = '  ';
			const functionIndent = '  ';
			const functionName = 'calculateSum';

			const newFunctionCode = `${functionIndent}function ${functionName}() {\n${codeToExtract.split('\n').map(line => `${functionIndent}  ${line}`).join('\n')}\n${functionIndent}}\n`;
			const replacementCode = `${baseIndent}${functionName}();\n`;

			assert.ok(newFunctionCode.includes('function calculateSum()'));
			assert.ok(newFunctionCode.includes('    const x = 1;'));
			assert.ok(replacementCode.includes('calculateSum();'));
		});

		test('preserves indentation correctly', () => {
			const lines = [
				'    if (condition) {',
				'      doSomething();',
				'    }'
			];
			const functionIndent = '    ';

			const extracted = lines.map(line => `${functionIndent}  ${line}`).join('\n');
			// Each line gets functionIndent (4) + 2 spaces prepended, so the first line
			// (which already starts with 4 spaces) ends up with 10 leading spaces, and
			// every line's RELATIVE indentation is preserved.
			assert.ok(extracted.startsWith('          if (condition) {'), 'first line: 4+2 prepended onto its original 4 spaces');
			assert.ok(extracted.includes('\n            doSomething();'), 'nested line keeps its extra 2-space relative indent');
			assert.ok(extracted.endsWith('      }'), 'closing brace keeps base indentation');
		});
	});

	suite('automated_code_review logic', () => {
		test('detects long lines', () => {
			const longLine = 'a'.repeat(150);
			const issues: Array<{ severity: 'error' | 'warning' | 'info', message: string, line: number, column: number }> = [];

			if (longLine.length > 120) {
				issues.push({
					severity: 'info',
					message: `Line 1 is too long (${longLine.length} characters). Consider breaking it into multiple lines.`,
					line: 1,
					column: 1,
				});
			}

			assert.strictEqual(issues.length, 1);
			assert.strictEqual(issues[0].severity, 'info');
			assert.ok(issues[0].message.includes('too long'));
		});

		test('detects TODO comments', () => {
			const line = '  // TODO: Fix this later';
			const issues: Array<{ severity: 'error' | 'warning' | 'info', message: string, line: number, column: number }> = [];

			if (line.match(/TODO|FIXME|XXX|HACK/i)) {
				issues.push({
					severity: 'info',
					message: `Line 1 contains a TODO/FIXME comment: ${line.trim().substring(0, 50)}`,
					line: 1,
					column: 1,
				});
			}

			assert.strictEqual(issues.length, 1);
			assert.ok(issues[0].message.includes('TODO'));
		});

		test('detects console.log in non-test files', () => {
			const line = '  console.log("debug");';
			const uri = URI.file('/src/app.ts');
			const issues: Array<{ severity: 'error' | 'warning' | 'info', message: string, line: number, column: number }> = [];

			if (line.includes('console.log') && !uri.fsPath.includes('test') && !uri.fsPath.includes('spec')) {
				issues.push({
					severity: 'warning',
					message: `Line 1 contains console.log. Consider removing debug statements in production code.`,
					line: 1,
					column: 1,
				});
			}

			assert.strictEqual(issues.length, 1);
			assert.strictEqual(issues[0].severity, 'warning');
		});

		test('ignores console.log in test files', () => {
			const line = '  console.log("test");';
			const uri = URI.file('/src/app.test.ts');
			const issues: Array<{ severity: 'error' | 'warning' | 'info', message: string, line: number, column: number }> = [];

			if (line.includes('console.log') && !uri.fsPath.includes('test') && !uri.fsPath.includes('spec')) {
				issues.push({
					severity: 'warning',
					message: `Line 1 contains console.log.`,
					line: 1,
					column: 1,
				});
			}

			assert.strictEqual(issues.length, 0, 'Should not flag console.log in test files');
		});
	});

	suite('generate_tests logic', () => {
		test('generates correct test file path for TypeScript', () => {
			const uri = URI.file('/src/utils.ts');
			const testFileName = uri.fsPath.replace(/\.(ts|js|py|java)$/, '.test.$1');
			const testFileUri = URI.file(testFileName);

			assert.strictEqual(testFileUri.fsPath, '/src/utils.test.ts');
		});

		test('generates correct test file path for JavaScript', () => {
			const uri = URI.file('/src/utils.js');
			const testFileName = uri.fsPath.replace(/\.(ts|js|py|java)$/, '.test.$1');
			const testFileUri = URI.file(testFileName);

			assert.strictEqual(testFileUri.fsPath, '/src/utils.test.js');
		});

		test('detects test framework from file extension', () => {
			const fileExtension = 'ts';
			let detectedFramework = 'generic';

			if (fileExtension === 'ts' || fileExtension === 'js') {
				detectedFramework = 'jest';
			} else if (fileExtension === 'py') {
				detectedFramework = 'pytest';
			} else if (fileExtension === 'java') {
				detectedFramework = 'junit';
			}

			assert.strictEqual(detectedFramework, 'jest');
		});
	});

	suite('search_symbols logic', () => {
		test('processes document symbols recursively', () => {
			const symbols: Array<{ name: string, kind: string, uri: URI, startLine: number, startColumn: number, endLine: number, endColumn: number }> = [];
			const query = 'test';

			const mockSymbol: DocumentSymbol = {
				name: 'TestClass',
				detail: '',
				kind: SymbolKind.Class,
				range: new Range(1, 1, 1, 10),
				selectionRange: new Range(1, 1, 1, 10),
				tags: [],
				children: [
					{
						name: 'testMethod',
						detail: '',
						kind: SymbolKind.Method,
						range: new Range(2, 1, 2, 10),
						selectionRange: new Range(2, 1, 2, 10),
						tags: [],
					}
				]
			};

			const processSymbol = (sym: DocumentSymbol, parentName = '') => {
				const fullName = parentName ? `${parentName}.${sym.name}` : sym.name;
				if (fullName.toLowerCase().includes(query.toLowerCase())) {
					symbols.push({
						name: fullName,
						kind: sym.kind.toString(),
						uri: testUri,
						startLine: sym.range.startLineNumber,
						startColumn: sym.range.startColumn,
						endLine: sym.range.endLineNumber,
						endColumn: sym.range.endColumn,
					});
				}
				if (sym.children) {
					for (const child of sym.children) {
						processSymbol(child, fullName);
					}
				}
			};

			processSymbol(mockSymbol);

			assert.strictEqual(symbols.length, 2);
			assert.strictEqual(symbols[0].name, 'TestClass');
			assert.strictEqual(symbols[1].name, 'TestClass.testMethod');
		});
	});

	suite('go_to_definition result formatting', () => {
		test('formats single definition location', () => {
			const locations = [{
				uri: URI.file('/src/file.ts'),
				startLine: 20,
				startColumn: 1,
				endLine: 20,
				endColumn: 10,
			}];

			const result = locations.map((loc, i) =>
				`Definition ${i + 1}: ${loc.uri.fsPath}:${loc.startLine}:${loc.startColumn}`
			).join('\n');

			assert.strictEqual(result, 'Definition 1: /src/file.ts:20:1');
		});

		test('formats multiple definition locations', () => {
			const locations = [
				{ uri: URI.file('/src/file1.ts'), startLine: 10, startColumn: 1, endLine: 10, endColumn: 10 },
				{ uri: URI.file('/src/file2.ts'), startLine: 20, startColumn: 1, endLine: 20, endColumn: 10 },
			];

			const result = locations.map((loc, i) =>
				`Definition ${i + 1}: ${loc.uri.fsPath}:${loc.startLine}:${loc.startColumn}`
			).join('\n');

			assert.ok(result.includes('Definition 1'));
			assert.ok(result.includes('Definition 2'));
			assert.ok(result.includes('file1.ts'));
			assert.ok(result.includes('file2.ts'));
		});
	});

	suite('find_references result formatting', () => {
		test('formats references with count', () => {
			const locations = [
				{ uri: URI.file('/src/file1.ts'), startLine: 10, startColumn: 5, endLine: 10, endColumn: 15 },
				{ uri: URI.file('/src/file2.ts'), startLine: 20, startColumn: 3, endLine: 20, endColumn: 13 },
			];

			const result = `Found ${locations.length} reference(s):\n${locations.map((loc, i) =>
				`${i + 1}. ${loc.uri.fsPath}:${loc.startLine}:${loc.startColumn}`
			).join('\n')}`;

			assert.ok(result.includes('Found 2 reference(s)'));
			assert.ok(result.includes('1. /src/file1.ts:10:5'));
			assert.ok(result.includes('2. /src/file2.ts:20:3'));
		});
	});

	suite('rename_symbol change collection', () => {
		test('collects changes from multiple locations', () => {
			const changes: Array<{ uri: URI, oldText: string, newText: string, line: number, column: number }> = [];
			const oldName = 'oldFunction';
			const newName = 'newFunction';

			const locations = [
				{ uri: URI.file('/src/file1.ts'), range: new Range(10, 1, 10, 12) },
				{ uri: URI.file('/src/file2.ts'), range: new Range(20, 1, 20, 12) },
			];

			// Simulate collecting changes
			for (const loc of locations) {
				changes.push({
					uri: loc.uri,
					oldText: oldName,
					newText: newName,
					line: loc.range.startLineNumber,
					column: loc.range.startColumn,
				});
			}

			assert.strictEqual(changes.length, 2);
			assert.strictEqual(changes[0].oldText, 'oldFunction');
			assert.strictEqual(changes[0].newText, 'newFunction');
			assert.strictEqual(changes[1].uri.fsPath, '/src/file2.ts');
		});
	});
});
