/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, AlertTriangle, Ban, Check, Dot, FileIcon, Folder, Text, Undo2, X } from 'lucide-react';
import { URI } from '../../../../../../../base/common/uri.js';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState } from '../../util/services.js';
import { ChatMarkdownRender, getApplyBoxId } from '../../markdown/ChatMarkdownRender.js';
import { VoidDiffEditor } from '../../util/inputs.js';
import { ChatMessage, ToolMessage } from '../../../../common/chatThreadServiceTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, ToolName, LintErrorItem, toolApprovalTypes } from '../../../../common/toolsServiceTypes.js';
import { CopyButton, EditToolAcceptRejectButtonsHTML, JumpToFileButton, JumpToTerminalButton, StatusIndicator, StatusIndicatorForApplyButton, useApplyStreamState, useEditToolStreamState } from '../../markdown/ApplyBlockHoverButtons.js';
import { acceptAllBg, acceptBorder, buttonFontSize, buttonTextColor, rejectAllBg, rejectBg, rejectBorder } from '../../../../common/helpers/colors.js';
import { isABuiltinToolName, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_INACTIVE_TIME } from '../../../../common/prompt/prompts.js';
import { RawToolCallObj } from '../../../../common/sendLLMMessageTypes.js';
import { persistentTerminalNameOfId } from '../../../terminalToolService.js';
import { removeMCPToolNamePrefix } from '../../../../common/mcpServiceTypes.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { IconLoading } from '../shared/icons.js';
import { getBasename, getFolderName, getRelative, voidOpenFileFn } from '../shared/pathUtils.js';
import { ToolChildrenWrapper, CodeChildren, ListableToolItem } from './ToolPrimitives.js';
import { SmallProseWrapper } from '../chat/proseWrappers.js';
import { ToolApprovalTypeSwitch } from '../../settings/Settings.js';
import { ToolHeaderWrapper, SimplifiedToolHeader, ToolHeaderParams } from './ToolHeader.js';

export type { ToolHeaderParams };

const EditTool = ({ toolMessage, threadId, messageIdx, content }: Parameters<ResultWrapper<'edit_file' | 'rewrite_file'>>[0] & { content: string }) => {
	const accessor = useAccessor()
	const isError = false
	const isRejected = toolMessage.type === 'rejected'

	const title = getTitle(toolMessage)

	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
	const icon = null

	const { rawParams, params, name } = toolMessage
	const desc1OnClick = () => voidOpenFileFn(params.uri, accessor)
	const componentParams: ToolHeaderParams = { title, desc1, desc1OnClick, desc1Info, isError, icon, isRejected, }


	const editToolType = toolMessage.name === 'edit_file' ? 'diff' : 'rewrite'
	if (toolMessage.type === 'running_now' || toolMessage.type === 'tool_request') {
		componentParams.children = <ToolChildrenWrapper className='bg-void-bg-3'>
			<EditToolChildren
				uri={params.uri}
				code={content}
				type={editToolType}
			/>
		</ToolChildrenWrapper>
		// JumpToFileButton removed in favor of FileLinkText
	}
	else if (toolMessage.type === 'success' || toolMessage.type === 'rejected' || toolMessage.type === 'tool_error') {
		// add apply box
		const applyBoxId = getApplyBoxId({
			threadId: threadId,
			messageIdx: messageIdx,
			tokenIdx: 'N/A',
		})
		componentParams.desc2 = <EditToolHeaderButtons
			applyBoxId={applyBoxId}
			uri={params.uri}
			codeStr={content}
			toolName={name}
			threadId={threadId}
		/>

		// add children
		componentParams.children = <ToolChildrenWrapper className='bg-void-bg-3'>
			<EditToolChildren
				uri={params.uri}
				code={content}
				type={editToolType}
			/>
		</ToolChildrenWrapper>

		if (toolMessage.type === 'success' || toolMessage.type === 'rejected') {
			const { result } = toolMessage
			componentParams.bottomChildren = <BottomChildren title='Lint errors'>
				{result?.lintErrors?.map((error, i) => (
					<div key={`${error.startLineNumber}-${error.endLineNumber}-${i}`} className='whitespace-nowrap'>Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}</div>
				))}
			</BottomChildren>
		}
		else if (toolMessage.type === 'tool_error') {
			// error
			const { result } = toolMessage
			componentParams.bottomChildren = <BottomChildren title='Error'>
				<CodeChildren>
					{result}
				</CodeChildren>
			</BottomChildren>
		}
	}

	return <ToolHeaderWrapper {...componentParams} />
}

