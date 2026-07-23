/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { URI } from '../../../../base/common/uri.js';

import { parseChatThreadsFromStorage } from '../common/chatThreadStorageReviver.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { chat_userMessageContent, isABuiltinToolName, builtinToolNames, localToolsetFor, READ_ONLY_SUBAGENT_TOOLS } from '../common/prompt/prompts.js';
import { isCapableLocalModel } from '../common/routing/codingModelScore.js';
import { AnthropicReasoning, getErrorMessage, RawToolCallObj, RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { ChatMode, FeatureName, ModelSelection, ModelSelectionOptions, ProviderName, localProviderNames, isAutoModelSelection } from '../common/cortexideSettingsTypes.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { ICortexideAgentsService, resolveAgentModelSelection } from '../common/cortexideAgentsService.js';
import { ICortexideSkillsService, parseSkillInvocation, buildSkillInvocationMessage } from '../common/cortexideSkillsService.js';
import { ICortexideHooksService } from './cortexideHooksService.js';
import { IBackgroundAgentsService } from './backgroundAgentsService.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolResultType, ToolCallParams, ToolName, ToolResult } from '../common/toolsServiceTypes.js';
import { checkToolAllowedInMode } from '../common/toolPermissions.js';
import { classifyCommandRisk, cwdEscapesWorkspace } from '../common/commandRisk.js';
import { formatTodoReminder } from '../common/todoReminder.js';
import { decideAutoApprove } from '../common/autoApprovePolicy.js';
import { AgentFileOpRecord, AgentFileOpType, FileOpIO, undoFileOpsAfterCheckpoint } from '../common/agentFileOps.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IToolsService } from './toolsService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { ChatMessage, ChatImageAttachment, ChatPDFAttachment, CheckpointEntry, CodespanLocationLink, StagingSelectionItem, ToolMessage, PlanMessage, PlanStep, StepStatus, ReviewMessage } from '../common/chatThreadServiceTypes.js';
import { selectCompactionWindow } from '../common/compactionPolicy.js';
import { computeCompactionOverflowDecision, shouldEscalateModel, computePostEscalationCounters, decideFileReadGate, classifyToolStepOutcome, decideLoopContinuation, classifyCompletionState, type ToolMessageType } from '../common/agentLoopDecisions.js';
import { isRateLimitErrorMessage } from '../common/providerErrorFormat.js';
import { createSerializer } from '../common/asyncSerializer.js';

// File-edit tools whose application is serialized across concurrent agent threads (see _editSerializer)
// so a background agent (R7) and the foreground chat can't interleave a read-modify-write on a file.
const WRITE_FILE_TOOLS = new Set<string>(['edit_file', 'rewrite_file', 'multi_edit', 'create_file_or_folder', 'delete_file_or_folder'])
import { Position } from '../../../../editor/common/core/position.js';
import { IMetricsService } from '../common/metricsService.js';
import { shorten } from '../../../../base/common/labels.js';
import { ICortexideModelService } from '../common/cortexideModelService.js';
import { findLast, findLastIdx } from '../../../../base/common/arraysFind.js';
import { IEditCodeService } from './editCodeServiceInterface.js';
import { CortexideFileSnapshot } from '../common/editCodeServiceTypes.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { truncate } from '../../../../base/common/strings.js';
import { THREAD_STORAGE_KEY } from '../common/storageKeys.js';
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js';
import { timeout } from '../../../../base/common/async.js';
import { deepClone } from '../../../../base/common/objects.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IMCPService } from '../common/mcpService.js';
import { RawMCPToolCall } from '../common/mcpServiceTypes.js';
import { preprocessImagesForQA } from './imageQAIntegration.js';
import { ITaskAwareModelRouter, TaskContext, TaskType, RoutingDecision } from '../common/modelRouter.js';
import { looksLikeCodebaseQuestion } from '../common/routing/codebaseQuestionDetector.js';
import { isTriviaQuestion, looksLikeSimpleQuestion } from '../common/routing/simpleQuestionGate.js';
import { canonicalizeToolName, canonicalizeToolParams } from '../common/parseJsonToolCall.js';
import { recognizeTextToolCall } from '../common/toolCallRecognition.js';
import { decideToolSynthesis, decideHowManySearch } from '../common/toolSynthesisDecision.js';
import { extractWebSearchQuery } from '../common/webSearchQuery.js';
import { pickNextFailoverModel, toModelSelection } from '../common/routing/modelFailover.js';
import { resolveModelRuntimeCaps, buildFailoverCandidates, type FailoverProviderEntry } from '../common/modelSelectionEngine.js';
import { chatLatencyAudit } from '../common/chatLatencyAudit.js';
import { IEditRiskScoringService, EditContext, EditRiskScore } from '../common/editRiskScoringService.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { TextEdit } from '../../../../editor/common/core/edits/textEdit.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { localize } from '../../../../nls.js';
import { IAuditLogService } from '../common/auditLogService.js';


// related to retrying when LLM message has error
// Optimized retry logic: faster initial retry, exponential backoff
const CHAT_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // Start with 1s for faster recovery
const MAX_RETRY_DELAY = 5000 // Cap at 5s
const MAX_AGENT_LOOP_ITERATIONS = 100 // Hard cap; most tasks complete well under 30 iterations
const MAX_LOCAL_AGENT_LOOP_ITERATIONS = 30 // Tighter cap for weak/local models, which tend to ramble rather than converge
const MAX_CONSECUTIVE_TOOL_ERRORS = 6 // Stop the agent after this many failed tool calls in a row
const MAX_LOCAL_CONSECUTIVE_TOOL_ERRORS = 3 // Tighter for weak/local models that thrash on tools
const MAX_FILES_READ_PER_QUERY = 10 // Maximum files to read in a single query to prevent excessive reads

/**
 * Execution context for one agent run. Absent on a normal top-level chat turn (the loop then reads
 * the user's mode from global settings, as before). A sub-agent (spawned by the run_subagent tool)
 * passes one so the SAME agent loop runs in an isolated context: its own chat mode, a no-nesting
 * marker, and the parent thread id for UI nesting + abort propagation.
 */
type AgentRunContext = {
	chatModeOverride?: ChatMode
	isSubagent?: boolean
	parentThreadId?: string
	// A custom agent's (.cortexide/agents/*.md) system prompt, injected as a real <subagent_role>
	// system-message block for this run. The pinned model (if any) flows through modelSelection.
	systemPromptOverride?: string
	// A custom agent's restricted tool set. Intersected into the offered tools AND enforced at the
	// _runToolCall dispatch gate (authoritative). attempt_completion is always allowed.
	allowedToolNames?: string[]
	// Parallel-edit phase 2: the absolute fs path of this sub-agent's git-worktree root. When set, the
	// child's file tools resolve + are confined to the worktree instead of the workspace root (see
	// _runToolCall -> validateParams -> validateURI). Threaded via _workspaceRootOverrideByThread so it
	// survives the approval-resume re-entry, which calls _runChatAgent WITHOUT runCtx.
	workspaceRootOverride?: string
}


const findStagingSelectionIndex = (currentSelections: StagingSelectionItem[] | undefined, newSelection: StagingSelectionItem): number | null => {
	if (!currentSelections) return null

	for (let i = 0; i < currentSelections.length; i += 1) {
		const s = currentSelections[i]

		if (s.uri.fsPath !== newSelection.uri.fsPath) continue

		if (s.type === 'File' && newSelection.type === 'File') {
			return i
		}
		if (s.type === 'CodeSelection' && newSelection.type === 'CodeSelection') {
			if (s.uri.fsPath !== newSelection.uri.fsPath) continue
			// if there's any collision return true
			const [oldStart, oldEnd] = s.range
			const [newStart, newEnd] = newSelection.range
			if (oldStart !== newStart || oldEnd !== newEnd) continue
			return i
		}
		if (s.type === 'Folder' && newSelection.type === 'Folder') {
			return i
		}
	}
	return null
}


/*

Store a checkpoint of all "before" files on each x.
x's show up before user messages and LLM edit tool calls.

x     A          (edited A -> A')
(... user modified changes ...)
User message

x     A' B C     (edited A'->A'', B->B', C->C')
LLM Edit
x
LLM Edit
x
LLM Edit


INVARIANT:
A checkpoint appears before every LLM message, and before every user message (before user really means directly after LLM is done).
*/


type UserMessageType = ChatMessage & { role: 'user' }
type UserMessageState = UserMessageType['state']
const defaultMessageState: UserMessageState = {
	stagingSelections: [],
	isBeingEdited: false,
}

// a 'thread' means a chat message history

type WhenMounted = {
	textAreaRef: { current: HTMLTextAreaElement | null }; // the textarea that this thread has, gets set in SidebarChat
	scrollToBottom: () => void;
}



export type ThreadType = {
	id: string; // store the id here too
	createdAt: string; // ISO string
	lastModified: string; // ISO string

	messages: ChatMessage[];
	filesWithUserChanges: Set<string>;

	// this doesn't need to go in a state object, but feels right
	state: {
		currCheckpointIdx: number | null; // the latest checkpoint we're at (null if not at a particular checkpoint, like if the chat is streaming, or chat just finished and we haven't clicked on a checkpt)

		stagingSelections: StagingSelectionItem[];
		focusedMessageIdx: number | undefined; // index of the user message that is being edited (undefined if none)

		linksOfMessageIdx: { // eg. link = linksOfMessageIdx[4]['RangeFunction']
			[messageIdx: number]: {
				[codespanName: string]: CodespanLocationLink
			}
		}


		mountedInfo?: {
			whenMounted: Promise<WhenMounted>
			_whenMountedResolver: (res: WhenMounted) => void
			mountedIsResolvedRef: { current: boolean };
		}


	};
}

type ChatThreads = {
	[id: string]: undefined | ThreadType;
}


export type ThreadsState = {
	allThreads: ChatThreads;
	currentThreadId: string; // intended for internal use only
	openTabs: string[]; // ordered list of thread IDs currently shown as tabs
}

export type IsRunningType =
	| 'LLM' // the LLM is currently streaming
	| 'tool' // whether a tool is currently running
	| 'awaiting_user' // awaiting user call
	| 'preparing' // preparing request (model selection, validation, etc.)
	| 'idle' // nothing is running now, but the chat should still appear like it's going (used in-between calls)
	| undefined

export type ThreadStreamState = {
	[threadId: string]: undefined | {
		isRunning: undefined;
		error?: { message: string, fullError: Error | null, };
		llmInfo?: undefined;
		toolInfo?: undefined;
		interrupt?: undefined;
	} | { // an assistant message is being written
		isRunning: 'LLM';
		error?: undefined;
		llmInfo: {
			displayContentSoFar: string;
			reasoningSoFar: string;
			toolCallSoFar: RawToolCallObj | null;
		};
		toolInfo?: undefined;
		interrupt: Promise<() => void>; // calling this should have no effect on state - would be too confusing. it just cancels the tool
	} | { // a tool is being run
		isRunning: 'tool';
		error?: undefined;
		llmInfo?: undefined;
		toolInfo: {
			toolName: ToolName;
			toolParams: ToolCallParams<ToolName>;
			id: string;
			content: string;
			rawParams: RawToolParamsObj;
			mcpServerName: string | undefined;
		};
		interrupt: Promise<() => void>;
	} | {
		isRunning: 'awaiting_user';
		error?: undefined;
		llmInfo?: undefined;
		toolInfo?: undefined;
		interrupt?: undefined;
	} | {
		isRunning: 'preparing';
		error?: undefined;
		llmInfo: {
			displayContentSoFar: string; // status message like "Selecting best model..." or "Preparing request..."
			reasoningSoFar: string;
			toolCallSoFar: RawToolCallObj | null;
		};
		toolInfo?: undefined;
		interrupt: Promise<() => void>; // allow cancellation during preparation
	} | {
		isRunning: 'idle';
		error?: undefined;
		llmInfo?: undefined;
		toolInfo?: undefined;
		interrupt: 'not_needed' | Promise<() => void>; // calling this should have no effect on state - would be too confusing. it just cancels the tool
	}
}

const newThreadObject = () => {
	const now = new Date().toISOString()
	return {
		id: generateUuid(),
		createdAt: now,
		lastModified: now,
		messages: [],
		state: {
			currCheckpointIdx: null,
			stagingSelections: [],
			focusedMessageIdx: undefined,
			linksOfMessageIdx: {},
		},
		filesWithUserChanges: new Set()
	} satisfies ThreadType
}






export interface IChatThreadService {
	readonly _serviceBrand: undefined;

	readonly state: ThreadsState;
	readonly streamState: ThreadStreamState; // not persistent

	onDidChangeCurrentThread: Event<void>;
	onDidChangeStreamState: Event<{ threadId: string }>

	getCurrentThread(): ThreadType;
	openNewThread(): void;
	switchToThread(threadId: string): void;

	// tab management (tabs are a persistent ordered subset of threads shown in the tab bar)
	switchToTab(threadId: string): void;
	closeTab(threadId: string): void;

	// allow-any-unicode-next-line
	// branch a conversation at a specific message — creates a new thread with messages[0..messageIdx]
	branchFromMessage(threadId: string, messageIdx: number): void;

	// thread selector
	deleteThread(threadId: string): void;
	duplicateThread(threadId: string): void;

	// exposed getters/setters
	// these all apply to current thread
	getCurrentMessageState: (messageIdx: number) => UserMessageState
	setCurrentMessageState: (messageIdx: number, newState: Partial<UserMessageState>) => void
	getCurrentThreadState: () => ThreadType['state']
	setCurrentThreadState: (newState: Partial<ThreadType['state']>) => void

	// you can edit multiple messages - the one you're currently editing is "focused", and we add items to that one when you press cmd+L.
	getCurrentFocusedMessageIdx(): number | undefined;
	isCurrentlyFocusingMessage(): boolean;
	setCurrentlyFocusedMessageIdx(messageIdx: number | undefined): void;

	popStagingSelections(numPops?: number): void;
	addNewStagingSelection(newSelection: StagingSelectionItem): void;

	dangerousSetState: (newState: ThreadsState) => void;
	resetState: () => void;

	// // current thread's staging selections
	// closeCurrentStagingSelectionsInMessage(opts: { messageIdx: number }): void;
	// closeCurrentStagingSelectionsInThread(): void;

	// codespan links (link to symbols in the markdown)
	getCodespanLink(opts: { codespanStr: string, messageIdx: number, threadId: string }): CodespanLocationLink | undefined;
	addCodespanLink(opts: { newLinkText: string, newLinkLocation: CodespanLocationLink, messageIdx: number, threadId: string }): void;
	generateCodespanLink(opts: { codespanStr: string, threadId: string }): Promise<CodespanLocationLink>;
	getRelativeStr(uri: URI): string | undefined

	// entry pts
	abortRunning(threadId: string): Promise<void>;

	/** R7: start a top-level agent on a hidden thread that runs WITHOUT blocking the active chat.
	 *  Tracked in IBackgroundAgentsService (the "Running agents" panel). Returns the hidden threadId. */
	startBackgroundAgent(description: string, prompt: string): Promise<string>;
	/** Phase 6 (Skills): if `input` is a `/<skill-name> [args]` invocation matching a discovered
	 *  `.cortexide/skills/<name>/SKILL.md`, return the expanded chat message; otherwise null. */
	getSkillExpansion(input: string): string | null;
	/** Phase 6 (Skills): names of the currently-discovered skills (for slash-command discoverability). */
	listSkillNames(): string[];
	dismissStreamError(threadId: string): void;

	// call to edit a message
	editUserMessageAndStreamResponse({ userMessage, messageIdx, threadId }: { userMessage: string, messageIdx: number, threadId: string }): Promise<void>;

	// call to add a message
	addUserMessageAndStreamResponse({ userMessage, threadId, images, noPlan, displayContent }: { userMessage: string, threadId: string, images?: ChatImageAttachment[], noPlan?: boolean, displayContent?: string }): Promise<void>;

	// approve/reject
	approveLatestToolRequest(threadId: string): void;
	rejectLatestToolRequest(threadId: string): void;

	// jump to history
	jumpToCheckpointBeforeMessageIdx(opts: { threadId: string, messageIdx: number, jumpToUserModified: boolean }): void;

	// Plan management methods
	approvePlan(opts: { threadId: string, messageIdx: number }): void;
	rejectPlan(opts: { threadId: string, messageIdx: number }): void;
	editPlan(opts: { threadId: string, messageIdx: number, updatedPlan: PlanMessage }): void;
	toggleStepDisabled(opts: { threadId: string, messageIdx: number, stepNumber: number }): void;
	reorderPlanSteps(opts: { threadId: string, messageIdx: number, newStepOrder: number[] }): void;

	// Step execution control
	pauseAgentExecution(opts: { threadId: string }): Promise<void>;
	resumeAgentExecution(opts: { threadId: string }): Promise<void>;
	retryStep(opts: { threadId: string, messageIdx: number, stepNumber: number }): Promise<void>;
	skipStep(opts: { threadId: string, messageIdx: number, stepNumber: number }): void;
	rollbackToStep(opts: { threadId: string, messageIdx: number, stepNumber: number }): Promise<void>;

	focusCurrentChat: () => Promise<void>
	blurCurrentChat: () => Promise<void>
}

export const IChatThreadService = createDecorator<IChatThreadService>('voidChatThreadService');
class ChatThreadService extends Disposable implements IChatThreadService {
	_serviceBrand: undefined;

	// this fires when the current thread changes at all (a switch of currentThread, or a message added to it, etc)
	private readonly _onDidChangeCurrentThread = new Emitter<void>();
	readonly onDidChangeCurrentThread: Event<void> = this._onDidChangeCurrentThread.event;

	private readonly _onDidChangeStreamState = new Emitter<{ threadId: string }>();
	readonly onDidChangeStreamState: Event<{ threadId: string }> = this._onDidChangeStreamState.event;

	readonly streamState: ThreadStreamState = {}
	state: ThreadsState // allThreads is persisted, currentThread is not

	// used in checkpointing
	// private readonly _userModifiedFilesToCheckInCheckpoints = new LRUCache<string, null>(50)

	// Cache for file read results to prevent duplicate reads
	// Key: threadId -> cacheKey (uri.fsPath + startLine + endLine + pageNumber) -> cached result
	// Uses LRU eviction to prevent unbounded memory growth
	private readonly _fileReadCache: Map<string, Map<string, BuiltinToolResultType['read_file']>> = new Map()

	// LRU tracking for file read cache (threadId -> ordered list of cache keys)
	private readonly _fileReadCacheLRU: Map<string, string[]> = new Map()
	private static readonly MAX_FILE_READ_CACHE_ENTRIES_PER_THREAD = 100 // Limit cache size per thread

	// Throttle stream state updates during streaming to reduce React re-renders
	// Use requestAnimationFrame to batch updates for better performance
	private readonly _pendingStreamStateUpdates = new Map<string, ThreadStreamState[string]>()
	private _streamStateRafId: number | undefined

	// PERFORMANCE: Cache prepared LLM messages to avoid expensive re-preparation when messages haven't changed
	// Key: hash of (chatMessages content + modelSelection + chatMode + repoIndexer results)
	// Value: { messages, separateSystemMessage, tokenCount, contextSize, timestamp }
	private readonly _messagePrepCache: Map<string, {
		messages: any[];
		separateSystemMessage: string | undefined;
		tokenCount: number;
		contextSize: number;
		timestamp: number;
	}> = new Map();
	private static readonly MESSAGE_PREP_CACHE_TTL = 5000; // 5 seconds - messages can change during agent loops
	private static readonly MESSAGE_PREP_CACHE_MAX_SIZE = 50; // Limit cache size



	constructor(
		@IStorageService private readonly _storageService: IStorageService,
		@ICortexideModelService private readonly _cortexideModelService: ICortexideModelService,
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@IToolsService private readonly _toolsService: IToolsService,
		@ICortexideSettingsService private readonly _settingsService: ICortexideSettingsService,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IMetricsService private readonly _metricsService: IMetricsService,
		@IEditCodeService private readonly _editCodeService: IEditCodeService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IConvertToLLMMessageService private readonly _convertToLLMMessagesService: IConvertToLLMMessageService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IDirectoryStrService private readonly _directoryStringService: IDirectoryStrService,
		@IFileService private readonly _fileService: IFileService,
		@IMCPService private readonly _mcpService: IMCPService,
		@ITaskAwareModelRouter private readonly _modelRouter: ITaskAwareModelRouter,
		@IEditRiskScoringService private readonly _editRiskScoringService: IEditRiskScoringService,
		@IModelService private readonly _modelService: IModelService,
		@ICommandService private readonly _commandService: ICommandService,
		@IAuditLogService private readonly _auditLogService: IAuditLogService,
		@ICortexideAgentsService private readonly _agentsService: ICortexideAgentsService,
		@ICortexideSkillsService private readonly _skillsService: ICortexideSkillsService,
		@ICortexideHooksService private readonly _hooksService: ICortexideHooksService,
		@IBackgroundAgentsService private readonly _backgroundAgentsService: IBackgroundAgentsService,
		@IWorkspaceTrustManagementService private readonly _workspaceTrustService: IWorkspaceTrustManagementService,
	) {
		super()
		// Register the streaming-RAF cancellation ONCE (was re-registered per batch -> unbounded growth).
		this._register({ dispose: () => { if (this._streamStateRafId !== undefined) { cancelAnimationFrame(this._streamStateRafId); this._streamStateRafId = undefined; } } })
		this.state = { allThreads: {}, currentThreadId: null as unknown as string, openTabs: [] } // default state
		// When set for a thread, the next call to _shouldGeneratePlan will return false and clear the flag
		this._suppressPlanOnceByThread = {}

		const readThreads = this._readAllThreads() || {}

		const allThreads = readThreads
		this.state = {
			allThreads: allThreads,
			currentThreadId: null as unknown as string, // gets set in startNewThread()
			openTabs: [], // populated by openNewThread()
		}

		// always be in a thread
		this.openNewThread()

		// Invalidate file read cache when files are changed externally (e.g. user edits file
		// while agent is running, or a build tool writes to disk). Without this the agent
		// reads stale content from cache after the file has changed.
		this._register(this._fileService.onDidFilesChange(e => {
			for (const [threadId, threadCache] of this._fileReadCache.entries()) {
				const lruList = this._fileReadCacheLRU.get(threadId)
				const keysToDelete: string[] = []
				for (const cacheKey of threadCache.keys()) {
					const cachedPath = cacheKey.split('|')[0]
					if (e.affects(URI.file(cachedPath))) {
						keysToDelete.push(cacheKey)
					}
				}
				for (const key of keysToDelete) {
					threadCache.delete(key)
					if (lruList) {
						const idx = lruList.indexOf(key)
						if (idx >= 0) lruList.splice(idx, 1)
					}
				}
			}
		}))
	}

	// If true for a thread, suppress plan generation once for the next user message
	private _suppressPlanOnceByThread: Record<string, boolean>

	async focusCurrentChat() {
		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const s = await thread.state.mountedInfo?.whenMounted
		if (!this.isCurrentlyFocusingMessage()) {
			s?.textAreaRef.current?.focus()
		}
	}
	async blurCurrentChat() {
		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const s = await thread.state.mountedInfo?.whenMounted
		if (!this.isCurrentlyFocusingMessage()) {
			s?.textAreaRef.current?.blur()
		}
	}



	dangerousSetState = (newState: ThreadsState) => {
		// Normalize: if imported state has no openTabs (e.g. old export), derive from allThreads
		this.state = {
			...newState,
			openTabs: newState.openTabs ?? Object.keys(newState.allThreads ?? {}),
		}
		this._onDidChangeCurrentThread.fire()
	}
	resetState = () => {
		this.state = { allThreads: {}, currentThreadId: null as unknown as string, openTabs: [] } // see constructor
		this.openNewThread()
		this._onDidChangeCurrentThread.fire()
	}

	// !!! this is important for properly restoring URIs and images from storage
	// should probably re-use code from void/src/vs/base/common/marshalling.ts instead. but this is simple enough
	private _convertThreadDataFromStorage(threadsStr: string): ChatThreads {
		return parseChatThreadsFromStorage<ChatThreads>(threadsStr);
	}

	private _readAllThreads(): ChatThreads | null {
		const threadsStr = this._storageService.get(THREAD_STORAGE_KEY, StorageScope.APPLICATION);
		if (!threadsStr) {
			return null
		}
		const threads = this._convertThreadDataFromStorage(threadsStr);

		return threads
	}

	private _storeAllThreads(threads: ChatThreads) {
		// Convert Uint8Array image data to base64 before serializing
		const serializedThreads = JSON.stringify(threads, (key, value) => {
			// Convert Uint8Array to base64 string for storage
			if (key === 'data' && value instanceof Uint8Array) {
				// Convert Uint8Array to base64
				const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
				let binaryString = '';
				for (let i = 0; i < value.length; i += chunkSize) {
					const chunk = value.slice(i, i + chunkSize);
					binaryString += String.fromCharCode(...chunk);
				}
				const base64 = btoa(binaryString);
				return `__base64__:${base64}`;
			}
			return value;
		});
		this._storageService.store(
			THREAD_STORAGE_KEY,
			serializedThreads,
			StorageScope.APPLICATION,
			StorageTarget.USER
		);
	}


	// this should be the only place this.state = ... appears besides constructor
	private _setState(state: Partial<ThreadsState>, doNotRefreshMountInfo?: boolean) {
		const newState = {
			...this.state,
			...state
		}

		this.state = newState

		this._onDidChangeCurrentThread.fire()


		// if we just switched to a thread, update its current stream state if it's not streaming to possibly streaming
		const threadId = newState.currentThreadId
		const streamState = this.streamState[threadId]
		if (streamState?.isRunning === undefined && !streamState?.error) {

			// set streamState
			const messages = newState.allThreads[threadId]?.messages
			const lastMessage = messages && messages[messages.length - 1]
			// if awaiting user but stream state doesn't indicate it (happens if restart Void)
			if (lastMessage && lastMessage.role === 'tool' && lastMessage.type === 'tool_request')
				this._setStreamState(threadId, { isRunning: 'awaiting_user', })

			// if running now but stream state doesn't indicate it (happens if restart Void), cancel that last tool
			if (lastMessage && lastMessage.role === 'tool' && lastMessage.type === 'running_now') {

				this._updateLatestTool(threadId, { role: 'tool', type: 'rejected', content: lastMessage.content, id: lastMessage.id, rawParams: lastMessage.rawParams, result: null, name: lastMessage.name, params: lastMessage.params, mcpServerName: lastMessage.mcpServerName })
			}

		}


		// if we did not just set the state to true, set mount info
		if (doNotRefreshMountInfo) return

		let whenMountedResolver: (w: WhenMounted) => void
		const whenMountedPromise = new Promise<WhenMounted>((res) => whenMountedResolver = res)

		this._setThreadState(threadId, {
			mountedInfo: {
				whenMounted: whenMountedPromise,
				mountedIsResolvedRef: { current: false },
				_whenMountedResolver: (w: WhenMounted) => {
					whenMountedResolver(w)
					const mountInfo = this.state.allThreads[threadId]?.state.mountedInfo
					if (mountInfo) mountInfo.mountedIsResolvedRef.current = true
				},
			}
		}, true) // do not trigger an update



	}


	private _setStreamState(threadId: string, state: ThreadStreamState[string]) {
		this.streamState[threadId] = state

		// Throttle updates during streaming to reduce React re-render frequency
		// Batch updates using requestAnimationFrame for smoother performance
		const isStreaming = state?.isRunning === 'LLM'

		if (isStreaming) {
			// During streaming, batch updates using requestAnimationFrame
			this._pendingStreamStateUpdates.set(threadId, state)

			if (this._streamStateRafId === undefined) {
				this._streamStateRafId = requestAnimationFrame(() => {
					// Fire all pending updates in a single batch
					for (const [tid] of this._pendingStreamStateUpdates) {
						this._onDidChangeStreamState.fire({ threadId: tid })
					}
					this._pendingStreamStateUpdates.clear()
					this._streamStateRafId = undefined
				})
				// (RAF cancellation is registered ONCE in the constructor -- not per batch.)
			}
		} else {
			// For non-streaming updates (idle, error, etc.), fire immediately
			// Also clear any pending updates for this thread
			this._pendingStreamStateUpdates.delete(threadId)
			this._onDidChangeStreamState.fire({ threadId })
		}
	}


	// ---------- streaming ----------



	private _currentModelSelectionProps = () => {
		// these settings should not change throughout the loop (eg anthropic breaks if you change its thinking mode and it's using tools)
		const featureName: FeatureName = 'Chat'
		const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName]
		// Skip "auto" - it's not a real provider
		const modelSelectionOptions = modelSelection && !(modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')
			? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]
			: undefined
		return { modelSelection, modelSelectionOptions }
	}

	/**
	 * Auto-select model based on task context
	 * Falls back to user's manual selection if they've set one
	 */
	private async _autoSelectModel(
		userMessage: string,
		images?: ChatImageAttachment[],
		pdfs?: ChatPDFAttachment[]
	): Promise<ModelSelection | null> {
		const featureName: FeatureName = 'Chat'
		const userManualSelection = this._settingsService.state.modelSelectionOfFeature[featureName]

		// If user has a specific model selected (not "Auto"), respect it
		if (userManualSelection && !(userManualSelection.providerName === 'auto' && userManualSelection.modelName === 'auto')) {
			return userManualSelection
		}

		// Detect task type from message and attachments
		const taskType = this._detectTaskType(userMessage, images, pdfs)
		const hasImages = images && images.length > 0
		const hasPDFs = pdfs && pdfs.length > 0
		const hasCode = this._detectCodeInMessage(userMessage)

		// Detect complexity indicators
		const lowerMessage = userMessage.toLowerCase().trim()
		const reasoningKeywords = ['explain why', 'analyze', 'compare and contrast', 'evaluate', 'critique', 'reasoning', 'logical', 'deduce', 'infer', 'conclusion', 'argument', 'thesis', 'hypothesis', 'theoretical', 'conceptual']
		const complexAnalysisKeywords = ['complex', 'sophisticated', 'nuanced', 'detailed analysis', 'deep understanding', 'comprehensive', 'thorough']

		// Codebase questions require complex reasoning (understanding structure, relationships, etc.).
		// Shared, word-boundary-aware detector (see codebaseQuestionDetector.ts) so a word like
		// "capital" (contains "api") or "report" (prefix "repo") is no longer mis-detected.
		const isCodebaseQuestion = looksLikeCodebaseQuestion(userMessage)

		const requiresComplexReasoning = isCodebaseQuestion || // Codebase questions need reasoning
			reasoningKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			complexAnalysisKeywords.some(keyword => lowerMessage.includes(keyword))
		const isLongMessage = userMessage.length > 500

		// Privacy/offline mode: removed restriction for images/PDFs
		// Images/PDFs now always use auto selection (remote models allowed)
		const globalSettings = this._settingsService.state.globalSettings
		const requiresPrivacy = false

		// Estimate context size needed for codebase questions
		// Codebase questions often need to process many files, so estimate higher context needs
		let estimatedContextSize: number | undefined = undefined
		if (isCodebaseQuestion) {
			// Codebase questions typically need:
			// - Base message: ~500 tokens
			// - System message + repo context: ~2000 tokens (from repo indexer)
			// - Multiple file contexts: ~5000-15000 tokens (depending on codebase size)
			// - Response space: ~4000 tokens
			// Total: ~12k-22k tokens minimum, but prefer models with 128k+ for better understanding
			estimatedContextSize = 20000 // Conservative estimate - prefer models with large context
		} else if (requiresComplexReasoning || isLongMessage) {
			// Complex reasoning tasks may need more context
			estimatedContextSize = Math.max(8000, Math.ceil(userMessage.length / 2)) // Rough estimate
		}

		// Detect additional task-specific flags
		const isDebuggingTask = this._detectDebuggingTask(lowerMessage, hasCode)
		const isCodeReviewTask = this._detectCodeReviewTask(lowerMessage)
		const isTestingTask = this._detectTestingTask(lowerMessage)
		const isDocumentationTask = this._detectDocumentationTask(lowerMessage)
		const isPerformanceTask = this._detectPerformanceTask(lowerMessage)
		const isSecurityTask = this._detectSecurityTask(lowerMessage)
		const isSimpleQuestion = this._detectSimpleQuestion(userMessage)
		const isMathTask = this._detectMathTask(lowerMessage)
		const isMultiLanguageTask = this._detectMultiLanguageTask(lowerMessage)
		const isMultiStepTask = this._detectMultiStepTask(lowerMessage)

		// Build task context
		// Enable low-latency preference for simple questions to improve TTFS
		// More aggressive: enable for simple questions OR when task doesn't require complex reasoning
		const preferLowLatency = (isSimpleQuestion ||
			(!requiresComplexReasoning &&
				!hasImages &&
				!hasPDFs &&
				!isLongMessage &&
				!isMultiStepTask &&
				!isCodebaseQuestion &&
				taskType === 'chat')) // Only for general chat, not code/vision tasks

		const context: TaskContext = {
			taskType,
			hasImages,
			hasPDFs,
			hasCode,
			contextSize: estimatedContextSize,
			requiresPrivacy,
			preferLowLatency, // Auto-enable for simple queries to improve TTFS
			preferLowCost: false, // Could be a setting
			userOverride: null, // No override when in auto mode
			requiresComplexReasoning,
			isLongMessage,
			isDebuggingTask,
			isCodeReviewTask,
			isTestingTask,
			isDocumentationTask,
			isPerformanceTask,
			isSecurityTask,
			isSimpleQuestion,
			isMathTask,
			isMultiLanguageTask,
			isMultiStepTask,
		}

		try {
			const routingDecision = await this._modelRouter.route(context)

			// Handle abstain/clarify
			if (routingDecision.shouldAbstain && routingDecision.abstainReason) {
				this._notificationService.info(routingDecision.abstainReason)
				// Return null to indicate we should not proceed
				return null
			}

			// Log routing decision in dev mode (or always for codebase questions to help debug)
			if (globalSettings.imageQADevMode || isCodebaseQuestion) {
				const logData = {
					selected: `${routingDecision.modelSelection.providerName}/${routingDecision.modelSelection.modelName}`,
					confidence: routingDecision.confidence,
					reasoning: routingDecision.reasoning,
					qualityTier: routingDecision.qualityTier,
					timeoutMs: routingDecision.timeoutMs,
					userOverride: userManualSelection ? 'yes' : 'no',
					isCodebaseQuestion,
					contextSize: estimatedContextSize,
					taskType,
					requiresComplexReasoning,
					hasCode,
				};
				console.log('[Auto Model Select]', JSON.stringify(logData, null, 2));

				// Warn if local model selected for codebase question
				if (isCodebaseQuestion && routingDecision.modelSelection.providerName === 'ollama') {
					console.warn('[Auto Model Select] WARNING: Local model selected for codebase question!', logData);
				}
			}

			// Store routing decision for later outcome tracking
			// We'll track the outcome when the message is actually sent
			return routingDecision.modelSelection
		} catch (error) {
			console.error('[Auto Model Select] Error:', error)
			// Fall back to user's manual selection or null
			return userManualSelection
		}
	}

	/**
	 * Get a fallback model when auto selection fails
	 * Returns the first available configured model, or null if none are available
	 */
	// Note: _getFallbackModel removed - use _settingsService.resolveAutoModelSelection() instead

	/**
	 * Check if a model supports vision/image inputs
	 * Uses the same logic as modelRouter
	 */
	private _isModelVisionCapable(modelSelection: ModelSelection, capabilities: any): boolean {
		const name = modelSelection.modelName.toLowerCase();
		const provider = modelSelection.providerName.toLowerCase();

		// Known vision-capable models
		if (provider === 'gemini') return true; // all Gemini models support vision
		if (provider === 'anthropic') {
			return name.includes('3.5') || name.includes('3.7') || name.includes('4') || name.includes('opus') || name.includes('sonnet');
		}
		if (provider === 'openai') {
			// GPT-5 series (all variants support vision)
			if (name.includes('gpt-5') || name.includes('gpt-5.1')) return true;
			// GPT-4.1 series
			if (name.includes('4.1')) return true;
			// GPT-4o series
			if (name.includes('4o')) return true;
			// o-series reasoning models (o1, o3, o4-mini support vision)
			if (name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4')) return true;
			// Legacy GPT-4 models
			if (name.includes('gpt-4')) return true;
		}
		if (provider === 'mistral') {
			// Pixtral models support vision
			if (name.includes('pixtral')) return true;
		}
		if (provider === 'ollama' || provider === 'vllm') {
			return name.includes('llava') || name.includes('bakllava') || name.includes('vision');
		}

		return false;
	}

	/**
	 * Detect task type from message content and attachments
	 * More conservative detection - only mark as specific task type if very clear
	 */
	private _detectTaskType(
		userMessage: string,
		images?: ChatImageAttachment[],
		pdfs?: ChatPDFAttachment[]
	): TaskType {
		const lowerMessage = userMessage.toLowerCase().trim()

		// PDF-specific tasks (always detect if PDFs present)
		if (pdfs && pdfs.length > 0) {
			return 'pdf'
		}

		// Vision tasks (always detect if images present)
		if (images && images.length > 0) {
			return 'vision'
		}

		// Codebase/repository questions — shared, word-boundary-aware detector
		// (codebaseQuestionDetector.ts). These need to understand the whole repo.
		if (looksLikeCodebaseQuestion(userMessage)) {
			return 'code' // Use 'code' task type but we'll enhance scoring for codebase questions
		}

		// Implementation/action tasks - tasks that require creating or modifying code
		// These need good code generation models
		const implementationPatterns = [
			// Direct implementation requests
			/^(implement|create|add|build|make|set up|configure)\s+(a|an|the|my|this)?\s*\w+/,
			// Action verbs followed by code-related nouns
			/\b(implement|create|add|build|make|set up|configure|write|generate|develop)\s+(function|class|method|component|feature|endpoint|api|route|service|module|system|feature|functionality)\b/i,
			// "Implement X" or "Create X" patterns
			/\b(implement|create|add|build|make)\s+[a-z]+\s+(that|which|to|for)/i,
		]

		const implementationKeywords = [
			// Action verbs
			'write code', 'generate code', 'create function', 'implement class', 'fix bug',
			'refactor code', 'optimize code', 'debug', 'syntax error', 'compile error',
			'add function', 'create method', 'implement function',
			// Implementation-specific
			'create a', 'implement a', 'add a', 'build a', 'make a',
			'create new', 'implement new', 'add new', 'build new',
			'set up', 'set up a', 'configure', 'configure a',
			'develop', 'develop a', 'build out',
		]

		const hasImplementationPattern = implementationPatterns.some(pattern => pattern.test(lowerMessage))
		const hasImplementationKeyword = implementationKeywords.some(keyword => lowerMessage.includes(keyword))

		// Code tasks - check for actual code patterns or explicit code requests
		const hasCodeBlock = /```[\s\S]+?```/.test(userMessage) || /`[^`\n]{10,}`/.test(userMessage)

		// Implementation task if it matches patterns/keywords OR has code blocks
		if (hasCodeBlock || hasImplementationPattern || hasImplementationKeyword) {
			return 'code'
		}

		// Web search tasks - only if very explicit
		const explicitWebSearchKeywords = ['search the web', 'search online', 'check online', 'look up online', 'go online', 'look online', 'google', 'duckduckgo', 'web search', 'search internet', 'search the internet']
		if (explicitWebSearchKeywords.some(keyword => lowerMessage.includes(keyword))) {
			return 'web_search'
		}

		// Default to general chat (prefers quality models)
		// Complexity detection (reasoning, long messages) is handled in _autoSelectModel
		// and passed to the router via TaskContext
		return 'chat'
	}

	/**
	 * Detect if message contains code
	 */
	private _detectCodeInMessage(message: string): boolean {
		// Simple heuristic: check for code-like patterns
		const codePatterns = [
			/```[\s\S]*?```/, // Code blocks
			/`[^`]+`/, // Inline code
			/function\s+\w+/, // Function declarations
			/class\s+\w+/, // Class declarations
			/import\s+.*from/, // Import statements
			/const\s+\w+\s*=/, // Const declarations
			/let\s+\w+\s*=/, // Let declarations
		]

		return codePatterns.some(pattern => pattern.test(message))
	}

	/**
	 * Detect debugging/error fixing tasks
	 */
	private _detectDebuggingTask(lowerMessage: string, hasCode: boolean): boolean {
		const debuggingKeywords = [
			'fix error', 'debug', 'why is this failing', 'error message', 'exception', 'stack trace',
			'why doesn\'t this work', 'not working', 'broken', 'crash', 'bug', 'fix bug',
			'troubleshoot', 'issue', 'problem', 'failing', 'failed', 'error', 'errors'
		]
		const errorPatterns = [
			/error\s+(message|occurred|happened|in|at)/i,
			/exception\s+(thrown|occurred|in|at)/i,
			/stack\s+trace/i,
			/why\s+(is|does|isn\'t|doesn\'t).*work/i,
			/why\s+(is|does).*fail/i,
		]

		return debuggingKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			errorPatterns.some(pattern => pattern.test(lowerMessage)) ||
			(hasCode && (lowerMessage.includes('error') || lowerMessage.includes('exception')))
	}

	/**
	 * Detect code review/refactoring tasks
	 */
	private _detectCodeReviewTask(lowerMessage: string): boolean {
		const reviewKeywords = [
			'review', 'refactor', 'improve code', 'code quality', 'best practices', 'clean up',
			'is this good code', 'how can i improve', 'refactor this', 'code review',
			'optimize', 'make it better', 'improve this', 'suggest improvements'
		]
		const reviewPatterns = [
			/review\s+(this|my|the)\s+(code|function|class|method)/i,
			/refactor\s+(this|my|the)/i,
			/how\s+(can|to)\s+(improve|refactor|optimize)/i,
			/is\s+(this|my|the)\s+(code|implementation)\s+(good|correct|proper)/i,
		]

		return reviewKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			reviewPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect testing tasks
	 */
	private _detectTestingTask(lowerMessage: string): boolean {
		const testingKeywords = [
			'write test', 'add test', 'test coverage', 'unit test', 'integration test',
			'test for', 'how to test', 'create test', 'testing', 'test case', 'test suite',
			'write tests', 'add tests', 'test this', 'test the'
		]
		const testingPatterns = [
			/write\s+(a|an|the|unit|integration)\s+test/i,
			/add\s+(a|an|unit|integration)\s+test/i,
			/create\s+(a|an|unit|integration)\s+test/i,
			/test\s+(for|this|the|coverage)/i,
		]

		return testingKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			testingPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect documentation tasks
	 */
	private _detectDocumentationTask(lowerMessage: string): boolean {
		const docKeywords = [
			'write doc', 'documentation', 'comment', 'explain code', 'readme', 'api doc',
			'document this', 'add comments', 'write readme', 'document', 'docs',
			'comment', 'comments', 'javadoc', 'jsdoc', 'docstring'
		]
		const docPatterns = [
			/write\s+(documentation|doc|readme|comments)/i,
			/add\s+(documentation|doc|comments|comment)/i,
			/document\s+(this|my|the)/i,
			/explain\s+(this|my|the)\s+(code|function|class)/i,
		]

		return docKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			docPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect performance optimization tasks
	 */
	private _detectPerformanceTask(lowerMessage: string): boolean {
		const perfKeywords = [
			'optimize', 'performance', 'speed up', 'make faster', 'bottleneck', 'profiling',
			'how to optimize', 'performance issue', 'slow', 'faster', 'speed', 'efficiency',
			'optimization', 'improve performance', 'performance problem'
		]
		const perfPatterns = [
			/optimize\s+(this|my|the|for)/i,
			/performance\s+(issue|problem|optimization|improvement)/i,
			/how\s+to\s+(optimize|improve\s+performance|speed\s+up)/i,
			/make\s+(this|it|the)\s+faster/i,
		]

		return perfKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			perfPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect security-related tasks
	 */
	private _detectSecurityTask(lowerMessage: string): boolean {
		const securityKeywords = [
			'security', 'vulnerability', 'secure', 'authentication', 'authorization', 'encryption',
			'is this secure', 'security issue', 'vulnerable', 'vulnerabilities', 'secure this',
			'security best practices', 'security review', 'security audit', 'xss', 'csrf', 'sql injection'
		]
		const securityPatterns = [
			/security\s+(issue|problem|vulnerability|review|audit)/i,
			/is\s+(this|my|the)\s+secure/i,
			/how\s+to\s+secure/i,
			/make\s+(this|it|the)\s+secure/i,
		]

		return securityKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			securityPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect simple/quick questions
	 * More aggressive detection to enable low-latency routing for better UX
	 */
	private _detectSimpleQuestion(message: string): boolean {
		// Canonical implementation lives in common/routing/simpleQuestionGate.ts (pure + unit-tested).
		return looksLikeSimpleQuestion(message)
	}

	/**
	 * Detect mathematical/computational tasks
	 */
	private _detectMathTask(lowerMessage: string): boolean {
		const mathKeywords = [
			'calculate', 'math', 'algorithm', 'formula', 'compute', 'statistics',
			'calculation', 'mathematical', 'equation', 'solve', 'numerical', 'arithmetic'
		]
		const mathPatterns = [
			/calculate\s+(this|the|a|an)/i,
			/solve\s+(this|the|a|an|for)/i,
			/math\s+(problem|question|calculation)/i,
			/formula\s+(for|to|of)/i,
		]

		return mathKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			mathPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect multi-language codebase tasks
	 */
	private _detectMultiLanguageTask(lowerMessage: string): boolean {
		const multiLangKeywords = [
			'translate code', 'convert to', 'port to', 'rewrite in', 'convert from',
			'multiple languages', 'different language', 'language conversion'
		]
		const multiLangPatterns = [
			/translate\s+(code|this|from|to)/i,
			/convert\s+(code|this|from|to)/i,
			/port\s+(to|from)/i,
			/rewrite\s+in/i,
		]

		return multiLangKeywords.some(keyword => lowerMessage.includes(keyword)) ||
			multiLangPatterns.some(pattern => pattern.test(lowerMessage))
	}

	/**
	 * Detect complex multi-step tasks
	 */
	private _detectMultiStepTask(lowerMessage: string): boolean {
		// Multiple action verbs or "and" in requests indicate multi-step tasks
		const actionVerbs = ['implement', 'create', 'add', 'build', 'make', 'set up', 'configure', 'write', 'generate', 'develop', 'fix', 'update', 'modify']
		const verbCount = actionVerbs.filter(verb => lowerMessage.includes(verb)).length

		// Multiple "and" conjunctions suggest multiple steps
		const andCount = (lowerMessage.match(/\sand\s/g) || []).length

		// Multi-step indicators
		const multiStepKeywords = ['then', 'after that', 'next', 'also', 'additionally', 'furthermore', 'step', 'steps']
		const hasMultiStepKeywords = multiStepKeywords.some(keyword => lowerMessage.includes(keyword))

		return verbCount >= 2 || andCount >= 2 || hasMultiStepKeywords
	}



	private _swapOutLatestStreamingToolWithResult = (threadId: string, tool: ChatMessage & { role: 'tool' }) => {
		const messages = this.state.allThreads[threadId]?.messages
		if (!messages) return false
		const lastMsg = messages[messages.length - 1]
		if (!lastMsg) return false

		if (lastMsg.role === 'tool' && lastMsg.type !== 'invalid_params') {
			this._editMessageInThread(threadId, messages.length - 1, tool)
			return true
		}
		return false
	}
	private _updateLatestTool = (threadId: string, tool: ChatMessage & { role: 'tool' }) => {
		const swapped = this._swapOutLatestStreamingToolWithResult(threadId, tool)
		if (swapped) return
		this._addMessageToThread(threadId, tool)
	}

	approveLatestToolRequest(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		const lastMsg = thread.messages[thread.messages.length - 1]
		if (!(lastMsg.role === 'tool' && lastMsg.type === 'tool_request')) return // should never happen

		const callThisToolFirst: ToolMessage<ToolName> = lastMsg

		this._wrapRunAgentToNotify(
			this._runChatAgent({ callThisToolFirst, threadId, ...this._currentModelSelectionProps() })
			, threadId
		)
	}
	rejectLatestToolRequest(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		const lastMsg = thread.messages[thread.messages.length - 1]

		let params: ToolCallParams<ToolName>
		if (lastMsg.role === 'tool' && lastMsg.type !== 'invalid_params') {
			params = lastMsg.params
		}
		else return

		const { name, id, rawParams, mcpServerName } = lastMsg

		const errorMessage = this.toolErrMsgs.rejected
		this._updateLatestTool(threadId, { role: 'tool', type: 'rejected', params: params, name: name, content: errorMessage, result: null, id, rawParams, mcpServerName })
		this._setStreamState(threadId, undefined)
	}

	// Plan management methods
	// NOTE: Plans are not auto-generated yet. They need to be created manually or via LLM generation.
	// To test the UI, you can create a plan manually like:
	// chatThreadService.addTestPlan({ threadId: 'xxx', summary: 'Test plan', steps: [...] })

	approvePlan(opts: { threadId: string, messageIdx: number }) {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const updatedPlan: PlanMessage = {
			...plan,
			approvalState: 'approved',
			approvedAt: Date.now(),
			executionStartTime: Date.now(),
			steps: plan.steps.map(step => ({
				...step,
				status: step.disabled ? 'skipped' as StepStatus : (step.status || 'queued' as StepStatus)
			}))
		}
		this._editMessageInThread(opts.threadId, opts.messageIdx, updatedPlan)
		// CRITICAL: Invalidate plan cache so checkPlanGenerated() sees the updated approvalState
		this._planCache.delete(opts.threadId)
		// Trigger plan execution
		this._wrapRunAgentToNotify(
			this._runChatAgent({ threadId: opts.threadId, ...this._currentModelSelectionProps() }),
			opts.threadId,
		)
	}

	rejectPlan(opts: { threadId: string, messageIdx: number }) {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const updatedPlan: PlanMessage = {
			...plan,
			approvalState: 'aborted'
		}
		this._editMessageInThread(opts.threadId, opts.messageIdx, updatedPlan)
	}

	editPlan(opts: { threadId: string, messageIdx: number, updatedPlan: PlanMessage }) {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		this._editMessageInThread(opts.threadId, opts.messageIdx, opts.updatedPlan)
	}

	toggleStepDisabled(opts: { threadId: string, messageIdx: number, stepNumber: number }) {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const updatedPlan: PlanMessage = {
			...plan,
			steps: plan.steps.map(step =>
				step.stepNumber === opts.stepNumber
					? { ...step, disabled: !step.disabled }
					: step
			)
		}
		this._editMessageInThread(opts.threadId, opts.messageIdx, updatedPlan)
	}

	reorderPlanSteps(opts: { threadId: string, messageIdx: number, newStepOrder: number[] }) {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const stepMap = new Map(plan.steps.map(s => [s.stepNumber, s]))
		const reorderedSteps = opts.newStepOrder
			.map(stepNum => stepMap.get(stepNum))
			.filter((s): s is PlanStep => s !== undefined)
			.map((step, idx) => ({ ...step, stepNumber: idx + 1 }))

		const updatedPlan: PlanMessage = {
			...plan,
			steps: reorderedSteps
		}
		this._editMessageInThread(opts.threadId, opts.messageIdx, updatedPlan)
	}

	async pauseAgentExecution(opts: { threadId: string }): Promise<void> {
		// TODO: Implement pause logic - freeze current step, save state
		await this.abortRunning(opts.threadId)
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return

		// Find current plan and update current step to paused
		const planIdx = findLastIdx(thread.messages, (m: ChatMessage) => m.role === 'plan') ?? -1
		if (planIdx >= 0) {
			const plan = thread.messages[planIdx] as PlanMessage
			const runningStepIdx = plan.steps.findIndex(s => s.status === 'running')
			if (runningStepIdx >= 0) {
				const updatedSteps = [...plan.steps]
				updatedSteps[runningStepIdx] = { ...updatedSteps[runningStepIdx], status: 'paused' }
				const updatedPlan: PlanMessage = { ...plan, steps: updatedSteps }
				this._editMessageInThread(opts.threadId, planIdx, updatedPlan)
			}
		}
	}

	async resumeAgentExecution(opts: { threadId: string }): Promise<void> {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return

		const planIdx = findLastIdx(thread.messages, (m: ChatMessage) => m.role === 'plan') ?? -1
		if (planIdx >= 0) {
			const plan = thread.messages[planIdx] as PlanMessage
			const pausedStepIdx = plan.steps.findIndex(s => s.status === 'paused')
			if (pausedStepIdx >= 0) {
				const updatedSteps = [...plan.steps]
				updatedSteps[pausedStepIdx] = { ...updatedSteps[pausedStepIdx], status: 'queued' }
				const updatedPlan: PlanMessage = {
					...plan,
					steps: updatedSteps,
					approvalState: 'executing'
				}
				this._editMessageInThread(opts.threadId, planIdx, updatedPlan)
				// Resume execution from this step
				this._wrapRunAgentToNotify(
					this._runChatAgent({ threadId: opts.threadId, ...this._currentModelSelectionProps() }),
					opts.threadId,
				)
			}
		}
	}

	async retryStep(opts: { threadId: string, messageIdx: number, stepNumber: number }): Promise<void> {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const updatedSteps = plan.steps.map(step =>
			step.stepNumber === opts.stepNumber
				? { ...step, status: 'queued' as StepStatus, error: undefined, startTime: undefined, endTime: undefined }
				: step
		)
		const updatedPlan: PlanMessage = {
			...plan,
			steps: updatedSteps,
			approvalState: plan.approvalState === 'completed' ? 'executing' : plan.approvalState
		}
		this._editMessageInThread(opts.threadId, opts.messageIdx, updatedPlan)
		// Trigger step execution
		this._wrapRunAgentToNotify(
			this._runChatAgent({ threadId: opts.threadId, ...this._currentModelSelectionProps() }),
			opts.threadId,
		)
	}

	skipStep(opts: { threadId: string, messageIdx: number, stepNumber: number }) {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const updatedSteps = plan.steps.map(step =>
			step.stepNumber === opts.stepNumber
				? { ...step, status: 'skipped' as StepStatus }
				: step
		)
		const updatedPlan: PlanMessage = { ...plan, steps: updatedSteps }
		this._editMessageInThread(opts.threadId, opts.messageIdx, updatedPlan)

		// After skipping, resume execution to continue with the next queued step
		this._wrapRunAgentToNotify(
			this._runChatAgent({ threadId: opts.threadId, ...this._currentModelSelectionProps() }),
			opts.threadId,
		)
	}

	async rollbackToStep(opts: { threadId: string, messageIdx: number, stepNumber: number }): Promise<void> {
		const thread = this.state.allThreads[opts.threadId]
		if (!thread) return
		const message = thread.messages[opts.messageIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const step = plan.steps.find(s => s.stepNumber === opts.stepNumber)
		if (!step || step.checkpointIdx === undefined || step.checkpointIdx === null) return

		// Rollback to checkpoint before this step
		this.jumpToCheckpointBeforeMessageIdx({
			threadId: opts.threadId,
			messageIdx: step.checkpointIdx,
			jumpToUserModified: false
		})
	}

	// Plan execution tracking helpers - cached for performance
	private _planCache: Map<string, { plan: PlanMessage, planIdx: number, lastChecked: number } | null> = new Map()
	private readonly PLAN_CACHE_TTL = 100 // ms - invalidate cache after message changes

	private _getCurrentPlan(threadId: string, forceRefresh = false): { plan: PlanMessage, planIdx: number } | undefined {
		const thread = this.state.allThreads[threadId]
		if (!thread) return undefined

		// Fast path: check cache first (only if messages haven't changed significantly)
		if (!forceRefresh) {
			const cached = this._planCache.get(threadId)
			if (cached && cached.lastChecked > Date.now() - this.PLAN_CACHE_TTL && cached.planIdx < thread.messages.length) {
				// Verify cached plan is still valid
				const cachedPlan = thread.messages[cached.planIdx]
				if (cachedPlan && cachedPlan.role === 'plan') {
					const plan = cachedPlan as PlanMessage
					// Return plan regardless of approvalState (pending, approved, executing all need to be seen)
					return { plan, planIdx: cached.planIdx }
				}
			}
		}

		// Slow path: find plan (only when cache misses or forced)
		const planIdx = findLastIdx(thread.messages, (m: ChatMessage) => m.role === 'plan') ?? -1
		if (planIdx < 0) {
			this._planCache.set(threadId, null)
			return undefined
		}
		const plan = thread.messages[planIdx] as PlanMessage

		// Cache result (for all approval states)
		const result = { plan, planIdx, lastChecked: Date.now() }
		this._planCache.set(threadId, result)
		return { plan, planIdx }
	}

	private _getCurrentStep(threadId: string, forceRefresh = false): { plan: PlanMessage, planIdx: number, step: PlanStep, stepIdx: number } | undefined {
		const planInfo = this._getCurrentPlan(threadId, forceRefresh)
		if (!planInfo) return undefined
		const { plan, planIdx } = planInfo

		// Find first step that's queued or running
		const stepIdx = plan.steps.findIndex(s =>
			!s.disabled && (s.status === 'queued' || s.status === 'running' || s.status === 'paused')
		)
		if (stepIdx < 0) return undefined

		return { plan, planIdx, step: plan.steps[stepIdx], stepIdx }
	}

	/**
	 * PERFORMANCE: Generate cache key for message preparation
	 * Key is based on chatMessages content, modelSelection, chatMode, and repoIndexer results
	 */
	private _getMessagePrepCacheKey(
		chatMessages: any[],
		modelSelection: ModelSelection | null,
		chatMode: ChatMode,
		repoIndexerResults: { results: string[]; metrics: any } | null | undefined,
		subagentSystemPrompt?: string,
		allowedToolNames?: string[]
	): string {
		// Create stable hash from inputs
		const modelKey = modelSelection ? `${modelSelection.providerName}:${modelSelection.modelName}` : 'null';
		const messagesHash = JSON.stringify(chatMessages.map(m => ({
			role: m.role,
			content: typeof m.content === 'string' ? m.content.substring(0, 100) : m.content, // Truncate for hash
			id: m.id
		})));
		const repoIndexerKey = repoIndexerResults ? JSON.stringify(repoIndexerResults.results.slice(0, 10)) : 'null';
		// Include the sub-agent role so a custom-agent child never reuses a normal-turn prep (or vice-versa).
		// Use the FULL prompt (not a length+prefix digest): two custom agents can share the same first 60
		// chars and length yet differ later, which would collide and poison one with the other's prep.
		// Matches the cloud system-message cache key (convertToLLMMessageService), which also keys on the
		// full prompt.
		const subagentKey = subagentSystemPrompt ? `sa:${subagentSystemPrompt}` : '';
		const toolsKey = allowedToolNames ? `tools:${allowedToolNames.join('+')}` : '';
		return `${modelKey}|${chatMode}|${messagesHash}|${repoIndexerKey}|${subagentKey}|${toolsKey}`;
	}

	/**
	 * PERFORMANCE: Compute token count and context size from prepared messages (cached)
	 */
	private _computeTokenCount(messages: any[]): { tokenCount: number; contextSize: number } {
		const estimateTokens = (text: string) => Math.ceil(text.length / 4);
		let tokenCount = 0;
		let contextSize = 0;

		for (const m of messages) {
			// Handle Gemini messages (use 'parts' instead of 'content')
			if ('parts' in m) {
				for (const part of m.parts) {
					if ('text' in part && typeof part.text === 'string') {
						tokenCount += estimateTokens(part.text);
						contextSize += part.text.length;
					} else if ('inlineData' in part) {
						// Rough estimate: ~85 tokens per image + base64 overhead
						tokenCount += 100;
					}
				}
			}
			// Handle Anthropic/OpenAI messages (use 'content')
			else if ('content' in m) {
				if (typeof m.content === 'string') {
					tokenCount += estimateTokens(m.content);
					contextSize += m.content.length;
				} else if (Array.isArray(m.content)) {
					// Handle OpenAI format with image_url parts
					for (const part of m.content) {
						if (part.type === 'text') {
							tokenCount += estimateTokens(part.text);
							contextSize += part.text.length;
						} else if (part.type === 'image_url') {
							// Rough estimate: ~85 tokens per image + base64 overhead
							tokenCount += 100;
						}
					}
				} else {
					const jsonStr = JSON.stringify(m.content);
					tokenCount += estimateTokens(jsonStr);
					contextSize += jsonStr.length;
				}
			}
		}

		return { tokenCount, contextSize };
	}

	private _updatePlanStep(threadId: string, planIdx: number, stepIdx: number, updates: Partial<PlanStep>) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const message = thread.messages[planIdx]
		if (!message || message.role !== 'plan') return

		const plan = message as PlanMessage
		const updatedSteps = [...plan.steps]
		updatedSteps[stepIdx] = { ...updatedSteps[stepIdx], ...updates }
		const updatedPlan: PlanMessage = { ...plan, steps: updatedSteps }
		this._editMessageInThread(threadId, planIdx, updatedPlan)
		// PERFORMANCE: Update cache in place instead of invalidating
		// This avoids expensive re-lookup on next access
		const cached = this._planCache.get(threadId)
		if (cached && cached.planIdx === planIdx) {
			// Update cached plan directly - same plan, just updated steps
			cached.plan = updatedPlan
			cached.lastChecked = Date.now()
		} else {
			// Cache miss or different plan - invalidate to be safe
			this._planCache.delete(threadId)
		}
	}

	// Fast internal versions that take step directly (avoid lookup)
	private _linkToolCallToStepInternal(threadId: string, toolId: string, currentStep: { plan: PlanMessage, planIdx: number, step: PlanStep, stepIdx: number }, stepNumber?: number) {
		const { planIdx, step, stepIdx } = currentStep
		// If stepNumber provided, verify it matches
		if (stepNumber !== undefined && step.stepNumber !== stepNumber) return

		const toolCalls = step.toolCalls || []
		if (!toolCalls.includes(toolId)) {
			this._updatePlanStep(threadId, planIdx, stepIdx, {
				toolCalls: [...toolCalls, toolId]
			})
		}
	}

	private _markStepCompletedInternal(threadId: string, currentStep: { plan: PlanMessage, planIdx: number, step: PlanStep, stepIdx: number }, succeeded: boolean, error?: string): { plan: PlanMessage, planIdx: number, step: PlanStep, stepIdx: number } | undefined {
		const { planIdx, stepIdx } = currentStep

		const updates: Partial<PlanStep> = {
			status: succeeded ? 'succeeded' : 'failed',
			endTime: Date.now(),
			error: error
		}
		this._updatePlanStep(threadId, planIdx, stepIdx, updates)

		// PERFORMANCE: Return updated step info to avoid re-lookup
		// Get updated plan from cache (should be fresh after _updatePlanStep)
		const cached = this._planCache.get(threadId)
		if (cached && cached.planIdx === planIdx) {
			const updatedStep = cached.plan.steps[stepIdx]
			if (updatedStep) {
				return { plan: cached.plan, planIdx, step: updatedStep, stepIdx }
			}
		}
		// Fallback: re-fetch if cache miss (shouldn't happen, but safe)
		return this._getCurrentStep(threadId, false)
	}

	private _startNextStep(threadId: string): { step: PlanStep, stepIdx: number, planIdx: number, plan: PlanMessage, checkpointIdx: number } | undefined {
		// PERFORMANCE: Use cached plan if available, only force refresh if needed
		const planInfo = this._getCurrentPlan(threadId, false) // Try cache first
		if (!planInfo) {
			// Cache miss - do full refresh
			const refreshed = this._getCurrentPlan(threadId, true)
			if (!refreshed) return undefined
			const { plan, planIdx } = refreshed

			// Find next queued step (not disabled, queued status)
			const stepIdx = plan.steps.findIndex(s =>
				!s.disabled && s.status === 'queued'
			)
			if (stepIdx < 0) return undefined

			// Create checkpoint before starting step
			this._addUserCheckpoint({ threadId })
			const thread = this.state.allThreads[threadId]
			if (!thread) return undefined
			const checkpointIdx = thread.messages.length - 1

			// Update step to running and link checkpoint
			this._updatePlanStep(threadId, planIdx, stepIdx, {
				status: 'running',
				startTime: Date.now(),
				checkpointIdx: checkpointIdx
			})

			// Get updated plan from cache
			const cached = this._planCache.get(threadId)
			const updatedPlan = (cached && cached.planIdx === planIdx) ? cached.plan : plan
			const updatedStep = updatedPlan.steps[stepIdx]

			return { step: updatedStep, stepIdx, planIdx, plan: updatedPlan, checkpointIdx }
		}

		const { plan, planIdx } = planInfo

		// Find next queued step (not disabled, queued status)
		const stepIdx = plan.steps.findIndex(s =>
			!s.disabled && s.status === 'queued'
		)
		if (stepIdx < 0) return undefined

		// Create checkpoint before starting step
		this._addUserCheckpoint({ threadId })
		const thread = this.state.allThreads[threadId]
		if (!thread) return undefined
		const checkpointIdx = thread.messages.length - 1

		// Update step to running and link checkpoint
		this._updatePlanStep(threadId, planIdx, stepIdx, {
			status: 'running',
			startTime: Date.now(),
			checkpointIdx: checkpointIdx
		})

		// Get updated plan from cache (should be fresh after _updatePlanStep)
		const cached = this._planCache.get(threadId)
		const updatedPlan = (cached && cached.planIdx === planIdx) ? cached.plan : plan
		const updatedStep = updatedPlan.steps[stepIdx]

		return { step: updatedStep, stepIdx, planIdx, plan: updatedPlan, checkpointIdx }
	}

	private _computeMCPServerOfToolName = (toolName: string) => {
		return this._mcpService.getMCPTools()?.find(t => t.name === toolName)?.mcpServerName
	}

	// Check if user request warrants plan generation
	private _shouldGeneratePlan(threadId: string): boolean {
		// Honor one-shot suppression flag (used by simple Quick Actions)
		if (this._suppressPlanOnceByThread[threadId]) {
			delete this._suppressPlanOnceByThread[threadId]
			return false
		}
		const thread = this.state.allThreads[threadId]
		if (!thread) return false

		const lastUserMessage = thread.messages.filter(m => m.role === 'user').pop()
		if (!lastUserMessage || lastUserMessage.role !== 'user') return false

		const userRequest = (lastUserMessage.displayContent || '').toLowerCase()

		// Detect complex multi-step tasks that should have plans
		const complexTaskIndicators = [
			// Multi-step operations
			'create.*system', 'build.*system', 'implement.*system', 'set up.*system',
			'refactor', 'refactoring',
			'migrate', 'migration',
			'add.*and.*test', 'create.*and.*add', 'implement.*and.*test',
			'setup', 'set up', 'configure',
			// Multi-file operations
			'multiple.*file', 'several.*file', 'all.*file',
			'create.*with', 'add.*with.*and',
			// Structured requests
			'authentication.*system', 'api.*with.*tests', 'full.*stack'
		]

		const hasComplexIndicator = complexTaskIndicators.some(pattern => {
			const regex = new RegExp(pattern, 'i')
			return regex.test(userRequest)
		})

		// Also check for multiple action verbs (suggests multiple steps)
		const actionVerbs = ['create', 'add', 'edit', 'delete', 'update', 'refactor', 'implement', 'build', 'set up', 'configure', 'test']
		const actionCount = actionVerbs.filter(verb => userRequest.includes(verb)).length

		return hasComplexIndicator || actionCount >= 3
	}

	// Generate plan from user request by asking LLM
	private async _generatePlanFromUserRequest(
		threadId: string,
		modelSelection: ModelSelection | null,
		modelSelectionOptions: ModelSelectionOptions | undefined
	): Promise<void> {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		const lastUserMessage = thread.messages.filter(m => m.role === 'user').pop()
		if (!lastUserMessage || lastUserMessage.role !== 'user') return

		const userRequest = lastUserMessage.displayContent || ''

		// Prepare messages for plan generation
		const planPrompt = `The user has requested: "${userRequest}"

Please generate a structured execution plan for this task. Output your plan in the following JSON format:

{
  "summary": "Brief overall plan summary",
  "steps": [
    {
      "stepNumber": 1,
      "description": "Step description",
      "tools": ["tool_name1", "tool_name2"],
      "files": ["path/to/file1.ts", "path/to/file2.ts"]
    },
    {
      "stepNumber": 2,
      "description": "Next step description",
      "tools": ["tool_name"],
      "files": ["path/to/file.ts"]
    }
  ]
}

Think through the task carefully. Break it down into logical steps. For each step:
- Describe what needs to be done
- List the tools that will be needed (e.g., read_file, edit_file, create_file_or_folder, run_command, search_for_files)
- List files that will be affected (if known or likely)

Output ONLY the JSON, no other text. Start with { and end with }.`

		// Send plan generation request
		const chatMessages = thread.messages.slice(0, -1) // All messages except last user message
		const planRequest: ChatMessage = {
			role: 'user',
			content: planPrompt,
			displayContent: planPrompt,
			selections: null,
			state: { stagingSelections: [], isBeingEdited: false }
		}

		const { messages } = await this._convertToLLMMessagesService.prepareLLMChatMessages({
			chatMessages: [...chatMessages, planRequest],
			modelSelection,
			chatMode: 'normal' // Use 'normal' mode to prevent tool execution during plan generation
		})

		this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: 'Generating execution plan...', reasoningSoFar: '', toolCallSoFar: null }, interrupt: Promise.resolve(() => { }) })

		// Create a promise that resolves when the plan is generated
		return new Promise<void>((resolve, reject) => {
			try {
				const llmCancelToken = this._llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					chatMode: 'normal', // Normal mode - no tool execution
					messages: messages,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel: this._settingsService.state.overridesOfModel,
					logging: { loggingName: 'Plan Generation', loggingExtras: { threadId } },
					separateSystemMessage: undefined,
					onText: ({ fullText }) => {
						// Don't show raw JSON to user - just show "Generating plan..."
						this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: 'Generating execution plan...', reasoningSoFar: '', toolCallSoFar: null }, interrupt: Promise.resolve(() => { if (llmCancelToken) this._llmMessageService.abort(llmCancelToken) }) })
					},
					onFinalMessage: async ({ fullText }) => {
						// Parse plan from LLM response
						try {
							// Try to extract JSON from response
							const jsonMatch = fullText.match(/\{[\s\S]*\}/)
							if (jsonMatch) {
								const planData = JSON.parse(jsonMatch[0])
								const planMessage: PlanMessage = {
									role: 'plan',
									type: 'agent_plan',
									summary: planData.summary || 'Execution plan',
									steps: (planData.steps || []).map((step: any, idx: number) => ({
										stepNumber: step.stepNumber || idx + 1,
										description: step.description || `Step ${idx + 1}`,
										tools: step.tools || [],
										files: step.files || [],
										status: 'queued' as StepStatus
									})),
									approvalState: 'pending'
								}

								// Add plan to thread (DO NOT add assistant message - hide the raw JSON)
								this._addMessageToThread(threadId, planMessage)
								// CRITICAL: Invalidate cache immediately so subsequent checks see the new plan
								this._planCache.delete(threadId)
								// CRITICAL: Stop execution immediately - set state to idle (don't abort which adds messages)
								// NOTE: The flag will be checked in the main execution loop
								this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
								resolve() // Resolve when plan is successfully added
							} else {
								// Failed to parse - add as assistant message explaining we couldn't parse
								this._addMessageToThread(threadId, {
									role: 'assistant',
									displayContent: 'I attempted to create a plan but had difficulty parsing it. Proceeding with direct execution...\n\n' + fullText,
									reasoning: '',
									anthropicReasoning: null
								})
								this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
								resolve() // Still resolve - let normal execution continue
							}
						} catch (parseError) {
							console.error('Failed to parse plan from LLM:', parseError)
							// Add as assistant message
							this._addMessageToThread(threadId, {
								role: 'assistant',
								displayContent: 'I attempted to create a plan but encountered an error. Proceeding with direct execution...\n\n' + fullText,
								reasoning: '',
								anthropicReasoning: null
							})
							this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
							resolve() // Still resolve - let normal execution continue
						}
					},
					onError: async (error) => {
						// Plan generation is an OPTIMIZATION, not required. If the model errors here (rate-limit /
						// free-tier exhaustion / transient), do NOT dead-end on the error — fall through to direct
						// execution, where the agent loop's model-failover escalates to another configured model
						// (your local model, or a BYO cloud key like Pollinations). Resolving with NO plan added
						// makes the caller proceed to the normal tool loop. Without this, a complex/destructive
						// request (which triggers planning) stranded the user on the exhaustion message before the
						// failover-capable loop ever ran. (findings: live free-tier-exhaustion bug)
						console.error('[ChatThreadService] plan generation failed; proceeding to direct execution so failover can run:', error?.message)
						this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
						resolve()
					},
					onAbort: () => {
						this._setStreamState(threadId, undefined)
						reject(new Error('Plan generation aborted'))
					},
				})

				if (!llmCancelToken) {
					this._setStreamState(threadId, { isRunning: undefined, error: { message: 'Failed to generate plan', fullError: null } })
					reject(new Error('Failed to start plan generation'))
				}
			} catch (error) {
				this._setStreamState(threadId, { isRunning: undefined, error: { message: 'Error generating plan', fullError: error instanceof Error ? error : null } })
				reject(error)
			}
		})
	}

	async abortRunning(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		// Propagate the abort to any in-flight sub-agent children spawned from this thread, so stopping
		// the parent doesn't leave a child agent running in the background. (Depth 1 — no nesting.)
		const childThreads = this._childThreadsByParent.get(threadId)
		if (childThreads && childThreads.size > 0) {
			for (const childId of [...childThreads]) {
				await this.abortRunning(childId)
			}
		}

		// add assistant message
		if (this.streamState[threadId]?.isRunning === 'LLM') {
			const { displayContentSoFar, reasoningSoFar, toolCallSoFar } = this.streamState[threadId].llmInfo
			this._addMessageToThread(threadId, { role: 'assistant', displayContent: displayContentSoFar, reasoning: reasoningSoFar, anthropicReasoning: null })
			if (toolCallSoFar) this._addMessageToThread(threadId, { role: 'interrupted_streaming_tool', name: toolCallSoFar.name, mcpServerName: this._computeMCPServerOfToolName(toolCallSoFar.name) })
		}
		// add tool that's running
		else if (this.streamState[threadId]?.isRunning === 'tool') {
			const { toolName, toolParams, id, content: content_, rawParams, mcpServerName } = this.streamState[threadId].toolInfo
			const content = content_ || this.toolErrMsgs.interrupted
			this._updateLatestTool(threadId, { role: 'tool', name: toolName, params: toolParams, id, content, rawParams, type: 'rejected', result: null, mcpServerName })
		}
		// reject the tool for the user if relevant
		else if (this.streamState[threadId]?.isRunning === 'awaiting_user') {
			this.rejectLatestToolRequest(threadId)
		}
		else if (this.streamState[threadId]?.isRunning === 'idle') {
			// do nothing
		}

		this._addUserCheckpoint({ threadId })

		// interrupt any effects
		const interrupt = await this.streamState[threadId]?.interrupt
		if (typeof interrupt === 'function')
			interrupt()


		this._setStreamState(threadId, undefined)
	}



	private readonly toolErrMsgs = {
		rejected: 'Tool call was rejected by the user.',
		interrupted: 'Tool call was interrupted by the user.',
		errWhenStringifying: (error: any) => `Tool call succeeded, but there was an error stringifying the output.\n${getErrorMessage(error)}`
	}


	// private readonly _currentlyRunningToolInterruptor: { [threadId: string]: (() => void) | undefined } = {}


	// returns true when the tool call is waiting for user approval
	/**
	 * Parses JSON tool call format from text response.
	 * Some models output tool calls as JSON text instead of using native tool calling.
	 * Example: {"name": "delete_file_or_folder", "arguments": {"uri": "/path", "is_recursive": true}}
	 */
	/**
	 * Synthesizes a tool call from user intent when the model refuses to use tools.
	 * This ensures Agent Mode works even with models that don't follow tool calling instructions.
	 */
	private _synthesizeToolCallFromIntent(userRequest: string, originalRequest: string): { toolName: string, toolParams: RawToolParamsObj } | null {
		const lowerRequest = userRequest.toLowerCase()

		// Extract key terms from the request
		const extractKeywords = (text: string): string[] => {
			const words = text.split(/\s+/).filter(w => w.length > 2)
			const stopWords = ['the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'can', 'you', 'add', 'create', 'make', 'do']
			return words.filter(w => !stopWords.includes(w.toLowerCase())).slice(0, 5)
		}

		// Handle web search queries - expanded patterns
		if (lowerRequest.includes('search the web') || lowerRequest.includes('search online') || lowerRequest.includes('look up') ||
			lowerRequest.includes('check online') || lowerRequest.includes('go online') || lowerRequest.includes('look online') || lowerRequest.includes('search the internet') || lowerRequest.includes('on the internet') ||
			lowerRequest.includes('check the web') || lowerRequest.includes('check the internet') || lowerRequest.includes('check internet') ||
			lowerRequest.includes('look it up') || lowerRequest.includes('find information') ||
			lowerRequest.includes('tell me what you know about') || lowerRequest.includes('what do you know about') ||
			lowerRequest.includes('google') || lowerRequest.includes('duckduckgo') ||
			(lowerRequest.includes('search for') && lowerRequest.includes('on the web')) ||
			(lowerRequest.includes('search for') && lowerRequest.includes('on the internet')) ||
			(lowerRequest.includes('what is') || lowerRequest.includes('what are') || lowerRequest.includes('who is') || lowerRequest.includes('when did')) &&
			(lowerRequest.includes('latest') || lowerRequest.includes('current') || lowerRequest.includes('recent') || lowerRequest.includes('2024') || lowerRequest.includes('2025'))) {
			// Build the query from the request SUBJECT, not the command framing. The old approach
			// (first 5 words after a tiny stop-word list) turned "check online and tell me when SpaceX
			// IPO'd" into "check online and tell when" -> DuckDuckGo returned "check online" (DVLA)
			// results and the agent honestly reported it found nothing, with "SpaceX IPO" dropped.
			// extractWebSearchQuery strips the web-intent triggers + framing and keeps the subject.
			const query = extractWebSearchQuery(originalRequest)
			return {
				toolName: 'web_search',
				toolParams: {
					query: query,
					k: '5'
				}
			}
		}

		// Handle URL browsing requests
		if (lowerRequest.includes('open url') || lowerRequest.includes('fetch url') || lowerRequest.includes('browse url') ||
			lowerRequest.includes('read url') || lowerRequest.includes('get content from') ||
			(lowerRequest.match(/https?:\/\//) && (lowerRequest.includes('read') || lowerRequest.includes('open') || lowerRequest.includes('fetch')))) {
			const urlMatch = originalRequest.match(/(https?:\/\/[^\s]+)/i)
			if (urlMatch) {
				return {
					toolName: 'browse_url',
					toolParams: {
						url: urlMatch[1]
					}
				}
			}
		}

		// Handle codebase queries - need to search for relevant files to answer
		if (lowerRequest.includes('codebase') || lowerRequest.includes('code base') || lowerRequest.includes('repository') || lowerRequest.includes('repo') ||
			(lowerRequest.includes('what') && (lowerRequest.includes('project') || lowerRequest.includes('about'))) ||
			(lowerRequest.includes('how many') && (lowerRequest.includes('endpoint') || lowerRequest.includes('api')))) {
			// User is asking about the codebase - search for overview files first
			const keywords = extractKeywords(originalRequest)
			const query = keywords.length > 0 ? keywords.join(' ') : 'readme package.json server api route endpoint'

			return {
				toolName: 'search_for_files',
				toolParams: {
					query: query
				}
			}
		}

		// Determine intent and synthesize appropriate tool call
		if (lowerRequest.includes('endpoint') || lowerRequest.includes('route') || lowerRequest.includes('api')) {
			// User wants to add an endpoint - start by searching for server/route files
			const keywords = extractKeywords(originalRequest).filter(k => !['dummy', 'endpoint', 'backend'].includes(k.toLowerCase()))
			const query = keywords.length > 0 ? keywords.join(' ') : 'server route api endpoint'

			return {
				toolName: 'search_for_files',
				toolParams: {
					query: query
				}
			}
		} else if (lowerRequest.includes('file') && (lowerRequest.includes('create') || lowerRequest.includes('add') || lowerRequest.includes('make'))) {
			// User wants to create a file. Prefer a real filename token (something.ext) — e.g. "create a file
			// fib.py" must yield "fib.py", NOT the trigger word "file" (the old `k.length > 3` matched "file"
			// itself, creating a file literally named "file"). Fall back to a name after "called"/"named", then
			// a content keyword, then a sensible default. (finding #12)
			const keywords = extractKeywords(originalRequest)
			const extMatch = originalRequest.match(/([\w\-./]+\.[a-z0-9]{1,8})(?:\b|$)/i)
			const namedMatch = originalRequest.match(/(?:called|named)\s+([\w\-./]+)/i)
			const fileName = (extMatch && extMatch[1])
				|| (namedMatch && namedMatch[1])
				|| keywords.find(k => k.includes('.'))
				|| keywords.find(k => k.length > 3 && k.toLowerCase() !== 'file')
				|| 'newfile.txt'

			return {
				toolName: 'create_file_or_folder',
				toolParams: {
					uri: fileName.startsWith('/') ? fileName : `/${fileName}`,
					type: 'file'
				}
			}
		} else if (lowerRequest.includes('open')) {
			// User wants to open a file in the editor
			const fileMatch = originalRequest.match(/([\w\/\.\-]+\.\w+)/i) ||
				originalRequest.match(/open\s+([\w\/\.\-]+)/i)
			if (fileMatch) {
				return {
					toolName: 'open_file',
					toolParams: {
						uri: fileMatch[1]
					}
				}
			}
		} else if (lowerRequest.includes('read') || lowerRequest.includes('show') || lowerRequest.includes('view')) {
			// User wants to read a file
			const fileMatch = originalRequest.match(/([\w\/\.\-]+\.\w+)/i)
			if (fileMatch) {
				return {
					toolName: 'read_file',
					toolParams: {
						uri: fileMatch[1],
						start_line: '1',
						end_line: '100'
					}
				}
			}
		} else if (lowerRequest.includes('add') && (lowerRequest.includes('comment') || lowerRequest.includes('note') || lowerRequest.includes('todo'))) {
			// User wants to add a comment - need to find the file first
			// Extract file name from request (e.g., "add comment to test.js" -> "test.js")
			const fileMatch = originalRequest.match(/(?:to|in|on|at)\s+([\w\/\.\-]+\.\w+)/i) ||
				originalRequest.match(/([\w\/\.\-]+\.\w+)/i)
			if (fileMatch) {
				return {
					toolName: 'read_file',
					toolParams: {
						uri: fileMatch[1],
						start_line: '1',
						end_line: '100'
					}
				}
			}
			// If no file specified, search for likely files
			const keywords = extractKeywords(originalRequest).filter(k => !['comment', 'note', 'todo', 'add'].includes(k.toLowerCase()))
			return {
				toolName: 'search_for_files',
				toolParams: {
					query: keywords.length > 0 ? keywords.join(' ') : 'file'
				}
			}
		} else if (lowerRequest.includes('edit') || lowerRequest.includes('modify') || lowerRequest.includes('change') || lowerRequest.includes('update')) {
			// User wants to edit a file - first need to find/read it
			const fileMatch = originalRequest.match(/(?:to|in|on|at)\s+([\w\/\.\-]+\.\w+)/i) ||
				originalRequest.match(/([\w\/\.\-]+\.\w+)/i)
			if (fileMatch) {
				return {
					toolName: 'read_file',
					toolParams: {
						uri: fileMatch[1],
						start_line: '1',
						end_line: '100'
					}
				}
			}
			const keywords = extractKeywords(originalRequest)
			return {
				toolName: 'search_for_files',
				toolParams: {
					query: keywords.join(' ') || 'file'
				}
			}
		}

		// Default: search for relevant files based on request
		const keywords = extractKeywords(originalRequest)
		return {
			toolName: 'search_for_files',
			toolParams: {
				query: keywords.join(' ') || originalRequest.slice(0, 50)
			}
		}
	}

	private async _buildEditContext(
		toolName: ToolName,
		toolParams: ToolCallParams<ToolName>,
		threadId: string
	): Promise<EditContext> {
		let uri: URI;
		let originalContent: string | undefined;
		let newContent: string | undefined;
		let textEdits: TextEdit[] | undefined;
		let operation: EditContext['operation'];

		// Get URI and operation type
		if (toolName === 'rewrite_file') {
			const params = toolParams as BuiltinToolCallParams['rewrite_file'];
			uri = params.uri;
			newContent = params.newContent;
			operation = 'rewrite_file';

			// Try to get original content
			try {
				const model = this._modelService.getModel(uri);
				if (model) {
					originalContent = model.getValue();
				}
			} catch {
				// Model not available
			}
		} else if (toolName === 'edit_file') {
			const params = toolParams as BuiltinToolCallParams['edit_file'];
			uri = params.uri;
			operation = 'edit_file';

			// Parse searchReplaceBlocks to extract text edits
			// This is a simplified version - actual parsing would need to handle the searchReplaceBlocks format
			// For now, we'll just check if file was read
			try {
				const model = this._modelService.getModel(uri);
				if (model) {
					originalContent = model.getValue();
				}
			} catch {
				// Model not available
			}
		} else if (toolName === 'create_file_or_folder') {
			const params = toolParams as BuiltinToolCallParams['create_file_or_folder'];
			uri = params.uri;
			operation = 'create_file_or_folder';
		} else if (toolName === 'delete_file_or_folder') {
			const params = toolParams as BuiltinToolCallParams['delete_file_or_folder'];
			uri = params.uri;
			operation = 'delete_file_or_folder';

			// Try to get original content before deletion
			try {
				const model = this._modelService.getModel(uri);
				if (model) {
					originalContent = model.getValue();
				}
			} catch {
				// Model not available
			}
		} else {
			throw new Error(`Unsupported tool for edit context: ${toolName}`);
		}

		// Check if file was read before (by checking thread history)
		let fileWasRead = false;
		try {
			const thread = this.state.allThreads[threadId];
			if (thread) {
				// Check if read_file was called for this URI in recent messages
				for (const message of thread.messages) {
					if (message.role === 'tool' && message.name === 'read_file') {
						// Check if message has params (not invalid_params type)
						if (message.type !== 'invalid_params' && 'params' in message) {
							const readParams = message.params as BuiltinToolCallParams['read_file'];
							if (readParams && readParams.uri.fsPath === uri.fsPath) {
								fileWasRead = true;
								break;
							}
						}
					}
				}
			}
		} catch {
			// Ignore errors
		}

		// Get model selection from thread state (if available)
		// Model selection is stored in the thread's last assistant message or stream state
		let modelSelection: ModelSelection | undefined;
		try {
			const thread = this.state.allThreads[threadId];
			if (thread) {
				// Try to get from the most recent assistant message that has model selection
				for (let i = thread.messages.length - 1; i >= 0; i--) {
					const msg = thread.messages[i];
					if (msg.role === 'assistant' && 'modelSelection' in msg) {
						modelSelection = (msg as any).modelSelection;
						break;
					}
				}
			}
		} catch {
			// Ignore errors
		}

		// Count total files in operation (simplified - assume 1 for now)
		// In a real implementation, we'd track batched operations
		const totalFilesInOperation = 1;

		return {
			uri,
			originalContent,
			newContent,
			textEdits,
			operation,
			fileWasRead,
			modelSelection: modelSelection ? {
				providerName: modelSelection.providerName,
				modelName: modelSelection.modelName,
			} : undefined,
			totalFilesInOperation,
		};
	}

	private _showAutoApplyNotification(
		editContext: EditContext,
		riskScore: EditRiskScore,
		toolName: ToolName
	): void {
		const fileName = editContext.uri.path.split('/').pop() || editContext.uri.path;
		const operationLabel = toolName === 'rewrite_file' ? 'rewritten' :
			toolName === 'edit_file' ? 'edited' :
				toolName === 'create_file_or_folder' ? 'created' :
					'modified';

		// Show brief, non-intrusive notification
		// Not sticky, auto-dismisses after a few seconds
		// Info severity (not warning) to be less intrusive
		this._notificationService.notify({
			severity: Severity.Info,
			message: localize('yolo.autoApplied', 'Auto-applied {0} to {1}', operationLabel, fileName),
			source: 'YOLO Mode',
			sticky: false, // Auto-dismiss
			actions: {
				primary: [{
					id: 'yolo.undo',
					label: localize('yolo.undo', 'Undo'),
					tooltip: localize('yolo.undoTooltip', 'Undo this edit'),
					class: undefined,
					enabled: true,
					run: async () => {
						// Trigger undo for the file
						try {
							await this._commandService.executeCommand('undo', editContext.uri);
							this._metricsService.capture('yolo_undo_clicked', {
								operation: toolName,
								riskScore: riskScore.riskScore,
							});
						} catch (error) {
							// Undo failed, show error
							this._notificationService.warn(localize('yolo.undoFailed', 'Could not undo edit. Use Ctrl+Z manually.'));
						}
					},
				}],
			},
		});
	}

	private _runToolCall = async (
		threadId: string,
		toolName: ToolName,
		toolId: string,
		mcpServerName: string | undefined,
		opts: { preapproved: true, unvalidatedToolParams: RawToolParamsObj, validatedParams: ToolCallParams<ToolName> } | { preapproved: false, unvalidatedToolParams: RawToolParamsObj },
		isLocal: boolean = false,
		chatMode: ChatMode = 'agent',
		isCapableLocalModel: boolean = false,
	): Promise<{ awaitingUserApproval?: boolean, interrupted?: boolean, completionSignaled?: boolean }> => {

		// compute these below
		let toolParams: ToolCallParams<ToolName>
		let toolResult: ToolResult<ToolName>
		let toolResultStr: string

		// Check if it's a built-in tool. NOTE: callers canonicalize the tool name before dispatch (see the
		// canonicalizeToolName call where `toolCall` is finalized, and the callThisToolFirst path) so that
		// aliased names (create_file -> create_file_or_folder, run -> run_command, ...) from native tool_calls
		// and the XML extractor resolve here instead of throwing `No tool named "create_file"` (finding #4).
		const isBuiltInTool = isABuiltinToolName(toolName)

		// --- Phase 1: dispatch-level mode/permission enforcement (the AUTHORITATIVE read-only boundary).
		// Runs BEFORE validation/approval/checkpoint/execution so a write/delete/terminal/MCP call in a
		// read-only mode (gather/plan) — or a network call under local-only — is hard-blocked even if a
		// weak/cloud/prompt-injected model fabricates it. The prompt-level tool catalog is advisory only.
		// We emit a recoverable invalid_params message (the loop's error-counter sees it) and bail; no UI
		// changes required. Does NOT depend on auto-approve (so terminal in gather is blocked, not merely
		// prompted). Sub-agents run with chatModeOverride 'agent', so this never blocks legitimate agent work.
		{
			const localOnly = this._settingsService.state.globalSettings.routingPolicy === 'local-only'
			// Workspace Trust: in an untrusted workspace, agentic mutation/terminal/MCP is disabled
			// (read/search still allowed) — opening a malicious repo cannot immediately drive edits.
			const workspaceTrusted = this._workspaceTrustService.isWorkspaceTrusted()
			const perm = checkToolAllowedInMode(toolName, chatMode, { isMCPTool: !isBuiltInTool, localOnly, workspaceTrusted })
			if (!perm.allowed) {
				this._addMessageToThread(threadId, { role: 'tool', type: 'invalid_params', rawParams: opts.unvalidatedToolParams, result: null, name: toolName, content: perm.reason ?? `Blocked: the "${toolName}" tool is not allowed in ${chatMode} mode.`, id: toolId, mcpServerName })
				return {}
			}
		}

		if (!opts.preapproved) { // skip this if pre-approved
			// 1. validate tool params
			try {
				if (isBuiltInTool) {
					// Parallel-edit phase 2: a sub-agent running in its own git worktree resolves + confines
					// file paths to that worktree (undefined for a normal run -> validateURI behaves as before).
					const workspaceRootOverride = this._workspaceRootOverrideByThread.get(threadId)
					const params = this._toolsService.validateParams[toolName](opts.unvalidatedToolParams, { workspaceRootOverride })
					toolParams = params
				}
				else {
					toolParams = opts.unvalidatedToolParams
				}
			}
			catch (error) {
				const errorMessage = getErrorMessage(error)
				this._addMessageToThread(threadId, { role: 'tool', type: 'invalid_params', rawParams: opts.unvalidatedToolParams, result: null, name: toolName, content: errorMessage, id: toolId, mcpServerName })
				return {}
			}
			// once validated, add checkpoint for edit
			if (toolName === 'edit_file') { this._addToolEditCheckpoint({ threadId, uri: (toolParams as BuiltinToolCallParams['edit_file']).uri }) }
			if (toolName === 'rewrite_file') { this._addToolEditCheckpoint({ threadId, uri: (toolParams as BuiltinToolCallParams['rewrite_file']).uri }) }
			// Phase 1 #2: journal the BEFORE-state of create/delete (the in-memory checkpoint can't undo these).
			if (toolName === 'create_file_or_folder') {
				const p = toolParams as BuiltinToolCallParams['create_file_or_folder']
				await this._recordFileOpBeforeMutation(threadId, p.uri, 'create', !!p.isFolder)
			}
			if (toolName === 'delete_file_or_folder') {
				const p = toolParams as BuiltinToolCallParams['delete_file_or_folder']
				await this._recordFileOpBeforeMutation(threadId, p.uri, 'delete', !!p.isFolder)
			}
			// Phase 1 #2: journal the BEFORE-content of edits too — the in-memory checkpoint only captures
			// a snapshot when the file already had a live editor model, so an edit to an unopened file
			// could not be rolled back. The durable journal is authoritative for the on-disk rollback.
			if (toolName === 'edit_file' || toolName === 'rewrite_file' || toolName === 'multi_edit') {
				const uri = (toolParams as BuiltinToolCallParams['edit_file' | 'rewrite_file' | 'multi_edit']).uri
				await this._recordFileOpBeforeMutation(threadId, uri, 'modify', false)
			}

			// 2. if tool requires approval, break from the loop, awaiting approval

			const approvalType = isBuiltInTool ? approvalTypeOfBuiltinToolName[toolName] : 'MCP tools'
			if (approvalType) {
				// Check YOLO mode for edit operations
				const isEditOperation = isBuiltInTool && (
					toolName === 'edit_file' ||
					toolName === 'rewrite_file' ||
					toolName === 'create_file_or_folder' ||
					toolName === 'delete_file_or_folder'
				);

				// Check YOLO mode for NL shell commands
				const isNLCommand = isBuiltInTool && toolName === 'run_nl_command';

				// Compute the scalar inputs the pure auto-approve policy needs, in the original order
				// (terminal command risk -> cwd containment -> YOLO NL heuristic -> edit risk scoring), then
				// make ONE decision via the tested common/autoApprovePolicy.decideAutoApprove. Side effects
				// (telemetry, the hard-block message, the auto-apply notification) stay here and are gated on
				// the decision's per-rule flags, so they fire exactly as the old inline code did.

				// (a) terminal command risk + cwd containment (run_command / run_persistent_command).
				let commandRisk: ReturnType<typeof classifyCommandRisk> | undefined;
				let cwdEscapes = false;
				if (approvalType === 'terminal' && isBuiltInTool && (toolName === 'run_command' || toolName === 'run_persistent_command')) {
					const command = (toolParams as BuiltinToolCallParams['run_command'] | BuiltinToolCallParams['run_persistent_command']).command;
					if (typeof command === 'string' && command.trim()) {
						commandRisk = classifyCommandRisk(command);
					}
					const cwd = (toolParams as BuiltinToolCallParams['run_command']).cwd ?? null;
					if (cwd) {
						const workspaceFsPaths = this._workspaceContextService.getWorkspace().folders.map(f => f.uri.fsPath);
						cwdEscapes = cwdEscapesWorkspace(cwd, workspaceFsPaths);
					}
				}

				// (b) YOLO natural-language-command safe heuristic.
				let nlInput: string | undefined;
				let nlCommandYoloSafe = false;
				if (isNLCommand && this._settingsService.state.globalSettings.enableYOLOMode) {
					try {
						const nlParams = toolParams as BuiltinToolCallParams['run_nl_command'];
						nlInput = nlParams.nlInput.toLowerCase();
						// Simple heuristics for safe commands (read-only, informational)
						const safePatterns = ['list', 'show', 'check', 'status', 'get', 'display', 'print', 'view', 'read', 'cat', 'ls', 'pwd', 'whoami', 'date', 'time'];
						const dangerousPatterns = ['delete', 'remove', 'rm', 'kill', 'destroy', 'format', 'reset', 'clear', 'drop', 'truncate', 'sudo', 'chmod', 'chown'];
						nlCommandYoloSafe = safePatterns.some(pattern => nlInput!.includes(pattern)) &&
							!dangerousPatterns.some(pattern => nlInput!.includes(pattern));
					} catch (error) {
						// If check fails, fall back to normal approval flow
						console.debug('[ChatThreadService] NL command safety check failed, using normal approval:', error);
					}
				}

				// (c) edit risk scoring (always runs for edit ops; failure falls back to normal approval).
				let riskScore: { riskScore: number; confidenceScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskFactors: string[]; confidenceFactors: string[] } | undefined;
				let editContextForNotification: EditContext | undefined;
				const yoloEnabled = this._settingsService.state.globalSettings.enableYOLOMode === true;
				const yoloRiskThreshold = this._settingsService.state.globalSettings.yoloRiskThreshold ?? 0.2;
				const yoloConfidenceThreshold = this._settingsService.state.globalSettings.yoloConfidenceThreshold ?? 0.7;
				if (isEditOperation) {
					try {
						editContextForNotification = await this._buildEditContext(toolName, toolParams, threadId);
						riskScore = await this._editRiskScoringService.scoreEdit(editContextForNotification);
					} catch (error) {
						// If risk scoring fails, fall back to normal approval flow (don't block on scoring failure).
						console.debug('[ChatThreadService] Risk scoring failed, using normal approval:', error);
					}
				}

				// (d) THE auto-approve decision (pure, tested -- common/autoApprovePolicy.ts).
				const autoApproveDecision = decideAutoApprove({
					approvalType,
					autoApproveSetting: this._settingsService.state.globalSettings.autoApprove[approvalType],
					isEditOperation,
					commandRisk: commandRisk ? { hardBlock: commandRisk.hardBlock, requiresApproval: commandRisk.requiresApproval } : undefined,
					cwdEscapes,
					nlCommandYoloSafe,
					editRisk: riskScore ? { riskLevel: riskScore.riskLevel, riskScore: riskScore.riskScore, confidenceScore: riskScore.confidenceScore } : undefined,
					yolo: { enabled: yoloEnabled, riskThreshold: yoloRiskThreshold, confidenceThreshold: yoloConfidenceThreshold },
				});

				// (e) side effects, gated on the decision's per-rule flags (telemetry parity with the old code).
				if (autoApproveDecision.outcome === 'hard-block' && commandRisk) {
					this._metricsService.capture('dangerous_command_hard_blocked', { toolName, categories: commandRisk.categories.join(',') });
					this._addMessageToThread(threadId, { role: 'tool', type: 'invalid_params', rawParams: opts.unvalidatedToolParams, result: null, name: toolName, content: `Blocked: refusing to run a catastrophic command (${commandRisk.reason ?? 'irreversible system damage'}). If you genuinely intend this, run it yourself in a terminal.`, id: toolId, mcpServerName });
					return {};
				}
				// The terminal-command telemetry was NOT inside a try/catch in the old code, so let it propagate.
				if (autoApproveDecision.dangerousCommandForcedApproval && commandRisk) {
					this._metricsService.capture('dangerous_command_requires_approval', { toolName, categories: commandRisk.categories.join(',') });
				}
				if (autoApproveDecision.cwdEscapeForcedApproval) {
					this._metricsService.capture('terminal_cwd_outside_workspace_requires_approval', { toolName });
				}
				// The NL-command + edit telemetry/notification WERE inside the scoring try/catch in the old code
				// (a throw was swallowed + logged, and the run continued); preserve that exact swallow semantics.
				try {
					if (autoApproveDecision.yoloNlAutoApproved) {
						this._metricsService.capture('yolo_auto_approved', { operation: toolName, nlInput: (nlInput ?? '').substring(0, 50) });
					}
					if (autoApproveDecision.highRiskBlockedDespiteAutoApprove && riskScore) {
						this._metricsService.capture('high_risk_blocked_despite_autoapprove', { riskScore: riskScore.riskScore, confidenceScore: riskScore.confidenceScore, operation: toolName });
					}
					if (autoApproveDecision.yoloEditAutoApproved && riskScore) {
						this._metricsService.capture('yolo_auto_approved', { riskScore: riskScore.riskScore, confidenceScore: riskScore.confidenceScore, riskLevel: riskScore.riskLevel, operation: toolName });
						// Very low risk (< 0.1) edits are silent to avoid notification fatigue.
						if (riskScore.riskScore >= 0.1 && editContextForNotification) {
							this._showAutoApplyNotification(editContextForNotification, riskScore, toolName);
						}
					}
				} catch (error) {
					console.debug('[ChatThreadService] auto-approve telemetry/notification failed (non-fatal):', error);
				}

				// add a tool_request because we use it for UI if a tool is loading (this should be improved in the future)
				const requestContent = riskScore && riskScore.riskLevel !== 'LOW'
					? `(Risk: ${riskScore.riskLevel}, Score: ${riskScore.riskScore.toFixed(2)}, Confidence: ${riskScore.confidenceScore.toFixed(2)})`
					: '(Awaiting user permission...)';
				this._addMessageToThread(threadId, {
					role: 'tool',
					type: 'tool_request',
					content: requestContent,
					result: null,
					name: toolName,
					params: toolParams,
					id: toolId,
					rawParams: opts.unvalidatedToolParams,
					mcpServerName
				});

				if (autoApproveDecision.outcome === 'require-approval') {
					return { awaitingUserApproval: true }
				}
			}
		}
		else {
			toolParams = opts.validatedParams
		}

		// Check for duplicate read_file calls after validation but before execution
		if (toolName === 'read_file' && isBuiltInTool) {
			const readFileParams = toolParams as BuiltinToolCallParams['read_file']
			const cacheKey = `${readFileParams.uri.fsPath}|${readFileParams.startLine ?? 'null'}|${readFileParams.endLine ?? 'null'}|${readFileParams.pageNumber ?? 1}`

			// Check cache
			let threadCache = this._fileReadCache.get(threadId)
			if (!threadCache) {
				threadCache = new Map()
				this._fileReadCache.set(threadId, threadCache)
			}

			const cachedResult = threadCache.get(cacheKey)
			if (cachedResult) {
				// Found cached result - reuse it instead of reading again
				// Update LRU: move to end (most recently used)
				const lruList = this._fileReadCacheLRU.get(threadId) || []
				const lruIndex = lruList.indexOf(cacheKey)
				if (lruIndex >= 0) {
					lruList.splice(lruIndex, 1)
				}
				lruList.push(cacheKey)
				this._fileReadCacheLRU.set(threadId, lruList)

				toolResult = cachedResult as ToolResult<ToolName>
				toolResultStr = this._toolsService.stringOfResult['read_file'](readFileParams, cachedResult)

				// Add cached result to thread (mark as cached for transparency)
				this._updateLatestTool(threadId, {
					role: 'tool',
					type: 'success',
					params: readFileParams,
					result: toolResult,
					name: 'read_file',
					content: toolResultStr + '\n\n(Result reused from cache)',
					id: toolId,
					rawParams: opts.unvalidatedToolParams,
					mcpServerName
				})
				return {}
			}
		}






		// 3. call the tool
		// this._setStreamState(threadId, { isRunning: 'tool' }, 'merge')
		const runningTool = { role: 'tool', type: 'running_now', name: toolName, params: toolParams, content: '(value not received yet...)', result: null, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName } as const
		this._updateLatestTool(threadId, runningTool)


		let interrupted = false
		let resolveInterruptor: (r: () => void) => void = () => { }
		const interruptorPromise = new Promise<() => void>(res => { resolveInterruptor = res })
		try {

			// set stream state
			this._setStreamState(threadId, { isRunning: 'tool', interrupt: interruptorPromise, toolInfo: { toolName, toolParams, id: toolId, content: 'interrupted...', rawParams: opts.unvalidatedToolParams, mcpServerName } })

			// Per-agent tool allowlist (a custom sub-agent's allowedTools): the AUTHORITATIVE execution
			// gate, beyond the prompt-level restriction. Covers builtin + MCP. attempt_completion is
			// always allowed so a restricted sub-agent can still signal completion. A recoverable throw.
			const agentAllowedTools = this._allowedToolsByThread.get(threadId)
			if (agentAllowedTools && toolName !== 'attempt_completion' && !agentAllowedTools.includes(toolName)) {
				throw new Error(`The ${toolName} tool isn't available to this sub-agent. Available tools: ${agentAllowedTools.join(', ')}, attempt_completion.`)
			}

			// R3: fire any pre-tool lifecycle hooks (fire-and-forget; no-op unless enabled + configured).
			this._hooksService.runHooksForEvent({ event: 'pre-tool', toolName, threadId })

			if (isBuiltInTool) {
				// Hard curation for local/weak models: even if a non-curated tool (web_search, terminals, ...)
				// slipped past the catalog and was parsed, do NOT execute it — return a recoverable result so a
				// weak model can't get distracted by tools it shouldn't use.
				const localSet = localToolsetFor(isCapableLocalModel)
				if (isLocal && !(localSet as Set<string>).has(toolName)) {
					throw new Error(`The ${toolName} tool isn't available for this model. Use one of: ${[...localSet].join(', ')}.`)
				}
				if (toolName === 'run_subagent') {
					// Sub-agents are executed here (they need the chat service to spawn a child agent
					// loop), not in toolsService. Enforce no nesting: a sub-agent cannot spawn another.
					if (this._subagentThreadIds.has(threadId)) {
						throw new Error('A sub-agent cannot spawn another sub-agent. Complete this sub-task yourself and call attempt_completion with your result.')
					}
					resolveInterruptor(() => { interrupted = true })
					toolResult = await this._runSubagent(threadId, toolParams as BuiltinToolCallParams['run_subagent'])
				}
				else if (toolName === 'run_parallel_subagents') {
					// Same as run_subagent but runs N READ-ONLY children concurrently. No nesting.
					if (this._subagentThreadIds.has(threadId)) {
						throw new Error('A sub-agent cannot spawn sub-agents. Complete this sub-task yourself and call attempt_completion with your result.')
					}
					resolveInterruptor(() => { interrupted = true })
					toolResult = await this._runParallelSubagents(threadId, toolParams as BuiltinToolCallParams['run_parallel_subagents'])
				}
				else if (WRITE_FILE_TOOLS.has(toolName)) {
					// Serialize file-edit application across concurrent agent threads so a read-modify-write
					// can't interleave + corrupt a file. No-op when no other edit is in flight.
					toolResult = await this._editSerializer.run(async () => {
						const { result, interruptTool } = await this._toolsService.callTool[toolName](toolParams as any)
						resolveInterruptor(() => { interrupted = true; interruptTool?.() })
						return await result
					})
				}
				else {
					const { result, interruptTool } = await this._toolsService.callTool[toolName](toolParams as any)
					const interruptor = () => { interrupted = true; interruptTool?.() }
					resolveInterruptor(interruptor)

					toolResult = await result
				}
			}
			else {
				const mcpTools = this._mcpService.getMCPTools()
				const mcpTool = mcpTools?.find(t => t.name === toolName)
				if (!mcpTool) {
					// Weak models often hallucinate tool names. Return a clear, recoverable error
					// (the catch below records it as a tool_error the model can self-correct from)
					// instead of the misleading raw "MCP tool X not found".
					// List the tools the model was actually OFFERED (curated for local models), so this
					// error doesn't re-introduce the tools curation deliberately hid from a weak model.
					const offered = isLocal ? [...localToolsetFor(isCapableLocalModel)] : [...builtinToolNames, ...(mcpTools?.map(t => t.name) ?? [])]
					throw new Error(`No tool named "${toolName}". Use one of the available tools: ${offered.join(', ')}`)
				}

				resolveInterruptor(() => { })

				toolResult = (await this._mcpService.callMCPTool({
					serverName: mcpTool.mcpServerName ?? 'unknown_mcp_server',
					toolName: toolName,
					params: toolParams
				})).result
			}

			if (interrupted) { return { interrupted: true } } // the tool result is added where we interrupt, not here
		}
		catch (error) {
			resolveInterruptor(() => { }) // resolve for the sake of it
			if (interrupted) { return { interrupted: true } } // the tool result is added where we interrupt, not here

			const errorMessage = getErrorMessage(error)
			this._updateLatestTool(threadId, { role: 'tool', type: 'tool_error', params: toolParams, result: errorMessage, name: toolName, content: errorMessage, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })
			return {}
		}

		// 4. stringify the result to give to the LLM
		try {
			if (isBuiltInTool) {
				toolResultStr = this._toolsService.stringOfResult[toolName](toolParams as any, toolResult as any)
			}
			// For MCP tools, handle the result based on its type
			else {
				toolResultStr = this._mcpService.stringifyResult(toolResult as RawMCPToolCall)
			}
		} catch (error) {
			const errorMessage = this.toolErrMsgs.errWhenStringifying(error)
			this._updateLatestTool(threadId, { role: 'tool', type: 'tool_error', params: toolParams, result: errorMessage, name: toolName, content: errorMessage, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })
			return {}
		}

		// 5. add to history and keep going
		this._updateLatestTool(threadId, { role: 'tool', type: 'success', params: toolParams, result: toolResult, name: toolName, content: toolResultStr, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })

		// R3: fire any post-tool lifecycle hooks (fire-and-forget; no-op unless enabled + configured).
		this._hooksService.runHooksForEvent({ event: 'post-tool', toolName, threadId })

		// attempt_completion terminates the agent loop
		if (isBuiltInTool && toolName === 'attempt_completion') {
			return { completionSignaled: true }
		}

		// Cache read_file results to prevent duplicate reads
		if (toolName === 'read_file' && isBuiltInTool) {
			const readFileParams = toolParams as BuiltinToolCallParams['read_file']
			const readFileResult = toolResult as BuiltinToolResultType['read_file']
			const cacheKey = `${readFileParams.uri.fsPath}|${readFileParams.startLine ?? 'null'}|${readFileParams.endLine ?? 'null'}|${readFileParams.pageNumber ?? 1}`

			let threadCache = this._fileReadCache.get(threadId)
			if (!threadCache) {
				threadCache = new Map()
				this._fileReadCache.set(threadId, threadCache)
			}

			// Get or create LRU list for this thread
			let lruList = this._fileReadCacheLRU.get(threadId)
			if (!lruList) {
				lruList = []
				this._fileReadCacheLRU.set(threadId, lruList)
			}

			// If key already exists, remove from LRU list (will be re-added at end)
			const existingIndex = lruList.indexOf(cacheKey)
			if (existingIndex >= 0) {
				lruList.splice(existingIndex, 1)
			}

			// Add to end of LRU list (most recently used)
			lruList.push(cacheKey)

			// Enforce cache size limit with LRU eviction
			if (lruList.length > ChatThreadService.MAX_FILE_READ_CACHE_ENTRIES_PER_THREAD) {
				// Remove oldest entry (first in list)
				const oldestKey = lruList.shift()!
				threadCache.delete(oldestKey)
			}

			threadCache.set(cacheKey, readFileResult)
		}

		// Invalidate cache when files are modified or deleted
		if ((toolName === 'edit_file' || toolName === 'rewrite_file' || toolName === 'delete_file_or_folder') && isBuiltInTool) {
			const fileParams = toolParams as BuiltinToolCallParams['edit_file'] | BuiltinToolCallParams['rewrite_file'] | BuiltinToolCallParams['delete_file_or_folder']
			const fileUri = fileParams.uri
			const threadCache = this._fileReadCache.get(threadId)
			const lruList = this._fileReadCacheLRU.get(threadId)
			if (threadCache) {
				// Remove all cache entries for this file (any line range/page)
				const keysToDelete: string[] = []
				for (const [cacheKey] of threadCache.entries()) {
					if (cacheKey.startsWith(fileUri.fsPath + '|')) {
						keysToDelete.push(cacheKey)
						threadCache.delete(cacheKey)
					}
				}
				// Also remove from LRU list
				if (lruList) {
					for (const key of keysToDelete) {
						const lruIndex = lruList.indexOf(key)
						if (lruIndex >= 0) {
							lruList.splice(lruIndex, 1)
						}
					}
				}
			}
		}

		return {}
	};




	/**
	 * Per-turn override of the user's chat mode. For weak/local models, a trivial
	 * general-knowledge question is answered directly (returns 'normal' → NO tools)
	 * instead of running the agent tool-loop, which weak models tend to ramble through.
	 * Only relaxes full 'agent' mode; the user's selected mode is unchanged in the UI.
	 * Conservative: attachments, or anything referencing the workspace / wanting an
	 * action, keep the full agent toolset.
	 */
	private _effectiveChatModeForTurn(threadId: string, userChatMode: ChatMode, modelSelection: ModelSelection | null): ChatMode {
		if (userChatMode !== 'agent' || !modelSelection) { return userChatMode }
		const isLocal = (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName)
		if (!isLocal) { return userChatMode } // scoped to local/weak models first
		const msgs = this.state.allThreads[threadId]?.messages ?? []
		let lastUser: (ChatMessage & { role: 'user' }) | undefined
		for (let i = msgs.length - 1; i >= 0; i--) {
			const m = msgs[i]
			if (m.role === 'user') { lastUser = m; break }
		}
		if (!lastUser) { return userChatMode }
		if ((lastUser.images?.length ?? 0) > 0 || (lastUser.pdfs?.length ?? 0) > 0) { return userChatMode } // attachments need agent/vision
		const text = lastUser.content || lastUser.displayContent || ''
		return isTriviaQuestion(text) ? 'normal' : userChatMode
	}

	/**
	 * True for provider errors that won't improve by retrying the SAME model (bad/missing API key,
	 * model-not-found, auth/permission). The agent loop skips same-model retries for these and escalates
	 * straight to another configured model.
	 */
	private _isNonRetryableModelError(error: { message?: string } | undefined | null): boolean {
		const msg = (error?.message || '').toLowerCase()
		if (!msg) { return false }
		if (/\b(401|403|404)\b/.test(msg)) { return true }
		const needles = [
			'unauthorized', 'forbidden', 'invalid api key', 'invalid_api_key', 'incorrect api key',
			'no api key', 'api key not', 'missing api key', 'authentication',
			'model not found', 'model_not_found', 'no such model', 'unknown model', 'does not exist',
			'permission denied', 'not authorized',
		]
		return needles.some(n => msg.includes(n))
	}

	/**
	 * Pick the best OTHER configured model to fail over to when the active model errors or stalls.
	 * Enumerates every filled-in provider's visible models, enriches each with capability data, and ranks
	 * them via the pure modelFailover policy (prefers a capable cloud model when preferNonLocal is set).
	 * Honors routingPolicy 'local-only' (never returns a cloud model). Returns null if nothing qualifies.
	 */
	private async _pickNextUntriedModel(excludeKeys: ReadonlySet<string>, opts: { preferNonLocal: boolean, avoidFreeTier?: boolean }): Promise<ModelSelection | null> {
		const { getModelCapabilities } = await import('../common/modelCapabilities.js')
		const state = this._settingsService.state
		const overrides = state.overridesOfModel
		const localOnly = state.globalSettings.routingPolicy === 'local-only'
		// Phase 2: flatten the configured providers (impure - reads settings) then build the candidate
		// list with the pure, tested buildFailoverCandidates; the ranking stays in pickNextFailoverModel.
		const providers: FailoverProviderEntry[] = (Object.keys(state.settingsOfProvider) as ProviderName[]).map(providerName => {
			const ps = state.settingsOfProvider[providerName]
			return {
				providerName,
				didFillInProviderSettings: !!ps._didFillInProviderSettings,
				models: (ps.models ?? []).map(mi => ({ modelName: mi.modelName, isHidden: mi.isHidden })),
			}
		})
		const candidates = buildFailoverCandidates(providers, excludeKeys, (pn, mn) => {
			try { return getModelCapabilities(pn, mn, overrides) } catch { return null }
		})
		const pick = pickNextFailoverModel(candidates, { excludeKeys, localOnly, preferNonLocal: opts.preferNonLocal, avoidFreeTier: opts.avoidFreeTier })
		return pick ? toModelSelection(pick) : null
	}

	// Threads currently running as sub-agents (spawned by run_subagent). Enforces no-nesting and marks
	// child threads. Not persisted; cleared when the child finishes.
	private readonly _subagentThreadIds = new Set<string>()
	// Per-(sub-agent-)thread tool allowlist (a custom agent's allowedTools). Read by the _runToolCall
	// dispatch gate to authoritatively block tools outside the agent's set. Cleared when the child ends.
	private readonly _allowedToolsByThread = new Map<string, string[]>()
	// Per-(sub-agent-)thread git-worktree root (parallel-edit phase 2). When set, _runToolCall passes it
	// into validateParams so the child's file paths resolve + are confined to the worktree, not the
	// workspace. Keyed by threadId (not runCtx) so it survives the approval-resume re-entry into
	// _runChatAgent, which drops runCtx. Set at the top of _runChatAgent; cleared when the child ends.
	private readonly _workspaceRootOverrideByThread = new Map<string, string>()
	// Phase 1 #2: durable create/delete rollback. Per-thread journal of the BEFORE-state of every
	// create_file_or_folder / delete_file_or_folder the agent runs (the in-memory checkpoint system
	// only restores EDITS with a live model — it can't recreate a deleted file or remove a created one).
	// On a checkpoint jump we replay these in reverse on disk. See common/agentFileOps.ts.
	private readonly _fileOpJournalByThread = new Map<string, AgentFileOpRecord[]>()
	// parentThreadId -> set of running sub-agent child threadIds. Lets abortRunning(parent) propagate
	// the abort to in-flight children (depth 1, since sub-agents can't nest).
	private readonly _childThreadsByParent = new Map<string, Set<string>>()

	/** Records the on-disk BEFORE-state of a create/delete so a checkpoint rollback can reverse it. */
	private async _recordFileOpBeforeMutation(threadId: string, uri: URI, opType: AgentFileOpType, isFolder: boolean) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		let existedBefore = false
		let beforeContent: string | null = null
		try {
			existedBefore = await this._fileService.exists(uri)
			if (existedBefore && !isFolder) {
				const stat = await this._fileService.stat(uri)
				// avoid snapshotting huge / binary files (best-effort guard)
				if (!stat.isDirectory && (stat.size ?? 0) <= 5_000_000) {
					beforeContent = (await this._fileService.readFile(uri)).value.toString()
				}
			}
		} catch { /* best-effort: if we can't read, record what we know */ }
		const checkpointIdx = findLastIdx(thread.messages, (m: ChatMessage) => m.role === 'checkpoint') ?? -1
		const journal = this._fileOpJournalByThread.get(threadId) ?? []
		journal.push({ checkpointIdx, fsPath: uri.fsPath, opType, isFolder, existedBefore, beforeContent })
		this._fileOpJournalByThread.set(threadId, journal)
	}

	private _makeFileOpIO(): FileOpIO {
		return {
			exists: (p) => this._fileService.exists(URI.file(p)),
			writeFileAtomic: async (p, content) => { await this._fileService.writeFile(URI.file(p), VSBuffer.fromString(content), { atomic: { postfix: '.cortexide-tmp' } }) },
			createFolder: async (p) => { await this._fileService.createFolder(URI.file(p)) },
			del: async (p, opts) => { await this._fileService.del(URI.file(p), { recursive: opts.recursive, useTrash: false }) },
			readText: async (p) => (await this._fileService.readFile(URI.file(p))).value.toString(),
		}
	}

	/** Reverses (on disk) every journalled create/delete that happened after the target checkpoint. */
	private async _restoreFileOpsForJump(threadId: string, toIdx: number) {
		const journal = this._fileOpJournalByThread.get(threadId)
		if (!journal || journal.length === 0) return
		const { results, incomplete } = await undoFileOpsAfterCheckpoint(this._makeFileOpIO(), journal, toIdx - 1)
		// drop the ops we just reversed so a later jump doesn't re-undo them
		this._fileOpJournalByThread.set(threadId, journal.filter(r => r.checkpointIdx < toIdx))
		const undone = results.filter(r => r.ok && r.action !== 'noop').length
		if (incomplete) {
			const failed = results.filter(r => !r.ok)
			this._notificationService.warn(localize('cortexide.rollback.incomplete', 'Rollback incomplete: could not restore {0} file(s): {1}', failed.length, failed.map(f => f.fsPath).join(', ')))
		} else if (undone > 0) {
			this._notificationService.info(localize('cortexide.rollback.restored', 'Rolled back {0} created/deleted file(s) on disk.', undone))
		}
	}
	// Serializes file-edit application across ALL concurrent agent threads (foreground + background +
	// parallel sub-agents) so concurrent edits can't corrupt a file. No-op for a single sequential agent.
	private readonly _editSerializer = createSerializer()

	/**
	 * Execute a sub-agent (the run_subagent tool). Spawns a HIDDEN child thread seeded with ONLY the
	 * given prompt, runs the normal agent loop on it in an isolated 'agent'-mode context (its own
	 * streamState/checkpoints/caps), and returns the child's final summary. The child sees nothing of
	 * the parent conversation; the parent sees only the returned summary — keeping the parent context
	 * clean.
	 */
	private async _runSubagent(parentThreadId: string, params: BuiltinToolCallParams['run_subagent'], readOnly: boolean = false): Promise<BuiltinToolResultType['run_subagent']> {
		const child = newThreadObject()
		const childId = child.id
		this._subagentThreadIds.add(childId)
		// Resolve a named custom agent (.cortexide/agents/*.md), if any — it supplies the child's system
		// prompt (runCtx.systemPromptOverride), pinned model, and tool allowlist.
		const customAgent = params.agentType ? this._agentsService.getAgent(params.agentType) : undefined
		// readOnly (run_parallel_subagents) forces the read-only toolset so N children can run
		// concurrently with zero FS-collision risk; otherwise use the custom agent's allowlist (if any).
		const effectiveAllowedTools = readOnly ? READ_ONLY_SUBAGENT_TOOLS : customAgent?.allowedTools
		// Per-thread tool allowlist read by the _runToolCall dispatch gate (authoritative enforcement).
		if (effectiveAllowedTools && effectiveAllowedTools.length > 0) {
			this._allowedToolsByThread.set(childId, effectiveAllowedTools)
		}
		// Register the child under its parent so aborting the parent aborts the child too.
		let siblings = this._childThreadsByParent.get(parentThreadId)
		if (!siblings) { siblings = new Set(); this._childThreadsByParent.set(parentThreadId, siblings) }
		siblings.add(childId)
		// Insert the child into state (NOT into openTabs — it stays hidden from the tab bar).
		this._setState({ allThreads: { ...this.state.allThreads, [childId]: child } })
		console.log(`[run_subagent] spawning child ${childId}${readOnly ? ' (read-only)' : ''}${params.agentType ? ` as "${params.agentType}"` : ''}: ${params.description}`)
		// Seed with a single user message = the self-contained task (the child's entire context). The
		// custom agent's role now flows as a real <subagent_role> system-message block (runCtx below),
		// not a prepend to this message.
		this._addMessageToThread(childId, {
			role: 'user',
			content: params.prompt,
			displayContent: params.prompt,
			selections: null,
			state: { stagingSelections: [], isBeingEdited: false },
		})
		// Pick the child's model: a custom agent may pin one (resolved against installed models);
		// otherwise inherit the user's current selection. Recompute options for a pinned model the same
		// way _currentModelSelectionProps does, so a pinned model gets its configured options (if any).
		const parentProps = this._currentModelSelectionProps()
		const agentModel = customAgent?.model ? resolveAgentModelSelection(customAgent.model, this._settingsService.state.settingsOfProvider) : null
		const modelSelection = agentModel ?? parentProps.modelSelection
		const modelSelectionOptions = agentModel
			? this._settingsService.state.optionsOfModelSelection['Chat']?.[agentModel.providerName]?.[agentModel.modelName]
			: parentProps.modelSelectionOptions
		let summary = ''
		let completed = false
		try {
			await this._runChatAgent({
				threadId: childId,
				modelSelection,
				modelSelectionOptions,
				runCtx: { chatModeOverride: 'agent', isSubagent: true, parentThreadId, systemPromptOverride: customAgent?.systemPrompt, allowedToolNames: effectiveAllowedTools },
			})
			// Extract the child's result: prefer its attempt_completion summary, else its last assistant
			// text. Read INSIDE the try so the child's final state is captured before disposal in finally;
			// on error we skip straight to finally and the throw propagates (parent handles it), as before.
			const messages = this.state.allThreads[childId]?.messages ?? []
			let lastAssistant = ''
			for (let i = messages.length - 1; i >= 0; i--) {
				const m = messages[i] as any
				if (m.role === 'tool' && m.name === 'attempt_completion' && m.params?.result) {
					summary = String(m.params.result)
					completed = true
					break
				}
				if (!lastAssistant && m.role === 'assistant' && typeof m.displayContent === 'string' && m.displayContent.trim()) {
					lastAssistant = m.displayContent.trim()
				}
			}
			if (!summary) { summary = lastAssistant || '(The sub-agent finished without producing a summary.)' }
		} finally {
			this._subagentThreadIds.delete(childId)
			this._allowedToolsByThread.delete(childId)
			this._workspaceRootOverrideByThread.delete(childId)
			// Remove the child from its parent's sibling set, and drop the set entirely once it's empty so
			// parents don't accumulate empty Sets over many sub-agent calls.
			const siblings = this._childThreadsByParent.get(parentThreadId)
			if (siblings) {
				siblings.delete(childId)
				if (siblings.size === 0) { this._childThreadsByParent.delete(parentThreadId) }
			}
			// Tear down the hidden child thread + every per-thread cache it populated. Without this, each
			// run_subagent call leaks a full thread (with all its messages) plus its read/plan/stream
			// caches for the lifetime of the window. Runs on the error path too (the throw still propagates).
			this._disposeSubagentThreadState(childId)
		}
		console.log(`[run_subagent] child ${childId} finished (completed=${completed}); summary ${summary.length} chars`)
		return { result: summary, childThreadId: childId, completed }
	}

	/**
	 * Tear down a finished sub-agent's HIDDEN thread and every per-thread cache it populated. Sub-agent
	 * child threads are ephemeral — the only child->parent channel is the returned summary — so, unlike
	 * deleteThread, this must NOT persist, touch openTabs/currentThreadId, or open a replacement thread.
	 * It only drops the in-memory state so repeated run_subagent calls don't leak threads + caches.
	 */
	private _disposeSubagentThreadState(childId: string): void {
		if (this.state.allThreads[childId]) {
			const rest = { ...this.state.allThreads }
			delete rest[childId]
			this._setState({ allThreads: rest })
		}
		this._fileReadCache.delete(childId)
		this._fileReadCacheLRU.delete(childId)
		this._planCache.delete(childId)
		this._pendingStreamStateUpdates.delete(childId)
		this._fileOpJournalByThread.delete(childId) // before-content snapshots can be large; don't leak them
		delete this._suppressPlanOnceByThread[childId]
		delete this.streamState[childId]
	}

	/**
	 * Run several READ-ONLY sub-agents concurrently (the run_parallel_subagents tool). Each child is
	 * forced to the read-only toolset (no edits / no run_command), so running them with Promise.all is
	 * safe — they can't collide on the file system. Returns every child's summary. A child that throws
	 * degrades to a per-task error entry rather than failing the whole batch.
	 */
	private async _runParallelSubagents(parentThreadId: string, params: BuiltinToolCallParams['run_parallel_subagents']): Promise<BuiltinToolResultType['run_parallel_subagents']> {
		const results = await Promise.all(params.tasks.map(async (task) => {
			try {
				const r = await this._runSubagent(parentThreadId, { description: task.description, prompt: task.prompt, agentType: null }, /* readOnly */ true)
				return { description: task.description, result: r.result, completed: r.completed }
			} catch (e) {
				return { description: task.description, result: `(sub-agent errored: ${getErrorMessage(e)})`, completed: false }
			}
		}))
		return { results }
	}

	/**
	 * R7: start a top-level agent on a HIDDEN thread that runs without blocking the active chat. Tracked
	 * in IBackgroundAgentsService (the "Running agents" panel can show/cancel it). Unlike a sub-agent it
	 * has no parent and is NOT subject to the no-nesting gate; it runs the normal agent loop + approval
	 * flow (so it never silently bypasses tool approvals). Fire-and-track: this returns the threadId
	 * immediately while the run proceeds in the background.
	 */
	async startBackgroundAgent(description: string, prompt: string): Promise<string> {
		const child = newThreadObject()
		const childId = child.id
		// Hidden thread: in-memory only (NOT persisted, NOT in openTabs).
		this._setState({ allThreads: { ...this.state.allThreads, [childId]: child } })
		this._addMessageToThread(childId, {
			role: 'user', content: prompt, displayContent: prompt, selections: null,
			state: { stagingSelections: [], isBeingEdited: false },
		})
		const props = this._currentModelSelectionProps()
		this._backgroundAgentsService.register({
			id: childId, description, threadId: childId, startTime: Date.now(),
			abort: () => { void this.abortRunning(childId) },
		})
		this._notificationService.info(`Background agent started: ${description}`)

		const extractSummary = (): string => {
			const messages = this.state.allThreads[childId]?.messages ?? []
			for (let i = messages.length - 1; i >= 0; i--) {
				const m = messages[i] as any
				if (m.role === 'tool' && m.name === 'attempt_completion' && m.params?.result) { return String(m.params.result) }
				if (m.role === 'assistant' && typeof m.displayContent === 'string' && m.displayContent.trim()) { return m.displayContent.trim() }
			}
			return '(no summary produced)'
		}
		const stillRunning = () => this._backgroundAgentsService.state.agents.find(a => a.id === childId)?.status === 'running'

		// Run the agent loop in the background — do NOT await.
		void this._runChatAgent({
			threadId: childId,
			modelSelection: props.modelSelection,
			modelSelectionOptions: props.modelSelectionOptions,
			runCtx: { chatModeOverride: 'agent', isSubagent: false },
		}).then(() => {
			if (stillRunning()) { // not cancelled
				this._backgroundAgentsService.setStatus(childId, 'completed', { resultSummary: extractSummary(), endTime: Date.now() })
				this._notificationService.info(`Background agent finished: ${description}`)
			}
		}).catch((e) => {
			if (stillRunning()) {
				this._backgroundAgentsService.setStatus(childId, 'error', { error: getErrorMessage(e), endTime: Date.now() })
				this._notificationService.warn(`Background agent failed: ${description} — ${getErrorMessage(e)}`)
			}
		}).finally(() => {
			// Drop the hidden thread now that the run has settled and its summary is captured in the agent
			// record. The thread is in-memory only (never persisted / in openTabs) and the Running-agents
			// panel renders the record's resultSummary, never the thread, so nothing inspects it after this.
			// Without this, every background agent leaves a thread object in allThreads forever.
			if (this.state.allThreads[childId]) {
				const next = { ...this.state.allThreads }
				delete next[childId]
				this._setState({ allThreads: next })
			}
		})

		return childId
	}

	/** Phase 6 (Skills): expand a `/<skill-name> [args]` invocation into the skill's instructions, or
	 *  null when the input isn't a slash invocation or names no discovered skill. Pure lookup -- the
	 *  caller (the chat input's slash-command handler) submits the returned string as a normal turn. */
	getSkillExpansion(input: string): string | null {
		const invocation = parseSkillInvocation(input)
		if (!invocation) { return null }
		const skill = this._skillsService.getSkill(invocation.name)
		if (!skill) { return null }
		return buildSkillInvocationMessage(skill, invocation.args)
	}

	listSkillNames(): string[] {
		return this._skillsService.skills.map(s => s.name)
	}

	private async _runChatAgent({
		threadId,
		modelSelection,
		modelSelectionOptions,
		callThisToolFirst,
		earlyRequestId,
		isAutoMode,
		repoIndexerPromise,
		runCtx,
	}: {
		threadId: string,
		modelSelection: ModelSelection | null,
		modelSelectionOptions: ModelSelectionOptions | undefined,
		callThisToolFirst?: ToolMessage<ToolName> & { type: 'tool_request' },
		earlyRequestId?: string,
		isAutoMode?: boolean,
		repoIndexerPromise?: Promise<{ results: string[], metrics: any } | null>,
		// Sub-agent execution context. Undefined for a normal (top-level) chat turn, where the loop
		// reads the user's mode from global settings as before. When a sub-agent is spawned (see
		// run_subagent), this carries the child's own mode + provenance so the SAME loop runs in an
		// isolated context without touching the user's UI mode.
		runCtx?: AgentRunContext,
	}) {

		// Parallel-edit phase 2: register this run's git-worktree root (if any) keyed by threadId, so the
		// _runToolCall dispatch path can confine file tools to the worktree. Keyed by threadId (not
		// runCtx) because the approval-resume re-entry calls _runChatAgent WITHOUT runCtx — the entry
		// persists until the sub-agent finishes (_runSubagent's finally clears it). Only ever populated
		// for sub-agent runs; a normal top-level turn passes no override, so this is a no-op there.
		if (runCtx?.workspaceRootOverride) {
			this._workspaceRootOverrideByThread.set(threadId, runCtx.workspaceRootOverride)
		}

		// CRITICAL: Validate and resolve model selection BEFORE starting the loop
		// This prevents wasted API calls and ensures we have a valid model
		let resolvedModelSelection = modelSelection
		let resolvedModelSelectionOptions = modelSelectionOptions

		// Resolve "auto" model selection using shared utility
		const resolved = this._settingsService.resolveAutoModelSelection(resolvedModelSelection)
		if (!resolved) {
			// No models available
			this._notificationService.error('No models available. Please configure at least one model provider in settings.')
			this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
			return
		}
		resolvedModelSelection = resolved

		// Recompute modelSelectionOptions for the resolved model
		// Type assertion is safe because we've already resolved "auto" above
		const resolvedProviderName = resolvedModelSelection.providerName as Exclude<typeof resolvedModelSelection.providerName, 'auto'>
		resolvedModelSelectionOptions = this._settingsService.state.optionsOfModelSelection['Chat']?.[resolvedProviderName]?.[resolvedModelSelection.modelName]

		// CRITICAL: Create a flag to stop execution immediately when plan is generated
		// NOTE: This flag is reset when plan is approved/executing to allow execution to proceed
		let planWasGenerated = false

		const checkPlanGenerated = () => {
			// Fast path: if flag is already set, check if plan is still pending
			if (planWasGenerated) {
				// Force refresh to check if plan was approved since flag was set
				const plan = this._getCurrentPlan(threadId, true)
				if (plan && plan.plan.approvalState === 'pending') {
					return true // Still pending
				}
				// Plan was approved - reset flag to allow execution
				planWasGenerated = false
				return false
			}

			// Use cached check first for performance - only force refresh if we suspect state changed
			const plan = this._getCurrentPlan(threadId, false) // Use cache for performance
			if (plan && plan.plan.approvalState === 'pending') {
				// Check if this plan was created during this execution session
				// We check the plan's message index - if it's near the end of messages, it's recent
				const thread = this.state.allThreads[threadId]
				if (thread) {
					const totalMessages = thread.messages.length
					const planIdx = plan.planIdx
					// If plan is in the last 10 messages, consider it recent (likely from this session)
					// This is safer than using timestamps which might not exist
					const isRecentPlan = (totalMessages - planIdx) <= 10
					if (isRecentPlan) {
						planWasGenerated = true
						return true
					}
				}
			}
			return false
		}

		let interruptedWhenIdle = false
		const idleInterruptor = Promise.resolve(() => { interruptedWhenIdle = true })
		// _runToolCall does not need setStreamState({idle}) before it, but it needs it after it. (handles its own setStreamState)

		// above just defines helpers, below starts the actual function
		// A sub-agent runs its OWN assigned mode (runCtx.chatModeOverride); a normal turn reads the
		// user's UI mode from global settings (frozen for the loop), unchanged from before.
		const userChatMode = runCtx?.chatModeOverride ?? this._settingsService.state.globalSettings.chatMode
		// Per-turn gate: a trivial general-knowledge question on a weak/local model answers directly
		// instead of running the agent tool-loop. `chatMode` below is the EFFECTIVE mode for this turn
		// (may be relaxed to 'normal'); the user's selected mode is unchanged. It then flows to tool
		// gating + system message + the send call, so the whole turn is consistently tool-less.
		// Sub-agents skip the trivia relaxation — they run the mode they were spawned with.
		// Per-model state. These track the LIVE model and are recomputed whenever the agent fails over to a
		// different model mid-task (see tryEscalateModel below). They are derived from the RESOLVED selection
		// — NOT the raw 'auto' the user picked — so isLocalModel / caps / tool-curation are correct from the
		// very first turn. (Previously these read the unresolved 'auto', so an Auto->local run silently ran
		// with cloud caps and the local tool-curation gate disabled — findings #5/#6.)
		let chatMode: ChatMode = userChatMode
		let isLocalModel = false
		let isCapableLocalModelFlag = false
		let maxAgentIterations = MAX_AGENT_LOOP_ITERATIONS
		let maxConsecutiveToolErrors = MAX_CONSECUTIVE_TOOL_ERRORS
		const recomputeModelState = (m: ModelSelection | null) => {
			chatMode = runCtx?.isSubagent ? userChatMode : this._effectiveChatModeForTurn(threadId, userChatMode, m)
			// Phase 2: the local-vs-cloud loop-cap policy is the pure, tested resolveModelRuntimeCaps.
			const caps = resolveModelRuntimeCaps(m, {
				maxAgentIterations: MAX_AGENT_LOOP_ITERATIONS,
				maxLocalAgentIterations: MAX_LOCAL_AGENT_LOOP_ITERATIONS,
				maxConsecutiveToolErrors: MAX_CONSECUTIVE_TOOL_ERRORS,
				maxLocalConsecutiveToolErrors: MAX_LOCAL_CONSECUTIVE_TOOL_ERRORS,
			})
			isLocalModel = caps.isLocalModel
			// A capable local model (>=7B -- coder OR general, e.g. llama3:8b that Auto may resolve to) also
			// gets the web tools (web_search/browse_url) at both the prompt catalog and the execution
			// chokepoint, so "check online" works locally instead of hallucinating. Web search is a general
			// capability, gated on SIZE not coder-ness (isCapableLocalModel).
			isCapableLocalModelFlag = caps.isLocalModel && !!m && m.providerName !== 'auto'
				&& isCapableLocalModel(m.modelName.toLowerCase(), this._settingsService.state.settingsOfProvider[m.providerName]?.models?.find((mm: { modelName: string; parameterSize?: string }) => mm.modelName === m.modelName)?.parameterSize)
			maxAgentIterations = caps.maxAgentIterations
			maxConsecutiveToolErrors = caps.maxConsecutiveToolErrors
		}
		recomputeModelState(resolvedModelSelection)
		const { overridesOfModel } = this._settingsService.state

		// --- Automatic model failover (findings #1/#2) ---
		// When the active model errors, repeatedly fails its tool calls, or stalls past the step limit,
		// escalate the SAME task to the best OTHER configured model — preferring a capable cloud model when
		// the failing one is local. This is what makes "my local model failed but I have a capable cloud key"
		// actually recover, regardless of whether the user picked Auto or a specific model. Honors the
		// enableModelFallback setting and routingPolicy 'local-only' (never leaves local). State persists
		// across the whole task (the inner-loop `triedModels` set resets every outer iteration).
		const modelFallbackEnabled = this._settingsService.state.globalSettings.enableModelFallback !== false
			&& !runCtx?.isSubagent // a sub-agent runs the exact model it was assigned; don't silently switch it
		const escalationUsedModels = new Set<string>() // "provider/model" keys already run or escalated away from
		let escalationCount = 0
		const MAX_MODEL_ESCALATIONS = 4
		const tryEscalateModel = async (reason: string, escOpts?: { avoidFreeTier?: boolean }): Promise<boolean> => {
			if (!modelFallbackEnabled || escalationCount >= MAX_MODEL_ESCALATIONS) {
				return false
			}
			const cur = resolvedModelSelection
			if (cur && cur.providerName !== 'auto') { escalationUsedModels.add(`${cur.providerName}/${cur.modelName}`) }
			// Always prefer a capable CLOUD model first (e.g. a configured BYO key like Pollinations) — that's
			// what the user expects when a model fails; fall to local only when no cloud target qualifies.
			// avoidFreeTier (set on rate-limit / free-tier exhaustion) pushes the throttled free providers below
			// both BYO cloud and local, so we land on the working cloud key instead of another rate-limited one.
			const next = await this._pickNextUntriedModel(escalationUsedModels, { preferNonLocal: true, avoidFreeTier: escOpts?.avoidFreeTier })
			if (!next) { return false }
			escalationCount += 1
			resolvedModelSelection = next
			const np = next.providerName as Exclude<ProviderName, 'auto'>
			resolvedModelSelectionOptions = this._settingsService.state.optionsOfModelSelection['Chat']?.[np]?.[next.modelName]
			recomputeModelState(next)
			const fromLabel = cur ? `${cur.providerName}/${cur.modelName}` : 'the previous model'
			// Surface the switch via a notification, NOT a thread message: injecting an assistant message
			// here would leave the history ending on an assistant turn (or two assistant turns in a row),
			// which breaks providers that require strict user/assistant alternation (e.g. Anthropic). The
			// existing auto-fallback path switches silently for the same reason.
			this._notificationService.info(`Switched to ${next.providerName}/${next.modelName} — ${fromLabel} ${reason}.`)
			console.log(`[ChatThreadService] Model failover (${reason}): ${fromLabel} -> ${next.providerName}/${next.modelName}`)
			return true
		}

		let nMessagesSent = 0
		let consecutiveToolErrors = 0 // failed tool calls in a row; resets on any tool success
		let shouldSendAnotherMessage = true
		let isRunningWhenEnd: IsRunningType = undefined
		let filesReadInQuery = 0 // Track number of files read to prevent excessive reads

		// PERFORMANCE: Check for plan ONCE at start, not on every tool call
		// Only do plan tracking if an active plan exists
		let activePlanTracking: { planInfo: { plan: PlanMessage, planIdx: number }, currentStep: { plan: PlanMessage, planIdx: number, step: PlanStep, stepIdx: number } | undefined } | undefined

		// Check if we should generate a plan for complex tasks
		const existingPlanInfo = this._getCurrentPlan(threadId, false) // Use cache
		if (!existingPlanInfo) {
			// No existing plan - check if we should generate one
			// Plan mode always generates a plan; agent mode uses heuristics
			const shouldGeneratePlan = chatMode === 'plan' || this._shouldGeneratePlan(threadId)
			if (shouldGeneratePlan) {
				// Use the RESOLVED selection: prepareLLMChatMessages throws on a literal 'auto', which
				// dead-ended Plan mode when Auto was selected (the default).
				await this._generatePlanFromUserRequest(threadId, resolvedModelSelection, resolvedModelSelectionOptions)
				// CRITICAL: Force cache refresh ONLY here after plan generation
				this._planCache.delete(threadId)
				const planAfterGen = this._getCurrentPlan(threadId, true) // Force refresh
				if (planAfterGen && planAfterGen.plan.approvalState === 'pending') {
					planWasGenerated = true
					// Plan generated, wait for user approval - don't execute yet
					this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
					return
				}
			}
		} else {
			// Existing plan found - check if it's pending (old plans might be completed/aborted)
			if (existingPlanInfo.plan.approvalState === 'pending') {
				planWasGenerated = true
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
				return
			}
		}

		// CRITICAL: Force refresh after approval to get latest plan state (cache was invalidated)
		let planInfo = this._getCurrentPlan(threadId, true)
		if (planInfo && (planInfo.plan.approvalState === 'approved' || planInfo.plan.approvalState === 'executing')) {
			// Only initialize tracking if plan is approved/executing
			if (planInfo.plan.approvalState === 'approved') {
				// Mark plan as executing
				const updatedPlan: PlanMessage = {
					...planInfo.plan,
					approvalState: 'executing',
					executionStartTime: Date.now()
				}
				this._editMessageInThread(threadId, planInfo.planIdx, updatedPlan)
				// PERFORMANCE: Update cache in place instead of invalidating
				const cached = this._planCache.get(threadId)
				if (cached && cached.planIdx === planInfo.planIdx) {
					cached.plan = updatedPlan
					cached.lastChecked = Date.now()
					planInfo = { plan: updatedPlan, planIdx: planInfo.planIdx }
				} else {
					// Cache miss - refresh
					const refreshed = this._getCurrentPlan(threadId, true)
					if (refreshed) {
						planInfo = refreshed
					}
				}
			}

			// PERFORMANCE: Get current step once, reuse result
			const currentStep = this._getCurrentStep(threadId, false) // Try cache first
			if (currentStep && currentStep.step.status === 'queued') {
				// Start next step - returns full step info to avoid re-lookup
				const startedStep = this._startNextStep(threadId)
				if (startedStep) {
					// Use returned step info directly - no need to re-lookup
					activePlanTracking = {
						planInfo: { plan: startedStep.plan, planIdx: startedStep.planIdx },
						currentStep: {
							plan: startedStep.plan,
							planIdx: startedStep.planIdx,
							step: startedStep.step,
							stepIdx: startedStep.stepIdx
						}
					}
				} else if (planInfo) {
					// Fallback if start failed
					activePlanTracking = {
						planInfo,
						currentStep: this._getCurrentStep(threadId, false)
					}
				}
			} else {
				// planInfo is guaranteed to be defined here due to the outer if check
				activePlanTracking = {
					planInfo,
					currentStep: currentStep || this._getCurrentStep(threadId, false)
				}
			}
		}

		// Helper to update current step after operations
		const refreshPlanStep = () => {
			if (activePlanTracking) {
				activePlanTracking.currentStep = this._getCurrentStep(threadId, true)
			}
		}

		// CRITICAL: Check for pending plan before executing any tools
		// Use fast check (relies on flag and cached plan check)
		if (checkPlanGenerated()) {
			// Plan is pending approval - stop execution
			this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
			return
		}

		// before enter loop, call tool
		if (callThisToolFirst) {
			// Double-check plan status before executing (fast check)
			if (checkPlanGenerated()) {
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
				return
			}

			if (activePlanTracking?.currentStep) {
				this._linkToolCallToStepInternal(threadId, callThisToolFirst.id, activePlanTracking.currentStep)
			}

			const { interrupted } = await this._runToolCall(threadId, callThisToolFirst.name, callThisToolFirst.id, callThisToolFirst.mcpServerName, { preapproved: true, unvalidatedToolParams: callThisToolFirst.rawParams, validatedParams: callThisToolFirst.params }, false, chatMode, false)
			if (interrupted) {
				this._setStreamState(threadId, undefined)
				this._addUserCheckpoint({ threadId })
				if (activePlanTracking?.currentStep) {
					// PERFORMANCE: Use returned step info instead of re-looking up
					const updatedStep = this._markStepCompletedInternal(threadId, activePlanTracking.currentStep, false, 'Interrupted by user')
					if (updatedStep) {
						activePlanTracking.currentStep = updatedStep
						activePlanTracking.planInfo = { plan: updatedStep.plan, planIdx: updatedStep.planIdx }
					} else {
						refreshPlanStep()
					}
				}
			} else if (activePlanTracking?.currentStep) {
				// Mark the step from the ACTUAL tool outcome (mirrors the main loop): an errored
				// pre-approved callThisToolFirst must be a FAILED step, not silently completed.
				const preLoopTailMsg = this.state.allThreads[threadId]?.messages.slice(-1)[0]
				const preLoopToolMsg = preLoopTailMsg?.role === 'tool' ? (preLoopTailMsg as ToolMessage<ToolName>) : undefined
				const preLoopOutcome = classifyToolStepOutcome(preLoopToolMsg?.type ?? null)
				if (preLoopOutcome === 'failed') {
					const updatedStep = this._markStepCompletedInternal(threadId, activePlanTracking.currentStep, false, (preLoopToolMsg?.type === 'tool_error' && preLoopToolMsg.result) || 'Tool execution failed')
					if (updatedStep) {
						activePlanTracking.currentStep = updatedStep
						activePlanTracking.planInfo = { plan: updatedStep.plan, planIdx: updatedStep.planIdx }
					} else {
						refreshPlanStep()
					}
				} else if (preLoopOutcome === 'succeeded') {
					// PERFORMANCE: Use returned step info instead of re-looking up
					const updatedStep = this._markStepCompletedInternal(threadId, activePlanTracking.currentStep, true)
					if (updatedStep) {
						activePlanTracking.currentStep = updatedStep
						activePlanTracking.planInfo = { plan: updatedStep.plan, planIdx: updatedStep.planIdx }

						// Start next step - use returned value
						const startedStep = this._startNextStep(threadId)
						if (startedStep) {
							activePlanTracking.planInfo = { plan: startedStep.plan, planIdx: startedStep.planIdx }
							activePlanTracking.currentStep = {
								plan: startedStep.plan,
								planIdx: startedStep.planIdx,
								step: startedStep.step,
								stepIdx: startedStep.stepIdx
							}
						} else {
							// No more steps - refresh to get final state
							refreshPlanStep()
						}
					} else {
						// Fallback if update failed
						const startedStep = this._startNextStep(threadId)
						if (startedStep) {
							activePlanTracking.planInfo = { plan: startedStep.plan, planIdx: startedStep.planIdx }
							activePlanTracking.currentStep = {
								plan: startedStep.plan,
								planIdx: startedStep.planIdx,
								step: startedStep.step,
								stepIdx: startedStep.stepIdx
							}
						} else {
							refreshPlanStep()
						}
					}
				}
				// 'indeterminate' (e.g. invalid_params / rejected): leave the step status as-is, matching the main loop
			}
		}
		this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })  // just decorative, for clarity


		// Track if we've synthesized tools for this request (prevents infinite loops)
		// This is more reliable than checking message patterns
		let hasSynthesizedToolsInThisRequest = false

		// Flag to prevent further tool calls after file read limit is exceeded
		let fileReadLimitExceeded = false
		// Track tools executed in this request to detect incomplete workflows
		let toolsExecutedInRequest: string[] = []

		// tool use loop
		while (shouldSendAnotherMessage) {
			// CRITICAL: Check for maximum iterations to prevent infinite loops
			if (nMessagesSent >= maxAgentIterations) {
				// Phase 2: iteration-cap gate via decideLoopContinuation + shouldEscalateModel.
				const escDec = shouldEscalateModel({
					triggerSite: 'iterCap',
					modelFallbackEnabled, escalationCount, MAX_MODEL_ESCALATIONS,
					nMessagesSent, maxAgentIterations,
					consecutiveToolErrors, maxConsecutiveToolErrors,
					isAutoMode: false, autoFallbackExhausted: true,
					isRateLimitError: false, isNonRetryableError: false,
					nAttempts: 0, CHAT_RETRIES,
				})
				const iterCapDec = decideLoopContinuation({
					nMessagesSent,
					maxAgentIterations,
					consecutiveToolErrors,
					maxConsecutiveToolErrors,
					lastToolMessageType: null,
					toolCallDispatched: false,
					awaitingUserApproval: false,
					canEscalate: escDec.shouldCallEscalate,
				})
				if (iterCapDec.action === 'escalate-iter-cap' && await tryEscalateModel(`the previous model used all ${maxAgentIterations} steps without finishing`)) {
					const reset = computePostEscalationCounters('iterCap')
					nMessagesSent = reset.nMessagesSent
					consecutiveToolErrors = reset.consecutiveToolErrors
					this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
					continue
				}
				if (iterCapDec.action === 'hard-stop-iter-cap' || iterCapDec.action === 'escalate-iter-cap') {
					this._notificationService.warn(`Agent stopped after ${maxAgentIterations} tool iterations.${isLocalModel ? ' Small/local models can struggle with multi-step tool use — try Ask/Normal mode for a direct answer, or use a larger model.' : ''}`)
					this._setStreamState(threadId, { isRunning: undefined })
					return
				}
			}

			// CRITICAL: Check stream state first - if execution was interrupted/aborted, stop immediately
			const currentStreamState = this.streamState[threadId]
			if (!currentStreamState || currentStreamState.isRunning === undefined) {
				// Execution was aborted/interrupted - stop immediately
				return
			}

			// CRITICAL: Check for pending plan before each iteration - don't execute tools if plan is pending approval
			// Use fast check (flag + cached check) - only force refresh every few iterations to save performance
			if (checkPlanGenerated()) {
				// Plan is pending approval - stop execution and wait
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
				return
			}

			// false by default each iteration
			shouldSendAnotherMessage = false
			isRunningWhenEnd = undefined
			nMessagesSent += 1

			this._setStreamState(threadId, { isRunning: 'idle', interrupt: idleInterruptor })

			const chatMessages = this.state.allThreads[threadId]?.messages ?? []

			// Check if we've already synthesized a tool for this original request (prevent infinite loops)
			const allUserMessages = chatMessages.filter(m => m.role === 'user')
			const originalUserMessage = allUserMessages.find(m =>
				!m.displayContent?.includes('⚠️ CRITICAL') &&
				!m.displayContent?.includes('You did not use tools')
			)
			const originalRequestId = originalUserMessage ? `${originalUserMessage.displayContent}` : null

			// Also check message history as a fallback (more reliable than pattern matching)
			const hasSynthesizedForRequest = hasSynthesizedToolsInThisRequest || (originalRequestId && chatMessages.some((msg, idx) => {
				if (msg.role === 'assistant' && msg.displayContent?.includes('Let me start by')) {
					// Check if there's a tool message right after this assistant message
					const nextMsg = chatMessages[idx + 1]
					return nextMsg?.role === 'tool'
				}
				return false
			}))

			// Preprocess images through QA pipeline if present
			let preprocessedMessages = chatMessages;
			if (originalUserMessage && originalUserMessage.images && originalUserMessage.images.length > 0) {
				try {
					const settings = this._settingsService.state.globalSettings;
					const preprocessed = await preprocessImagesForQA(
						originalUserMessage.images,
						originalUserMessage.displayContent || '',
						resolvedModelSelection,
						settings.imageQADevMode,
						{
							allowRemoteModels: settings.imageQAAllowRemoteModels,
							enableHybridMode: settings.imageQAEnableHybridMode,
						}
					);

					if (preprocessed.shouldUsePipeline) {
						// Log QA response in dev mode for debugging
						if (settings.imageQADevMode && preprocessed.qaResponse) {
							console.log('[ImageQA] Pipeline response:', {
								confidence: preprocessed.qaResponse.confidence,
								needsLLM: !!(preprocessed.qaResponse as any)._needsLLM,
								needsVLM: !!(preprocessed.qaResponse as any)._needsVLM,
								answer: preprocessed.qaResponse.answer?.substring(0, 100),
							});
						}

						// Update the user message content with processed text if available
						// Use images from preprocessing (will be undefined if not needed)
						if (preprocessed.processedText !== undefined) {
							preprocessedMessages = chatMessages.map(msg => {
								if (msg === originalUserMessage) {
									return {
										...msg,
										content: preprocessed.processedText!,
										images: preprocessed.images, // Preprocessing decides if images are needed
										displayContent: originalUserMessage.displayContent || '',
									};
								}
								return msg;
							});
						}
					}
				} catch (error) {
					console.error('[ImageQA] Error preprocessing images:', error);
					// Continue with original messages on error
				}
			}

			// CRITICAL: Check for pending plan BEFORE preparing LLM messages (saves API calls)
			// checkPlanGenerated() already checks planWasGenerated internally, no need to check twice
			if (checkPlanGenerated()) {
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
				return
			}

			// Use resolved model selection (already validated before loop)
			// Use let so we can update it in retry logic
			let modelSelection = resolvedModelSelection
			let modelSelectionOptions = resolvedModelSelectionOptions

			// Start latency audit tracking (reuse earlyRequestId if provided for router tracking, otherwise generate new)
			const finalRequestId = earlyRequestId || generateUuid()
			const providerName = modelSelection.providerName
			const modelName = modelSelection.modelName
			// Only start new request if we didn't already start it for router tracking
			if (!earlyRequestId) {
				chatLatencyAudit.startRequest(finalRequestId, providerName, modelName)
				// For manual selection, router time is 0 (instant)
				chatLatencyAudit.markRouterStart(finalRequestId)
				chatLatencyAudit.markRouterEnd(finalRequestId)
			} else {
				// Update provider/model info if we started request early for router tracking
				const context = chatLatencyAudit.getContext(finalRequestId)
				if (context) {
					context.providerName = providerName
					context.modelName = modelName
				}
			}
			chatLatencyAudit.markPromptAssemblyStart(finalRequestId)

			// PERFORMANCE: Check cache for prepared messages before expensive preparation
			// Get repoIndexer results if promise is available (for cache key)
			let repoIndexerResults: { results: string[]; metrics: any } | null | undefined = undefined;
			if (repoIndexerPromise) {
				try {
					repoIndexerResults = await repoIndexerPromise;
				} catch {
					// Ignore errors - will prepare without cache
				}
			}

			const cacheKey = this._getMessagePrepCacheKey(preprocessedMessages, modelSelection, chatMode, repoIndexerResults, runCtx?.systemPromptOverride, runCtx?.allowedToolNames);
			const cached = this._messagePrepCache.get(cacheKey);
			const now = Date.now();

			let messages: any[];
			let separateSystemMessage: string | undefined;
			let promptTokens: number;
			let contextSize: number;

			// Use cached result if available and not expired
			if (cached && (now - cached.timestamp) < ChatThreadService.MESSAGE_PREP_CACHE_TTL) {
				messages = cached.messages;
				separateSystemMessage = cached.separateSystemMessage;
				promptTokens = cached.tokenCount;
				contextSize = cached.contextSize;
			} else {
				// Prepare messages (expensive operation)
				let prepResult: Awaited<ReturnType<typeof this._convertToLLMMessagesService.prepareLLMChatMessages>>;
				try {
					prepResult = await this._convertToLLMMessagesService.prepareLLMChatMessages({
						chatMessages: preprocessedMessages,
						modelSelection,
						chatMode,
						repoIndexerPromise: repoIndexerResults ? Promise.resolve(repoIndexerResults) : repoIndexerPromise,
						subagentSystemPrompt: runCtx?.systemPromptOverride,
						allowedToolNames: runCtx?.allowedToolNames,
						todoReminder: formatTodoReminder(this._toolsService.getLatestTodos())
					});
				} catch (prepErr) {
					// The first prompt assembly can throw (and has no prior messages to fall back to);
					// surface it like the LLM error path instead of ending the turn as a silent "Done".
					this._setStreamState(threadId, { isRunning: undefined, error: { message: `Failed to assemble the request: ${getErrorMessage(prepErr)}`, fullError: prepErr instanceof Error ? prepErr : null } });
					chatLatencyAudit.releaseContext(finalRequestId); // started at 3659; release so the render-monitor interval can stop
					this._addUserCheckpoint({ threadId });
					return;
				}
				messages = prepResult.messages;
				separateSystemMessage = prepResult.separateSystemMessage;

				// Compute token count and context size
				const tokenResult = this._computeTokenCount(messages);
				promptTokens = tokenResult.tokenCount;
				contextSize = tokenResult.contextSize;

				// Cache result (with LRU eviction)
				if (this._messagePrepCache.size >= ChatThreadService.MESSAGE_PREP_CACHE_MAX_SIZE) {
					// Remove oldest entry (simple FIFO eviction)
					const firstKey = this._messagePrepCache.keys().next().value;
					if (firstKey !== undefined) {
						this._messagePrepCache.delete(firstKey);
					}
				}
				this._messagePrepCache.set(cacheKey, {
					messages,
					separateSystemMessage,
					tokenCount: promptTokens,
					contextSize,
					timestamp: now
				});
			}

			// --- R8: opt-in auto-compaction (NON-destructive) ---
			// When an agent/plan run nears the model's context window, send a COMPACTED view of the
			// conversation (keep the original request + recent messages, replace the middle with a marker)
			// so the run continues instead of overflowing. The STORED thread is never mutated — only the
			// messages sent to the LLM this turn are windowed — so checkpoints, the UI, and history are
			// untouched. Best-effort: any failure falls back to the full prepared messages.
			// Phase 2: resolve the model context window ONCE (de-dupes the two former dynamic
			// getModelCapabilities imports) and delegate the compaction + overflow-warning decisions
			// to the pure, tested fn (common/agentLoopDecisions.ts). capsResolved gates both so an
			// import failure skips them, exactly as the old per-block try/catch did. The compaction
			// decision uses the CURRENT prompt tokens; the overflow warning is re-decided AFTER
			// compaction (which may shrink promptTokens) so it reflects the post-compaction size.
			let contextWindow = 128_000
			let capsResolved = false
			if ((chatMode === 'agent' || chatMode === 'plan') && promptTokens > 0 && modelSelection.providerName !== 'auto') {
				try {
					const { getModelCapabilities } = await import('../common/modelCapabilities.js')
					const caps = getModelCapabilities(modelSelection.providerName, modelSelection.modelName, this._settingsService.state.overridesOfModel)
					contextWindow = (caps as any).contextWindow ?? 128_000
					capsResolved = true
				} catch {
					// getModelCapabilities import may fail for some providers; leave capsResolved false to skip
				}
			}
			const compactDecision = capsResolved
				? computeCompactionOverflowDecision({
					chatMode,
					enableAutoCompaction: !!this._settingsService.state.globalSettings.enableAutoCompaction,
					promptTokens,
					contextWindow,
					providerName: modelSelection.providerName,
					messageCount: preprocessedMessages.length,
					existingThreadMessages: this.state.allThreads[threadId]?.messages ?? [],
				})
				: { shouldCompact: false, shouldWarnOverflow: false, overflowPct: null }
			if (compactDecision.shouldCompact) {
				try {
					const win = selectCompactionWindow(preprocessedMessages.length)
					if (win) {
						const omitted = win.end - win.start
						const marker: ChatMessage = {
							role: 'assistant',
							displayContent: `[Auto-compacted: ${omitted} earlier message${omitted === 1 ? '' : 's'} omitted to stay within the ~${Math.round(contextWindow / 1000)}k context window. The original request and recent messages are preserved; ask if you need detail from earlier.]`,
							reasoning: '',
							anthropicReasoning: null,
						}
						const compactedView: ChatMessage[] = [
							...preprocessedMessages.slice(0, win.start),
							marker,
							...preprocessedMessages.slice(win.end),
						]
						const prep2 = await this._convertToLLMMessagesService.prepareLLMChatMessages({
							chatMessages: compactedView,
							modelSelection,
							chatMode,
							repoIndexerPromise: repoIndexerResults ? Promise.resolve(repoIndexerResults) : repoIndexerPromise,
							subagentSystemPrompt: runCtx?.systemPromptOverride,
							allowedToolNames: runCtx?.allowedToolNames,
							todoReminder: formatTodoReminder(this._toolsService.getLatestTodos())
						})
						if (prep2.messages && prep2.messages.length > 0) {
							messages = prep2.messages
							separateSystemMessage = prep2.separateSystemMessage
							const tr2 = this._computeTokenCount(messages)
							promptTokens = tr2.tokenCount
							contextSize = tr2.contextSize
							this._metricsService.capture('Conversation Compacted', { threadId, omitted, chatMode, contextWindow })
						}
					}
				} catch {
					// compaction is best-effort; on any error keep the full prepared messages
				}
			}

			// CRITICAL: Validate that messages are not empty before sending to API
			// Empty messages cause "invalid message format" errors
			if (!messages || messages.length === 0) {
				this._notificationService.error('Failed to prepare messages. Please check your message content.')
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
				return
			}

			// Context overflow guard: warn when estimated token usage exceeds 70% of the model's context
			// window. Re-evaluated AFTER compaction so it reflects the post-compaction prompt size; warns
			// at most once per conversation (the pure fn scans the stored thread for a prior warning).
			const overflowDecision = capsResolved
				? computeCompactionOverflowDecision({
					chatMode,
					enableAutoCompaction: !!this._settingsService.state.globalSettings.enableAutoCompaction,
					promptTokens,
					contextWindow,
					providerName: modelSelection.providerName,
					messageCount: preprocessedMessages.length,
					existingThreadMessages: this.state.allThreads[threadId]?.messages ?? [],
				})
				: { shouldCompact: false, shouldWarnOverflow: false, overflowPct: null }
			if (overflowDecision.shouldWarnOverflow && overflowDecision.overflowPct != null) {
				this._notificationService.warn(
					`Context is ${overflowDecision.overflowPct}% full (~${Math.round(promptTokens / 1000)}k / ${Math.round(contextWindow / 1000)}k tokens). ` +
					`The agent may start losing earlier context. Consider starting a new thread.`
				)
			}

			// CRITICAL: Check again after async operation (plan might have been added during prep)
			// Invalidate cache in case plan was added during message prep, then use fast check
			this._planCache.delete(threadId)
			if (checkPlanGenerated()) {
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
				return
			}

			if (interruptedWhenIdle) {
				this._setStreamState(threadId, undefined)
				return
			}

			// PERFORMANCE: Token count and context size already computed (from cache or preparation)
			// No need to recompute - use cached values
			chatLatencyAudit.markPromptAssemblyEnd(finalRequestId, promptTokens, 0, contextSize, false)

			// Audit log: record prompt
			// PERFORMANCE: Cache isEnabled() check to avoid repeated calls
			const auditEnabled = this._auditLogService.isEnabled();
			if (auditEnabled && modelSelection) {
				await this._auditLogService.append({
					ts: Date.now(),
					action: 'prompt',
					model: `${modelSelection.providerName}/${modelSelection.modelName}`,
					ok: true,
					meta: {
						threadId,
						requestId: finalRequestId,
						promptTokens,
						contextSize,
					},
				});
			}

			let shouldRetryLLM = true
			let nAttempts = 0
			let firstTokenReceived = false
			// Track models we've tried (for auto mode fallback)
			const triedModels: Set<string> = new Set()
			// Store original routing decision for fallback chain (only in auto mode)
			let originalRoutingDecision: RoutingDecision | null = null
			// Track if we're in auto mode (user selected "auto")
			const isAutoMode = !modelSelection || isAutoModelSelection(modelSelection) ||
				isAutoModelSelection(this._settingsService.state.modelSelectionOfFeature['Chat'])

			// If in auto mode and we have a model selection, try to get the routing decision for fallback chain
			if (isAutoMode && modelSelection && modelSelection.providerName !== 'auto') {
				// We'll get the routing decision when we need it (on first error)
			}

			// Track previous model to detect switches
			let previousModelKey: string | null = null

			while (shouldRetryLLM) {
				shouldRetryLLM = false
				nAttempts += 1

				// Track this model attempt
				if (modelSelection && modelSelection.providerName !== 'auto') {
					const modelKey = `${modelSelection.providerName}/${modelSelection.modelName}`
					triedModels.add(modelKey)

					// Re-prepare messages if we switched models (for auto mode fallback)
					// This ensures messages are formatted correctly for the new model
					if (previousModelKey !== null && previousModelKey !== modelKey) {
						try {
							console.log(`[ChatThreadService] Re-preparing messages for new model: ${modelKey}`)
							// PERFORMANCE: Use cache for model switch too
							const switchCacheKey = this._getMessagePrepCacheKey(preprocessedMessages, modelSelection, chatMode, repoIndexerResults, runCtx?.systemPromptOverride, runCtx?.allowedToolNames);
							const switchCached = this._messagePrepCache.get(switchCacheKey);
							const switchNow = Date.now();

							if (switchCached && (switchNow - switchCached.timestamp) < ChatThreadService.MESSAGE_PREP_CACHE_TTL) {
								// Use cached result
								messages = switchCached.messages;
								separateSystemMessage = switchCached.separateSystemMessage;
								promptTokens = switchCached.tokenCount;
								contextSize = switchCached.contextSize;
							} else {
								// Prepare messages (cache miss)
								const prepResult = await this._convertToLLMMessagesService.prepareLLMChatMessages({
									chatMessages: preprocessedMessages,
									modelSelection,
									chatMode,
									repoIndexerPromise: repoIndexerResults ? Promise.resolve(repoIndexerResults) : repoIndexerPromise,
									subagentSystemPrompt: runCtx?.systemPromptOverride,
									allowedToolNames: runCtx?.allowedToolNames,
									todoReminder: formatTodoReminder(this._toolsService.getLatestTodos())
								});
								messages = prepResult.messages;
								separateSystemMessage = prepResult.separateSystemMessage;

								// Compute token count
								const tokenResult = this._computeTokenCount(messages);
								promptTokens = tokenResult.tokenCount;
								contextSize = tokenResult.contextSize;

								// Cache result
								if (this._messagePrepCache.size >= ChatThreadService.MESSAGE_PREP_CACHE_MAX_SIZE) {
									const firstKey = this._messagePrepCache.keys().next().value;
									if (firstKey !== undefined) {
										this._messagePrepCache.delete(firstKey);
									}
								}
								this._messagePrepCache.set(switchCacheKey, {
									messages,
									separateSystemMessage,
									tokenCount: promptTokens,
									contextSize,
									timestamp: switchNow
								});
							}

							// Only update if we got valid messages
							if (messages && messages.length > 0) {
								// Update finalRequestId context with new prompt tokens
								const promptTokens = messages.reduce((acc, m) => {
									// Handle Gemini messages (use 'parts' instead of 'content')
									if ('parts' in m) {
										return acc + m.parts.reduce((sum: number, part: { text?: string; inlineData?: { mimeType: string; data: string } }) => {
											if ('text' in part && typeof part.text === 'string') {
												return sum + Math.ceil(part.text.length / 4)
											} else if ('inlineData' in part) {
												return sum + 100
											}
											return sum
										}, 0)
									}
									// Handle Anthropic/OpenAI messages (use 'content')
									if ('content' in m) {
										if (typeof m.content === 'string') {
											return acc + Math.ceil(m.content.length / 4)
										} else if (Array.isArray(m.content)) {
											return acc + m.content.reduce((sum: number, part: any) => {
												if (part.type === 'text') {
													return sum + Math.ceil(part.text.length / 4)
												} else if (part.type === 'image_url') {
													return sum + 100
												}
												return sum
											}, 0)
										}
										return acc + Math.ceil(JSON.stringify(m.content).length / 4)
									}
									return acc
								}, 0)
								chatLatencyAudit.markPromptAssemblyEnd(finalRequestId, promptTokens, 0, 0, false)
							}
						} catch (prepError) {
							console.error('[ChatThreadService] Error re-preparing messages for new model:', prepError)
							// Continue with existing messages if re-prep fails
						}
					}
					previousModelKey = modelKey
				}

				type ResTypes =
					| { type: 'llmDone', toolCall?: RawToolCallObj, info: { fullText: string, fullReasoning: string, anthropicReasoning: AnthropicReasoning[] | null } }
					| { type: 'llmError', error?: { message: string; fullError: Error | null; } }
					| { type: 'llmAborted' }

				let resMessageIsDonePromise: (res: ResTypes) => void // resolves when user approves this tool use (or if tool doesn't require approval)
				const messageIsDonePromise = new Promise<ResTypes>((res, rej) => { resMessageIsDonePromise = res })

				// Track if message is done to prevent late onText updates
				let messageIsDone = false

				// Track network request start (when we actually send to the LLM)
				chatLatencyAudit.markNetworkStart(finalRequestId)
				// Track network start time for timeout fallback (if no tokens arrive)
				const networkTimeout = setTimeout(() => {
					// Fallback: if no tokens arrive within 30s, mark network end anyway
					const context = chatLatencyAudit.getContext(finalRequestId)
					if (context && !context.networkEndTime) {
						chatLatencyAudit.markNetworkEnd(finalRequestId)
					}
				}, 30000)

				const llmCancelToken = this._llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					chatMode,
					messages: messages,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel,
					logging: { loggingName: `Chat - ${chatMode}`, loggingExtras: { threadId, nMessagesSent, chatMode, requestId: finalRequestId } },
					separateSystemMessage: separateSystemMessage,
					onText: ({ fullText, fullReasoning, toolCall }) => {
						// Guard: Don't update stream state if message is already done (prevents late onText calls from requestAnimationFrame)
						if (messageIsDone) {
							return
						}

						// Clear timeout once we receive first chunk
						clearTimeout(networkTimeout)
						// Track first token (TTFS) and network end (when we receive first chunk)
						// Check both fullText and fullReasoning - first token might be in either
						if (!firstTokenReceived && (fullText.length > 0 || fullReasoning.length > 0)) {
							firstTokenReceived = true
							chatLatencyAudit.markNetworkEnd(finalRequestId) // Network complete when first token arrives
							chatLatencyAudit.markFirstToken(finalRequestId)
						}

						// Batch token updates for smooth 60 FPS rendering
						const context = chatLatencyAudit.getContext(finalRequestId);
						if (context) {
							context.currentBatchSize++;
							const now = performance.now();
							// Flush batch if enough time has passed (target 60fps = ~16.67ms)
							if (now - context.lastBatchTime >= 16.67) {
								if (context.renderBatchSizes.length < 100) {
									context.renderBatchSizes.push(context.currentBatchSize);
								}
								context.currentBatchSize = 0;
								context.lastBatchTime = now;
							}
						}

						// Use requestAnimationFrame for smooth updates
						requestAnimationFrame(() => {
							// Guard again: Check if message is done before updating state (prevents race conditions)
							if (messageIsDone) {
								return
							}
							// Also check if stream state is still 'LLM' (another guard against late updates)
							const currentState = this.streamState[threadId]
							if (currentState?.isRunning !== 'LLM') {
								return
							}

							// Record render frame for FPS tracking
							chatLatencyAudit.recordRenderFrame(finalRequestId)
							this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: fullText, reasoningSoFar: fullReasoning, toolCallSoFar: toolCall ?? null }, interrupt: Promise.resolve(() => { if (llmCancelToken) this._llmMessageService.abort(llmCancelToken) }) })
						})
					},
					onFinalMessage: async ({ fullText, fullReasoning, toolCall, anthropicReasoning, }) => {
						// Mark message as done to prevent late onText updates
						messageIsDone = true

						// Clear timeout
						clearTimeout(networkTimeout)
						// Ensure network end and first token are tracked (fallback for non-streaming responses)
						// If onText was never called, this is a non-streaming response - treat final message as first token
						if (!firstTokenReceived) {
							chatLatencyAudit.markNetworkEnd(finalRequestId)
							// For non-streaming responses, the final message IS the first token
							// Only mark if we actually have content (not an empty response)
							const hasContent = (fullText && fullText.length > 0) || (fullReasoning && fullReasoning.length > 0)
							if (hasContent) {
								chatLatencyAudit.markFirstToken(finalRequestId)
							}
						}
						// Track completion (TTS) and output tokens
						// Use fullText length, or fallback to reasoning if text is empty
						const textToCount = fullText || fullReasoning || '';
						// More accurate token estimation: account for markdown, code blocks, etc.
						const outputTokens = textToCount.length > 0 ? Math.max(1, Math.ceil(textToCount.length / 3.5)) : 0
						chatLatencyAudit.markStreamComplete(finalRequestId, outputTokens)
						// Log metrics for debugging
						// Always release the context (else it leaks + the 60Hz render-monitor never stops);
						// only compute metrics when auditing (getMetrics has overhead).
						let metrics: ReturnType<typeof chatLatencyAudit.completeRequest> = null
						if (auditEnabled) {
							metrics = chatLatencyAudit.completeRequest(finalRequestId)
							if (metrics) {
								chatLatencyAudit.logMetrics(metrics)
							}
						} else {
							chatLatencyAudit.releaseContext(finalRequestId)
						}

						// Audit log: record reply
						// PERFORMANCE: Reuse cached auditEnabled check from earlier in function
						if (auditEnabled && modelSelection) {
							await this._auditLogService.append({
								ts: Date.now(),
								action: 'reply',
								model: `${modelSelection.providerName}/${modelSelection.modelName}`,
								latencyMs: metrics ? metrics.tts : undefined,
								ok: true,
								meta: {
									threadId,
									requestId: finalRequestId,
									outputTokens,
									ttfs: metrics?.ttfs,
								},
							});
						}

						resMessageIsDonePromise({ type: 'llmDone', toolCall, info: { fullText, fullReasoning, anthropicReasoning } }) // resolve with tool calls
					},
					onError: async (error) => {
						// Clear timeout
						clearTimeout(networkTimeout)
						// Ensure network end is tracked even on error (idempotent - safe to call multiple times)
						chatLatencyAudit.markNetworkEnd(finalRequestId)
						// Mark stream as complete with 0 tokens on error
						chatLatencyAudit.markStreamComplete(finalRequestId, 0)
						// Release the context, else it (and the 60Hz render-monitor interval) leaks on every
						// errored request. A retry/fallover re-arms a fresh context under the same finalRequestId
						// before its next attempt, so this is safe even when the loop is about to retry.
						chatLatencyAudit.releaseContext(finalRequestId)

						// Clear stream state immediately so submit button becomes active (avoids stuck "Waiting for model response..." if audit or resolve fails)
						this._setStreamState(threadId, { isRunning: undefined, error })

						try {
							// Audit log: record error
							if (auditEnabled && modelSelection) {
								await this._auditLogService.append({
									ts: Date.now(),
									action: 'reply',
									model: `${modelSelection.providerName}/${modelSelection.modelName}`,
									ok: false,
									meta: {
										threadId,
										requestId: finalRequestId,
										error: error?.message,
									},
								});
							}
						} finally {
							resMessageIsDonePromise({ type: 'llmError', error: error })
						}
					},
					onAbort: () => {
						// stop the loop to free up the promise, but don't modify state (already handled by whatever stopped it)
						// Abort is terminal for this request: release the context so the 60Hz render-monitor can stop.
						chatLatencyAudit.releaseContext(finalRequestId)
						resMessageIsDonePromise({ type: 'llmAborted' })
						this._metricsService.capture('Agent Loop Done (Aborted)', { nMessagesSent, chatMode })
					},
				})

				// mark as streaming
				if (!llmCancelToken) {
					this._setStreamState(threadId, { isRunning: undefined, error: { message: 'There was an unexpected error when sending your chat message.', fullError: null } })
					break
				}

				// Update status to show we're waiting for the model response
				const iterLabel = (chatMode === 'agent' || chatMode === 'plan') && nMessagesSent > 1
					? `Step ${nMessagesSent} — thinking...`
					: 'Waiting for model response...'
				this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: iterLabel, reasoningSoFar: '', toolCallSoFar: null }, interrupt: Promise.resolve(() => this._llmMessageService.abort(llmCancelToken)) })
				const llmRes = await messageIsDonePromise // wait for message to complete

				// Only the SUCCESS path may bail when a newer thread took over. For our OWN error/abort result
				// we MUST proceed to handle it: the onError handler above sets isRunning=undefined (to unstick
				// the UI), so this generic "interrupted by a newer thread" guard was swallowing EVERY llmError —
				// making the auto-fallback AND model-failover in the llmError branch below unreachable on every
				// error (incl. free-tier exhaustion). Confirmed live: post-send showed isRunning=undefined.
				if (llmRes.type !== 'llmError' && this.streamState[threadId]?.isRunning !== 'LLM') {
					// console.log('Chat thread interrupted by a newer chat thread', this.streamState[threadId]?.isRunning)
					return
				}

				// llm res aborted
				if (llmRes.type === 'llmAborted') {
					this._setStreamState(threadId, undefined)
					return
				}
				// llm res error
				else if (llmRes.type === 'llmError') {
					const { error } = llmRes
					// Check if this is a rate limit / quota-exhaustion error. Must match the SAME shapes the
					// service layer treats as rate-limits (it injects the "all free tiers exhausted" message on
					// these) — notably Google's "quota exceeded" / "RESOURCE_EXHAUSTED", which the old check
					// (only 429/rate limit/tpm) MISSED, so avoidFreeTier never engaged for gemini free-tier.
					const isRateLimitError = isRateLimitErrorMessage(error?.message || '')

					// In auto mode, try fallback models for ALL errors (not just rate limits)
					// This ensures auto mode is resilient even if one model is failing
					if (isAutoMode) {
						// Get routing decision if we don't have it yet
						if (!originalRoutingDecision && originalUserMessage) {
							try {
								const taskType = this._detectTaskType(originalUserMessage.content, originalUserMessage.images, originalUserMessage.pdfs)
								const hasImages = originalUserMessage.images && originalUserMessage.images.length > 0
								const hasPDFs = originalUserMessage.pdfs && originalUserMessage.pdfs.length > 0
								const hasCode = this._detectCodeInMessage(originalUserMessage.content)
								// Use the SAME tested detector as the initial routing (line ~764) so failover routing
								// agrees with it. The previous inline regex had drifted to a narrower subset of these patterns.
								const isCodebaseQuestion = looksLikeCodebaseQuestion(originalUserMessage.content)
								const requiresComplexReasoning = isCodebaseQuestion
								const isLongMessage = originalUserMessage.content.length > 500

								const context: TaskContext = {
									taskType,
									hasImages,
									hasPDFs,
									hasCode,
									requiresPrivacy: false,
									preferLowLatency: false,
									preferLowCost: false,
									userOverride: null,
									requiresComplexReasoning,
									isLongMessage,
								}

								originalRoutingDecision = await this._modelRouter.route(context)
							} catch (routerError) {
								console.error('[ChatThreadService] Error getting routing decision for fallback:', routerError)
							}
						}

						// Try next model from fallback chain
						let nextModel: ModelSelection | null = null
						if (originalRoutingDecision?.fallbackChain && originalRoutingDecision.fallbackChain.length > 0) {
							// Find first model in fallback chain that we haven't tried
							const fallbackChain: ModelSelection[] = originalRoutingDecision.fallbackChain
							for (const fallbackModel of fallbackChain) {
								const modelKey = `${fallbackModel.providerName}/${fallbackModel.modelName}`
								if (!triedModels.has(modelKey)) {
									nextModel = fallbackModel
									break
								}
							}
						}

						// If no fallback model available, try to get a new routing decision excluding tried models
						if (!nextModel && originalUserMessage) {
							try {
								// Get all available models
								const settingsState = this._settingsService.state
								const availableModels: ModelSelection[] = []
								for (const providerName of Object.keys(settingsState.settingsOfProvider) as ProviderName[]) {
									const providerSettings = settingsState.settingsOfProvider[providerName]
									if (!providerSettings._didFillInProviderSettings) continue
									for (const modelInfo of providerSettings.models) {
										if (!modelInfo.isHidden) {
											const modelKey = `${providerName}/${modelInfo.modelName}`
											if (!triedModels.has(modelKey)) {
												availableModels.push({
													providerName,
													modelName: modelInfo.modelName,
												})
											}
										}
									}
								}

								// If we have other models available, try to route to one
								if (availableModels.length > 0) {
									const taskType = this._detectTaskType(originalUserMessage.content, originalUserMessage.images, originalUserMessage.pdfs)
									const hasImages = originalUserMessage.images && originalUserMessage.images.length > 0
									const hasPDFs = originalUserMessage.pdfs && originalUserMessage.pdfs.length > 0
									const hasCode = this._detectCodeInMessage(originalUserMessage.content)
									const lowerMessage = originalUserMessage.content.toLowerCase().trim()
									const isCodebaseQuestion = /\b(codebase|code base|repository|repo|project)\b/.test(lowerMessage)
									const requiresComplexReasoning = isCodebaseQuestion
									const isLongMessage = originalUserMessage.content.length > 500

									const context: TaskContext = {
										taskType,
										hasImages,
										hasPDFs,
										hasCode,
										requiresPrivacy: false,
										preferLowLatency: false,
										preferLowCost: false,
										userOverride: null,
										requiresComplexReasoning,
										isLongMessage,
									}

									const newRoutingDecision = await this._modelRouter.route(context)
									if (newRoutingDecision.modelSelection.providerName !== 'auto') {
										const modelKey = `${newRoutingDecision.modelSelection.providerName}/${newRoutingDecision.modelSelection.modelName}`
										if (!triedModels.has(modelKey)) {
											nextModel = newRoutingDecision.modelSelection
											originalRoutingDecision = newRoutingDecision // Update for next fallback
										}
									}
								}
							} catch (routerError) {
								console.error('[ChatThreadService] Error getting new routing decision:', routerError)
							}
						}

						// LAST-RESORT forward progress: _modelRouter.route() has no exclude-tried parameter, so
						// both the fallbackChain loop and the re-route above can leave nextModel null whenever the
						// top-scored model is already tried (e.g. a just-429'd gemini that keeps winning the score).
						// That silently dead-ends the whole turn — the user's "one error after another". Guarantee
						// progress by directly picking the best UNTRIED configured model. Prefer the largest context
						// window so we don't fail over onto a 4096-ctx alias or a tiny coder that would just truncate.
						if (isAutoMode && !nextModel) {
							try {
								const { getModelCapabilities } = await import('../common/modelCapabilities.js')
								const overrides = this._settingsService.state.overridesOfModel
								const untried: ModelSelection[] = []
								for (const providerName of Object.keys(this._settingsService.state.settingsOfProvider) as ProviderName[]) {
									const ps = this._settingsService.state.settingsOfProvider[providerName]
									if (!ps._didFillInProviderSettings) continue
									for (const mi of ps.models) {
										if (mi.isHidden) continue
										if (triedModels.has(`${providerName}/${mi.modelName}`)) continue
										untried.push({ providerName, modelName: mi.modelName })
									}
								}
								const ctxOf = (m: ModelSelection) => { try { return getModelCapabilities(m.providerName as Exclude<ProviderName, 'auto'>, m.modelName, overrides).contextWindow ?? 0 } catch { return 0 } }
								nextModel = untried.sort((a, b) => ctxOf(b) - ctxOf(a))[0] ?? null
							} catch (e) {
								console.error('[ChatThreadService] last-resort fallback selection failed:', e)
							}
						}

						// If we found a next model, switch to it and retry
						if (nextModel) {
							// Safety check: prevent infinite loops by limiting total model switches
							if (triedModels.size >= 10) {
								console.warn('[ChatThreadService] Auto mode: Too many model switches, stopping fallback attempts')
								// Fall through to show error
							} else {
								console.log(`[ChatThreadService] Auto mode: Model ${modelSelection?.providerName}/${modelSelection?.modelName} failed, trying fallback: ${nextModel.providerName}/${nextModel.modelName}`)
								modelSelection = nextModel
								// Update resolvedModelSelection and options for next iteration
								resolvedModelSelection = nextModel
								// Type assertion is safe because nextModel is not "auto" (it came from fallback chain)
								const nextProviderName = nextModel.providerName as Exclude<typeof nextModel.providerName, 'auto'>
								resolvedModelSelectionOptions = this._settingsService.state.optionsOfModelSelection['Chat']?.[nextProviderName]?.[nextModel.modelName]
								// Re-arm the latency context for the next attempt. The retry loop keeps using
								// finalRequestId (it is `const`, declared before the loop), so the context must be
								// started under THAT id. The previous code started a throwaway newRequestId the retry
								// never used, orphaning a context (and its 60Hz interval) that was never released.
								chatLatencyAudit.startRequest(finalRequestId, nextModel.providerName, nextModel.modelName)
								chatLatencyAudit.markRouterStart(finalRequestId)
								chatLatencyAudit.markRouterEnd(finalRequestId)
								// Reset attempt counter for new model (but keep triedModels to avoid retrying same model)
								nAttempts = 0
								shouldRetryLLM = true
								this._setStreamState(threadId, { isRunning: 'idle', interrupt: idleInterruptor })
								// Short delay before trying next model
								await timeout(500)
								if (interruptedWhenIdle) {
									this._setStreamState(threadId, undefined)
									return
								}
								continue // retry with new model
							}
						}
					}

					// (1) Give the user's explicitly-chosen model a chance to recover from a TRANSIENT error
					// (network blip) by retrying the same model a couple times. Skip non-retryable errors
					// (401/403/404/model-not-found) AND rate-limits / free-tier exhaustion — retrying the SAME
					// model won't help, so fall straight through to the escalation below. (Previously a
					// rate-limited non-auto model returned here with a "switch to your local model manually"
					// message; now the escalation auto-switches to another configured model — including your
					// LOCAL model — so you keep working without touching anything.)
					const isNonRetryable = this._isNonRetryableModelError(error)
					if (!isAutoMode && !isNonRetryable && !isRateLimitError && nAttempts < CHAT_RETRIES) {
						shouldRetryLLM = true
						this._setStreamState(threadId, { isRunning: 'idle', interrupt: idleInterruptor })
						// Faster retries for local models (they fail fast if not available)
						const isLocalProvider = modelSelection && (modelSelection.providerName === 'ollama' || modelSelection.providerName === 'vLLM' || modelSelection.providerName === 'lmStudio' || modelSelection.providerName === 'openAICompatible' || modelSelection.providerName === 'liteLLM')
						// Use shorter delays for local models: 0.5s, 1s, 2s (vs 1s, 2s, 4s for remote)
						const baseDelay = isLocalProvider ? 500 : INITIAL_RETRY_DELAY
						const retryDelay = Math.min(baseDelay * Math.pow(2, nAttempts - 1), MAX_RETRY_DELAY)
						await timeout(retryDelay)
						if (interruptedWhenIdle) {
							this._setStreamState(threadId, undefined)
							return
						}
						else
							continue // retry
					}
					// (2) THE FIX (findings #1/#2): retries are exhausted, or the model is fundamentally broken
					// (rate-limited / bad key / model-not-found). Escalate the SAME task to the best other
					// configured model — preferring a capable cloud model when the failing one is local. This is
					// what makes "my local model failed but I have a capable cloud key" actually recover, and it
					// works whether the user picked Auto or a specific model. (Auto's own fallback above already
					// ran; seed its tried set so we don't re-pick the same models.)
					for (const k of triedModels) { escalationUsedModels.add(k) }
					const escalationReason = isRateLimitError ? 'the previous model was rate-limited'
						: isNonRetryable ? 'the previous model was unavailable'
							: 'the previous model errored'
					if (await tryEscalateModel(escalationReason, { avoidFreeTier: isRateLimitError })) {
						modelSelection = resolvedModelSelection
						modelSelectionOptions = resolvedModelSelectionOptions
						nAttempts = 0
						shouldRetryLLM = true
						this._setStreamState(threadId, { isRunning: 'idle', interrupt: idleInterruptor })
						await timeout(300)
						if (interruptedWhenIdle) {
							this._setStreamState(threadId, undefined)
							return
						}
						continue // retry the task on the escalated model
					}

					// (3) Nothing left to fall over to — surface the error (exhaustion-aware). NOTE: the onError
					// handler already set streamState to { isRunning: undefined, error } (no llmInfo), so read
					// any partial output defensively — llmInfo is gone by the time we reach here.
					{
						const llmInfo = this.streamState[threadId]?.llmInfo
						const toolCallSoFar = llmInfo?.toolCallSoFar ?? null
						this._addMessageToThread(threadId, { role: 'assistant', displayContent: llmInfo?.displayContentSoFar ?? '', reasoning: llmInfo?.reasoningSoFar ?? '', anthropicReasoning: null })
						if (toolCallSoFar) this._addMessageToThread(threadId, { role: 'interrupted_streaming_tool', name: toolCallSoFar.name, mcpServerName: this._computeMCPServerOfToolName(toolCallSoFar.name) })

						this._setStreamState(threadId, { isRunning: undefined, error: this._exhaustionAwareError(error) })
						this._addUserCheckpoint({ threadId })
						return
					}
				}

				// CRITICAL: Check for pending plan before executing any tool from LLM response
				// Use fast check - flag should catch most cases
				if (checkPlanGenerated()) {
					// Plan is pending approval - stop execution and wait
					this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
					return
				}

				// llm res success
				let { toolCall, info } = llmRes

				// Native tool_calls and XML-extracted calls carry the model's RAW tool name; map known
				// synonyms (create_file -> create_file_or_folder, done -> attempt_completion, run -> run_command,
				// ...) once here so every downstream consumer — execution, completion detection, plan-step
				// matching, MCP-server resolution — agrees on the canonical name (finding #4). Idempotent; the
				// JSON-text path is already canonical.
				if (toolCall && typeof toolCall.name === 'string') {
					// Also normalize param names (path/file/filepath -> uri) so a native tool_call that uses a
					// non-`uri` file param doesn't fail validation. Pollinations returns no native tool_calls
					// (handled by the JSON-text parser below), but other gateways/models can.
					toolCall = { ...toolCall, name: canonicalizeToolName(toolCall.name) as ToolName, rawParams: canonicalizeToolParams(toolCall.rawParams) as typeof toolCall.rawParams }
				}

				// CRITICAL: Check if the model output a tool call as TEXT (JSON or Anthropic XML) instead of
				// using native tool calling - common for local Ollama coders and some gateways. The pure
				// recognizer (common/toolCallRecognition.ts) also strips any hallucinated multi-tool transcript
				// after the first real call so it can't leak into the shown text or the conversation history.
				// B1: did the model emit structured tool-call markup we could not parse? (set below)
				let attemptedMalformedToolCall = false
				if (!toolCall && info.fullText.trim()) {
					const recognized = recognizeTextToolCall(info.fullText)
					if (recognized.parsed) {
						const toolId = generateUuid()
						toolCall = {
							name: recognized.parsed.toolName as ToolName,
							rawParams: recognized.parsed.toolParams as RawToolParamsObj,
							id: toolId,
							isDone: true,
							doneParams: Object.keys(recognized.parsed.toolParams)
						}
						info = { ...info, fullText: recognized.preamble }
					} else {
						attemptedMalformedToolCall = recognized.attemptedButMalformed
					}
				}

				// Track if we synthesized a tool and added a message (to prevent duplicate messages)
				let toolSynthesizedAndMessageAdded = false

				// Check if model supports tool calling before synthesizing tools
				// This prevents infinite loops when models don't support tools
				// CRITICAL: Only synthesize tools if:
				// 1. Model has specialToolFormat set (native tool calling support)
				// 2. We haven't already synthesized tools for this request (prevents loops)
				// 3. Model actually responded (not an error case)
				let modelSupportsTools = false
				if (modelSelection && modelSelection.providerName !== 'auto') {
					const { getModelCapabilities } = await import('../common/modelCapabilities.js')
					const capabilities = getModelCapabilities(modelSelection.providerName, modelSelection.modelName, overridesOfModel)
					// Model supports tools if it has specialToolFormat set (native tool calling)
					// BUT: If we've already synthesized tools once and model didn't use them, don't try again
					// This prevents infinite loops when models have specialToolFormat set but don't actually support tools
					modelSupportsTools = !!capabilities.specialToolFormat && !hasSynthesizedForRequest
				}

				// Check if we're in normal mode and user is trying to do something that requires tools
				if (chatMode === 'normal' && !toolCall && info.fullText.trim() && originalUserMessage) {
					const userRequest = originalUserMessage.displayContent?.toLowerCase() || ''
					const actionWords = ['add', 'create', 'edit', 'delete', 'remove', 'update', 'modify', 'change', 'make', 'write', 'build', 'implement', 'fix', 'run', 'execute']
					const isActionRequest = actionWords.some(word => userRequest.includes(word))

					if (isActionRequest) {
						// User is trying to do something that requires tools, but we're in normal mode
						this._addMessageToThread(threadId, {
							role: 'assistant',
							displayContent: `I understand you want to ${originalUserMessage.displayContent}, but I'm currently in **Normal** mode which doesn't allow file operations.\n\nTo perform file edits, create files, or run commands, please switch to **Agent** mode using the dropdown in the chat interface.\n\n**Normal mode**: Chat only, no file operations\n**Gather mode**: Can read files, but can't edit\n**Agent mode**: Full access to edit files, create files, and run commands`,
							reasoning: '',
							anthropicReasoning: null
						})
						this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
						this._addUserCheckpoint({ threadId })
						return
					}
				}

				// Detect if Agent Mode should have used tools but didn't
				// Only synthesize ONCE per original request to prevent infinite loops
				// Also check if we've already read too many files (prevent infinite read loops)
				// CRITICAL: Only synthesize tools if the model actually supports them
				// Don't synthesize tools if file read limit was exceeded
				if ((chatMode === 'agent' || chatMode === 'plan') && !toolCall && info.fullText.trim() && !hasSynthesizedForRequest && filesReadInQuery < MAX_FILES_READ_PER_QUERY && !fileReadLimitExceeded && modelSupportsTools) {
					if (originalUserMessage) {
						const userRequest = originalUserMessage.displayContent?.toLowerCase() || ''
						const hasImages = originalUserMessage.images && originalUserMessage.images.length > 0
						// Phase 2: the (intricate, weak-model-critical) decision of WHETHER to fabricate a tool
						// call from the model's prose is delegated to the pure, tested decision fn
						// (common/toolSynthesisDecision.ts). The synthesis ACTION + its result-dependent guard
						// stay inline below; this is byte-for-byte the same gate as the previous inline conditions.
						const synthDecision = decideToolSynthesis({
							chatMode,
							hasToolCall: !!toolCall,
							fullText: info.fullText,
							hasOriginalUserMessage: true,
							userRequest,
							hasImages: !!hasImages,
							hasSynthesizedForRequest: !!hasSynthesizedForRequest,
							filesReadInQuery,
							maxFilesReadPerQuery: MAX_FILES_READ_PER_QUERY,
							fileReadLimitExceeded,
							modelSupportsTools,
							nAttempts,
							toolsExecutedCount: toolsExecutedInRequest.length,
						})
						if (synthDecision.shouldSynthesize) {
							const synthesizedToolCall = this._synthesizeToolCallFromIntent(userRequest, originalUserMessage.displayContent || '')
							// Also skip if synthesized call is search_for_files and images are present
							if (synthesizedToolCall && !(hasImages && synthesizedToolCall.toolName === 'search_for_files')) {
								const { toolName, toolParams } = synthesizedToolCall
								const toolId = generateUuid()

								// Add assistant message explaining we're auto-executing
								let actionMessage = 'taking action'
								if (toolName === 'search_for_files') {
									actionMessage = 'finding relevant files'
								} else if (toolName === 'read_file') {
									actionMessage = 'reading the file'
								} else if (toolName === 'web_search') {
									actionMessage = 'searching the web'
								} else if (toolName === 'browse_url') {
									actionMessage = 'fetching the web page'
								}
								this._addMessageToThread(threadId, {
									role: 'assistant',
									displayContent: `I'll help you with that. Let me start by ${actionMessage}...`,
									reasoning: '',
									anthropicReasoning: null
								})
								toolSynthesizedAndMessageAdded = true
								// Mark that we've synthesized tools for this request (prevents infinite loops)
								hasSynthesizedToolsInThisRequest = true

								// CRITICAL: Check for pending plan before executing synthesized tool
								// Use fast check
								if (checkPlanGenerated()) {
									this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
									return
								}

								// Execute the synthesized tool
								const mcpTools = this._mcpService.getMCPTools()
								const mcpTool = mcpTools?.find(t => t.name === toolName as ToolName)
								const { awaitingUserApproval, interrupted, completionSignaled: hwCompletion } = await this._runToolCall(
									threadId,
									toolName as ToolName,
									toolId,
									mcpTool?.mcpServerName,
									{ preapproved: false, unvalidatedToolParams: toolParams },
									isLocalModel, // enforce local-model tool curation on synthesized calls too (else a local model can run a non-curated tool it can't recover from)
									chatMode, // dispatch-level mode enforcement (read-only modes block writes/terminal even for synthesized calls)
									isCapableLocalModelFlag, // a capable local model (>=7B, coder or general) is allowed the web tools at the chokepoint too
								)

								if (interrupted) {
									this._setStreamState(threadId, undefined)
									return
								}
								if (hwCompletion) {
									this._setStreamState(threadId, { isRunning: undefined })
									return
								}
								if (awaitingUserApproval) {
									isRunningWhenEnd = 'awaiting_user'
								} else {
									shouldSendAnotherMessage = true
								}

								this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
								// Tool result is already in thread via _runToolCall, so we'll send another message
								break // Exit inner retry loop, continue outer loop with tool results
							}
						}
					}
				}

				// Add assistant message (only if not already added during streaming or tool synthesis)
				// Check if message was already added to avoid duplication
				// Skip if we synthesized a tool and added a message (to prevent duplicate responses)
				if (!toolSynthesizedAndMessageAdded) {
					const thread = this.state.allThreads[threadId]
					const lastMessage = thread?.messages[thread.messages.length - 1]
					const messageAlreadyAdded = lastMessage?.role === 'assistant' &&
						lastMessage.displayContent === info.fullText

					if (!messageAlreadyAdded) {
						this._addMessageToThread(threadId, { role: 'assistant', displayContent: info.fullText, reasoning: info.fullReasoning, anthropicReasoning: info.anthropicReasoning })
					}
				}

				// PERFORMANCE: Clear stream state immediately to stop showing "running" status
				// This prevents the UI from continuing to show streaming state after completion
				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })

				// CRITICAL: Check if model responded with text but no tool call after executing tools
				// This can happen when model explores codebase but doesn't continue to answer the question
				// For "how many endpoints" type questions, we need to ensure model searches for endpoints
				if (!toolCall && info.fullText.trim() && toolsExecutedInRequest.length > 0 && originalUserMessage) {
					const userRequest = originalUserMessage.displayContent?.toLowerCase() || ''
					// Phase 2: the "how many X" follow-up-search decision is delegated to the pure, tested
					// decision fn (common/toolSynthesisDecision.ts); the synthesis ACTION stays inline below.
					const howManyDecision = decideHowManySearch({
						hasToolCall: !!toolCall,
						fullText: info.fullText,
						hasOriginalUserMessage: true,
						userRequest,
						toolsExecuted: toolsExecutedInRequest,
						hasSynthesizedForRequest: !!hasSynthesizedForRequest,
						filesReadInQuery,
						maxFilesReadPerQuery: MAX_FILES_READ_PER_QUERY,
					})
					if (howManyDecision.needsMoreSearch) {
						const synthesizedToolCall = this._synthesizeToolCallFromIntent(userRequest, originalUserMessage.displayContent || '')
						if (synthesizedToolCall && synthesizedToolCall.toolName === 'search_for_files') {
							const { toolName, toolParams } = synthesizedToolCall
							const toolId = generateUuid()

							// Add assistant message explaining we're continuing the search
							this._addMessageToThread(threadId, {
								role: 'assistant',
								displayContent: `I'll search for files to answer your question.`,
								reasoning: '',
								anthropicReasoning: null
							})

							// Execute the synthesized tool
							const mcpTools = this._mcpService.getMCPTools()
							const mcpTool = mcpTools?.find(t => t.name === toolName as ToolName)
							const { awaitingUserApproval, interrupted, completionSignaled: synthCompletion } = await this._runToolCall(
								threadId,
								toolName as ToolName,
								toolId,
								mcpTool?.mcpServerName,
								{ preapproved: false, unvalidatedToolParams: toolParams },
								isLocalModel, // keep local-model curation consistent across all tool-dispatch paths
								chatMode, // dispatch-level mode enforcement (read-only modes block writes/terminal even for synthesized calls)
								isCapableLocalModelFlag, // a capable local model (>=7B, coder or general) is allowed the web tools at the chokepoint too
							)

							if (interrupted) {
								this._setStreamState(threadId, undefined)
								return
							}

							if (synthCompletion) {
								this._setStreamState(threadId, { isRunning: undefined })
								return
							}

							(toolsExecutedInRequest as string[]).push(toolName)
							hasSynthesizedToolsInThisRequest = true

							if (awaitingUserApproval) {
								isRunningWhenEnd = 'awaiting_user'
							} else {
								shouldSendAnotherMessage = true
							}

							this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
							continue // Continue loop with the new tool result
						}
					}
				}

				// B1 fix: the model emitted structured tool-call markup (<tool_call/<function_calls/<invoke)
				// that could not be parsed AND no real/synthesized tool ran. That is an ATTEMPTED tool call that
				// failed - an agent error, NOT a finished answer. Without this, the loop would commit the
				// malformed text as the assistant's final reply and exit as if done (the silent-no-op-success
				// bug). Count it toward the SAME consecutive-tool-error cap and re-prompt so the model can
				// self-correct (the file-read-limit path below uses the same assistant-note + re-prompt shape);
				// at the cap, escalate or stop honestly. Gated on the structured markers only (a correctly
				// formed call would have parsed) so a genuine prose answer is never misclassified.
				if (attemptedMalformedToolCall && !toolCall && (chatMode === 'agent' || chatMode === 'plan')) {
					consecutiveToolErrors += 1
					if (consecutiveToolErrors >= maxConsecutiveToolErrors) {
						if (await tryEscalateModel(`the previous model emitted ${consecutiveToolErrors} unparseable tool calls in a row`)) {
							// Match the iter-cap escalation: the fresh model gets a clean budget -- reset BOTH loop
							// counters (previously only consecutiveToolErrors reset, so the new model inherited a spent
							// iteration budget and could hit the iteration cap before finishing).
							const reset = computePostEscalationCounters('toolErrorCap')
							nMessagesSent = reset.nMessagesSent
							consecutiveToolErrors = reset.consecutiveToolErrors
							this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
							continue
						}
						this._addMessageToThread(threadId, { role: 'assistant', displayContent: `Stopped after ${consecutiveToolErrors} unparseable tool calls in a row.${isLocalModel ? ' Small/local models can struggle with the tool-call format - try Ask/Normal mode for a direct answer, or a larger model.' : ''}`, reasoning: '', anthropicReasoning: null })
						this._setStreamState(threadId, { isRunning: undefined })
						this._addUserCheckpoint({ threadId })
						return
					}
					// Corrective feedback as a USER turn (NOT assistant): the malformed text was just committed
					// as the assistant message, so a user turn keeps strict user/assistant alternation intact
					// (Anthropic/Gemini) - the same reason tryEscalateModel avoids injecting assistant messages.
					const malformedNote = `Your previous tool call was malformed and could not be parsed. Re-emit it as a single valid tool call.`
					this._addMessageToThread(threadId, { role: 'user', content: malformedNote, displayContent: malformedNote, selections: null, state: defaultMessageState })
					this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
					shouldSendAnotherMessage = true
					continue
				}

				// The agent loop terminates naturally when no tool call is present.
				// Explicit completion is signalled via attempt_completion.
				// *** REMOVED: fragile "3 tools executed = done" heuristic that was killing agents mid-task ***
				// call tool if there is one
				if (toolCall) {
					// Excessive-file-read guard (pure decision; chatThreadService.ts:4716-4753). The caller
					// keeps every side effect + assigns the next counter values back.
					const fileReadGate = decideFileReadGate({
						hasToolCall: true,
						toolName: toolCall.name,
						fileReadLimitExceeded,
						filesReadInQuery,
						maxFilesReadPerQuery: MAX_FILES_READ_PER_QUERY,
					})

					// Skip tool execution if file read limit was exceeded in a previous iteration
					if (fileReadGate.action === 'skip_already_exceeded') {
						// Don't execute any more tools - just continue to final LLM call
						shouldSendAnotherMessage = true
						continue
					}

					// Too many files read - likely stuck in a loop. Add a message explaining the limit, set the
					// flag, then make one final LLM call to generate an answer based on what we've read.
					if (fileReadGate.action === 'hit_limit_now') {
						this._addMessageToThread(threadId, {
							role: 'assistant',
							displayContent: `I've read ${fileReadGate.filesReadCount} files, which is the limit. I'll provide an answer based on what I've gathered so far.`,
							reasoning: '',
							anthropicReasoning: null
						})

						// Set flag to prevent further tool calls
						fileReadLimitExceeded = fileReadGate.nextFileReadLimitExceeded

						// Set state to 'LLM' to show we're generating the final answer
						this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: 'Generating final answer based on files read...', reasoningSoFar: '', toolCallSoFar: null }, interrupt: Promise.resolve(() => { }) })

						// Force one more LLM call to generate the final answer before returning
						shouldSendAnotherMessage = true
						continue
					}

					// proceed: only increments filesReadInQuery on an actual read_file (non-read tools untouched)
					filesReadInQuery = fileReadGate.nextFilesReadInQuery

					// CRITICAL: Check for pending plan before executing tool (fast check)
					if (checkPlanGenerated()) {
						this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
						return
					}

					// PERFORMANCE: Use cached step from activePlanTracking, don't lookup every time
					if (activePlanTracking?.currentStep) {
						this._linkToolCallToStepInternal(threadId, toolCall.id, activePlanTracking.currentStep)
					}

					const mcpTools = this._mcpService.getMCPTools()
					const mcpTool = mcpTools?.find(t => t.name === toolCall.name)

					const { awaitingUserApproval, interrupted, completionSignaled } = await this._runToolCall(threadId, toolCall.name, toolCall.id, mcpTool?.mcpServerName, { preapproved: false, unvalidatedToolParams: toolCall.rawParams }, isLocalModel, chatMode, isCapableLocalModelFlag)

					const toolCompletion = classifyCompletionState({
						toolCall: { name: toolCall.name },
						completionSignaled,
						interrupted,
						awaitingUserApproval,
						fileReadLimitExceeded: false,
						readFileLimitReached: false,
						synthFired: false,
						synthCompletionSignaled: false,
						synthInterrupted: false,
					})
					if (toolCompletion.action === 'terminate_interrupted') {
						this._setStreamState(threadId, undefined)
						if (activePlanTracking?.currentStep) {
							const updatedStep = this._markStepCompletedInternal(threadId, activePlanTracking.currentStep, false, 'Interrupted by user')
							if (updatedStep) {
								activePlanTracking.currentStep = updatedStep
								activePlanTracking.planInfo = { plan: updatedStep.plan, planIdx: updatedStep.planIdx }
							} else {
								refreshPlanStep()
							}
						}
						return
					}

					if (toolCompletion.action === 'terminate_completion') {
						this._setStreamState(threadId, { isRunning: undefined })
						return
					}

					toolsExecutedInRequest.push(toolCall.name)

					// Stop early if a (weak) model keeps emitting failed tool calls, rather than thrashing up to
					// the iteration cap. Count consecutive tool errors; reset on any success.
					// Phase 2: delegate the consecutive-tool-error counting + cap check to the pure, tested
					// decision fn (common/agentLoopDecisions.ts). escalationAvailable:false keeps
					// consecutiveToolErrors holding the incremented value, so the escalate-reason and halt
					// messages below interpolate the identical count; tryEscalateModel stays authoritative.
					const lastToolMsg = this.state.allThreads[threadId]?.messages.slice(-1)[0]
					const lastToolMessageType: ToolMessageType | null = lastToolMsg?.role === 'tool'
						? (lastToolMsg as ToolMessage<ToolName>).type
						: null
					const loopLastType = (lastToolMessageType === 'success' || lastToolMessageType === 'tool_error' || lastToolMessageType === 'invalid_params')
						? lastToolMessageType
						: null
					const toolErrEscDec = shouldEscalateModel({
						triggerSite: 'toolErrorCap',
						modelFallbackEnabled, escalationCount, MAX_MODEL_ESCALATIONS,
						nMessagesSent, maxAgentIterations,
						consecutiveToolErrors, maxConsecutiveToolErrors,
						isAutoMode: false, autoFallbackExhausted: true,
						isRateLimitError: false, isNonRetryableError: false,
						nAttempts: 0, CHAT_RETRIES,
					})
					const postToolDec = decideLoopContinuation({
						nMessagesSent,
						maxAgentIterations,
						consecutiveToolErrors,
						maxConsecutiveToolErrors,
						lastToolMessageType: loopLastType,
						toolCallDispatched: true,
						awaitingUserApproval,
						canEscalate: toolErrEscDec.shouldCallEscalate,
					})
					const toolErrorCountForMessage = postToolDec.action === 'escalate-tool-errors'
						? maxConsecutiveToolErrors
						: postToolDec.nextConsecutiveToolErrors
					consecutiveToolErrors = postToolDec.nextConsecutiveToolErrors
					if (postToolDec.action === 'escalate-tool-errors') {
						if (await tryEscalateModel(`the previous model failed ${toolErrorCountForMessage} tool calls in a row`)) {
							const reset = computePostEscalationCounters('toolErrorCap')
							nMessagesSent = reset.nMessagesSent
							consecutiveToolErrors = reset.consecutiveToolErrors
							this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
							continue
						}
					}
					if (postToolDec.action === 'hard-stop-tool-errors' || postToolDec.action === 'escalate-tool-errors') {
						this._addMessageToThread(threadId, { role: 'assistant', displayContent: `Stopped after ${toolErrorCountForMessage} failed tool calls in a row.${isLocalModel ? ' Small/local models can struggle with multi-step tool use — try Ask/Normal mode for a direct answer, or use a larger model.' : ''}`, reasoning: '', anthropicReasoning: null })
						this._setStreamState(threadId, { isRunning: undefined })
						this._addUserCheckpoint({ threadId })
						return
					}

					// Only update plan step status if we have an active plan (skip if no plan)
					if (activePlanTracking?.currentStep) {
						const thread = this.state.allThreads[threadId]
						if (thread) {
							const lastMsg = thread.messages[thread.messages.length - 1]
							if (lastMsg && lastMsg.role === 'tool') {
								const toolMsg = lastMsg as ToolMessage<ToolName>
								// Shared, tested classification (same fn the pre-loop callThisToolFirst path uses).
								const stepOutcome = classifyToolStepOutcome(toolMsg.type)
								if (stepOutcome === 'failed') {
									// PERFORMANCE: Use returned step info instead of re-looking up
									const updatedStep = this._markStepCompletedInternal(threadId, activePlanTracking.currentStep, false, (toolMsg.type === 'tool_error' && toolMsg.result) || 'Tool execution failed')
									if (updatedStep) {
										activePlanTracking.currentStep = updatedStep
									} else {
										refreshPlanStep()
									}
								} else if (stepOutcome === 'succeeded') {
									// PERFORMANCE: Use returned step info instead of re-looking up
									const updatedStep = this._markStepCompletedInternal(threadId, activePlanTracking.currentStep, true)
									if (updatedStep) {
										activePlanTracking.currentStep = updatedStep
										// Update planInfo to match updated plan
										activePlanTracking.planInfo = { plan: updatedStep.plan, planIdx: updatedStep.planIdx }

										// Start next step if available - use returned value
										const startedStep = this._startNextStep(threadId)
										if (startedStep) {
											activePlanTracking.planInfo = { plan: startedStep.plan, planIdx: startedStep.planIdx }
											activePlanTracking.currentStep = {
												plan: startedStep.plan,
												planIdx: startedStep.planIdx,
												step: startedStep.step,
												stepIdx: startedStep.stepIdx
											}
										} else {
											// No more steps - refresh to get final state
											refreshPlanStep()
										}
									} else {
										// Fallback if update failed
										refreshPlanStep()
										if (activePlanTracking.currentStep && activePlanTracking.currentStep.step.status === 'queued') {
											const startedStep = this._startNextStep(threadId)
											if (startedStep) {
												activePlanTracking.planInfo = { plan: startedStep.plan, planIdx: startedStep.planIdx }
												activePlanTracking.currentStep = {
													plan: startedStep.plan,
													planIdx: startedStep.planIdx,
													step: startedStep.step,
													stepIdx: startedStep.stepIdx
												}
											} else {
												refreshPlanStep()
											}
										}
									}
								}
							}
						}
					}

					if (postToolDec.action === 'await-user') { isRunningWhenEnd = postToolDec.isRunningWhenEnd ?? 'awaiting_user' }
					else if (postToolDec.action === 'continue') { shouldSendAnotherMessage = true }

					this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' }) // just decorative, for clarity
				}

			} // end while (attempts)
		} // end while (send message)

		// if awaiting user approval, keep isRunning true, else end isRunning
		// Use undefined instead of 'idle' to properly clear the state and hide the stop button
		this._setStreamState(threadId, { isRunning: isRunningWhenEnd || undefined })

		// add checkpoint before the next user message
		if (!isRunningWhenEnd) {
			// PERFORMANCE: Only check plan completion if we were tracking a plan
			if (activePlanTracking) {
				// CRITICAL: Refresh plan to get latest step states before checking completion
				this._planCache.delete(threadId)
				const refreshedPlanInfo = this._getCurrentPlan(threadId, true)
				if (refreshedPlanInfo) {
					const allStepsComplete = refreshedPlanInfo.plan.steps.every(s =>
						s.disabled || s.status === 'succeeded' || s.status === 'failed' || s.status === 'skipped'
					)
					if (allStepsComplete && refreshedPlanInfo.plan.approvalState === 'executing') {
						// Mark plan as completed
						const updatedPlan: PlanMessage = {
							...refreshedPlanInfo.plan,
							approvalState: 'completed'
						}
						this._editMessageInThread(threadId, refreshedPlanInfo.planIdx, updatedPlan)
						// Invalidate cache after update
						this._planCache.delete(threadId)
						// Generate ReviewMessage with summary (use refreshed plan with latest data)
						this._generateReviewMessage(threadId, updatedPlan)
					}
				}
			}
			this._addUserCheckpoint({ threadId })
		}

		// capture number of messages sent
		this._metricsService.capture('Agent Loop Done', { nMessagesSent, chatMode })

		// R3: fire any agent-stop lifecycle hooks (fire-and-forget; no-op unless enabled + configured).
		this._hooksService.runHooksForEvent({ event: 'agent-stop', threadId, reason: 'loop_done' })
	}


	// Checkpoint storage limits
	private static readonly MAX_CHECKPOINTS_PER_THREAD = 50;
	private static readonly MAX_TOTAL_CHECKPOINT_SIZE_MB = 100;
	private static readonly BYTES_PER_MB = 1024 * 1024;

	private _addCheckpoint(threadId: string, checkpoint: CheckpointEntry) {
		const thread = this.state.allThreads[threadId];
		if (!thread) return;

		// Count existing checkpoints in this thread
		const existingCheckpoints = thread.messages.filter(m => m.role === 'checkpoint');

		// Estimate checkpoint size (rough approximation)
		const checkpointSize = this._estimateCheckpointSize(checkpoint);
		const totalSizeMB = this._getTotalCheckpointSizeMB();

		// Enforce per-thread limit
		if (existingCheckpoints.length >= ChatThreadService.MAX_CHECKPOINTS_PER_THREAD) {
			// Evict oldest checkpoint in this thread (LRU)
			const oldestCheckpointIdx = thread.messages.findIndex(m => m.role === 'checkpoint');
			if (oldestCheckpointIdx >= 0) {
				// Remove oldest checkpoint
				const newMessages = [...thread.messages];
				newMessages.splice(oldestCheckpointIdx, 1);
				this._setState({
					allThreads: {
						...this.state.allThreads,
						[threadId]: {
							...thread,
							messages: newMessages,
						},
					},
				});
				this._storeAllThreads(this.state.allThreads);
			}
		}

		// Enforce global size limit
		if (totalSizeMB + checkpointSize / ChatThreadService.BYTES_PER_MB > ChatThreadService.MAX_TOTAL_CHECKPOINT_SIZE_MB) {
			// Evict oldest checkpoints across all threads (LRU)
			this._evictOldestCheckpoints(checkpointSize / ChatThreadService.BYTES_PER_MB);
		}

		this._addMessageToThread(threadId, checkpoint);
	}

	private _estimateCheckpointSize(checkpoint: CheckpointEntry): number {
		// Rough size estimation: JSON string length
		try {
			return JSON.stringify(checkpoint).length;
		} catch {
			return 1000; // Fallback estimate
		}
	}

	private _getTotalCheckpointSizeMB(): number {
		let totalBytes = 0;
		for (const thread of Object.values(this.state.allThreads)) {
			if (!thread) continue;
			for (const msg of thread.messages) {
				if (msg.role === 'checkpoint') {
					totalBytes += this._estimateCheckpointSize(msg as CheckpointEntry);
				}
			}
		}
		return totalBytes / ChatThreadService.BYTES_PER_MB;
	}

	private _evictOldestCheckpoints(neededMB: number): void {
		// Collect all checkpoints with their thread and index
		const checkpointList: Array<{ threadId: string; index: number; checkpoint: CheckpointEntry; size: number }> = [];

		for (const [threadId, thread] of Object.entries(this.state.allThreads)) {
			if (!thread) continue;
			for (let i = 0; i < thread.messages.length; i++) {
				const msg = thread.messages[i];
				if (msg.role === 'checkpoint') {
					const checkpoint = msg as CheckpointEntry;
					checkpointList.push({
						threadId,
						index: i,
						checkpoint,
						size: this._estimateCheckpointSize(checkpoint),
					});
				}
			}
		}

		// Sort by index (older = lower index, earlier in thread)
		checkpointList.sort((a, b) => a.index - b.index);

		// Evict oldest until we have enough space
		let freedMB = 0;
		const toEvict = new Map<string, Set<number>>(); // threadId -> Set<indices>

		for (const item of checkpointList) {
			if (freedMB >= neededMB) break;

			if (!toEvict.has(item.threadId)) {
				toEvict.set(item.threadId, new Set());
			}
			toEvict.get(item.threadId)!.add(item.index);
			freedMB += item.size / ChatThreadService.BYTES_PER_MB;
		}

		// Remove evicted checkpoints
		const newThreads = { ...this.state.allThreads };
		for (const [threadId, indices] of toEvict.entries()) {
			const thread = newThreads[threadId];
			if (!thread) continue;

			// Remove in reverse order to preserve indices
			const sortedIndices = Array.from(indices).sort((a, b) => b - a);
			let newMessages = [...thread.messages];
			for (const idx of sortedIndices) {
				newMessages.splice(idx, 1);
			}

			newThreads[threadId] = {
				...thread,
				messages: newMessages,
			};
		}

		this._setState({ allThreads: newThreads });
		this._storeAllThreads(newThreads);
	}

	private _generateReviewMessage(threadId: string, plan: PlanMessage): void {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		const succeededSteps = plan.steps.filter(s => s.status === 'succeeded')
		const failedSteps = plan.steps.filter(s => s.status === 'failed')
		const skippedSteps = plan.steps.filter(s => s.status === 'skipped' || s.disabled)
		const completed = failedSteps.length === 0

		const executionTime = plan.executionStartTime ? Date.now() - plan.executionStartTime : undefined
		const stepsCompleted = succeededSteps.length
		const stepsTotal = plan.steps.length

		// Collect files changed from checkpoints
		const filesChanged: Array<{ path: string; changeType: 'created' | 'modified' | 'deleted' }> = []
		const fileSet = new Set<string>()

		// Check all checkpoints created during plan execution
		const planIdx = findLastIdx(thread.messages, (m: ChatMessage) => m.role === 'plan' && (m as PlanMessage).summary === plan.summary)
		if (planIdx >= 0) {
			// Find checkpoints after plan message
			for (let i = planIdx + 1; i < thread.messages.length; i++) {
				const msg = thread.messages[i]
				if (msg.role === 'checkpoint') {
					const checkpoint = msg as CheckpointEntry
					for (const fsPath in checkpoint.voidFileSnapshotOfURI) {
						if (!fileSet.has(fsPath)) {
							fileSet.add(fsPath)
							// For now, mark as modified (could enhance to detect created/deleted by comparing with initial state)
							filesChanged.push({
								path: fsPath,
								changeType: 'modified'
							})
						}
					}
				}
			}
		}

		// Collect issues from failed steps
		const issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; file?: string }> = []
		for (const step of failedSteps) {
			issues.push({
				severity: 'error',
				message: step.error || `Step ${step.stepNumber} failed: ${step.description}`,
				file: step.files?.[0]
			})
		}

		// Generate summary
		let summary = completed
			? `Successfully completed all ${stepsCompleted} step${stepsCompleted !== 1 ? 's' : ''} of the plan: ${plan.summary}`
			: `Completed ${stepsCompleted} of ${stepsTotal} steps. ${failedSteps.length} step${failedSteps.length !== 1 ? 's' : ''} failed.`

		if (skippedSteps.length > 0) {
			summary += ` ${skippedSteps.length} step${skippedSteps.length !== 1 ? 's were' : ' was'} skipped.`
		}

		// Find last checkpoint index
		const lastCheckpointIdx = findLastIdx(thread.messages, (m: ChatMessage) => m.role === 'checkpoint')

		const reviewMessage: ReviewMessage = {
			role: 'review',
			type: 'agent_review',
			completed,
			summary,
			issues,
			filesChanged: filesChanged.length > 0 ? filesChanged : undefined,
			executionTime,
			stepsCompleted,
			stepsTotal,
			checkpointCount: lastCheckpointIdx >= 0 ? lastCheckpointIdx - (planIdx >= 0 ? planIdx : 0) : 0,
			lastCheckpointIdx: lastCheckpointIdx >= 0 ? lastCheckpointIdx : null,
			nextSteps: failedSteps.length > 0 ? [
				'Review failed steps and retry if needed',
				'Check error messages for details',
				failedSteps.length === 1 ? 'Consider skipping the failed step if it\'s not critical' : ''
			].filter(Boolean) : [
				'Review the changes made',
				'Test the implementation',
				'Continue with additional improvements if needed'
			]
		}

		this._addMessageToThread(threadId, reviewMessage)
	}



	private _editMessageInThread(threadId: string, messageIdx: number, newMessage: ChatMessage,) {
		const { allThreads } = this.state
		const oldThread = allThreads[threadId]
		if (!oldThread) return // should never happen
		// update state and store it
		const newThreads = {
			...allThreads,
			[oldThread.id]: {
				...oldThread,
				lastModified: new Date().toISOString(),
				messages: [
					...oldThread.messages.slice(0, messageIdx),
					newMessage,
					...oldThread.messages.slice(messageIdx + 1, Infinity),
				],
			}
		}
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads }) // the current thread just changed (it had a message added to it)
		// Invalidate plan cache when plan messages are edited
		if (newMessage.role === 'plan') {
			this._planCache.delete(threadId)
		}
	}


	private _getCheckpointInfo = (checkpointMessage: ChatMessage & { role: 'checkpoint' }, fsPath: string, opts: { includeUserModifiedChanges: boolean }) => {
		const voidFileSnapshot = checkpointMessage.voidFileSnapshotOfURI ? checkpointMessage.voidFileSnapshotOfURI[fsPath] ?? null : null
		if (!opts.includeUserModifiedChanges) { return { voidFileSnapshot, } }

		const userModifiedCortexideFileSnapshot = fsPath in checkpointMessage.userModifications.voidFileSnapshotOfURI ? checkpointMessage.userModifications.voidFileSnapshotOfURI[fsPath] ?? null : null
		return { voidFileSnapshot: userModifiedCortexideFileSnapshot ?? voidFileSnapshot, }
	}

	private _computeNewCheckpointInfo({ threadId }: { threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		const lastCheckpointIdx = findLastIdx(thread.messages, (m) => m.role === 'checkpoint') ?? -1
		if (lastCheckpointIdx === -1) return

		const voidFileSnapshotOfURI: { [fsPath: string]: CortexideFileSnapshot | undefined } = {}

		// add a change for all the URIs in the checkpoint history
		const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: 0, hiIdx: lastCheckpointIdx, }) ?? {}
		for (const fsPath in lastIdxOfURI ?? {}) {
			const { model } = this._cortexideModelService.getModelFromFsPath(fsPath)
			if (!model) continue
			const checkpoint2 = thread.messages[lastIdxOfURI[fsPath]] || null
			if (!checkpoint2) continue
			if (checkpoint2.role !== 'checkpoint') continue
			const res = this._getCheckpointInfo(checkpoint2, fsPath, { includeUserModifiedChanges: false })
			if (!res) continue
			const { voidFileSnapshot: oldCortexideFileSnapshot } = res

			// if there was any change to the str or diffAreaSnapshot, update. rough approximation of equality, oldDiffAreasSnapshot === diffAreasSnapshot is not perfect
			const voidFileSnapshot = this._editCodeService.getCortexideFileSnapshot(URI.file(fsPath))
			if (oldCortexideFileSnapshot === voidFileSnapshot) continue
			voidFileSnapshotOfURI[fsPath] = voidFileSnapshot
		}

		return { voidFileSnapshotOfURI }
	}


	/**
	 * If every configured free-tier provider is currently exhausted, replace a
	 * raw provider error with an actionable "all free quotas exhausted" message
	 * (offer local / BYO). Otherwise return the original error unchanged.
	 */
	private _exhaustionAwareError(error?: { message: string; fullError: Error | null }): { message: string; fullError: Error | null } | undefined {
		try {
			const exhaustion = this._modelRouter.getFreeTierExhaustion()
			if (exhaustion.allExhausted) {
				return { message: exhaustion.message, fullError: error?.fullError ?? null }
			}
		} catch (err) {
			console.error('[ChatThreadService] getFreeTierExhaustion failed', err)
		}
		return error
	}

	private _addUserCheckpoint({ threadId }: { threadId: string }) {
		const { voidFileSnapshotOfURI } = this._computeNewCheckpointInfo({ threadId }) ?? {}
		this._addCheckpoint(threadId, {
			role: 'checkpoint',
			type: 'user_edit',
			voidFileSnapshotOfURI: voidFileSnapshotOfURI ?? {},
			userModifications: { voidFileSnapshotOfURI: {}, },
		})
	}
	// call this right after LLM edits a file
	private _addToolEditCheckpoint({ threadId, uri, }: { threadId: string, uri: URI }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const { model } = this._cortexideModelService.getModel(uri)
		if (!model) return // should never happen
		const diffAreasSnapshot = this._editCodeService.getCortexideFileSnapshot(uri)
		this._addCheckpoint(threadId, {
			role: 'checkpoint',
			type: 'tool_edit',
			voidFileSnapshotOfURI: { [uri.fsPath]: diffAreasSnapshot },
			userModifications: { voidFileSnapshotOfURI: {} },
		})
	}


	private _getCheckpointBeforeMessage = ({ threadId, messageIdx }: { threadId: string, messageIdx: number }): [CheckpointEntry, number] | undefined => {
		const thread = this.state.allThreads[threadId]
		if (!thread) return undefined
		for (let i = messageIdx; i >= 0; i--) {
			const message = thread.messages[i]
			if (message.role === 'checkpoint') {
				return [message, i]
			}
		}
		return undefined
	}

	private _getCheckpointsBetween({ threadId, loIdx, hiIdx }: { threadId: string, loIdx: number, hiIdx: number }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return { lastIdxOfURI: {} } // should never happen
		const lastIdxOfURI: { [fsPath: string]: number } = {}
		for (let i = loIdx; i <= hiIdx; i += 1) {
			const message = thread.messages[i]
			if (message?.role !== 'checkpoint') continue
			for (const fsPath in message.voidFileSnapshotOfURI) { // do not include userModified.beforeStrOfURI here, jumping should not include those changes
				lastIdxOfURI[fsPath] = i
			}
		}
		return { lastIdxOfURI }
	}

	private _readCurrentCheckpoint(threadId: string): [CheckpointEntry, number] | undefined {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		const { currCheckpointIdx } = thread.state
		if (currCheckpointIdx === null) return

		const checkpoint = thread.messages[currCheckpointIdx]
		if (!checkpoint) return
		if (checkpoint.role !== 'checkpoint') return
		return [checkpoint, currCheckpointIdx]
	}
	private _addUserModificationsToCurrCheckpoint({ threadId }: { threadId: string }) {
		const { voidFileSnapshotOfURI } = this._computeNewCheckpointInfo({ threadId }) ?? {}
		const res = this._readCurrentCheckpoint(threadId)
		if (!res) return
		const [checkpoint, checkpointIdx] = res
		this._editMessageInThread(threadId, checkpointIdx, {
			...checkpoint,
			userModifications: { voidFileSnapshotOfURI: voidFileSnapshotOfURI ?? {}, },
		})
	}


	private _makeUsStandOnCheckpoint({ threadId }: { threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		if (thread.state.currCheckpointIdx === null) {
			const lastMsg = thread.messages[thread.messages.length - 1]
			if (lastMsg?.role !== 'checkpoint')
				this._addUserCheckpoint({ threadId })
			this._setThreadState(threadId, { currCheckpointIdx: thread.messages.length - 1 })
		}
	}

	jumpToCheckpointBeforeMessageIdx({ threadId, messageIdx, jumpToUserModified }: { threadId: string, messageIdx: number, jumpToUserModified: boolean }) {

		// if null, add a new temp checkpoint so user can jump forward again
		this._makeUsStandOnCheckpoint({ threadId })

		const thread = this.state.allThreads[threadId]
		if (!thread) return
		if (this.streamState[threadId]?.isRunning) return

		const c = this._getCheckpointBeforeMessage({ threadId, messageIdx })
		if (c === undefined) return // should never happen

		const fromIdx = thread.state.currCheckpointIdx
		if (fromIdx === null) return // should never happen

		const [_, toIdx] = c
		if (toIdx === fromIdx) return

		// console.log(`going from ${fromIdx} to ${toIdx}`)

		// update the user's checkpoint
		this._addUserModificationsToCurrCheckpoint({ threadId })

		/*
if undoing

A,B,C are all files.
x means a checkpoint where the file changed.

A B C D E F G H I
  x x x x x   x           <-- you can't always go up to find the "before" version; sometimes you need to go down
  | | | | |   | x
--x-|-|-|-x---x-|-----     <-- to
	| | | | x   x
	| | x x |
	| |   | |
----x-|---x-x-------     <-- from
	  x

We need to revert anything that happened between to+1 and from.
**We do this by finding the last x from 0...`to` for each file and applying those contents.**
We only need to do it for files that were edited since `to`, ie files between to+1...from.
*/
		if (toIdx < fromIdx) {
			const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: toIdx + 1, hiIdx: fromIdx })

			const idxes = function* () {
				for (let k = toIdx; k >= 0; k -= 1) { // first go up
					yield k
				}
				for (let k = toIdx + 1; k < thread.messages.length; k += 1) { // then go down
					yield k
				}
			}

			for (const fsPath in lastIdxOfURI) {
				// find the first instance of this file starting at toIdx (go up to latest file; if there is none, go down)
				for (const k of idxes()) {
					const message = thread.messages[k]
					if (message.role !== 'checkpoint') continue
					const res = this._getCheckpointInfo(message, fsPath, { includeUserModifiedChanges: jumpToUserModified })
					if (!res) continue
					const { voidFileSnapshot } = res
					if (!voidFileSnapshot) continue
					this._editCodeService.restoreCortexideFileSnapshot(URI.file(fsPath), voidFileSnapshot)
					break
				}
			}
			// Phase 1 #2: durable disk-level rollback of create/delete ops after the target checkpoint
			// (the in-memory restore above only handles edited files that still have a live model).
			this._restoreFileOpsForJump(threadId, toIdx).catch(err => console.error('[ChatThreadService] file-op rollback failed', err))
		}

		/*
if redoing

A B C D E F G H I J
  x x x x x   x     x
  | | | | |   | x x x
--x-|-|-|-x---x-|-|---     <-- from
	| | | | x   x
	| | x x |
	| |   | |
----x-|---x-x-----|---     <-- to
	  x           x


We need to apply latest change for anything that happened between from+1 and to.
We only need to do it for files that were edited since `from`, ie files between from+1...to.
*/
		if (toIdx > fromIdx) {
			const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: fromIdx + 1, hiIdx: toIdx })
			for (const fsPath in lastIdxOfURI) {
				// apply lowest down content for each uri
				for (let k = toIdx; k >= fromIdx + 1; k -= 1) {
					const message = thread.messages[k]
					if (message.role !== 'checkpoint') continue
					const res = this._getCheckpointInfo(message, fsPath, { includeUserModifiedChanges: jumpToUserModified })
					if (!res) continue
					const { voidFileSnapshot } = res
					if (!voidFileSnapshot) continue
					this._editCodeService.restoreCortexideFileSnapshot(URI.file(fsPath), voidFileSnapshot)
					break
				}
			}
		}

		this._setThreadState(threadId, { currCheckpointIdx: toIdx })
	}


	private _wrapRunAgentToNotify(p: Promise<void>, threadId: string) {
		const notify = ({ error }: { error: string | null }) => {
			const thread = this.state.allThreads[threadId]
			if (!thread) return
			const userMsg = findLast(thread.messages, m => m.role === 'user')
			if (!userMsg) return
			if (userMsg.role !== 'user') return
			const messageContent = truncate(userMsg.displayContent, 50, '...')

			this._notificationService.notify({
				severity: error ? Severity.Warning : Severity.Info,
				message: error ? `Error: ${error} ` : `A new Chat result is ready.`,
				source: messageContent,
				sticky: true,
				actions: {
					primary: [{
						id: 'void.goToChat',
						enabled: true,
						label: `Jump to Chat`,
						tooltip: '',
						class: undefined,
						run: () => {
							this.switchToThread(threadId)
							// scroll to bottom
							this.state.allThreads[threadId]?.state.mountedInfo?.whenMounted.then(m => {
								m.scrollToBottom()
							})
						}
					}]
				},
			})
		}

		p.then(() => {
			if (threadId !== this.state.currentThreadId) notify({ error: null })
		}).catch((e) => {
			if (threadId !== this.state.currentThreadId) notify({ error: getErrorMessage(e) })
			throw e
		})
	}

	dismissStreamError(threadId: string): void {
		this._setStreamState(threadId, undefined)
	}


	private async _addUserMessageAndStreamResponse({ userMessage, _chatSelections, threadId, images, pdfs, noPlan, displayContent }: { userMessage: string, _chatSelections?: StagingSelectionItem[], threadId: string, images?: ChatImageAttachment[], pdfs?: ChatPDFAttachment[], noPlan?: boolean, displayContent?: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		// interrupt existing stream
		if (this.streamState[threadId]?.isRunning) {
			await this.abortRunning(threadId)
		}

		// add dummy before this message to keep checkpoint before user message idea consistent
		if (thread.messages.length === 0) {
			this._addUserCheckpoint({ threadId })
		}


		// Optionally suppress plan generation for this message
		if (noPlan) {
			this._suppressPlanOnceByThread[threadId] = true
		}

		// add user's message to chat history
		const instructions = userMessage
		const currSelns: StagingSelectionItem[] = _chatSelections ?? thread.state.stagingSelections

		let userMessageContent = await chat_userMessageContent(instructions, currSelns, { directoryStrService: this._directoryStringService, fileService: this._fileService }) // user message + names of files (NOT content)

		// Append PDF extracted text to message content for context
		if (pdfs && pdfs.length > 0) {
			const pdfTexts: string[] = [];
			for (const pdf of pdfs) {
				if (pdf.extractedText && pdf.extractedText.trim().length > 0) {
					// Only include selected pages if specified
					let textToInclude = pdf.extractedText;
					if (pdf.selectedPages && pdf.selectedPages.length > 0 && pdf.pageCount) {
						// Filter text by selected pages
						const pageTexts = pdf.extractedText.split(/\n\n\[Page \d+\]\n/);
						const selectedTexts: string[] = [];
						for (const pageNum of pdf.selectedPages) {
							const pageIndex = pageNum - 1; // Convert to 0-based index
							if (pageIndex >= 0 && pageIndex < pageTexts.length) {
								selectedTexts.push(`[Page ${pageNum}]\n${pageTexts[pageIndex]}`);
							}
						}
						if (selectedTexts.length > 0) {
							textToInclude = selectedTexts.join('\n\n');
						}
					}
					const pageInfo = pdf.pageCount ? ` (${pdf.pageCount} page${pdf.pageCount !== 1 ? 's' : ''})` : '';
					pdfTexts.push(`\n\n[PDF: ${pdf.filename}${pageInfo}]\n${textToInclude}`);
				} else {
					console.warn(`PDF ${pdf.filename} has no extracted text - it may not have been processed correctly`);
				}
			}
			if (pdfTexts.length > 0) {
				userMessageContent += '\n\n' + pdfTexts.join('\n\n');
			} else {
				console.warn('PDFs were attached but no extracted text was available to send to the model');
			}
		}

		const userHistoryElt: ChatMessage = { role: 'user', content: userMessageContent, displayContent: displayContent || instructions, selections: currSelns, images, pdfs, state: defaultMessageState }
		this._addMessageToThread(threadId, userHistoryElt)

		this._setThreadState(threadId, { currCheckpointIdx: null }) // no longer at a checkpoint because started streaming

		// Set early preparing state to give immediate feedback
		let preparationCancelled = false
		const preparationInterruptor = Promise.resolve(() => { preparationCancelled = true })
		this._setStreamState(threadId, {
			isRunning: 'preparing',
			llmInfo: {
				displayContentSoFar: 'Preparing request...',
				reasoningSoFar: '',
				toolCallSoFar: null
			},
			interrupt: preparationInterruptor
		})

		// Check if user selected "Auto" mode
		const userModelSelection = this._currentModelSelectionProps().modelSelection
		const isAutoMode = isAutoModelSelection(userModelSelection)

		// Auto-select model based on task context if in auto mode, otherwise use user's selection
		// Generate requestId early for router tracking in auto mode, then reuse it in _runChatAgent
		const earlyRequestId = isAutoMode ? generateUuid() : undefined
		let modelSelection: ModelSelection | null

		// PERFORMANCE: Start prompt prep in parallel with router decision for auto mode
		// This can save 50-200ms by doing work that doesn't need model selection
		let repoIndexerPromise: Promise<{ results: string[], metrics: any } | null> | undefined
		if (isAutoMode && earlyRequestId) {
			// Update status to show model selection in progress
			if (!preparationCancelled) {
				this._setStreamState(threadId, {
					isRunning: 'preparing',
					llmInfo: {
						displayContentSoFar: 'Selecting best model for this task...',
						reasoningSoFar: '',
						toolCallSoFar: null
					},
					interrupt: preparationInterruptor
				})
			}

			// Track router timing for auto mode
			chatLatencyAudit.startRequest(earlyRequestId, 'auto', 'auto')
			chatLatencyAudit.markRouterStart(earlyRequestId)

			// Start router decision and repo indexer query in parallel
			// PERFORMANCE: Repo indexer query doesn't need model selection - start it early
			const routerPromise = this._autoSelectModel(instructions, images, pdfs)
			const thread = this.state.allThreads[threadId]
			const chatMessages = thread?.messages ?? []
			const { chatMode } = this._settingsService.state.globalSettings

			// Start repo indexer query in parallel (saves 50-200ms)
			repoIndexerPromise = this._convertToLLMMessagesService.startRepoIndexerQuery(chatMessages, chatMode)

			// Wait for router decision
			const autoSelectedModel = await routerPromise
			chatLatencyAudit.markRouterEnd(earlyRequestId)
			modelSelection = autoSelectedModel

			// CRITICAL: If auto selection failed, we need a fallback to prevent null modelSelection
			// This ensures we never send empty messages to the API (which causes "invalid message format" error)
			if (!modelSelection) {
				// Try to get any available model as fallback using shared utility
				const fallbackModel = this._settingsService.resolveAutoModelSelection(null)
				if (fallbackModel) {
					modelSelection = fallbackModel
					this._notificationService.warn('Auto model selection failed. Using fallback model. Please configure your model providers.')
				} else {
					// Last resort: show error and don't proceed
					this._notificationService.error('No models available. Please configure at least one model provider in settings.')
					this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
					return
				}
			}
		} else {
			modelSelection = userModelSelection
		}

		// Final validation: ensure modelSelection is not null before proceeding
		if (!modelSelection) {
			this._notificationService.error('No model selected. Please select a model in settings.')
			this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
			return
		}

		// Validate model capabilities if attachments are present
		// This applies to both auto and manual mode to ensure images are handled correctly
		if ((images && images.length > 0 || pdfs && pdfs.length > 0) && modelSelection && !(modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')) {
			const { getModelCapabilities } = await import('../common/modelCapabilities.js');
			const capabilities = getModelCapabilities(modelSelection.providerName, modelSelection.modelName, this._settingsService.state.overridesOfModel);

			// Check if model is vision-capable using the same logic as modelRouter
			const isVisionCapable = this._isModelVisionCapable(modelSelection, capabilities);

			if (!isVisionCapable) {
				// For PDFs, we can still send them as text (extractedText), so no warning needed
				// For images, we should prevent sending or convert to text description
				if (images && images.length > 0) {
					// In auto mode, this shouldn't happen (router should select vision-capable model)
					// But if it does (e.g., no vision models available), remove images and warn
					if (isAutoMode) {
						this._notificationService.warn(`Auto-selected model (${modelSelection.providerName}/${modelSelection.modelName}) does not support images. Images will not be sent. Please configure a vision-capable model.`);
					} else {
						this._notificationService.warn(`The selected model (${modelSelection.providerName}/${modelSelection.modelName}) does not support images. Images will not be sent to the model.`);
					}
					// Remove images from the message since model can't process them
					images = [];
				}
				// PDFs are sent as extracted text, so they work fine with non-vision models
				// No notification needed - PDFs will be processed correctly via text extraction
			}
		}

		// Check if preparation was cancelled
		if (preparationCancelled) {
			this._setStreamState(threadId, undefined)
			return
		}

		// Update status to show request preparation
		this._setStreamState(threadId, {
			isRunning: 'preparing',
			llmInfo: {
				displayContentSoFar: 'Preparing request...',
				reasoningSoFar: '',
				toolCallSoFar: null
			},
			interrupt: preparationInterruptor
		})

		// Get model options (skip for "auto" since it's not a real model)
		const modelSelectionOptions = modelSelection && !(modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')
			? this._settingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName]
			: undefined

		// repoIndexerPromise is already set above if in auto mode

		// Pass earlyRequestId, isAutoMode, and repoIndexerPromise to _runChatAgent for latency tracking
		this._wrapRunAgentToNotify(
			this._runChatAgent({ threadId, modelSelection, modelSelectionOptions, earlyRequestId, isAutoMode, repoIndexerPromise }),
			threadId,
		)

		// scroll to bottom
		this.state.allThreads[threadId]?.state.mountedInfo?.whenMounted.then(m => {
			m.scrollToBottom()
		})
	}


	async addUserMessageAndStreamResponse({ userMessage, _chatSelections, threadId, images, pdfs, noPlan, displayContent }: { userMessage: string, _chatSelections?: StagingSelectionItem[], threadId: string, images?: ChatImageAttachment[], pdfs?: ChatPDFAttachment[], noPlan?: boolean, displayContent?: string }) {
		const thread = this.state.allThreads[threadId];
		if (!thread) return

		// if there's a current checkpoint, delete all messages after it
		if (thread.state.currCheckpointIdx !== null) {
			const checkpointIdx = thread.state.currCheckpointIdx;
			const newMessages = thread.messages.slice(0, checkpointIdx + 1);

			// Update the thread with truncated messages
			const newThreads = {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					lastModified: new Date().toISOString(),
					messages: newMessages,
				}
			};
			this._storeAllThreads(newThreads);
			this._setState({ allThreads: newThreads });
		}


		// Now call the original method to add the user message and stream the response
		await this._addUserMessageAndStreamResponse({ userMessage, _chatSelections, threadId, images, pdfs, noPlan, displayContent });

		// Safety: ensure stream state is cleared when the stream finishes (unless awaiting user approval)
		const s = this.streamState[threadId]
		if (!s || s.isRunning === undefined || s.isRunning === 'idle' || s.isRunning === 'awaiting_user') {
			return
		}
		// If still running after completion, clear it (stream should have been handled by _addUserMessageAndStreamResponse)
		this._setStreamState(threadId, undefined)

	}

	editUserMessageAndStreamResponse: IChatThreadService['editUserMessageAndStreamResponse'] = async ({ userMessage, messageIdx, threadId }) => {

		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		if (thread.messages?.[messageIdx]?.role !== 'user') {
			throw new Error(`Error: editing a message with role !=='user'`)
		}

		// get prev and curr selections before clearing the message
		const currSelns = thread.messages[messageIdx].state.stagingSelections || [] // staging selections for the edited message

		// clear messages up to the index
		const slicedMessages = thread.messages.slice(0, messageIdx)
		this._setState({
			allThreads: {
				...this.state.allThreads,
				[thread.id]: {
					...thread,
					messages: slicedMessages
				}
			}
		})

		// re-add the message and stream it
		this._addUserMessageAndStreamResponse({ userMessage, _chatSelections: currSelns, threadId })
	}

	// ---------- the rest ----------

	private _getAllSeenFileURIs(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return []

		const fsPathsSet = new Set<string>()
		const uris: URI[] = []
		const addURI = (uri: URI) => {
			if (!fsPathsSet.has(uri.fsPath)) uris.push(uri)
			fsPathsSet.add(uri.fsPath)
			uris.push(uri)
		}

		for (const m of thread.messages) {
			// URIs of user selections
			if (m.role === 'user') {
				for (const sel of m.selections ?? []) {
					addURI(sel.uri)
				}
			}
			// URIs of files that have been read
			else if (m.role === 'tool' && m.type === 'success' && m.name === 'read_file') {
				const params = m.params as BuiltinToolCallParams['read_file']
				addURI(params.uri)
			}
		}
		return uris
	}



	getRelativeStr = (uri: URI) => {
		const isInside = this._workspaceContextService.isInsideWorkspace(uri)
		if (isInside) {
			const f = this._workspaceContextService.getWorkspace().folders.find(f => uri.fsPath.startsWith(f.uri.fsPath))
			if (f) { return uri.fsPath.replace(f.uri.fsPath, '') }
			else { return undefined }
		}
		else {
			return undefined
		}
	}


	// gets the location of codespan link so the user can click on it
	generateCodespanLink: IChatThreadService['generateCodespanLink'] = async ({ codespanStr: _codespanStr, threadId }) => {

		// process codespan to understand what we are searching for
		// TODO account for more complicated patterns eg `ITextEditorService.openEditor()`
		const functionOrMethodPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/; // `fUnCt10n_name`
		const functionParensPattern = /^([^\s(]+)\([^)]*\)$/; // `functionName( args )`

		let target = _codespanStr // the string to search for
		let codespanType: 'file-or-folder' | 'function-or-class'
		if (target.includes('.') || target.includes('/')) {

			codespanType = 'file-or-folder'
			target = _codespanStr

		} else if (functionOrMethodPattern.test(target)) {

			codespanType = 'function-or-class'
			target = _codespanStr

		} else if (functionParensPattern.test(target)) {
			const match = target.match(functionParensPattern)
			if (match && match[1]) {

				codespanType = 'function-or-class'
				target = match[1]

			}
			else { return null }
		}
		else {
			return null
		}

		// get history of all AI and user added files in conversation + store in reverse order (MRU)
		const prevUris = this._getAllSeenFileURIs(threadId).reverse()

		if (codespanType === 'file-or-folder') {
			const doesUriMatchTarget = (uri: URI) => uri.path.includes(target)

			// check if any prevFiles are the `target`
			for (const [idx, uri] of prevUris.entries()) {
				if (doesUriMatchTarget(uri)) {

					// shorten it

					// TODO make this logic more general
					const prevUriStrs = prevUris.map(uri => uri.fsPath)
					const shortenedUriStrs = shorten(prevUriStrs)
					let displayText = shortenedUriStrs[idx]
					const ellipsisIdx = displayText.lastIndexOf('…/');
					if (ellipsisIdx >= 0) {
						displayText = displayText.slice(ellipsisIdx + 2)
					}

					return { uri, displayText }
				}
			}

			// else search codebase for `target`
			let uris: URI[] = []
			try {
				const { result } = await this._toolsService.callTool['search_pathnames_only']({ query: target, includePattern: null, pageNumber: 0 })
				const { uris: uris_ } = await result
				uris = uris_
			} catch (e) {
				return null
			}

			for (const [idx, uri] of uris.entries()) {
				if (doesUriMatchTarget(uri)) {

					// TODO make this logic more general
					const prevUriStrs = prevUris.map(uri => uri.fsPath)
					const shortenedUriStrs = shorten(prevUriStrs)
					let displayText = shortenedUriStrs[idx]
					const ellipsisIdx = displayText.lastIndexOf('…/');
					if (ellipsisIdx >= 0) {
						displayText = displayText.slice(ellipsisIdx + 2)
					}


					return { uri, displayText }
				}
			}

		}


		if (codespanType === 'function-or-class') {


			// check all prevUris for the target
			for (const uri of prevUris) {

				const modelRef = await this._cortexideModelService.getModelSafe(uri)
				const { model } = modelRef
				if (!model) continue

				const matches = model.findMatches(
					target,
					false, // searchOnlyEditableRange
					false, // isRegex
					true,  // matchCase
					null, //' ',   // wordSeparators
					true   // captureMatches
				);

				const firstThree = matches.slice(0, 3);

				// take first 3 occurences, attempt to goto definition on them
				for (const match of firstThree) {
					const position = new Position(match.range.startLineNumber, match.range.startColumn);
					const definitionProviders = this._languageFeaturesService.definitionProvider.ordered(model);

					for (const provider of definitionProviders) {

						const _definitions = await provider.provideDefinition(model, position, CancellationToken.None);

						if (!_definitions) continue;

						const definitions = Array.isArray(_definitions) ? _definitions : [_definitions];

						for (const definition of definitions) {

							return {
								uri: definition.uri,
								selection: {
									startLineNumber: definition.range.startLineNumber,
									startColumn: definition.range.startColumn,
									endLineNumber: definition.range.endLineNumber,
									endColumn: definition.range.endColumn,
								},
								displayText: _codespanStr,
							};
						}
					}
				}
			}

			// unlike above do not search codebase (doesnt make sense)

		}

		return null

	}

	getCodespanLink({ codespanStr, messageIdx, threadId }: { codespanStr: string, messageIdx: number, threadId: string }): CodespanLocationLink | undefined {
		const thread = this.state.allThreads[threadId]
		if (!thread) return undefined;

		const links = thread.state.linksOfMessageIdx?.[messageIdx]
		if (!links) return undefined;

		const link = links[codespanStr]

		return link
	}

	async addCodespanLink({ newLinkText, newLinkLocation, messageIdx, threadId }: { newLinkText: string, newLinkLocation: CodespanLocationLink, messageIdx: number, threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({

			allThreads: {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					state: {
						...thread.state,
						linksOfMessageIdx: {
							...thread.state.linksOfMessageIdx,
							[messageIdx]: {
								...thread.state.linksOfMessageIdx?.[messageIdx],
								[newLinkText]: newLinkLocation
							}
						}
					}

				}
			}
		})
	}


	getCurrentThread(): ThreadType {
		const state = this.state
		const thread = state.allThreads[state.currentThreadId]
		if (!thread) throw new Error(`Current thread should never be undefined`)
		return thread
	}

	getCurrentFocusedMessageIdx() {
		const thread = this.getCurrentThread()

		// get the focusedMessageIdx
		const focusedMessageIdx = thread.state.focusedMessageIdx
		if (focusedMessageIdx === undefined) return;

		// check that the message is actually being edited
		const focusedMessage = thread.messages[focusedMessageIdx]
		if (focusedMessage.role !== 'user') return;
		if (!focusedMessage.state) return;

		return focusedMessageIdx
	}

	isCurrentlyFocusingMessage() {
		return this.getCurrentFocusedMessageIdx() !== undefined
	}

	switchToThread(threadId: string) {
		this._setState({ currentThreadId: threadId })
	}

	// Tab management: tabs are an ordered subset of threads visible in the tab bar.
	// switchToTab adds the thread to openTabs if not already present, then switches.
	switchToTab(threadId: string) {
		const openTabs = this.state.openTabs.includes(threadId)
			? this.state.openTabs
			: [...this.state.openTabs, threadId]
		this._setState({ currentThreadId: threadId, openTabs })
	}

	// closeTab removes the thread from openTabs. If it was the active tab, switch to
	// allow-any-unicode-next-line
	// the nearest remaining tab. Does NOT delete the thread — it stays in history.
	closeTab(threadId: string) {
		const { openTabs, currentThreadId } = this.state
		const newTabs = openTabs.filter(id => id !== threadId)

		if (newTabs.length === 0) {
			// allow-any-unicode-next-line
			// All tabs closed — open a fresh thread (which will add itself to openTabs)
			this._setState({ openTabs: newTabs })
			this.openNewThread()
			return
		}

		let newCurrentId = currentThreadId
		if (currentThreadId === threadId) {
			// Switch to the tab to the left, or the first remaining if nothing to the left
			const closedIdx = openTabs.indexOf(threadId)
			newCurrentId = newTabs[Math.max(0, closedIdx - 1)]
		}

		this._setState({ openTabs: newTabs, currentThreadId: newCurrentId })
	}

	openNewThread() {
		// if a thread with 0 messages already exists in openTabs, switch to it
		const { allThreads: currentThreads, openTabs } = this.state
		for (const threadId of openTabs) {
			if (currentThreads[threadId]?.messages.length === 0) {
				this._setState({ currentThreadId: threadId })
				return
			}
		}
		// otherwise, start a new thread
		const newThread = newThreadObject()

		// allow-any-unicode-next-line
		// update state — add the new thread to openTabs
		const newThreads: ChatThreads = {
			...currentThreads,
			[newThread.id]: newThread
		}
		this._storeAllThreads(newThreads)
		this._setState({
			allThreads: newThreads,
			currentThreadId: newThread.id,
			openTabs: [...openTabs, newThread.id],
		})
	}


	deleteThread(threadId: string): void {
		const { allThreads: currentThreads, openTabs, currentThreadId } = this.state

		// delete the thread
		const newThreads = { ...currentThreads };
		delete newThreads[threadId];

		// also remove from openTabs and fix currentThreadId if needed
		const newTabs = openTabs.filter(id => id !== threadId)
		let newCurrentId = currentThreadId
		if (currentThreadId === threadId) {
			// Prefer an adjacent tab; fall back to any remaining thread; fall back to a new one
			const closedIdx = openTabs.indexOf(threadId)
			newCurrentId = newTabs[Math.max(0, closedIdx - 1)] ?? Object.keys(newThreads)[0] ?? ''
		}

		// Drop per-thread caches and state so deleted threads don't leak memory
		// (file-read cache hits its 100-entry per-thread cap but the bucket itself was orphaned)
		this._fileReadCache.delete(threadId)
		this._fileReadCacheLRU.delete(threadId)
		this._planCache.delete(threadId)
		this._pendingStreamStateUpdates.delete(threadId)
		this._fileOpJournalByThread.delete(threadId) // rollback before-content snapshots can be large; don't leak them
		delete this._suppressPlanOnceByThread[threadId]
		delete this.streamState[threadId]

		// store the updated threads
		this._storeAllThreads(newThreads);
		this._setState({ allThreads: newThreads, openTabs: newTabs, currentThreadId: newCurrentId })

		// if nothing remains, open a fresh thread
		if (Object.keys(newThreads).length === 0) {
			this.openNewThread()
		}
	}

	duplicateThread(threadId: string) {
		const { allThreads: currentThreads, openTabs } = this.state
		const threadToDuplicate = currentThreads[threadId]
		if (!threadToDuplicate) return
		const newThread = {
			...deepClone(threadToDuplicate),
			id: generateUuid(),
		}
		const newThreads = {
			...currentThreads,
			[newThread.id]: newThread,
		}
		// Insert the duplicate right after the source tab, or append if not in tabs
		const sourceTabIdx = openTabs.indexOf(threadId)
		const newTabs = sourceTabIdx !== -1
			? [...openTabs.slice(0, sourceTabIdx + 1), newThread.id, ...openTabs.slice(sourceTabIdx + 1)]
			: [...openTabs, newThread.id]
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads, currentThreadId: newThread.id, openTabs: newTabs })
	}


	// Creates a new thread containing messages[0..messageIdx] (inclusive) from the source thread,
	// then opens it as a tab. The original thread is left intact.
	branchFromMessage(threadId: string, messageIdx: number) {
		const { allThreads: currentThreads, openTabs } = this.state
		const sourceThread = currentThreads[threadId]
		if (!sourceThread) return

		const branchedMessages = deepClone(sourceThread.messages.slice(0, messageIdx + 1))
		const newThread: ThreadType = {
			...deepClone(sourceThread),
			id: generateUuid(),
			messages: branchedMessages,
			lastModified: new Date().toISOString(),
			state: {
				...deepClone(sourceThread.state),
				mountedInfo: undefined, // don't carry over mount info
			},
		}

		const newThreads: ChatThreads = { ...currentThreads, [newThread.id]: newThread }

		// Insert the branch right after the source tab if it's open, else append
		const sourceTabIdx = openTabs.indexOf(threadId)
		const newTabs = sourceTabIdx !== -1
			? [...openTabs.slice(0, sourceTabIdx + 1), newThread.id, ...openTabs.slice(sourceTabIdx + 1)]
			: [...openTabs, newThread.id]

		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads, currentThreadId: newThread.id, openTabs: newTabs })
	}

	private _addMessageToThread(threadId: string, message: ChatMessage) {
		// Invalidate plan cache when plan messages are added
		if (message.role === 'plan') {
			this._planCache.delete(threadId)
		}
		const { allThreads } = this.state
		const oldThread = allThreads[threadId]
		if (!oldThread) return // should never happen
		// update state and store it
		const newThreads = {
			...allThreads,
			[oldThread.id]: {
				...oldThread,
				lastModified: new Date().toISOString(),
				messages: [
					...oldThread.messages,
					message
				],
			}
		}
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads }) // the current thread just changed (it had a message added to it)
	}

	// sets the currently selected message (must be undefined if no message is selected)
	setCurrentlyFocusedMessageIdx(messageIdx: number | undefined) {

		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({
			allThreads: {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					state: {
						...thread.state,
						focusedMessageIdx: messageIdx,
					}
				}
			}
		})

		// // when change focused message idx, jump - do not jump back when click edit, too confusing.
		// if (messageIdx !== undefined)
		// 	this.jumpToCheckpointBeforeMessageIdx({ threadId, messageIdx, jumpToUserModified: true })
	}


	addNewStagingSelection(newSelection: StagingSelectionItem): void {

		const focusedMessageIdx = this.getCurrentFocusedMessageIdx()

		// set the selections to the proper value
		let selections: StagingSelectionItem[] = []
		let setSelections = (s: StagingSelectionItem[]) => { }

		if (focusedMessageIdx === undefined) {
			selections = this.getCurrentThreadState().stagingSelections
			setSelections = (s: StagingSelectionItem[]) => this.setCurrentThreadState({ stagingSelections: s })
		} else {
			selections = this.getCurrentMessageState(focusedMessageIdx).stagingSelections
			setSelections = (s) => this.setCurrentMessageState(focusedMessageIdx, { stagingSelections: s })
		}

		// if matches with existing selection, overwrite (since text may change)
		const idx = findStagingSelectionIndex(selections, newSelection)
		if (idx !== null && idx !== -1) {
			setSelections([
				...selections!.slice(0, idx),
				newSelection,
				...selections!.slice(idx + 1, Infinity)
			])
		}
		// if no match, add it
		else {
			setSelections([...(selections ?? []), newSelection])
		}
	}


	// Pops the staging selections from the current thread's state
	popStagingSelections(numPops: number): void {

		numPops = numPops ?? 1;

		const focusedMessageIdx = this.getCurrentFocusedMessageIdx()

		// set the selections to the proper value
		let selections: StagingSelectionItem[] = []
		let setSelections = (s: StagingSelectionItem[]) => { }

		if (focusedMessageIdx === undefined) {
			selections = this.getCurrentThreadState().stagingSelections
			setSelections = (s: StagingSelectionItem[]) => this.setCurrentThreadState({ stagingSelections: s })
		} else {
			selections = this.getCurrentMessageState(focusedMessageIdx).stagingSelections
			setSelections = (s) => this.setCurrentMessageState(focusedMessageIdx, { stagingSelections: s })
		}

		setSelections([
			...selections.slice(0, selections.length - numPops)
		])

	}

	// set message.state
	private _setCurrentMessageState(state: Partial<UserMessageState>, messageIdx: number): void {

		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({
			allThreads: {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					messages: thread.messages.map((m, i) =>
						i === messageIdx && m.role === 'user' ? {
							...m,
							state: {
								...m.state,
								...state
							},
						} : m
					)
				}
			}
		})

	}

	// set thread.state
	private _setThreadState(threadId: string, state: Partial<ThreadType['state']>, doNotRefreshMountInfo?: boolean): void {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({
			allThreads: {
				...this.state.allThreads,
				[thread.id]: {
					...thread,
					state: {
						...thread.state,
						...state
					}
				}
			}
		}, doNotRefreshMountInfo)

	}



	getCurrentThreadState = () => {
		const currentThread = this.getCurrentThread()
		return currentThread.state
	}
	setCurrentThreadState = (newState: Partial<ThreadType['state']>) => {
		this._setThreadState(this.state.currentThreadId, newState)
	}

	// gets `staging` and `setStaging` of the currently focused element, given the index of the currently selected message (or undefined if no message is selected)

	getCurrentMessageState(messageIdx: number): UserMessageState {
		const currMessage = this.getCurrentThread()?.messages?.[messageIdx]
		if (!currMessage || currMessage.role !== 'user') return defaultMessageState
		return currMessage.state
	}
	setCurrentMessageState(messageIdx: number, newState: Partial<UserMessageState>) {
		const currMessage = this.getCurrentThread()?.messages?.[messageIdx]
		if (!currMessage || currMessage.role !== 'user') return
		this._setCurrentMessageState(newState, messageIdx)
	}



}

registerSingleton(IChatThreadService, ChatThreadService, InstantiationType.Eager);
