/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ButtonBar } from '../../../../../base/browser/ui/button/button.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IViewletViewOptions } from '../../../../browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../../browser/parts/views/viewPane.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, IContextKey, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IDialogService, IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IChatEditingService, IChatEditingSession, IModifiedFileEntry, chatEditingMaxFileAssignmentName, defaultChatEditingMaxFileLimit } from '../../common/editing/chatEditingService.js';
import { IChatService, ChatSendResult } from '../../common/chatService/chatService.js';
import { IChatRequestVariableEntry } from '../../common/attachments/chatVariableEntries.js';
import { ChatModel } from '../../common/model/chatModel.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { IChatAgentService } from '../../common/participants/chatAgents.js';
import { observableValue, autorun } from '../../../../../base/common/observable.js';
import Severity from '../../../../../base/common/severity.js';
import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { FocusedViewContext } from '../../../../common/contextkeys.js';
import { MenuId, Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { getWorkspaceSymbols, IWorkspaceSymbol } from '../../../search/common/search.js';
import { ISearchService } from '../../../../services/search/common/search.js';
import { QueryBuilder } from '../../../../services/search/common/queryBuilder.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IRepoIndexerService } from '../../../cortexide/browser/repoIndexerService.js';
import { DetailedLineRangeMapping } from '../../../../../editor/common/diff/rangeMapping.js';
import { ComposerUnifiedDiffView } from './composerUnifiedDiffView.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { diffComposerAudit } from '../../../cortexide/common/diffComposerAudit.js';
import { IAuditLogService } from '../../../cortexide/common/auditLogService.js';
import { IRollbackSnapshotService } from '../../../cortexide/common/rollbackSnapshotService.js';
import { IApplyEngineV2, FileEditOperation } from '../../../cortexide/common/applyEngineV2.js';
import { EndOfLinePreference } from '../../../../../editor/common/model.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import './composerPanel.css';

type TimerHandle = ReturnType<typeof setTimeout>;

export class ComposerPanel extends ViewPane {
	static readonly ID = 'chatComposer';
	static readonly ctxHasProposals = new RawContextKey('composer.hasProposals', false);
	static readonly ctxCanApply = new RawContextKey('composer.canApply', false);
	static readonly ctxIsGenerating = new RawContextKey('composer.isGenerating', false);

	private readonly _ctxHasProposals: IContextKey<boolean>;
	private readonly _ctxCanApply: IContextKey<boolean>;
	private readonly _ctxIsGenerating: IContextKey<boolean>;

	private readonly _disposables = new DisposableStore();
	private readonly _sessionDisposables = new DisposableStore();

	private _currentSession: IChatEditingSession | undefined;
	private _scopeURIs = observableValue<URI[]>(this, []);
	private _scopeItems = observableValue<Array<{ uri: URI; type: 'file' | 'folder' | 'symbol' | 'glob'; label: string }>>(this, []);
	private _goal = observableValue<string>(this, '');
	private _isGenerating = observableValue<boolean>(this, false);
	private _isAgentMode = observableValue<boolean>(this, false);
	private _isAutoDiscovering = observableValue<boolean>(this, false);
	private _cancellationTokenSource: CancellationTokenSource | undefined;
	private _unifiedDiffView: ComposerUnifiedDiffView | undefined;
	private _summaryStats = observableValue<{ filesChanged: number; linesAdded: number; linesRemoved: number; hunks: number } | undefined>(this, undefined);
	private _hasAgent = observableValue<boolean>(this, false);
	// Cache for computed diffs in summary stats to avoid recomputing for unchanged files
	// Key: entryId + originalVersion + modifiedVersion
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly _summaryDiffCache = new Map<string, Promise<{ diff: any; originalVersion: number; modifiedVersion: number }>>();

	constructor(
		options: IViewletViewOptions,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IChatEditingService private readonly _chatEditingService: IChatEditingService,
		@IChatService private readonly _chatService: IChatService,
		@IChatAgentService private readonly _chatAgentService: IChatAgentService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@ILabelService private readonly _labelService: ILabelService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@ISearchService private readonly _searchService: ISearchService,
		@IRepoIndexerService private readonly _repoIndexerService: IRepoIndexerService,
		@IEditorWorkerService private readonly _editorWorkerService: IEditorWorkerService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@IAuditLogService private readonly _auditLogService: IAuditLogService,
		@IFileService private readonly _fileService: IFileService,
	) {
		super(
			{ ...options, titleMenuId: MenuId.ViewTitle },
			keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, hoverService
		);

		// Ensure the main element has proper styling
		this.element.classList.add('chat-composer-panel');
		this.element.style.display = 'flex';
		this.element.style.flexDirection = 'column';

		this._ctxHasProposals = ComposerPanel.ctxHasProposals.bindTo(contextKeyService);
		this._ctxCanApply = ComposerPanel.ctxCanApply.bindTo(contextKeyService);
		this._ctxIsGenerating = ComposerPanel.ctxIsGenerating.bindTo(contextKeyService);

		// Check agent availability
		this._updateAgentAvailability();

		// Observe agent changes
		this._register(this._chatAgentService.onDidChangeAgents(() => {
			this._updateAgentAvailability();
		}));

		// Observe scope and update context keys
		this._register(autorun(reader => {
			const hasProposals = this._currentSession !== undefined && this._currentSession.entries.read(reader).length > 0;
			const isGenerating = this._isGenerating.read(reader);

			this._ctxHasProposals.set(hasProposals);
			this._ctxIsGenerating.set(isGenerating);
			this._ctxCanApply.set(hasProposals && !isGenerating);
		}));
	}

	private _updateAgentAvailability(): void {
		// Check for both activated agent and contributed agent (may not be activated yet)
		const hasActivatedAgent = !!this._chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
		const hasContributedAgent = !!this._chatAgentService.getContributedDefaultAgent(ChatAgentLocation.Chat);
		this._hasAgent.set(hasActivatedAgent || hasContributedAgent, undefined);
	}

	override dispose(): void {
		this._summaryDiffCache.clear();
		this._disposables.dispose();
		this._sessionDisposables.dispose();
		super.dispose();
	}

	protected override renderBody(parent: HTMLElement): void {
		try {
			super.renderBody(parent);

			// Ensure parent has proper layout
			parent.classList.add('chat-composer-panel-body');
			parent.style.display = 'flex';
			parent.style.flexDirection = 'column';
			parent.style.height = '100%';
			parent.style.minHeight = '0'; // Allow flex shrinking
			parent.style.overflowY = 'auto';

			// Debug: Add a visible test element first
			const testDiv = document.createElement('div');
			testDiv.textContent = 'Composer Panel Loading...';
			testDiv.style.padding = '20px';
			testDiv.style.color = 'var(--vscode-foreground)';
			testDiv.style.border = '1px solid var(--vscode-panel-border)';
			testDiv.style.margin = '10px';
			parent.appendChild(testDiv);

			// Mode toggle section (Agent Mode vs Normal Mode)
			const modeSection = document.createElement('div');
			modeSection.className = 'composer-mode-section';
			parent.appendChild(modeSection);

			const modeLabel = document.createElement('label');
			modeLabel.className = 'composer-mode-label';
			modeLabel.textContent = localize('composer.mode', "Mode:");
			modeSection.appendChild(modeLabel);

			const modeToggleContainer = document.createElement('div');
			modeToggleContainer.className = 'composer-mode-toggle';
			modeToggleContainer.setAttribute('role', 'group');
			modeToggleContainer.setAttribute('aria-label', localize('composer.modeGroup', "Composer mode selection"));
			modeSection.appendChild(modeToggleContainer);

			const normalModeBtn = document.createElement('button');
			normalModeBtn.className = 'composer-mode-btn';
			normalModeBtn.textContent = localize('composer.normalMode', "Normal");
			normalModeBtn.setAttribute('aria-label', localize('composer.normalModeAria', "Normal mode: manually select files"));
			normalModeBtn.setAttribute('role', 'radio');
			normalModeBtn.setAttribute('aria-checked', 'true');
			normalModeBtn.setAttribute('tabindex', '0');
			modeToggleContainer.appendChild(normalModeBtn);

			const agentModeBtn = document.createElement('button');
			agentModeBtn.className = 'composer-mode-btn';
			agentModeBtn.textContent = localize('composer.agentMode', "Agent");
			agentModeBtn.setAttribute('aria-label', localize('composer.agentModeAria', "Agent mode: automatically discover relevant files"));
			agentModeBtn.setAttribute('role', 'radio');
			agentModeBtn.setAttribute('aria-checked', 'false');
			agentModeBtn.setAttribute('tabindex', '-1');
			modeToggleContainer.appendChild(agentModeBtn);

			// Update mode buttons reactively
			this._register(autorun(reader => {
				const isAgentMode = this._isAgentMode.read(reader);
				if (isAgentMode) {
					normalModeBtn.classList.remove('active');
					agentModeBtn.classList.add('active');
					normalModeBtn.setAttribute('aria-checked', 'false');
					agentModeBtn.setAttribute('aria-checked', 'true');
					normalModeBtn.setAttribute('tabindex', '-1');
					agentModeBtn.setAttribute('tabindex', '0');
				} else {
					normalModeBtn.classList.add('active');
					agentModeBtn.classList.remove('active');
					normalModeBtn.setAttribute('aria-checked', 'true');
					agentModeBtn.setAttribute('aria-checked', 'false');
					normalModeBtn.setAttribute('tabindex', '0');
					agentModeBtn.setAttribute('tabindex', '-1');
				}
			}));

			normalModeBtn.onclick = () => this._isAgentMode.set(false, undefined);
			agentModeBtn.onclick = () => this._isAgentMode.set(true, undefined);

			// Scope selector section
			const scopeSection = document.createElement('div');
			scopeSection.className = 'composer-scope-section';
			scopeSection.setAttribute('role', 'region');
			scopeSection.setAttribute('aria-label', localize('composer.scopeRegion', "Refactoring scope selection"));
			parent.appendChild(scopeSection);

			const scopeHeader = document.createElement('div');
			scopeHeader.className = 'composer-scope-header';
			scopeSection.appendChild(scopeHeader);

			const scopeLabel = document.createElement('label');
			scopeLabel.textContent = localize('composer.scope', "Scope:");
			scopeLabel.className = 'composer-label';
			scopeHeader.appendChild(scopeLabel);

			const scopeIndicator = document.createElement('div');
			scopeIndicator.className = 'composer-scope-indicator';
			scopeHeader.appendChild(scopeIndicator);

			// Update scope indicator reactively
			this._register(autorun(reader => {
				const items = this._scopeItems.read(reader);
				const isAgentMode = this._isAgentMode.read(reader);
				const isAutoDiscovering = this._isAutoDiscovering.read(reader);

				if (isAutoDiscovering) {
					scopeIndicator.textContent = localize('composer.discovering', "Discovering files...");
				} else if (isAgentMode && items.length === 0) {
					scopeIndicator.textContent = localize('composer.agentModeHint', "Enter goal to auto-discover files");
				} else {
					scopeIndicator.textContent = items.length === 0
						? localize('composer.noScope', "No files selected")
						: localize('composer.scopeCount', "{0} item{1} selected", items.length, items.length === 1 ? '' : 's');
				}
			}));

			// Scope action buttons
			const scopeActions = document.createElement('div');
			scopeActions.className = 'composer-scope-actions';
			scopeSection.appendChild(scopeActions);

			const btnAddFile = document.createElement('button');
			btnAddFile.className = 'composer-scope-btn';
			btnAddFile.textContent = localize('composer.addFile', "Add File");
			btnAddFile.setAttribute('aria-label', localize('composer.addFileAria', "Add files to refactoring scope"));
			btnAddFile.setAttribute('tabindex', '0');
			btnAddFile.onclick = () => this.addFiles();
			scopeActions.appendChild(btnAddFile);

			const btnAddFolder = document.createElement('button');
			btnAddFolder.className = 'composer-scope-btn';
			btnAddFolder.textContent = localize('composer.addFolder', "Add Folder");
			btnAddFolder.setAttribute('aria-label', localize('composer.addFolderAria', "Add folder to refactoring scope"));
			btnAddFolder.onclick = () => this.addFolder();
			scopeActions.appendChild(btnAddFolder);

			const btnAddSymbol = document.createElement('button');
			btnAddSymbol.className = 'composer-scope-btn';
			btnAddSymbol.textContent = localize('composer.addSymbol', "Add Symbol");
			btnAddSymbol.setAttribute('aria-label', localize('composer.addSymbolAria', "Add symbol to refactoring scope"));
			btnAddSymbol.onclick = () => this.addSymbol();
			scopeActions.appendChild(btnAddSymbol);

			const btnAddGlob = document.createElement('button');
			btnAddGlob.className = 'composer-scope-btn';
			btnAddGlob.textContent = localize('composer.addGlob', "Add Glob");
			btnAddGlob.setAttribute('aria-label', localize('composer.addGlobAria', "Add glob pattern to refactoring scope"));
			btnAddGlob.onclick = () => this.addGlobPattern();
			scopeActions.appendChild(btnAddGlob);

			const btnBrowseWorkspace = document.createElement('button');
			btnBrowseWorkspace.className = 'composer-scope-btn composer-scope-btn-primary';
			btnBrowseWorkspace.textContent = localize('composer.browseWorkspace', "Browse Workspace");
			btnBrowseWorkspace.setAttribute('aria-label', localize('composer.browseWorkspaceAria', "Browse workspace to select files and folders"));
			btnBrowseWorkspace.onclick = () => this.browseWorkspace();
			scopeActions.appendChild(btnBrowseWorkspace);

			const btnClear = document.createElement('button');
			btnClear.className = 'composer-scope-btn';
			btnClear.textContent = localize('composer.clear', "Clear");
			btnClear.setAttribute('aria-label', localize('composer.clearAria', "Clear all items from scope"));
			btnClear.onclick = () => this.clearScope();
			scopeActions.appendChild(btnClear);

			// Scope items list
			const scopeList = document.createElement('div');
			scopeList.className = 'composer-scope-list';
			scopeSection.appendChild(scopeList);

			// Show/hide manual scope controls based on mode (moved here after scopeActions and scopeList are declared)
			this._register(autorun(reader => {
				const isAgentMode = this._isAgentMode.read(reader);
				if (isAgentMode) {
					scopeActions.style.display = 'none';
					scopeList.style.display = 'none';
				} else {
					scopeActions.style.display = 'flex';
					scopeList.style.display = 'block';
				}
			}));

			this._register(autorun(reader => {
				const items = this._scopeItems.read(reader);
				// Clear existing items safely
				while (scopeList.firstChild) {
					scopeList.removeChild(scopeList.firstChild);
				}

				items.forEach((item, index) => {
					const itemEl = document.createElement('div');
					itemEl.className = 'composer-scope-item';

					const labelSpan = document.createElement('span');
					labelSpan.className = 'composer-scope-item-label';
					labelSpan.textContent = item.label;
					itemEl.appendChild(labelSpan);

					const typeSpan = document.createElement('span');
					typeSpan.className = 'composer-scope-item-type';
					typeSpan.textContent = item.type;
					itemEl.appendChild(typeSpan);

					const removeBtn = document.createElement('button');
					removeBtn.className = 'composer-scope-item-remove';
					removeBtn.textContent = '×';
					removeBtn.setAttribute('data-index', index.toString());
					removeBtn.onclick = () => this.removeScopeItem(index);
					itemEl.appendChild(removeBtn);

					scopeList.appendChild(itemEl);
				});
			}));

			// Goal input section
			const goalSection = document.createElement('div');
			goalSection.className = 'composer-goal-section';
			parent.appendChild(goalSection);

			const goalLabel = document.createElement('label');
			goalLabel.textContent = localize('composer.goal', "Refactoring goal:");
			goalLabel.className = 'composer-label';
			goalSection.appendChild(goalLabel);

			const goalInput = document.createElement('textarea');
			goalInput.className = 'composer-goal-input';
			goalInput.placeholder = localize('composer.goalPlaceholder', "e.g., Convert callbacks to async/await");
			goalInput.rows = 3;
			goalInput.setAttribute('aria-label', localize('composer.goalAria', "Refactoring goal description"));
			goalInput.setAttribute('aria-describedby', 'composer-goal-description');
			goalSection.appendChild(goalInput);

			// Update goal and placeholder reactively
			this._register(autorun(reader => {
				const goal = this._goal.read(reader);
				const isAgentMode = this._isAgentMode.read(reader);
				if (goalInput.value !== goal) {
					goalInput.value = goal;
				}
				// Update placeholder based on mode
				if (isAgentMode) {
					goalInput.placeholder = localize('composer.goalPlaceholderAgent', "e.g., Convert callbacks to async/await (Agent will discover relevant files)");
				} else {
					goalInput.placeholder = localize('composer.goalPlaceholder', "e.g., Convert callbacks to async/await");
				}
			}));

			let autoDiscoverTimeout: TimerHandle | undefined;
			goalInput.addEventListener('input', () => {
				this._goal.set(goalInput.value, undefined);

				// Auto-discover in Agent Mode when goal is entered (debounced)
				const isAgentMode = this._isAgentMode.get();
				if (autoDiscoverTimeout) {
					clearTimeout(autoDiscoverTimeout);
				}

				if (isAgentMode && goalInput.value.trim().length > 10) {
					autoDiscoverTimeout = setTimeout(() => {
						if (goalInput.value.trim().length > 10 && this._isAgentMode.get()) {
							this._autoDiscoverFiles(goalInput.value.trim());
						}
					}, 1500);
				}
			});

			// Agent availability warning
			const agentWarningContainer = document.createElement('div');
			agentWarningContainer.className = 'composer-agent-warning';
			agentWarningContainer.style.display = 'none';
			agentWarningContainer.style.padding = '12px';
			agentWarningContainer.style.margin = '10px 0';
			agentWarningContainer.style.backgroundColor = 'var(--vscode-inputValidation-warningBackground)';
			agentWarningContainer.style.border = '1px solid var(--vscode-inputValidation-warningBorder)';
			agentWarningContainer.style.borderRadius = '4px';
			parent.appendChild(agentWarningContainer);

			const agentWarningText = document.createElement('div');
			agentWarningText.style.color = 'var(--vscode-inputValidation-warningForeground)';
			agentWarningText.textContent = localize('composer.noAgentWarning', "No chat agent is available. Please install a chat agent extension to generate proposals.");
			agentWarningContainer.appendChild(agentWarningText);

			// Show/hide agent warning
			this._register(autorun(reader => {
				const hasAgent = this._hasAgent.read(reader);
				agentWarningContainer.style.display = hasAgent ? 'none' : 'block';
			}));

			// Action buttons
			const buttonsContainer = document.createElement('div');
			buttonsContainer.className = 'composer-buttons';
			parent.appendChild(buttonsContainer);
			const buttonBar = new ButtonBar(buttonsContainer);
			this._disposables.add(buttonBar);

			const btnGenerate = buttonBar.addButton({ supportIcons: true, ...defaultButtonStyles });
			btnGenerate.label = localize('composer.generate', "Generate Proposals");
			btnGenerate.enabled = false;
			btnGenerate.onDidClick(() => this.generateProposals(), this, this._disposables);

			// Enable generate button when scope and goal are set (or in Agent Mode with goal) AND agent is available
			this._register(autorun(reader => {
				const goalText = this._goal.read(reader);
				const isAgentMode = this._isAgentMode.read(reader);
				const hasScope = this._scopeItems.read(reader).length > 0;
				const isGenerating = this._isGenerating.read(reader);
				const hasAgent = this._hasAgent.read(reader);

				// In Agent Mode, only need goal (auto-discovery will handle scope)
				// In Normal Mode, need both scope and goal
				// Also require an agent to be available
				btnGenerate.enabled = hasAgent && goalText.trim().length > 0 && (isAgentMode || hasScope) && !isGenerating;
			}));

			const btnApplyAll = buttonBar.addButton({ supportIcons: true, ...defaultButtonStyles });
			btnApplyAll.label = localize('composer.applyAll', "Apply All");
			btnApplyAll.onDidClick(() => this.applyAll(), this, this._disposables);

			const btnRejectAll = buttonBar.addButton({ ...defaultButtonStyles, secondary: true });
			btnRejectAll.label = localize('composer.rejectAll', "Reject All");
			btnRejectAll.onDidClick(() => this.rejectAll(), this, this._disposables);

			const btnUndo = buttonBar.addButton({ ...defaultButtonStyles, secondary: true });
			btnUndo.label = localize('composer.undo', "Undo");
			btnUndo.onDidClick(() => this.undo(), this, this._disposables);

			const btnRedo = buttonBar.addButton({ ...defaultButtonStyles, secondary: true });
			btnRedo.label = localize('composer.redo', "Redo");
			btnRedo.onDidClick(() => this.redo(), this, this._disposables);

			// Enable/disable buttons based on state
			this._register(autorun(reader => {
				const hasProposals = this._currentSession !== undefined && this._currentSession.entries.read(reader).length > 0;
				const isGenerating = this._isGenerating.read(reader);
				const canUndo = this._currentSession?.canUndo.read(reader) ?? false;
				const canRedo = this._currentSession?.canRedo.read(reader) ?? false;

				btnApplyAll.enabled = hasProposals && !isGenerating;
				btnRejectAll.enabled = hasProposals && !isGenerating;
				btnUndo.enabled = canUndo && !isGenerating;
				btnRedo.enabled = canRedo && !isGenerating;
			}));

			// Progress indicator
			const progressContainer = document.createElement('div');
			progressContainer.className = 'composer-progress';
			progressContainer.style.display = 'none';
			parent.appendChild(progressContainer);

			this._register(autorun(reader => {
				const isGenerating = this._isGenerating.read(reader);
				const isAutoDiscovering = this._isAutoDiscovering.read(reader);
				progressContainer.style.display = (isGenerating || isAutoDiscovering) ? 'block' : 'none';
				if (isGenerating) {
					progressContainer.textContent = localize('composer.generating', "Generating proposals...");
				} else if (isAutoDiscovering) {
					// eslint-disable-next-line local/code-no-unexternalized-strings
					progressContainer.textContent = localize('composer.discovering', "Discovering relevant files...");
				}
			}));

			// Preview Summary Section (collapsible)
			const summarySection = document.createElement('div');
			summarySection.className = 'composer-summary-section';
			summarySection.style.display = 'none';
			parent.appendChild(summarySection);

			const summaryHeader = document.createElement('div');
			summaryHeader.className = 'composer-summary-header';
			summarySection.appendChild(summaryHeader);

			const summaryToggle = document.createElement('button');
			summaryToggle.className = 'composer-summary-toggle';
			summaryToggle.setAttribute('aria-expanded', 'false');
			summaryHeader.appendChild(summaryToggle);

			const summaryTitle = document.createElement('span');
			summaryTitle.className = 'composer-summary-title';
			summaryTitle.textContent = localize('composer.summary', "Summary");
			summaryHeader.appendChild(summaryTitle);

			const summaryContent = document.createElement('div');
			summaryContent.className = 'composer-summary-content';
			summarySection.appendChild(summaryContent);

			let summaryExpanded = false;
			summaryToggle.onclick = () => {
				summaryExpanded = !summaryExpanded;
				summaryToggle.setAttribute('aria-expanded', summaryExpanded.toString());
				summaryContent.style.display = summaryExpanded ? 'block' : 'none';
				// allow-any-unicode-next-line
				summaryToggle.textContent = summaryExpanded ? '▼' : '▶';
			};
			// allow-any-unicode-next-line
			summaryToggle.textContent = '▶';

			// Update summary content reactively
			this._register(autorun(reader => {
				const stats = this._summaryStats.read(reader);
				const hasProposals = this._currentSession !== undefined && this._currentSession.entries.read(reader).length > 0;

				if (stats && hasProposals) {
					summarySection.style.display = 'block';
					// Clear existing content safely
					while (summaryContent.firstChild) {
						summaryContent.removeChild(summaryContent.firstChild);
					}

					// Files changed stat
					const filesStat = document.createElement('div');
					filesStat.className = 'composer-summary-stat';
					const filesLabel = document.createElement('span');
					filesLabel.className = 'composer-summary-label';
					filesLabel.textContent = localize('composer.filesChanged', "Files changed:");
					const filesValue = document.createElement('span');
					filesValue.className = 'composer-summary-value';
					filesValue.textContent = stats.filesChanged.toString();
					filesStat.appendChild(filesLabel);
					filesStat.appendChild(filesValue);
					summaryContent.appendChild(filesStat);

					// Lines added stat
					const addedStat = document.createElement('div');
					addedStat.className = 'composer-summary-stat';
					const addedLabel = document.createElement('span');
					addedLabel.className = 'composer-summary-label';
					addedLabel.textContent = localize('composer.linesAdded', "Lines added:");
					const addedValue = document.createElement('span');
					addedValue.className = 'composer-summary-value composer-summary-added';
					addedValue.textContent = `+${stats.linesAdded}`;
					addedStat.appendChild(addedLabel);
					addedStat.appendChild(addedValue);
					summaryContent.appendChild(addedStat);

					// Lines removed stat
					const removedStat = document.createElement('div');
					removedStat.className = 'composer-summary-stat';
					const removedLabel = document.createElement('span');
					removedLabel.className = 'composer-summary-label';
					removedLabel.textContent = localize('composer.linesRemoved', "Lines removed:");
					const removedValue = document.createElement('span');
					removedValue.className = 'composer-summary-value composer-summary-removed';
					removedValue.textContent = `-${stats.linesRemoved}`;
					removedStat.appendChild(removedLabel);
					removedStat.appendChild(removedValue);
					summaryContent.appendChild(removedStat);

					// Hunks stat
					const hunksStat = document.createElement('div');
					hunksStat.className = 'composer-summary-stat';
					const hunksLabel = document.createElement('span');
					hunksLabel.className = 'composer-summary-label';
					hunksLabel.textContent = localize('composer.hunks', "Hunks:");
					const hunksValue = document.createElement('span');
					hunksValue.className = 'composer-summary-value';
					hunksValue.textContent = stats.hunks.toString();
					hunksStat.appendChild(hunksLabel);
					hunksStat.appendChild(hunksValue);
					summaryContent.appendChild(hunksStat);

					// Plan Preview: File list
					const planPreview = document.createElement('div');
					planPreview.className = 'composer-plan-preview';
					const planPreviewTitle = document.createElement('div');
					planPreviewTitle.className = 'composer-plan-preview-title';
					planPreviewTitle.textContent = localize('composer.planPreview', "Files to be changed:");
					planPreview.appendChild(planPreviewTitle);

					const fileList = document.createElement('ul');
					fileList.className = 'composer-plan-file-list';
					const entries = this._currentSession!.entries.read(reader);
					for (const entry of entries) {
						const fileItem = document.createElement('li');
						fileItem.className = 'composer-plan-file-item';
						const fileName = document.createElement('span');
						fileName.className = 'composer-plan-file-name';
						fileName.textContent = this._labelService.getUriLabel(entry.modifiedURI, { relative: true });
						fileItem.appendChild(fileName);

						const changeCount = entry.changesCount.read(reader);
						if (changeCount > 0) {
							const changeBadge = document.createElement('span');
							changeBadge.className = 'composer-plan-file-changes';
							changeBadge.textContent = `${changeCount} change${changeCount === 1 ? '' : 's'}`;
							fileItem.appendChild(changeBadge);
						}

						fileList.appendChild(fileItem);
					}
					planPreview.appendChild(fileList);
					summaryContent.appendChild(planPreview);
				} else {
					summarySection.style.display = 'none';
				}
			}));

			// Proposals display area - unified diff view
			const proposalsContainer = document.createElement('div');
			proposalsContainer.className = 'composer-proposals';
			parent.appendChild(proposalsContainer);

			// Update unified diff view when session changes
			this._register(autorun(reader => {
				const session = this._currentSession;
				if (session && !this._unifiedDiffView) {
					this._unifiedDiffView = this._instantiationService.createInstance(
						ComposerUnifiedDiffView,
						proposalsContainer,
						session,
						(entry: IModifiedFileEntry, hunk: DetailedLineRangeMapping, enabled: boolean) => {
							this._onHunkToggle(entry, hunk, enabled);
							this._calculateSummaryStats().catch(err => console.debug('Error updating stats:', err)); // Update stats when hunks are toggled
						}
					);
					this._register(this._unifiedDiffView);
					// Calculate initial stats
					this._calculateSummaryStats().catch(err => console.debug('Error calculating initial stats:', err));
				} else if (!session && this._unifiedDiffView) {
					this._unifiedDiffView.dispose();
					this._unifiedDiffView = undefined;
					this._summaryStats.set(undefined, undefined);
				}
			}));

			// Update summary stats when entries change
			this._register(autorun(reader => {
				if (this._currentSession) {
					this._currentSession.entries.read(reader);
					// Trigger stats recalculation
					this._calculateSummaryStats().catch(err => console.debug('Error recalculating stats:', err));
				}
			}));

			// Remove test div once everything is loaded
			setTimeout(() => {
				if (testDiv.parentNode) {
					testDiv.remove();
				}
			}, 100);
		} catch (error) {
			console.error('Error rendering ComposerPanel:', error);
			const errorDiv = document.createElement('div');
			errorDiv.style.padding = '20px';
			errorDiv.style.color = 'var(--vscode-errorForeground)';
			errorDiv.style.backgroundColor = 'var(--vscode-inputValidation-errorBackground)';
			errorDiv.style.border = '1px solid var(--vscode-inputValidation-errorBorder)';
			errorDiv.style.margin = '10px';

			const strong = document.createElement('strong');
			strong.textContent = 'Error loading Composer:';
			errorDiv.appendChild(strong);

			const br1 = document.createElement('br');
			errorDiv.appendChild(br1);

			const errorText = document.createTextNode(String(error));
			errorDiv.appendChild(errorText);

			const br2 = document.createElement('br');
			errorDiv.appendChild(br2);
			const br3 = document.createElement('br');
			errorDiv.appendChild(br3);

			const detailsText = document.createTextNode('Check console for details.');
			errorDiv.appendChild(detailsText);

			parent.appendChild(errorDiv);
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
	}

	setScope(uris: URI[]): void {
		this._scopeURIs.set(uris, undefined);
		// Update scope items from URIs
		const items = uris.map(uri => ({
			uri,
			type: 'file' as const,
			label: this._labelService.getUriLabel(uri, { relative: true })
		}));
		this._scopeItems.set(items, undefined);
	}

	setGoal(goal: string): void {
		this._goal.set(goal, undefined);
	}

	async addFiles(): Promise<void> {
		const uris = await this._fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			openLabel: localize('composer.selectFiles', "Add Files")
		});

		if (uris && uris.length > 0) {
			// Validate all files are within workspace
			const outsideWorkspace: URI[] = [];
			const insideWorkspace: URI[] = [];

			for (const uri of uris) {
				if (this._workspaceContextService.isInsideWorkspace(uri)) {
					insideWorkspace.push(uri);
				} else {
					outsideWorkspace.push(uri);
				}
			}

			// Warn if any files are outside workspace
			if (outsideWorkspace.length > 0) {
				const outsidePaths = outsideWorkspace.map(u => this._labelService.getUriLabel(u, { relative: false })).join('\n');
				await this._dialogService.confirm({
					type: Severity.Warning,
					message: localize('composer.filesOutsideWorkspace', "Files Outside Workspace"),
					detail: localize('composer.filesOutsideWorkspaceDetail',
						"The following {0} file(s) are outside your workspace:\n\n{1}\n\nFor safety, only files within the workspace can be included in refactoring operations. These files will be excluded.",
						outsideWorkspace.length, outsidePaths),
					primaryButton: localize('ok', "OK"),
				});
			}

			// Only add files within workspace
			if (insideWorkspace.length > 0) {
				const currentItems = this._scopeItems.get();
				const newItems = insideWorkspace.map(uri => ({
					uri,
					type: 'file' as const,
					label: this._labelService.getUriLabel(uri, { relative: true })
				}));
				this._scopeItems.set([...currentItems, ...newItems], undefined);
				this._updateScopeURIs();
			}
		}
	}

	async addFolder(): Promise<void> {
		const uris = await this._fileDialogService.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: true,
			openLabel: localize('composer.selectFolder', "Add Folder")
		});

		if (uris && uris.length > 0) {
			// Validate all folders are within workspace
			const outsideWorkspace: URI[] = [];
			const insideWorkspace: URI[] = [];

			for (const uri of uris) {
				if (this._workspaceContextService.isInsideWorkspace(uri)) {
					insideWorkspace.push(uri);
				} else {
					outsideWorkspace.push(uri);
				}
			}

			// Warn if any folders are outside workspace
			if (outsideWorkspace.length > 0) {
				const outsidePaths = outsideWorkspace.map(u => this._labelService.getUriLabel(u, { relative: false })).join('\n');
				await this._dialogService.confirm({
					type: Severity.Warning,
					message: localize('composer.foldersOutsideWorkspace', "Folders Outside Workspace"),
					detail: localize('composer.foldersOutsideWorkspaceDetail',
						"The following {0} folder(s) are outside your workspace:\n\n{1}\n\nFor safety, only folders within the workspace can be included in refactoring operations. These folders will be excluded.",
						outsideWorkspace.length, outsidePaths),
					primaryButton: localize('ok', "OK"),
				});
			}

			// Only add folders within workspace
			if (insideWorkspace.length > 0) {
				const currentItems = this._scopeItems.get();
				const newItems = insideWorkspace.map(uri => ({
					uri,
					type: 'folder' as const,
					label: this._labelService.getUriLabel(uri, { relative: true })
				}));
				this._scopeItems.set([...currentItems, ...newItems], undefined);
				this._updateScopeURIs();
			}
		}
	}

	async addSymbol(): Promise<void> {
		const quickPick = this._quickInputService.createQuickPick<IQuickPickItem & { symbol?: IWorkspaceSymbol }>();
		quickPick.placeholder = localize('composer.symbolPlaceholder', "Type to search for symbols");
		quickPick.canSelectMany = true;

		// Load symbols as user types
		const disposables = new DisposableStore();
		const cancellationToken = new CancellationTokenSource();
		disposables.add({ dispose: () => cancellationToken.cancel() });

		disposables.add(quickPick.onDidChangeValue(async value => {
			if (value.trim().length > 0) {
				const symbolItems = await getWorkspaceSymbols(value, cancellationToken.token);
				quickPick.items = symbolItems.map(item => ({
					label: item.symbol.name,
					description: item.symbol.containerName,
					detail: this._labelService.getUriLabel(item.symbol.location.uri, { relative: true }),
					symbol: item.symbol
				}));
			} else {
				quickPick.items = [];
			}
		}));

		const selected = await new Promise<IWorkspaceSymbol[] | undefined>(resolve => {
			disposables.add(quickPick.onDidAccept(() => {
				resolve(quickPick.selectedItems.map(item => item.symbol).filter((s): s is IWorkspaceSymbol => !!s));
				quickPick.hide();
			}));
			disposables.add(quickPick.onDidHide(() => {
				resolve(undefined);
			}));
			quickPick.show();
		});

		disposables.dispose();
		quickPick.dispose();

		if (selected && selected.length > 0) {
			// Filter symbols to only those within workspace
			const workspaceSymbols = selected.filter(symbol =>
				this._workspaceContextService.isInsideWorkspace(symbol.location.uri)
			);

			if (workspaceSymbols.length < selected.length) {
				// Some symbols were filtered out
				const filteredCount = selected.length - workspaceSymbols.length;
				await this._dialogService.warn(
					localize('composer.symbolsOutsideWorkspace', "Some symbols are outside the workspace and were excluded ({0} symbol(s))", filteredCount)
				);
			}

			if (workspaceSymbols.length > 0) {
				const currentItems = this._scopeItems.get();
				const newItems = workspaceSymbols.map(symbol => ({
					uri: symbol.location.uri,
					type: 'symbol' as const,
					label: `${symbol.name}${symbol.containerName ? ` (${symbol.containerName})` : ''}`
				}));
				this._scopeItems.set([...currentItems, ...newItems], undefined);
				this._updateScopeURIs();
			}
		}
	}

	async addGlobPattern(): Promise<void> {
		const quickPick = this._quickInputService.createInputBox();
		quickPick.placeholder = localize('composer.globPlaceholder', "Enter glob pattern (e.g., **/*.ts)");
		quickPick.prompt = localize('composer.globPrompt', "Press Enter to add, Escape to cancel");

		const pattern = await new Promise<string | undefined>(resolve => {
			const disposables = new DisposableStore();
			disposables.add(quickPick.onDidAccept(() => {
				const value = quickPick.value.trim();
				if (value.length > 0) {
					resolve(value);
					quickPick.hide();
				}
			}));
			disposables.add(quickPick.onDidHide(() => {
				resolve(undefined);
			}));
			quickPick.show();
			disposables.add(toDisposable(() => quickPick.dispose()));
		});

		if (pattern) {
			const currentItems = this._scopeItems.get();
			// For glob patterns, we use a special URI scheme or store the pattern
			// For now, we'll use a file URI with the pattern as the path
			const globUri = URI.from({ scheme: 'glob', path: pattern });
			this._scopeItems.set([...currentItems, {
				uri: globUri,
				type: 'glob',
				label: pattern
			}], undefined);
			this._updateScopeURIs();
		}
	}

	async browseWorkspace(): Promise<void> {
		// Enhanced workspace browser using quick pick with workspace tree
		const quickPick = this._quickInputService.createQuickPick<IQuickPickItem & { uri?: URI; isFolder?: boolean }>();
		quickPick.title = localize('composer.browseWorkspaceTitle', "Select Files and Folders");
		quickPick.placeholder = localize('composer.browseWorkspacePlaceholder', "Type to search workspace, select items, then press Enter");
		quickPick.canSelectMany = true;
		quickPick.matchOnDescription = true;
		quickPick.matchOnDetail = true;

		const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
		const items: Array<IQuickPickItem & { uri?: URI; isFolder?: boolean }> = [];

		// Add workspace folders as starting points
		for (const folder of workspaceFolders) {
			items.push({
				label: `$(folder) ${folder.name}`,
				description: this._labelService.getUriLabel(folder.uri, { relative: false }),
				uri: folder.uri,
				isFolder: true,
			});
		}

		// Load files as user types
		let currentSearchTerm = '';
		const disposables = new DisposableStore();
		const cancellationToken = new CancellationTokenSource();
		disposables.add({ dispose: () => cancellationToken.cancel() });

		disposables.add(quickPick.onDidChangeValue(async value => {
			currentSearchTerm = value.trim();
			if (currentSearchTerm.length > 0) {
				// Search for files matching the pattern
				try {
					const maxResults = 100;
					const fileItems: Array<IQuickPickItem & { uri?: URI; isFolder?: boolean }> = [];

					// Try repo indexer first for fast suggestions
					try {
						const indexed = await this._repoIndexerService.query(currentSearchTerm, maxResults);
						for (const p of indexed) {
							const uri = URI.file(p);
							if (this._workspaceContextService.isInsideWorkspace(uri)) {
								const relativePath = this._labelService.getUriLabel(uri, { relative: true });
								fileItems.push({
									label: `$(file) ${relativePath}`,
									description: this._labelService.getUriLabel(uri, { relative: false }),
									uri,
									isFolder: false,
								});
							}
						}
					} catch { /* ignore */ }

					// Fallback to ripgrep file search if index empty
					if (fileItems.length === 0) {
						const queryBuilder = this._instantiationService.createInstance(QueryBuilder);
						const folderURIs = workspaceFolders.map((f: { uri: URI }) => f.uri);
						const fileQuery = queryBuilder.file(folderURIs, {
							filePattern: `**/*${currentSearchTerm}*`,
							maxResults,
							sortByScore: true,
						});

						const searchResults = await this._searchService.fileSearch(fileQuery, cancellationToken.token);
						for (const result of searchResults.results) {
							if (this._workspaceContextService.isInsideWorkspace(result.resource)) {
								const relativePath = this._labelService.getUriLabel(result.resource, { relative: true });
								fileItems.push({
									label: `$(file) ${relativePath}`,
									description: this._labelService.getUriLabel(result.resource, { relative: false }),
									uri: result.resource,
									isFolder: false,
								});
							}
						}
					}

					quickPick.items = [...items, ...fileItems] as (IQuickPickItem & { uri?: URI; isFolder?: boolean })[];
				} catch (error) {
					// Search failed, keep existing items
					console.error('Workspace browse search failed:', error);
				}
			} else {
				quickPick.items = items;
			}
		}));

		// Initialize with workspace folders
		quickPick.items = items;

		const selected = await new Promise<Array<IQuickPickItem & { uri?: URI }> | undefined>(resolve => {
			disposables.add(quickPick.onDidAccept(() => {
				resolve([...quickPick.selectedItems] as Array<IQuickPickItem & { uri?: URI }>);
				quickPick.hide();
			}));
			disposables.add(quickPick.onDidHide(() => {
				resolve(undefined);
			}));
			quickPick.show();
		});

		disposables.dispose();
		cancellationToken.dispose();
		quickPick.dispose();

		if (selected && selected.length > 0) {
			const currentItems = this._scopeItems.get();
			const newItems = selected
				.filter(item => item.uri && this._workspaceContextService.isInsideWorkspace(item.uri))
				.map(item => ({
					uri: item.uri!,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, local/code-no-any-casts
					type: (item as any).isFolder ? 'folder' as const : 'file' as const,
					label: this._labelService.getUriLabel(item.uri!, { relative: true })
				}));

			this._scopeItems.set([...currentItems, ...newItems], undefined);
			this._updateScopeURIs();
		}
	}

	removeScopeItem(index: number): void {
		const items = this._scopeItems.get();
		items.splice(index, 1);
		this._scopeItems.set(items, undefined);
		this._updateScopeURIs();
	}

	clearScope(): void {
		this._scopeItems.set([], undefined);
		this._scopeURIs.set([], undefined);
	}

	private _updateScopeURIs(): void {
		const items = this._scopeItems.get();
		// Extract URIs from items (skip glob patterns for now - they need special handling)
		const uris = items
			.filter(item => item.type !== 'glob')
			.map(item => item.uri);
		this._scopeURIs.set(uris, undefined);
	}

	private async _autoDiscoverFiles(goal: string): Promise<void> {
		if (!this._isAgentMode.get()) {
			return;
		}

		this._isAutoDiscovering.set(true, undefined);

		try {
			// Extract keywords from goal for file search
			const keywords = this._extractKeywords(goal);

			// Use repo indexer first to find relevant files
			const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) {
				return;
			}

			const queryBuilder = this._instantiationService.createInstance(QueryBuilder);

			const discoveredURIs = new Set<URI>();
			try {
				const indexed = await this._repoIndexerService.query(keywords.join(' '), 50);
				for (const p of indexed) {
					const uri = URI.file(p);
					if (this._workspaceContextService.isInsideWorkspace(uri)) {
						discoveredURIs.add(uri);
					}
				}
			} catch { /* ignore */ }

			// Fallback to ripgrep text search when index empty
			if (discoveredURIs.size === 0) {
				const folderURIs = workspaceFolders.map((f: { uri: URI }) => f.uri);
				const textQuery = queryBuilder.text(
					{ pattern: keywords.join('|'), isRegExp: true },
					folderURIs,
					{
						maxResults: 50,
						previewOptions: { matchLines: 1, charsPerLine: 100 }
					}
				);
				const searchResults = await this._searchService.textSearch(textQuery, this._cancellationTokenSource?.token);
				for (const result of searchResults.results) {
					if (this._workspaceContextService.isInsideWorkspace(result.resource)) {
						discoveredURIs.add(result.resource);
					}
				}
			}

			// Update scope with discovered files
			if (discoveredURIs.size > 0) {
				const discoveredItems = Array.from(discoveredURIs).map(uri => ({
					uri,
					type: 'file' as const,
					label: this._labelService.getUriLabel(uri, { relative: true })
				}));

				// In Agent Mode, replace existing scope with discovered files
				this._scopeItems.set(discoveredItems, undefined);
				this._updateScopeURIs();
			}

		} catch (error) {
			console.error('Auto-discovery failed:', error);
			// Don't show error to user - auto-discovery is best-effort
		} finally {
			this._isAutoDiscovering.set(false, undefined);
		}
	}

	private _extractKeywords(goal: string): string[] {
		// Extract meaningful keywords from the goal
		const stopWords = new Set(['to', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'all', 'convert', 'change', 'refactor', 'update', 'modify', 'rename']);

		const words = goal
			.toLowerCase()
			.split(/\W+/)
			.filter(w => w.length > 2 && !stopWords.has(w));

		// Take top 3-5 most meaningful words
		return words.slice(0, 5);
	}

	private async _calculateSummaryStats(): Promise<void> {
		if (!this._currentSession) {
			this._summaryStats.set(undefined, undefined);
			return;
		}

		const entries = this._currentSession.entries.get();
		let linesAdded = 0;
		let linesRemoved = 0;
		let hunks = 0;

		// PERFORMANCE: Increased batch size for better parallelization (was 5, now 8)
		// Bounded concurrency: Process 8 files concurrently to balance throughput vs UI responsiveness
		const BATCH_SIZE = 8;
		// Track cancellation state for early bailout
		let isCancelled = false;

		// Compute accurate stats from diffs in batches with parallel execution
		for (let i = 0; i < entries.length; i += BATCH_SIZE) {
			// Early bailout: Check if session was closed or cancelled
			if (!this._currentSession || this._cancellationTokenSource?.token.isCancellationRequested) {
				isCancelled = true;
				break;
			}

			const batch = entries.slice(i, i + BATCH_SIZE);
			const statsPromises = batch.map(async (entry) => {
				// Early bailout check before expensive operations
				if (!this._currentSession || this._cancellationTokenSource?.token.isCancellationRequested) {
					return { linesAdded: 0, linesRemoved: 0 };
				}

				try {
					const originalRef = await this._textModelService.createModelReference(entry.originalURI);
					const modifiedRef = await this._textModelService.createModelReference(entry.modifiedURI);

					try {
						const originalVersion = originalRef.object.textEditorModel.getVersionId();
						const modifiedVersion = modifiedRef.object.textEditorModel.getVersionId();

						// Check cache first
						const cacheKey = `${entry.entryId}-${originalVersion}-${modifiedVersion}`;
						let cachedResult = this._summaryDiffCache.get(cacheKey);

						// If cache miss, compute new diff
						if (!cachedResult) {
							const diffPromise = this._editorWorkerService.computeDiff(
								entry.originalURI,
								entry.modifiedURI,
								{ ignoreTrimWhitespace: true, computeMoves: false, maxComputationTimeMs: 2000 },
								'advanced'
							).then(diff => ({
								diff,
								originalVersion,
								modifiedVersion
							}));

							this._summaryDiffCache.set(cacheKey, diffPromise);
							// Limit cache size to prevent memory issues
							if (this._summaryDiffCache.size > 100) {
								const firstKey = this._summaryDiffCache.keys().next().value;
								if (firstKey !== undefined) {
									this._summaryDiffCache.delete(firstKey);
								}
							}
							cachedResult = diffPromise;
						}

						const { diff } = await cachedResult;

						// Early bailout check after diff computation
						if (!this._currentSession || this._cancellationTokenSource?.token.isCancellationRequested) {
							return { linesAdded: 0, linesRemoved: 0 };
						}

						if (diff && diff.changes.length > 0) {
							let fileLinesAdded = 0;
							let fileLinesRemoved = 0;

							for (const change of diff.changes) {
								const originalLines = change.original.isEmpty ? 0 : (change.original.endLineNumberExclusive - change.original.startLineNumber);
								const modifiedLines = change.modified.isEmpty ? 0 : (change.modified.endLineNumberExclusive - change.modified.startLineNumber);

								fileLinesRemoved += originalLines;
								fileLinesAdded += modifiedLines;
								hunks++;
							}

							return { linesAdded: fileLinesAdded, linesRemoved: fileLinesRemoved };
						}
					} finally {
						originalRef.dispose();
						modifiedRef.dispose();
					}
				} catch (error) {
					// Ignore errors for individual files - continue with other files
					console.debug('Error computing stats for file:', entry.modifiedURI.toString(), error);
				}

				return { linesAdded: 0, linesRemoved: 0 };
			});

			const fileStats = await Promise.all(statsPromises);

			// Early bailout: Don't update stats if cancelled
			if (!this._currentSession || this._cancellationTokenSource?.token.isCancellationRequested) {
				isCancelled = true;
				break;
			}

			for (const stats of fileStats) {
				linesAdded += stats.linesAdded;
				linesRemoved += stats.linesRemoved;
			}

			// Yield to UI thread between batches to maintain responsiveness
			if (i + BATCH_SIZE < entries.length) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}

		// Only update stats if not cancelled and session still exists
		if (!isCancelled && this._currentSession) {
			this._summaryStats.set({
				filesChanged: entries.length,
				linesAdded,
				linesRemoved,
				hunks
			}, undefined);
		}
	}

	async generateProposals(): Promise<void> {
		const scopeURIs = this._scopeURIs.get();
		const goal = this._goal.get().trim();
		const isAgentMode = this._isAgentMode.get();

		if (goal.length === 0) {
			return;
		}

		// In Agent Mode, trigger auto-discovery if scope is empty
		if (isAgentMode && scopeURIs.length === 0) {
			await this._autoDiscoverFiles(goal);
			// Wait a bit for auto-discovery to complete
			await new Promise(resolve => setTimeout(resolve, 500));
			const updatedScopeURIs = this._scopeURIs.get();
			if (updatedScopeURIs.length === 0) {
				await this._dialogService.warn(
					localize('composer.noFilesDiscovered', "Could not automatically discover files for this goal. Please switch to Normal mode and manually select files.")
				);
				return;
			}
		}

		// Re-read scope after potential auto-discovery
		const finalScopeURIs = this._scopeURIs.get();
		if (finalScopeURIs.length === 0) {
			return;
		}

		// Policy: Check max file limit
		const maxFiles = this._configurationService.getValue<number>(chatEditingMaxFileAssignmentName) ?? defaultChatEditingMaxFileLimit;
		if (finalScopeURIs.length > maxFiles) {
			const { confirmed } = await this._dialogService.confirm({
				type: Severity.Warning,
				message: localize('composer.tooManyFiles', "Large refactoring scope"),
				detail: localize('composer.tooManyFilesDetail', "You have selected {0} files, which exceeds the recommended limit of {1}. Continue anyway?", finalScopeURIs.length, maxFiles),
				primaryButton: localize('continue', "Continue"),
			});
			if (!confirmed) {
				return;
			}
		}

		// Cancel any existing generation
		if (this._cancellationTokenSource) {
			this._cancellationTokenSource.cancel();
			this._cancellationTokenSource.dispose();
		}

		this._cancellationTokenSource = new CancellationTokenSource();
		this._isGenerating.set(true, undefined);

		try {
			// Check if a default agent is available before starting session
			// First check for activated agent, then check for contributed agent (which may activate)
			const defaultAgent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
			const contributedAgent = this._chatAgentService.getContributedDefaultAgent(ChatAgentLocation.Chat);

			if (!defaultAgent && !contributedAgent) {
				this._isGenerating.set(false, undefined);
				await this._dialogService.error(
					localize('composer.noAgentError', "Cannot generate proposals: No chat agent is available. Please install a chat agent extension (e.g., GitHub Copilot, Cursor, or another compatible chat agent extension) from the Extensions marketplace.")
				);
				return;
			}

			// Create or get editing session
			const chatModelRef = this._chatService.startNewLocalSession(ChatAgentLocation.Chat, { debugOwner: 'ComposerPanel' });
			const chatModel = chatModelRef.object as ChatModel;
			const editingSession = this._chatEditingService.createEditingSession(chatModel);

			// Clear previous session
			if (this._currentSession && this._currentSession !== editingSession) {
				this._sessionDisposables.clear();
				// Don't dispose - let it be managed by ChatEditingService
			}

			this._currentSession = editingSession;
			this._sessionDisposables.clear();

			// Build variables from scope items
			const scopeItems = this._scopeItems.get();
			const attachedContext: IChatRequestVariableEntry[] = [];

			// Process each scope item and convert to chat variables
			for (const item of scopeItems) {
				if (item.type === 'glob') {
					// Glob patterns need special handling - expand to matching files
					// For now, we'll note that glob support requires file search
					continue;
				}

				const uri = item.uri;
				// Safety: Only include files within workspace
				if (!this._workspaceContextService.isInsideWorkspace(uri)) {
					console.warn(`Skipping file outside workspace: ${uri.toString()}`);
					continue;
				}
				// Convert URI to chat variable entry (IChatRequestImplicitVariableEntry for files)
				attachedContext.push({
					kind: 'implicit',
					id: uri.toString(),
					name: this._labelService.getUriLabel(uri, { relative: true }),
					value: uri,
					uri,
					isSelection: false,
					enabled: true,
					isFile: true as const,
				});
			}

			// Build the request message with goal
			const requestMessage = goal;

			// Send the chat request
			// The ChatEditingService automatically observes edits in the response
			// via observerEditsInResponse and creates entries for each file
			const sendResult = await this._chatService.sendRequest(chatModel.sessionResource, requestMessage, {
				attachedContext,
				location: ChatAgentLocation.Chat
			});

			if (!sendResult || ChatSendResult.isRejected(sendResult)) {
				throw new Error('Failed to send chat request');
			}

			// Wait for the response to complete (or be cancelled)
			if (ChatSendResult.isSent(sendResult)) {
				await sendResult.data.responseCompletePromise;
			} else if (ChatSendResult.isQueued(sendResult)) {
				const deferredResult = await sendResult.deferred;
				if (ChatSendResult.isSent(deferredResult)) {
					await deferredResult.data.responseCompletePromise;
				}
			}

			// Verify the response completed successfully
			if (this._cancellationTokenSource?.token.isCancellationRequested) {
				return;
			}

			// Show the session in MultiDiffEditor if there are proposals
			const entries = this._currentSession.entries.get();
			if (entries.length > 0) {
				await editingSession.show();

				// Audit log: record diff preview
				if (this._auditLogService.isEnabled()) {
					const files = entries.map(e => this._labelService.getUriLabel(e.modifiedURI, { relative: true }));
					// Calculate diff stats from entries (use changesCount as hunks)
					let totalChanges = 0;
					for (const entry of entries) {
						const changes = entry.changesCount.get();
						totalChanges += changes;
					}
					await this._auditLogService.append({
						ts: Date.now(),
						action: 'diff_preview',
						files,
						diffStats: totalChanges > 0 ? {
							linesAdded: 0, // Not easily calculable without text models
							linesRemoved: 0, // Not easily calculable without text models
							hunks: totalChanges,
						} : undefined,
						ok: true,
						meta: {
							threadId: chatModel.sessionId,
							filesChanged: entries.length,
						},
					});
				}
			} else {
				// No proposals generated - inform the user
				await this._dialogService.info(
					localize('composer.noProposalsGenerated', "No proposals were generated. The agent may not have made any file changes.")
				);
			}

		} catch (error) {
			if (!this._cancellationTokenSource?.token.isCancellationRequested) {
				this._dialogService.error(localize('composer.generateError', "Failed to generate proposals: {0}", error));
			}
		} finally {
			this._isGenerating.set(false, undefined);
			if (this._cancellationTokenSource) {
				this._cancellationTokenSource.dispose();
				this._cancellationTokenSource = undefined;
			}
		}
	}

	/**
	 * Converts chat editing entries to FileEditOperations for ApplyEngineV2
	 */
	private async _convertEntriesToOperations(entries: readonly IModifiedFileEntry[]): Promise<FileEditOperation[]> {
		const operations: FileEditOperation[] = [];

		for (const entry of entries) {
			// Get the actual file URI - modifiedURI might be a special URI, so we need to resolve it
			// For now, try to get the real file URI from the model
			let fileUri: URI | undefined;
			let content: string | undefined;

			try {
				// Try to resolve the modifiedURI to get the model
				const modelRef = await this._textModelService.createModelReference(entry.modifiedURI);
				try {
					const textModel = modelRef.object.textEditorModel;
					if (textModel && !textModel.isDisposed()) {
						content = textModel.getValue(EndOfLinePreference.LF);
						// Try to get the actual file URI - might need to check if it's a special scheme
						// For document entries, the modifiedURI might actually be the file URI in some cases
						// But for safety, we'll try to derive it from originalURI or check the model's URI
						const modelUri = textModel.uri;
						// If the model URI is a file:// URI, use it; otherwise try originalURI
						if (modelUri.scheme === 'file') {
							fileUri = modelUri;
						} else {
							// Try to get from originalURI - but need to extract the real file path
							// originalURI is a snapshot URI, so we need the actual file URI
							// For now, check if modifiedURI can be converted
							fileUri = entry.modifiedURI;
						}
					}
				} finally {
					modelRef.dispose();
				}
			} catch {
				// If model resolution fails, try to use modifiedURI directly
				fileUri = entry.modifiedURI;
			}

			if (!fileUri || !content) {
				// Fallback: try to read from file service if modifiedURI is a file URI
				if (entry.modifiedURI.scheme === 'file') {
					fileUri = entry.modifiedURI;
					try {
						if (await this._fileService.exists(fileUri)) {
							const fileContent = await this._fileService.readFile(fileUri);
							content = fileContent.value.toString();
						} else {
							// File doesn't exist - this is a create operation
							// We still need content, try to get from model again or use empty
							content = '';
						}
					} catch {
						content = '';
					}
				} else {
					// Skip this entry if we can't get content
					continue;
				}
			}

			// Determine operation type: check if file exists
			const fileExists = fileUri.scheme === 'file' && await this._fileService.exists(fileUri);
			const operationType: 'edit' | 'create' = fileExists ? 'edit' : 'create';

			operations.push({
				uri: fileUri,
				type: operationType,
				content: content,
			});
		}

		return operations;
	}

	async applyAll(): Promise<void> {
		if (!this._currentSession) {
			return;
		}

		const entries = this._currentSession.entries.get();
		if (entries.length === 0) {
			return;
		}

		// Performance tracking
		const requestId = `apply-${Date.now()}`;
		diffComposerAudit.markApplyStart(requestId);

		// Safety: Validate all entries are within workspace before applying
		const entriesOutsideWorkspace = entries.filter(entry =>
			!this._workspaceContextService.isInsideWorkspace(entry.modifiedURI)
		);

		if (entriesOutsideWorkspace.length > 0) {
			const outsidePaths = entriesOutsideWorkspace.map(e => this._labelService.getUriLabel(e.modifiedURI, { relative: false })).join('\n');
			diffComposerAudit.markApplyEnd(requestId, false);
			await this._dialogService.error(
				localize('composer.applyOutsideWorkspace', "Cannot apply changes: {0} file(s) are outside the workspace:\n\n{1}",
					entriesOutsideWorkspace.length, outsidePaths)
			);
			return;
		}

		// Apply Engine v2: Convert entries to operations and apply atomically
		const applyEngine = this._instantiationService.invokeFunction(accessor => accessor.get(IApplyEngineV2));

		try {
			// Convert entries to FileEditOperations
			const operations = await this._convertEntriesToOperations(entries);

			if (operations.length === 0) {
				diffComposerAudit.markApplyEnd(requestId, false);
				await this._dialogService.error(localize('composer.noOperations', "No file operations to apply"));
				return;
			}

			// Apply using ApplyEngineV2 (atomic, verifiable, deterministic)
			const result = await applyEngine.applyTransaction(operations, { operationId: requestId });

			if (!result.success) {
				diffComposerAudit.markApplyEnd(requestId, false);

				// Show appropriate error message based on error category
				let errorMessage = result.error || localize('composer.applyError', "Failed to apply changes");
				if (result.errorCategory === 'base_mismatch') {
					errorMessage = localize('composer.baseMismatch', "File changed before apply. Please retry: {0}", result.error);
				} else if (result.errorCategory === 'verification_failure') {
					errorMessage = localize('composer.verificationFailed', "Apply verification failed. Changes rolled back: {0}", result.error);
				}

				await this._dialogService.error(errorMessage);
				return;
			}

			// Success: Update session state by calling accept() (this updates UI state but files are already applied)
			// Note: accept() might try to apply again, but ApplyEngineV2 already did it atomically
			// We call accept() to update the session state properly
			await this._currentSession.accept();

			diffComposerAudit.markApplyEnd(requestId, true);
			const metrics = diffComposerAudit.getMetrics(requestId, entries.length);
			if (metrics && metrics.applyTime > 300) {
				// allow-any-unicode-next-line
				console.warn(`Apply operation took ${metrics.applyTime.toFixed(1)}ms (target: ≤300ms)`);
			}

			// Audit log: record apply (ApplyEngineV2 already logged, but we log additional context here)
			if (this._auditLogService.isEnabled()) {
				const files = entries.map(e => this._labelService.getUriLabel(e.modifiedURI, { relative: true }));
				// Calculate diff stats from entries (use changesCount as hunks)
				let totalChanges = 0;
				for (const entry of entries) {
					const changes = entry.changesCount.get();
					totalChanges += changes;
				}
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'apply',
					files,
					diffStats: totalChanges > 0 ? {
						linesAdded: 0, // Not easily calculable without text models
						linesRemoved: 0, // Not easily calculable without text models
						hunks: totalChanges,
					} : undefined,
					ok: true,
					meta: {
						requestId,
						applyTime: metrics?.applyTime,
						appliedFiles: result.appliedFiles.length,
						engine: 'v2',
					},
				});
			}

			this._dialogService.info(localize('composer.applied', "Applied (verified) to {0} file(s). Use Undo to revert.", result.appliedFiles.length));
		} catch (error) {
			diffComposerAudit.markApplyEnd(requestId, false);

			// Error handling: ApplyEngineV2 already handled rollback, but we log additional context
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Audit log: record apply error (ApplyEngineV2 already logged, but we add context)
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'apply',
					ok: false,
					meta: {
						requestId,
						error: errorMessage,
						engine: 'v2',
					},
				});
			}

			// eslint-disable-next-line local/code-no-unexternalized-strings
			this._dialogService.error(localize('composer.applyError', "Failed to apply changes: {0}", errorMessage));
		}
	}

	async undo(): Promise<void> {
		if (!this._currentSession) {
			return;
		}

		// Performance tracking
		const requestId = `undo-${Date.now()}`;
		diffComposerAudit.markUndoStart(requestId);

		try {
			await this._currentSession.undoInteraction();
			diffComposerAudit.markUndoEnd(requestId, true);
			const metrics = diffComposerAudit.getMetrics(requestId, 0);
			if (metrics && metrics.undoTime > 300) {
				// allow-any-unicode-next-line
				console.warn(`Undo operation took ${metrics.undoTime.toFixed(1)}ms (target: ≤300ms)`);
			}

			// Audit log: record undo
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'undo',
					ok: true,
					meta: {
						requestId,
						undoTime: metrics?.undoTime,
					},
				});
			}
		} catch (error) {
			diffComposerAudit.markUndoEnd(requestId, false);

			// Audit log: record undo error
			if (this._auditLogService.isEnabled()) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'undo',
					ok: false,
					meta: {
						requestId,
						error: error instanceof Error ? error.message : String(error),
					},
				});
			}

			this._dialogService.error(localize('composer.undoError', "Failed to undo: {0}", error));
		}
	}

	async redo(): Promise<void> {
		if (!this._currentSession) {
			return;
		}

		try {
			await this._currentSession.redoInteraction();
		} catch (error) {
			this._dialogService.error(localize('composer.redoError', "Failed to redo: {0}", error));
		}
	}

	async rejectAll(): Promise<void> {
		if (!this._currentSession) {
			return;
		}

		const entries = this._currentSession.entries.get();
		if (entries.length === 0) {
			return;
		}

		const { confirmed } = await this._dialogService.confirm({
			type: Severity.Warning,
			message: localize('composer.rejectConfirm', "Reject all proposals?"),
			detail: localize('composer.rejectConfirmDetail', "This will discard all proposed changes."),
			primaryButton: localize('reject', "Reject")
		});

		if (confirmed) {
			try {
				await this._currentSession.reject();
				this._currentSession = undefined;
				this._sessionDisposables.clear();
			} catch (error) {
				this._dialogService.error(localize('composer.rejectError', "Failed to reject changes: {0}", error));
			}
		}
	}

	cancel(): void {
		if (this._cancellationTokenSource) {
			this._cancellationTokenSource.cancel();
			this._cancellationTokenSource.dispose();
			this._cancellationTokenSource = undefined;
		}
		this._isGenerating.set(false, undefined);
	}

	hasProposals(): boolean {
		return this._currentSession !== undefined && this._currentSession.entries.get().length > 0;
	}

	private _onHunkToggle(entry: IModifiedFileEntry, hunk: DetailedLineRangeMapping, enabled: boolean): void {
		// This is called when a hunk checkbox is toggled
		// For now, we store the state but don't filter during apply
		// In the future, we can implement per-hunk accept/reject
		// The MultiDiffEditor already supports this via editor integration
	}
}

