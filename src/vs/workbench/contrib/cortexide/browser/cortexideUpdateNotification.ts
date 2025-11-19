/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { URI } from '../../../../base/common/uri.js';
import { IAction } from '../../../../base/common/actions.js';
import { localize2 } from '../../../../nls.js';

const LAST_SEEN_VERSION_KEY = 'cortexide.update.lastSeenVersion';
const UPDATE_NOTIFICATION_DISMISSED_KEY = 'cortexide.update.notificationDismissed';

/**
 * Shows a notification when a new version is detected after installation or update.
 * Similar to Cursor's update notification system.
 */
class CortexideUpdateNotificationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.cortexide.updateNotification';

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
		@IProductService private readonly _productService: IProductService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IHostService private readonly _hostService: IHostService,
		@IOpenerService private readonly _openerService: IOpenerService,
	) {
		super();

		// Wait for the window to have focus before showing the notification
		this._hostService.hadLastFocus().then(async (hadLastFocus: boolean) => {
			if (!hadLastFocus) {
				return;
			}

			// Small delay to ensure the UI is fully loaded
			await new Promise(resolve => setTimeout(resolve, 2000));

			this._checkAndShowUpdateNotification();
		});
	}

	private _checkAndShowUpdateNotification(): void {
		const currentVersion = this._productService.version;
		const lastSeenVersion = this._storageService.get(LAST_SEEN_VERSION_KEY, StorageScope.APPLICATION, '');

		// If this is the first time running or version has changed
		if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
			// Check if user has already dismissed the notification for this version
			const dismissedVersion = this._storageService.get(UPDATE_NOTIFICATION_DISMISSED_KEY, StorageScope.APPLICATION, '');

			if (dismissedVersion !== currentVersion) {
				const isNewInstallation = !lastSeenVersion;
				this._showUpdateNotification(currentVersion, isNewInstallation);
			}

			// Update the last seen version
			this._storageService.store(LAST_SEEN_VERSION_KEY, currentVersion, StorageScope.APPLICATION, StorageTarget.MACHINE);
		}
	}

	private _showUpdateNotification(version: string, isNewInstallation: boolean): void {
		const message = isNewInstallation
			? localize2('updateNotification.welcome', 'Welcome to {0} {1}!', this._productService.nameLong, version).value
			: localize2('updateNotification.updated', '{0} has been updated to {1}!', this._productService.nameLong, version).value;

		const primaryActions: IAction[] = [];

		// Add "What's New" button if release notes URL is available
		if (this._productService.releaseNotesUrl) {
			primaryActions.push({
				id: 'cortexide.update.whatsNew',
				label: localize2('updateNotification.whatsNew', 'What\'s New').value,
				enabled: true,
				tooltip: localize2('updateNotification.whatsNewTooltip', 'View release notes').value,
				class: undefined,
				run: async () => {
					const uri = URI.parse(this._productService.releaseNotesUrl!);
					await this._openerService.open(uri);
				}
			});
		} else {
			// Fallback to GitHub releases if no release notes URL is configured
			primaryActions.push({
				id: 'cortexide.update.whatsNew',
				label: localize2('updateNotification.whatsNew', 'What\'s New').value,
				enabled: true,
				tooltip: localize2('updateNotification.whatsNewTooltip', 'View release notes').value,
				class: undefined,
				run: async () => {
					const uri = URI.parse('https://github.com/opencortexide/cortexide/releases');
					await this._openerService.open(uri);
				}
			});
		}

		// Add dismiss button
		const notificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: message,
			actions: {
				primary: primaryActions,
				secondary: [
					{
						id: 'cortexide.update.dismiss',
						label: localize2('updateNotification.dismiss', 'Dismiss').value,
						enabled: true,
						tooltip: localize2('updateNotification.dismissTooltip', 'Dismiss this notification').value,
						class: undefined,
						run: () => {
							// Mark this version as dismissed
							this._storageService.store(
								UPDATE_NOTIFICATION_DISMISSED_KEY,
								version,
								StorageScope.APPLICATION,
								StorageTarget.USER
							);
							notificationHandle.close();
						}
					}
				]
			},
			sticky: isNewInstallation, // Sticky for new installations, auto-dismiss for updates
		});

		// Auto-dismiss after 30 seconds if it's not a new installation
		if (!isNewInstallation) {
			const timeoutId = setTimeout(() => {
				try {
					notificationHandle.close();
				} catch (e) {
					// Notification may have already been closed
				}
			}, 30000);
			// Clean up timeout if notification is closed early
			notificationHandle.onDidClose(() => {
				clearTimeout(timeoutId);
			});
		}
	}
}

registerWorkbenchContribution2(
	CortexideUpdateNotificationContribution.ID,
	CortexideUpdateNotificationContribution,
	WorkbenchPhase.Eventually
);

