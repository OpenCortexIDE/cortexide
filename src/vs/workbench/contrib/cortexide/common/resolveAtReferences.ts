/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { StagingSelectionItem } from './chatThreadServiceTypes.js';
import { extractAtReferenceTokens } from './atReferenceTokens.js';

type ServiceAccessor = { get: (id: string) => any };

type ChatThreadsServiceLike = {
	addNewStagingSelection: (sel: StagingSelectionItem) => Promise<void>;
};

type NotificationServiceLike = {
	warn: (message: string) => void;
};

export type ResolveAtReferencesParams = {
	userMessage: string;
	threadId: string;
	existingSelections: StagingSelectionItem[];
	chatThreadsService: ChatThreadsServiceLike;
	accessor: ServiceAccessor;
	notificationService: NotificationServiceLike;
};

/** Resolve @references in chat input into staging selections before send. Best-effort; never throws. */
export const resolveAtReferencesInMessage = async ({
	userMessage,
	existingSelections,
	chatThreadsService,
	accessor,
	notificationService,
}: ResolveAtReferencesParams): Promise<void> => {
	try {
		const toolsService = accessor.get('IToolsService');
		const workspaceService = accessor.get('IWorkspaceContextService');
		const editorService = accessor.get('IEditorService');
		const languageService = accessor.get('ILanguageService');
		const historyService = accessor.get('IHistoryService');
		let outlineService: any = undefined;
		try { outlineService = accessor.get('IOutlineModelService'); } catch { /* optional */ }

		const existing = new Set<string>();
		for (const s of existingSelections) {
			existing.add(s.uri?.fsPath || '');
		}

		const addFileSelection = async (uri: any) => {
			if (!uri) return;
			const key = uri.fsPath || uri.path || '';
			if (key && existing.has(key)) return;
			existing.add(key);
			await chatThreadsService.addNewStagingSelection({
				type: 'File',
				uri,
				language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) || '',
				state: { wasAddedAsCurrentFile: false },
			});
		};

		const addFolderSelection = async (uri: any) => {
			if (!uri) return;
			const key = uri.fsPath || uri.path || '';
			if (key && existing.has(key)) return;
			existing.add(key);
			await chatThreadsService.addNewStagingSelection({
				type: 'Folder',
				uri,
				language: undefined,
				state: undefined,
			});
		};

		const tokens = extractAtReferenceTokens(userMessage);

		const unresolvedRefs: string[] = [];

		for (const raw of tokens) {
			if (raw === 'selection') {
				const active = editorService.activeTextEditorControl;
				const activeResource = editorService.activeEditor?.resource;
				const sel = active?.getSelection?.();
				if (activeResource && sel && !sel.isEmpty()) {
					const key = activeResource.fsPath || '';
					if (!existing.has(key)) {
						existing.add(key);
						await chatThreadsService.addNewStagingSelection({
							type: 'File',
							uri: activeResource,
							language: languageService.guessLanguageIdByFilepathOrFirstLine(activeResource) || '',
							state: { wasAddedAsCurrentFile: false },
							range: sel,
						});
					}
				} else {
					unresolvedRefs.push('@selection (no active selection)');
				}
				continue;
			}
			if (raw === 'workspace') {
				for (const folder of workspaceService.getWorkspace().folders) {
					await addFolderSelection(folder.uri);
				}
				continue;
			}
			if (raw === 'recent') {
				for (const h of historyService.getHistory()) {
					if (h.resource) await addFileSelection(h.resource);
				}
				continue;
			}

			if (raw.startsWith('sym:') || raw.startsWith('symbol:')) {
				const symName = raw.replace(/^symbol?:/, '');
				let symbolFound = false;
				if (outlineService && typeof outlineService.getCachedModels === 'function') {
					try {
						const models = outlineService.getCachedModels();
						for (const om of models) {
							const list = typeof om.asListOfDocumentSymbols === 'function' ? om.asListOfDocumentSymbols() : [];
							for (const s of list) {
								if ((s?.name || '').toLowerCase() === symName.toLowerCase()) {
									symbolFound = true;
									const uri = om.uri;
									const range = s.range;
									const key = uri?.fsPath || '';
									if (!existing.has(key)) {
										existing.add(key);
										await chatThreadsService.addNewStagingSelection({
											type: 'File',
											uri,
											language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) || '',
											state: { wasAddedAsCurrentFile: false },
											range,
										});
									}
								}
							}
						}
					} catch (err) {
						console.warn('Error resolving symbol:', err);
					}
				}
				if (!symbolFound) {
					unresolvedRefs.push(`@${raw} (symbol not found)`);
				}
				continue;
			}

			let query = raw;
			let isFolderHint = false;
			if (raw.startsWith('folder:')) {
				isFolderHint = true;
				query = raw.slice('folder:'.length);
			}

			let resolved = false;
			try {
				const res = await (await toolsService.callTool.search_pathnames_only({ query, includePattern: null, pageNumber: 1 })).result;
				const [first] = res.uris || [];
				if (first) {
					resolved = true;
					if (isFolderHint) await addFolderSelection(first);
					else await addFileSelection(first);
				}
			} catch (err) {
				console.warn('Error resolving reference:', err);
			}
			if (!resolved) {
				unresolvedRefs.push(`@${raw}`);
			}
		}

		if (unresolvedRefs.length > 0) {
			const refList = unresolvedRefs.slice(0, 3).join(', ');
			const moreText = unresolvedRefs.length > 3 ? ` and ${unresolvedRefs.length - 3} more` : '';
			notificationService.warn(`Could not resolve reference${unresolvedRefs.length > 1 ? 's' : ''}: ${refList}${moreText}. Please check the file path or symbol name.`);
		}
	} catch (err) {
		console.warn('Error resolving @references:', err);
	}
};
