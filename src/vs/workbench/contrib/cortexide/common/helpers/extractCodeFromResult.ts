/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DIVIDER, FINAL, ORIGINAL } from '../prompt/prompts.js';
export class SurroundingsRemover {
	readonly originalS: string;
	i: number;
	j: number;

	// string is s[i...j]

	constructor(s: string) {
		this.originalS = s;
		this.i = 0;
		this.j = s.length - 1;
	}
	value() {
		return this.originalS.substring(this.i, this.j + 1);
	}

	// returns whether it removed the whole prefix
	removePrefix = (prefix: string): boolean => {
		let offset = 0;
		// console.log('prefix', prefix, Math.min(this.j, prefix.length - 1))
		while (this.i <= this.j && offset <= prefix.length - 1) {
			if (this.originalS.charAt(this.i) !== prefix.charAt(offset)) { break; }
			offset += 1;
			this.i += 1;
		}
		return offset === prefix.length;
	};

	// // removes suffix from right to left
	removeSuffix = (suffix: string): boolean => {
		// e.g. suffix = <PRE/>, the string is <PRE>hi<P
		const s = this.value();
		// for every possible prefix of `suffix`, check if string ends with it
		for (let len = Math.min(s.length, suffix.length); len >= 1; len -= 1) {
			if (s.endsWith(suffix.substring(0, len))) { // the end of the string equals a prefix
				this.j -= len;
				return len === suffix.length;
			}
		}
		return false;
	};
	// removeSuffix = (suffix: string): boolean => {
	// 	let offset = 0

	// 	while (this.j >= Math.max(this.i, 0)) {
	// 		if (this.originalS.charAt(this.j) !== suffix.charAt(suffix.length - 1 - offset))
	// 			break
	// 		offset += 1
	// 		this.j -= 1
	// 	}
	// 	return offset === suffix.length
	// }

	// either removes all or nothing
	removeFromStartUntilFullMatch = (until: string, alsoRemoveUntilStr: boolean) => {
		const index = this.originalS.indexOf(until, this.i);

		if (index === -1) {
			// this.i = this.j + 1
			return false;
		}
		// console.log('index', index, until.length)

		if (alsoRemoveUntilStr) { this.i = index + until.length; }
		else { this.i = index; }

		return true;
	};


	removeCodeBlock = () => {
		// Match either:
		// 1. ```language\n<code>\n```\n?
		// 2. ```<code>\n```\n?

		const pm = this;
		const foundCodeBlock = pm.removePrefix('```');
		if (!foundCodeBlock) { return false; }

		pm.removeFromStartUntilFullMatch('\n', true); // language

		const j = pm.j;
		let foundCodeBlockEnd = pm.removeSuffix('```');

		if (pm.j === j) { foundCodeBlockEnd = pm.removeSuffix('```\n'); } // if no change, try again with \n after ```

		if (!foundCodeBlockEnd) { return false; }

		pm.removeSuffix('\n'); // remove the newline before ```
		return true;
	};


	deltaInfo = (recentlyAddedTextLen: number) => {
		// aaaaaatextaaaaaa{recentlyAdded}
		//                  ^   i    j    len
		//                  |
		//            recentyAddedIdx
		const recentlyAddedIdx = this.originalS.length - recentlyAddedTextLen;
		const actualDelta = this.originalS.substring(Math.max(this.i, recentlyAddedIdx), this.j + 1);
		const ignoredSuffix = this.originalS.substring(Math.max(this.j + 1, recentlyAddedIdx), Infinity);
		return [actualDelta, ignoredSuffix] as const;
	};



}



export const extractCodeFromRegular = ({ text, recentlyAddedTextLen }: { text: string; recentlyAddedTextLen: number }): [string, string, string] => {

	const pm = new SurroundingsRemover(text);

	pm.removeCodeBlock();

	const s = pm.value();
	const [delta, ignoredSuffix] = pm.deltaInfo(recentlyAddedTextLen);

	return [s, delta, ignoredSuffix];
};





// Ollama has its own FIM, we should not use this if we use that
export const extractCodeFromFIM = ({ text, recentlyAddedTextLen, midTag, }: { text: string; recentlyAddedTextLen: number; midTag: string }): [string, string, string] => {

	/* ------------- summary of the regex -------------
		[optional ` | `` | ```]
		(match optional_language_name)
		[optional strings here]
		[required <MID> tag]
		(match the stuff between mid tags)
		[optional <MID/> tag]
		[optional ` | `` | ```]
	*/

	const pm = new SurroundingsRemover(text);

	pm.removeCodeBlock();

	const foundMid = pm.removePrefix(`<${midTag}>`);

	if (foundMid) {
		pm.removeSuffix(`\n`); // sometimes outputs \n
		pm.removeSuffix(`</${midTag}>`);
	}
	const s = pm.value();
	const [delta, ignoredSuffix] = pm.deltaInfo(recentlyAddedTextLen);

	return [s, delta, ignoredSuffix];
};



