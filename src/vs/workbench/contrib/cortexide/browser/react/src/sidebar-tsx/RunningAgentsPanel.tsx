/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *
 *  Running agents panel (R7) — lists background agents (description + status), lets the user cancel a
 *  running one or clear finished ones. Renders nothing when there are no background agents, so it is
 *  invisible in normal use. Subscribes to IBackgroundAgentsService via useBackgroundAgentsState.
 *--------------------------------------------------------------------------------------*/

import { useAccessor, useBackgroundAgentsState } from '../util/services.js'
import ErrorBoundary from './ErrorBoundary.js'
import { BackgroundAgentStatus } from '../../../../common/backgroundAgentsServiceTypes.js'

const STATUS_LABEL: Record<BackgroundAgentStatus, string> = {
	running: 'Running',
	completed: 'Done',
	error: 'Error',
	cancelled: 'Cancelled',
}

export const RunningAgentsPanel = () => {
	const accessor = useAccessor()
	const backgroundAgentsService = accessor.get('IBackgroundAgentsService')
	const state = useBackgroundAgentsState()

	if (!state.agents.length) { return null }
	const anyFinished = state.agents.some(a => a.status !== 'running')

	return <ErrorBoundary>
		<div className='w-full px-3 py-2 bg-void-bg-2 text-void-fg-1 border-b border-void-bg-3'>
			<div className='flex items-center justify-between mb-1'>
				<span className='text-xs uppercase tracking-wide opacity-60'>Running agents</span>
				{anyFinished
					? <button className='text-xs opacity-60 hover:opacity-100' onClick={() => backgroundAgentsService.clearFinished()}>Clear finished</button>
					: null}
			</div>
			<div className='flex flex-col gap-1'>
				{state.agents.map(a => (
					<div key={a.id} className='flex items-center justify-between gap-2 text-sm'>
						<span className='truncate' title={a.resultSummary || a.error || a.description}>
							<span className='opacity-50 mr-1'>[{STATUS_LABEL[a.status]}]</span>{a.description}
						</span>
						{a.status === 'running'
							? <button className='text-xs flex-shrink-0 opacity-70 hover:opacity-100 hover:underline' onClick={() => backgroundAgentsService.cancel(a.id)}>Cancel</button>
							: null}
					</div>
				))}
			</div>
		</div>
	</ErrorBoundary>
}
