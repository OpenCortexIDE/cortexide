/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { defaultProviderSettings } from './modelCapabilities.js';
import { ProviderName, SettingsOfProvider } from './cortexideSettingsTypes.js';

/** Provider fields that may be left empty (e.g. llama-server / local OpenAI-compatible servers). */
const OPTIONAL_PROVIDER_FIELDS: Partial<Record<ProviderName, readonly string[]>> = {
	openAICompatible: ['apiKey'],
	ollama: ['apiKey'],
	vLLM: ['apiKey'],
	lmStudio: ['apiKey'],
	liteLLM: ['apiKey'],
};

const isFilledSettingValue = (val: unknown): boolean => {
	if (val === undefined || val === null) return false;
	if (typeof val === 'string') return val.length > 0;
	return true;
};

/**
 * True when the user has supplied enough settings for a provider to be considered configured.
 * Local / OpenAI-compatible backends do not require an API key (issue #67).
 */
export const isProviderSettingsComplete = (
	providerName: ProviderName,
	settings: SettingsOfProvider[ProviderName],
): boolean => {
	const optional = new Set(OPTIONAL_PROVIDER_FIELDS[providerName] ?? []);
	const record = settings as Record<string, unknown>;
	return Object.keys(defaultProviderSettings[providerName]).every((key) => {
		if (optional.has(key)) {
			return true;
		}
		return isFilledSettingValue(record[key]);
	});
};
