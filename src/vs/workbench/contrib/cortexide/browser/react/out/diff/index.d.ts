/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Hand-maintained type declarations for the generated diff bundle
// (browser/react/out/diff/index.js, produced by `npm run buildreact`). Committed
// alongside the sibling react/out *.d.ts files (out/ is gitignored, these are force-added)
// so the type checker can resolve `import { diffLines } from '../react/out/diff/index.js'`
// in findDiffs.ts WITHOUT first building react -- CI runs the typecheck before buildreact.
// The runtime impl re-exports diffLines/Change from the `diff` npm package
// (see react/src/diff/index.tsx).

export interface Change {
	count?: number;
	value: string;
	added?: boolean;
	removed?: boolean;
}

export declare function diffLines(oldStr: string, newStr: string): Change[];
