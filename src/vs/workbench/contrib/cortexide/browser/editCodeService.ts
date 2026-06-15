/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ICodeEditor, IOverlayWidget, IViewZone } from '../../../../editor/browser/editorBrowser.js';

// import { IUndoRedoService } from '../../../../platform/undoRedo/common/undoRedo.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
// import { throttle } from '../../../../base/common/decorators.js';
import { findDiffs } from './helpers/findDiffs.js';
import { EndOfLinePreference, IModelDecorationOptions, ITextModel } from '../../../../editor/common/model.js';
import { IRange } from '../../../../editor/common/core/range.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IUndoRedoElement, IUndoRedoService, UndoRedoElementType } from '../../../../platform/undoRedo/common/undoRedo.js';
import { RenderOptions } from '../../../../editor/browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js';
// import { IModelService } from '../../../../editor/common/services/model.js';

import * as dom from '../../../../base/browser/dom.js';
import { Widget } from '../../../../base/browser/ui/widget.js';
import { URI } from '../../../../base/common/uri.js';
import { IConsistentEditorItemService, IConsistentItemService } from './helperServices/consistentItemService.js';
import { voidPrefixAndSuffix, ctrlKStream_userMessage, ctrlKStream_systemMessage, ctrlKStream_systemMessage_local, defaultQuickEditFimTags, rewriteCode_systemMessage, rewriteCode_systemMessage_local, rewriteCode_userMessage, searchReplaceGivenDescription_systemMessage, searchReplaceGivenDescription_userMessage, tripleTick, } from '../common/prompt/prompts.js';
import { isLocalProvider } from './convertToLLMMessageService.js';
import { ICortexideCommandBarService } from './cortexideCommandBarService.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { CORTEXIDE_ACCEPT_DIFF_ACTION_ID, CORTEXIDE_REJECT_DIFF_ACTION_ID } from './actionIDs.js';

import { mountCtrlK } from './react/out/quick-edit-tsx/index.js'
import { QuickEditPropsType } from './quickEditActions.js';
import { IModelContentChangedEvent } from '../../../../editor/common/textModelEvents.js';
import { extractCodeFromFIM, extractCodeFromRegular, ExtractedSearchReplaceBlock, extractSearchReplaceBlocks } from '../common/helpers/extractCodeFromResult.js';
import { findTextInCode, computeSearchReplaceResult } from '../common/searchReplaceMatch.js';
import { decideStreamRevert } from '../common/editStreamRevertDecision.js';
import { computeAcceptedOriginalCode, computeRejectWrite } from '../common/perHunkAccept.js';
import { INotificationService, } from '../../../../platform/notification/common/notification.js';
import { EditorOption } from '../../../../editor/common/config/editorOptions.js';
import { Emitter } from '../../../../base/common/event.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { LLMChatMessage } from '../common/sendLLMMessageTypes.js';
import { IMetricsService } from '../common/metricsService.js';
import { IEditCodeService, AddCtrlKOpts, StartApplyingOpts, CallBeforeStartApplyingOpts, } from './editCodeServiceInterface.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { FeatureName } from '../common/cortexideSettingsTypes.js';
import { ICortexideModelService } from '../common/cortexideModelService.js';
import { deepClone } from '../../../../base/common/objects.js';
import { acceptBg, acceptBorder, buttonFontSize, buttonTextColor, rejectBg, rejectBorder } from '../common/helpers/colors.js';
import { DiffArea, Diff, CtrlKZone, CortexideFileSnapshot, DiffAreaSnapshotEntry, diffAreaSnapshotKeys, DiffZone, TrackingZone, ComputedDiff } from '../common/editCodeServiceTypes.js';
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js';
import { IModelWarmupService } from '../common/modelWarmupService.js';
// import { isMacintosh } from '../../../../base/common/platform.js';
// import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from './cortexideSettingsPane.js';


export const getLengthOfTextPx = ({ tabWidth, spaceWidth, content }: { tabWidth: number, spaceWidth: number, content: string }) => {
	let lengthOfTextPx = 0;
	for (const char of content) {
		if (char === '\t') {
			lengthOfTextPx += tabWidth
		} else {
			lengthOfTextPx += spaceWidth;
		}
	}

	return lengthOfTextPx
}


const getLeadingWhitespacePx = (editor: ICodeEditor, startLine: number): number => {

	const model = editor.getModel();
	if (!model) {
		return 0;
	}

	// Get the line content, defaulting to empty string if line doesn't exist
	const lineContent = model.getLineContent(startLine) || '';

	// Find the first non-whitespace character
	const firstNonWhitespaceIndex = lineContent.search(/\S/);

	// Extract leading whitespace, handling case where line is all whitespace
	const leadingWhitespace = firstNonWhitespaceIndex === -1
		? lineContent
		: lineContent.slice(0, firstNonWhitespaceIndex);

	// Get font information from editor render options
	const { tabSize: numSpacesInTab } = model.getFormattingOptions();
	const spaceWidth = editor.getOption(EditorOption.fontInfo).spaceWidth;
	const tabWidth = numSpacesInTab * spaceWidth;

	const leftWhitespacePx = getLengthOfTextPx({
		tabWidth,
		spaceWidth,
		content: leadingWhitespace
	});


	return leftWhitespacePx;
};


