/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *
 *  Tiny async serializer (mutex) — runs submitted async functions strictly one-at-a-time, in
 *  submission order. Used to make concurrent multi-agent FILE EDITS collision-safe: when a background
 *  agent (R7) and the foreground chat (or future parallel-edit sub-agents) both apply a file edit, the
 *  edits are serialized at the write boundary so a read-modify-write can't interleave. For a single
 *  agent editing sequentially the chain is always idle, so `run` executes immediately — a pure no-op.
 *--------------------------------------------------------------------------------------*/

export interface AsyncSerializer {
	/** Run `fn` after all previously-submitted work completes. Resolves/rejects with `fn`'s result. */
	run<T>(fn: () => Promise<T> | T): Promise<T>;
}

export function createSerializer(): AsyncSerializer {
	// The tail of the queue. We never let it reject, so one failed task doesn't wedge the lock.
	let tail: Promise<unknown> = Promise.resolve();
	return {
		run<T>(fn: () => Promise<T> | T): Promise<T> {
			const result = tail.then(() => fn());
			tail = result.then(() => undefined, () => undefined);
			return result;
		},
	};
}
