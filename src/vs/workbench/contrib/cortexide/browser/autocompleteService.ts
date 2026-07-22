/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { EndOfLinePreference, ITextModel } from '../../../../editor/common/model.js';
import { Position } from '../../../../editor/common/core/position.js';
import { InlineCompletion, } from '../../../../editor/common/languages.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { EditorResourceAccessor } from '../../../common/editor.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { extractCodeFromRegular } from '../common/helpers/extractCodeFromResult.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { isWindows } from '../../../../base/common/platform.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { FeatureName } from '../common/cortexideSettingsTypes.js';
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js';
import { getPerformanceHarness } from '../common/performanceHarness.js';
import { isLocalProvider } from './convertToLLMMessageService.js';
import { IModelWarmupService } from '../common/modelWarmupService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';



const allLinebreakSymbols = ['\r\n', '\n'];
const _ln = isWindows ? allLinebreakSymbols[0] : allLinebreakSymbols[1];

// Original autocomplete extension reference: https://github.com/OpenCortexIDE/cortexide


/*
A summary of autotab:

Postprocessing
-one common problem for all models is outputting unbalanced parentheses
we solve this by trimming all extra closing parentheses from the generated string
in future, should make sure parentheses are always balanced

-another problem is completing the middle of a string, eg. "const [x, CURSOR] = useState()"
we complete up to first matchup character
but should instead complete the whole line / block (difficult because of parenthesis accuracy)

-too much info is bad. usually we want to show the user 1 line, and have a preloaded response afterwards
this should happen automatically with caching system
should break preloaded responses into \n\n chunks

Preprocessing
- we don't generate if cursor is at end / beginning of a line (no spaces)
- we generate 1 line if there is text to the right of cursor
- we generate 1 line if variable declaration
- (in many cases want to show 1 line but generate multiple)

State
- cache based on prefix (and do some trimming first)
- when press tab on one line, should have an immediate followup response
to do this, show autocompletes before they're fully finished
- [todo] remove each autotab when accepted
!- [todo] provide type information

Details
-generated results are trimmed up to 1 leading/trailing space
-prefixes are cached up to 1 trailing newline
-
*/

class LRUCache<K, V> {
	public items: Map<K, V>;
	private keyOrder: K[];
	private maxSize: number;
	private disposeCallback?: (value: V, key?: K) => void;

	constructor(maxSize: number, disposeCallback?: (value: V, key?: K) => void) {
		if (maxSize <= 0) {
			throw new Error('Cache size must be greater than 0');
		}

		this.items = new Map();
		this.keyOrder = [];
		this.maxSize = maxSize;
		this.disposeCallback = disposeCallback;
	}

	set(key: K, value: V): void {
		// If key exists, remove it from the order list
		if (this.items.has(key)) {
			this.keyOrder = this.keyOrder.filter(k => k !== key);
		}
		// If cache is full, remove least recently used item
		else if (this.items.size >= this.maxSize) {
			const key = this.keyOrder[0];
			const value = this.items.get(key);

			// Call dispose callback if it exists
			if (this.disposeCallback && value !== undefined) {
				this.disposeCallback(value, key);
			}

			this.items.delete(key);
			this.keyOrder.shift();
		}

		// Add new item
		this.items.set(key, value);
		this.keyOrder.push(key);
	}

	delete(key: K): boolean {
		const value = this.items.get(key);

		if (value !== undefined) {
			// Remove from cache first, then call dispose callback
			// This prevents the callback from seeing the item as still in cache
			this.items.delete(key);
			this.keyOrder = this.keyOrder.filter(k => k !== key);

			// Call dispose callback if it exists (after removal to avoid issues)
			if (this.disposeCallback) {
				this.disposeCallback(value, key);
			}

			return true;
		}

		return false;
	}

	clear(): void {
		// Call dispose callback for all items if it exists
		if (this.disposeCallback) {
			for (const [key, value] of this.items.entries()) {
				this.disposeCallback(value, key);
			}
		}

		this.items.clear();
		this.keyOrder = [];
	}

	get size(): number {
		return this.items.size;
	}

	has(key: K): boolean {
		return this.items.has(key);
	}
}

type AutocompletionPredictionType =
	| 'single-line-fill-middle'
	| 'single-line-redo-suffix'
	// | 'multi-line-start-here'
	| 'multi-line-start-on-next-line'
	| 'do-not-predict';

type Autocompletion = {
	id: number;
	prefix: string;
	suffix: string;
	llmPrefix: string;
	llmSuffix: string;
	startTime: number;
	endTime: number | undefined;
	status: 'pending' | 'finished' | 'error';
	type: AutocompletionPredictionType;
	llmPromise: Promise<string> | undefined;
	insertText: string;
	requestId: string | null;
	_newlineCount: number;
};

const DEBOUNCE_TIME = 250; // Reduced from 500ms for better responsiveness
const TIMEOUT_TIME = 15000; // Reduced from 60s to 15s for autocomplete
const MAX_CACHE_SIZE = 20;
const MAX_PENDING_REQUESTS = 2;

