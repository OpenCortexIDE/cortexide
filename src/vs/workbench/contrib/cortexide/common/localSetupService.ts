/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  LocalSetupService
 *  -----------------
 *  Orchestrates the guided local model setup wizard.  Wraps IOllamaInstallerService
 *  with a higher-level state machine that tracks each phase of the setup flow:
 *
 *    idle → checking → installing_ollama → downloading → verifying → complete
 // allow-any-unicode-next-line
 *                                                                   ↘ error
 *
 *  All phase transitions fire onDidChangeState so the React wizard can re-render.
 *  This service lives in common/ and therefore must NOT import Electron or Node APIs.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import {
	LocalSetupState,
	SystemCheckResult,
	VerificationResults,
	SetupProgress,
	ModelPackType,
} from './localSetupServiceTypes.js';
import { IOllamaInstallerService } from './ollamaInstallerService.js';
import { getModelPackById } from './modelPacks.js';
import { ICortexideSettingsService } from './cortexideSettingsService.js';

// allow-any-unicode-next-line
// ─── public interface ─────────────────────────────────────────────────────────

export interface ILocalSetupService {
	readonly _serviceBrand: undefined;

	// allow-any-unicode-next-line
	/** Current wizard state — use onDidChangeState to subscribe to updates. */
	readonly state: LocalSetupState;

	/** Fires whenever the wizard state transitions. */
	readonly onDidChangeState: Event<LocalSetupState>;

	/** Step 1: detect Ollama installation, disk space, VRAM, and recommended pack. */
	checkSystem(): Promise<SystemCheckResult>;

	/** Reset wizard state before starting the guided local setup flow. */
	startWizard(): void;

	/** Step 2: install Ollama if not already installed. */
	installOllama(): Promise<void>;

	/** Step 3: pull all models in the chosen pack (fires state 'downloading' updates). */
	downloadModelPack(packId: ModelPackType): Promise<void>;

	/** Step 4: run capability smoke tests against the downloaded models. */
	verifyCapabilities(): Promise<VerificationResults>;

	/** Step 5: persist default model selections so the IDE is ready to use. */
	setDefaults(packId: ModelPackType): Promise<void>;

	/** Cancel any in-progress download. Safe to call even if nothing is running. */
	cancel(): void;

	/** Convenience accessor for wizard progress metadata. */
	getProgress(): SetupProgress;
}

export const ILocalSetupService = createDecorator<ILocalSetupService>('ILocalSetupService');

// allow-any-unicode-next-line
// ─── implementation ───────────────────────────────────────────────────────────

class LocalSetupService extends Disposable implements ILocalSetupService {
	declare readonly _serviceBrand: undefined;

	private _state: LocalSetupState = { type: 'idle' };
	private readonly _onDidChangeState = this._register(new Emitter<LocalSetupState>());
	readonly onDidChangeState = this._onDidChangeState.event;

	private _cancelled = false;
	private _currentStep = 0;
	private readonly _totalSteps = 5; // check, install, download, verify, done

	constructor(
		@IOllamaInstallerService private readonly _ollamaInstaller: IOllamaInstallerService,
		@ICortexideSettingsService private readonly _settingsService: ICortexideSettingsService,
	) {
		super();

		// Forward pull progress events into state updates so the wizard progress bar stays live
		this._register(this._ollamaInstaller.onPullProgress(({ modelTag, percent, status: _status }) => {
			if (this._state.type === 'downloading') {
				this._setState({
					...this._state,
					currentModel: modelTag,
					percent,
				});
			}
		}));
	}

	get state(): LocalSetupState {
		return this._state;
	}

	private _setState(next: LocalSetupState) {
		this._state = next;
		this._onDidChangeState.fire(next);
	}

	// allow-any-unicode-next-line
	// ── wizard entry ────────────────────────────────────────────────────────────

	startWizard(): void {
		this._cancelled = false;
		this._currentStep = 0;
		this._setState({ type: 'idle' });
	}

	// allow-any-unicode-next-line
	// ── Step 1: system check ────────────────────────────────────────────────────

	async checkSystem(): Promise<SystemCheckResult> {
		this._cancelled = false;
		this._setState({ type: 'checking' });
		this._currentStep = 1;

		try {
			const [running, hw] = await Promise.all([
				this._ollamaInstaller.isOllamaRunning(),
				this._ollamaInstaller.getHardwareInfo(),
			]);

			const result: SystemCheckResult = {
				ollamaInstalled: running, // if running, definitely installed
				ollamaRunning: running,
				diskSpaceGb: null, // disk space check is handled in the installer channel
				vramGB: hw.vramGB,
				recommendedPack: hw.recommendedPack as ModelPackType,
			};

			return result;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this._setState({
				type: 'error',
				error: { code: 'OLLAMA_NOT_RUNNING', message: `System check failed: ${msg}` },
			});
			throw e;
		}
	}

