/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { autorun, IObservable, IReader } from '../../../../../base/common/observable.js';
import { localize } from '../../../../../nls.js';
import { IChatEditingSession, IModifiedFileEntry, ModifiedFileEntryState } from '../../common/editing/chatEditingService.js';
import { DetailedLineRangeMapping } from '../../../../../editor/common/diff/rangeMapping.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';

export interface IComposerHunk {
	entry: IModifiedFileEntry;
	hunk: DetailedLineRangeMapping;
	enabled: boolean;
}

export class ComposerUnifiedDiffView {
	private readonly _disposables = new DisposableStore();
	private _enabledHunks = new Map<string, boolean>(); // key: entryId + hunk index
	private readonly _ignoreTrimWhitespace: IObservable<boolean>;
	// Cache for computed diffs to avoid recomputing for unchanged files
	// Key: entryId + originalVersion + modifiedVersion + ignoreTrimWhitespace
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly _diffCache = new Map<string, Promise<{ diff: any; originalVersion: number; modifiedVersion: number }>>();

	constructor(
		private readonly _container: HTMLElement,
		private readonly _session: IChatEditingSession | undefined,
		private readonly _onHunkToggle: (entry: IModifiedFileEntry, hunk: DetailedLineRangeMapping, enabled: boolean) => void,
		@ILabelService private readonly _labelService: ILabelService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@IEditorWorkerService private readonly _editorWorkerService: IEditorWorkerService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		this._ignoreTrimWhitespace = observableConfigValue('diffEditor.ignoreTrimWhitespace', true, this._configurationService);
		this._render();
	}

	dispose(): void {
		this._diffCache.clear();
		this._disposables.dispose();
	}

	private _render(): void {
		if (!this._session) {
			this._container.innerHTML = '';
			return;
		}

		// Track previous entries to avoid unnecessary re-renders
		let previousEntryIds: string[] = [];

		// Use autorun to reactively update when entries change
		this._disposables.add(autorun((reader) => {
			const entries = this._session!.entries.read(reader);
			const currentEntryIds = entries.map(e => e.entryId);

			// PERFORMANCE: Only re-render if entries actually changed (by ID)
			// Avoids expensive re-renders when only metadata changes
			const entriesChanged = currentEntryIds.length !== previousEntryIds.length ||
				currentEntryIds.some((id, idx) => id !== previousEntryIds[idx]);

			if (!entriesChanged && this._container.children.length > 0) {
				// Entries unchanged - only update metadata if needed (handled by individual entry observers)
				previousEntryIds = currentEntryIds;
				return;
			}

			// Clear container only if entries changed
			this._container.innerHTML = '';
			previousEntryIds = currentEntryIds;

			if (entries.length === 0) {
				const emptyMsg = document.createElement('div');
				emptyMsg.className = 'composer-proposals-empty';
				emptyMsg.textContent = localize('composer.noProposals', "No proposals generated yet.");
				this._container.appendChild(emptyMsg);
				return;
			}

			// PERFORMANCE: Render file headers immediately, then compute diffs in batches
			// This makes the UI responsive - users see file names right away
			// Diffs are computed progressively to avoid blocking the UI thread
			this._renderFileEntriesBatched([...entries], reader).catch(err => {
				console.error('Error rendering file entries:', err);
			});
		}));
	}

