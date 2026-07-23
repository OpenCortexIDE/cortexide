/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback } from 'react';
import { CortexideSettingsState } from '../../../../common/cortexideSettingsService.js';

type ServiceAccessor = { get: (id: string) => any };

type UseVisionAttachmentHandlersParams = {
	settingsState: CortexideSettingsState;
	accessor: ServiceAccessor;
	settingsCommandId: string;
	addImagesRaw: (files: File[]) => Promise<void>;
	addPDFsRaw: (files: File[]) => Promise<void>;
};

/** Vision-aware wrappers for paste/drop image and PDF handlers in the chat composer. */
export const useVisionAttachmentHandlers = ({
	settingsState,
	accessor,
	settingsCommandId,
	addImagesRaw,
	addPDFsRaw,
}: UseVisionAttachmentHandlersParams) => {
	const addPDFs = useCallback(async (files: File[]) => {
		const currentModelSel = settingsState.modelSelectionOfFeature['Chat'];
		if (currentModelSel?.providerName === 'auto' && currentModelSel?.modelName === 'auto') {
			await addPDFsRaw(files);
			return;
		}
		await addPDFsRaw(files);
	}, [addPDFsRaw, settingsState]);

	const addImages = useCallback(async (files: File[]) => {
		const currentModelSel = settingsState.modelSelectionOfFeature['Chat'];
		if (currentModelSel?.providerName === 'auto' && currentModelSel?.modelName === 'auto') {
			await addImagesRaw(files);
			return;
		}

		const {
			isSelectedModelVisionCapable,
			checkOllamaModelVisionCapable,
			hasVisionCapableApiKey,
			hasOllamaVisionModel,
			isOllamaAccessible,
		} = await import('../../util/visionModelHelper.js');

		let selectedIsVision = isSelectedModelVisionCapable(currentModelSel, settingsState.settingsOfProvider);
		if (!selectedIsVision && currentModelSel?.providerName === 'ollama') {
			const ollamaAccessible = await isOllamaAccessible();
			if (ollamaAccessible) {
				selectedIsVision = await checkOllamaModelVisionCapable(currentModelSel.modelName);
			}
		}

		if (selectedIsVision) {
			await addImagesRaw(files);
			return;
		}

		const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
		const ollamaAccessible = await isOllamaAccessible();
		const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();

		if (!hasApiKey && !hasOllamaVision) {
			const notificationService = accessor.get('INotificationService');
			const commandService = accessor.get('ICommandService');
			notificationService.notify({
				severity: 2,
				message: 'No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava).',
				actions: {
					primary: [{
						id: 'void.vision.setup',
						label: 'Setup Ollama Vision Models',
						tooltip: '',
						class: undefined,
						enabled: true,
						run: () => commandService.executeCommand(settingsCommandId),
					}],
				},
			});
			return;
		}

		await addImagesRaw(files);
	}, [addImagesRaw, settingsState, accessor, settingsCommandId]);

	return { addImages, addPDFs };
};
