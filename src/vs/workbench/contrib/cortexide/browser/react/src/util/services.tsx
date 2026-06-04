/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react'
import { MCPUserState, RefreshableProviderName, SettingsOfProvider } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js'
import { DisposableStore, IDisposable } from '../../../../../../../base/common/lifecycle.js'
import { CortexideSettingsState } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsService.js'
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js'
import { RefreshModelStateOfProvider } from '../../../../../../../workbench/contrib/cortexide/common/refreshModelService.js'

import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js';
import { IExplorerService } from '../../../../../../../workbench/contrib/files/browser/files.js'
import { IModelService } from '../../../../../../../editor/common/services/model.js';
import { IClipboardService } from '../../../../../../../platform/clipboard/common/clipboardService.js';
import { IContextViewService, IContextMenuService } from '../../../../../../../platform/contextview/browser/contextView.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../../../../platform/hover/browser/hover.js';
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js';
import { ILLMMessageService } from '../../../../common/sendLLMMessageService.js';
import { IRefreshModelService } from '../../../../../../../workbench/contrib/cortexide/common/refreshModelService.js';
import { ICortexideSettingsService } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsService.js';
import { IExtensionTransferService } from '../../../../../../../workbench/contrib/cortexide/browser/extensionTransferService.js'

import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js'
import { ICodeEditorService } from '../../../../../../../editor/browser/services/codeEditorService.js'
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js'
import { IContextKeyService } from '../../../../../../../platform/contextkey/common/contextkey.js'
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js'
import { IAccessibilityService } from '../../../../../../../platform/accessibility/common/accessibility.js'
import { ILanguageConfigurationService } from '../../../../../../../editor/common/languages/languageConfigurationRegistry.js'
import { ILanguageFeaturesService } from '../../../../../../../editor/common/services/languageFeatures.js'
import { ILanguageDetectionService } from '../../../../../../services/languageDetection/common/languageDetectionWorkerService.js'
import { IKeybindingService } from '../../../../../../../platform/keybinding/common/keybinding.js'
import { IEnvironmentService } from '../../../../../../../platform/environment/common/environment.js'
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js'
import { IPathService } from '../../../../../../../workbench/services/path/common/pathService.js'
import { IMetricsService } from '../../../../../../../workbench/contrib/cortexide/common/metricsService.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { IChatThreadService, ThreadsState, ThreadStreamState } from '../../../chatThreadService.js'
import { ITerminalToolService } from '../../../terminalToolService.js'
import { ILanguageService } from '../../../../../../../editor/common/languages/language.js'
import { ICortexideModelService } from '../../../../common/cortexideModelService.js'
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js'
import { ICortexideCommandBarService } from '../../../cortexideCommandBarService.js'
import { INativeHostService } from '../../../../../../../platform/native/common/native.js';
import { IEditCodeService } from '../../../editCodeServiceInterface.js'
import { IToolsService } from '../../../toolsService.js'
import { IConvertToLLMMessageService } from '../../../convertToLLMMessageService.js'
import { ITerminalService } from '../../../../../terminal/browser/terminal.js'
import { ISearchService } from '../../../../../../services/search/common/search.js'
import { IExtensionManagementService } from '../../../../../../../platform/extensionManagement/common/extensionManagement.js'
import { IMCPService } from '../../../../common/mcpService.js';
import { IBackgroundAgentsService } from '../../../../browser/backgroundAgentsService.js';
import { IStorageService, StorageScope } from '../../../../../../../platform/storage/common/storage.js'
import { OPT_OUT_KEY } from '../../../../common/storageKeys.js'
import { IRepoIndexerService } from '../../../repoIndexerService.js'
import { ISecretDetectionService } from '../../../../common/secretDetectionService.js'
import { ILocalSetupService } from '../../../../common/localSetupService.js'
import { IOllamaInstallerService } from '../../../../common/ollamaInstallerService.js'
import { ICortexideI18nService, SupportedLocale } from '../../../../common/i18n/i18nService.js'
import { ICortexideRulesService, ProjectRule } from '../../../../common/cortexideRulesService.js'