const loadingTitleWrapper = (item: React.ReactNode): React.ReactNode => {
	return <span className='flex items-center flex-nowrap gap-1'>
		{item}
		<IconLoading state="processing" inline className='w-3 text-sm' />
	</span>
}

const titleOfBuiltinToolName = {
	'read_file': { done: 'Read file', proposed: 'Read file', running: loadingTitleWrapper('Reading file') },
	'ls_dir': { done: 'Inspected folder', proposed: 'Inspect folder', running: loadingTitleWrapper('Inspecting folder') },
	'get_dir_tree': { done: 'Inspected folder tree', proposed: 'Inspect folder tree', running: loadingTitleWrapper('Inspecting folder tree') },
	'search_pathnames_only': { done: 'Searched by file name', proposed: 'Search by file name', running: loadingTitleWrapper('Searching by file name') },
	'search_for_files': { done: 'Searched', proposed: 'Search', running: loadingTitleWrapper('Searching') },
	'create_file_or_folder': { done: `Created`, proposed: `Create`, running: loadingTitleWrapper(`Creating`) },
	'delete_file_or_folder': { done: `Deleted`, proposed: `Delete`, running: loadingTitleWrapper(`Deleting`) },
	'edit_file': { done: `Edited file`, proposed: 'Edit file', running: loadingTitleWrapper('Editing file') },
	'rewrite_file': { done: `Wrote file`, proposed: 'Write file', running: loadingTitleWrapper('Writing file') },
	'run_command': { done: `Ran terminal`, proposed: 'Run terminal', running: loadingTitleWrapper('Running terminal') },
	'run_persistent_command': { done: `Ran terminal`, proposed: 'Run terminal', running: loadingTitleWrapper('Running terminal') },

	'open_persistent_terminal': { done: `Opened terminal`, proposed: 'Open terminal', running: loadingTitleWrapper('Opening terminal') },
	'kill_persistent_terminal': { done: `Killed terminal`, proposed: 'Kill terminal', running: loadingTitleWrapper('Killing terminal') },

	'read_lint_errors': { done: `Read lint errors`, proposed: 'Read lint errors', running: loadingTitleWrapper('Reading lint errors') },
	'search_in_file': { done: 'Searched in file', proposed: 'Search in file', running: loadingTitleWrapper('Searching in file') },
	'web_search': { done: 'Searched the web', proposed: 'Search the web', running: loadingTitleWrapper('Searching the web') },
	'browse_url': { done: 'Fetched web page', proposed: 'Fetch web page', running: loadingTitleWrapper('Fetching web page') },
} as const satisfies Record<BuiltinToolName, { done: any, proposed: any, running: any }>


const getTitle = (toolMessage: Pick<ChatMessage & { role: 'tool' }, 'name' | 'type' | 'mcpServerName'>): React.ReactNode => {
	const t = toolMessage

	// non-built-in title
	if (!builtinToolNames.includes(t.name as BuiltinToolName)) {
		// descriptor of Running or Ran etc
		const descriptor =
			t.type === 'success' ? 'Called'
				: t.type === 'running_now' ? 'Calling'
					: t.type === 'tool_request' ? 'Call'
						: t.type === 'rejected' ? 'Call'
							: t.type === 'invalid_params' ? 'Call'
								: t.type === 'tool_error' ? 'Call'
									: 'Call'


		const title = `${descriptor} ${toolMessage.mcpServerName || 'MCP'}`
		if (t.type === 'running_now' || t.type === 'tool_request')
			return loadingTitleWrapper(title)
		return title
	}

	// built-in title
	else {
		const toolName = t.name as BuiltinToolName
		const entry = titleOfBuiltinToolName[toolName]
		// Defensive: a name can pass `builtinToolNames.includes()` (a runtime list)
		// yet be missing from this title map — e.g. type/runtime drift, or a weak/free
		// model emitting an unexpected built-in tool name. A missing entry must never
		// crash the whole chat render (it previously threw "reading 'proposed'").
		if (!entry) {
			const verb = t.type === 'success' ? 'Called' : t.type === 'running_now' ? 'Calling' : 'Call'
			const fallback = `${verb} ${toolName}`
			return t.type === 'running_now' ? loadingTitleWrapper(fallback) : fallback
		}
		if (t.type === 'success') return entry.done
		if (t.type === 'running_now') return entry.running
		return entry.proposed
	}
}


