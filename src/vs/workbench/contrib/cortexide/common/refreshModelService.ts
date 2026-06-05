/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ICortexideSettingsService } from './cortexideSettingsService.js';
import { ILLMMessageService } from './sendLLMMessageService.js';
import { IRemoteCatalogService } from './remoteCatalogService.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { RefreshableProviderName, refreshableProviderNames, SettingsOfProvider, ProviderName, nonlocalProviderNames } from './cortexideSettingsTypes.js';
import { OllamaModelResponse, OpenaiCompatibleModelResponse } from './sendLLMMessageTypes.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';




type TimerHandle = ReturnType<typeof setTimeout>;

type RefreshableState = ({
	state: 'init',
	timeoutId: null,
} | {
	state: 'refreshing',
	timeoutId: TimerHandle | null, // the timeoutId of the most recent call to refreshModels
} | {
	state: 'finished',
	timeoutId: null,
} | {
	state: 'error',
	timeoutId: null,
})


/*

user click -> error -> fire(error)
		   \> success -> fire(success)
	finally: keep polling

poll -> do not fire

*/
export type RefreshModelStateOfProvider = Record<RefreshableProviderName, RefreshableState>



const refreshBasedOn: { [k in RefreshableProviderName]: (keyof SettingsOfProvider[k])[] } = {
	ollama: ['_didFillInProviderSettings', 'endpoint'],
	vLLM: ['_didFillInProviderSettings', 'endpoint'],
	lmStudio: ['_didFillInProviderSettings', 'endpoint'],
	// openAICompatible: ['_didFillInProviderSettings', 'endpoint', 'apiKey'],
}
const REFRESH_INTERVAL = 5_000
// const COOLDOWN_TIMEOUT = 300

const autoOptions = { enableProviderOnSuccess: true, doNotFire: true }