// normally to do this you'd use a useEffect that calls .onDidChangeState(), but useEffect mounts too late and misses initial state changes

// even if React hasn't mounted yet, the variables are always updated to the latest state.
// React listens by adding a setState function to these listeners.

let chatThreadsState: ThreadsState
const chatThreadsStateListeners: Set<(s: ThreadsState) => void> = new Set()

let chatThreadsStreamState: ThreadStreamState
const chatThreadsStreamStateListeners: Set<(threadId: string) => void> = new Set()

let settingsState: CortexideSettingsState
const settingsStateListeners: Set<(s: CortexideSettingsState) => void> = new Set()

let refreshModelState: RefreshModelStateOfProvider
const refreshModelStateListeners: Set<(s: RefreshModelStateOfProvider) => void> = new Set()
const refreshModelProviderListeners: Set<(p: RefreshableProviderName, s: RefreshModelStateOfProvider) => void> = new Set()

// Default to LIGHT so useIsDark() is never undefined before _registerServices runs
let colorThemeState: ColorScheme = ColorScheme.LIGHT
const colorThemeStateListeners: Set<(s: ColorScheme) => void> = new Set()

const ctrlKZoneStreamingStateListeners: Set<(diffareaid: number, s: boolean) => void> = new Set()
const commandBarURIStateListeners: Set<(uri: URI) => void> = new Set();
const activeURIListeners: Set<(uri: URI | null) => void> = new Set();

const mcpListeners: Set<() => void> = new Set()
const backgroundAgentsListeners: Set<() => void> = new Set()

let localeState: SupportedLocale = 'en'
const localeStateListeners: Set<(s: SupportedLocale) => void> = new Set()

let rulesState: ProjectRule[] = []
const rulesStateListeners: Set<(s: ProjectRule[]) => void> = new Set()


// must call this before you can use any of the hooks below
// this should only be called ONCE! this is the only place you don't need to dispose onDidChange. If you use state.onDidChange anywhere else, make sure to dispose it!
export const _registerServices = (accessor: ServicesAccessor) => {

	const disposables: IDisposable[] = []

	_registerAccessor(accessor)

	const stateServices = {
		chatThreadsStateService: accessor.get(IChatThreadService),
		settingsStateService: accessor.get(ICortexideSettingsService),
		refreshModelService: accessor.get(IRefreshModelService),
		themeService: accessor.get(IThemeService),
		editCodeService: accessor.get(IEditCodeService),
		cortexideCommandBarService: accessor.get(ICortexideCommandBarService),
		modelService: accessor.get(IModelService),
		mcpService: accessor.get(IMCPService),
		backgroundAgentsService: accessor.get(IBackgroundAgentsService),
	}

	const { settingsStateService, chatThreadsStateService, refreshModelService, themeService, editCodeService, cortexideCommandBarService, modelService, mcpService, backgroundAgentsService } = stateServices




	chatThreadsState = chatThreadsStateService.state
	disposables.push(
		chatThreadsStateService.onDidChangeCurrentThread(() => {
			chatThreadsState = chatThreadsStateService.state
			chatThreadsStateListeners.forEach(l => l(chatThreadsState))
		})
	)

	// same service, different state
	chatThreadsStreamState = chatThreadsStateService.streamState
	disposables.push(
		chatThreadsStateService.onDidChangeStreamState(({ threadId }) => {
			chatThreadsStreamState = chatThreadsStateService.streamState
			chatThreadsStreamStateListeners.forEach(l => l(threadId))
		})
	)

	settingsState = settingsStateService.state
	disposables.push(
		settingsStateService.onDidChangeState(() => {
			settingsState = settingsStateService.state
			settingsStateListeners.forEach(l => l(settingsState))
		})
	)

	refreshModelState = refreshModelService.state
	disposables.push(
		refreshModelService.onDidChangeState((providerName) => {
			refreshModelState = refreshModelService.state
			refreshModelStateListeners.forEach(l => l(refreshModelState))
			refreshModelProviderListeners.forEach(l => l(providerName, refreshModelState)) // no state
		})
	)

	colorThemeState = themeService.getColorTheme().type
	// Notify any already-mounted components so they get correct initial theme
	colorThemeStateListeners.forEach(l => l(colorThemeState))
	disposables.push(
		themeService.onDidColorThemeChange(({ type }) => {
			colorThemeState = type
			// Defer to next frame so we don't call React setState during theme application (avoids "update while rendering" when switching theme)
			requestAnimationFrame(() => {
				colorThemeStateListeners.forEach(l => l(colorThemeState))
			})
		})
	)

	// no state
	disposables.push(
		editCodeService.onDidChangeStreamingInCtrlKZone(({ diffareaid }) => {
			const isStreaming = editCodeService.isCtrlKZoneStreaming({ diffareaid })
			ctrlKZoneStreamingStateListeners.forEach(l => l(diffareaid, isStreaming))
		})
	)

	disposables.push(
		cortexideCommandBarService.onDidChangeState(({ uri }) => {
			commandBarURIStateListeners.forEach(l => l(uri));
		})
	)

	disposables.push(
		cortexideCommandBarService.onDidChangeActiveURI(({ uri }) => {
			activeURIListeners.forEach(l => l(uri));
		})
	)

	disposables.push(
		mcpService.onDidChangeState(() => {
			mcpListeners.forEach(l => l())
		})
	)

	disposables.push(
		backgroundAgentsService.onDidChangeState(() => {
			backgroundAgentsListeners.forEach(l => l())
		})
	)

	const i18nService = accessor.get(ICortexideI18nService)
	localeState = i18nService.locale
	disposables.push(
		i18nService.onDidChangeLocale((newLocale) => {
			localeState = newLocale
			localeStateListeners.forEach(l => l(localeState))
		})
	)

	const rulesService = accessor.get(ICortexideRulesService)
	rulesState = rulesService.rules
	disposables.push(
		rulesService.onDidChangeRules((newRules) => {
			rulesState = newRules
			rulesStateListeners.forEach(l => l(rulesState))
		})
	)

	return disposables
}



