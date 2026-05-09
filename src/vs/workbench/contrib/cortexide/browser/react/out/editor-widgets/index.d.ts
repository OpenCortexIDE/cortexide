/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { CortexideCommandBarProps } from '../../../cortexideCommandBarService.js';

export declare function mountVoidCommandBar(container: HTMLElement, accessor: ServicesAccessor, props: CortexideCommandBarProps): { dispose?: () => void; rerender: (props: CortexideCommandBarProps) => void } | null;

export declare function mountVoidSelectionHelper(container: HTMLElement, accessor: ServicesAccessor): { dispose: () => void; rerender: (props?: unknown) => void } | null;