export type ExtractedSearchReplaceBlock = {
	state: 'writingOriginal' | 'writingFinal' | 'done';
	orig: string;
	final: string;
};


// JS substring swaps indices, so "ab".substr(1,0) will NOT be '', it will be 'a'!
const voidSubstr = (str: string, start: number, end: number) => end < start ? '' : str.substring(start, end);

export const endsWithAnyPrefixOf = (str: string, anyPrefix: string) => {
	// for each prefix
	for (let i = anyPrefix.length; i >= 1; i--) { // i >= 1 because must not be empty string
		const prefix = anyPrefix.slice(0, i);
		if (str.endsWith(prefix)) { return prefix; }
	}
	return null;
};

// Helper function to strip markdown code fences from text
// This is used when users paste code snippets with markdown code fences (```) into chat
// via inline editing. The fences need to be removed from ORIGINAL/FINAL text before
// matching against the actual file content.
//
// Handles edge cases:
// - Code blocks with/without language identifiers (```java vs ```)
// - Code blocks with/without trailing newlines (```\n vs ```)
// - Nested code blocks (strips outer ones iteratively)
// - Incomplete code blocks (gracefully handles - returns text unchanged if no closing ```)
// - Empty code blocks (```\n```)
// - Whitespace-only code blocks
// - Text without code fences (returns unchanged)
//
// Examples:
//   Input: "```java\ncode\n```"  -> Output: "code"
//   Input: "```\ncode\n```"      -> Output: "code"
//   Input: "code"                 -> Output: "code" (no change)
//   Input: "```code"              -> Output: "```code" (incomplete, no change)
const stripCodeFences = (text: string): string => {
	// Handle null/undefined/empty strings
	if (!text || text.trim().length === 0) {
		return text;
	}

	// Try to remove code blocks from start/end multiple times
	// This handles cases where there might be nested or multiple code blocks
	// e.g., ```\n```java\ncode\n```\n``` -> code
	let result = text;
	let previousResult = '';
	let attempts = 0;
	const maxAttempts = 5; // Prevent infinite loops (safety check)

	// Keep trying to remove code blocks until no more can be removed
	while (attempts < maxAttempts && result !== previousResult) {
		previousResult = result;
		const remover = new SurroundingsRemover(result);

		// Try to remove code block from start/end
		// removeCodeBlock() returns false if no code block is found
		if (remover.removeCodeBlock()) {
			result = remover.value();
		} else {
			// If no code block found, we're done
			break;
		}

		attempts++;
	}

	return result;
};

// guarantees if you keep adding text, array length will strictly grow and state will progress without going back
export const extractSearchReplaceBlocks = (str: string) => {

	const ORIGINAL_ = ORIGINAL + `\n`;
	const DIVIDER_ = '\n' + DIVIDER + `\n`;
	// logic for FINAL_ is slightly more complicated - should be '\n' + FINAL, but that ignores if the final output is empty

	const blocks: ExtractedSearchReplaceBlock[] = [];

	let i = 0; // search i and beyond (this is done by plain index, not by line number. much simpler this way)
	while (true) {
		let origStart = str.indexOf(ORIGINAL_, i);
		if (origStart === -1) { return blocks; }
		origStart += ORIGINAL_.length;
		i = origStart;
		// wrote <<<< ORIGINAL\n

		let dividerStart = str.indexOf(DIVIDER_, i);
		if (dividerStart === -1) { // if didnt find DIVIDER_, either writing originalStr or DIVIDER_ right now
			const writingDIVIDERlen = endsWithAnyPrefixOf(str, DIVIDER_)?.length ?? 0;
			const origText = voidSubstr(str, origStart, str.length - writingDIVIDERlen);
			blocks.push({
				orig: stripCodeFences(origText),
				final: '',
				state: 'writingOriginal'
			});
			return blocks;
		}
		const origStrDone = voidSubstr(str, origStart, dividerStart);
		dividerStart += DIVIDER_.length;
		i = dividerStart;
		// wrote \n=====\n

		const fullFINALStart = str.indexOf(FINAL, i);
		const fullFINALStart_ = str.indexOf('\n' + FINAL, i); // go with B if possible, else fallback to A, it's more permissive
		const matchedFullFINAL_ = fullFINALStart_ !== -1 && fullFINALStart === fullFINALStart_ + 1;  // this logic is really important, otherwise we might look for FINAL_ at a much later part of the string

		let finalStart = matchedFullFINAL_ ? fullFINALStart_ : fullFINALStart;
		if (finalStart === -1) { // if didnt find FINAL_, either writing finalStr or FINAL or FINAL_ right now
			const writingFINALlen = endsWithAnyPrefixOf(str, FINAL)?.length ?? 0;
			const writingFINALlen_ = endsWithAnyPrefixOf(str, '\n' + FINAL)?.length ?? 0; // this gets priority
			const usingWritingFINALlen = Math.max(writingFINALlen, writingFINALlen_);
			const finalText = voidSubstr(str, dividerStart, str.length - usingWritingFINALlen);
			blocks.push({
				orig: stripCodeFences(origStrDone),
				final: stripCodeFences(finalText),
				state: 'writingFinal'
			});
			return blocks;
		}
		const usingFINAL = matchedFullFINAL_ ? '\n' + FINAL : FINAL;
		const finalStrDone = voidSubstr(str, dividerStart, finalStart);
		finalStart += usingFINAL.length;
		i = finalStart;
		// wrote >>>>> FINAL

		blocks.push({
			orig: stripCodeFences(origStrDone),
			final: stripCodeFences(finalStrDone),
			state: 'done'
		});
	}
};