const getReactAccessor = (accessor: ServicesAccessor) => {
	// Extract all services synchronously in a single pass
	// This must complete before the accessor becomes invalid
	// (which happens when invokeFunction returns)
	try {
		const reactAccessor = {
			IModelService: accessor.get(IModelService),
			IClipboardService: accessor.get(IClipboardService),
			IContextViewService: accessor.get(IContextViewService),
			IContextMenuService: accessor.get(IContextMenuService),
			IFileService: accessor.get(IFileService),
			IHoverService: accessor.get(IHoverService),
			IThemeService: accessor.get(IThemeService),
			ILLMMessageService: accessor.get(ILLMMessageService),
			IRefreshModelService: accessor.get(IRefreshModelService),
			ICortexideSettingsService: accessor.get(ICortexideSettingsService),
			IEditCodeService: accessor.get(IEditCodeService),
			IChatThreadService: accessor.get(IChatThreadService),

			IInstantiationService: accessor.get(IInstantiationService),
			ICodeEditorService: accessor.get(ICodeEditorService),
			ICommandService: accessor.get(ICommandService),
			IContextKeyService: accessor.get(IContextKeyService),
			INotificationService: accessor.get(INotificationService),
			IAccessibilityService: accessor.get(IAccessibilityService),
			ILanguageConfigurationService: accessor.get(ILanguageConfigurationService),
			ILanguageDetectionService: accessor.get(ILanguageDetectionService),
			ILanguageFeaturesService: accessor.get(ILanguageFeaturesService),
			IKeybindingService: accessor.get(IKeybindingService),
			ISearchService: accessor.get(ISearchService),

			IExplorerService: accessor.get(IExplorerService),
			IEnvironmentService: accessor.get(IEnvironmentService),
			IConfigurationService: accessor.get(IConfigurationService),
			IPathService: accessor.get(IPathService),
			IMetricsService: accessor.get(IMetricsService),
			ITerminalToolService: accessor.get(ITerminalToolService),
			ILanguageService: accessor.get(ILanguageService),
			ICortexideModelService: accessor.get(ICortexideModelService),
			IWorkspaceContextService: accessor.get(IWorkspaceContextService),

			ICortexideCommandBarService: accessor.get(ICortexideCommandBarService),
			INativeHostService: accessor.get(INativeHostService),
			IToolsService: accessor.get(IToolsService),
			IConvertToLLMMessageService: accessor.get(IConvertToLLMMessageService),
			ITerminalService: accessor.get(ITerminalService),
			IExtensionManagementService: accessor.get(IExtensionManagementService),
			IExtensionTransferService: accessor.get(IExtensionTransferService),
			IMCPService: accessor.get(IMCPService),
			IBackgroundAgentsService: accessor.get(IBackgroundAgentsService),
			IRepoIndexerService: accessor.get(IRepoIndexerService),
			ISecretDetectionService: accessor.get(ISecretDetectionService),

			IStorageService: accessor.get(IStorageService),

			ILocalSetupService: accessor.get(ILocalSetupService),
			OllamaInstallerService: accessor.get(IOllamaInstallerService),

			ICortexideI18nService: accessor.get(ICortexideI18nService),
			ICortexideRulesService: accessor.get(ICortexideRulesService),

		} as const
		return reactAccessor
	} catch (error) {
		console.error('[ReactServices] Failed to extract services from accessor:', error);
		throw error;
	}
}