	/**
	 * Render file entries in batches to maintain UI responsiveness
	 * File headers are rendered immediately, diffs are computed progressively
	 */
	private async _renderFileEntriesBatched(entries: IModifiedFileEntry[], reader: IReader): Promise<void> {
		// PERFORMANCE: Increased batch size for better parallelization (was 3, now 4)
		// Bounded concurrency: Process 4 files concurrently to balance throughput vs UI responsiveness
		const BATCH_SIZE = 4;
		// Track if session was disposed to enable early bailout
		let isDisposed = false;

		// First pass: Render all file headers immediately (fast, no diff computation)
		const fileContainers = new Map<string, HTMLElement>();
		for (const entry of entries) {
			// Early bailout: Check if disposed before rendering each header
			if (this._disposables.isDisposed) {
				isDisposed = true;
				break;
			}
			const fileContainer = await this._renderFileHeader(entry, reader);
			fileContainers.set(entry.entryId, fileContainer);
			this._container.appendChild(fileContainer);
		}

		// Early bailout: Don't compute diffs if disposed
		if (isDisposed || this._disposables.isDisposed) {
			return;
		}

		// Second pass: Compute diffs in batches with yielding between batches
		for (let i = 0; i < entries.length; i += BATCH_SIZE) {
			// Early bailout: Check if disposed before each batch
			if (this._disposables.isDisposed) {
				break;
			}

			const batch = entries.slice(i, i + BATCH_SIZE);
			await Promise.all(batch.map(entry => {
				// Early bailout: Check if disposed before processing each entry
				if (this._disposables.isDisposed) {
					return Promise.resolve();
				}
				const container = fileContainers.get(entry.entryId);
				if (container) {
					return this._renderFileDiff(entry, container, reader);
				}
				return Promise.resolve();
			}));

			// Early bailout: Don't yield if disposed
			if (this._disposables.isDisposed) {
				break;
			}

			// Yield to UI thread between batches to maintain responsiveness
			if (i + BATCH_SIZE < entries.length) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
	}

	/**
	 * Render file header (name, progress indicator, change count) - fast, no diff computation
	 */
	private async _renderFileHeader(entry: IModifiedFileEntry, reader: IReader): Promise<HTMLElement> {
		const fileContainer = document.createElement('div');
		fileContainer.className = 'composer-file-entry';

		const fileHeader = document.createElement('div');
		fileHeader.className = 'composer-file-header';

		const fileName = document.createElement('div');
		fileName.className = 'composer-file-name';
		fileName.textContent = this._labelService.getUriLabel(entry.modifiedURI, { relative: true });
		fileHeader.appendChild(fileName);

		// Progress indicator
		const progressIndicator = document.createElement('span');
		progressIndicator.className = 'composer-file-progress';
		progressIndicator.setAttribute('aria-label', '');
		fileHeader.appendChild(progressIndicator);

		// Update progress indicator based on state
		const updateProgress = () => {
			const state = entry.state.read(reader);
			const isModifying = entry.isCurrentlyBeingModifiedBy.read(reader);

			progressIndicator.className = 'composer-file-progress';
			progressIndicator.setAttribute('aria-label', '');

			if (isModifying) {
				progressIndicator.classList.add('composer-file-progress-generating');
				progressIndicator.setAttribute('aria-label', localize('composer.fileGenerating', "Generating changes..."));
				// allow-any-unicode-next-line
				progressIndicator.textContent = '⟳';
			} else if (state === ModifiedFileEntryState.Modified) {
				progressIndicator.classList.add('composer-file-progress-ready');
				progressIndicator.setAttribute('aria-label', localize('composer.fileReady', "Ready"));
				progressIndicator.textContent = '✓';
			} else if (state === ModifiedFileEntryState.Accepted) {
				progressIndicator.classList.add('composer-file-progress-applied');
				progressIndicator.setAttribute('aria-label', localize('composer.fileApplied', "Applied"));
				progressIndicator.textContent = '✓';
			} else if (state === ModifiedFileEntryState.Rejected) {
				progressIndicator.classList.add('composer-file-progress-rejected');
				progressIndicator.setAttribute('aria-label', localize('composer.fileRejected', "Rejected"));
				// allow-any-unicode-next-line
				progressIndicator.textContent = '✗';
			}
		};

		// Initial update
		updateProgress();

		// Subscribe to state changes
		const stateDisposable = autorun(reader => {
			entry.state.read(reader);
			entry.isCurrentlyBeingModifiedBy.read(reader);
			updateProgress();
		});
		this._disposables.add(stateDisposable);

		const changeCount = entry.changesCount.read(reader);
		const changeCountBadge = document.createElement('span');
		changeCountBadge.className = 'composer-file-change-count';
		changeCountBadge.textContent = `${changeCount} change${changeCount === 1 ? '' : 's'}`;
		fileHeader.appendChild(changeCountBadge);

		fileContainer.appendChild(fileHeader);

		// Show loading indicator for diff computation
		if (changeCount > 0) {
			const loadingIndicator = document.createElement('div');
			loadingIndicator.className = 'composer-file-loading';
			loadingIndicator.textContent = localize('composer.loadingDiff', "Loading diff...");
			fileContainer.appendChild(loadingIndicator);
		} else {
			const noChanges = document.createElement('div');
			noChanges.className = 'composer-file-no-changes';
			noChanges.textContent = localize('composer.noChanges', "No changes");
			fileContainer.appendChild(noChanges);
		}

		return fileContainer;
	}

	/**
	 * Compute and render diff for a file entry (expensive operation)
	 */
	private async _renderFileDiff(entry: IModifiedFileEntry, fileContainer: HTMLElement, reader: IReader): Promise<void> {
		// Early bailout: Check if disposed before expensive operations
		if (this._disposables.isDisposed) {
			return;
		}

		const changeCount = entry.changesCount.read(reader);
		if (changeCount === 0) {
			return; // Already handled in _renderFileHeader
		}

		// Remove loading indicator
		// eslint-disable-next-line no-restricted-syntax
		const loadingIndicator = fileContainer.querySelector('.composer-file-loading');
		if (loadingIndicator) {
			loadingIndicator.remove();
		}

		// Get diff info - we need to read the models and compute diff
		try {
			const originalRef = await this._textModelService.createModelReference(entry.originalURI);
			const modifiedRef = await this._textModelService.createModelReference(entry.modifiedURI);

			try {
				// Early bailout: Check if disposed after model references
				if (this._disposables.isDisposed) {
					return;
				}

				const ignoreTrimWhitespace = this._ignoreTrimWhitespace.read(reader);
				const originalVersion = originalRef.object.textEditorModel.getVersionId();
				const modifiedVersion = modifiedRef.object.textEditorModel.getVersionId();

				// Check cache first
				const cacheKey = `${entry.entryId}-${originalVersion}-${modifiedVersion}-${ignoreTrimWhitespace}`;
				let cachedResult = this._diffCache.get(cacheKey);

				// If cache miss or versions changed, compute new diff
				if (!cachedResult) {
					const diffPromise = this._editorWorkerService.computeDiff(
						entry.originalURI,
						entry.modifiedURI,
						{ ignoreTrimWhitespace, computeMoves: false, maxComputationTimeMs: 3000 },
						'advanced'
					).then(diff => ({
						diff,
						originalVersion,
						modifiedVersion
					}));

					this._diffCache.set(cacheKey, diffPromise);
					// Limit cache size to prevent memory issues
					if (this._diffCache.size > 50) {
						const firstKey = this._diffCache.keys().next().value;
						if (firstKey !== undefined) {
							this._diffCache.delete(firstKey);
						}
					}
					cachedResult = diffPromise;
				}

				const { diff } = await cachedResult;

				// Early bailout: Check if disposed after diff computation
				if (this._disposables.isDisposed) {
					return;
				}

				if (diff && diff.changes.length > 0) {
					const hunksContainer = document.createElement('div');
					hunksContainer.className = 'composer-hunks-container';

					// File-level toggle
					const fileToggle = document.createElement('div');
					fileToggle.className = 'composer-file-toggle';
					const fileCheckbox = document.createElement('input');
					fileCheckbox.type = 'checkbox';
					fileCheckbox.className = 'composer-hunk-checkbox';
					fileCheckbox.id = `file-${entry.entryId}`;
					const fileName = this._labelService.getUriLabel(entry.modifiedURI, { relative: true });
					fileCheckbox.setAttribute('aria-label', localize('composer.selectAllFileAria', "Select all hunks in {0}", fileName));
					fileCheckbox.setAttribute('role', 'checkbox');

					const allEnabled = diff.changes.every((_: DetailedLineRangeMapping, idx: number) => {
						const key = `${entry.entryId}-${idx}`;
						return this._enabledHunks.get(key) !== false;
					});
					fileCheckbox.checked = allEnabled;
					fileCheckbox.setAttribute('aria-checked', allEnabled ? 'true' : 'false');

					fileCheckbox.addEventListener('change', () => {
						const enabled = fileCheckbox.checked;
						fileCheckbox.setAttribute('aria-checked', enabled ? 'true' : 'false');
						diff.changes.forEach((hunk: DetailedLineRangeMapping, idx: number) => {
							const key = `${entry.entryId}-${idx}`;
							this._enabledHunks.set(key, enabled);
							this._onHunkToggle(entry, hunk, enabled);
						});
						// Update individual checkboxes without full re-render
						diff.changes.forEach((_: DetailedLineRangeMapping, idx: number) => {
							// eslint-disable-next-line no-restricted-syntax
							const checkbox = hunksContainer.querySelector(`#hunk-${entry.entryId}-${idx}`) as HTMLInputElement;
							if (checkbox) {
								checkbox.checked = enabled;
								checkbox.setAttribute('aria-checked', enabled ? 'true' : 'false');
							}
						});
					});

					fileToggle.appendChild(fileCheckbox);
					const fileToggleLabel = document.createElement('label');
					fileToggleLabel.textContent = localize('composer.selectAllInFile', "Select all");
					fileToggleLabel.addEventListener('click', () => fileCheckbox.click());
					fileToggle.appendChild(fileToggleLabel);
					hunksContainer.appendChild(fileToggle);

					// Render each hunk
					diff.changes.forEach((hunk: DetailedLineRangeMapping, idx: number) => {
						const hunkEl = this._renderHunk(entry, hunk, idx, reader);
						hunksContainer.appendChild(hunkEl);
					});

					fileContainer.appendChild(hunksContainer);
				}
			} finally {
				originalRef.dispose();
				modifiedRef.dispose();
			}
		} catch (error) {
			// Remove loading indicator if present
			// eslint-disable-next-line no-restricted-syntax
			const loadingIndicator = fileContainer.querySelector('.composer-file-loading');
			if (loadingIndicator) {
				loadingIndicator.remove();
			}
			const errorMsg = document.createElement('div');
			errorMsg.className = 'composer-file-error';
			errorMsg.textContent = localize('composer.diffError', "Error loading diff: {0}", error);
			fileContainer.appendChild(errorMsg);
		}
	}

	private _renderHunk(entry: IModifiedFileEntry, hunk: DetailedLineRangeMapping, idx: number, reader: IReader): HTMLElement {
		const hunkEl = document.createElement('div');
		hunkEl.className = 'composer-hunk';

		const hunkRow = document.createElement('div');
		hunkRow.className = 'composer-hunk-row';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'composer-hunk-checkbox';
		checkbox.id = `hunk-${entry.entryId}-${idx}`;
		const key = `${entry.entryId}-${idx}`;
		checkbox.checked = this._enabledHunks.get(key) !== false; // default to true

		const originalLines = hunk.original.isEmpty ? 0 : (hunk.original.endLineNumberExclusive - hunk.original.startLineNumber);
		const modifiedLines = hunk.modified.isEmpty ? 0 : (hunk.modified.endLineNumberExclusive - hunk.modified.startLineNumber);
		const rangeText = hunk.modified.isEmpty
			? localize('composer.hunkDeleted', "Deleted at line {0}", hunk.original.startLineNumber)
			: localize('composer.hunkRange', "Lines {0}-{1}", hunk.modified.startLineNumber, hunk.modified.endLineNumberExclusive - 1);

		checkbox.setAttribute('aria-label', localize('composer.hunkToggleAria', "Toggle hunk: {0}, {1} lines removed, {2} lines added", rangeText, originalLines, modifiedLines));
		checkbox.setAttribute('role', 'checkbox');
		checkbox.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');

		checkbox.addEventListener('change', () => {
			const enabled = checkbox.checked;
			this._enabledHunks.set(key, enabled);
			checkbox.setAttribute('aria-checked', enabled ? 'true' : 'false');
			this._onHunkToggle(entry, hunk, enabled);
		});

		hunkRow.appendChild(checkbox);

		const hunkInfo = document.createElement('div');
		hunkInfo.className = 'composer-hunk-info';

		hunkInfo.innerHTML = `
			<span class="composer-hunk-range">${rangeText}</span>
			<span class="composer-hunk-stats">
				${originalLines > 0 ? `<span class="composer-hunk-removed">-${originalLines}</span>` : ''}
				${modifiedLines > 0 ? `<span class="composer-hunk-added">+${modifiedLines}</span>` : ''}
			</span>
		`;

		hunkRow.appendChild(hunkInfo);
		hunkEl.appendChild(hunkRow);

		return hunkEl;
	}

	getEnabledHunks(): Map<string, boolean> {
		return new Map(this._enabledHunks);
	}

	setHunkEnabled(entry: IModifiedFileEntry, hunkIndex: number, enabled: boolean): void {
		const key = `${entry.entryId}-${hunkIndex}`;
		this._enabledHunks.set(key, enabled);
		this._render();
	}
}

