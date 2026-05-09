/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../../../../platform/instantiation/common/instantiation.js';

export declare function mountVoidSettings(container: HTMLElement, accessor: ServicesAccessor): { dispose: () => void } | null;