const toolNameToDesc = (toolName: BuiltinToolName, _toolParams: BuiltinToolCallParams[BuiltinToolName] | undefined, accessor: ReturnType<typeof useAccessor>): {
	desc1: React.ReactNode,
	desc1Info?: string,
} => {

	if (!_toolParams) {
		return { desc1: '', };
	}

	const x = {
		'read_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['read_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'ls_dir': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['ls_dir']
			return {
				desc1: getFolderName(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'search_pathnames_only': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_pathnames_only']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'search_for_files': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_for_files']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'search_in_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_in_file'];
			return {
				desc1: `"${toolParams.query}"`,
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'create_file_or_folder': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['create_file_or_folder']
			return {
				desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? '/' : getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'delete_file_or_folder': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['delete_file_or_folder']
			return {
				desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? '/' : getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'rewrite_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['rewrite_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'edit_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['edit_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'run_command': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['run_command']
			return {
				desc1: `"${toolParams.command}"`,
			}
		},
		'run_persistent_command': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['run_persistent_command']
			return {
				desc1: `"${toolParams.command}"`,
			}
		},
		'open_persistent_terminal': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['open_persistent_terminal']
			return { desc1: '' }
		},
		'kill_persistent_terminal': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['kill_persistent_terminal']
			return { desc1: toolParams.persistentTerminalId }
		},
		'get_dir_tree': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['get_dir_tree']
			return {
				desc1: getFolderName(toolParams.uri.fsPath) ?? '/',
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'read_lint_errors': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['read_lint_errors']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'web_search': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['web_search']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'browse_url': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browse_url']
			return {
				desc1: toolParams.url,
				desc1Info: new URL(toolParams.url).hostname,
			}
		}
	}

	try {
		return x[toolName]?.() || { desc1: '' }
	}
	catch {
		return { desc1: '' }
	}
}

const ToolRequestAcceptRejectButtons = ({ toolName }: { toolName: ToolName }) => {
	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const metricsService = accessor.get('IMetricsService')
	const cortexideSettingsService = accessor.get('ICortexideSettingsService')
	const voidSettingsState = useSettingsState()

	// Subscribe to thread state changes properly
	const chatThreadsState = useChatThreadsState()
	const currentThreadId = chatThreadsState.currentThreadId

	const onAccept = useCallback(() => {
		try { // this doesn't need to be wrapped in try/catch anymore
			// use subscribed state
			chatThreadsService.approveLatestToolRequest(currentThreadId)
			metricsService.capture('Tool Request Accepted', {})
		} catch (e) { console.error('Error while approving message in chat:', e) }
	}, [chatThreadsService, metricsService, currentThreadId])

	const onReject = useCallback(() => {
		try {
			// use subscribed state
			chatThreadsService.rejectLatestToolRequest(currentThreadId)
		} catch (e) { console.error('Error while approving message in chat:', e) }
		metricsService.capture('Tool Request Rejected', {})
	}, [chatThreadsService, metricsService, currentThreadId])

	const approveButton = (
		<button
			onClick={onAccept}
			className={`
                px-2 py-1
                bg-[var(--vscode-button-background)]
                text-[var(--vscode-button-foreground)]
                hover:bg-[var(--vscode-button-hoverBackground)]
                rounded
                text-sm font-medium
            `}
		>
			Approve
		</button>
	)

	const cancelButton = (
		<button
			onClick={onReject}
			className={`
                px-2 py-1
                bg-[var(--vscode-button-secondaryBackground)]
                text-[var(--vscode-button-secondaryForeground)]
                hover:bg-[var(--vscode-button-secondaryHoverBackground)]
                rounded
                text-sm font-medium
            `}
		>
			Cancel
		</button>
	)

	const approvalType = isABuiltinToolName(toolName) ? approvalTypeOfBuiltinToolName[toolName] : 'MCP tools'
	const approvalToggle = approvalType ? <div key={approvalType} className="flex items-center ml-2 gap-x-1">
		<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
	</div> : null

	return <div className="flex gap-2 mx-0.5 items-center">
		{approveButton}
		{cancelButton}
		{approvalToggle}
	</div>
}

const EditToolChildren = ({ uri, code, type }: { uri: URI | undefined, code: string, type: 'diff' | 'rewrite' }) => {

	const content = type === 'diff' ?
		<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
		: <ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />

	return <div className='!select-text cursor-auto'>
		<SmallProseWrapper>
			{content}
		</SmallProseWrapper>
	</div>

}


