/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { asJson, IRequestService } from '../../../../platform/request/common/request.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { ICortexideUpdateService } from '../common/cortexideUpdateService.js';
import { CortexideCheckUpdateResponse } from '../common/cortexideUpdateServiceTypes.js';
import { canEgress, resolveLocalOnlyForMainProcess } from '../common/egressPolicy.js';



export class CortexideMainUpdateService extends Disposable implements ICortexideUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IRequestService private readonly _requestService: IRequestService,
	) {
		super()
	}


	async check(explicit: boolean): Promise<CortexideCheckUpdateResponse> {

		const isDevMode = !this._envMainService.isBuilt // found in abstractUpdateService.ts

		if (isDevMode) {
			return { message: null } as const
		}

		// EGRESS GATE: under local-only, skip the update check (it hits the GitHub releases API).
		// Resolve from the routingPolicy mirror + localFirstAI fallback (reading only localFirstAI
		// missed in-app "Local only" selections). NOTE: the platform auto-updater (update.mode) is a
		// separate VS Code egress an air-gapped user should also disable.
		{
			const localOnly = resolveLocalOnlyForMainProcess(
				this._configurationService.getValue('cortexide.global.routingPolicy'),
				this._configurationService.getValue<boolean>('cortexide.global.localFirstAI'),
			)
			const decision = canEgress({ routingPolicy: localOnly ? 'local-only' : undefined }, { modality: 'update-check', destinationKind: 'remote' })
			if (!decision.allowed) {
				return { message: explicit ? (decision.reason ?? 'Update check skipped: local-only privacy mode is on.') : null } as const
			}
		}

		// if disabled and not explicitly checking, return early
		if (this._updateService.state.type === StateType.Disabled) {
			if (!explicit)
				return { message: null } as const
		}

		this._updateService.checkForUpdates(false) // implicity check, then handle result ourselves

		if (this._updateService.state.type === StateType.Uninitialized) {
			// The update service hasn't been initialized yet
			return { message: explicit ? 'Checking for updates soon...' : null, action: explicit ? 'reinstall' : undefined } as const
		}

		if (this._updateService.state.type === StateType.Idle) {
			// No updates currently available
			return { message: explicit ? 'No updates found!' : null, action: explicit ? 'reinstall' : undefined } as const
		}

		if (this._updateService.state.type === StateType.CheckingForUpdates) {
			// Currently checking for updates
			return { message: explicit ? 'Checking for updates...' : null } as const
		}

		if (this._updateService.state.type === StateType.AvailableForDownload) {
			// Update available but requires manual download (mainly for Linux)
			return { message: 'A new update is available!', action: 'download', } as const
		}

		if (this._updateService.state.type === StateType.Downloading) {
			// Update is currently being downloaded
			return { message: explicit ? 'Currently downloading update...' : null } as const
		}

		if (this._updateService.state.type === StateType.Downloaded) {
			// Update has been downloaded but not yet ready
			return { message: explicit ? 'An update is ready to be applied!' : null, action: 'apply' } as const
		}

		if (this._updateService.state.type === StateType.Updating) {
			// Update is being applied
			return { message: explicit ? 'Applying update...' : null } as const
		}

		if (this._updateService.state.type === StateType.Ready) {
			// Update is ready
			return { message: 'Restart CortexIDE to update!', action: 'restart' } as const
		}

		if (this._updateService.state.type === StateType.Disabled) {
			const channel = this._configurationService.getValue<'stable' | 'beta' | 'nightly'>('update.updateChannel') || 'stable';
			return await this._manualCheckGHTagIfDisabled(explicit, channel)
		}
		return null
	}






	private async _manualCheckGHTagIfDisabled(explicit: boolean, channel: 'stable' | 'beta' | 'nightly'): Promise<CortexideCheckUpdateResponse> {
		try {
			let releaseUrl: string;
			if (channel === 'beta') {
				releaseUrl = 'https://api.github.com/repos/OpenCortexIDE/cortexide/releases?per_page=1';
			} else if (channel === 'nightly') {
				releaseUrl = 'https://api.github.com/repos/OpenCortexIDE/cortexide/releases?per_page=1';
			} else {
				releaseUrl = 'https://api.github.com/repos/OpenCortexIDE/cortexide/releases/latest';
			}

			const context = await this._requestService.request({ url: releaseUrl, type: 'GET', callSite: 'cortexide.updateCheck' }, CancellationToken.None);
			if (context.res.statusCode !== 200) {
				throw new Error(`GitHub API returned ${context.res.statusCode}`);
			}

			const jsonData = await asJson(context);
			const data = channel === 'stable'
				? jsonData
				: Array.isArray(jsonData) ? jsonData[0] : jsonData;

			if (!data || !data.tag_name) {
				throw new Error('Invalid release data');
			}

			const version = data.tag_name;

			const myVersion = this._productService.version
			const latestVersion = version

			const isUpToDate = myVersion === latestVersion // only makes sense if response.ok

			let message: string | null
			let action: 'reinstall' | undefined

			// explicit
			if (explicit) {
				if (!isUpToDate) {
					message = 'A new version of CortexIDE is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!'
					action = 'reinstall'
				}
				else {
					message = 'CortexIDE is up-to-date!'
				}
			}
			// not explicit
			else {
				if (!isUpToDate) {
					message = 'A new version of CortexIDE is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!'
					action = 'reinstall'
				}
				else {
					message = null
				}
			}
			return { message, action } as const
		}
		catch (e) {
			if (explicit) {
				return {
					message: `An error occurred when fetching the latest GitHub release tag: ${e}. Please try again in ~5 minutes.`,
					action: 'reinstall',
				}
			}
			else {
				return { message: null } as const
			}
		}
	}
}
