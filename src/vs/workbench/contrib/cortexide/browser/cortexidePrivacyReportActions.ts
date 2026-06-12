/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { IMCPService } from '../common/mcpService.js';
import { IAiEmbeddingVectorService } from '../../../services/aiEmbeddingVector/common/aiEmbeddingVectorService.js';
import { ProviderName } from '../common/cortexideSettingsTypes.js';
import { buildEgressReport, formatEgressReport, EgressReportConfig } from '../common/egressReport.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { OPT_OUT_KEY } from '../common/storageKeys.js';

/**
 * Phase 8: a user-facing "what can leave my machine" privacy report. Gathers the current routing
 * policy + configuration from the live services, builds the pure egress posture report
 * (egressReport.ts), and opens it in an editor so the user can see -- and copy -- exactly which
 * network channels are open vs blocked under their current settings.
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			f1: true,
			id: 'cortexide.showPrivacyReport',
			title: localize2('cortexideShowPrivacyReport', 'CortexIDE: Show Privacy Report (What Can Leave My Machine)'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		try {
			const settingsService = accessor.get(ICortexideSettingsService);
			const configService = accessor.get(IConfigurationService);
			const editorService = accessor.get(IEditorService);
			const mcpService = accessor.get(IMCPService);

			let embeddingsEnabled = false;
			try { embeddingsEnabled = accessor.get(IAiEmbeddingVectorService).isEnabled(); } catch { /* embedding service optional */ }

			const gs = settingsService.state.globalSettings;
			const sop = settingsService.state.settingsOfProvider;

			const configuredProviders = (Object.keys(sop) as ProviderName[])
				.filter(p => sop[p]?._didFillInProviderSettings)
				.map(p => ({ providerName: p, endpoint: sop[p]?.endpoint || undefined }));

			// The runtime MCP state only carries a display `command` string; classify it best-effort
			// (a URL-looking command -- http(s) OR ws(s) -- is a remote/loopback server, otherwise it
			// is a local stdio spawn). The ACTUAL connect gate (mcpChannel) classifies the real URL.
			const mcpServers = Object.entries(mcpService.state.mcpServerOfName).map(([name, s]) => {
				const cmd = (s as { command?: string }).command;
				const looksUrl = !!cmd && /^(https?|wss?):\/\//i.test(cmd);
				return { name, url: looksUrl ? cmd : undefined, isStdio: !looksUrl };
			});

			const cfg: EgressReportConfig = {
				routingPolicy: gs.routingPolicy,
				localFirstAI: gs.localFirstAI,
				configuredProviders,
				embeddingsEnabled,
				vectorStore: (configService.getValue<'none' | 'qdrant' | 'chroma'>('cortexide.rag.vectorStore')) || 'none',
				vectorStoreUrl: configService.getValue<string>('cortexide.rag.vectorStoreUrl') || undefined,
				mcpServers,
				telemetryOptOutStoredValue: accessor.get(IStorageService).get(OPT_OUT_KEY, StorageScope.APPLICATION),
			};

			const report = buildEgressReport(cfg);

			await editorService.openEditor({
				resource: undefined,
				contents: formatEgressReport(report),
				languageId: 'text',
				options: { pinned: true },
			});

			notificationService.info(report.summary);
		} catch (err) {
			notificationService.error(`Failed to show the CortexIDE privacy report: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
});