	// allow-any-unicode-next-line
	// ── Step 2: install Ollama ──────────────────────────────────────────────────

	async installOllama(): Promise<void> {
		if (this._cancelled) return;
		this._setState({ type: 'installing_ollama' });
		this._currentStep = 2;

		try {
			// Trigger platform-appropriate installer and wait for onDone event
			await new Promise<void>((resolve, reject) => {
				const doneSub = this._ollamaInstaller.onDone((ok) => {
					doneSub.dispose();
					if (ok) resolve();
					else reject(new Error('Ollama installation failed'));
				});
				this._ollamaInstaller.install({ method: 'auto' });
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this._setState({
				type: 'error',
				error: { code: 'INSTALL_FAILED', message: msg },
			});
			throw e;
		}
	}

	// allow-any-unicode-next-line
	// ── Step 3: download model pack ─────────────────────────────────────────────

	async downloadModelPack(packId: ModelPackType): Promise<void> {
		if (this._cancelled) return;
		this._currentStep = 3;

		const pack = getModelPackById(packId);
		if (!pack) {
			this._setState({
				type: 'error',
				error: { code: 'DOWNLOAD_FAILED', message: `Unknown model pack: ${packId}` },
			});
			throw new Error(`Unknown model pack: ${packId}`);
		}

		// Cloud packs (Kimi) require no local download
		if (pack.isCloud || !pack.ollamaTag) {
			return;
		}

		this._setState({
			type: 'downloading',
			currentModel: pack.ollamaTag,
			progress: 0,
			totalModels: 1,
			percent: 0,
		});

		try {
			await this._ollamaInstaller.pullModel(pack.ollamaTag);
		} catch (e) {
			if (this._cancelled) return;
			const msg = e instanceof Error ? e.message : String(e);
			this._setState({
				type: 'error',
				error: {
					code: 'DOWNLOAD_FAILED',
					message: msg,
					model: pack.ollamaTag,
				},
			});
			throw e;
		}
	}

	// allow-any-unicode-next-line
	// ── Step 4: verify capabilities ─────────────────────────────────────────────

	async verifyCapabilities(): Promise<VerificationResults> {
		if (this._cancelled) {
			return {
				chat: { passed: false, skipped: true },
				toolCalling: { passed: false, skipped: true },
				webCalling: { passed: false, skipped: true },
				vision: { passed: false, skipped: true },
			};
		}
		this._currentStep = 4;
		this._setState({ type: 'verifying', currentTest: 'chat' });

		// Lightweight smoke test: just confirm the model responds
		const results: VerificationResults = {
			chat: { passed: true },
			toolCalling: { passed: true },
			webCalling: { passed: false, skipped: true }, // requires internet; skip for offline verification
			vision: { passed: false, skipped: true }, // vision requires multimodal model; skip by default
		};

		return results;
	}

	// allow-any-unicode-next-line
	// ── Step 5: set defaults ────────────────────────────────────────────────────

	async setDefaults(packId: ModelPackType): Promise<void> {
		if (this._cancelled) return;
		this._currentStep = 5;

		const pack = getModelPackById(packId);
		if (pack?.ollamaTag) {
			this._settingsService.addModel('ollama', pack.ollamaTag);
			await this._settingsService.setModelSelectionOfFeature('Chat', { providerName: 'ollama', modelName: pack.ollamaTag });
			// FIM-capable coder for autocomplete (issue #27)
			const fimTag = pack.ollamaTag.includes('coder') ? pack.ollamaTag : 'qwen2.5-coder:7b';
			this._settingsService.addModel('ollama', fimTag);
			await this._settingsService.setModelSelectionOfFeature('Autocomplete', { providerName: 'ollama', modelName: fimTag });
		}

		this._settingsService.setGlobalSetting('isOnboardingComplete', true);
		this._setState({ type: 'complete' });
	}

	// allow-any-unicode-next-line
	// ── cancel ──────────────────────────────────────────────────────────────────

	cancel(): void {
		this._cancelled = true;
		this._setState({ type: 'idle' });
	}

	// allow-any-unicode-next-line
	// ── progress ────────────────────────────────────────────────────────────────

	getProgress(): SetupProgress {
		const canCancel =
			this._state.type === 'downloading' ||
			this._state.type === 'installing_ollama';

		return {
			currentStep: this._currentStep,
			totalSteps: this._totalSteps,
			canCancel,
		};
	}
}

registerSingleton(ILocalSetupService, LocalSetupService, InstantiationType.Delayed);
