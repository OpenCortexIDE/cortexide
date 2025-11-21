/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IProgressRunner, emptyProgressRunner } from '../../../../platform/progress/common/progress.js';
import { IEditorProgressService } from '../../../../platform/progress/common/progress.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

/**
 * A no-op implementation of IEditorProgressService that can be used
 * when editors are created before the scoped editor progress service is available.
 * The scoped service (EditorProgressIndicator) will override this when available.
 */
class EditorProgressService extends Disposable implements IEditorProgressService {
	declare readonly _serviceBrand: undefined;

	show(infinite: true, delay?: number): IProgressRunner;
	show(total: number, delay?: number): IProgressRunner;
	show(infiniteOrTotal: true | number, delay?: number): IProgressRunner {
		// Return empty progress runner that does nothing
		return emptyProgressRunner;
	}

	async showWhile(promise: Promise<unknown>, delay?: number): Promise<void> {
		// Just wait for the promise without showing progress
		await promise;
	}
}

registerSingleton(IEditorProgressService, EditorProgressService, InstantiationType.Eager);