const LintErrorChildren = ({ lintErrors }: { lintErrors: LintErrorItem[] }) => {
	return <div className="text-xs text-void-fg-4 opacity-80 border-l-2 border-void-warning px-2 py-0.5 flex flex-col gap-0.5 overflow-x-auto whitespace-nowrap">
		{lintErrors.map((error, i) => (
			<div key={`${error.startLineNumber}-${error.endLineNumber}-${i}`}>Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}</div>
		))}
	</div>
}

const BottomChildren = ({ children, title }: { children: React.ReactNode, title: string }) => {
	const [isOpen, setIsOpen] = useState(false);
	if (!children) return null;
	return (
		<div className="w-full px-2 mt-0.5">
			<div
				className={`flex items-center cursor-pointer select-none transition-colors duration-150 pl-0 py-0.5 rounded group`}
				onClick={() => setIsOpen(o => !o)}
				style={{ background: 'none' }}
			>
				<ChevronRight
					className={`mr-1 h-3 w-3 flex-shrink-0 transition-transform duration-100 text-void-fg-4 group-hover:text-void-fg-3 ${isOpen ? 'rotate-90' : ''}`}
				/>
				<span className="font-medium text-void-fg-4 group-hover:text-void-fg-3 text-xs">{title}</span>
			</div>
			<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'opacity-100' : 'max-h-0 opacity-0'} text-xs pl-4`}
			>
				<div className="overflow-x-auto text-void-fg-4 opacity-90 border-l-2 border-void-warning px-2 py-0.5">
					{children}
				</div>
			</div>
		</div>
	);
}


const EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, toolName, threadId }: { threadId: string, applyBoxId: string, uri: URI, codeStr: string, toolName: 'edit_file' | 'rewrite_file' }) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri })
	return <div className='flex items-center gap-1'>
		{/* <StatusIndicatorForApplyButton applyBoxId={applyBoxId} uri={uri} /> */}
		{/* <JumpToFileButton uri={uri} /> */}
		{streamState === 'idle-no-changes' && <CopyButton codeStr={codeStr} toolTipName='Copy' />}
		<EditToolAcceptRejectButtonsHTML type={toolName} codeStr={codeStr} applyBoxId={applyBoxId} uri={uri} threadId={threadId} />
	</div>
}



const InvalidTool = ({ toolName, message, mcpServerName }: { toolName: ToolName, message: string, mcpServerName: string | undefined }) => {
	const accessor = useAccessor()
	const title = getTitle({ name: toolName, type: 'invalid_params', mcpServerName })
	const desc1 = 'Invalid parameters'
	const icon = null
	const isError = true
	const componentParams: ToolHeaderParams = { title, desc1, isError, icon }

	componentParams.children = <ToolChildrenWrapper>
		<CodeChildren className='bg-void-bg-3'>
			{message}
		</CodeChildren>
	</ToolChildrenWrapper>
	return <ToolHeaderWrapper {...componentParams} />
}

const CanceledTool = ({ toolName, mcpServerName }: { toolName: ToolName, mcpServerName: string | undefined }) => {
	const accessor = useAccessor()
	const title = getTitle({ name: toolName, type: 'rejected', mcpServerName })
	const desc1 = ''
	const icon = null
	const isRejected = true
	const componentParams: ToolHeaderParams = { title, desc1, icon, isRejected }
	return <ToolHeaderWrapper {...componentParams} />
}


const CommandTool = ({ toolMessage, type, threadId }: { threadId: string } & ({
	toolMessage: Exclude<ToolMessage<'run_command'>, { type: 'invalid_params' }>
	type: 'run_command'
} | {
	toolMessage: Exclude<ToolMessage<'run_persistent_command'>, { type: 'invalid_params' }>
	type: | 'run_persistent_command'
})) => {
	const accessor = useAccessor()

	const commandService = accessor.get('ICommandService')
	const terminalToolsService = accessor.get('ITerminalToolService')
	const toolsService = accessor.get('IToolsService')
	const isError = false
	const title = getTitle(toolMessage)
	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
	const icon = null
	const streamState = useChatThreadsStreamState(threadId)

	const divRef = useRef<HTMLDivElement | null>(null)

	const isRejected = toolMessage.type === 'rejected'
	const { rawParams, params } = toolMessage
	const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }


	const effect = async () => {
		if (streamState?.isRunning !== 'tool') return
		if (type !== 'run_command' || toolMessage.type !== 'running_now') return;

		// wait for the interruptor so we know it's running

		await streamState?.interrupt
		const container = divRef.current;
		if (!container) return;

		const terminal = terminalToolsService.getTemporaryTerminal(toolMessage.params.terminalId);
		if (!terminal) return;

		try {
			terminal.attachToElement(container);
			terminal.setVisible(true)
		} catch {
		}

		// Listen for size changes of the container and keep the terminal layout in sync.
		const resizeObserver = new ResizeObserver((entries) => {
			const height = entries[0].borderBoxSize[0].blockSize;
			const width = entries[0].borderBoxSize[0].inlineSize;
			if (typeof terminal.layout === 'function') {
				terminal.layout({ width, height });
			}
		});

		resizeObserver.observe(container);
		return () => { terminal.detachFromElement(); resizeObserver?.disconnect(); }
	}

	useEffect(() => {
		effect()
	}, [terminalToolsService, toolMessage, toolMessage.type, type]);

	if (toolMessage.type === 'success') {
		const { result } = toolMessage

		// it's unclear that this is a button and not an icon.
		// componentParams.desc2 = <JumpToTerminalButton
		// 	onClick={() => { terminalToolsService.openTerminal(terminalId) }}
		// />

		let msg: string
		if (type === 'run_command') msg = toolsService.stringOfResult['run_command'](toolMessage.params, result)
		else msg = toolsService.stringOfResult['run_persistent_command'](toolMessage.params, result)

		if (type === 'run_persistent_command') {
			componentParams.info = persistentTerminalNameOfId(toolMessage.params.persistentTerminalId)
		}

		componentParams.children = <ToolChildrenWrapper className='whitespace-pre text-nowrap overflow-auto text-sm'>
			<div className='!select-text cursor-auto'>
				<BlockCode initValue={`${msg.trim()}`} language='shellscript' />
			</div>
		</ToolChildrenWrapper>
	}
	else if (toolMessage.type === 'tool_error') {
		const { result } = toolMessage
		componentParams.bottomChildren = <BottomChildren title='Error'>
			<CodeChildren>
				{result}
			</CodeChildren>
		</BottomChildren>
	}
	else if (toolMessage.type === 'running_now') {
		if (type === 'run_command')
			componentParams.children = <div ref={divRef} className='relative h-[300px] text-sm' />
	}
	else if (toolMessage.type === 'rejected' || toolMessage.type === 'tool_request') {
	}

	return <>
		<ToolHeaderWrapper {...componentParams} isOpen={type === 'run_command' && toolMessage.type === 'running_now' ? true : undefined} />
	</>
}

export type WrapperProps<T extends ToolName> = { toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>, messageIdx: number, threadId: string }
const MCPToolWrapper = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')

	const title = getTitle(toolMessage)
	const desc1 = removeMCPToolNamePrefix(toolMessage.name)
	const icon = null


	if (toolMessage.type === 'running_now') return null // do not show running

	const isError = false
	const isRejected = toolMessage.type === 'rejected'
	const { rawParams, params } = toolMessage

	// Redact sensitive values in params before display/copy
	const redactParams = (value: any): any => {
		const SENSITIVE_KEYS = new Set(['token', 'apiKey', 'apikey', 'password', 'authorization', 'auth', 'secret', 'clientSecret', 'accessToken', 'bearer'])
		const redactValue = (v: any) => (typeof v === 'string' ? (v.length > 6 ? v.slice(0, 3) + '***' + v.slice(-2) : '***') : v)
		if (Array.isArray(value)) return value.map(redactParams)
		if (value && typeof value === 'object') {
			const out: any = Array.isArray(value) ? [] : {}
			for (const k of Object.keys(value)) {
				if (SENSITIVE_KEYS.has(k.toLowerCase())) out[k] = redactValue(value[k])
				else out[k] = redactParams(value[k])
			}
			return out
		}
		return value
	}
	const componentParams: ToolHeaderParams = { title, desc1, isError, icon, isRejected, }

	const redactedParams = redactParams(params)
	const paramsStr = JSON.stringify(redactedParams, null, 2)
	componentParams.desc2 = <CopyButton codeStr={paramsStr} toolTipName={`Copy inputs (redacted): ${paramsStr}`} />

	componentParams.info = !toolMessage.mcpServerName ? 'MCP tool not found' : undefined

	// Add copy inputs button in desc2


	if (toolMessage.type === 'success' || toolMessage.type === 'tool_request') {
		const { result } = toolMessage
		if (result) {
			const resultStr = mcpService.stringifyResult(result)
			// Check if result is text (not JSON) - text events return plain text, others return JSON
			// Type guard: check if result has 'event' property and it's 'text'
			const isTextResult = typeof result === 'object' && result !== null && 'event' in result && (result as any).event === 'text'
			// If it's text, display as markdown; otherwise display as JSON code block
			const displayContent = isTextResult ? resultStr : `\`\`\`json\n${resultStr}\n\`\`\``
			componentParams.children = <ToolChildrenWrapper>
				<SmallProseWrapper>
					<ChatMarkdownRender
						string={displayContent}
						chatMessageLocation={undefined}
						isApplyEnabled={false}
						isLinkDetectionEnabled={true}
					/>
				</SmallProseWrapper>
			</ToolChildrenWrapper>
		}
	}
	else if (toolMessage.type === 'tool_error') {
		const { result } = toolMessage
		componentParams.bottomChildren = <BottomChildren title='Error'>
			<CodeChildren>
				{result}
			</CodeChildren>
		</BottomChildren>
	}

	return <ToolHeaderWrapper {...componentParams} />

}

