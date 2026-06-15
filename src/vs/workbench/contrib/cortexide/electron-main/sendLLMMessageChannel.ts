/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// registered in app.ts
// code convention is to make a service responsible for this stuff, and not a channel, but having fewer files is simpler...

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { EventLLMMessageOnTextParams, EventLLMMessageOnErrorParams, EventLLMMessageOnFinalMessageParams, MainSendLLMMessageParams, AbortRef, SendLLMMessageParams, MainLLMMessageAbortParams, ModelListParams, EventModelListOnSuccessParams, EventModelListOnErrorParams, OllamaModelResponse, OpenaiCompatibleModelResponse, MainModelListParams, MainOllamaEmbedParams, } from '../common/sendLLMMessageTypes.js';
import { sendLLMMessage } from './llmMessage/sendLLMMessage.js'
import { IMetricsService } from '../common/metricsService.js';
import { sendLLMMessageToProviderImplementation, sendOllamaEmbed } from './llmMessage/sendLLMMessage.impl.js';
import { canDispatchToProvider } from '../common/egressPolicy.js';

// NODE IMPLEMENTATION - calls actual sendLLMMessage() and returns listeners to it

// Maximum time (ms) before a request is automatically aborted to prevent zombie requests
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class LLMMessageChannel implements IServerChannel {

	// sendLLMMessage
	private readonly llmMessageEmitters = {
		onText: new Emitter<EventLLMMessageOnTextParams>(),
		onFinalMessage: new Emitter<EventLLMMessageOnFinalMessageParams>(),
		onError: new Emitter<EventLLMMessageOnErrorParams>(),
	}

	// allow-any-unicode-next-line
	// aborters for above — also tracks the timeout handle to allow cleanup
	private readonly _infoOfRunningRequest: Record<string, { waitForSend: Promise<void> | undefined, abortRef: AbortRef, timeoutHandle: ReturnType<typeof setTimeout> }> = {}


	// list
	private readonly listEmitters = {
		ollama: {
			success: new Emitter<EventModelListOnSuccessParams<OllamaModelResponse>>(),
			error: new Emitter<EventModelListOnErrorParams<OllamaModelResponse>>(),
		},
		openaiCompat: {
			success: new Emitter<EventModelListOnSuccessParams<OpenaiCompatibleModelResponse>>(),
			error: new Emitter<EventModelListOnErrorParams<OpenaiCompatibleModelResponse>>(),
		},
	} satisfies {
		[providerName in 'ollama' | 'openaiCompat']: {
			success: Emitter<EventModelListOnSuccessParams<any>>,
			error: Emitter<EventModelListOnErrorParams<any>>,
		}
	}

	// stupidly, channels can't take in @IService
	constructor(
		private readonly metricsService: IMetricsService,
	) { }

	// browser uses this to listen for changes
	listen(_: unknown, event: string): Event<any> {
		// text
		if (event === 'onText_sendLLMMessage') return this.llmMessageEmitters.onText.event;
		else if (event === 'onFinalMessage_sendLLMMessage') return this.llmMessageEmitters.onFinalMessage.event;
		else if (event === 'onError_sendLLMMessage') return this.llmMessageEmitters.onError.event;
		// list
		else if (event === 'onSuccess_list_ollama') return this.listEmitters.ollama.success.event;
		else if (event === 'onError_list_ollama') return this.listEmitters.ollama.error.event;
		else if (event === 'onSuccess_list_openAICompatible') return this.listEmitters.openaiCompat.success.event;
		else if (event === 'onError_list_openAICompatible') return this.listEmitters.openaiCompat.error.event;

		else throw new Error(`Event not found: ${event}`);
	}

	// browser uses this to call (see this.channel.call() in llmMessageService.ts for all usages)
	async call(_: unknown, command: string, params: any): Promise<any> {
		if (command === 'sendLLMMessage') {
			this._callSendLLMMessage(params)
		}
		else if (command === 'abort') {
			await this._callAbort(params)
		}
		else if (command === 'ollamaList') {
			this._callOllamaList(params)
		}
		else if (command === 'ollamaEmbed') {
			return this._callOllamaEmbed(params)
		}
		else if (command === 'openAICompatibleList') {
			this._callOpenAICompatibleList(params)
		}
		else {
			throw new Error(`CortexIDE sendLLM: command "${command}" not recognized.`)
		}
	}

	// Request-response (not streamed): local Ollama embeddings for hybrid RAG. Egress-gated defense-in-depth
	// (the renderer already gates) so a non-loopback Ollama endpoint is refused under local-only.
	private _callOllamaEmbed = async (params: MainOllamaEmbedParams): Promise<number[][]> => {
		const egress = canDispatchToProvider(params.localOnly === true, 'ollama', params.settingsOfProvider?.['ollama']?.endpoint)
		if (!egress.allowed) {
			throw new Error(egress.reason ?? 'Local-only privacy mode is on: embeddings skipped.')
		}
		return sendOllamaEmbed({ settingsOfProvider: params.settingsOfProvider, modelName: params.modelName, input: params.input })
	}

	private _cleanupRequest(requestId: string) {
		const info = this._infoOfRunningRequest[requestId];
		if (info) {
			clearTimeout(info.timeoutHandle);
			delete this._infoOfRunningRequest[requestId];
		}
	}

	// the only place sendLLMMessage is actually called
	private _callSendLLMMessage(params: MainSendLLMMessageParams) {
		const { requestId } = params;

		// If there's already a running request with this ID, abort it first (shouldn't happen normally)
		if (requestId in this._infoOfRunningRequest) {
			this._infoOfRunningRequest[requestId].abortRef.current?.();
			this._cleanupRequest(requestId);
		}

		// Register the request entry first so the timeout closure can reference it
		const abortRef: AbortRef = { current: null };
		const timeoutHandle = setTimeout(() => {
			const info = this._infoOfRunningRequest[requestId];
			if (!info) return;
			info.abortRef.current?.();
			this.llmMessageEmitters.onError.fire({ requestId, message: 'Request timed out after 5 minutes', fullError: null });
			this._cleanupRequest(requestId);
		}, REQUEST_TIMEOUT_MS);

		this._infoOfRunningRequest[requestId] = { waitForSend: undefined, abortRef, timeoutHandle };

		const mainThreadParams: SendLLMMessageParams = {
			...params,
			onText: (p) => {
				this.llmMessageEmitters.onText.fire({ requestId, ...p });
			},
			onFinalMessage: (p) => {
				this.llmMessageEmitters.onFinalMessage.fire({ requestId, ...p });
				this._cleanupRequest(requestId);
			},
			onError: (p) => {
				this.llmMessageEmitters.onError.fire({ requestId, ...p });
				this._cleanupRequest(requestId);
			},
			abortRef,
		};
		const p = sendLLMMessage(mainThreadParams, this.metricsService);
		this._infoOfRunningRequest[requestId].waitForSend = p;
	}

	private async _callAbort(params: MainLLMMessageAbortParams) {
		const { requestId } = params;
		if (!(requestId in this._infoOfRunningRequest)) return
		const { waitForSend, abortRef } = this._infoOfRunningRequest[requestId]
		await waitForSend // wait for the send to finish so we know abortRef was set
		abortRef?.current?.()
		this._cleanupRequest(requestId);
	}





	_callOllamaList = (params: MainModelListParams<OllamaModelResponse>) => {
		const { requestId, settingsOfProvider, localOnly } = params
		const emitters = this.listEmitters.ollama
		// EGRESS GATE defense-in-depth: also refuse a non-loopback refresh under local-only here
		const egress = canDispatchToProvider(localOnly === true, 'ollama', settingsOfProvider?.['ollama']?.endpoint)
		if (!egress.allowed) {
			emitters.error.fire({ requestId, error: egress.reason ?? 'Local-only privacy mode is on: model refresh skipped.' })
			return
		}
		const mainThreadParams: ModelListParams<OllamaModelResponse> = {
			...params,
			onSuccess: (p) => { emitters.success.fire({ requestId, ...p }); },
			onError: (p) => { emitters.error.fire({ requestId, ...p }); },
		}
		sendLLMMessageToProviderImplementation.ollama.list(mainThreadParams)
	}

	_callOpenAICompatibleList = (params: MainModelListParams<OpenaiCompatibleModelResponse>) => {
		const { requestId, providerName, settingsOfProvider, localOnly } = params
		const emitters = this.listEmitters.openaiCompat
		// EGRESS GATE (Phase 8) defense-in-depth (see _callOllamaList).
		const egress = canDispatchToProvider(localOnly === true, providerName, settingsOfProvider?.[providerName]?.endpoint)
		if (!egress.allowed) {
			emitters.error.fire({ requestId, error: egress.reason ?? 'Local-only privacy mode is on: model refresh skipped.' })
			return
		}
		const mainThreadParams: ModelListParams<OpenaiCompatibleModelResponse> = {
			...params,
			onSuccess: (p) => { emitters.success.fire({ requestId, ...p }); },
			onError: (p) => { emitters.error.fire({ requestId, ...p }); },
		}
		sendLLMMessageToProviderImplementation[providerName].list(mainThreadParams)
	}





}
