/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client'
import { _registerServices } from './services.js';


import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js';

export const mountFnGenerator = (Component: (params: any) => React.ReactNode) => (rootElement: HTMLElement, accessor: ServicesAccessor, props?: any) => {
	if (typeof document === 'undefined') {
		console.error('index.tsx error: document was undefined')
		return
	}

	const disposables = _registerServices(accessor)

	const root = ReactDOM.createRoot(rootElement)

	const rerender = (props?: any) => {
		root.render(<Component {...props} />); // tailwind dark theme indicator
	}
	const dispose = () => {
		// Dispose disposables first
		disposables.forEach(d => d.dispose());

		// Defer unmount to avoid "synchronously unmount a root while React was already rendering" warning
		// Use queueMicrotask to ensure unmount happens after the current render cycle completes
		queueMicrotask(() => {
			try {
				root.unmount();
			} catch (e) {
				// Ignore errors if already unmounted or if React is still rendering
				// Fallback to setTimeout if queueMicrotask fails
				setTimeout(() => {
					try {
						root.unmount();
					} catch (e2) {
						// Final fallback - ignore if still failing
						console.warn('Error unmounting React root after retry:', e2);
					}
				}, 0);
			}
		});
	}

	rerender(props)

	const returnVal = {
		rerender,
		dispose,
	}
	return returnVal
}
