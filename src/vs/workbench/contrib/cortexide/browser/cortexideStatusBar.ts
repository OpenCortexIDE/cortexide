/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { metricsCollector } from '../common/metricsCollector.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IChatThreadService } from './chatThreadService.js';
import { localProviderNames } from '../common/cortexideSettingsTypes.js';
import { ProviderName } from '../common/cortexideSettingsTypes.js';
import { IFreeTierQuotaService, FreeTierRemaining } from '../common/routing/freeTierQuotaService.js';
import { freeTierIdOfProviderName, FREE_TIER_QUOTAS, FreeTierProviderId } from '../common/routing/freeTierConstants.js';
import { buildFreeTierLadder } from '../common/routing/freeTierLadder.js';
import { ICortexideI18nService } from '../common/i18n/i18nService.js';

export class CortexideStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.cortexideStatusBar';

	private modelEntry: IStatusbarEntryAccessor | undefined;
	private latencyEntry: IStatusbarEntryAccessor | undefined;
	private privacyEntry: IStatusbarEntryAccessor | undefined;
	private freeTierEntry: IStatusbarEntryAccessor | undefined;
	private readonly updateDisposables = this._register(new MutableDisposable());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@ICortexideSettingsService private readonly cortexideSettingsService: ICortexideSettingsService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@IFreeTierQuotaService private readonly freeTierQuotaService: IFreeTierQuotaService,
		@ICortexideI18nService private readonly i18nService: ICortexideI18nService,
	) {
		super();
		this.create();
		this.registerListeners();
	}

	private create(): void {
		// Model badge entry
		this.modelEntry = this.statusbarService.addEntry(
			this.getModelEntryProps(),
			'cortexide.model',
			StatusbarAlignment.RIGHT,
			{ location: { id: 'status.editor.mode', priority: 100.2 }, alignment: StatusbarAlignment.RIGHT }
		);

		// Latency pulse entry
		this.latencyEntry = this.statusbarService.addEntry(
			this.getLatencyEntryProps(),
			'cortexide.latency',
			StatusbarAlignment.RIGHT,
			{ location: { id: 'status.editor.mode', priority: 100.3 }, alignment: StatusbarAlignment.RIGHT }
		);

		// Privacy/offline indicator entry
		this.privacyEntry = this.statusbarService.addEntry(
			this.getPrivacyEntryProps(),
			'cortexide.privacy',
			StatusbarAlignment.RIGHT,
			{ location: { id: 'status.editor.mode', priority: 100.4 }, alignment: StatusbarAlignment.RIGHT }
		);

		// Free-tier quota widget
		this.freeTierEntry = this.statusbarService.addEntry(
			this.getFreeTierEntryProps(),
			'cortexide.freeTier',
			StatusbarAlignment.RIGHT,
			{ location: { id: 'status.editor.mode', priority: 100.5 }, alignment: StatusbarAlignment.RIGHT }
		);
	}

	private registerListeners(): void {
		this.updateDisposables.value = this.cortexideSettingsService.onDidChangeState(() => {
			this.modelEntry?.update(this.getModelEntryProps());
		});

		// Listen to stream state changes to update model entry with activity indicator
		this._register(this.chatThreadService.onDidChangeStreamState(() => {
			this.modelEntry?.update(this.getModelEntryProps());
		}));

		// Update latency every 500ms during active requests
		const latencyUpdateInterval = setInterval(() => {
			this.latencyEntry?.update(this.getLatencyEntryProps());
			this.modelEntry?.update(this.getModelEntryProps());
			this.privacyEntry?.update(this.getPrivacyEntryProps());
		}, 500);

		this._register({ dispose: () => clearInterval(latencyUpdateInterval) });

		// Refresh free-tier widget on every quota mutation (recordCall, markExhausted)
		this._register(this.freeTierQuotaService.onQuotaChange(() => {
			this.freeTierEntry?.update(this.getFreeTierEntryProps());
		}));
		// Also refresh on settings changes so newly-added providers appear immediately
		this._register(this.cortexideSettingsService.onDidChangeState(() => {
			this.freeTierEntry?.update(this.getFreeTierEntryProps());
		}));
		// Slow tick to keep window rollovers visible to the user
		const quotaTick = setInterval(() => {
			this.freeTierEntry?.update(this.getFreeTierEntryProps());
		}, 15_000);
		this._register({ dispose: () => clearInterval(quotaTick) });
	}

	private getModelEntryProps(): IStatusbarEntry {
		const settings = this.cortexideSettingsService.state;
		const modelSelection = settings.modelSelectionOfFeature['Chat'];

		// Check if there's any active operation
		const streamState = this.chatThreadService.streamState;
		const currentThreadId = this.chatThreadService.state.currentThreadId;
		const currentStreamState = currentThreadId ? streamState[currentThreadId] : undefined;
		const isRunning = currentStreamState?.isRunning;
		const isActive = isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'preparing';

		// Get status message if preparing
		const statusMessage = isRunning === 'preparing' ? currentStreamState?.llmInfo?.displayContentSoFar : undefined;

		// Check if model is local/offline
		const isLocal = modelSelection && (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);
		const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

		if (!modelSelection || (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto')) {
			const icon = isActive ? '$(loading~spin)' : '$(code)';
			const text = isActive ? `${icon} Auto` : `${icon} Auto`;
			const tooltipReason = isOffline
				? '\n\nReason: Offline mode - using local model'
				: '\n\nReason: Automatic model selection based on task';
			return {
				name: localize('cortexide.model', "Cortexide Model"),
				text,
				ariaLabel: localize('cortexide.model.auto', "Cortexide Model: Auto{0}", isActive ? ' (Active)' : ''),
				tooltip: statusMessage || (localize('cortexide.model.auto.tooltip', "Model: Auto (automatic selection)") + tooltipReason),
			};
		}

		const modelName = modelSelection.modelName;
		const providerName = modelSelection.providerName;
		const displayName = modelName.length > 15 ? modelName.substring(0, 12) + '...' : modelName;
		const icon = isActive ? '$(loading~spin)' : '$(code)';

		// Build enhanced tooltip with reasoning
		let tooltip = statusMessage || localize('cortexide.model.tooltip', "Model: {0} ({1})", modelName, providerName);

		// Add privacy/offline explanation
		if (isLocal) {
			tooltip += '\n\nPrivacy: Local/offline model - data stays on your device';
		} else if (isOffline) {
			tooltip += '\n\nNote: Currently offline - using cached/fallback model';
		} else {
			tooltip += '\n\nPrivacy: Remote model - data sent to provider';
		}

		// Note: Routing reasoning could be added to metrics in the future
		// to provide more detailed "why this model" explanations

		return {
			name: localize('cortexide.model', "Cortexide Model"),
			text: `${icon} ${displayName}`,
			ariaLabel: localize('cortexide.model.selected', "Cortexide Model: {0} ({1}){2}", modelName, providerName, isActive ? ' (Active)' : ''),
			tooltip,
		};
	}

	private getLatencyEntryProps(): IStatusbarEntry {
		// Get latest metrics from latency audit
		const allMetrics = metricsCollector.getAll();
		if (allMetrics.length === 0) {
			return {
				name: localize('cortexide.latency', "Cortexide Latency"),
				text: '',
				ariaLabel: localize('cortexide.latency.idle', "Cortexide Latency: Idle"),
			};
		}

		// Get the most recent request
		const latest = allMetrics[allMetrics.length - 1];
		const ttfs = latest.ttfs;
		const tts = latest.tts;

		// Determine latency status
		let icon = '$(pulse)';
		let status = 'good';

		if (ttfs > 0 && ttfs < 400) {
			status = 'good';
			icon = '$(pulse)';
		} else if (ttfs >= 400 && ttfs < 1000) {
			status = 'warning';
			icon = '$(warning)';
		} else if (ttfs >= 1000) {
			status = 'slow';
			icon = '$(clock)';
		}

		// Calculate tokens per second if available
		let tokensPerSec = '';
		if (tts > 0 && latest.outputTokens > 0) {
			const tps = Math.round((latest.outputTokens / tts) * 1000);
			tokensPerSec = ` ${tps} tok/s`;
		}

		const ttfsDisplay = ttfs > 0 ? `${Math.round(ttfs)}ms` : '—';
		const text = `${icon} ${ttfsDisplay}${tokensPerSec}`;

		return {
			name: localize('cortexide.latency', "Cortexide Latency"),
			text,
			ariaLabel: localize('cortexide.latency.status', "Cortexide Latency: TTFS {0}, Status: {1}", ttfsDisplay, status),
			tooltip: localize('cortexide.latency.tooltip', "Time to first token: {0}ms\nTime to stream: {1}ms{2}", ttfs, tts, tokensPerSec ? `\nSpeed: ${tokensPerSec}` : ''),
		};
	}

	private getPrivacyEntryProps(): IStatusbarEntry {
		const settings = this.cortexideSettingsService.state;
		const modelSelection = settings.modelSelectionOfFeature['Chat'];

		// Check if offline
		const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

		// Check if model is local
		const isLocal = modelSelection && (localProviderNames as readonly ProviderName[]).includes(modelSelection.providerName as ProviderName);

		// Only show privacy indicator if local or offline
		if (!isLocal && !isOffline) {
			return {
				name: localize('cortexide.privacy', "Cortexide Privacy"),
				text: '', // Hide when not applicable
				ariaLabel: '',
			};
		}

		// Determine icon and tooltip
		let icon = '$(lock)';
		let tooltip = '';

		if (isOffline && isLocal) {
			icon = '$(lock)';
			tooltip = localize('cortexide.privacy.offline.local', "Privacy: Offline mode with local model\n\nYour data stays on your device and is never sent to remote servers.");
		} else if (isOffline) {
			icon = '$(cloud-offline)';
			tooltip = localize('cortexide.privacy.offline', "Privacy: Currently offline\n\nNo network connection available.");
		} else if (isLocal) {
			icon = '$(lock)';
			tooltip = localize('cortexide.privacy.local', "Privacy: Local model\n\nYour data stays on your device and is never sent to remote servers.\n\nWhy this model: Privacy mode enabled or local model preferred for this task.");
		}

		return {
			name: localize('cortexide.privacy', "Cortexide Privacy"),
			text: icon,
			ariaLabel: localize('cortexide.privacy.aria', "Cortexide Privacy: {0}", isOffline ? 'Offline' : 'Local'),
			tooltip,
		};
	}

	/**
	 * Free-tier quota widget.  Hides itself when no free-tier providers are
	 * configured; otherwise shows the remaining quota for the currently-active
	 * rung (the provider the router would pick right now), or an "all exhausted"
	 * warning, with a multiline tooltip marking the active provider.
	 */
	private getFreeTierEntryProps(): IStatusbarEntry {
		const t = (key: Parameters<typeof this.i18nService.t>[0], fallback?: string) => this.i18nService.t(key, fallback);
		const configuredFreeTierProviders = this.collectConfiguredFreeTierProviders();
		if (configuredFreeTierProviders.length === 0) {
			return {
				name: t('routing.statusBar.label', 'Free-tier quota'),
				text: '',
				ariaLabel: '',
				tooltip: t('routing.statusBar.tooltipNoProviders', 'No free-tier providers configured.'),
			};
		}

		// Build display text from the highest-quality configured provider.
		// Sort by quality rank descending and use the first usable entry.
		const enriched = configuredFreeTierProviders
			.map(p => ({ ...p, remaining: this.freeTierQuotaService.getRemaining(p.providerId, p.modelName) }))
			.sort((a, b) => b.qualityRank - a.qualityRank);

		// Active rung = the provider the free-tier router would pick right now (first
		// usable by quality). buildFreeTierLadder is the single source of truth, so the
		// badge can never disagree with the router about "which free model am I on".
		const ladder = buildFreeTierLadder({
			configuredModels: enriched.map(e => ({ providerName: e.providerName, modelName: e.modelName })),
			quotas: enriched.map(e => e.remaining),
			privacyMode: false,
		});
		const activeProviderId: FreeTierProviderId | null = ladder.length > 0 ? ladder[0].providerId : null;

		let text: string;
		if (activeProviderId === null) {
			// Every configured free-tier provider is exhausted.
			text = `$(warning) ${t('routing.statusBar.allExhausted', 'Free quota exhausted')}`;
		} else {
			const active = enriched.find(e => e.providerId === activeProviderId) ?? enriched[0];
			text = `$(pulse) ${this.formatProviderStatus(active.remaining)}`;
		}

		// Multiline tooltip listing every provider's status; the active rung is marked.
		const lines: string[] = [t('routing.statusBar.tooltipTitle', 'Free-tier provider quotas')];
		for (const p of enriched) {
			const marker = p.providerId === activeProviderId ? '→ ' : '   ';
			lines.push(marker + this.formatProviderStatus(p.remaining));
		}
		if (activeProviderId === null) {
			lines.push('');
			lines.push(t('routing.statusBar.allExhaustedHint', 'All free-tier quotas exhausted — switch to a local model or add an API key.'));
		}
		const tooltip = lines.join('\n');

		return {
			name: t('routing.statusBar.label', 'Free-tier quota'),
			text,
			ariaLabel: text,
			tooltip,
		};
	}

	/**
	 * Inspect settings to find configured free-tier providers with at least
	 * one visible model.  Returns provider id + first visible model name.
	 */
	private collectConfiguredFreeTierProviders(): Array<{ providerId: NonNullable<ReturnType<typeof freeTierIdOfProviderName>>; providerName: ProviderName; modelName: string; qualityRank: number }> {
		const settings = this.cortexideSettingsService.state;
		const out: Array<{ providerId: NonNullable<ReturnType<typeof freeTierIdOfProviderName>>; providerName: ProviderName; modelName: string; qualityRank: number }> = [];
		for (const providerName of Object.keys(settings.settingsOfProvider) as ProviderName[]) {
			const ps = settings.settingsOfProvider[providerName];
			if (!ps._didFillInProviderSettings) continue;
			const ftId = freeTierIdOfProviderName(providerName);
			if (ftId === null) continue;
			const firstModel = ps.models.find(m => !m.isHidden);
			if (!firstModel) continue;
			out.push({
				providerId: ftId,
				providerName,
				modelName: firstModel.modelName,
				qualityRank: FREE_TIER_QUOTAS[ftId].qualityRank,
			});
		}
		return out;
	}

	private formatProviderStatus(remaining: FreeTierRemaining): string {
		const t = (key: Parameters<typeof this.i18nService.t>[0], ...args: string[]) =>
			args.reduce((acc, arg, i) => acc.replace(`{${i}}`, arg), this.i18nService.t(key));
		const name = remaining.providerId;
		if (remaining.exhausted) {
			return t('routing.statusBar.exhausted', name);
		}
		if (remaining.rpd !== null && remaining.limits.rpd !== null) {
			const used = remaining.limits.rpd - remaining.rpd;
			return t('routing.statusBar.entry', name, String(used), String(remaining.limits.rpd));
		}
		if (remaining.rpm !== null && remaining.limits.rpm !== null) {
			const used = remaining.limits.rpm - remaining.rpm;
			return t('routing.statusBar.entryRpm', name, String(used), String(remaining.limits.rpm));
		}
		return t('routing.statusBar.uncapped', name);
	}

	override dispose(): void {
		super.dispose();
		this.modelEntry?.dispose();
		this.latencyEntry?.dispose();
		this.privacyEntry?.dispose();
		this.freeTierEntry?.dispose();
		this.modelEntry = undefined;
		this.latencyEntry = undefined;
		this.privacyEntry = undefined;
		this.freeTierEntry = undefined;
	}
}

// Register the contribution
registerWorkbenchContribution2(CortexideStatusBarContribution.ID, CortexideStatusBarContribution, WorkbenchPhase.AfterRestored);