// Detect if text contains syntax from a different programming language
const detectLanguageMismatch = (text: string, expectedLanguage: string): boolean => {
	const trimmed = text.trim();
	if (!trimmed) return false;

	// Language-specific syntax patterns
	const languagePatterns: Record<string, RegExp[]> = {
		javascript: [
			/^def\s+\w+\s*\(/,           // Python function definition
			/^class\s+\w+:/,              // Python class (but JS has classes too, so be careful)
			/^import\s+\w+\s+from/,      // Python import (but JS has this too)
			/self\./,                     // Python self
			/__init__/,                   // Python __init__
			/print\s*\(/,                 // Python print (but JS console.log is more common)
		],
		typescript: [
			/^def\s+\w+\s*\(/,           // Python function definition
			/^class\s+\w+:/,             // Python class
			/self\./,                     // Python self
			/__init__/,                   // Python __init__
		],
		python: [
			/function\s+\w+\s*\(/,       // JavaScript function
			/const\s+\w+\s*=\s*\(/,      // JavaScript arrow function
			/let\s+\w+\s*=\s*\(/,        // JavaScript let
			/var\s+\w+\s*=\s*\(/,        // JavaScript var
			/console\.log/,              // JavaScript console.log
			/=>\s*{/,                    // JavaScript arrow function
		],
		java: [
			/^def\s+\w+\s*\(/,           // Python function
			/function\s+\w+\s*\(/,       // JavaScript function
			/self\./,                     // Python self
		],
	};

	const patterns = languagePatterns[expectedLanguage];
	if (!patterns) return false;

	// Check if text contains syntax from a different language
	for (const pattern of patterns) {
		if (pattern.test(trimmed)) {
			return true; // Language mismatch detected
		}
	}

	return false;
};

// Filter out non-code content from autocomplete results
// This helps prevent models from outputting explanatory text, comments in other languages, etc.
const filterNonCodeContent = (text: string, languageId?: string): string => {
	// Remove lines that are mostly non-ASCII characters (likely explanations or non-code)
	// But keep code that might legitimately contain Unicode (e.g., string literals, comments)
	const lines = text.split('\n');
	const filteredLines: string[] = [];

	for (const line of lines) {
		// Remove Chinese/Japanese/Korean characters from comments (common issue)
		// Pattern: code followed by // or /* with non-ASCII characters
		const hasNonAsciiInComment = /\/\/.*[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(line) ||
		                              /\/\*.*[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af].*\*\//.test(line);

		if (hasNonAsciiInComment) {
			// Remove the comment part, keep only the code
			const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
			if (codeOnly) {
				filteredLines.push(codeOnly);
			}
			continue;
		}

		// Skip lines that are mostly non-ASCII characters (likely explanations)
		// But allow if it's clearly code (has operators, brackets, etc.)
		const nonAsciiRatio = (line.match(/[^\x00-\x7F]/g) || []).length / Math.max(line.length, 1);
		const hasCodeIndicators = /[{}()\[\];=+\-*\/<>]/.test(line);

		// If line is mostly non-ASCII and doesn't have code indicators, skip it
		if (nonAsciiRatio > 0.5 && !hasCodeIndicators) {
			continue;
		}

		// Check for language mismatch if language is known
		if (languageId && detectLanguageMismatch(line, languageId)) {
			continue; // Skip lines with wrong language syntax
		}

		filteredLines.push(line);
	}

	const result = filteredLines.join('\n');
	// If filtering removed everything, keep the raw model output (issue #27).
	return result || text;
};

// postprocesses the result
const processStartAndEndSpaces = (result: string) => {

	// trim all whitespace except for a single leading/trailing space
	// return result.trim()

	[result,] = extractCodeFromRegular({ text: result, recentlyAddedTextLen: result.length });

	const hasLeadingSpace = result.startsWith(' ');
	const hasTrailingSpace = result.endsWith(' ');

	return (hasLeadingSpace ? ' ' : '')
		+ result.trim()
		+ (hasTrailingSpace ? ' ' : '');

};


// trims the end of the prefix to improve cache hit rate
const removeLeftTabsAndTrimEnds = (s: string): string => {
	const trimmedString = s.trimEnd();
	const trailingEnd = s.slice(trimmedString.length);

	// keep only a single trailing newline
	if (trailingEnd.includes(_ln)) {
		s = trimmedString + _ln;
	}

	s = s.replace(/^\s+/gm, ''); // remove left tabs

	return s;
};



const removeAllWhitespace = (str: string): string => str.replace(/\s+/g, '');



function getIsSubsequence({ of, subsequence }: { of: string; subsequence: string }): [boolean, string] {
	if (subsequence.length === 0) {
		return [true, ''];
	}
	if (of.length === 0) {
		return [false, ''];
	}

	let subsequenceIndex = 0;
	let lastMatchChar = '';

	for (let i = 0; i < of.length; i++) {
		if (of[i] === subsequence[subsequenceIndex]) {
			lastMatchChar = of[i];
			subsequenceIndex++;
		}
		if (subsequenceIndex === subsequence.length) {
			return [true, lastMatchChar];
		}
	}

	return [false, lastMatchChar];
}


function getStringUpToUnbalancedClosingParenthesis(s: string, prefix: string): string {

	const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };

	// process all bracets in prefix
	const stack: string[] = [];
	const firstOpenIdx = prefix.search(/[[({]/);
	if (firstOpenIdx !== -1) {
		const brackets = prefix.slice(firstOpenIdx).split('').filter(c => '()[]{}'.includes(c));

		for (const bracket of brackets) {
			if (bracket === '(' || bracket === '{' || bracket === '[') {
				stack.push(bracket);
			} else {
				if (stack.length > 0 && stack[stack.length - 1] === pairs[bracket]) {
					stack.pop();
				} else {
					stack.push(bracket);
				}
			}
		}
	}

	// iterate through each character
	for (let i = 0; i < s.length; i++) {
		const char = s[i];

		if (char === '(' || char === '{' || char === '[') { stack.push(char); }
		else if (char === ')' || char === '}' || char === ']') {
			if (stack.length === 0 || stack.pop() !== pairs[char]) { return s.substring(0, i); }
		}
	}
	return s;
}


// further trim the autocompletion
const postprocessAutocompletion = ({ autocompletionMatchup, autocompletion, prefixAndSuffix }: { autocompletionMatchup: AutocompletionMatchupBounds; autocompletion: Autocompletion; prefixAndSuffix: PrefixAndSuffixInfo }) => {

	const { prefix, prefixToTheLeftOfCursor, suffixToTheRightOfCursor } = prefixAndSuffix;

	const generatedMiddle = autocompletion.insertText;

	let startIdx = autocompletionMatchup.startIdx;
	let endIdx = generatedMiddle.length; // exclusive bounds

	// const naiveReturnValue = generatedMiddle.slice(startIdx)
	// console.log('naiveReturnValue: ', JSON.stringify(naiveReturnValue))
	// return [{ insertText: naiveReturnValue, }]

	// do postprocessing for better ux
	// this is a bit hacky but may change a lot

	// if there is space at the start of the completion and user has added it, remove it
	const charToLeftOfCursor = prefixToTheLeftOfCursor.slice(-1)[0] || '';
	const userHasAddedASpace = charToLeftOfCursor === ' ' || charToLeftOfCursor === '\t';
	const rawFirstNonspaceIdx = generatedMiddle.slice(startIdx).search(/[^\t ]/);
	if (rawFirstNonspaceIdx > -1 && userHasAddedASpace) {
		const firstNonspaceIdx = rawFirstNonspaceIdx + startIdx;
		// console.log('p0', startIdx, rawFirstNonspaceIdx)
		startIdx = Math.max(startIdx, firstNonspaceIdx);
	}

	// if user is on a blank line and the generation starts with newline(s), remove them
	const numStartingNewlines = generatedMiddle.slice(startIdx).match(new RegExp(`^${_ln}+`))?.[0].length || 0;
	if (
		!prefixToTheLeftOfCursor.trim()
		&& !suffixToTheRightOfCursor.trim()
		&& numStartingNewlines > 0
	) {
		// console.log('p1', numStartingNewlines)
		startIdx += numStartingNewlines;
	}

	// if the generated FIM text matches with the suffix on the current line, stop
	if (autocompletion.type === 'single-line-fill-middle' && suffixToTheRightOfCursor.trim()) { // completing in the middle of a line
		// complete until there is a match
		const rawMatchIndex = generatedMiddle.slice(startIdx).lastIndexOf(suffixToTheRightOfCursor.trim()[0]);
		if (rawMatchIndex > -1) {
			// console.log('p2', rawMatchIndex, startIdx, suffixToTheRightOfCursor.trim()[0], 'AAA', generatedMiddle.slice(startIdx))
			const matchIdx = rawMatchIndex + startIdx;
			const matchChar = generatedMiddle[matchIdx];
			if (`{}()[]<>\`'"`.includes(matchChar)) {
				endIdx = Math.min(endIdx, matchIdx);
			}
		}
	}

	const restOfLineToGenerate = generatedMiddle.slice(startIdx).split(_ln)[0] ?? '';
	// condition to complete as a single line completion
	if (
		prefixToTheLeftOfCursor.trim()
		&& !suffixToTheRightOfCursor.trim()
		&& restOfLineToGenerate.trim()
	) {

		const rawNewlineIdx = generatedMiddle.slice(startIdx).indexOf(_ln);
		if (rawNewlineIdx > -1) {
			// console.log('p3', startIdx, rawNewlineIdx)
			const newlineIdx = rawNewlineIdx + startIdx;
			endIdx = Math.min(endIdx, newlineIdx);
		}
	}

	// // if a generated line matches with a suffix line, stop
	// if (suffixLines.length > 1) {
	// 	console.log('4')
	// 	const lines = []
	// 	for (const generatedLine of generatedLines) {
	// 		if (suffixLines.slice(0, 10).some(suffixLine =>
	// 			generatedLine.trim() !== '' && suffixLine.trim() !== ''
	// 			&& generatedLine.trim().startsWith(suffixLine.trim())
	// 		)) break;
	// 		lines.push(generatedLine)
	// 	}
	// 	endIdx = lines.join('\n').length // this is hacky, remove or refactor in future
	// }

	// console.log('pFinal', startIdx, endIdx)
	let completionStr = generatedMiddle.slice(startIdx, endIdx);

	// filter out unbalanced parentheses
	completionStr = getStringUpToUnbalancedClosingParenthesis(completionStr, prefix);
	// console.log('originalCompletionStr: ', JSON.stringify(generatedMiddle.slice(startIdx)))
	// console.log('finalCompletionStr: ', JSON.stringify(completionStr))


	return completionStr;

}

// returns the text in the autocompletion to display, assuming the prefix is already matched
const toInlineCompletions = ({ autocompletionMatchup, autocompletion, prefixAndSuffix, position, debug }: { autocompletionMatchup: AutocompletionMatchupBounds; autocompletion: Autocompletion; prefixAndSuffix: PrefixAndSuffixInfo; position: Position; debug?: boolean }): { insertText: string; range: Range }[] => {

	let trimmedInsertText = postprocessAutocompletion({ autocompletionMatchup, autocompletion, prefixAndSuffix, });
	let rangeToReplace: Range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);

	// handle special cases

	// if we redid the suffix, replace the suffix
	if (autocompletion.type === 'single-line-redo-suffix') {

		const oldSuffix = prefixAndSuffix.suffixToTheRightOfCursor;
		const newSuffix = autocompletion.insertText;

		const [isSubsequence, lastMatchingChar] = getIsSubsequence({ // check that the old text contains the same brackets + symbols as the new text
			subsequence: removeAllWhitespace(oldSuffix), // old suffix
			of: removeAllWhitespace(newSuffix), // new suffix
		});
		if (isSubsequence) {
			rangeToReplace = new Range(position.lineNumber, position.column, position.lineNumber, Number.MAX_SAFE_INTEGER);
		}
		else {

			const lastMatchupIdx = trimmedInsertText.lastIndexOf(lastMatchingChar);
			trimmedInsertText = trimmedInsertText.slice(0, lastMatchupIdx + 1);
			const numCharsToReplace = oldSuffix.lastIndexOf(lastMatchingChar) + 1;
			rangeToReplace = new Range(position.lineNumber, position.column, position.lineNumber, position.column + numCharsToReplace);
			// console.log('show____', trimmedInsertText, rangeToReplace)
		}
	}

	return [{
		insertText: trimmedInsertText,
		range: rangeToReplace,
	}];

}





// returns whether this autocompletion is in the cache
// const doesPrefixMatchAutocompletion = ({ prefix, autocompletion }: { prefix: string, autocompletion: Autocompletion }): boolean => {

// 	const originalPrefix = autocompletion.prefix
// 	const generatedMiddle = autocompletion.result
// 	const originalPrefixTrimmed = trimPrefix(originalPrefix)
// 	const currentPrefixTrimmed = trimPrefix(prefix)

// 	if (currentPrefixTrimmed.length < originalPrefixTrimmed.length) {
// 		return false
// 	}

// 	const isMatch = (originalPrefixTrimmed + generatedMiddle).startsWith(currentPrefixTrimmed)
// 	return isMatch

// }


type PrefixAndSuffixInfo = { prefix: string; suffix: string; prefixLines: string[]; suffixLines: string[]; prefixToTheLeftOfCursor: string; suffixToTheRightOfCursor: string };
const getPrefixAndSuffixInfo = (model: ITextModel, position: Position): PrefixAndSuffixInfo => {

	const fullText = model.getValue(EndOfLinePreference.LF);

	const cursorOffset = model.getOffsetAt(position);
	const prefix = fullText.substring(0, cursorOffset);
	const suffix = fullText.substring(cursorOffset);


	const prefixLines = prefix.split(_ln);
	const suffixLines = suffix.split(_ln);

	const prefixToTheLeftOfCursor = prefixLines.slice(-1)[0] ?? '';
	const suffixToTheRightOfCursor = suffixLines[0] ?? '';

	return { prefix, suffix, prefixLines, suffixLines, prefixToTheLeftOfCursor, suffixToTheRightOfCursor };

}

const getIndex = (str: string, line: number, char: number) => {
	return str.split(_ln).slice(0, line).join(_ln).length + (line > 0 ? 1 : 0) + char;
}
const getLastLine = (s: string): string => {
	const matches = s.match(new RegExp(`[^${_ln}]*$`));
	return matches ? matches[0] : '';
}

type AutocompletionMatchupBounds = {
	startLine: number;
	startCharacter: number;
	startIdx: number;
};
// returns the startIdx of the match if there is a match, or undefined if there is no match
// all results are wrt `autocompletion.result`
const getAutocompletionMatchup = ({ prefix, autocompletion }: { prefix: string; autocompletion: Autocompletion }): AutocompletionMatchupBounds | undefined => {

	const trimmedCurrentPrefix = removeLeftTabsAndTrimEnds(prefix);
	const trimmedCompletionPrefix = removeLeftTabsAndTrimEnds(autocompletion.prefix);
	const trimmedCompletionMiddle = removeLeftTabsAndTrimEnds(autocompletion.insertText);

	// console.log('@result: ', JSON.stringify(autocompletion.insertText))
	// console.log('@trimmedCurrentPrefix: ', JSON.stringify(trimmedCurrentPrefix))
	// console.log('@trimmedCompletionPrefix: ', JSON.stringify(trimmedCompletionPrefix))
	// console.log('@trimmedCompletionMiddle: ', JSON.stringify(trimmedCompletionMiddle))

	if (trimmedCurrentPrefix.length < trimmedCompletionPrefix.length) { // user must write text beyond the original prefix at generation time
		// console.log('@undefined1')
		return undefined
	}

	if ( // check that completion starts with the prefix
		!(trimmedCompletionPrefix + trimmedCompletionMiddle)
			.startsWith(trimmedCurrentPrefix)
	) {
		// console.log('@undefined2')
		return undefined
	}

	// reverse map to find position wrt `autocompletion.result`
	const lineStart =
		trimmedCurrentPrefix.split(_ln).length -
		trimmedCompletionPrefix.split(_ln).length;

	if (lineStart < 0) {
		// console.log('@undefined3')
		console.warn('[Autocomplete] Matchup calculation failed: No line found. This may occur if the prefix changed significantly.');
		return undefined;
	}
	const currentPrefixLine = getLastLine(trimmedCurrentPrefix)
	const completionPrefixLine = lineStart === 0 ? getLastLine(trimmedCompletionPrefix) : ''
	const completionMiddleLine = autocompletion.insertText.split(_ln)[lineStart]
	const fullCompletionLine = completionPrefixLine + completionMiddleLine

	// console.log('currentPrefixLine', currentPrefixLine)
	// console.log('completionPrefixLine', completionPrefixLine)
	// console.log('completionMiddleLine', completionMiddleLine)

	const charMatchIdx = fullCompletionLine.indexOf(currentPrefixLine)
	if (charMatchIdx < 0) {
		// console.log('@undefined4', charMatchIdx)
		console.warn('[Autocomplete] Matchup calculation failed: Character match not found. Prefix may have changed significantly.');
		return undefined
	}

	const character = (charMatchIdx +
		currentPrefixLine.length
		- completionPrefixLine.length
	)

	const startIdx = getIndex(autocompletion.insertText, lineStart, character)

	return {
		startLine: lineStart,
		startCharacter: character,
		startIdx,
	}


}


type CompletionOptions = {
	predictionType: AutocompletionPredictionType;
	shouldGenerate: boolean;
	llmPrefix: string;
	llmSuffix: string;
	stopTokens: string[];
};
const getCompletionOptions = (prefixAndSuffix: PrefixAndSuffixInfo, relevantContext: string, justAcceptedAutocompletion: boolean, isLocalProvider: boolean = false): CompletionOptions => {

	let { prefix, suffix, prefixToTheLeftOfCursor, suffixToTheRightOfCursor, suffixLines, prefixLines } = prefixAndSuffix;

	// trim prefix and suffix to not be very large
	// For local providers, use smaller limits (10-15 lines) to reduce token count before FIM token capping
	// This helps local models respond faster by reducing input size
	const maxLines = isLocalProvider ? 12 : 25 // 12 lines for local (conservative), 25 for cloud
	suffixLines = suffix.split(_ln).slice(0, maxLines);
	prefixLines = prefix.split(_ln).slice(-maxLines);
	prefix = prefixLines.join(_ln);
	suffix = suffixLines.join(_ln);

	let completionOptions: CompletionOptions;

	// if line is empty, do multiline completion
	const isLineEmpty = !prefixToTheLeftOfCursor.trim() && !suffixToTheRightOfCursor.trim();
	const isLinePrefixEmpty = removeAllWhitespace(prefixToTheLeftOfCursor).length === 0;
	const isLineSuffixEmpty = removeAllWhitespace(suffixToTheRightOfCursor).length === 0;

	// TODO add context to prefix
	// llmPrefix = '\n\n/* Relevant context:\n' + relevantContext + '\n*/\n' + llmPrefix

	// if we just accepted an autocompletion, predict a multiline completion starting on the next line
	if (justAcceptedAutocompletion && isLineSuffixEmpty) {
		const prefixWithNewline = prefix + _ln;
		completionOptions = {
			predictionType: 'multi-line-start-on-next-line',
			shouldGenerate: true,
			llmPrefix: prefixWithNewline,
			llmSuffix: suffix,
			stopTokens: [`${_ln}${_ln}`] // double newlines
		};
	}
	// if the current line is empty, predict a single-line completion
	else if (isLineEmpty) {
		completionOptions = {
			predictionType: 'single-line-fill-middle',
			shouldGenerate: true,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: allLinebreakSymbols
		};
	}
	// if suffix is 3 or fewer characters, attempt to complete the line ignorning it
	else if (removeAllWhitespace(suffixToTheRightOfCursor).length <= 3) {
		const suffixLinesIgnoringThisLine = suffixLines.slice(1);
		const suffixStringIgnoringThisLine = suffixLinesIgnoringThisLine.length === 0 ? '' : _ln + suffixLinesIgnoringThisLine.join(_ln);
		completionOptions = {
			predictionType: 'single-line-redo-suffix',
			shouldGenerate: true,
			llmPrefix: prefix,
			llmSuffix: suffixStringIgnoringThisLine,
			stopTokens: allLinebreakSymbols
		};
	}
	// else attempt to complete the middle of the line if there is a prefix (the completion looks bad if there is no prefix)
	else if (!isLinePrefixEmpty) {
		completionOptions = {
			predictionType: 'single-line-fill-middle',
			shouldGenerate: true,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: allLinebreakSymbols
		};
	} else {
		completionOptions = {
			predictionType: 'do-not-predict',
			shouldGenerate: false,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: []
		};
	}

	return completionOptions;

}

export interface IAutocompleteService {
	readonly _serviceBrand: undefined;
}

export const IAutocompleteService = createDecorator<IAutocompleteService>('AutocompleteService');

export class AutocompleteService extends Disposable implements IAutocompleteService {

	static readonly ID = 'void.autocompleteService'

	_serviceBrand: undefined;

	private _autocompletionId: number = 0;
	private _autocompletionsOfDocument: { [docUriStr: string]: LRUCache<number, Autocompletion> } = {}

	private _lastCompletionStart = 0
	private _lastCompletionAccept = 0
	private _hasShownNoModelWarning = false
	// private _lastPrefix: string = ''

	// used internally by vscode
	// fires after every keystroke and returns the completion to show
	async _provideInlineCompletionItems(
		model: ITextModel,
		position: Position,
	): Promise<InlineCompletion[]> {
		const startTime = performance.now();
		const isEnabled = this._settingsService.state.globalSettings.enableAutocomplete
		if (!isEnabled) {
			console.debug('[Autocomplete] Disabled in settings. Enable it in CortexIDE Settings > Feature Options > Autocomplete')
			return []
		}

		// Performance optimization: Early returns for long lines or binary files
		const lineLength = model.getValueLengthInRange(new Range(1, 1, position.lineNumber, position.column));
		if (lineLength > 500) {
			// Skip autocomplete for very long lines (>500 chars)
			console.debug('[Autocomplete] Skipped: Line too long (>500 chars)')
			return [];
		}

		// Performance optimization: Gate by language (skip non-code files)
		const languageId = model.getLanguageId();
		const codeLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'cs', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'dart'];
		if (!codeLanguages.includes(languageId)) {
			console.debug(`[Autocomplete] Skipped: Language "${languageId}" not supported. Supported: ${codeLanguages.join(', ')}`)
			return [];
		}

		const docUriStr = model.uri.fsPath;

		const prefixAndSuffix = getPrefixAndSuffixInfo(model, position)
		const { prefix, suffix } = prefixAndSuffix

		// initialize cache if it doesnt exist
		// note that whenever an autocompletion is accepted, it is removed from cache
		if (!this._autocompletionsOfDocument[docUriStr]) {
			this._autocompletionsOfDocument[docUriStr] = new LRUCache<number, Autocompletion>(
				MAX_CACHE_SIZE,
				(autocompletion: Autocompletion) => {
					// Only abort if request is still pending (don't abort finished or accepted requests)
					// This prevents aborting requests that have already completed successfully or been accepted
					if (autocompletion.status === 'pending' && autocompletion.requestId) {
						console.debug(`[Autocomplete] Aborting request ${autocompletion.id} due to cache eviction`)
						this._llmMessageService.abort(autocompletion.requestId)
					}
					// If status is 'finished' or 'error', the request is already done, so no need to abort
				}
			)
		}
		// this._lastPrefix = prefix

		// print all pending autocompletions
		// let _numPending = 0
		// this._autocompletionsOfDocument[docUriStr].items.forEach((a: Autocompletion) => { if (a.status === 'pending') _numPending += 1 })
		// console.log('@numPending: ' + _numPending)

		// get autocompletion from cache
		let cachedAutocompletion: Autocompletion | undefined = undefined
		let autocompletionMatchup: AutocompletionMatchupBounds | undefined = undefined
		for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
			// if the user's change matches with the autocompletion
			autocompletionMatchup = getAutocompletionMatchup({ prefix, autocompletion })
			if (autocompletionMatchup !== undefined) {
				cachedAutocompletion = autocompletion
				break;
			}
		}

		// if there is a cached autocompletion, return it
		if (cachedAutocompletion && autocompletionMatchup) {
			const providerStartTime = performance.now();

			if (cachedAutocompletion.status === 'finished') {
				const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: cachedAutocompletion, prefixAndSuffix, position, debug: true })

				// Record performance metrics (cache hit)
				const providerTime = performance.now() - providerStartTime;
				const totalTime = performance.now() - startTime;
				this._recordAutocompleteMetrics(providerTime, totalTime, true);

				return inlineCompletions

			} else if (cachedAutocompletion.status === 'pending') {
				try {
					await cachedAutocompletion.llmPromise;
					const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: cachedAutocompletion, prefixAndSuffix, position })

					// Record performance metrics (cache hit, but had to wait)
					const providerTime = performance.now() - providerStartTime;
					const totalTime = performance.now() - startTime;
					this._recordAutocompleteMetrics(providerTime, totalTime, true);

					return inlineCompletions

				} catch (e) {
					this._autocompletionsOfDocument[docUriStr].delete(cachedAutocompletion.id)
					const errorMessage = e instanceof Error ? e.message : String(e)
					console.error('[Autocomplete] Error with cached autocompletion:', errorMessage)
					// Don't show notification for cached completion errors (less critical)
				}

			} else if (cachedAutocompletion.status === 'error') {
				// Error state, skip
			}

			return []
		}

		// else if no more typing happens, then go forwards with the request

		// Performance optimization: Configurable debounce (default 35ms, fallback to DEBOUNCE_TIME)
		const perfSettings = this._settingsService.state.globalSettings.perf;
		const debounceMs = perfSettings?.autoCompleteDebounceMs ?? DEBOUNCE_TIME;

		// wait debounce time for the user to stop typing
		const thisTime = Date.now()

		const justAcceptedAutocompletion = thisTime - this._lastCompletionAccept < 500

		this._lastCompletionStart = thisTime
		const didTypingHappenDuringDebounce = await new Promise<boolean>((resolve) =>
			setTimeout(() => {
				if (this._lastCompletionStart === thisTime) {
					resolve(false)
				} else {
					resolve(true)
				}
			}, debounceMs)
		)

		// if more typing happened, then do not go forwards with the request
		if (didTypingHappenDuringDebounce) {
			return []
		}


		// if there are too many pending requests, cancel the oldest one
		// But only cancel if we're about to create a new one (not if we're just checking cache)
		let numPending = 0
		let oldestPending: Autocompletion | undefined = undefined
		for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
			if (autocompletion.status === 'pending') {
				numPending += 1
				if (oldestPending === undefined) {
					oldestPending = autocompletion
				}
			}
		}

		// Only cancel if we have too many pending AND we're about to create a new request
		// (This check happens after we've already checked the cache, so we know we need a new request)
		if (numPending >= MAX_PENDING_REQUESTS && oldestPending) {
			// cancel the oldest pending request and remove it from cache
			console.debug(`[Autocomplete] Cancelling oldest pending request (${oldestPending.id}) to make room for new one`)
			this._autocompletionsOfDocument[docUriStr].delete(oldestPending.id)
		}


		// gather relevant context from the code around the user's selection and definitions
		// const relevantSnippetsList = await this._contextGatheringService.readCachedSnippets(model, position, 3);
		// const relevantSnippetsList = this._contextGatheringService.getCachedSnippets();
		// const relevantSnippets = relevantSnippetsList.map((text) => `${text}`).join('\n-------------------------------\n')
		// console.log('@@---------------------\n' + relevantSnippets)
		const relevantContext = ''

		// Detect if using local provider for prefix/suffix optimization
		const featureName: FeatureName = 'Autocomplete'
		const modelSelection = this._settingsService.resolveAutoModelSelection(
			this._settingsService.state.modelSelectionOfFeature[featureName]
		)

		if (!modelSelection || modelSelection.providerName === 'auto') {
			// No model available - skip autocomplete
			// Only show notification once per session to avoid spam
			if (!this._hasShownNoModelWarning) {
				this._hasShownNoModelWarning = true
				this._notificationService.warn('Autocomplete requires a model with FIM (Fill-In-the-Middle) support. Please select a model in CortexIDE Settings > Feature Options > Autocomplete. Cloud options: Mistral codestral-latest. Local options: Ollama qwen2.5-coder.')
			}
			return []
		}

		const isLocal = isLocalProvider(modelSelection.providerName, this._settingsService.state.settingsOfProvider)

		const { shouldGenerate, predictionType, llmPrefix, llmSuffix, stopTokens } = getCompletionOptions(prefixAndSuffix, relevantContext, justAcceptedAutocompletion, isLocal)

		if (!shouldGenerate) {
			console.debug('[Autocomplete] Skipped: shouldGenerate=false (likely cursor position or context not suitable for completion)')
			return []
		}



		// create a new autocompletion and add it to cache
		const newAutocompletion: Autocompletion = {
			id: this._autocompletionId++,
			prefix: prefix, // the actual prefix and suffix
			suffix: suffix,
			llmPrefix: llmPrefix, // the prefix and suffix the llm sees
			llmSuffix: llmSuffix,
			startTime: Date.now(),
			endTime: undefined,
			type: predictionType,
			status: 'pending',
			llmPromise: undefined,
			insertText: '',
			requestId: null,
			_newlineCount: 0,
		}


		const overridesOfModel = this._settingsService.state.overridesOfModel
		// Model selection is already resolved above, so we can safely access options
		const modelSelectionOptions = this._settingsService.state.optionsOfModelSelection[featureName]?.[modelSelection.providerName]?.[modelSelection.modelName]

		// Warm up local model in background (fire-and-forget, doesn't block)
		this._modelWarmupService.warmupModelIfNeeded(modelSelection.providerName, modelSelection.modelName, featureName)

		// set parameters of `newAutocompletion` appropriately
		newAutocompletion.llmPromise = new Promise((resolve, reject) => {

			// Get language ID to pass to FIM preparation (proper fix - tells model what language to generate)
			const languageId = model.getLanguageId();

			const requestId = this._llmMessageService.sendLLMMessage({
				messagesType: 'FIMMessage',
				messages: this._convertToLLMMessageService.prepareFIMMessage({
					messages: {
						prefix: llmPrefix,
						suffix: llmSuffix,
						stopTokens: stopTokens,
					},
					modelSelection,
					featureName,
					languageId, // Pass language to help model generate correct code
				}),
				modelSelection,
				modelSelectionOptions,
				overridesOfModel,
				logging: { loggingName: 'Autocomplete' },
				onText: ({ fullText }) => {
					// Update autocompletion text as it streams in for incremental UI updates
					// This allows local models to show completions as they generate, improving perceived responsiveness
					try {
						// Process the streamed text (same processing as final message)
						const [text, _] = extractCodeFromRegular({ text: fullText, recentlyAddedTextLen: 0 })

						// Filter out non-code content and wrong language syntax
						const languageId = model.getLanguageId();
						const filteredText = filterNonCodeContent(text, languageId)

						const processedText = processStartAndEndSpaces(filteredText)

						// Update the autocompletion with partial text
						// Note: This doesn't trigger UI refresh automatically, but ensures the final result is ready
						// The UI will update when the promise resolves or when VS Code re-requests completions
						newAutocompletion.insertText = processedText

						// Count newlines for safety (prevent excessive multiline completions)
						const numNewlines = (fullText.match(/\n|\r\n/g) || []).length
						newAutocompletion._newlineCount = numNewlines

						// Safety: If too many newlines during streaming, we could truncate, but let's wait for final
						// The final handler will do proper truncation
					} catch (e) {
						// If streaming processing fails, log but don't break - fall back to final text
						console.debug('[Autocomplete] Error processing streamed text:', e)
						// Continue - onFinalMessage will handle the final text
					}
				},
				onFinalMessage: ({ fullText }) => {

					// console.log('____res: ', JSON.stringify(newAutocompletion.insertText))

					newAutocompletion.endTime = Date.now()
					newAutocompletion.status = 'finished'
					const [text, _] = extractCodeFromRegular({ text: fullText, recentlyAddedTextLen: 0 })

					// Filter out suspicious non-code content (e.g., Chinese characters, wrong language syntax)
					// This helps prevent models from outputting explanatory text or non-code content
					const languageId = model.getLanguageId();
					const filteredText = filterNonCodeContent(text, languageId)

					// Final check: reject if the entire completion is in the wrong language
					if (detectLanguageMismatch(filteredText, languageId)) {
						// Reject this completion silently - it will be filtered out
						newAutocompletion.status = 'error'
						newAutocompletion.insertText = ''
						reject('Autocomplete returned code in wrong language')
						return
					}

					newAutocompletion.insertText = processStartAndEndSpaces(filteredText)

					// handle special case for predicting starting on the next line, add a newline character
					if (newAutocompletion.type === 'multi-line-start-on-next-line') {
						newAutocompletion.insertText = _ln + newAutocompletion.insertText
					}

					resolve(newAutocompletion.insertText)

				},
				onError: ({ message }) => {
					newAutocompletion.endTime = Date.now()
					newAutocompletion.status = 'error'
					reject(message)
				},
				onAbort: () => { reject('Aborted autocomplete') },
			})
			newAutocompletion.requestId = requestId

			// if the request hasnt resolved in TIMEOUT_TIME seconds, reject it
			const timeoutId = setTimeout(() => {
				if (newAutocompletion.status === 'pending') {
					newAutocompletion.status = 'error'
					if (newAutocompletion.requestId) {
						this._llmMessageService.abort(newAutocompletion.requestId)
					}
					reject('Timeout receiving message to LLM.')
				}
			}, TIMEOUT_TIME)

			// Clear timeout if promise resolves/rejects before timeout
			if (newAutocompletion.llmPromise) {
				newAutocompletion.llmPromise.finally(() => clearTimeout(timeoutId))
			}

		})



		// add autocompletion to cache
		this._autocompletionsOfDocument[docUriStr].set(newAutocompletion.id, newAutocompletion)

		// show autocompletion
		const providerStartTime = performance.now();
		try {
			await newAutocompletion.llmPromise
			// console.log('id: ' + newAutocompletion.id)

			// Recalculate prefix and suffix in case user typed more while waiting for LLM response
			const currentPrefixAndSuffix = getPrefixAndSuffixInfo(model, position)
			const currentPrefix = currentPrefixAndSuffix.prefix

			// Validate that completion text is reasonable
			if (!newAutocompletion.insertText || newAutocompletion.insertText.trim().length === 0) {
				this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id)
				return []
			}

			// Check if prefix changed significantly (user typed a lot while waiting)
			const prefixDiff = Math.abs(currentPrefix.length - newAutocompletion.prefix.length)
			if (prefixDiff > 50) { // More than 50 chars difference suggests significant editing
				this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id)
				return []
			}

			// Calculate the matchup bounds - this determines where in the generated text to start showing the completion
			const autocompletionMatchup = getAutocompletionMatchup({ prefix: currentPrefix, autocompletion: newAutocompletion })

			// If matchup is undefined, the prefix has changed too much (user typed beyond the completion)
			// In this case, return empty completions
			if (!autocompletionMatchup) {
				this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id)
				return []
			}

			const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: newAutocompletion, prefixAndSuffix: currentPrefixAndSuffix, position })

			// Final validation: ensure completion text is reasonable length
			if (inlineCompletions.length > 0 && inlineCompletions[0].insertText.length > 10000) {
				// Completion is suspiciously long, likely an error
				this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id)
				return []
			}

			// Record performance metrics
			const providerTime = performance.now() - providerStartTime;
			const totalTime = performance.now() - startTime;
			this._recordAutocompleteMetrics(providerTime, totalTime, false);

			return inlineCompletions

		} catch (e) {
			this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id)
			const errorMessage = e instanceof Error ? e.message : String(e)
			console.error('[Autocomplete] Error creating autocompletion:', errorMessage)

			// Show user-friendly error for persistent failures (not timeouts or aborts)
			if (!errorMessage.includes('Timeout') && !errorMessage.includes('Aborted')) {
				// Only show error notification occasionally to avoid spam
				if (Math.random() < 0.1) { // 10% chance to show notification
					this._notificationService.warn(`Autocomplete error: ${errorMessage}. Check console for details.`)
				}
			}

			// Record performance metrics even on error
			const providerTime = performance.now() - providerStartTime;
			const totalTime = performance.now() - startTime;
			this._recordAutocompleteMetrics(providerTime, totalTime, false);

			return []
		}

	}

	constructor(
		@ILanguageFeaturesService private _langFeatureService: ILanguageFeaturesService,
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@IEditorService private readonly _editorService: IEditorService,
		@IModelService private readonly _modelService: IModelService,
		@ICortexideSettingsService private readonly _settingsService: ICortexideSettingsService,
		@IConvertToLLMMessageService private readonly _convertToLLMMessageService: IConvertToLLMMessageService,
		@IModelWarmupService private readonly _modelWarmupService: IModelWarmupService,
		@INotificationService private readonly _notificationService: INotificationService
		// @IContextGatheringService private readonly _contextGatheringService: IContextGatheringService,
	) {
		super()

		this._register(this._langFeatureService.inlineCompletionsProvider.register('*', {
			provideInlineCompletions: async (model, position, context, token) => {
				const items = await this._provideInlineCompletionItems(model, position)

				// console.log('item: ', items?.[0]?.insertText)
				return { items: items, }
			},
			disposeInlineCompletions: () => {
				// get the `docUriStr` and the `position` of the cursor
				const activePane = this._editorService.activeEditorPane;
				if (!activePane) return;
				const control = activePane.getControl();
				if (!control || !isCodeEditor(control)) return;
				const position = control.getPosition();
				if (!position) return;
				const resource = EditorResourceAccessor.getCanonicalUri(this._editorService.activeEditor);
				if (!resource) return;
				const model = this._modelService.getModel(resource)
				if (!model) return;
				const docUriStr = resource.fsPath;
				if (!this._autocompletionsOfDocument[docUriStr]) return;

				const { prefix, } = getPrefixAndSuffixInfo(model, position)

				// go through cached items and remove matching ones
				// autocompletion.prefix + autocompletion.insertedText ~== insertedText
				this._autocompletionsOfDocument[docUriStr].items.forEach((autocompletion: Autocompletion) => {

					// we can do this more efficiently, I just didn't want to deal with all of the edge cases
					const matchup = removeAllWhitespace(prefix) === removeAllWhitespace(autocompletion.prefix + autocompletion.insertText)

					if (matchup) {
						this._lastCompletionAccept = Date.now()

						// Mark as finished before deleting to prevent abort in dispose callback
						// The dispose callback only aborts if status is 'pending'
						const wasPending = autocompletion.status === 'pending'
						autocompletion.status = 'finished'

						// Only abort if the request was still pending (not if it's already finished)
						// This prevents aborting requests that have already completed successfully
						if (wasPending && autocompletion.requestId) {
							this._llmMessageService.abort(autocompletion.requestId)
						}

						// Remove from cache (dispose callback will see status='finished' and won't abort)
						this._autocompletionsOfDocument[docUriStr].delete(autocompletion.id);
					}
				});

			},
		}))
	}

	/**
	 * Record autocomplete performance metrics
	 */
	private _recordAutocompleteMetrics(providerTime: number, totalTime: number, cacheHit: boolean): void {
		const perfSettings = this._settingsService.state.globalSettings.perf;
		if (perfSettings?.enable) {
			const harness = getPerformanceHarness(true);
			harness.recordAutocomplete(providerTime, totalTime, cacheHit);
		}
	}

}

registerWorkbenchContribution2(AutocompleteService.ID, AutocompleteService, WorkbenchPhase.BlockRestore);


