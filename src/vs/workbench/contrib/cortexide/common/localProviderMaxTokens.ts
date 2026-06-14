/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { FeatureName } from './cortexideSettingsTypes.js'

/**
 * The output-token budget (OpenAI max_tokens / Ollama num_predict) for a single LLM call, extracted
 * verbatim from sendLLMMessage.impl.ts so it is node-testable. It is a real responsiveness lever: local
 * models are slow per-token, so autocomplete asks for very few tokens (fast suggestions) and quick edits
 * for a moderate amount, while cloud calls use a flat default. Used by the FIM, Ollama-FIM, and Ollama-chat
 * paths. Byte-identical to the old inline function.
 */
export const computeMaxTokensForLocalProvider = (isLocalProvider: boolean, featureName: FeatureName | undefined): number => {
	if (!isLocalProvider) {
		return 300 // Default for cloud providers
	}

	// Infer feature from featureName or default to safe value
	if (featureName === 'Autocomplete') {
		return 96 // Small value for fast autocomplete
	} else if (featureName === 'Ctrl+K' || featureName === 'Apply') {
		return 200 // Medium value for quick edits
	}

	// Default for local providers when featureName is unknown
	return 300
}
