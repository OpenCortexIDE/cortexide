/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { isFeatureNameDisabled, providerNames } from './cortexideSettingsTypes.js';
import { CortexideSettingsState, ICortexideSettingsService } from './cortexideSettingsService.js';
import { getModelCapabilities } from './modelCapabilities.js';

/** Pick the first configured, visible model for Chat if none is selected yet (onboarding #67). */
export const tryAutoAssignChatModel = async (
	settingsService: ICortexideSettingsService,
	state: CortexideSettingsState,
): Promise<CortexideSettingsState> => {
	if (!isFeatureNameDisabled('Chat', state)) {
		return state;
	}
	for (const providerName of providerNames) {
		const ps = state.settingsOfProvider[providerName];
		if (!ps._didFillInProviderSettings) continue;
		const model = ps.models.find(m => !m.isHidden);
		if (!model) continue;
		await settingsService.setModelSelectionOfFeature('Chat', { providerName, modelName: model.modelName });
		return settingsService.state;
	}
	return state;
};

/** Assign a FIM-capable autocomplete model when a local/chat model is configured (issue #27). */
export const tryAutoAssignAutocompleteModel = async (
	settingsService: ICortexideSettingsService,
	state: CortexideSettingsState,
): Promise<void> => {
	if (!isFeatureNameDisabled('Autocomplete', state)) {
		return;
	}
	for (const providerName of providerNames) {
		const ps = state.settingsOfProvider[providerName];
		if (!ps._didFillInProviderSettings) continue;
		for (const model of ps.models) {
			if (model.isHidden) continue;
			const caps = getModelCapabilities(providerName, model.modelName, state.overridesOfModel);
			if (caps.supportsFIM || providerName === 'openAICompatible' || providerName === 'ollama') {
				await settingsService.setModelSelectionOfFeature('Autocomplete', { providerName, modelName: model.modelName });
				return;
			}
		}
	}
};

/** Default llama-server / llama.cpp OpenAI-compatible endpoint (issue #67). */
export const LLAMA_SERVER_DEFAULT_ENDPOINT = 'http://127.0.0.1:8080/v1';

export const applyLlamaServerPreset = async (settingsService: ICortexideSettingsService): Promise<void> => {
	await settingsService.setSettingOfProvider('openAICompatible', 'endpoint', LLAMA_SERVER_DEFAULT_ENDPOINT);
	await settingsService.setSettingOfProvider('openAICompatible', 'apiKey', '');
	await settingsService.setSettingOfProvider('openAICompatible', 'headersJSON', '{}');
};
