/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Node 22.15.x ESM/CJS interop breaks `import es from 'event-stream'` — es.readArray etc.
// become undefined because the default import loses the module.exports properties.
// Using createRequire bypasses the interop and always returns the full CJS module.exports.
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const es = _require('event-stream') as typeof import('event-stream');
export default es;

// Re-exported as a type so consumers can do `import es, { ThroughStream } from './event-stream-compat.ts'`.
// A default-imported binding cannot be used as a type namespace under newer tsc.
export type ThroughStream = import('event-stream').ThroughStream;