type ReactAccessor = ReturnType<typeof getReactAccessor>


let reactAccessor_: ReactAccessor | null = null
const _registerAccessor = (accessor: ServicesAccessor) => {
	const reactAccessor = getReactAccessor(accessor)
	reactAccessor_ = reactAccessor
}

// -- services --
export const useAccessor = () => {
	if (!reactAccessor_) {
		throw new Error(`⚠️ Void useAccessor was called before _registerServices!`)
	}

	return { get: <S extends keyof ReactAccessor,>(service: S): ReactAccessor[S] => reactAccessor_![service] }
}



// -- state of services --

export const useSettingsState = () => {
	const [s, ss] = useState(settingsState)
	useEffect(() => {
		ss(settingsState)
		settingsStateListeners.add(ss)
		return () => { settingsStateListeners.delete(ss) }
	}, [ss])
	return s
}

export const useChatThreadsState = () => {
	const [s, ss] = useState(chatThreadsState)
	useEffect(() => {
		ss(chatThreadsState)
		chatThreadsStateListeners.add(ss)
		return () => { chatThreadsStateListeners.delete(ss) }
	}, [ss])
	return s
	// allow user to set state natively in react
	// const ss: React.Dispatch<React.SetStateAction<ThreadsState>> = (action)=>{
	// 	_ss(action)
	// 	if (typeof action === 'function') {
	// 		const newState = action(chatThreadsState)
	// 		chatThreadsState = newState
	// 	} else {
	// 		chatThreadsState = action
	// 	}
	// }
	// return [s, ss] as const
}




export const useChatThreadsStreamState = (threadId: string) => {
	const [s, ss] = useState<ThreadStreamState[string] | undefined>(chatThreadsStreamState[threadId])
	useEffect(() => {
		ss(chatThreadsStreamState[threadId])
		const listener = (threadId_: string) => {
			if (threadId_ !== threadId) return
			ss(chatThreadsStreamState[threadId])
		}
		chatThreadsStreamStateListeners.add(listener)
		return () => { chatThreadsStreamStateListeners.delete(listener) }
	}, [ss, threadId])
	return s
}

export const useFullChatThreadsStreamState = () => {
	const [s, ss] = useState(chatThreadsStreamState)
	useEffect(() => {
		ss(chatThreadsStreamState)
		const listener = () => { ss(chatThreadsStreamState) }
		chatThreadsStreamStateListeners.add(listener)
		return () => { chatThreadsStreamStateListeners.delete(listener) }
	}, [ss])
	return s
}



export const useRefreshModelState = () => {
	const [s, ss] = useState(refreshModelState)
	useEffect(() => {
		ss(refreshModelState)
		refreshModelStateListeners.add(ss)
		return () => { refreshModelStateListeners.delete(ss) }
	}, [ss])
	return s
}


