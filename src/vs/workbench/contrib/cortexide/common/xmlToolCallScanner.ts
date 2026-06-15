/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { endsWithAnyPrefixOf, SurroundingsRemover } from './helpers/extractCodeFromResult.js'
import type { InternalToolInfo } from './prompt/prompts.js'
import type { RawToolCallObj, RawToolParamsObj } from './sendLLMMessageTypes.js'
import type { ToolName, ToolParamName } from './toolsServiceTypes.js'

/**
 * The streaming XML tool-call scanner, extracted VERBATIM from electron-main extractGrammar.ts's
 * extractXMLToolsWrapper so it is node-testable. Models that lack native function-calling (every local
 * model in practice, and several cloud ones in agent mode) emit tool calls as XML text in the message
 * stream; this scanner is what turns that into a structured RawToolCallObj while hiding the markup from
 * the user-visible text. It is load-bearing for agentic use on local models, so its partial-tag
 * buffering, first-tag latching, and never-throw-on-malformed-markup behavior are pinned here.
 *
 * The scanner is a small state machine fed the FULL accumulated text on each streamed chunk (push), the
 * same contract the wrapper's onText uses. extractGrammar.ts keeps the onText/onFinalMessage plumbing and
 * the tool-set resolution (availableTools) and just delegates to push()/trimAndGetFinal().
 */

const findPartiallyWrittenToolTagAtEnd = (fullText: string, toolTags: string[]) => {
	for (const toolTag of toolTags) {
		const foundPrefix = endsWithAnyPrefixOf(fullText, toolTag)
		if (foundPrefix) {
			return [foundPrefix, toolTag] as const
		}
	}
	return false
}

const findIndexOfAny = (fullText: string, matches: string[]) => {
	for (const str of matches) {
		const idx = fullText.indexOf(str);
		if (idx !== -1) {
			return [idx, str] as const
		}
	}
	return null
}

export type ToolOfToolName = { [toolName: string]: InternalToolInfo | undefined }

const parseXMLPrefixToToolCall = <T extends ToolName,>(toolName: T, toolId: string, str: string, toolOfToolName: ToolOfToolName): RawToolCallObj => {
	const paramsObj: RawToolParamsObj = {}
	const doneParams: ToolParamName<T>[] = []
	let isDone = false

	const getAnswer = (): RawToolCallObj => {
		// trim off all whitespace at and before first \n and after last \n for each param
		for (const p in paramsObj) {
			const paramName = p as ToolParamName<T>
			const orig = paramsObj[paramName]
			if (orig === undefined) continue
			paramsObj[paramName] = trimBeforeAndAfterNewLines(orig)
		}

		// return tool call
		const ans: RawToolCallObj = {
			name: toolName,
			rawParams: paramsObj,
			doneParams: doneParams,
			isDone: isDone,
			id: toolId,
		}
		return ans
	}

	// find first toolName tag
	const openToolTag = `<${toolName}>`
	let i = str.indexOf(openToolTag)
	if (i === -1) return getAnswer()
	let j = str.lastIndexOf(`</${toolName}>`)
	if (j === -1) j = Infinity
	else isDone = true


	str = str.substring(i + openToolTag.length, j)

	const pm = new SurroundingsRemover(str)

	const allowedParams = Object.keys(toolOfToolName[toolName]?.params ?? {}) as ToolParamName<T>[]
	if (allowedParams.length === 0) return getAnswer()
	let latestMatchedOpenParam: null | ToolParamName<T> = null
	let n = 0
	while (true) {
		n += 1
		if (n > 10) return getAnswer() // just for good measure as this code is early

		// find the param name opening tag
		let matchedOpenParam: null | ToolParamName<T> = null
		for (const paramName of allowedParams) {
			const removed = pm.removeFromStartUntilFullMatch(`<${paramName}>`, true)
			if (removed) {
				matchedOpenParam = paramName
				break
			}
		}
		// if did not find a new param, stop
		if (matchedOpenParam === null) {
			if (latestMatchedOpenParam !== null) {
				paramsObj[latestMatchedOpenParam] += pm.value()
			}
			return getAnswer()
		}
		else {
			latestMatchedOpenParam = matchedOpenParam
		}

		paramsObj[latestMatchedOpenParam] = ''

		// find the param name closing tag
		let matchedCloseParam: boolean = false
		let paramContents = ''
		for (const paramName of allowedParams) {
			const i = pm.i
			const closeTag = `</${paramName}>`
			const removed = pm.removeFromStartUntilFullMatch(closeTag, true)
			if (removed) {
				const i2 = pm.i
				paramContents = pm.originalS.substring(i, i2 - closeTag.length)
				matchedCloseParam = true
				break
			}
		}
		// if did not find a new close tag, stop
		if (!matchedCloseParam) {
			paramsObj[latestMatchedOpenParam] += pm.value()
			return getAnswer()
		}
		else {
			doneParams.push(latestMatchedOpenParam)
		}

		paramsObj[latestMatchedOpenParam] += paramContents
	}
}