async function getComposerPanel(viewsService: IViewsService): Promise<ComposerPanel | undefined> {
	const view = await viewsService.openView(ComposerPanel.ID, true);
	if (view instanceof ComposerPanel) {
		return view;
	}
	return undefined;
}

// Command: Apply All
registerAction2(class ApplyAllAction extends Action2 {
	constructor() {
		super({
			id: 'chatComposer.applyAll',
			title: localize2('composer.applyAll', "Apply All"),
			category: localize2('composer', "Chat Composer"),
			precondition: ComposerPanel.ctxCanApply,
			menu: [{
				id: MenuId.ViewTitle,
				order: 1
			}],
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: FocusedViewContext.isEqualTo(ComposerPanel.ID),
				primary: KeyMod.CtrlCmd + KeyCode.Enter,
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const view = await getComposerPanel(viewsService);
		view?.applyAll();
	}
});

// Command: Undo
registerAction2(class UndoAction extends Action2 {
	constructor() {
		super({
			id: 'chatComposer.undo',
			title: localize2('composer.undo', "Undo"),
			category: localize2('composer', "Chat Composer"),
			precondition: ComposerPanel.ctxHasProposals,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: FocusedViewContext.isEqualTo(ComposerPanel.ID),
				primary: KeyMod.CtrlCmd + KeyCode.KeyZ,
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const view = await getComposerPanel(viewsService);
		view?.undo();
	}
});

// Command: Redo
registerAction2(class RedoAction extends Action2 {
	constructor() {
		super({
			id: 'chatComposer.redo',
			title: localize2('composer.redo', "Redo"),
			category: localize2('composer', "Chat Composer"),
			precondition: ComposerPanel.ctxHasProposals,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: FocusedViewContext.isEqualTo(ComposerPanel.ID),
				primary: KeyMod.CtrlCmd + KeyMod.Shift + KeyCode.KeyZ,
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const view = await getComposerPanel(viewsService);
		view?.redo();
	}
});

// Command: Reject All
registerAction2(class RejectAllAction extends Action2 {
	constructor() {
		super({
			id: 'chatComposer.rejectAll',
			title: localize2('composer.rejectAll', "Reject All"),
			category: localize2('composer', "Chat Composer"),
			precondition: ComposerPanel.ctxHasProposals,
			menu: [{
				id: MenuId.ViewTitle,
				order: 2
			}]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const view = await getComposerPanel(viewsService);
		view?.rejectAll();
	}
});

// Command: Cancel
registerAction2(class CancelAction extends Action2 {
	constructor() {
		super({
			id: 'chatComposer.cancel',
			title: localize2('composer.cancel', "Cancel"),
			category: localize2('composer', "Chat Composer"),
			precondition: ComposerPanel.ctxIsGenerating,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const view = await getComposerPanel(viewsService);
		view?.cancel();
	}
});

// Command: Rollback Last Snapshot
registerAction2(class RollbackLastSnapshotAction extends Action2 {
	constructor() {
		super({
			id: 'cortexide.rollback.applyLastSnapshot',
			title: localize2('rollback.applyLast', 'Rollback Last Snapshot'),
			category: localize2('cortexide', 'Cortexide'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const rollbackService = accessor.get(IRollbackSnapshotService);
		const dialogService = accessor.get(IDialogService);

		if (!rollbackService.isEnabled()) {
			await dialogService.info(localize('rollback.disabled', 'Rollback is disabled. Enable it in settings.'));
			return;
		}

		const snapshot = rollbackService.getLastSnapshot();
		if (!snapshot) {
			await dialogService.info(localize('rollback.noSnapshot', 'No snapshot available to restore.'));
			return;
		}

		try {
			await rollbackService.restoreSnapshot(snapshot.id);
			await dialogService.info(localize('rollback.success', 'Rollback completed successfully.'));
		} catch (error) {
			await dialogService.error(localize('rollback.error', 'Rollback failed: {0}', error));
		}
	}
});

