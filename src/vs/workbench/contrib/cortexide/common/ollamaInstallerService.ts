/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { MODEL_PACKS, type ModelPackKey } from './ollamaModelPacks.js';

export { MODEL_PACKS, type ModelPackKey };

export interface InstallOptions {
	method: 'auto' | 'brew' | 'curl' | 'winget' | 'choco';
	modelTag?: string;
}

export interface HardwareInfo {
	vramGB: number | null;
	recommendedPack: ModelPackKey;
}

export interface IOllamaInstallerService {
	readonly _serviceBrand: undefined;

	/** Log lines from the installer / model pull process */
	onLog: Event<string>;
	/** Fires true/false when the current operation completes */
	onDone: Event<boolean>;
	// allow-any-unicode-next-line
	/** Fires pull progress events: 0–100 percent + status string */
	onPullProgress: Event<{ modelTag: string; percent: number; status: string }>;

	/** Install Ollama via the platform package manager */
	install(options: InstallOptions): void;

	/** Pull a model by tag (validated against allowlist in main process) */
	pullModel(modelTag: string): Promise<void>;

	/** Detect GPU/VRAM and return the recommended model pack */
	getHardwareInfo(): Promise<HardwareInfo>;

	/** Returns the full model pack catalogue */
	getModelPacks(): typeof MODEL_PACKS;

	/** Returns true if the Ollama daemon is reachable */
	isOllamaRunning(): Promise<boolean>;
}

export const IOllamaInstallerService = createDecorator<IOllamaInstallerService>('OllamaInstallerService');

class OllamaInstallerService extends Disposable implements IOllamaInstallerService {
	declare readonly _serviceBrand: undefined;

	private readonly _channel;

	private readonly _onLog = this._register(new Emitter<string>());
	readonly onLog = this._onLog.event;

	private readonly _onDone = this._register(new Emitter<boolean>());
	readonly onDone = this._onDone.event;

	private readonly _onPullProgress = this._register(new Emitter<{ modelTag: string; percent: number; status: string }>());
	readonly onPullProgress = this._onPullProgress.event;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) {
		super();
		this._channel = this.mainProcessService.getChannel('void-channel-ollamaInstaller');

		this._channel.listen('onLog')((e: any) => this._onLog.fire((e as { text: string }).text));
		this._channel.listen('onDone')((e: any) => this._onDone.fire((e as { ok: boolean }).ok));
		this._channel.listen('onPullProgress')((e: any) => this._onPullProgress.fire(e));
	}

	install(options: InstallOptions): void {
		this._channel.call('install', options);
	}

	async pullModel(modelTag: string): Promise<void> {
		await this._channel.call('pullModel', { modelTag });
	}

	async getHardwareInfo(): Promise<HardwareInfo> {
		return this._channel.call('getHardwareInfo', undefined);
	}

	getModelPacks(): typeof MODEL_PACKS {
		return MODEL_PACKS;
	}

	async isOllamaRunning(): Promise<boolean> {
		return this._channel.call('isOllamaRunning', undefined);
	}
}

registerSingleton(IOllamaInstallerService, OllamaInstallerService, InstantiationType.Delayed);