// Helper function to prune code for local models: strip comments and reduce import verbosity
// This reduces token usage for local models which are slower with large contexts
const pruneCodeForLocalModel = (code: string, language: string): string => {
	// For very small code blocks, don't prune (might break functionality)
	if (code.length < 200) return code;

	let pruned = code;

	// Remove single-line comments (// ...)
	pruned = pruned.replace(/\/\/.*$/gm, '');

	// Remove multi-line comments (/* ... */)
	pruned = pruned.replace(/\/\*[\s\S]*?\*\//g, '');

	// Remove doc comments (/** ... */)
	pruned = pruned.replace(/\/\*\*[\s\S]*?\*\//g, '');

	// For languages with import statements, keep only essential imports
	// This is conservative - we keep all imports but could be more aggressive
	// The token caps already limit context size, so this is a secondary optimization

	// Remove excessive blank lines (more than 2 consecutive)
	pruned = pruned.replace(/\n{3,}/g, '\n\n');

	return pruned.trim();
}



// line/col is the location, originalCodeStartLine is the start line of the original code being displayed
type StreamLocationMutable = { line: number, col: number, addedSplitYet: boolean, originalCodeStartLine: number }



class EditCodeService extends Disposable implements IEditCodeService {
	_serviceBrand: undefined;

	// URI <--> model
	diffAreasOfURI: Record<string, Set<string> | undefined> = {}; // uri -> diffareaId

	diffAreaOfId: Record<string, DiffArea> = {}; // diffareaId -> diffArea
	diffOfId: Record<string, Diff> = {}; // diffid -> diff (redundant with diffArea._diffOfId)

	// events

	// uri: diffZones  // listen on change diffZones
	private readonly _onDidAddOrDeleteDiffZones = new Emitter<{ uri: URI }>();
	onDidAddOrDeleteDiffZones = this._onDidAddOrDeleteDiffZones.event;

	// diffZone: [uri], diffs, isStreaming  // listen on change diffs, change streaming (uri is const)
	private readonly _onDidChangeDiffsInDiffZoneNotStreaming = new Emitter<{ uri: URI, diffareaid: number }>();
	private readonly _onDidChangeStreamingInDiffZone = new Emitter<{ uri: URI, diffareaid: number }>();
	onDidChangeDiffsInDiffZoneNotStreaming = this._onDidChangeDiffsInDiffZoneNotStreaming.event;
	onDidChangeStreamingInDiffZone = this._onDidChangeStreamingInDiffZone.event;

	// ctrlKZone: [uri], isStreaming  // listen on change streaming
	private readonly _onDidChangeStreamingInCtrlKZone = new Emitter<{ uri: URI; diffareaid: number }>();
	onDidChangeStreamingInCtrlKZone = this._onDidChangeStreamingInCtrlKZone.event;


	constructor(
		// @IHistoryService private readonly _historyService: IHistoryService, // history service is the history of pressing alt left/right
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
		@IModelService private readonly _modelService: IModelService,
		@IUndoRedoService private readonly _undoRedoService: IUndoRedoService, // undoRedo service is the history of pressing ctrl+z
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@IConsistentItemService private readonly _consistentItemService: IConsistentItemService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IConsistentEditorItemService private readonly _consistentEditorItemService: IConsistentEditorItemService,
		@IMetricsService private readonly _metricsService: IMetricsService,
		@INotificationService private readonly _notificationService: INotificationService,
		// @ICommandService private readonly _commandService: ICommandService,
		@ICortexideSettingsService private readonly _settingsService: ICortexideSettingsService,
		// @IFileService private readonly _fileService: IFileService,
		@ICortexideModelService private readonly _cortexideModelService: ICortexideModelService,
		@IConvertToLLMMessageService private readonly _convertToLLMMessageService: IConvertToLLMMessageService,
		@IModelWarmupService private readonly _modelWarmupService: IModelWarmupService,
	) {
		super();

		// this function initializes data structures and listens for changes
		const registeredModelURIs = new Set<string>()
		const initializeModel = async (model: ITextModel) => {

			await this._cortexideModelService.initializeModel(model.uri)

			// do not add listeners to the same model twice - important, or will see duplicates
			if (registeredModelURIs.has(model.uri.fsPath)) return
			registeredModelURIs.add(model.uri.fsPath)

			if (!(model.uri.fsPath in this.diffAreasOfURI)) {
				this.diffAreasOfURI[model.uri.fsPath] = new Set();
			}

			// when the user types, realign diff areas and re-render them
			this._register(
				model.onDidChangeContent(e => {
					// it's as if we just called _write, now all we need to do is realign and refresh
					if (this.weAreWriting) return
					const uri = model.uri
					this._onUserChangeContent(uri, e)
				})
			)

			// when the model first mounts, refresh any diffs that might be on it (happens if diffs were added in the BG)
			this._refreshStylesAndDiffsInURI(model.uri)
		}
		// initialize all existing models + initialize when a new model mounts
		for (let model of this._modelService.getModels()) { initializeModel(model) }
		this._register(this._modelService.onModelAdded(model => { initializeModel(model) }));


		// this function adds listeners to refresh styles when editor changes tab
		let initializeEditor = (editor: ICodeEditor) => {
			const uri = editor.getModel()?.uri ?? null
			if (uri) this._refreshStylesAndDiffsInURI(uri)
		}

		// add listeners for all existing editors + listen for editor being added
		for (let editor of this._codeEditorService.listCodeEditors()) { initializeEditor(editor) }
		this._register(this._codeEditorService.onCodeEditorAdd(editor => { initializeEditor(editor) }))


	}


	private _onUserChangeContent(uri: URI, e: IModelContentChangedEvent) {
		for (const change of e.changes) {
			this._realignAllDiffAreasLines(uri, change.text, change.range)
		}
		this._refreshStylesAndDiffsInURI(uri)

		// if diffarea has no diffs after a user edit, delete it
		const diffAreasToDelete: DiffZone[] = []
		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] ?? []) {
			const diffArea = this.diffAreaOfId[diffareaid] ?? null
			const shouldDelete = diffArea?.type === 'DiffZone' && Object.keys(diffArea._diffOfId).length === 0
			if (shouldDelete) {
				diffAreasToDelete.push(diffArea)
			}
		}
		if (diffAreasToDelete.length !== 0) {
			const { onFinishEdit } = this._addToHistory(uri)
			diffAreasToDelete.forEach(da => this._deleteDiffZone(da))
			onFinishEdit()
		}

	}


	public processRawKeybindingText(keybindingStr: string): string {
		return keybindingStr
			// allow-any-unicode-next-line
			.replace(/Enter/g, '↵') // ⏎
			// allow-any-unicode-next-line
			.replace(/Backspace/g, '⌫');
	}

	// private _notifyError = (e: Parameters<OnError>[0]) => {
	// 	const details = errorDetails(e.fullError)
	// 	this._notificationService.notify({
	// 		severity: Severity.Warning,
// 		message: `CortexIDE Error: ${e.message}`,
	// 		actions: {
	// 			secondary: [{
	// 				id: 'void.onerror.opensettings',
	// 				enabled: true,
	// 				label: `Open Void's settings`,
	// 				tooltip: '',
	// 				class: undefined,
	// 				run: () => { this._commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID) }
	// 			}]
	// 		},
	// 		source: details ? `(Hold ${isMacintosh ? 'Option' : 'Alt'} to hover) - ${details}\n\nIf this persists, feel free to [report](https://github.com/OpenCortexIDE/cortexide/issues/new) it.` : undefined
	// 	})
	// }



	// highlight the region
	private _addLineDecoration = (model: ITextModel | null, startLine: number, endLine: number, className: string, options?: Partial<IModelDecorationOptions>) => {
		if (model === null) return
		const id = model.changeDecorations(accessor => accessor.addDecoration(
			{ startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: Number.MAX_SAFE_INTEGER },
			{
				className: className,
				description: className,
				isWholeLine: true,
				...options
			}))
		const disposeHighlight = () => {
			if (id && !model.isDisposed()) model.changeDecorations(accessor => accessor.removeDecoration(id))
		}
		return disposeHighlight
	}


	private _addDiffAreaStylesToURI = (uri: URI) => {
		const { model } = this._cortexideModelService.getModel(uri)

		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]

			if (diffArea.type === 'DiffZone') {
				// add sweep styles to the diffZone
				if (diffArea._streamState.isStreaming) {
					// sweepLine ... sweepLine
					const fn1 = this._addLineDecoration(model, diffArea._streamState.line, diffArea._streamState.line, 'void-sweepIdxBG')
					// sweepLine+1 ... endLine
					const fn2 = diffArea._streamState.line + 1 <= diffArea.endLine ?
						this._addLineDecoration(model, diffArea._streamState.line + 1, diffArea.endLine, 'void-sweepBG')
						: null
					diffArea._removeStylesFns.add(() => { fn1?.(); fn2?.(); })

				}
			}

			else if (diffArea.type === 'CtrlKZone' && diffArea._linkedStreamingDiffZone === null) {
				// highlight zone's text
				const fn = this._addLineDecoration(model, diffArea.startLine, diffArea.endLine, 'void-highlightBG')
				diffArea._removeStylesFns.add(() => fn?.());
			}
		}
	}


	private _computeDiffsAndAddStylesToURI = (uri: URI) => {
		const { model } = this._cortexideModelService.getModel(uri)
		if (model === null) return
		const fullFileText = model.getValue(EndOfLinePreference.LF)

		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea.type !== 'DiffZone') continue

			const newDiffAreaCode = fullFileText.split('\n').slice((diffArea.startLine - 1), (diffArea.endLine - 1) + 1).join('\n')
			const computedDiffs = findDiffs(diffArea.originalCode, newDiffAreaCode)
			for (let computedDiff of computedDiffs) {
				if (computedDiff.type === 'deletion') {
					computedDiff.startLine += diffArea.startLine - 1
				}
				if (computedDiff.type === 'edit' || computedDiff.type === 'insertion') {
					computedDiff.startLine += diffArea.startLine - 1
					computedDiff.endLine += diffArea.startLine - 1
				}
				this._addDiff(computedDiff, diffArea)
			}

		}
	}



	mostRecentTextOfCtrlKZoneId: Record<string, string | undefined> = {}
	private _addCtrlKZoneInput = (ctrlKZone: CtrlKZone) => {

		const { editorId } = ctrlKZone
		const editor = this._codeEditorService.listCodeEditors().find(e => e.getId() === editorId)
		if (!editor) { return null }

		let zoneId: string | null = null
		let viewZone_: IViewZone | null = null
		const textAreaRef: { current: HTMLTextAreaElement | null } = { current: null }


		const paddingLeft = getLeadingWhitespacePx(editor, ctrlKZone.startLine)

		const itemId = this._consistentEditorItemService.addToEditor(editor, () => {
			const domNode = document.createElement('div');
			domNode.style.zIndex = '1'
			domNode.style.height = 'auto'
			domNode.style.paddingLeft = `${paddingLeft}px`
			const viewZone: IViewZone = {
				afterLineNumber: ctrlKZone.startLine - 1,
				domNode: domNode,
				// heightInPx: 80,
				suppressMouseDown: false,
				showInHiddenAreas: true,
			};
			viewZone_ = viewZone

			// mount zone
			editor.changeViewZones(accessor => {
				zoneId = accessor.addZone(viewZone)
			})

			// mount react
			let disposeFn: (() => void) | undefined = undefined
			this._instantiationService.invokeFunction(accessor => {
				disposeFn = mountCtrlK(domNode, accessor, {

					diffareaid: ctrlKZone.diffareaid,

					textAreaRef: (r) => {
						textAreaRef.current = r
						if (!textAreaRef.current) return

						if (!(ctrlKZone.diffareaid in this.mostRecentTextOfCtrlKZoneId)) { // detect first mount this way (a hack)
							this.mostRecentTextOfCtrlKZoneId[ctrlKZone.diffareaid] = undefined
							setTimeout(() => textAreaRef.current?.focus(), 100)
						}
					},
					onChangeHeight(height) {
						if (height === 0) return // the viewZone sets this height to the container if it's out of view, ignore it
						viewZone.heightInPx = height
						// re-render with this new height
						editor.changeViewZones(accessor => {
							if (zoneId) accessor.layoutZone(zoneId)
						})
					},
					onChangeText: (text) => {
						this.mostRecentTextOfCtrlKZoneId[ctrlKZone.diffareaid] = text;
					},
					initText: this.mostRecentTextOfCtrlKZoneId[ctrlKZone.diffareaid] ?? null,
				} satisfies QuickEditPropsType)?.dispose
			})

			// cleanup
			return () => {
				editor.changeViewZones(accessor => { if (zoneId) accessor.removeZone(zoneId) })
				disposeFn?.()
			}
		})

		return {
			textAreaRef,
			refresh: () => editor.changeViewZones(accessor => {
				if (zoneId && viewZone_) {
					viewZone_.afterLineNumber = ctrlKZone.startLine - 1
					accessor.layoutZone(zoneId)
				}
			}),
			dispose: () => {
				this._consistentEditorItemService.removeFromEditor(itemId)
			},
		} satisfies CtrlKZone['_mountInfo']
	}



	private _refreshCtrlKInputs = async (uri: URI) => {
		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea.type !== 'CtrlKZone') continue
			if (!diffArea._mountInfo) {
				diffArea._mountInfo = this._addCtrlKZoneInput(diffArea)
			}
			else {
				diffArea._mountInfo.refresh()
			}
		}
	}


	private _addDiffStylesToURI = (uri: URI, diff: Diff) => {
		const { type, diffid } = diff

		const disposeInThisEditorFns: (() => void)[] = []

		const { model } = this._cortexideModelService.getModel(uri)

		// Apply visual styling based on enabled state
		// Use different className for disabled diffs to show reduced opacity
		const greenBgClass = diff.enabled === false ? 'void-greenBG void-diff-disabled' : 'void-greenBG';

		// green decoration and minimap decoration
		if (type !== 'deletion') {
			const fn = this._addLineDecoration(model, diff.startLine, diff.endLine, greenBgClass, {
				minimap: { color: { id: 'minimapGutter.addedBackground' }, position: 2 },
				overviewRuler: { color: { id: 'editorOverviewRuler.addedForeground' }, position: 7 }
			})
			disposeInThisEditorFns.push(() => { fn?.() })
		}


		// red in a view zone
		if (type !== 'insertion') {
			const consistentZoneId = this._consistentItemService.addConsistentItemToURI({
				uri,
				fn: (editor) => {

					const domNode = document.createElement('div');
					const redBgClass = diff.enabled === false ? 'void-redBG void-diff-disabled' : 'void-redBG';
					domNode.className = redBgClass

					const renderOptions = RenderOptions.fromEditor(editor)

					const processedText = diff.originalCode.replace(/\t/g, ' '.repeat(renderOptions.tabSize));

					const lines = processedText.split('\n');

					const linesContainer = document.createElement('div');
					linesContainer.style.fontFamily = renderOptions.fontInfo.fontFamily
					linesContainer.style.fontSize = `${renderOptions.fontInfo.fontSize}px`
					linesContainer.style.lineHeight = `${renderOptions.fontInfo.lineHeight}px`
					// linesContainer.style.tabSize = `${tabWidth}px` // \t
					linesContainer.style.whiteSpace = 'pre'
					linesContainer.style.position = 'relative'
					linesContainer.style.width = '100%'

					lines.forEach(line => {
						// div for current line
						const lineDiv = document.createElement('div');
						lineDiv.className = 'view-line';
						lineDiv.style.whiteSpace = 'pre'
						lineDiv.style.position = 'relative'
						lineDiv.style.height = `${renderOptions.fontInfo.lineHeight}px`

						// span (this is just how vscode does it)
						const span = document.createElement('span');
						span.textContent = line || '\u00a0';
						span.style.whiteSpace = 'pre'
						span.style.display = 'inline-block'

						lineDiv.appendChild(span);
						linesContainer.appendChild(lineDiv);
					});

					domNode.appendChild(linesContainer);

					// Calculate height based on number of lines and line height
					const heightInLines = lines.length;
					const minWidthInPx = Math.max(...lines.map(line =>
						Math.ceil(renderOptions.fontInfo.typicalFullwidthCharacterWidth * line.length)
					));

					const viewZone: IViewZone = {
						afterLineNumber: diff.startLine - 1,
						heightInLines,
						minWidthInPx,
						domNode,
						marginDomNode: document.createElement('div'),
						suppressMouseDown: false,
						showInHiddenAreas: false,
					};

					let zoneId: string | null = null
					editor.changeViewZones(accessor => { zoneId = accessor.addZone(viewZone) })
					return () => editor.changeViewZones(accessor => { if (zoneId) accessor.removeZone(zoneId) })
				},
			})

			disposeInThisEditorFns.push(() => { this._consistentItemService.removeConsistentItemFromURI(consistentZoneId) })

		}



		const diffZone = this.diffAreaOfId[diff.diffareaid]
		if (diffZone.type === 'DiffZone' && !diffZone._streamState.isStreaming) {
			// Accept | Reject widget
			const consistentWidgetId = this._consistentItemService.addConsistentItemToURI({
				uri,
				fn: (editor) => {
					let startLine: number
					let offsetLines: number
					if (diff.type === 'insertion' || diff.type === 'edit') {
						startLine = diff.startLine // green start
						offsetLines = 0
					}
					else if (diff.type === 'deletion') {
						// if diff.startLine is out of bounds
						if (diff.startLine === 1) {
							const numRedLines = diff.originalEndLine - diff.originalStartLine + 1
							startLine = diff.startLine
							offsetLines = -numRedLines
						}
						else {
							startLine = diff.startLine - 1
							offsetLines = 1
						}
					}
				else { throw new Error('CortexIDE 1') }

					const buttonsWidget = this._instantiationService.createInstance(AcceptRejectInlineWidget, {
						editor,
						onAccept: () => {
							this.acceptDiff({ diffid })
							this._metricsService.capture('Accept Diff', { diffid })
						},
						onReject: () => {
							this.rejectDiff({ diffid })
							this._metricsService.capture('Reject Diff', { diffid })
						},
						onToggle: (enabled: boolean) => {
							this.toggleDiffEnabled({ diffid, enabled })
						},
						diffid: diffid.toString(),
						startLine,
						offsetLines,
						enabled: diff.enabled !== false // default to true
					})
					return () => { buttonsWidget.dispose() }
				}
			})
			disposeInThisEditorFns.push(() => { this._consistentItemService.removeConsistentItemFromURI(consistentWidgetId) })
		}

		const disposeInEditor = () => { disposeInThisEditorFns.forEach(f => f()) }
		return disposeInEditor;

	}




	private _getActiveEditorURI(): URI | null {
		const editor = this._codeEditorService.getActiveCodeEditor()
		if (!editor) return null
		const uri = editor.getModel()?.uri
		if (!uri) return null
		return uri
	}

	weAreWriting = false
	private _writeURIText(uri: URI, text: string, range_: IRange | 'wholeFileRange', { shouldRealignDiffAreas, }: { shouldRealignDiffAreas: boolean, }) {
		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) {
			this._refreshStylesAndDiffsInURI(uri) // at the end of a write, we still expect to refresh all styles. e.g. sometimes we expect to restore all the decorations even if no edits were made when _writeText is used
			return
		}

		const range: IRange = range_ === 'wholeFileRange' ?
			{ startLineNumber: 1, startColumn: 1, endLineNumber: model.getLineCount(), endColumn: Number.MAX_SAFE_INTEGER } // whole file
			: range_

		// realign is 100% independent from written text (diffareas are nonphysical), can do this first
		if (shouldRealignDiffAreas) {
			const newText = text
			const oldRange = range
			this._realignAllDiffAreasLines(uri, newText, oldRange)
		}

		const uriStr = model.getValue(EndOfLinePreference.LF)

		// heuristic check
		const dontNeedToWrite = uriStr === text
		if (dontNeedToWrite) {
			this._refreshStylesAndDiffsInURI(uri) // at the end of a write, we still expect to refresh all styles. e.g. sometimes we expect to restore all the decorations even if no edits were made when _writeText is used
			return
		}

		this.weAreWriting = true
		model.applyEdits([{ range, text }])
		this.weAreWriting = false

		this._refreshStylesAndDiffsInURI(uri)
	}






	private _getCurrentCortexideFileSnapshot = (uri: URI): CortexideFileSnapshot => {
		const { model } = this._cortexideModelService.getModel(uri)
		const snapshottedDiffAreaOfId: Record<string, DiffAreaSnapshotEntry> = {}

		for (const diffareaid in this.diffAreaOfId) {
			const diffArea = this.diffAreaOfId[diffareaid]

			if (diffArea._URI.fsPath !== uri.fsPath) continue

			snapshottedDiffAreaOfId[diffareaid] = deepClone(
				Object.fromEntries(diffAreaSnapshotKeys.map(key => [key, diffArea[key]]))
			) as DiffAreaSnapshotEntry
		}

		const entireFileCode = model ? model.getValue(EndOfLinePreference.LF) : ''

		// this._noLongerNeedModelReference(uri)
		return {
			snapshottedDiffAreaOfId,
			entireFileCode, // the whole file's code
		}
	}


	private _restoreCortexideFileSnapshot = async (uri: URI, snapshot: CortexideFileSnapshot) => {
		// for each diffarea in this uri, stop streaming if currently streaming
		for (const diffareaid in this.diffAreaOfId) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea.type === 'DiffZone')
				this._stopIfStreaming(diffArea)
		}

		// delete all diffareas on this uri (clearing their styles)
		this._deleteAllDiffAreas(uri)

		const { snapshottedDiffAreaOfId, entireFileCode: entireModelCode } = deepClone(snapshot) // don't want to destroy the snapshot

		// restore diffAreaOfId and diffAreasOfModelId
		for (const diffareaid in snapshottedDiffAreaOfId) {

			const snapshottedDiffArea = snapshottedDiffAreaOfId[diffareaid]

			if (snapshottedDiffArea.type === 'DiffZone') {
				this.diffAreaOfId[diffareaid] = {
					...snapshottedDiffArea as DiffAreaSnapshotEntry<DiffZone>,
					type: 'DiffZone',
					_diffOfId: {},
					_URI: uri,
					_streamState: { isStreaming: false }, // when restoring, we will never be streaming
					_removeStylesFns: new Set(),
				}
			}
			else if (snapshottedDiffArea.type === 'CtrlKZone') {
				this.diffAreaOfId[diffareaid] = {
					...snapshottedDiffArea as DiffAreaSnapshotEntry<CtrlKZone>,
					_URI: uri,
					_removeStylesFns: new Set<Function>(),
					_mountInfo: null,
					_linkedStreamingDiffZone: null, // when restoring, we will never be streaming
				}
			}
			this._addOrInitializeDiffAreaAtURI(uri, diffareaid)
		}
		this._onDidAddOrDeleteDiffZones.fire({ uri })

		// restore file content (in-memory model)
		this._writeURIText(uri, entireModelCode,
			'wholeFileRange',
			{ shouldRealignDiffAreas: false }
		)
		// Phase 1 #2: PERSIST the restored content to disk (atomically). Previously the restore only
		// rewrote the in-memory buffer and never saved, so rolling back to a checkpoint left the
		// agent's edits on disk (the rollback was illusory). saveModel is a no-op if there is no live
		// model for the URI; that case is handled by the durable create/delete restore in chatThreadService.
		await this._cortexideModelService.saveModel(uri)
		// this._noLongerNeedModelReference(uri)
	}

	private _addToHistory(uri: URI, opts?: { onWillUndo?: () => void }) {
		const beforeSnapshot: CortexideFileSnapshot = this._getCurrentCortexideFileSnapshot(uri)
		let afterSnapshot: CortexideFileSnapshot | null = null

		const elt: IUndoRedoElement = {
			type: UndoRedoElementType.Resource,
			resource: uri,
		label: 'Cortex Agent',
			code: 'undoredo.editCode',
			undo: async () => { opts?.onWillUndo?.(); await this._restoreCortexideFileSnapshot(uri, beforeSnapshot) },
			redo: async () => { if (afterSnapshot) await this._restoreCortexideFileSnapshot(uri, afterSnapshot) }
		}
		this._undoRedoService.pushElement(elt)

		const onFinishEdit = async () => {
			afterSnapshot = this._getCurrentCortexideFileSnapshot(uri)
			await this._cortexideModelService.saveModel(uri)
		}
		return { onFinishEdit }
	}


	public getCortexideFileSnapshot(uri: URI) {
		return this._getCurrentCortexideFileSnapshot(uri)
	}


	public restoreCortexideFileSnapshot(uri: URI, snapshot: CortexideFileSnapshot): Promise<void> {
		// returns a promise so callers (checkpoint rollback) can await the disk persist + surface errors
		return this._restoreCortexideFileSnapshot(uri, snapshot)
	}


	// delete diffOfId and diffArea._diffOfId
	private _deleteDiff(diff: Diff) {
		const diffArea = this.diffAreaOfId[diff.diffareaid]
		if (diffArea.type !== 'DiffZone') return
		delete diffArea._diffOfId[diff.diffid]
		delete this.diffOfId[diff.diffid]
	}

	private _deleteDiffs(diffZone: DiffZone) {
		for (const diffid in diffZone._diffOfId) {
			const diff = diffZone._diffOfId[diffid]
			this._deleteDiff(diff)
		}
	}

	private _clearAllDiffAreaEffects(diffArea: DiffArea) {
		// clear diffZone effects (diffs)
		if (diffArea.type === 'DiffZone')
			this._deleteDiffs(diffArea)

		diffArea._removeStylesFns?.forEach(removeStyles => removeStyles())
		diffArea._removeStylesFns?.clear()
	}


	// clears all Diffs (and their styles) and all styles of DiffAreas, etc
	private _clearAllEffects(uri: URI) {
		for (let diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			this._clearAllDiffAreaEffects(diffArea)
		}
	}


	// delete all diffs, update diffAreaOfId, update diffAreasOfModelId
	private _deleteDiffZone(diffZone: DiffZone) {
		this._clearAllDiffAreaEffects(diffZone)
		delete this.diffAreaOfId[diffZone.diffareaid]
		this.diffAreasOfURI[diffZone._URI.fsPath]?.delete(diffZone.diffareaid.toString())
		this._onDidAddOrDeleteDiffZones.fire({ uri: diffZone._URI })
	}

	private _deleteTrackingZone(trackingZone: TrackingZone<unknown>) {
		delete this.diffAreaOfId[trackingZone.diffareaid]
		this.diffAreasOfURI[trackingZone._URI.fsPath]?.delete(trackingZone.diffareaid.toString())
	}

	private _deleteCtrlKZone(ctrlKZone: CtrlKZone) {
		this._clearAllEffects(ctrlKZone._URI)
		ctrlKZone._mountInfo?.dispose()
		delete this.diffAreaOfId[ctrlKZone.diffareaid]
		this.diffAreasOfURI[ctrlKZone._URI.fsPath]?.delete(ctrlKZone.diffareaid.toString())
	}


	private _deleteAllDiffAreas(uri: URI) {
		const diffAreas = this.diffAreasOfURI[uri.fsPath]
		diffAreas?.forEach(diffareaid => {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea.type === 'DiffZone')
				this._deleteDiffZone(diffArea)
			else if (diffArea.type === 'CtrlKZone')
				this._deleteCtrlKZone(diffArea)
		})
		this.diffAreasOfURI[uri.fsPath]?.clear()
	}

	private _addOrInitializeDiffAreaAtURI = (uri: URI, diffareaid: string | number) => {
		if (!(uri.fsPath in this.diffAreasOfURI)) this.diffAreasOfURI[uri.fsPath] = new Set()
		this.diffAreasOfURI[uri.fsPath]?.add(diffareaid.toString())
	}

	private _diffareaidPool = 0 // each diffarea has an id
	private _addDiffArea<T extends DiffArea>(diffArea: Omit<T, 'diffareaid'>): T {
		const diffareaid = this._diffareaidPool++
		const diffArea2 = { ...diffArea, diffareaid } as T
		this._addOrInitializeDiffAreaAtURI(diffArea._URI, diffareaid)
		this.diffAreaOfId[diffareaid] = diffArea2
		return diffArea2
	}

	private _diffidPool = 0 // each diff has an id
	private _addDiff(computedDiff: ComputedDiff, diffZone: DiffZone): Diff {
		const uri = diffZone._URI
		const diffid = this._diffidPool++

		// create a Diff of it
		const newDiff: Diff = {
			...computedDiff,
			diffid: diffid,
			diffareaid: diffZone.diffareaid,
			enabled: true, // default to enabled, user can toggle
		}

		const fn = this._addDiffStylesToURI(uri, newDiff)
		if (fn) diffZone._removeStylesFns.add(fn)

		this.diffOfId[diffid] = newDiff
		diffZone._diffOfId[diffid] = newDiff

		return newDiff
	}




	// changes the start/line locations of all DiffAreas on the page (adjust their start/end based on the change) based on the change that was recently made
	private _realignAllDiffAreasLines(uri: URI, text: string, recentChange: { startLineNumber: number; endLineNumber: number }) {

		// console.log('recent change', recentChange)

		// compute net number of newlines lines that were added/removed
		const startLine = recentChange.startLineNumber
		const endLine = recentChange.endLineNumber

		const newTextHeight = (text.match(/\n/g) || []).length + 1 // number of newlines is number of \n's + 1, e.g. "ab\ncd"

		// compute overlap with each diffArea and shrink/elongate each diffArea accordingly
		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]

			// if the diffArea is entirely above the range, it is not affected
			if (diffArea.endLine < startLine) {
				// console.log('CHANGE FULLY BELOW DA (doing nothing)')
				continue
			}
			// if a diffArea is entirely below the range, shift the diffArea up/down by the delta amount of newlines
			else if (endLine < diffArea.startLine) {
				// console.log('CHANGE FULLY ABOVE DA')
				const changedRangeHeight = endLine - startLine + 1
				const deltaNewlines = newTextHeight - changedRangeHeight
				diffArea.startLine += deltaNewlines
				diffArea.endLine += deltaNewlines
			}
			// if the diffArea fully contains the change, elongate it by the delta amount of newlines
			else if (startLine >= diffArea.startLine && endLine <= diffArea.endLine) {
				// console.log('DA FULLY CONTAINS CHANGE')
				const changedRangeHeight = endLine - startLine + 1
				const deltaNewlines = newTextHeight - changedRangeHeight
				diffArea.endLine += deltaNewlines
			}
			// if the change fully contains the diffArea, make the diffArea have the same range as the change
			else if (diffArea.startLine > startLine && diffArea.endLine < endLine) {
				// console.log('CHANGE FULLY CONTAINS DA')
				diffArea.startLine = startLine
				diffArea.endLine = startLine + newTextHeight
			}
			// if the change contains only the diffArea's top
			else if (startLine < diffArea.startLine && diffArea.startLine <= endLine) {
				// console.log('CHANGE CONTAINS TOP OF DA ONLY')
				const numOverlappingLines = endLine - diffArea.startLine + 1
				const numRemainingLinesInDA = diffArea.endLine - diffArea.startLine + 1 - numOverlappingLines
				const newHeight = (numRemainingLinesInDA - 1) + (newTextHeight - 1) + 1
				diffArea.startLine = startLine
				diffArea.endLine = startLine + newHeight
			}
			// if the change contains only the diffArea's bottom
			else if (startLine <= diffArea.endLine && diffArea.endLine < endLine) {
				// console.log('CHANGE CONTAINS BOTTOM OF DA ONLY')
				const numOverlappingLines = diffArea.endLine - startLine + 1
				diffArea.endLine += newTextHeight - numOverlappingLines
			}
		}

	}



	private _fireChangeDiffsIfNotStreaming(uri: URI) {
		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea?.type !== 'DiffZone') continue
			// fire changed diffs (this is the only place Diffs are added)
			if (!diffArea._streamState.isStreaming) {
				this._onDidChangeDiffsInDiffZoneNotStreaming.fire({ uri, diffareaid: diffArea.diffareaid })
			}
		}
	}


	private _refreshStylesAndDiffsInURI(uri: URI) {

		// 1. clear DiffArea styles and Diffs
		this._clearAllEffects(uri)

		// 2. style DiffAreas (sweep, etc)
		this._addDiffAreaStylesToURI(uri)

		// 3. add Diffs
		this._computeDiffsAndAddStylesToURI(uri)

		// 4. refresh ctrlK zones
		this._refreshCtrlKInputs(uri)

		// 5. this is the only place where diffs are changed, so can fire here only
		this._fireChangeDiffsIfNotStreaming(uri)
	}




	// @throttle(100)
	private _writeStreamedDiffZoneLLMText(uri: URI, originalCode: string, llmTextSoFar: string, deltaText: string, latestMutable: StreamLocationMutable) {

		let numNewLines = 0

		// ----------- 1. Write the new code to the document -----------
		// figure out where to highlight based on where the AI is in the stream right now, use the last diff to figure that out
		const computedDiffs = findDiffs(originalCode, llmTextSoFar)

		// if streaming, use diffs to figure out where to write new code
		// these are two different coordinate systems - new and old line number
		let endLineInLlmTextSoFar: number // get file[diffArea.startLine...newFileEndLine] with line=newFileEndLine highlighted
		let startLineInOriginalCode: number // get original[oldStartingPoint...] (line in the original code, so starts at 1)

		const lastDiff = computedDiffs.pop()

		if (!lastDiff) {
			// console.log('!lastDiff')
			// if the writing is identical so far, display no changes
			startLineInOriginalCode = 1
			endLineInLlmTextSoFar = 1
		}
		else {
			startLineInOriginalCode = lastDiff.originalStartLine
			if (lastDiff.type === 'insertion' || lastDiff.type === 'edit')
				endLineInLlmTextSoFar = lastDiff.endLine
			else if (lastDiff.type === 'deletion')
				endLineInLlmTextSoFar = lastDiff.startLine
			else
				throw new Error(`Void: diff.type not recognized on: ${lastDiff}`)
		}

		// at the start, add a newline between the stream and originalCode to make reasoning easier
		if (!latestMutable.addedSplitYet) {
			this._writeURIText(uri, '\n',
				{ startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line, endColumn: latestMutable.col, },
				{ shouldRealignDiffAreas: true }
			)
			latestMutable.addedSplitYet = true
			numNewLines += 1
		}

		// insert deltaText at latest line and col
		this._writeURIText(uri, deltaText,
			{ startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line, endColumn: latestMutable.col },
			{ shouldRealignDiffAreas: true }
		)
		const deltaNumNewLines = deltaText.split('\n').length - 1
		latestMutable.line += deltaNumNewLines
		const lastNewlineIdx = deltaText.lastIndexOf('\n')
		latestMutable.col = lastNewlineIdx === -1 ? latestMutable.col + deltaText.length : deltaText.length - lastNewlineIdx
		numNewLines += deltaNumNewLines

		// delete or insert to get original up to speed
		if (latestMutable.originalCodeStartLine < startLineInOriginalCode) {
			// moved up, delete
			const numLinesDeleted = startLineInOriginalCode - latestMutable.originalCodeStartLine
			this._writeURIText(uri, '',
				{ startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line + numLinesDeleted, endColumn: Number.MAX_SAFE_INTEGER, },
				{ shouldRealignDiffAreas: true }
			)
			numNewLines -= numLinesDeleted
		}
		else if (latestMutable.originalCodeStartLine > startLineInOriginalCode) {
			const newText = '\n' + originalCode.split('\n').slice((startLineInOriginalCode - 1), (latestMutable.originalCodeStartLine - 1) - 1 + 1).join('\n')
			this._writeURIText(uri, newText,
				{ startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line, endColumn: latestMutable.col },
				{ shouldRealignDiffAreas: true }
			)
			numNewLines += newText.split('\n').length - 1
		}
		latestMutable.originalCodeStartLine = startLineInOriginalCode

		return { endLineInLlmTextSoFar, numNewLines } // numNewLines here might not be correct....
	}




	// called first, then call startApplying
	public addCtrlKZone({ startLine, endLine, editor }: AddCtrlKOpts) {

		// don't need to await this, because in order to add a ctrl+K zone must already have the model open on your screen
		// await this._ensureModelExists(uri)

		const uri = editor.getModel()?.uri
		if (!uri) return


		// check if there's overlap with any other ctrlKZone and if so, focus it
		const overlappingCtrlKZone = this._findOverlappingDiffArea({ startLine, endLine, uri, filter: (diffArea) => diffArea.type === 'CtrlKZone' })
		if (overlappingCtrlKZone) {
			editor.revealLine(overlappingCtrlKZone.startLine) // important
			setTimeout(() => (overlappingCtrlKZone as CtrlKZone)._mountInfo?.textAreaRef.current?.focus(), 100)
			return
		}

		const overlappingDiffZone = this._findOverlappingDiffArea({ startLine, endLine, uri, filter: (diffArea) => diffArea.type === 'DiffZone' })
		if (overlappingDiffZone)
			return

		editor.revealLine(startLine)
		editor.setSelection({ startLineNumber: startLine, endLineNumber: startLine, startColumn: 1, endColumn: 1 })

		const { onFinishEdit } = this._addToHistory(uri)

		const adding: Omit<CtrlKZone, 'diffareaid'> = {
			type: 'CtrlKZone',
			startLine: startLine,
			endLine: endLine,
			editorId: editor.getId(),
			_URI: uri,
			_removeStylesFns: new Set(),
			_mountInfo: null,
			_linkedStreamingDiffZone: null,
		}
		const ctrlKZone = this._addDiffArea(adding)
		this._refreshStylesAndDiffsInURI(uri)

		onFinishEdit()
		return ctrlKZone.diffareaid
	}

	// _remove means delete and also add to history
	public removeCtrlKZone({ diffareaid }: { diffareaid: number }) {
		const ctrlKZone = this.diffAreaOfId[diffareaid]
		if (!ctrlKZone) return
		if (ctrlKZone.type !== 'CtrlKZone') return

		const uri = ctrlKZone._URI
		const { onFinishEdit } = this._addToHistory(uri)
		this._deleteCtrlKZone(ctrlKZone)
		this._refreshStylesAndDiffsInURI(uri)
		onFinishEdit()
	}




	private _getURIBeforeStartApplying(opts: CallBeforeStartApplyingOpts) {
		// SR
		if (opts.from === 'ClickApply') {
			const uri = this._uriOfGivenURI(opts.uri)
			if (!uri) return
			return uri
		}
		else if (opts.from === 'QuickEdit') {
			const { diffareaid } = opts
			const ctrlKZone = this.diffAreaOfId[diffareaid]
			if (ctrlKZone?.type !== 'CtrlKZone') return
			const { _URI: uri } = ctrlKZone
			return uri
		}
		return
	}

	public async callBeforeApplyOrEdit(givenURI: URI | 'current') {
		const uri = this._uriOfGivenURI(givenURI)
		if (!uri) return
		await this._cortexideModelService.initializeModel(uri)
		await this._cortexideModelService.saveModel(uri) // save the URI
	}


	// the applyDonePromise this returns can reject, and should be caught with .catch
	public startApplying(opts: StartApplyingOpts): [URI, Promise<void>] | null {
		let res: [DiffZone, Promise<void>] | undefined = undefined

		if (opts.from === 'QuickEdit') {
			res = this._initializeWriteoverStream(opts) // rewrite
		}
		else if (opts.from === 'ClickApply') {
			if (this._settingsService.state.globalSettings.enableFastApply) {
				const numCharsInFile = this._fileLengthOfGivenURI(opts.uri)
				if (numCharsInFile === null) return null
				if (numCharsInFile < 1000) { // slow apply for short files (especially important for empty files)
					res = this._initializeWriteoverStream(opts)
				}
				else {
					res = this._initializeSearchAndReplaceStream(opts) // fast apply
				}
			}
			else {
				res = this._initializeWriteoverStream(opts) // rewrite
			}
		}

		if (!res) return null
		const [diffZone, applyDonePromise] = res
		return [diffZone._URI, applyDonePromise]
	}


	public instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks }: { uri: URI, searchReplaceBlocks: string }) {
		// start diffzone
		const res = this._startStreamingDiffZone({
			uri,
			streamRequestIdRef: { current: null },
			startBehavior: 'keep-conflicts',
			linkedCtrlKZone: null,
			onWillUndo: () => { },
		})
		if (!res) return
		const { diffZone, onFinishEdit } = res


		const onDone = () => {
			diffZone._streamState = { isStreaming: false, }
			this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid })
			this._refreshStylesAndDiffsInURI(uri)
			onFinishEdit()

			// auto accept
			if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
				this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: 'accept' })
			}
		}


		const onError = (e: { message: string; fullError: Error | null; }) => {
			// this._notifyError(e)
			onDone()
			this._undoHistory(uri)
			throw e.fullError || new Error(e.message)
		}

		try {
			this._instantlyApplySRBlocks(uri, searchReplaceBlocks)
		}
		catch (e) {
			onError({ message: e + '', fullError: null })
		}

		onDone()
	}


	public instantlyRewriteFile({ uri, newContent }: { uri: URI, newContent: string }) {
		// start diffzone
		const res = this._startStreamingDiffZone({
			uri,
			streamRequestIdRef: { current: null },
			startBehavior: 'keep-conflicts',
			linkedCtrlKZone: null,
			onWillUndo: () => { },
		})
		if (!res) return
		const { diffZone, onFinishEdit } = res


		const onDone = () => {
			diffZone._streamState = { isStreaming: false, }
			this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid })
			this._refreshStylesAndDiffsInURI(uri)
			onFinishEdit()

			// auto accept
			if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
				this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: 'accept' })
			}
		}

		this._writeURIText(uri, newContent, 'wholeFileRange', { shouldRealignDiffAreas: true })
		onDone()
	}


	private _findOverlappingDiffArea({ startLine, endLine, uri, filter }: { startLine: number, endLine: number, uri: URI, filter?: (diffArea: DiffArea) => boolean }): DiffArea | null {
		// check if there's overlap with any other diffAreas and return early if there is
		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (!diffArea) continue
			if (!filter?.(diffArea)) continue
			const noOverlap = diffArea.startLine > endLine || diffArea.endLine < startLine
			if (!noOverlap) {
				return diffArea
			}
		}
		return null
	}








	private _startStreamingDiffZone({
		uri,
		startBehavior,
		streamRequestIdRef,
		linkedCtrlKZone,
		onWillUndo,
	}: {
		uri: URI,
		startBehavior: 'accept-conflicts' | 'reject-conflicts' | 'keep-conflicts',
		streamRequestIdRef: { current: string | null },
		linkedCtrlKZone: CtrlKZone | null,
		onWillUndo: () => void,
	}) {
		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) return

		// treat like full file, unless linkedCtrlKZone was provided in which case use its diff's range

		const startLine = linkedCtrlKZone ? linkedCtrlKZone.startLine : 1
		const endLine = linkedCtrlKZone ? linkedCtrlKZone.endLine : model.getLineCount()
		const range = { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: Number.MAX_SAFE_INTEGER }

		const originalFileStr = model.getValue(EndOfLinePreference.LF)
		let originalCode = model.getValueInRange(range, EndOfLinePreference.LF)


		// add to history as a checkpoint, before we start modifying
		const { onFinishEdit } = this._addToHistory(uri, { onWillUndo })

		// clear diffZones so no conflict
		if (startBehavior === 'keep-conflicts') {
			if (linkedCtrlKZone) {
				// ctrlkzone should never have any conflicts
			}
			else {
				// keep conflict on whole file - to keep conflict, revert the change and use those contents as original, then un-revert the file
				this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: 'reject', _addToHistory: false })
				const oldFileStr = model.getValue(EndOfLinePreference.LF) // use this as original code
				this._writeURIText(uri, originalFileStr, 'wholeFileRange', { shouldRealignDiffAreas: true }) // un-revert
				originalCode = oldFileStr
			}

		}
		else if (startBehavior === 'accept-conflicts' || startBehavior === 'reject-conflicts') {
			const behavior = startBehavior === 'accept-conflicts' ? 'accept' : 'reject'
			this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior, _addToHistory: false })
		}

		const adding: Omit<DiffZone, 'diffareaid'> = {
			type: 'DiffZone',
			originalCode,
			startLine,
			endLine,
			_URI: uri,
			_streamState: {
				isStreaming: true,
				streamRequestIdRef,
				line: startLine,
			},
			_diffOfId: {}, // added later
			_removeStylesFns: new Set(),
		}

		const diffZone = this._addDiffArea(adding)
		this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid })
		this._onDidAddOrDeleteDiffZones.fire({ uri })

		// a few items related to the ctrlKZone that started streaming this diffZone
		if (linkedCtrlKZone) {
			const ctrlKZone = linkedCtrlKZone
			ctrlKZone._linkedStreamingDiffZone = diffZone.diffareaid
			this._onDidChangeStreamingInCtrlKZone.fire({ uri, diffareaid: ctrlKZone.diffareaid })
		}


		return { diffZone, onFinishEdit }
	}




	private _uriIsStreaming(uri: URI) {
		const diffAreas = this.diffAreasOfURI[uri.fsPath]
		if (!diffAreas) return false
		for (const diffareaid of diffAreas) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea?.type !== 'DiffZone') continue
			if (diffArea._streamState.isStreaming) return true
		}
		return false
	}


	private _initializeWriteoverStream(opts: StartApplyingOpts): [DiffZone, Promise<void>] | undefined {

		const { from, } = opts
		const featureName: FeatureName = opts.from === 'ClickApply' ? 'Apply' : 'Ctrl+K'
		const overridesOfModel = this._settingsService.state.overridesOfModel
		const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName]
		// Skip "auto" - it's not a real provider
		const modelSelectionOptions = modelSelection && !(modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')
			? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]
			: undefined


		const uri = this._getURIBeforeStartApplying(opts)
		if (!uri) return

		let startRange: 'fullFile' | [number, number]
		let ctrlKZoneIfQuickEdit: CtrlKZone | null = null

		if (from === 'ClickApply') {
			startRange = 'fullFile'
		}
		else if (from === 'QuickEdit') {
			const { diffareaid } = opts
			const ctrlKZone = this.diffAreaOfId[diffareaid]
			if (ctrlKZone?.type !== 'CtrlKZone') return
			ctrlKZoneIfQuickEdit = ctrlKZone
			const { startLine: startLine_, endLine: endLine_ } = ctrlKZone
			startRange = [startLine_, endLine_]
		}
		else {
			throw new Error(`Void: diff.type not recognized on: ${from}`)
		}

		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) return

		let streamRequestIdRef: { current: string | null } = { current: null } // can use this as a proxy to set the diffArea's stream state requestId

		// build messages
		const quickEditFIMTags = defaultQuickEditFimTags // TODO can eventually let users customize modelFimTags
		const originalFileCode = model.getValue(EndOfLinePreference.LF)
		const originalCode = startRange === 'fullFile' ? originalFileCode : originalFileCode.split('\n').slice((startRange[0] - 1), (startRange[1] - 1) + 1).join('\n')
		const language = model.getLanguageId()
		let messages: LLMChatMessage[]
		let separateSystemMessage: string | undefined

		// Detect if using local model for minimal prompts and code pruning
		const isLocal = modelSelection && modelSelection.providerName !== 'auto' && isLocalProvider(modelSelection.providerName, this._settingsService.state.settingsOfProvider)

		// Warm up local model in background (fire-and-forget, doesn't block)
		// This reduces first-request latency for Ctrl+K/Apply on local models
		if (modelSelection && modelSelection.providerName !== 'auto' && modelSelection.modelName !== 'auto') {
			try {
				this._modelWarmupService.warmupModelIfNeeded(modelSelection.providerName, modelSelection.modelName, featureName)
			} catch (e) {
				// Warm-up failures should never block edit flows - silently ignore
				console.debug('[EditCodeService] Warm-up call failed (non-blocking):', e)
			}
		}

		if (from === 'ClickApply') {
			const systemMsg = isLocal ? rewriteCode_systemMessage_local : rewriteCode_systemMessage
			// For local models, prune code to reduce token usage
			const prunedOriginalCode = isLocal ? pruneCodeForLocalModel(originalCode, language) : originalCode
			const { messages: a, separateSystemMessage: b } = this._convertToLLMMessageService.prepareLLMSimpleMessages({
				systemMessage: systemMsg,
				simpleMessages: [{ role: 'user', content: rewriteCode_userMessage({ originalCode: prunedOriginalCode, applyStr: opts.applyStr, language }), }],
				featureName,
				modelSelection,
			})
			messages = a
			separateSystemMessage = b
		}
		else if (from === 'QuickEdit') {
			if (!ctrlKZoneIfQuickEdit) return
			const { _mountInfo } = ctrlKZoneIfQuickEdit
			const instructions = _mountInfo?.textAreaRef.current?.value ?? ''

			const startLine = startRange === 'fullFile' ? 1 : startRange[0]
			const endLine = startRange === 'fullFile' ? model.getLineCount() : startRange[1]
			const { prefix, suffix } = voidPrefixAndSuffix({ fullFileStr: originalFileCode, startLine, endLine })
			// For local models, prune code to reduce token usage
			const prunedSelection = isLocal ? pruneCodeForLocalModel(originalCode, language) : originalCode
			const prunedPrefix = isLocal ? pruneCodeForLocalModel(prefix, language) : prefix
			const prunedSuffix = isLocal ? pruneCodeForLocalModel(suffix, language) : suffix
			const userContent = ctrlKStream_userMessage({ selection: prunedSelection, instructions: instructions, prefix: prunedPrefix, suffix: prunedSuffix, fimTags: quickEditFIMTags, language })

			const systemMsg = isLocal
				? ctrlKStream_systemMessage_local({ quickEditFIMTags: quickEditFIMTags })
				: ctrlKStream_systemMessage({ quickEditFIMTags: quickEditFIMTags })
			const { messages: a, separateSystemMessage: b } = this._convertToLLMMessageService.prepareLLMSimpleMessages({
				systemMessage: systemMsg,
				simpleMessages: [{ role: 'user', content: userContent, }],
				featureName,
				modelSelection,
			})
			messages = a
			separateSystemMessage = b

		}
		else { throw new Error(`featureName ${from} is invalid`) }

		// if URI is already streaming, return (should never happen, caller is responsible for checking)
		if (this._uriIsStreaming(uri)) return

		// start diffzone
		const res = this._startStreamingDiffZone({
			uri,
			streamRequestIdRef,
			startBehavior: opts.startBehavior,
			linkedCtrlKZone: ctrlKZoneIfQuickEdit,
			onWillUndo: () => {
				if (streamRequestIdRef.current) {
					this._llmMessageService.abort(streamRequestIdRef.current)
				}
			},

		})
		if (!res) return
		const { diffZone, onFinishEdit, } = res


		// helpers
		const onDone = () => {
			diffZone._streamState = { isStreaming: false, }
			this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid })

			if (ctrlKZoneIfQuickEdit) {
				const ctrlKZone = ctrlKZoneIfQuickEdit

				ctrlKZone._linkedStreamingDiffZone = null
				this._onDidChangeStreamingInCtrlKZone.fire({ uri, diffareaid: ctrlKZone.diffareaid })
				this._deleteCtrlKZone(ctrlKZone)
			}
			this._refreshStylesAndDiffsInURI(uri)
			onFinishEdit()

			// auto accept
			if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
				this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: 'accept' })
			}
		}

		// throws
		const onError = (e: { message: string; fullError: Error | null; }) => {
			// this._notifyError(e)
			onDone()
			this._undoHistory(uri)
			throw e.fullError || new Error(e.message)
		}

		const extractText = (fullText: string, recentlyAddedTextLen: number) => {
			if (from === 'QuickEdit') {
				return extractCodeFromFIM({ text: fullText, recentlyAddedTextLen, midTag: quickEditFIMTags.midTag })
			}
			else if (from === 'ClickApply') {
				return extractCodeFromRegular({ text: fullText, recentlyAddedTextLen })
			}
			throw new Error('CortexIDE 1')
		}

		// refresh now in case onText takes a while to get 1st message
		this._refreshStylesAndDiffsInURI(uri)

		const latestStreamLocationMutable: StreamLocationMutable = { line: diffZone.startLine, addedSplitYet: false, col: 1, originalCodeStartLine: 1 }

		// allowed to throw errors - this is called inside a promise that handles everything
		const runWriteover = async () => {
			let shouldSendAnotherMessage = true
			while (shouldSendAnotherMessage) {
				shouldSendAnotherMessage = false

				let resMessageDonePromise: () => void = () => { }
				const messageDonePromise = new Promise<void>((res_) => { resMessageDonePromise = res_ })

				// state used in onText:
				let fullTextSoFar = '' // so far (INCLUDING ignored suffix)
				let prevIgnoredSuffix = ''
				let aborted = false
				let weAreAborting = false


				streamRequestIdRef.current = this._llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					logging: { loggingName: `Edit (Writeover) - ${from}` },
					messages,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel,
					separateSystemMessage,
					chatMode: null, // not chat
					onText: (params) => {
						const { fullText: fullText_ } = params
						const newText_ = fullText_.substring(fullTextSoFar.length, Infinity)

						const newText = prevIgnoredSuffix + newText_ // add the previously ignored suffix because it's no longer the suffix!
						fullTextSoFar += newText // full text, including ```, etc

						const [croppedText, deltaCroppedText, croppedSuffix] = extractText(fullTextSoFar, newText.length)
						const { endLineInLlmTextSoFar } = this._writeStreamedDiffZoneLLMText(uri, originalCode, croppedText, deltaCroppedText, latestStreamLocationMutable)
						diffZone._streamState.line = (diffZone.startLine - 1) + endLineInLlmTextSoFar // change coordinate systems from originalCode to full file

						this._refreshStylesAndDiffsInURI(uri)

						prevIgnoredSuffix = croppedSuffix
					},
					onFinalMessage: (params) => {
						const { fullText } = params
						// console.log('DONE! FULL TEXT\n', extractText(fullText), diffZone.startLine, diffZone.endLine)
						// at the end, re-write whole thing to make sure no sync errors
						const [croppedText, _1, _2] = extractText(fullText, 0)
						this._writeURIText(uri, croppedText,
							{ startLineNumber: diffZone.startLine, startColumn: 1, endLineNumber: diffZone.endLine, endColumn: Number.MAX_SAFE_INTEGER }, // 1-indexed
							{ shouldRealignDiffAreas: true }
						)

						onDone()
						resMessageDonePromise()
					},
					onError: (e) => {
						onError(e)
					},
					onAbort: () => {
						if (weAreAborting) return
						// stop the loop to free up the promise, but don't modify state (already handled by whatever stopped it)
						aborted = true
						resMessageDonePromise()
					},
				})
				// should never happen, just for safety
				if (streamRequestIdRef.current === null) { return }

				await messageDonePromise
				if (aborted) {
					throw new Error(`Edit was interrupted by the user.`)
				}
			} // end while
		} // end writeover

		const applyDonePromise = new Promise<void>((res, rej) => { runWriteover().then(res).catch(rej) })
		return [diffZone, applyDonePromise]
	}



	_uriOfGivenURI(givenURI: URI | 'current') {
		if (givenURI === 'current') {
			const uri_ = this._getActiveEditorURI()
			if (!uri_) return
			return uri_
		}
		return givenURI
	}
	_fileLengthOfGivenURI(givenURI: URI | 'current') {
		const uri = this._uriOfGivenURI(givenURI)
		if (!uri) return null
		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) return null
		const numCharsInFile = model.getValueLength(EndOfLinePreference.LF)
		return numCharsInFile
	}


	/**
	 * Generates a human-readable error message for an invalid ORIGINAL search block.
	 */
	private _errContentOfInvalidStr = (
		str: 'Not found' | 'Not unique' | 'Has overlap',
		blockOrig: string,
	): string => {
		const problematicCode = `${tripleTick[0]}\n${JSON.stringify(blockOrig)}\n${tripleTick[1]}`

		// use a switch for better readability / exhaustiveness check
		let descStr: string
		switch (str) {
			case 'Not found':
				descStr = `The edit was not applied. The text in ORIGINAL must EXACTLY match lines of code in the file, but there was no match for:\n${problematicCode}. Ensure you have the latest version of the file, and ensure the ORIGINAL code matches a code excerpt exactly.`
				break
			case 'Not unique':
				descStr = `The edit was not applied. The text in ORIGINAL must be unique in the file being edited, but the following ORIGINAL code appears multiple times in the file:\n${problematicCode}. Ensure you have the latest version of the file, and ensure the ORIGINAL code is unique.`
				break
			case 'Has overlap':
				descStr = `The edit was not applied. The text in the ORIGINAL blocks must not overlap, but the following ORIGINAL code had overlap with another ORIGINAL string:\n${problematicCode}. Ensure you have the latest version of the file, and ensure the ORIGINAL code blocks do not overlap.`
				break
			default:
				descStr = ''
		}
		return descStr
	}


	private _instantlyApplySRBlocks(uri: URI, blocksStr: string) {
		const blocks = extractSearchReplaceBlocks(blocksStr)
		if (blocks.length === 0) throw new Error(`No Search/Replace blocks were received!`)

		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) throw new Error(`Error applying Search/Replace blocks: File does not exist.`)
		const modelStr = model.getValue(EndOfLinePreference.LF)

		// Pure multi-edit transaction: validate ALL blocks, reject on overlap, apply right-to-left.
		// All-or-nothing - a non-ok result throws before any write (common/searchReplaceMatch.ts).
		const result = computeSearchReplaceResult(modelStr, blocks)
		if (!result.ok) throw new Error(this._errContentOfInvalidStr(result.reason, result.blockOrig))

		this._writeURIText(uri, result.newCode,
			'wholeFileRange',
			{ shouldRealignDiffAreas: true }
		)
	}

	private _initializeSearchAndReplaceStream(opts: StartApplyingOpts & { from: 'ClickApply' }): [DiffZone, Promise<void>] | undefined {
		const { from, applyStr, } = opts
		const featureName: FeatureName = 'Apply'
		const overridesOfModel = this._settingsService.state.overridesOfModel
		const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName]
		// Skip "auto" - it's not a real provider
		const modelSelectionOptions = modelSelection && !(modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')
			? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]
			: undefined

		const uri = this._getURIBeforeStartApplying(opts)
		if (!uri) return

		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) return

		let streamRequestIdRef: { current: string | null } = { current: null } // can use this as a proxy to set the diffArea's stream state requestId


		// build messages - ask LLM to generate search/replace block text
		const originalFileCode = model.getValue(EndOfLinePreference.LF)
		const userMessageContent = searchReplaceGivenDescription_userMessage({ originalCode: originalFileCode, applyStr: applyStr })

		// Detect if local provider for minimal prompts
		const isLocal = modelSelection && modelSelection.providerName !== 'auto' && isLocalProvider(modelSelection.providerName, this._settingsService.state.settingsOfProvider)

		// Warm up local model in background (fire-and-forget, doesn't block)
		// This reduces first-request latency for Apply on local models
		if (modelSelection && modelSelection.providerName !== 'auto' && modelSelection.modelName !== 'auto') {
			try {
				this._modelWarmupService.warmupModelIfNeeded(modelSelection.providerName, modelSelection.modelName, featureName)
			} catch (e) {
				// Warm-up failures should never block edit flows - silently ignore
				console.debug('[EditCodeService] Warm-up call failed (non-blocking):', e)
			}
		}

		const systemMsg = isLocal ? rewriteCode_systemMessage_local : searchReplaceGivenDescription_systemMessage

		const { messages, separateSystemMessage: separateSystemMessage } = this._convertToLLMMessageService.prepareLLMSimpleMessages({
			systemMessage: systemMsg,
			simpleMessages: [{ role: 'user', content: userMessageContent, }],
			featureName,
			modelSelection,
		})

		// if URI is already streaming, return (should never happen, caller is responsible for checking)
		if (this._uriIsStreaming(uri)) return

		// start diffzone
		const res = this._startStreamingDiffZone({
			uri,
			streamRequestIdRef,
			startBehavior: opts.startBehavior,
			linkedCtrlKZone: null,
			onWillUndo: () => {
				if (streamRequestIdRef.current) {
					this._llmMessageService.abort(streamRequestIdRef.current) // triggers onAbort()
				}
			},
		})
		if (!res) return
		const { diffZone, onFinishEdit } = res


		// helpers
		type SearchReplaceDiffAreaMetadata = {
			originalBounds: [number, number], // 1-indexed
			originalCode: string,
		}
		const convertOriginalRangeToFinalRange = (originalRange: readonly [number, number]): [number, number] => {
			// adjust based on the changes by computing line offset
			const [originalStart, originalEnd] = originalRange
			let lineOffset = 0
			for (const blockDiffArea of addedTrackingZoneOfBlockNum) {
				const {
					startLine, endLine,
					metadata: { originalBounds: [originalStart2, originalEnd2], },
				} = blockDiffArea
				if (originalStart2 >= originalEnd) continue
				const numNewLines = endLine - startLine + 1
				const numOldLines = originalEnd2 - originalStart2 + 1
				lineOffset += numNewLines - numOldLines
			}
			return [originalStart + lineOffset, originalEnd + lineOffset]
		}


		const onDone = () => {
			diffZone._streamState = { isStreaming: false, }
			this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid })
			this._refreshStylesAndDiffsInURI(uri)

			// delete the tracking zones
			for (const trackingZone of addedTrackingZoneOfBlockNum)
				this._deleteTrackingZone(trackingZone)

			onFinishEdit()

			// auto accept
			if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
				this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: 'accept' })
			}
		}

		const onError = (e: { message: string; fullError: Error | null; }) => {
			// this._notifyError(e)
			onDone()
			this._undoHistory(uri)
			throw e.fullError || new Error(e.message)
		}

		// refresh now in case onText takes a while to get 1st message
		this._refreshStylesAndDiffsInURI(uri)

		// stream style related - TODO replace these with whatever block we're on initially if already started (if add caching of apply S/R blocks)
		let latestStreamLocationMutable: StreamLocationMutable | null = null
		let shouldUpdateOrigStreamStyle = true
		let oldBlocks: ExtractedSearchReplaceBlock[] = []
		const addedTrackingZoneOfBlockNum: TrackingZone<SearchReplaceDiffAreaMetadata>[] = []
		diffZone._streamState.line = 1

		const N_RETRIES = 4

		// allowed to throw errors - this is called inside a promise that handles everything
		const runSearchReplace = async () => {
			// this generates >>>>>>> ORIGINAL <<<<<<< REPLACE blocks and and simultaneously applies it
			let shouldSendAnotherMessage = true
			let nMessagesSent = 0
			let currStreamingBlockNum = 0
			let aborted = false
			let weAreAborting = false
			while (shouldSendAnotherMessage) {
				shouldSendAnotherMessage = false
				nMessagesSent += 1
				if (nMessagesSent >= N_RETRIES) {
					const e = {
						message: `Tried to Fast Apply ${N_RETRIES} times but failed. This may be related to model intelligence, or it may an edit that's too complex. Please retry or disable Fast Apply.`,
						fullError: null
					}
					onError(e)
					break
				}

				let resMessageDonePromise: () => void = () => { }
				const messageDonePromise = new Promise<void>((res, rej) => { resMessageDonePromise = res })


				const onText = (params: { fullText: string; fullReasoning: string }) => {
					const { fullText } = params
					// blocks are [done done done ... {writingFinal|writingOriginal}]
					//               ^
					//              currStreamingBlockNum

					const blocks = extractSearchReplaceBlocks(fullText)

					for (let blockNum = currStreamingBlockNum; blockNum < blocks.length; blockNum += 1) {
						const block = blocks[blockNum]

						if (block.state === 'writingOriginal') {
							// update stream state to the first line of original if some portion of original has been written
							if (shouldUpdateOrigStreamStyle && block.orig.trim().length >= 20) {
								const startingAtLine = diffZone._streamState.line ?? 1 // dont go backwards if already have a stream line
								const originalRange = findTextInCode(block.orig, originalFileCode, false, { startingAtLine, returnType: 'lines' })
								if (typeof originalRange !== 'string') {
									const [startLine, _] = convertOriginalRangeToFinalRange(originalRange)
									diffZone._streamState.line = startLine
									shouldUpdateOrigStreamStyle = false
								}
							}

							// // starting line is at least the number of lines in the generated code minus 1
							// const numLinesInOrig = numLinesOfStr(block.orig)
							// const newLine = Math.max(numLinesInOrig - 1, 1, diffZone._streamState.line ?? 1)
							// if (newLine !== diffZone._streamState.line) {
							// 	diffZone._streamState.line = newLine
							// 	this._refreshStylesAndDiffsInURI(uri)
							// }


							// must be done writing original to move on to writing streamed content
							continue
						}
						shouldUpdateOrigStreamStyle = true


						// if this is the first time we're seeing this block, add it as a diffarea so we can start streaming in it
						if (!(blockNum in addedTrackingZoneOfBlockNum)) {

							const originalBounds = findTextInCode(block.orig, originalFileCode, true, { returnType: 'lines' })

							// This block's final-range bounds, computed BEFORE the overlap check below (which
							// references them). They used to be const-declared AFTER the check, leaving startLine/
							// endLine in a temporal dead zone that threw a ReferenceError on the 2nd+ block of a
							// multi-block edit (when addedTrackingZoneOfBlockNum is non-empty so the .some()
							// callback actually runs). A string result is an error handled by the bail just below.
							const thisBlockRange = typeof originalBounds === 'string' ? null : convertOriginalRangeToFinalRange(originalBounds)

							// The revert-or-continue decision (this block couldn't be located, OR its range overlaps a
							// block already applied this stream) is the pure, node-tested common/editStreamRevertDecision.ts.
							// The side effects below (delete tracking zones, rewrite file, abort) stay here.
							const revertDecision = decideStreamRevert({
								originalBoundsError: typeof originalBounds === 'string' ? originalBounds : null,
								thisBlockRange,
								existingRanges: addedTrackingZoneOfBlockNum.map(trackingZone => trackingZone.metadata.originalBounds),
							});

							if (revertDecision.revert) {
								const errorMessage = revertDecision.errorMessage as 'Not found' | 'Not unique' | 'Has overlap'

								const content = this._errContentOfInvalidStr(errorMessage, block.orig)
								const retryMsg = 'All of your previous outputs have been ignored. Please re-output ALL SEARCH/REPLACE blocks starting from the first one, and avoid the error this time.'
								messages.push(
									{ role: 'assistant', content: fullText }, // latest output
									{ role: 'user', content: content + '\n' + retryMsg } // user explanation of what's wrong
								)

								// REVERT ALL BLOCKS
								currStreamingBlockNum = 0
								latestStreamLocationMutable = null
								shouldUpdateOrigStreamStyle = true
								oldBlocks = []
								for (const trackingZone of addedTrackingZoneOfBlockNum)
									this._deleteTrackingZone(trackingZone)
								addedTrackingZoneOfBlockNum.splice(0, Infinity)

								this._writeURIText(uri, originalFileCode, 'wholeFileRange', { shouldRealignDiffAreas: true })

								// abort and resolve
								shouldSendAnotherMessage = true
								if (streamRequestIdRef.current) {
									weAreAborting = true
									this._llmMessageService.abort(streamRequestIdRef.current)
									weAreAborting = false
								}
								diffZone._streamState.line = 1
								resMessageDonePromise()
								this._refreshStylesAndDiffsInURI(uri)
								return
							}

							// decideStreamRevert returns revert=true for every locate-error (string) originalBounds, so
							// past this point originalBounds is the located [start,end] tuple. Re-narrow for the compiler
							// (this branch is unreachable -- the revert block above already returned for the string case).
							if (typeof originalBounds === 'string') { return }

							const [startLine, endLine] = convertOriginalRangeToFinalRange(originalBounds)

							// console.log('---------adding-------')
							// console.log('CURRENT TEXT!!!', { current: model?.getValue(EndOfLinePreference.LF) })
							// console.log('block', deepClone(block))
							// console.log('origBounds', originalBounds)
							// console.log('start end', startLine, endLine)

							// otherwise if no error, add the position as a diffarea
							const adding: Omit<TrackingZone<SearchReplaceDiffAreaMetadata>, 'diffareaid'> = {
								type: 'TrackingZone',
								startLine: startLine,
								endLine: endLine,
								_URI: uri,
								metadata: {
									originalBounds: [...originalBounds],
									originalCode: block.orig,
								},
							}
							const trackingZone = this._addDiffArea(adding)
							addedTrackingZoneOfBlockNum.push(trackingZone)
							latestStreamLocationMutable = { line: startLine, addedSplitYet: false, col: 1, originalCodeStartLine: 1 }
						} // end adding diffarea


						// should always be in streaming state here
						if (!diffZone._streamState.isStreaming) {
							console.error('DiffZone was not in streaming state in _initializeSearchAndReplaceStream')
							continue
						}

						// if a block is done, finish it by writing all
						if (block.state === 'done') {
							const { startLine: finalStartLine, endLine: finalEndLine } = addedTrackingZoneOfBlockNum[blockNum]
							this._writeURIText(uri, block.final,
								{ startLineNumber: finalStartLine, startColumn: 1, endLineNumber: finalEndLine, endColumn: Number.MAX_SAFE_INTEGER }, // 1-indexed
								{ shouldRealignDiffAreas: true }
							)
							diffZone._streamState.line = finalEndLine + 1
							currStreamingBlockNum = blockNum + 1
							continue
						}

						// write the added text to the file
						if (!latestStreamLocationMutable) continue
						const oldBlock = oldBlocks[blockNum]
						const oldFinalLen = (oldBlock?.final ?? '').length
						const deltaFinalText = block.final.substring(oldFinalLen, Infinity)

						this._writeStreamedDiffZoneLLMText(uri, block.orig, block.final, deltaFinalText, latestStreamLocationMutable)
						oldBlocks = blocks // oldblocks is only used if writingFinal

						// const { endLine: currentEndLine } = addedTrackingZoneOfBlockNum[blockNum] // would be bad to do this because a lot of the bottom lines might be the same. more accurate to go with latestStreamLocationMutable
						// diffZone._streamState.line = currentEndLine
						diffZone._streamState.line = latestStreamLocationMutable.line

					} // end for

					this._refreshStylesAndDiffsInURI(uri)
				}

				streamRequestIdRef.current = this._llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					logging: { loggingName: `Edit (Search/Replace) - ${from}` },
					messages,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel,
					separateSystemMessage,
					chatMode: null, // not chat
					onText: (params) => {
						onText(params)
					},
					onFinalMessage: async (params) => {
						const { fullText } = params
						onText(params)

						const blocks = extractSearchReplaceBlocks(fullText)
						if (blocks.length === 0) {
				this._notificationService.info(`CortexIDE: We ran Fast Apply, but the LLM didn't output any changes.`)
						}
						this._writeURIText(uri, originalFileCode, 'wholeFileRange', { shouldRealignDiffAreas: true })


						try {
							this._instantlyApplySRBlocks(uri, fullText)
							onDone()
							resMessageDonePromise()
						}
						catch (e) {
							onError(e)
						}
					},
					onError: (e) => {
						onError(e)
					},
					onAbort: () => {
						if (weAreAborting) return
						// stop the loop to free up the promise, but don't modify state (already handled by whatever stopped it)
						aborted = true
						resMessageDonePromise()
					},
				})

				// should never happen, just for safety
				if (streamRequestIdRef.current === null) { break }

				await messageDonePromise
				if (aborted) {
					throw new Error(`Edit was interrupted by the user.`)
				}
			} // end while

		} // end retryLoop

		const applyDonePromise = new Promise<void>((res, rej) => { runSearchReplace().then(res).catch(rej) })
		return [diffZone, applyDonePromise]
	}


	_undoHistory(uri: URI) {
		this._undoRedoService.undo(uri)
	}



	isCtrlKZoneStreaming({ diffareaid }: { diffareaid: number }) {
		const ctrlKZone = this.diffAreaOfId[diffareaid]
		if (!ctrlKZone) return false
		if (ctrlKZone.type !== 'CtrlKZone') return false
		return !!ctrlKZone._linkedStreamingDiffZone
	}


	private _stopIfStreaming(diffZone: DiffZone) {
		const uri = diffZone._URI

		const streamRequestId = diffZone._streamState.streamRequestIdRef?.current
		if (!streamRequestId) return

		this._llmMessageService.abort(streamRequestId)

		diffZone._streamState = { isStreaming: false, }
		this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid })
	}


	// diffareaid of the ctrlKZone (even though the stream state is dictated by the linked diffZone)
	interruptCtrlKStreaming({ diffareaid }: { diffareaid: number }) {
		const ctrlKZone = this.diffAreaOfId[diffareaid]
		if (ctrlKZone?.type !== 'CtrlKZone') return
		if (!ctrlKZone._linkedStreamingDiffZone) return

		const linkedStreamingDiffZone = this.diffAreaOfId[ctrlKZone._linkedStreamingDiffZone]
		if (!linkedStreamingDiffZone) return
		if (linkedStreamingDiffZone.type !== 'DiffZone') return

		this._stopIfStreaming(linkedStreamingDiffZone)
		this._undoHistory(linkedStreamingDiffZone._URI)
	}


	interruptURIStreaming({ uri }: { uri: URI }) {
		if (!this._uriIsStreaming(uri)) return
		this._undoHistory(uri)
		// brute force for now is OK
		for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (diffArea?.type !== 'DiffZone') continue
			if (!diffArea._streamState.isStreaming) continue
			this._stopIfStreaming(diffArea)
		}
	}


	// public removeDiffZone(diffZone: DiffZone, behavior: 'reject' | 'accept') {
	// 	const uri = diffZone._URI
	// 	const { onFinishEdit } = this._addToHistory(uri)

	// 	if (behavior === 'reject') this._revertAndDeleteDiffZone(diffZone)
	// 	else if (behavior === 'accept') this._deleteDiffZone(diffZone)

	// 	this._refreshStylesAndDiffsInURI(uri)
	// 	onFinishEdit()
	// }

	private _revertDiffZone(diffZone: DiffZone) {
		const uri = diffZone._URI

		const writeText = diffZone.originalCode
		const toRange: IRange = { startLineNumber: diffZone.startLine, startColumn: 1, endLineNumber: diffZone.endLine, endColumn: Number.MAX_SAFE_INTEGER }
		this._writeURIText(uri, writeText, toRange, { shouldRealignDiffAreas: true })
	}


	// remove a batch of diffareas all at once (and handle accept/reject of their diffs)
	public acceptOrRejectAllDiffAreas: IEditCodeService['acceptOrRejectAllDiffAreas'] = async ({ uri, behavior, removeCtrlKs, _addToHistory }) => {

		const diffareaids = this.diffAreasOfURI[uri.fsPath]
		if ((diffareaids?.size ?? 0) === 0) return // do nothing

		const { onFinishEdit } = _addToHistory === false ? { onFinishEdit: () => { } } : this._addToHistory(uri)

		for (const diffareaid of diffareaids ?? []) {
			const diffArea = this.diffAreaOfId[diffareaid]
			if (!diffArea) continue

			if (diffArea.type === 'DiffZone') {
				if (behavior === 'reject') {
					this._revertDiffZone(diffArea)
					this._deleteDiffZone(diffArea)
				}
				else if (behavior === 'accept') {
					// Only accept enabled diffs
					const enabledDiffs = Object.values(diffArea._diffOfId).filter(d => d.enabled !== false);
					if (enabledDiffs.length === Object.keys(diffArea._diffOfId).length) {
						// All diffs are enabled, delete the zone (accept all)
						this._deleteDiffZone(diffArea)
					} else {
						// Accept only enabled diffs, reject disabled ones
						for (const diff of enabledDiffs) {
							await this.acceptDiff({ diffid: diff.diffid });
						}
						// Reject disabled diffs
						for (const diff of Object.values(diffArea._diffOfId)) {
							if (diff.enabled === false) {
								await this.rejectDiff({ diffid: diff.diffid });
							}
						}
					}
				}
			}
			else if (diffArea.type === 'CtrlKZone' && removeCtrlKs) {
				this._deleteCtrlKZone(diffArea)
			}
		}

		this._refreshStylesAndDiffsInURI(uri)
		onFinishEdit()
	}



	// called on void.acceptDiff
	public async acceptDiff({ diffid }: { diffid: number }) {

		// TODO could use an ITextModelto do this instead, would be much simpler

		const diff = this.diffOfId[diffid]
		if (!diff) return

		const { diffareaid } = diff
		const diffArea = this.diffAreaOfId[diffareaid]
		if (!diffArea) return

		if (diffArea.type !== 'DiffZone') return

		const uri = diffArea._URI

		// add to history
		const { onFinishEdit } = this._addToHistory(uri)

		// pure splice math (common/perHunkAccept.ts) -- fold the accepted hunk into the diff-area baseline
		const newOriginalCode = computeAcceptedOriginalCode(diffArea.originalCode, diff)

		// update code now accepted as original
		diffArea.originalCode = newOriginalCode

		// delete the diff
		this._deleteDiff(diff)

		// diffArea should be removed if it has no more diffs in it
		if (Object.keys(diffArea._diffOfId).length === 0) {
			this._deleteDiffZone(diffArea)
		}

		this._refreshStylesAndDiffsInURI(uri)

		onFinishEdit()

	}



	// called on void.toggleDiffEnabled
	public toggleDiffEnabled({ diffid, enabled }: { diffid: number; enabled: boolean }) {
		const diff = this.diffOfId[diffid];
		if (!diff) return;

		diff.enabled = enabled;

		// Refresh styles to update visual indication if needed
		const uri = this.diffAreaOfId[diff.diffareaid]?._URI;
		if (uri) {
			this._refreshStylesAndDiffsInURI(uri);
		}
	}

	// called on void.rejectDiff
	public async rejectDiff({ diffid }: { diffid: number }) {

		const diff = this.diffOfId[diffid]
		if (!diff) return

		const { diffareaid } = diff
		const diffArea = this.diffAreaOfId[diffareaid]
		if (!diffArea) return

		if (diffArea.type !== 'DiffZone') return

		const uri = diffArea._URI

		// add to history
		const { onFinishEdit } = this._addToHistory(uri)

		// pure write/range math (common/perHunkAccept.ts) -- compute the {text, range} that undoes the hunk.
		// The diff-area end line disambiguates the "hunk reaches the end of the zone" rounding cases.
		const { writeText, toRange } = computeRejectWrite(diff, diffArea.endLine)

		// update the file
		this._writeURIText(uri, writeText, toRange, { shouldRealignDiffAreas: true })

		// originalCode does not change!

		// delete the diff
		this._deleteDiff(diff)

		// diffArea should be removed if it has no more diffs in it
		if (Object.keys(diffArea._diffOfId).length === 0) {
			this._deleteDiffZone(diffArea)
		}

		this._refreshStylesAndDiffsInURI(uri)

		onFinishEdit()

	}

}