export const useRefreshModelListener = (listener: (providerName: RefreshableProviderName, s: RefreshModelStateOfProvider) => void) => {
	useEffect(() => {
		refreshModelProviderListeners.add(listener)
		return () => { refreshModelProviderListeners.delete(listener) }
	}, [listener, refreshModelProviderListeners])
}

export const useCtrlKZoneStreamingState = (listener: (diffareaid: number, s: boolean) => void) => {
	useEffect(() => {
		ctrlKZoneStreamingStateListeners.add(listener)
		return () => { ctrlKZoneStreamingStateListeners.delete(listener) }
	}, [listener, ctrlKZoneStreamingStateListeners])
}

export const useIsDark = () => {
	const [s, ss] = useState(colorThemeState)
	useEffect(() => {
		ss(colorThemeState)
		colorThemeStateListeners.add(ss)
		return () => { colorThemeStateListeners.delete(ss) }
	}, [ss])

	// s is the theme, return isDark instead of s
	const isDark = s === ColorScheme.DARK || s === ColorScheme.HIGH_CONTRAST_DARK
	return isDark
}

export const useCommandBarURIListener = (listener: (uri: URI) => void) => {
	useEffect(() => {
		commandBarURIStateListeners.add(listener);
		return () => { commandBarURIStateListeners.delete(listener) };
	}, [listener]);
};
export const useCommandBarState = () => {
	const accessor = useAccessor()
	const commandBarService = accessor.get('ICortexideCommandBarService')
	const [s, ss] = useState({ stateOfURI: commandBarService.stateOfURI, sortedURIs: commandBarService.sortedURIs });
	const listener = useCallback(() => {
		ss({ stateOfURI: commandBarService.stateOfURI, sortedURIs: commandBarService.sortedURIs });
	}, [commandBarService])
	useCommandBarURIListener(listener)

	return s;
}



// roughly gets the active URI - this is used to get the history of recent URIs
export const useActiveURI = () => {
	const accessor = useAccessor()
	const commandBarService = accessor.get('ICortexideCommandBarService')
	const [s, ss] = useState(commandBarService.activeURI)
	useEffect(() => {
		const listener = () => { ss(commandBarService.activeURI) }
		activeURIListeners.add(listener);
		return () => { activeURIListeners.delete(listener) };
	}, [])
	return { uri: s }
}




export const useMCPServiceState = () => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')
	const [s, ss] = useState(mcpService.state)
	useEffect(() => {
		const listener = () => { ss(mcpService.state) }
		mcpListeners.add(listener);
		return () => { mcpListeners.delete(listener) };
	}, []);
	return s
}

export const useBackgroundAgentsState = () => {
	const accessor = useAccessor()
	const backgroundAgentsService = accessor.get('IBackgroundAgentsService')
	const [s, ss] = useState(backgroundAgentsService.state)
	useEffect(() => {
		const listener = () => { ss(backgroundAgentsService.state) }
		backgroundAgentsListeners.add(listener);
		return () => { backgroundAgentsListeners.delete(listener) };
	}, []);
	return s
}



export const useLocale = () => {
	const [s, ss] = useState(localeState)
	useEffect(() => {
		ss(localeState)
		localeStateListeners.add(ss)
		return () => { localeStateListeners.delete(ss) }
	}, [ss])
	return s
}

export const useRulesState = () => {
	const [s, ss] = useState<ProjectRule[]>(rulesState)
	useEffect(() => {
		ss(rulesState)
		rulesStateListeners.add(ss)
		return () => { rulesStateListeners.delete(ss) }
	}, [ss])
	return s
}

export const useIsOptedOut = () => {
	const accessor = useAccessor()
	const storageService = accessor.get('IStorageService')

	const getVal = useCallback(() => {
		return storageService.getBoolean(OPT_OUT_KEY, StorageScope.APPLICATION, false)
	}, [storageService])

	const [s, ss] = useState(getVal())

	useEffect(() => {
		const disposables = new DisposableStore();
		const d = storageService.onDidChangeValue(StorageScope.APPLICATION, OPT_OUT_KEY, disposables)(e => {
			ss(getVal())
		})
		disposables.add(d)
		return () => disposables.clear()
	}, [storageService, getVal])

	return s
}
