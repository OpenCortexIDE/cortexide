/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, X, Check, ChevronRight, Flag, Copy as CopyIcon, Info, CirclePlus, Ellipsis, CircleEllipsis, Undo, Undo2, Ban, AlertTriangle } from 'lucide-react';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState, useFullChatThreadsStreamState } from '../../util/services.js';
import { ChatMarkdownRender, ChatMessageLocation } from '../../markdown/ChatMarkdownRender.js';
import { ChatMessage, CheckpointEntry, PlanMessage, ReviewMessage, PlanStep, StepStatus, PlanApprovalState } from '../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolName, ToolName } from '../../../../common/toolsServiceTypes.js';
import { isABuiltinToolName } from '../../../../common/prompt/prompts.js';
import ErrorBoundary from '../ErrorBoundary.js';
import { IconLoading, TypingCursor } from '../shared/icons.js';
import { getBasename, voidOpenFileFn } from '../shared/pathUtils.js';
import { AssistantMessageComponent, ProseWrapper, ReasoningWrapper, SmallProseWrapper } from './proseWrappers.js';
import { UserMessageComponent } from './UserMessageComponent.js';
import { builtinToolNameToComponent, CanceledTool, InvalidTool, SimplifiedToolHeader, ResultWrapper } from '../tools/ToolRenderers.js';

const Checkpoint = ({ message, threadId, messageIdx, isCheckpointGhost, threadIsRunning }: { message: CheckpointEntry, threadId: string; messageIdx: number, isCheckpointGhost: boolean, threadIsRunning: boolean }) => {
	const accessor = useAccessor()
	const chatThreadService = accessor.get('IChatThreadService')
	const streamState = useFullChatThreadsStreamState()

	// Subscribe to thread state changes properly
	const chatThreadsState = useChatThreadsState()

	const isRunning = useChatThreadsStreamState(threadId)?.isRunning
	const isDisabled = useMemo(() => {
		if (isRunning) return true
		// Use Object.values().some() instead of Object.keys().find() for better performance
		return Object.values(streamState).some(threadState => threadState?.isRunning)
	}, [isRunning, streamState])

	// Memoize message count lookup to avoid direct state access in render
	const threadMessagesLength = chatThreadsState.allThreads[threadId]?.messages.length ?? 0

	return <div
		className={`flex items-center justify-center px-2 `}
	>
		<div
			className={`
                    text-xs
                    text-void-fg-3
                    select-none
                    ${isCheckpointGhost ? 'opacity-50' : 'opacity-100'}
					${isDisabled ? 'cursor-default' : 'cursor-pointer'}
                `}
			style={{ position: 'relative', display: 'inline-block' }} // allow absolute icon
			onClick={() => {
				if (threadIsRunning) return
				if (isDisabled) return
				chatThreadService.jumpToCheckpointBeforeMessageIdx({
					threadId,
					messageIdx,
					jumpToUserModified: messageIdx === threadMessagesLength - 1
				})
			}}
			{...isDisabled ? {
				'data-tooltip-id': 'cortex-tooltip',
				'data-tooltip-content': `Disabled ${isRunning ? 'when running' : 'because another thread is running'}`,
				'data-tooltip-place': 'top',
			} : {}}
		>
			Checkpoint
		</div>
	</div>
}


type ChatBubbleMode = 'display' | 'edit'
export type ChatBubbleProps = {
	chatMessage: ChatMessage,
	messageIdx: number,
	isCommitted: boolean,
	chatIsRunning: IsRunningType,
	threadId: string,
	currCheckpointIdx: number | undefined,
	_scrollToBottom: (() => void) | null,
}