// const tests: [string, { shape: Partial<ExtractedSearchReplaceBlock>[] }][] = [[
// 	`\
// \`\`\`
// <<<<<<< ORIGINA`, { shape: [] }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL`, { shape: [], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A`, { shape: [{ state: 'writingOriginal', orig: 'A' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B`, { shape: [{ state: 'writingOriginal', orig: 'A\nB' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// `, { shape: [{ state: 'writingOriginal', orig: 'A\nB' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// ===`, { shape: [{ state: 'writingOriginal', orig: 'A\nB' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// ======`, { shape: [{ state: 'writingOriginal', orig: 'A\nB' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======`, { shape: [{ state: 'writingOriginal', orig: 'A\nB' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// `, { shape: [{ state: 'writingFinal', orig: 'A\nB', final: '' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// >>>>>>> UPDAT`, { shape: [{ state: 'writingFinal', orig: 'A\nB', final: '' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// >>>>>>> UPDATED`, { shape: [{ state: 'done', orig: 'A\nB', final: '' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// >>>>>>> UPDATED
// \`\`\``, { shape: [{ state: 'done', orig: 'A\nB', final: '' }], }
// ],


// // alternatively
// [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// X`, { shape: [{ state: 'writingFinal', orig: 'A\nB', final: 'X' }], }
// ],
// [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// X
// Y`, { shape: [{ state: 'writingFinal', orig: 'A\nB', final: 'X\nY' }], }
// ],
// [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// X
// Y
// `, { shape: [{ state: 'writingFinal', orig: 'A\nB', final: 'X\nY' }], }
// ],
// [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// X
// Y
// >>>>>>> UPDAT`, { shape: [{ state: 'writingFinal', orig: 'A\nB', final: 'X\nY' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// X
// Y
// >>>>>>> UPDATED`, { shape: [{ state: 'done', orig: 'A\nB', final: 'X\nY' }], }
// ], [
// 	`\
// \`\`\`
// <<<<<<< ORIGINAL
// A
// B
// =======
// X
// Y
// >>>>>>> UPDATED
// \`\`\``, { shape: [{ state: 'done', orig: 'A\nB', final: 'X\nY' }], }
// ]]




// function runTests() {


// 	let passedTests = 0;
// 	let failedTests = 0;

// 	for (let i = 0; i < tests.length; i++) {
// 		const [input, expected] = tests[i];
// 		const result = extractSearchReplaceBlocks(input);

// 		// Compare result with expected shape
// 		let passed = true;
// 		if (result.length !== expected.shape.length) {
// 			passed = false;
// 		} else {
// 			for (let j = 0; j < result.length; j++) { // block
// 				const expectedItem = expected.shape[j];
// 				const resultItem = result[j];

// 				if ((expectedItem.state !== undefined) && (expectedItem.state !== resultItem.state) ||
// 					(expectedItem.orig !== undefined) && (expectedItem.orig !== resultItem.orig) ||
// 					(expectedItem.final !== undefined) && (expectedItem.final !== resultItem.final)) {
// 					passed = false;
// 					break;
// 				}
// 			}
// 		}

// 		if (passed) {
// 			passedTests++;
// 			console.log(`Test ${i + 1} passed`);
// 		} else {
// 			failedTests++;
// 			console.log(`Test ${i + 1} failed`);
// 			console.log('Input:', input)
// 			console.log(`Expected:`, expected.shape);
// 			console.log(`Got:`, result);
// 		}
// 	}

// 	console.log(`Total: ${tests.length}, Passed: ${passedTests}, Failed: ${failedTests}`);
// 	return failedTests === 0;
// }



// runTests()