// trim all whitespace up until the first newline, and all whitespace up until the last newline
const trimBeforeAndAfterNewLines = (s: string) => {
	if (!s) return s;

	const firstNewLineIndex = s.indexOf('\n');

	if (firstNewLineIndex !== -1 && s.substring(0, firstNewLineIndex).trim() === '') {
		s = s.substring(firstNewLineIndex + 1, Infinity)
	}

	const lastNewLineIndex = s.lastIndexOf('\n');
	if (lastNewLineIndex !== -1 && s.substring(lastNewLineIndex + 1, Infinity).trim() === '') {
		s = s.substring(0, lastNewLineIndex)
	}

	return s
}

export interface XmlToolScanResult {
	/** The user-visible text, with the detected tool-call markup (and any trailing partial tag) removed. */
	readonly displayText: string
	/** The tool call parsed so far (grows as more of the stream arrives), or undefined if none detected yet. */
	readonly toolCall: RawToolCallObj | undefined
}

export interface XmlToolCallScanner {
	/** Feed the FULL accumulated text seen so far (same as the wrapper's onText param.fullText). */
	push(accumulatedFullText: string): XmlToolScanResult
	/** End of stream: trim the display text and return the final result (call AFTER a final push). */
	trimAndGetFinal(): XmlToolScanResult
}

/**
 * Build a stateful scanner over a known tool set. `toolId` is injected (the wrapper passes generateUuid())
 * so the scanner stays pure/deterministic. Byte-identical to the inline closure in extractXMLToolsWrapper.
 */
export function createXmlToolCallScanner(tools: InternalToolInfo[], toolId: string): XmlToolCallScanner {
	const toolOfToolName: ToolOfToolName = {}
	const toolOpenTags = tools.map(t => `<${t.name}>`)
	for (const t of tools) { toolOfToolName[t.name] = t }

	// detect <availableTools[0]></availableTools[0]>, etc
	let fullText = '';
	let trueFullText = ''
	let latestToolCall: RawToolCallObj | undefined = undefined

	let foundOpenTag: { idx: number, toolName: ToolName } | null = null
	let openToolTagBuffer = '' // the characters we've seen so far that come after a < with no space afterwards, not yet added to fullText

	let prevFullTextLen = 0

	const push = (accumulatedFullText: string): XmlToolScanResult => {
		const newText = accumulatedFullText.substring(prevFullTextLen)
		prevFullTextLen = accumulatedFullText.length
		trueFullText = accumulatedFullText

		if (foundOpenTag === null) {
			const newFullText = openToolTagBuffer + newText
			// ensure the code below doesn't run if only half a tag has been written
			const isPartial = findPartiallyWrittenToolTagAtEnd(newFullText, toolOpenTags)
			if (isPartial) {
				openToolTagBuffer += newText
			}
			// if no tooltag is partially written at the end, attempt to get the index
			else {
				// we will instantly retroactively remove this if it's a tag match
				fullText += openToolTagBuffer
				openToolTagBuffer = ''
				fullText += newText

				const i = findIndexOfAny(fullText, toolOpenTags)
				if (i !== null) {
					const [idx, toolTag] = i
					const toolName = toolTag.substring(1, toolTag.length - 1) as ToolName
					foundOpenTag = { idx, toolName }

					// do not count anything at or after i in fullText
					fullText = fullText.substring(0, idx)
				}
			}
		}

		// toolTagIdx is not null, so parse the XML
		if (foundOpenTag !== null) {
			latestToolCall = parseXMLPrefixToToolCall(
				foundOpenTag.toolName,
				toolId,
				trueFullText.substring(foundOpenTag.idx, Infinity),
				toolOfToolName,
			)
		}

		return { displayText: fullText, toolCall: latestToolCall }
	}

	const trimAndGetFinal = (): XmlToolScanResult => {
		fullText = fullText.trimEnd()
		return { displayText: fullText, toolCall: latestToolCall }
	}

	return { push, trimAndGetFinal }
}