// Plan Component - Shows structured execution plan as a todo list
const PlanComponent = React.memo(({ message, isCheckpointGhost, threadId, messageIdx }: { message: PlanMessage, isCheckpointGhost: boolean, threadId: string, messageIdx: number }) => {
	const accessor = useAccessor()
	const chatThreadService = accessor.get('IChatThreadService')
	const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
	const [isCollapsed, setIsCollapsed] = useState(false)

	// Subscribe to thread state changes properly
	const chatThreadsState = useChatThreadsState()
    const approvalState = message.approvalState || 'pending'
    const isRunning = useChatThreadsStreamState(threadId)?.isRunning
    const isBusy = isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'preparing'
    const isIdleLike = isRunning === undefined || isRunning === 'idle'

	// Get thread messages with proper subscription
	const thread = chatThreadsState.allThreads[threadId]
	const threadMessages = thread?.messages ?? []

	// Memoize tool message lookup map for O(1) access instead of O(n) searches
	const toolMessagesMap = useMemo(() => {
		const map = new Map<string, ToolMessage<any>>()
		for (const msg of threadMessages) {
			if (msg.role === 'tool') {
				const toolMsg = msg as ToolMessage<any>
				map.set(toolMsg.id, toolMsg)
			}
		}
		return map
	}, [threadMessages])

	// Calculate progress - memoize to avoid recalculating on every render
	const totalSteps = message.steps.length
	const completedSteps = useMemo(() =>
		message.steps.filter(s => s.status === 'succeeded' || s.status === 'skipped').length
	, [message.steps])
	const progressText = useMemo(() =>
		`${completedSteps} of ${totalSteps} ${totalSteps === 1 ? 'Step' : 'Steps'} Completed`
	, [completedSteps, totalSteps])

	// Memoize hasPausedSteps to avoid recalculating on every render
	const hasPausedSteps = useMemo(() =>
		message.steps.some(s => s.status === 'paused')
	, [message.steps])

	const getCheckmarkIcon = (status?: StepStatus, isDisabled?: boolean) => {
		if (isDisabled) {
			return <div className="w-5 h-5 rounded-full border-2 border-void-fg-4 flex items-center justify-center opacity-40" />
		}

		switch (status) {
			case 'succeeded':
				return (
					<div className="w-5 h-5 rounded-full border-2 border-[var(--cortex-success)] bg-[var(--cortex-success)]/20 flex items-center justify-center">
						<Check size={12} className="text-[var(--cortex-success)]" strokeWidth={3} />
					</div>
				)
			case 'failed':
				return (
					<div className="w-5 h-5 rounded-full border-2 border-[var(--cortex-danger)] bg-[var(--cortex-danger)]/20 flex items-center justify-center">
						<X size={12} className="text-[var(--cortex-danger)]" strokeWidth={3} />
					</div>
				)
			case 'running':
				return (
					<div className="w-5 h-5 rounded-full border-2 border-yellow-500 bg-yellow-500/20 flex items-center justify-center">
						<CircleEllipsis size={12} className="text-yellow-400 animate-spin" />
					</div>
				)
			case 'paused':
				return (
					<div className="w-5 h-5 rounded-full border-2 border-orange-500 bg-orange-500/20 flex items-center justify-center">
						<Dot size={12} className="text-orange-400" />
					</div>
				)
			case 'skipped':
				return (
					<div className="w-5 h-5 rounded-full border-2 border-gray-500 bg-gray-500/20 flex items-center justify-center opacity-60">
						<Ban size={12} className="text-gray-400" />
					</div>
				)
			default: // queued
				return (
					<div className="w-5 h-5 rounded-full border-2 border-void-fg-3 flex items-center justify-center">
						<div className="w-1.5 h-1.5 rounded-full bg-void-fg-3 opacity-60" />
					</div>
				)
		}
	}

	const toggleStepExpanded = (stepNumber: number) => {
		setExpandedSteps(prev => {
			const next = new Set(prev)
			if (next.has(stepNumber)) {
				next.delete(stepNumber)
			} else {
				next.add(stepNumber)
			}
			return next
		})
	}

    const handleApprove = () => {
        if (isCheckpointGhost || isBusy) return
		chatThreadService.approvePlan({ threadId, messageIdx })
	}

	const handleReject = () => {
        if (isCheckpointGhost || isBusy) return
		chatThreadService.rejectPlan({ threadId, messageIdx })
	}

	const handleToggleStep = (stepNumber: number) => {
        if (isCheckpointGhost || isBusy) return
		chatThreadService.toggleStepDisabled({ threadId, messageIdx, stepNumber })
	}

	const getStatusBadge = (status?: StepStatus) => {
		switch (status) {
			case 'running':
				return <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Running</span>
			case 'failed':
				return <span className="px-1.5 py-0.5 text-xs rounded bg-[var(--cortex-danger)]/20 text-[var(--cortex-danger)] border border-[var(--cortex-danger)]/30">Failed</span>
			case 'paused':
				return <span className="px-1.5 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">Paused</span>
			case 'skipped':
				return <span className="px-1.5 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">Skipped</span>
			default:
				return null
		}
	}

	return (
		<div className={`${isCheckpointGhost ? 'opacity-50 pointer-events-none' : ''} my-3`}>
			<div className="bg-void-bg-1 border border-void-border-1 rounded-lg overflow-hidden">
				{/* Header */}
				<div className="px-4 py-3 border-b border-void-border-1 bg-void-bg-2/30">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 flex-1 min-w-0">
							<button
								type='button'
								onClick={() => setIsCollapsed(!isCollapsed)}
								className="flex-shrink-0 p-1 hover:bg-void-bg-2 rounded transition-colors"
								disabled={isCheckpointGhost}
								aria-expanded={!isCollapsed}
								aria-label={isCollapsed ? 'Expand plan' : 'Collapse plan'}
							>
								<ChevronRight
									size={16}
									className={`text-void-fg-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
								/>
							</button>
							<div className="flex items-center gap-2 flex-1 min-w-0">
								<h3 className="text-void-fg-1 font-medium text-sm truncate">{message.summary}</h3>
								{approvalState === 'pending' && (
									<span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex-shrink-0">
										Pending Approval
									</span>
								)}
								{approvalState === 'executing' && (
									<span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 flex-shrink-0">
										<CircleEllipsis size={12} className="animate-spin" />
										Executing
									</span>
								)}
								{approvalState === 'completed' && (
									<span className="px-2 py-0.5 text-xs rounded bg-[var(--cortex-success)]/20 text-[var(--cortex-success)] border border-[var(--cortex-success)]/30 flex items-center gap-1 flex-shrink-0">
										<Check size={12} />
										Completed
									</span>
								)}
							</div>
						</div>

						{!isCollapsed && (
							<div className="flex items-center gap-3 flex-shrink-0">
								<span className="text-void-fg-3 text-xs" aria-live="polite">{progressText}</span>
                                {approvalState === 'pending' && isIdleLike && (
									<div className="flex gap-2">
										<button
											title="Reject plan"
									aria-label="Reject plan"
											onClick={handleReject}
											className="px-3 py-1.5 text-xs rounded bg-[var(--cortex-danger)]/10 text-[var(--cortex-danger)] border border-[var(--cortex-danger)]/20 hover:bg-[var(--cortex-danger)]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--cortex-danger)]/40"
										>
											Reject
										</button>
										<button
											title="Approve and execute"
									aria-label="Approve and execute plan"
											onClick={handleApprove}
											className="px-3 py-1.5 text-xs rounded bg-[var(--cortex-success)]/10 text-[var(--cortex-success)] border border-[var(--cortex-success)]/20 hover:bg-[var(--cortex-success)]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--cortex-success)]/40"
										>
											Approve & Execute
										</button>
									</div>
								)}
							{approvalState === 'executing' && isBusy && (
								<button
									aria-label="Pause plan execution"
										onClick={() => chatThreadService.pauseAgentExecution({ threadId })}
										className="px-3 py-1.5 text-xs rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/40"
									>
										Pause
									</button>
								)}
							{hasPausedSteps && !isBusy && (
								<button
									aria-label="Resume plan execution"
										onClick={() => chatThreadService.resumeAgentExecution({ threadId })}
										className="px-3 py-1.5 text-xs rounded bg-[var(--cortex-success)]/10 text-[var(--cortex-success)] border border-[var(--cortex-success)]/20 hover:bg-[var(--cortex-success)]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--cortex-success)]/40"
									>
										Resume
									</button>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Todo List */}
				{!isCollapsed && (
					<div className="py-2">
						{message.steps.map((step, idx) => {
							const isExpanded = expandedSteps.has(step.stepNumber)
							const isDisabled = step.disabled
							const status = step.status || 'queued'
							const hasDetails = step.tools || step.files || step.error || step.toolCalls

							return (
								<div
									key={step.stepNumber}
									className={`flex items-start gap-3 px-4 py-2.5 hover:bg-void-bg-2/30 transition-colors ${
										isDisabled ? 'opacity-50' : ''
									} ${status === 'failed' ? 'bg-[var(--cortex-danger)]/5' : ''}`}
								>
									{/* Checkmark */}
									<div className="flex-shrink-0 mt-0.5">
										{getCheckmarkIcon(status, isDisabled)}
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-3">
											<p className={`text-void-fg-1 text-sm flex-1 leading-relaxed ${
												isDisabled ? 'line-through text-void-fg-3' : ''
											} ${status === 'succeeded' ? 'text-void-fg-2' : ''}`}>
												{step.description}
											</p>

											{/* Status Badge */}
											{getStatusBadge(status)}
										</div>

										{/* Actions Row */}
										{(approvalState === 'pending' || (approvalState === 'executing' && status === 'failed')) && !isCheckpointGhost && (
											<div className="flex items-center gap-2 mt-2">
												{approvalState === 'pending' && !isRunning && (
										<button
											aria-label={`${isDisabled ? 'Enable' : 'Disable'} step ${step.stepNumber}`}
														onClick={() => handleToggleStep(step.stepNumber)}
														className="px-2 py-0.5 text-xs rounded bg-void-bg-2 text-void-fg-2 hover:bg-void-bg-2/80 border border-void-border-1 transition-colors"
													>
														{isDisabled ? 'Enable' : 'Disable'}
													</button>
												)}
									{approvalState === 'executing' && status === 'failed' && (
													<>
											<button
												aria-label={`Retry step ${step.stepNumber}`}
															onClick={() => chatThreadService.retryStep({ threadId, messageIdx, stepNumber: step.stepNumber })}
															className="px-2 py-0.5 text-xs rounded bg-[var(--cortex-success)]/10 text-[var(--cortex-success)] hover:bg-[var(--cortex-success)]/20 border border-[var(--cortex-success)]/20 transition-colors"
														>
															Retry
														</button>
											<button
												aria-label={`Skip step ${step.stepNumber}`}
															onClick={() => chatThreadService.skipStep({ threadId, messageIdx, stepNumber: step.stepNumber })}
															className="px-2 py-0.5 text-xs rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 border border-gray-500/20 transition-colors"
														>
															Skip
														</button>
														{step.checkpointIdx !== undefined && step.checkpointIdx !== null && (
								<button
									aria-label={`Rollback step ${step.stepNumber}`}
									onClick={() => { if (confirm('Rollback to the checkpoint before this step?')) chatThreadService.rollbackToStep({ threadId, messageIdx, stepNumber: step.stepNumber }) }}
																className="px-2 py-0.5 text-xs rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
															>
																Rollback
															</button>
														)}
													</>
												)}
											</div>
										)}

										{/* Expandable Details */}
										{hasDetails && (
											<button
												type='button'
												onClick={() => toggleStepExpanded(step.stepNumber)}
												className="mt-2 flex items-center gap-1 text-void-fg-3 hover:text-void-fg-2 text-xs transition-colors"
												aria-expanded={isExpanded}
												aria-label={isExpanded ? `Hide details for step ${step.stepNumber}` : `Show details for step ${step.stepNumber}`}
											>
												<ChevronRight
													size={12}
													className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
												/>
												<span>{isExpanded ? 'Hide' : 'Show'} details</span>
											</button>
										)}

										{/* Expanded Content */}
										{isExpanded && hasDetails && (
											<div className="mt-3 space-y-3 pt-3 border-t border-void-border-1">
												{step.tools && step.tools.length > 0 && (
													<div>
														<div className="text-void-fg-3 text-xs mb-2 font-medium">Expected Tools:</div>
														<div className="flex flex-wrap gap-1.5">
															{step.tools.map((tool, i) => (
																<span key={`${step.stepNumber}-tool-${tool}-${i}`} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded border border-blue-500/20">
																	{tool}
																</span>
															))}
														</div>
													</div>
												)}
												{step.toolCalls && step.toolCalls.length > 0 && (
													<div>
											<div className="text-void-fg-3 text-xs mb-2 font-medium flex items-center gap-2">Tool Calls Executed <span className="inline-flex items-center justify-center rounded-full bg-void-bg-2 text-void-fg-3 text-[10px] px-1.5 py-0.5 border border-void-border-1">{step.toolCalls.length}</span></div>
														<div className="space-y-1.5">
															{step.toolCalls.map((toolId, i) => {
																// Use memoized map for O(1) lookup instead of O(n) find
																const toolMsg = toolMessagesMap.get(toolId)
																if (!toolMsg) return null

																const isSuccess = toolMsg.type === 'success'
																const isError = toolMsg.type === 'tool_error'

																return (
																	<div key={toolId} className={`p-2 rounded border text-xs ${
																		isSuccess ? 'bg-[var(--cortex-success)]/10 border-[var(--cortex-success)]/20' :
																		isError ? 'bg-[var(--cortex-danger)]/10 border-[var(--cortex-danger)]/20' :
																		'bg-blue-500/10 border-blue-500/20'
																	}`}>
																		<div className="flex items-center justify-between mb-1">
																			<span className="font-medium text-void-fg-1">{toolMsg.name}</span>
																			{isSuccess && <Check size={12} className="text-[var(--cortex-success)]" />}
																			{isError && <X size={12} className="text-[var(--cortex-danger)]" />}
																		</div>
																		{isError && toolMsg.result && (
																			<div className="mt-1 text-[var(--cortex-danger)] text-xs">
																				{toolMsg.result}
																			</div>
																		)}
																		{isSuccess && toolMsg.result && (
																			<details className="mt-1">
																				<summary className="text-void-fg-3 cursor-pointer text-xs hover:text-void-fg-2">View result</summary>
																				<pre className="mt-1 p-2 bg-void-bg-2 rounded text-xs overflow-auto max-h-32 border border-void-border-1">
																					{typeof toolMsg.result === 'string'
																						? toolMsg.result
																						: JSON.stringify(toolMsg.result, null, 2)}
																				</pre>
																			</details>
																		)}
																		{isError && toolMsg.params && (
																			<details className="mt-1">
																				<summary className="text-void-fg-3 cursor-pointer text-xs hover:text-void-fg-2">View params</summary>
																				<pre className="mt-1 p-2 bg-void-bg-2 rounded text-xs overflow-auto max-h-32 border border-void-border-1">
																					{JSON.stringify(toolMsg.params, null, 2)}
																				</pre>
																			</details>
																		)}
																	</div>
																)
															})}
														</div>
													</div>
												)}
												{step.files && step.files.length > 0 && (
													<div>
														<div className="text-void-fg-3 text-xs mb-2 font-medium">Files Affected:</div>
														<div className="flex flex-wrap gap-1.5">
															{step.files.map((file, i) => (
																<span key={`${file}-${i}`} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded border border-purple-500/20 flex items-center gap-1">
																	<File size={12} />
																	{file.split('/').pop()}
																</span>
															))}
														</div>
													</div>
												)}
												{step.error && (
													<div className="p-2 bg-[var(--cortex-danger)]/10 border border-[var(--cortex-danger)]/20 rounded text-[var(--cortex-danger)] text-xs flex items-start gap-2">
														<AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
														<span>{step.error}</span>
													</div>
												)}
												{(step.startTime && step.endTime) && (
													<div className="text-void-fg-3 text-xs">
														Duration: {((step.endTime - step.startTime) / 1000).toFixed(1)}s
													</div>
												)}
												{step.checkpointIdx !== undefined && step.checkpointIdx !== null && (
													<div className="text-void-fg-3 text-xs">
														Checkpoint: #{step.checkpointIdx}
													</div>
												)}
											</div>
										)}
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>
		</div>
	);
}, (prev, next) => {
	// Custom comparison: only re-render if plan message, checkpoint state, or thread changes
	return prev.message === next.message &&
		prev.isCheckpointGhost === next.isCheckpointGhost &&
		prev.threadId === next.threadId &&
		prev.messageIdx === next.messageIdx
});

// Review Component - Shows summary after execution
const ReviewComponent = ({ message, isCheckpointGhost }: { message: ReviewMessage, isCheckpointGhost: boolean }) => {
	return (
		<div className={`${isCheckpointGhost ? 'opacity-50' : ''} my-2`}>
			<div className={`border rounded-lg p-4 ${
				message.completed
					? 'bg-[var(--cortex-success)]/10 border-[var(--cortex-success)]/30'
					: 'bg-[var(--cortex-warning)]/10 border-[var(--cortex-warning)]/30'
			}`}>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						{message.completed ? (
							<Check className="text-[var(--cortex-success)]" size={18} />
						) : (
							<AlertTriangle className="text-[var(--cortex-warning)]" size={18} />
						)}
						<h3 className={`font-semibold text-sm ${
							message.completed ? 'text-green-300' : 'text-amber-300'
						}`}>
							{message.completed ? 'Review Complete' : 'Review: Issues Found'}
						</h3>
					</div>
					{(message.executionTime || message.stepsCompleted !== undefined) && (
						<div className="text-xs text-void-fg-3">
							{message.executionTime && `${(message.executionTime / 1000).toFixed(1)}s`}
							{message.stepsCompleted !== undefined && message.stepsTotal !== undefined && (
								<span className="ml-2">
									{message.stepsCompleted}/{message.stepsTotal} steps
								</span>
							)}
						</div>
					)}
				</div>
				<p className="text-void-fg-2 text-sm mb-3">{message.summary}</p>

				{message.filesChanged && message.filesChanged.length > 0 && (
					<div className="mb-3">
						<h4 className="text-void-fg-2 text-xs font-semibold mb-2">Files Changed:</h4>
						<div className="space-y-1">
							{message.filesChanged.map((file, i) => (
								<div key={file.path || i} className="flex items-center gap-2 text-xs">
									{file.changeType === 'created' && <CirclePlus className="text-[var(--cortex-success)]" size={12} />}
									{file.changeType === 'modified' && <Pencil className="text-blue-400" size={12} />}
									{file.changeType === 'deleted' && <X className="text-[var(--cortex-danger)]" size={12} />}
									<span className="text-void-fg-2">{file.path}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{message.issues && message.issues.length > 0 && (
					<div className="space-y-2 mb-3">
						{message.issues.map((issue, i) => (
							<div key={`${issue.severity}-${i}`} className={`flex gap-2 text-sm p-2 rounded ${
								issue.severity === 'error' ? 'bg-[var(--cortex-danger)]/10 border border-[var(--cortex-danger)]/20' :
								issue.severity === 'warning' ? 'bg-[var(--cortex-warning)]/10 border border-[var(--cortex-warning)]/20' :
								'bg-blue-500/10 border border-blue-500/20'
							}`}>
								{issue.severity === 'error' ? (
									<X className="text-[var(--cortex-danger)] flex-shrink-0 mt-0.5" size={16} />
								) : issue.severity === 'warning' ? (
									<AlertTriangle className="text-[var(--cortex-warning)] flex-shrink-0 mt-0.5" size={16} />
								) : (
									<Info className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
								)}
								<div className="flex-1">
									<p className={`${
										issue.severity === 'error' ? 'text-red-300' :
										issue.severity === 'warning' ? 'text-amber-300' :
										'text-blue-300'
									}`}>
										{issue.message}
									</p>
									{issue.file && (
										<p className="text-void-fg-3 text-xs mt-1 flex items-center gap-1">
											<File size={12} />
											{issue.file}
										</p>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{message.nextSteps && message.nextSteps.length > 0 && (
					<div className="mt-3 pt-3 border-t border-void-border-2">
						<p className="text-void-fg-3 text-xs mb-2 font-medium">Recommended Next Steps:</p>
						<ul className="space-y-1">
							{message.nextSteps.map((step, i) => (
								<li key={`step-${i}`} className="text-void-fg-2 text-xs flex items-start gap-2">
									<span className="text-void-fg-4 mt-1">•</span>
									<span>{step}</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
};

const ChatBubble = React.memo((props: ChatBubbleProps) => {
	return <ErrorBoundary>
		<div className="message-enter">
			<_ChatBubble {...props} />
		</div>
	</ErrorBoundary>
}, (prev, next) => {
	// Custom comparison: only re-render if props actually changed
	return prev.chatMessage === next.chatMessage &&
		prev.messageIdx === next.messageIdx &&
		prev.isCommitted === next.isCommitted &&
		prev.chatIsRunning === next.chatIsRunning &&
		prev.currCheckpointIdx === next.currCheckpointIdx &&
		prev.threadId === next.threadId &&
		prev._scrollToBottom === next._scrollToBottom
})

const _ChatBubble = React.memo(({ threadId, chatMessage, currCheckpointIdx, isCommitted, messageIdx, chatIsRunning, _scrollToBottom }: ChatBubbleProps) => {
	const role = chatMessage.role

	const isCheckpointGhost = messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning // whether to show as gray (if chat is running, for good measure just dont show any ghosts)

	if (role === 'user') {
		return <UserMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			currCheckpointIdx={currCheckpointIdx}
			messageIdx={messageIdx}
			_scrollToBottom={_scrollToBottom}
		/>
	}
	else if (role === 'assistant') {
		return <AssistantMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			messageIdx={messageIdx}
			isCommitted={isCommitted}
		/>
	}
	else if (role === 'tool') {

		if (chatMessage.type === 'invalid_params') {
			return <div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
				<InvalidTool toolName={chatMessage.name} message={chatMessage.content} mcpServerName={chatMessage.mcpServerName} />
			</div>
		}

		const toolName = chatMessage.name
		const isBuiltInTool = isABuiltinToolName(toolName)
		const ToolResultWrapper = isBuiltInTool ? builtinToolNameToComponent[toolName]?.resultWrapper as ResultWrapper<ToolName>
			: MCPToolWrapper as ResultWrapper<ToolName>

		if (ToolResultWrapper)
			return <>
				<div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
					<ToolResultWrapper
						toolMessage={chatMessage}
						messageIdx={messageIdx}
						threadId={threadId}
					/>
				</div>
				{chatMessage.type === 'tool_request' ?
					<div className={`${isCheckpointGhost ? 'opacity-50 pointer-events-none' : ''}`}>
						<ToolRequestAcceptRejectButtons toolName={chatMessage.name} />
					</div> : null}
			</>
		return null
	}

	else if (role === 'interrupted_streaming_tool') {
		return <div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
			<CanceledTool toolName={chatMessage.name} mcpServerName={chatMessage.mcpServerName} />
		</div>
	}

	else if (role === 'checkpoint') {
		return <Checkpoint
			threadId={threadId}
			message={chatMessage}
			messageIdx={messageIdx}
			isCheckpointGhost={isCheckpointGhost}
			threadIsRunning={!!chatIsRunning}
		/>
	}

	else if (role === 'plan') {
		return <PlanComponent
			message={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			threadId={threadId}
			messageIdx={messageIdx}
		/>
	}

	else if (role === 'review') {
		return <ReviewComponent
			message={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
		/>
	}

}, (prev, next) => {
	// Custom comparison for _ChatBubble
	return prev.chatMessage === next.chatMessage &&
		prev.messageIdx === next.messageIdx &&
		prev.isCommitted === next.isCommitted &&
		prev.chatIsRunning === next.chatIsRunning &&
		prev.currCheckpointIdx === next.currCheckpointIdx &&
		prev.threadId === next.threadId &&
		prev._scrollToBottom === next._scrollToBottom
})


export { ChatBubble };