export type ResultWrapper<T extends ToolName> = (props: WrapperProps<T>) => React.ReactNode

const builtinToolNameToComponent: { [T in BuiltinToolName]: { resultWrapper: ResultWrapper<T>, } } = {
	'read_file': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			let range: [number, number] | undefined = undefined
			if (toolMessage.params.startLine !== null || toolMessage.params.endLine !== null) {
				const start = toolMessage.params.startLine === null ? `1` : `${toolMessage.params.startLine}`
				const end = toolMessage.params.endLine === null ? `` : `${toolMessage.params.endLine}`
				const addStr = `(${start}-${end})`
				componentParams.desc1 += ` ${addStr}`
				range = [params.startLine || 1, params.endLine || 1]
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor, range) }
				if (result.hasNextPage && params.pageNumber === 1)  // first page
					componentParams.desc2 = `(truncated after ${Math.round(MAX_FILE_CHARS_PAGE) / 1000}k)`
				else if (params.pageNumber > 1) // subsequent pages
					componentParams.desc2 = `(part ${params.pageNumber})`
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'get_dir_tree': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.uri) {
				const rel = getRelative(params.uri, accessor)
				if (rel) componentParams.info = `Only search in ${rel}`
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.children = <ToolChildrenWrapper>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={`\`\`\`\n${result.str}\n\`\`\``}
							chatMessageLocation={undefined}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />

		}
	},
	'ls_dir': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const explorerService = accessor.get('IExplorerService')
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.uri) {
				const rel = getRelative(params.uri, accessor)
				if (rel) componentParams.info = `Only search in ${rel}`
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.numResults = result.children?.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = !result.children || (result.children.length ?? 0) === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.children.map((child, i) => (<ListableToolItem key={child.uri?.toString() ?? `child-${i}`}
							name={`${child.name}${child.isDirectory ? '/' : ''}`}
							className='w-full overflow-auto'
							onClick={() => {
								voidOpenFileFn(child.uri, accessor)
								// commandService.executeCommand('workbench.view.explorer'); // open in explorer folders view instead
								// explorerService.select(child.uri, true);
							}}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={`Results truncated (${result.itemsRemaining} remaining).`} isSmall={true} className='w-full overflow-auto' />
						}
					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'search_pathnames_only': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.includePattern) {
				componentParams.info = `Only search in ${params.includePattern}`
			}

			if (toolMessage.type === 'success') {
				const { result, rawParams } = toolMessage
				componentParams.numResults = result.uris.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = result.uris.length === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.uris.map((uri, i) => (<ListableToolItem key={uri.toString()}
							name={getBasename(uri.fsPath)}
							className='w-full overflow-auto'
							onClick={() => { voidOpenFileFn(uri, accessor) }}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={'Results truncated.'} isSmall={true} className='w-full overflow-auto' />
						}

					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'search_for_files': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.searchInFolder || params.isRegex) {
				let info: string[] = []
				if (params.searchInFolder) {
					const rel = getRelative(params.searchInFolder, accessor)
					if (rel) info.push(`Only search in ${rel}`)
				}
				if (params.isRegex) { info.push(`Uses regex search`) }
				componentParams.info = info.join('; ')
			}

			if (toolMessage.type === 'success') {
				const { result, rawParams } = toolMessage
				componentParams.numResults = result.uris.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = result.uris.length === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.uris.map((uri, i) => (<ListableToolItem key={uri.toString()}
							name={getBasename(uri.fsPath)}
							className='w-full overflow-auto'
							onClick={() => { voidOpenFileFn(uri, accessor) }}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={`Results truncated.`} isSmall={true} className='w-full overflow-auto' />
						}

					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}
			return <ToolHeaderWrapper {...componentParams} />
		}
	},

	'search_in_file': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get('IToolsService');
			const title = getTitle(toolMessage);
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
			const icon = null;

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected };

			const infoarr: string[] = []
			const uriStr = getRelative(params.uri, accessor)
			if (uriStr) infoarr.push(uriStr)
			if (params.isRegex) infoarr.push('Uses regex search')
			componentParams.info = infoarr.join('; ')

			if (toolMessage.type === 'success') {
				const { result } = toolMessage; // result is array of snippets
				componentParams.numResults = result.lines.length;
				componentParams.children = result.lines.length === 0 ? undefined :
					<ToolChildrenWrapper>
						<CodeChildren className='bg-void-bg-3'>
							<pre className='font-mono whitespace-pre'>
								{toolsService.stringOfResult['search_in_file'](params, result)}
							</pre>
						</CodeChildren>
					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage;
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />;
		}
	},

	'read_lint_errors': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)

			const { uri } = toolMessage.params ?? {}
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			componentParams.info = getRelative(uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
				if (result.lintErrors)
					componentParams.children = <LintErrorChildren lintErrors={result.lintErrors} />
				else
					componentParams.children = `No lint errors found.`

			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},

	// ---

	'create_file_or_folder': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null


			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			componentParams.info = getRelative(params.uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'rejected') {
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				if (params) { componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) } }
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}
			else if (toolMessage.type === 'running_now') {
				// nothing more is needed
			}
			else if (toolMessage.type === 'tool_request') {
				// nothing more is needed
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'delete_file_or_folder': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isFolder = toolMessage.params?.isFolder ?? false
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			componentParams.info = getRelative(params.uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'rejected') {
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				if (params) { componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) } }
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}
			else if (toolMessage.type === 'running_now') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_request') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'rewrite_file': {
		resultWrapper: (params) => {
			return <EditTool {...params} content={params.toolMessage.params.newContent} />
		}
	},
	'edit_file': {
		resultWrapper: (params) => {
			return <EditTool {...params} content={params.toolMessage.params.searchReplaceBlocks} />
		}
	},

	// ---

	'run_command': {
		resultWrapper: (params) => {
			return <CommandTool {...params} type='run_command' />
		}
	},

	'run_persistent_command': {
		resultWrapper: (params) => {
			return <CommandTool {...params} type='run_persistent_command' />
		}
	},
	'open_persistent_terminal': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const terminalToolsService = accessor.get('ITerminalToolService')

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const title = getTitle(toolMessage)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			const relativePath = params.cwd ? getRelative(URI.file(params.cwd), accessor) : ''
			componentParams.info = relativePath ? `Running in ${relativePath}` : undefined

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				const { persistentTerminalId } = result
				componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId)
				componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId)
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'kill_persistent_terminal': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const terminalToolsService = accessor.get('ITerminalToolService')

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const title = getTitle(toolMessage)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (toolMessage.type === 'success') {
				const { persistentTerminalId } = params
				componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId)
				componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId)
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'web_search': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const toolsService = accessor.get('IToolsService')
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') {
				// Show loading indicator
				const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError: false, icon, isRejected: false }
				componentParams.children = <ToolChildrenWrapper>
					<div className='flex items-center gap-2 text-sm text-void-fg-3'>
						<IconLoading state="processing" inline />
						<span>Searching the web...</span>
					</div>
				</ToolChildrenWrapper>
				return <ToolHeaderWrapper {...componentParams} />
			}

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.numResults = result.results?.length || 0

				if (result.results && result.results.length > 0) {
					componentParams.children = <ToolChildrenWrapper>
						<div className='space-y-3'>
							{result.results.map((r: { title: string, snippet: string, url: string }, i: number) => (
								<div key={r.url || i} className='border border-void-border-2 bg-void-bg-2 rounded p-3 hover:bg-void-bg-3 transition-colors'>
									<a
										href={r.url}
										target='_blank'
										rel='noopener noreferrer'
										className='block group'
									>
										<div className='text-sm font-semibold text-blue-400 group-hover:text-blue-300 mb-1 line-clamp-2'>
											{r.title}
										</div>
										<div className='text-xs text-void-fg-4 mb-2 truncate'>
											{r.url}
										</div>
										<div className='text-sm text-void-fg-2 line-clamp-3'>
											{r.snippet}
										</div>
									</a>
								</div>
							))}
						</div>
					</ToolChildrenWrapper>
				} else {
					componentParams.children = <ToolChildrenWrapper>
						<div className='text-sm text-void-fg-3'>
							No search results found.
						</div>
					</ToolChildrenWrapper>
				}
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'browse_url': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const toolsService = accessor.get('IToolsService')
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') {
				// Show loading indicator
				const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError: false, icon, isRejected: false }
				componentParams.children = <ToolChildrenWrapper>
					<div className='flex items-center gap-2 text-sm text-void-fg-3'>
						<IconLoading state="processing" inline />
						<span>Fetching content from URL...</span>
					</div>
				</ToolChildrenWrapper>
				return <ToolHeaderWrapper {...componentParams} />
			}

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				const urlStr = result.url || params.url

				componentParams.onClick = () => {
					if (urlStr) {
						window.open(urlStr, '_blank', 'noopener,noreferrer')
					}
				}
				componentParams.info = urlStr ? `Source: ${new URL(urlStr).hostname}` : undefined

				if (result.content) {
					const contentPreview = result.content.length > 2000
						? result.content.substring(0, 2000) + '\n\n... (content truncated)'
						: result.content

					componentParams.children = <ToolChildrenWrapper>
						<div className='space-y-3'>
							{result.title && (
								<div className='text-lg font-semibold text-void-fg-1'>
									{result.title}
								</div>
							)}
							{result.metadata?.publishedDate && (
								<div className='text-xs text-void-fg-4'>
									Published: {result.metadata.publishedDate}
								</div>
							)}
							{urlStr && (
								<a
									href={urlStr}
									target='_blank'
									rel='noopener noreferrer'
									className='text-sm text-blue-400 hover:text-blue-300 block truncate'
								>
									{urlStr}
								</a>
							)}
							<div className='text-sm text-void-fg-2 whitespace-pre-wrap max-h-96 overflow-y-auto border border-void-border-2 bg-void-bg-3 rounded p-3'>
								{contentPreview}
							</div>
						</div>
					</ToolChildrenWrapper>
				} else {
					componentParams.children = <ToolChildrenWrapper>
						<div className='text-sm text-void-fg-3'>
							No content extracted from URL.
						</div>
					</ToolChildrenWrapper>
				}
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
};




