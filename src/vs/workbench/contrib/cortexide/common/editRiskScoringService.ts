/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { EditContext, EditRiskScore, scoreEditFromContext } from './editRiskScore.js';

export const IEditRiskScoringService = createDecorator<IEditRiskScoringService>('editRiskScoringService');

// Re-exported so existing consumers keep importing these from editRiskScoringService.js. The shapes and
// the pure scoring live in ./editRiskScore.ts (node-testable); this service only supplies factor #6 (the
// pre-existing-error count, which needs the live model/markers) and delegates the rest.
export type { EditContext, EditRiskScore };

export interface IEditRiskScoringService {
	readonly _serviceBrand: undefined;

	/**
	 * Score the risk and confidence of an edit operation
	 */
	scoreEdit(context: EditContext): Promise<EditRiskScore>;
}

class EditRiskScoringService extends Disposable implements IEditRiskScoringService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IModelService private readonly modelService: IModelService,
		@IMarkerService private readonly markerService: IMarkerService,
	) {
		super();
	}

	async scoreEdit(context: EditContext): Promise<EditRiskScore> {
		// Factor #6 is the only impure input: the count of pre-existing Error markers on the file. Compute
		// it here (live model + markers) and hand the rest to the pure, tested scoreEditFromContext. Pass 0
		// when the model is unavailable or there is no newContent -- mirrors the old `if (model && newContent)`.
		let existingErrorCount = 0;
		try {
			const model = this.modelService.getModel(context.uri);
			if (model && context.newContent) {
				const markers = this.markerService.read({ resource: context.uri });
				existingErrorCount = markers.filter(m => m.severity === MarkerSeverity.Error).length;
			}
		} catch {
			// Model not available, skip this check
		}

		return scoreEditFromContext(context, existingErrorCount);
	}
}

registerSingleton(IEditRiskScoringService, EditRiskScoringService, InstantiationType.Delayed);

