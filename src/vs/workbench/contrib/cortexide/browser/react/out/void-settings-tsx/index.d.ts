/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js';

export interface MountResult {
	rerender: (props?: any) => void;
	dispose: () => void;
}

export function mountVoidSettings(rootElement: HTMLElement, accessor: ServicesAccessor, props?: any): MountResult | undefined;

