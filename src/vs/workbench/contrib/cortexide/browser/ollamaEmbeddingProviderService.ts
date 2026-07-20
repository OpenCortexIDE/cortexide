/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAiEmbeddingVectorService, IAiEmbeddingVectorProvider } from '../../../services/aiEmbeddingVector/common/aiEmbeddingVectorService.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { canDispatchToProvider } from '../common/egressPolicy.js';
import { canUseOllamaEmbeddings } from '../common/ollamaEmbeddings.js';

/**
 * Registers a LOCAL Ollama embedding provider with IAiEmbeddingVectorService when the user configures
 * `cortexide.rag.embeddingModel` AND that model is pulled in their local Ollama -- activating hybrid
 * (BM25 + vector) retrieval. Until then (the default), RAG stays BM25-only. Embeddings run via the
 * electron-main IPC (the renderer can't reach Ollama); Ollama is loopback, so chunks stay on-machine and
 * the call is allowed under local-only privacy mode (gated by canDispatchToProvider). A startup probe
 * confirms the model actually embeds before registering, so IAiEmbeddingVectorService.isEnabled() is
 * accurate; any failure leaves retrieval gracefully on BM25.
 */
export class OllamaEmbeddingProviderContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.cortexide.ollamaEmbeddingProvider';

	private _registration: IDisposable | undefined;
	private _registeredModel: string | undefined;
	private _syncing = false;
	private _resyncQueued = false;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@IAiEmbeddingVectorService private readonly _embeddingService: IAiEmbeddingVectorService,
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@ICortexideSettingsService private readonly _settingsService: ICortexideSettingsService,
	) {
		super();
		// Defer embedding probe so Ollama IPC does not block the UI during startup (issue #12).
		const deferMs = 8_000;
		const deferHandle = setTimeout(() => { void this._sync(); }, deferMs);
		this._register({ dispose: () => clearTimeout(deferHandle) });
		// Re-evaluate when the embedding model setting changes...
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cortexide.rag.embeddingModel')) { void this._sync(); }
		}));
		// ...or when privacy/routing or the Ollama endpoint changes (these live in GlobalSettings).
		this._register(this._settingsService.onDidChangeState(() => { void this._sync(); }));
		this._register({ dispose: () => this._unregister() });
	}

	private async _sync(): Promise<void> {
		// Serialize: a config + state change can fire together; coalesce into one trailing re-sync.
		if (this._syncing) { this._resyncQueued = true; return; }
		this._syncing = true;
		try {
			do {
				this._resyncQueued = false;
				await this._syncOnce();
			} while (this._resyncQueued);
		} finally {
			this._syncing = false;
		}
	}

	private async _syncOnce(): Promise<void> {
		const model = (this._configurationService.getValue<string>('cortexide.rag.embeddingModel') || '').trim();
		const { settingsOfProvider, globalSettings } = this._settingsService.state;
		const localOnly = globalSettings.routingPolicy === 'local-only';
		const dispatchAllowed = canDispatchToProvider(localOnly, 'ollama', settingsOfProvider['ollama']?.endpoint).allowed;

		if (!canUseOllamaEmbeddings(model, dispatchAllowed)) {
			this._unregister();
			return;
		}
		if (this._registration && this._registeredModel === model) {
			return; // already active for this exact model
		}

		// Probe: confirm the model actually embeds before registering, so isEnabled() never lies.
		try {
			const probe = await this._llmMessageService.ollamaEmbed({ modelName: model, input: ['probe'] });
			if (!probe?.length || !probe[0]?.length) {
				this._unregister();
				return;
			}
		} catch (err) {
			this._logService.info(`[OllamaEmbeddings] model '${model}' is not available; staying on BM25-only retrieval. (${err instanceof Error ? err.message : String(err)})`);
			this._unregister();
			return;
		}

		this._unregister();
		this._registeredModel = model;
		const provider: IAiEmbeddingVectorProvider = {
			provideAiEmbeddingVector: (strings) => this._llmMessageService.ollamaEmbed({ modelName: model, input: strings }),
		};
		this._registration = this._embeddingService.registerAiEmbeddingVectorProvider(model, provider);
		this._logService.info(`[OllamaEmbeddings] registered local embedding provider '${model}' -- hybrid retrieval active.`);
	}

	private _unregister(): void {
		this._registration?.dispose();
		this._registration = undefined;
		this._registeredModel = undefined;
	}
}

registerWorkbenchContribution2(OllamaEmbeddingProviderContribution.ID, OllamaEmbeddingProviderContribution, WorkbenchPhase.AfterRestored);
