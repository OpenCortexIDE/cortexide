/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface Change {
	value: string;
	added?: boolean;
	removed?: boolean;
	count?: number;
}

export interface LinesOptions {
	newlineIsToken?: boolean;
	ignoreWhitespace?: boolean;
	stripTrailingCr?: boolean;
}

export function diffLines(oldStr: string, newStr: string, options?: LinesOptions): Change[];
export function diffLines(oldStr: string, newStr: string, callback: (changes: Change[]) => void): void;

export type { Change };

