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
