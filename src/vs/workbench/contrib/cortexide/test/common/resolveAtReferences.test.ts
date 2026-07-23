/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { URI } from '../../../../../base/common/uri.js';
import { resolveAtReferencesInMessage } from '../../common/resolveAtReferences.js';

suite('resolveAtReferences', () => {

	test('@workspace adds workspace folder selections', async () => {
		const folderUri = URI.file('/tmp/cx-ws-cdp');
		const added: { type: string; uri: URI }[] = [];
		const warns: string[] = [];

		await resolveAtReferencesInMessage({
			userMessage: 'summarize @workspace',
			threadId: 't1',
			existingSelections: [],
			chatThreadsService: {
				addNewStagingSelection: async (sel) => { added.push(sel as { type: string; uri: URI }); },
			},
			accessor: {
				get: (id: string) => {
					if (id === 'IWorkspaceContextService') {
						return { getWorkspace: () => ({ folders: [{ uri: folderUri }] }) };
					}
					if (id === 'IToolsService') return { callTool: { search_pathnames_only: async () => ({ result: { uris: [] } }) } };
					if (id === 'IEditorService') return { activeTextEditorControl: null, activeEditor: null };
					if (id === 'ILanguageService') return { guessLanguageIdByFilepathOrFirstLine: () => 'plaintext' };
					if (id === 'IHistoryService') return { getHistory: () => [] };
					throw new Error(`unexpected service ${id}`);
				},
			},
			notificationService: { warn: (m) => warns.push(m) },
		});

		assert.strictEqual(added.length, 1);
		assert.strictEqual(added[0].type, 'Folder');
		assert.strictEqual(added[0].uri.toString(), folderUri.toString());
		assert.strictEqual(warns.length, 0);
	});
});
