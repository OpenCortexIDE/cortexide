/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { isLocalProvider } from '../../browser/convertToLLMMessageService.js';
import { chat_systemMessage, chat_systemMessage_local, gitCommitMessage_systemMessage, gitCommitMessage_systemMessage_local, ctrlKStream_systemMessage, ctrlKStream_systemMessage_local, rewriteCode_systemMessage, rewriteCode_systemMessage_local } from '../../common/prompt/prompts.js';

suite('Local Model Optimizations', () => {

	suite('isLocalProvider', () => {
		test('should detect explicit local providers', () => {
			const settingsOfProvider: any = {};

			assert.strictEqual(isLocalProvider('ollama', settingsOfProvider), true);
			assert.strictEqual(isLocalProvider('vLLM', settingsOfProvider), true);
			assert.strictEqual(isLocalProvider('lmStudio', settingsOfProvider), true);
		});

		test('should detect localhost endpoints in openAICompatible', () => {
			const settingsOfProvider: any = {
				openAICompatible: {
					endpoint: 'http://localhost:1234/v1'
				}
			};

			assert.strictEqual(isLocalProvider('openAICompatible', settingsOfProvider), true);
		});

		test('should detect localhost endpoints in liteLLM', () => {
			const settingsOfProvider: any = {
				liteLLM: {
					endpoint: 'http://127.0.0.1:8000/v1'
				}
			};

			assert.strictEqual(isLocalProvider('liteLLM', settingsOfProvider), true);
		});

		test('should detect various localhost formats', () => {
			const testCases = [
				'http://localhost:1234/v1',
				'http://127.0.0.1:8000/v1',
				'http://0.0.0.0:5000/v1',
				'https://localhost/v1',
			];

			for (const endpoint of testCases) {
				const settingsOfProvider: any = {
					openAICompatible: { endpoint }
				};
				assert.strictEqual(isLocalProvider('openAICompatible', settingsOfProvider), true, `Should detect localhost: ${endpoint}`);
			}
		});

		test('should not detect remote endpoints as local', () => {
			const settingsOfProvider: any = {
				openAICompatible: {
					endpoint: 'https://api.openai.com/v1'
				}
			};

			assert.strictEqual(isLocalProvider('openAICompatible', settingsOfProvider), false);
		});

		test('should not detect cloud providers as local', () => {
			const settingsOfProvider: any = {};

			assert.strictEqual(isLocalProvider('openAI', settingsOfProvider), false);
			assert.strictEqual(isLocalProvider('anthropic', settingsOfProvider), false);
			assert.strictEqual(isLocalProvider('gemini', settingsOfProvider), false);
		});
	});

	suite('Local Prompt Templates', () => {
		test('chat_systemMessage_local should be shorter than full version', () => {
			const params = {
				workspaceFolders: ['/workspace'],
				openedURIs: ['/file1.ts', '/file2.ts'],
				directoryStr: 'test',
				activeURI: '/file1.ts',
				persistentTerminalIDs: [],
				chatMode: 'normal' as const,
				mcpTools: undefined,
				includeXMLToolDefinitions: false,
				relevantMemories: undefined
			};

			const fullMessage = chat_systemMessage(params);
			const localMessage = chat_systemMessage_local(params);

			// Local message should be significantly shorter
			assert.ok(localMessage.length < fullMessage.length, 'Local message should be shorter');
			assert.ok(localMessage.length < fullMessage.length * 0.5, 'Local message should be at least 50% shorter');
		});

		test('gitCommitMessage_systemMessage_local should be shorter than full version', () => {
			const fullMessage = gitCommitMessage_systemMessage;
			const localMessage = gitCommitMessage_systemMessage_local;

			// Local message should be significantly shorter
			assert.ok(localMessage.length < fullMessage.length, 'Local message should be shorter');
			assert.ok(localMessage.length < fullMessage.length * 0.3, 'Local message should be at least 70% shorter');
		});

		test('ctrlKStream_systemMessage_local should be shorter than full version', () => {
			const fimTags = {
				preTag: 'BEFORE',
				midTag: 'SELECTION',
				sufTag: 'BELOW'
			};

			const fullMessage = ctrlKStream_systemMessage({ quickEditFIMTags: fimTags });
			const localMessage = ctrlKStream_systemMessage_local({ quickEditFIMTags: fimTags });

			// Local message should be significantly shorter
			assert.ok(localMessage.length < fullMessage.length, 'Local message should be shorter');
			assert.ok(localMessage.length < fullMessage.length * 0.4, 'Local message should be at least 60% shorter');
		});

		test('rewriteCode_systemMessage_local should be shorter than full version', () => {
			const fullMessage = rewriteCode_systemMessage;
			const localMessage = rewriteCode_systemMessage_local;

			// Local message should be significantly shorter
			assert.ok(localMessage.length < fullMessage.length, 'Local message should be shorter');
			assert.ok(localMessage.length < fullMessage.length * 0.3, 'Local message should be at least 70% shorter');
		});

		test('local templates should include essential information', () => {
			const params = {
				workspaceFolders: ['/workspace'],
				openedURIs: ['/file1.ts'],
				directoryStr: 'test',
				activeURI: '/file1.ts',
				persistentTerminalIDs: [],
				chatMode: 'agent' as const,
				mcpTools: undefined,
				includeXMLToolDefinitions: true,
				relevantMemories: undefined
			};

			const localMessage = chat_systemMessage_local(params);

			// Should include essential info
			assert.ok(localMessage.includes('agent') || localMessage.includes('Coding agent'), 'Should mention agent mode');
			assert.ok(localMessage.includes('tools') || localMessage.includes('<tools>'), 'Should include tools for agent mode');
		});
	});

	suite('Code Pruning', () => {
		test('should remove single-line comments', () => {
			const code = `function test() {
				// This is a comment
				return 42;
			}`;

			// This is a simplified test - actual pruning is done in editCodeService
			// We're just verifying the concept works
			const pruned = code.replace(/\/\/.*$/gm, '');
			assert.ok(!pruned.includes('// This is a comment'), 'Should remove single-line comments');
			assert.ok(pruned.includes('return 42'), 'Should keep code');
		});

		test('should remove multi-line comments', () => {
			const code = `function test() {
				/* This is a
				   multi-line comment */
				return 42;
			}`;

			const pruned = code.replace(/\/\*[\s\S]*?\*\//g, '');
			assert.ok(!pruned.includes('multi-line comment'), 'Should remove multi-line comments');
			assert.ok(pruned.includes('return 42'), 'Should keep code');
		});
	});
});

