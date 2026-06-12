/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { StorageTarget, StorageScope } from '../../../../platform/storage/common/storage.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IMetricsService } from '../common/metricsService.js';
import { PostHog } from 'posthog-node'
import { OPT_OUT_KEY } from '../common/storageKeys.js';
import { isTelemetryEnabled } from '../common/telemetryConsent.js';
import { resolveLocalOnlyForMainProcess } from '../common/egressPolicy.js';


const os = isWindows ? 'windows' : isMacintosh ? 'mac' : isLinux ? 'linux' : null
const _getOSInfo = () => {
	try {
		const { platform, arch } = process // see platform.ts
		return { platform, arch }
	}
	catch (e) {
		return { osInfo: { platform: '??', arch: '??' } }
	}
}
const osInfo = _getOSInfo()

// we'd like to use devDeviceId on telemetryService, but that gets sanitized by the time it gets here as 'someValue.devDeviceId'



export class MetricsMainService extends Disposable implements IMetricsService {
	_serviceBrand: undefined;

	private readonly client: PostHog

	private _initProperties: object = {}


// helper - looks like this is stored in a .vscdb file in ~/Library/Application Support/CortexIDE
	private _memoStorage(key: string, target: StorageTarget, setValIfNotExist?: string) {
		const currVal = this._appStorage.get(key, StorageScope.APPLICATION)
		if (currVal !== undefined) return currVal
		const newVal = setValIfNotExist ?? generateUuid()
		this._appStorage.store(key, newVal, StorageScope.APPLICATION, target)
		return newVal
	}


	// this is old, eventually we can just delete this since all the keys will have been transferred over
	// returns 'NULL' or the old key
	private get oldId() {
		// check new storage key first
		const newKey = 'cortexide.app.oldMachineId'
		const newOldId = this._appStorage.get(newKey, StorageScope.APPLICATION)
		if (newOldId) return newOldId

		// put old key into new key if didn't already
		const oldValue = this._appStorage.get('cortexide.machineId', StorageScope.APPLICATION) ?? 'NULL' // the old way of getting the key
		this._appStorage.store(newKey, oldValue, StorageScope.APPLICATION, StorageTarget.MACHINE)
		return oldValue

		// in a few weeks we can replace above with this
		// private get oldId() {
		// 	return this._memoStorage('cortexide.app.oldMachineId', StorageTarget.MACHINE, 'NULL')
		// }
	}


	// the main id
	private get distinctId() {
		const oldId = this.oldId
		const setValIfNotExist = oldId === 'NULL' ? undefined : oldId
		return this._memoStorage('cortexide.app.machineId', StorageTarget.MACHINE, setValIfNotExist)
	}

	// just to see if there are ever multiple machineIDs per userID (instead of this, we should just track by the user's email)
	private get userId() {
		return this._memoStorage('cortexide.app.userMachineId', StorageTarget.USER)
	}

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IApplicationStorageMainService private readonly _appStorage: IApplicationStorageMainService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super()
		this.client = new PostHog('phc_UanIdujHiLp55BkUTjB1AuBXcasVkdqRwgnwRlWESH2', {
			host: 'https://us.i.posthog.com',
		})

		this.initialize() // async
	}

	async initialize() {
		// very important to await whenReady!
		await this._appStorage.whenReady

		const { commit, version, cortexVersion, release, quality } = this._productService as any

		const isDevMode = !this._envMainService.isBuilt // found in abstractUpdateService.ts

		// custom properties we identify
		this._initProperties = {
			commit,
			vscodeVersion: version,
			cortexVersion: cortexVersion,
			release,
			os,
			quality,
			distinctId: this.distinctId,
			distinctIdUser: this.userId,
			oldId: this.oldId,
			isDevMode,
			...osInfo,
		}

		const identifyMessage = {
			distinctId: this.distinctId,
			properties: this._initProperties,
		}

		// Telemetry is opt-IN: default OFF, local-only always forces off (was opt-OUT/on-by-default).
		const enabled = this._telemetryEnabled()
		const localOnly = resolveLocalOnlyForMainProcess(
			this._configurationService.getValue('cortexide.global.routingPolicy'),
			this._configurationService.getValue<boolean>('cortexide.global.localFirstAI'),
		)

		console.log('CortexIDE telemetry enabled (opt-in)?', enabled, '(local-only privacy mode:', localOnly, ')')
		if (enabled) {
			this.client.optIn()
			this.client.identify(identifyMessage)
			console.log('CortexIDE posthog metrics info:', JSON.stringify(identifyMessage, null, 2))
		}
		else {
			this.client.optOut()
		}
	}

	/**
	 * Phase 8 (telemetry opt-IN): telemetry may leave the machine only if the user EXPLICITLY opted
	 * in (OPT_OUT_KEY stored as 'false') AND local-only privacy mode is off. Absent preference =>
	 * OFF. Re-checked on every capture so toggling local-only / consent takes effect immediately.
	 */
	private _telemetryEnabled(): boolean {
		const stored = this._appStorage.get(OPT_OUT_KEY, StorageScope.APPLICATION)
		// routingPolicy mirror (true source) + localFirstAI fallback, so an in-app "Local only" gates this.
		const localOnly = resolveLocalOnlyForMainProcess(
			this._configurationService.getValue('cortexide.global.routingPolicy'),
			this._configurationService.getValue<boolean>('cortexide.global.localFirstAI'),
		)
		return isTelemetryEnabled(stored, localOnly)
	}


	capture: IMetricsService['capture'] = (event, params) => {
		// defense-in-depth: re-check so a mid-session opt-out / local-only toggle stops events at once
		if (!this._telemetryEnabled()) { return }
		const capture = { distinctId: this.distinctId, event, properties: params } as const
		// console.log('full capture:', this.distinctId)
		this.client.capture(capture)
	}

	setOptOut: IMetricsService['setOptOut'] = (newVal: boolean) => {
		// store 'true' (opt out) / 'false' (opt in) explicitly -- under the opt-in default, opting in must persist
		this._appStorage.store(OPT_OUT_KEY, newVal ? 'true' : 'false', StorageScope.APPLICATION, StorageTarget.MACHINE)
		if (newVal) { this.client.optOut() } else if (this._telemetryEnabled()) { this.client.optIn() }
	}

	async getDebuggingProperties() {
		return this._initProperties
	}
}


