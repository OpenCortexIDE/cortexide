/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsState, useAccessor, useCtrlKZoneStreamingState } from '../util/services.js';
import { TextAreaFns, VoidInputBox2 } from '../util/inputs.js';
import { QuickEditPropsType } from '../../../quickEditActions.js';
import { ButtonStop, ButtonSubmit, IconX, VoidChatArea } from '../sidebar-tsx/SidebarChat.js';
import { CORTEXIDE_CTRL_K_ACTION_ID } from '../../../actionIDs.js';
import { useRefState } from '../util/helpers.js';
import { isFeatureNameDisabled } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js';




export const QuickEditChat = ({
	diffareaid,
	onChangeHeight,
	onChangeText: onChangeText_,
	textAreaRef: textAreaRef_,
	initText
}: QuickEditPropsType) => {

	const accessor = useAccessor()
	const editCodeService = accessor.get('IEditCodeService')
	const sizerRef = useRef<HTMLDivElement | null>(null)
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const textAreaFnsRef = useRef<TextAreaFns | null>(null)

	useEffect(() => {
		const inputContainer = sizerRef.current
		if (!inputContainer) return;
		// only observing 1 element
		let resizeObserver: ResizeObserver | undefined
		resizeObserver = new ResizeObserver((entries) => {
			if (!entries[0]) return;

			// borderBoxSize might not be available in all browsers or might be undefined
			// Fall back to contentRect if borderBoxSize is not available
			let height: number;

			if (entries[0].borderBoxSize && entries[0].borderBoxSize.length > 0) {
				height = entries[0].borderBoxSize[0].blockSize;
			} else if (entries[0].contentRect) {
				// Fallback to contentRect for older browsers
				height = entries[0].contentRect.height;
			} else {
				// Last resort: use target's client dimensions
				const target = entries[0].target as HTMLElement;
				height = target.clientHeight;
			}

			onChangeHeight(height)
		})
		resizeObserver.observe(inputContainer);
		return () => { resizeObserver?.disconnect(); };
	}, [onChangeHeight]);


	const settingsState = useSettingsState()

	// state of current message
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(!(initText ?? '')) // the user's instructions
	const isDisabled = instructionsAreEmpty || !!isFeatureNameDisabled('Ctrl+K', settingsState)


	const [isStreamingRef, setIsStreamingRef] = useRefState(editCodeService.isCtrlKZoneStreaming({ diffareaid }))
	useCtrlKZoneStreamingState(useCallback((diffareaid2, isStreaming) => {
		if (diffareaid !== diffareaid2) return
		setIsStreamingRef(isStreaming)
	}, [diffareaid, setIsStreamingRef]))

	const loadingIcon = <div
		className="@@codicon @@codicon-loading @@codicon-modifier-spin @@codicon-no-default-spin text-void-fg-3"
	/>

	const onSubmit = useCallback(async () => {
		if (isDisabled) return
		if (isStreamingRef.current) return
		textAreaFnsRef.current?.disable()

		const opts = {
			from: 'QuickEdit',
			diffareaid,
			startBehavior: 'keep-conflicts',
		} as const

		await editCodeService.callBeforeApplyOrEdit(opts)
		const [newApplyingUri, applyDonePromise] = editCodeService.startApplying(opts) ?? []
		// catch any errors by interrupting the stream
		applyDonePromise?.catch(e => { if (newApplyingUri) editCodeService.interruptCtrlKStreaming({ diffareaid }) })


	}, [isStreamingRef, isDisabled, editCodeService, diffareaid])

	const onInterrupt = useCallback(() => {
		if (!isStreamingRef.current) return
		editCodeService.interruptCtrlKStreaming({ diffareaid })
		textAreaFnsRef.current?.enable()
	}, [isStreamingRef, editCodeService])


	const onX = useCallback(() => {
		onInterrupt()
		editCodeService.removeCtrlKZone({ diffareaid })
	}, [editCodeService, diffareaid])

	const keybindingString = accessor.get('IKeybindingService').lookupKeybinding(CORTEXIDE_CTRL_K_ACTION_ID)?.getLabel()

	const chatAreaRef = useRef<HTMLDivElement | null>(null)
	return <div ref={sizerRef} style={{ maxWidth: 450 }} className={`py-2 w-full`}>
		<VoidChatArea
			featureName='Ctrl+K'
			divRef={chatAreaRef}
			onSubmit={onSubmit}
			onAbort={onInterrupt}
			onClose={onX}
			isStreaming={isStreamingRef.current}
			loadingIcon={loadingIcon}
			isDisabled={isDisabled}
			onClickAnywhere={() => { textAreaRef.current?.focus() }}
		>
			<VoidInputBox2
				className='px-1'
				initValue={initText}
				ref={useCallback((r: HTMLTextAreaElement | null) => {
					textAreaRef.current = r
					textAreaRef_(r)
					r?.addEventListener('keydown', (e) => {
						if (e.key === 'Escape')
							onX()
					})
				}, [textAreaRef_, onX])}
				fnsRef={textAreaFnsRef}
				placeholder="Enter instructions..."
				onChangeText={useCallback((newStr: string) => {
					setInstructionsAreEmpty(!newStr)
					onChangeText_(newStr)
				}, [onChangeText_])}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						onSubmit()
						return
					}
				}}
				multiline={true}
			/>
		</VoidChatArea>
	</div>


}