// element-wise equals
function eq<T>(a: T[], b: T[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}
export interface IRefreshModelService {
	readonly _serviceBrand: undefined;
	startRefreshingModels: (providerName: RefreshableProviderName, options: { enableProviderOnSuccess: boolean, doNotFire: boolean }) => void;
	/** Fetch the provider's online catalog and merge it in. Returns the number of chat models found (0 if the provider has no online catalog / the fetch failed). */
	refreshRemoteCatalog: (providerName: ProviderName, forceRefresh?: boolean) => Promise<number>;
	onDidChangeState: Event<RefreshableProviderName>;
	state: RefreshModelStateOfProvider;
}

export const IRefreshModelService = createDecorator<IRefreshModelService>('RefreshModelService');

export class RefreshModelService extends Disposable implements IRefreshModelService {

	readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = new Emitter<RefreshableProviderName>();
	readonly onDidChangeState: Event<RefreshableProviderName> = this._onDidChangeState.event; // this is primarily for use in react, so react can listen + update on state changes


	constructor(
		@ICortexideSettingsService private readonly cortexideSettingsService: ICortexideSettingsService,
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
		@IRemoteCatalogService private readonly remoteCatalogService: IRemoteCatalogService,
	) {
		super()


		const disposables: Set<IDisposable> = new Set()

		const initializeAutoPollingAndOnChange = () => {
			this._clearAllTimeouts()
			disposables.forEach(d => d.dispose())
			disposables.clear()

			if (!cortexideSettingsService.state.globalSettings.autoRefreshModels) return

			for (const providerName of refreshableProviderNames) {

				// const { '_didFillInProviderSettings': enabled } = this.cortexideSettingsService.state.settingsOfProvider[providerName]
				this.startRefreshingModels(providerName, autoOptions)

				// every time providerName.enabled changes, refresh models too, like a useEffect
				let relevantVals = () => refreshBasedOn[providerName].map(settingName => cortexideSettingsService.state.settingsOfProvider[providerName][settingName])
				let prevVals = relevantVals() // each iteration of a for loop has its own context and vars, so this is ok
				disposables.add(
					cortexideSettingsService.onDidChangeState(() => { // we might want to debounce this
						const newVals = relevantVals()
						if (!eq(prevVals, newVals)) {

							const prevEnabled = prevVals[0] as boolean
							const enabled = newVals[0] as boolean

							// if it was just enabled, or there was a change and it wasn't to the enabled state, refresh
							if ((enabled && !prevEnabled) || (!enabled && !prevEnabled)) {
								// if user just clicked enable, refresh
								this.startRefreshingModels(providerName, autoOptions)
							}
							else {
								// else if user just clicked disable, don't refresh

								// //give cooldown before re-enabling (or at least re-fetching)
								// const timeoutId = setTimeout(() => this.refreshModels(providerName, !enabled), COOLDOWN_TIMEOUT)
								// this._setTimeoutId(providerName, timeoutId)
							}
							prevVals = newVals
						}
					})
				)
			}
		}

		// on mount (when get init settings state), and if a relevant feature flag changes, start refreshing models
		cortexideSettingsService.waitForInitState.then(() => {
			initializeAutoPollingAndOnChange()
			this._register(
				cortexideSettingsService.onDidChangeState((type) => { if (typeof type === 'object' && type[1] === 'autoRefreshModels') initializeAutoPollingAndOnChange() })
			)
			// Cloud providers don't have a /list channel like the local providers, so they never auto-refreshed
			// online and their model lists were frozen hardcoded snapshots. Fetch each configured cloud
			// provider's catalog once on launch (cheap, TTL-cached for 1h, errors swallowed) so newly released
			// models show up without a manual click. Gated by autoRefreshModels like the local poll. (#13)
			this._autoRefreshConfiguredRemoteCatalogs()
		})

	}

	/** Fire-and-forget: refresh the online catalog of every configured non-local provider (respects the 1h cache). */
	private _autoRefreshConfiguredRemoteCatalogs() {
		if (!this.cortexideSettingsService.state.globalSettings.autoRefreshModels) return
		for (const providerName of nonlocalProviderNames) {
			const ps = this.cortexideSettingsService.state.settingsOfProvider[providerName]
			if (!ps?._didFillInProviderSettings) continue
			// refreshRemoteCatalog already no-ops for local providers and swallows fetch/CORS errors to [].
			this.refreshRemoteCatalog(providerName, false).catch(err =>
				console.warn(`[RefreshModelService] auto catalog refresh failed for ${providerName}:`, err))
		}
	}

	state: RefreshModelStateOfProvider = {
		ollama: { state: 'init', timeoutId: null },
		vLLM: { state: 'init', timeoutId: null },
		lmStudio: { state: 'init', timeoutId: null },
	}


	// start listening for models (and don't stop)
	startRefreshingModels: IRefreshModelService['startRefreshingModels'] = (providerName, options) => {

		this._clearProviderTimeout(providerName)

		this._setRefreshState(providerName, 'refreshing', options)

		const autoPoll = () => {
			if (this.cortexideSettingsService.state.globalSettings.autoRefreshModels) {
				// resume auto-polling
				const timeoutId = setTimeout(() => this.startRefreshingModels(providerName, autoOptions), REFRESH_INTERVAL)
				this._setTimeoutId(providerName, timeoutId)
			}
		}
		const listFn = providerName === 'ollama' ? this.llmMessageService.ollamaList
			: this.llmMessageService.openAICompatibleList

		listFn({
			providerName,
			onSuccess: ({ models }) => {
				// Capture the REAL parameter size ollama reports (details.parameter_size, e.g. "7.6B")
				// so the router can prefer a true 7B over a tiny ":latest" coder (e.g. deepseek-coder
				// :latest ~1.3B). Only ollama exposes this; vLLM/lmStudio don't.
				const paramSizeOfModelName: Record<string, string> = {}
				if (providerName === 'ollama') {
					for (const m of models as OllamaModelResponse[]) {
						const ps = m?.details?.parameter_size
						if (m?.name && ps) { paramSizeOfModelName[m.name] = ps }
					}
				}
				// set the models to the detected models
				this.cortexideSettingsService.setAutodetectedModels(
					providerName,
					models.map(model => {
						if (providerName === 'ollama') return (model as OllamaModelResponse).name;
						else if (providerName === 'vLLM') return (model as OpenaiCompatibleModelResponse).id;
						else if (providerName === 'lmStudio') return (model as OpenaiCompatibleModelResponse).id;
						else throw new Error('refreshMode fn: unknown provider', providerName);
					}),
					{ enableProviderOnSuccess: options.enableProviderOnSuccess, hideRefresh: options.doNotFire },
					paramSizeOfModelName
				)

				if (options.enableProviderOnSuccess) this.cortexideSettingsService.setSettingOfProvider(providerName, '_didFillInProviderSettings', true)

				this._setRefreshState(providerName, 'finished', options)
				autoPoll()
			},
			onError: ({ error }) => {
				this._setRefreshState(providerName, 'error', options)
				autoPoll()
			}
		})


	}

	_clearAllTimeouts() {
		for (const providerName of refreshableProviderNames) {
			this._clearProviderTimeout(providerName)
		}
	}

	_clearProviderTimeout(providerName: RefreshableProviderName) {
		// cancel any existing poll
		if (this.state[providerName].timeoutId) {
			clearTimeout(this.state[providerName].timeoutId)
			this._setTimeoutId(providerName, null)
		}
	}

	private _setTimeoutId(providerName: RefreshableProviderName, timeoutId: TimerHandle | null) {
		this.state[providerName].timeoutId = timeoutId
	}

	private _setRefreshState(providerName: RefreshableProviderName, state: RefreshableState['state'], options?: { doNotFire: boolean }) {
		if (options?.doNotFire) return
		this.state[providerName].state = state
		this._onDidChangeState.fire(providerName)
	}

	/**
	 * Refresh remote provider catalog and update available models
	 */
	refreshRemoteCatalog: IRefreshModelService['refreshRemoteCatalog'] = async (providerName, forceRefresh = false) => {
		// Only refresh remote providers (not local ones like ollama, vLLM, lmStudio)
		if (refreshableProviderNames.includes(providerName as RefreshableProviderName)) {
			// Local providers use startRefreshingModels instead
			return 0;
		}

		try {
			const models = await this.remoteCatalogService.fetchCatalog(providerName, forceRefresh);

			// Convert RemoteModelInfo to model names and add to settings
			const modelNames = models
				.filter(m => !m.deprecated && !m.beta) // Filter out deprecated/beta models
				.map(m => m.id || m.name)
				.filter((n): n is string => !!n);

			if (modelNames.length > 0) {
				// Use setAutodetectedModels to add/update models
				// For remote providers, we'll mark them as 'autodetected' type
				this.cortexideSettingsService.setAutodetectedModels(
					providerName,
					modelNames,
					{ source: 'remoteCatalog', forceRefresh }
				);
			}
			// Return the real count so callers (the Settings refresh button) report honestly instead of
			// always flashing "catalog refreshed!" even when nothing was fetched (the old stub behaviour).
			return modelNames.length;
		} catch (error) {
			console.error(`Failed to refresh remote catalog for ${providerName}:`, error);
			throw error;
		}
	}
}

registerSingleton(IRefreshModelService, RefreshModelService, InstantiationType.Eager);