const EditToolSoFar = ({ toolCallSoFar, }: { toolCallSoFar: RawToolCallObj }) => {

	if (!isABuiltinToolName(toolCallSoFar.name)) return null

	const accessor = useAccessor()

	const uri = toolCallSoFar.rawParams.uri ? URI.file(toolCallSoFar.rawParams.uri) : undefined

	const title = titleOfBuiltinToolName[toolCallSoFar.name].proposed

	const uriDone = toolCallSoFar.doneParams.includes('uri')
	const desc1 = <span className='flex items-center gap-1'>
		{uriDone ?
			getBasename(toolCallSoFar.rawParams['uri'] ?? 'unknown')
			: `Generating`}
		<IconLoading state="processing" inline />
	</span>

	const desc1OnClick = () => { uri && voidOpenFileFn(uri, accessor) }

	// If URI has not been specified
	return <ToolHeaderWrapper
		title={title}
		desc1={desc1}
		desc1OnClick={desc1OnClick}
	>
		<EditToolChildren
			uri={uri}
			code={toolCallSoFar.rawParams.search_replace_blocks ?? toolCallSoFar.rawParams.new_content ?? ''}
			type={'rewrite'} // as it streams, show in rewrite format, don't make a diff editor
		/>
		<IconLoading state="processing" inline />
	</ToolHeaderWrapper>

}

export { ToolHeaderWrapper, SimplifiedToolHeader, InvalidTool, CanceledTool, builtinToolNameToComponent, EditToolSoFar };
