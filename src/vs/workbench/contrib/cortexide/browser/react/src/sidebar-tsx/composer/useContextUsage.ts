/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccessor, useSettingsState } from '../../util/services.js';
import { ChatMessage } from '../../../../common/chatThreadServiceTypes.js';
import { getIsReasoningEnabledState, getReservedOutputTokenSpace, getModelCapabilities } from '../../../../common/modelCapabilities.js';
import { isValidProviderModelSelection } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js';

export const useContextUsage = (previousMessages: ChatMessage[], draftText: string) => {
	const accessor = useAccessor();
	const settingsState = useSettingsState();
	const [ctxWarned, setCtxWarned] = useState(false);
	const estimateTokens = useCallback((s: string) => Math.ceil((s || '').length / 4), []);
	const modelSel = settingsState.modelSelectionOfFeature['Chat'];

	const { contextBudget, messagesTokens } = useMemo(() => {
		let budget = 0;
		let tokens = 0;
		if (modelSel && isValidProviderModelSelection(modelSel)) {
			const { providerName, modelName } = modelSel;
			const caps = getModelCapabilities(providerName, modelName, settingsState.overridesOfModel);
			const contextWindow = caps.contextWindow;
			const msOpts = settingsState.optionsOfModelSelection['Chat'][providerName]?.[modelName];
			const isReasoningEnabled = getIsReasoningEnabledState('Chat', providerName, modelName, msOpts, settingsState.overridesOfModel);
			const rot = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled, overridesOfModel: settingsState.overridesOfModel }) || 0;
			budget = Math.max(256, Math.floor(contextWindow * 0.8) - rot);
			tokens = previousMessages.reduce((acc, m) => {
				if (m.role === 'user') return acc + estimateTokens(m.content || '');
				if (m.role === 'assistant') return acc + estimateTokens((m.displayContent as string) || (m.content || '') || '');
				return acc;
			}, 0);
		}
		return { contextBudget: budget, messagesTokens: tokens };
	}, [modelSel, previousMessages, settingsState.overridesOfModel, settingsState.optionsOfModelSelection, estimateTokens]);

	const draftTokens = estimateTokens(draftText);
	const contextTotal = messagesTokens + draftTokens;
	const contextPct = contextBudget > 0 ? contextTotal / contextBudget : 0;

	useEffect(() => {
		if (contextPct > 0.8 && contextPct < 1 && !ctxWarned) {
			try {
				accessor.get('INotificationService').info(`Context nearing limit: ~${contextTotal} / ${contextBudget} tokens. Older messages may be summarized.`);
			} catch { /* noop */ }
			setCtxWarned(true);
		}
		if (contextPct < 0.6 && ctxWarned) setCtxWarned(false);
	}, [contextPct, ctxWarned, contextTotal, contextBudget, accessor]);

	return { modelSel, contextTotal, contextBudget, contextPct };
};
