/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IRepoIndexerService } from './repoIndexerService.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { URI } from '../../../../base/common/uri.js';
import { localize2 } from '../../../../nls.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';

/**
 * Command to query the codebase using natural language
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.codebase.query',
			f1: true,
			title: localize2('voidCodebaseQuery', 'CortexIDE: Query Codebase'),
			category: localize2('voidCategory', 'CortexIDE'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyQ,
				weight: KeybindingWeight.ExternalExtension,
				when: ContextKeyExpr.deserialize('!terminalFocus'),
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const repoIndexerService = accessor.get(IRepoIndexerService);
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);
		const labelService = accessor.get(ILabelService);

		// Create quick pick
		const quickPick = quickInputService.createQuickPick<IQuickPickItem & { uri?: URI }>();
		quickPick.placeholder = localize2('voidCodebaseQueryPlaceholder', 'Enter a natural language query to search your codebase...').value;
		quickPick.title = localize2('voidCodebaseQueryTitle', 'Query Codebase').value;

		const disposables = new DisposableStore();
		disposables.add(quickPick);

		// Debounce query execution
		const queryScheduler = new RunOnceScheduler(async () => {
			const query = quickPick.value.trim();
			if (!query || query.length < 2) {
				quickPick.items = [];
				quickPick.busy = false;
				return;
			}

			quickPick.busy = true;

			try {
				// Query the repo indexer (returns top 20 structured hits, each with a real file URI)
				const results = await repoIndexerService.queryStructured(query, 20);

				// Convert to quick pick items, deduped by file (a file can match via multiple chunks/symbols)
				const seen = new Set<string>();
				const items: Array<IQuickPickItem & { uri?: URI }> = [];
				for (const r of results) {
					if (seen.has(r.uri)) { continue; }
					seen.add(r.uri);
					const uri = URI.file(r.uri);
					const relativePath = labelService.getUriLabel(uri, { relative: true });
					const fullPath = labelService.getUriLabel(uri, { relative: false });
					items.push({
						label: `$(file) ${relativePath}`,
						description: fullPath,
						uri,
						alwaysShow: true,
					});
				}

				if (items.length === 0) {
					items.push({
						label: localize2('voidCodebaseQueryNoResults', 'No results found').value,
						description: localize2('voidCodebaseQueryNoResultsDesc', 'Try a different query').value,
					});
				}

				quickPick.items = items;
			} catch (error) {
				quickPick.items = [{
					label: localize2('voidCodebaseQueryError', 'Error querying codebase').value,
					description: error instanceof Error ? error.message : String(error),
				}];
			} finally {
				quickPick.busy = false;
			}
		}, 300); // 300ms debounce

		disposables.add(queryScheduler);

		// Trigger query on input change
		disposables.add(quickPick.onDidChangeValue(() => {
			queryScheduler.schedule();
		}));

		// Handle item selection
		disposables.add(quickPick.onDidAccept(() => {
			const selectedItem = quickPick.selectedItems[0];
			if (selectedItem?.uri) {
				// Open the file
				editorService.openEditor({
					resource: selectedItem.uri,
					options: { pinned: false, revealIfOpened: true },
				});
				quickPick.hide();
			}
		}));

		// Show the quick pick
		quickPick.show();

		// Cleanup on dispose
		disposables.add(quickPick.onDidHide(() => {
			disposables.dispose();
		}));
	}
});