registerSingleton(IEditCodeService, EditCodeService, InstantiationType.Eager);




class AcceptRejectInlineWidget extends Widget implements IOverlayWidget {

	public getId(): string {
		return this.ID || ''; // Ensure we always return a string
	}
	public getDomNode(): HTMLElement {
		return this._domNode;
	}
	public getPosition() {
		return null;
	}

	private readonly _domNode: HTMLElement; // Using the definite assignment assertion
	private readonly editor: ICodeEditor;
	private readonly ID: string;
	private readonly startLine: number;

	constructor(
		{ editor, onAccept, onReject, onToggle, diffid, startLine, offsetLines, enabled }: {
			editor: ICodeEditor;
			onAccept: () => void;
			onReject: () => void;
			onToggle: (enabled: boolean) => void;
			diffid: string,
			startLine: number,
			offsetLines: number,
			enabled: boolean;
		},
		@ICortexideCommandBarService private readonly _cortexideCommandBarService: ICortexideCommandBarService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IEditCodeService private readonly _editCodeService: IEditCodeService,
	) {
		super();

		const uri = editor.getModel()?.uri;
		// Initialize with default values
		this.ID = ''
		this.editor = editor;
		this.startLine = startLine;

		if (!uri) {
			const { dummyDiv } = dom.h('div@dummyDiv');
			this._domNode = dummyDiv
			return;
		}

		this.ID = uri.fsPath + diffid;

		const lineHeight = editor.getOption(EditorOption.lineHeight);

		const getAcceptRejectText = () => {
			const acceptKeybinding = this._keybindingService.lookupKeybinding(CORTEXIDE_ACCEPT_DIFF_ACTION_ID);
			const rejectKeybinding = this._keybindingService.lookupKeybinding(CORTEXIDE_REJECT_DIFF_ACTION_ID);

			// Use the standalone function directly since we're in a nested class that
			// can't access EditCodeService's methods
			const acceptKeybindLabel = this._editCodeService.processRawKeybindingText(acceptKeybinding && acceptKeybinding.getLabel() || '');
			const rejectKeybindLabel = this._editCodeService.processRawKeybindingText(rejectKeybinding && rejectKeybinding.getLabel() || '');

			const commandBarStateAtUri = this._cortexideCommandBarService.stateOfURI[uri.fsPath];
			const selectedDiffIdx = commandBarStateAtUri?.diffIdx ?? 0; // 0th item is selected by default
			const thisDiffIdx = commandBarStateAtUri?.sortedDiffIds.indexOf(diffid) ?? null;

			const showLabel = thisDiffIdx === selectedDiffIdx

			const acceptText = `Accept${showLabel ? ` ` + acceptKeybindLabel : ''}`;
			const rejectText = `Reject${showLabel ? ` ` + rejectKeybindLabel : ''}`;

			return { acceptText, rejectText }
		}

		const { acceptText, rejectText } = getAcceptRejectText()

		// Create container div with checkbox and buttons
		const { checkbox, acceptButton, rejectButton, buttons } = dom.h('div@buttons', [
			dom.h('input@checkbox', { type: 'checkbox' }),
			dom.h('button@acceptButton', []),
			dom.h('button@rejectButton', [])
		]);

		// Style the container
		buttons.style.display = 'flex';
		buttons.style.position = 'absolute';
		buttons.style.gap = '4px';
		buttons.style.paddingRight = '4px';
		buttons.style.alignItems = 'center';
		buttons.style.zIndex = '1';
		buttons.style.transform = `translateY(${offsetLines * lineHeight}px)`;
		buttons.style.justifyContent = 'flex-end';
		buttons.style.width = '100%';
		buttons.style.pointerEvents = 'none';

		// Style checkbox for enable/disable toggle
		(checkbox as HTMLInputElement).checked = enabled;
		(checkbox as HTMLInputElement).title = 'Enable/disable this hunk';
		checkbox.style.cursor = 'pointer';
		checkbox.style.marginRight = '4px';
		checkbox.style.pointerEvents = 'auto';
		checkbox.onchange = () => {
			const isChecked = (checkbox as HTMLInputElement).checked;
			onToggle(isChecked);
		};

		// Style accept button
		acceptButton.onclick = onAccept;
		acceptButton.textContent = acceptText;
		acceptButton.style.backgroundColor = acceptBg;
		acceptButton.style.border = acceptBorder;
		acceptButton.style.color = buttonTextColor;
		acceptButton.style.fontSize = buttonFontSize;
		acceptButton.style.borderTop = 'none';
		acceptButton.style.padding = '1px 4px';
		acceptButton.style.borderBottomLeftRadius = '6px';
		acceptButton.style.borderBottomRightRadius = '6px';
		acceptButton.style.borderTopLeftRadius = '0';
		acceptButton.style.borderTopRightRadius = '0';
		acceptButton.style.cursor = 'pointer';
		acceptButton.style.height = '100%';
		acceptButton.style.boxShadow = '0 2px 3px rgba(0,0,0,0.2)';
		acceptButton.style.pointerEvents = 'auto';


		// Style reject button
		rejectButton.onclick = onReject;
		rejectButton.textContent = rejectText;
		rejectButton.style.backgroundColor = rejectBg;
		rejectButton.style.border = rejectBorder;
		rejectButton.style.color = buttonTextColor;
		rejectButton.style.fontSize = buttonFontSize;
		rejectButton.style.borderTop = 'none';
		rejectButton.style.padding = '1px 4px';
		rejectButton.style.borderBottomLeftRadius = '6px';
		rejectButton.style.borderBottomRightRadius = '6px';
		rejectButton.style.borderTopLeftRadius = '0';
		rejectButton.style.borderTopRightRadius = '0';
		rejectButton.style.cursor = 'pointer';
		rejectButton.style.height = '100%';
		rejectButton.style.boxShadow = '0 2px 3px rgba(0,0,0,0.2)';
		rejectButton.style.pointerEvents = 'auto';



		this._domNode = buttons;

		const updateTop = () => {
			const topPx = editor.getTopForLineNumber(this.startLine) - editor.getScrollTop()
			this._domNode.style.top = `${topPx}px`
		}
		const updateLeft = () => {
			const layoutInfo = editor.getLayoutInfo();
			const minimapWidth = layoutInfo.minimap.minimapWidth;
			const verticalScrollbarWidth = layoutInfo.verticalScrollbarWidth;
			const buttonWidth = this._domNode.offsetWidth;

			const leftPx = layoutInfo.width - minimapWidth - verticalScrollbarWidth - buttonWidth;
			this._domNode.style.left = `${leftPx}px`;
		}

		// Mount first, then update positions
		setTimeout(() => {
			updateTop()
			updateLeft()
		}, 0)

		this._register(editor.onDidScrollChange(e => { updateTop() }))
		this._register(editor.onDidChangeModelContent(e => { updateTop() }))
		this._register(editor.onDidLayoutChange(e => { updateTop(); updateLeft() }))


		// Listen for state changes in the command bar service
		this._register(this._cortexideCommandBarService.onDidChangeState(e => {
			if (uri && e.uri.fsPath === uri.fsPath) {

				const { acceptText, rejectText } = getAcceptRejectText()

				acceptButton.textContent = acceptText;
				rejectButton.textContent = rejectText;

			}
		}));

		// Listen for diff enable/disable state changes
		const updateCheckbox = () => {
			const diff = this._editCodeService.diffOfId[parseInt(diffid)];
			if (diff) {
				(checkbox as HTMLInputElement).checked = diff.enabled !== false;
			}
		};
		// Update checkbox when diffs change - listen to diff change events
		this._register(this._editCodeService.onDidChangeDiffsInDiffZoneNotStreaming(e => {
			const diff = this._editCodeService.diffOfId[parseInt(diffid)];
			if (diff && e.uri.fsPath === uri?.fsPath && e.diffareaid === diff.diffareaid) {
				updateCheckbox();
			}
		}));
		// Also update on initial mount
		updateCheckbox();

		// mount this widget

		editor.addOverlayWidget(this);
		// console.log('created elt', this._domNode)
	}

	public override dispose(): void {
		this.editor.removeOverlayWidget(this);
		super.dispose();
	}

}





