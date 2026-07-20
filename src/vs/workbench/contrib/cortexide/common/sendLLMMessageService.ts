/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EventLLMMessageOnTextParams, EventLLMMessageOnErrorParams, EventLLMMessageOnFinalMessageParams, ServiceSendLLMMessageParams, MainSendLLMMessageParams, MainLLMMessageAbortParams, ServiceModelListParams, EventModelListOnSuccessParams, EventModelListOnErrorParams, MainModelListParams, MainOllamaEmbedParams, OllamaModelResponse, OpenaiCompatibleModelResponse, } from './sendLLMMessageTypes.js';

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICortexideSettingsService } from './cortexideSettingsService.js';
import { canDispatchToProvider, classifyProviderDestination } from './egressPolicy.js';
import { buildEgressAuditEvent } from './egressAudit.js';
import { IAuditLogService } from './auditLogService.js';
import { IMCPService } from './mcpService.js';
import { ISecretDetectionService } from './secretDetectionService.js';
import { redactChatMessages, redactFimMessage, summarizeRedaction } from './outboundRedaction.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { isWeb } from '../../../../base/common/platform.js';
import { IFreeTierQuotaService } from './routing/freeTierQuotaService.js';
import { freeTierIdOfProviderName } from './routing/freeTierConstants.js';
import { describeFreeTierExhaustion } from './routing/freeTierExhaustion.js';
import { ModelSelection, ProviderName } from './cortexideSettingsTypes.js';

// calls channel to implement features
export const ILLMMessageService = createDecorator<ILLMMessageService>('llmMessageService');

export interface ILLMMessageService {
	readonly _serviceBrand: undefined;
	sendLLMMessage: (params: ServiceSendLLMMessageParams) => string | null;
	abort: (requestId: string) => void;
	ollamaList: (params: ServiceModelListParams<OllamaModelResponse>) => void;
	ollamaEmbed: (params: { modelName: string; input: string[] }) => Promise<number[][]>;
	openAICompatibleList: (params: ServiceModelListParams<OpenaiCompatibleModelResponse>) => void;
}


// open this file side by side with llmMessageChannel
export class LLMMessageService extends Disposable implements ILLMMessageService {

	readonly _serviceBrand: undefined;
	private readonly channel: IChannel // LLMMessageChannel

	// sendLLMMessage
	private readonly llmMessageHooks = {
		onText: {} as { [eventId: string]: ((params: EventLLMMessageOnTextParams) => void) },
		onFinalMessage: {} as { [eventId: string]: ((params: EventLLMMessageOnFinalMessageParams) => void) },
		onError: {} as { [eventId: string]: ((params: EventLLMMessageOnErrorParams) => void) },
		onAbort: {} as { [eventId: string]: (() => void) }, // NOT sent over the channel, result is instant when we call .abort()
	}

	// list hooks
	private readonly listHooks = {
		ollama: {
			success: {} as { [eventId: string]: ((params: EventModelListOnSuccessParams<OllamaModelResponse>) => void) },
			error: {} as { [eventId: string]: ((params: EventModelListOnErrorParams<OllamaModelResponse>) => void) },
		},
		openAICompat: {
			success: {} as { [eventId: string]: ((params: EventModelListOnSuccessParams<OpenaiCompatibleModelResponse>) => void) },
			error: {} as { [eventId: string]: ((params: EventModelListOnErrorParams<OpenaiCompatibleModelResponse>) => void) },
		}
	} satisfies {
		[providerName in 'ollama' | 'openAICompat']: {
			success: { [eventId: string]: ((params: EventModelListOnSuccessParams<any>) => void) },
			error: { [eventId: string]: ((params: EventModelListOnErrorParams<any>) => void) },
		}
	}

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService, // used as a renderer (only usable on client side)
		@ICortexideSettingsService private readonly cortexideSettingsService: ICortexideSettingsService,
		@INotificationService private readonly notificationService: INotificationService,
		@IMCPService private readonly mcpService: IMCPService,
		@ISecretDetectionService private readonly secretDetectionService: ISecretDetectionService,
		@ILogService private readonly logService: ILogService,
		@IFreeTierQuotaService private readonly freeTierQuotaService: IFreeTierQuotaService,
		@IAuditLogService private readonly auditLogService: IAuditLogService,
	) {
		super()

		// LLM features require the Electron main process IPC channel which is not available in the
		// web browser build. Surface a clear message rather than crashing with an obscure error.
		if (isWeb) {
			this.notificationService.notify({
				severity: Severity.Info,
				message: 'CortexIDE: AI features (LLM, MCP) require the desktop app and are not available in the web version.',
			});
			// allow-any-unicode-next-line
			this.logService.info('[LLMMessageService] Running in web mode — IPC channel unavailable, AI features disabled.');
			// allow-any-unicode-next-line
			// Cast to satisfy TypeScript — the channel will never actually be called in web mode
			this.channel = null as any;
			return;
		}

		// const service = ProxyChannel.toService<LLMMessageChannel>(mainProcessService.getChannel('void-channel-sendLLMMessage')); // lets you call it like a service
		// see llmMessageChannel.ts
		this.channel = this.mainProcessService.getChannel('cortexide-channel-llmMessage')

		// .listen sets up an IPC channel and takes a few ms, so we set up listeners immediately and add hooks to them instead
		// llm
		this._register((this.channel.listen('onText_sendLLMMessage') satisfies Event<EventLLMMessageOnTextParams>)(e => {
			this.llmMessageHooks.onText[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onFinalMessage_sendLLMMessage') satisfies Event<EventLLMMessageOnFinalMessageParams>)(e => {
			this.llmMessageHooks.onFinalMessage[e.requestId]?.(e);
			this._clearChannelHooks(e.requestId)
		}))
		this._register((this.channel.listen('onError_sendLLMMessage') satisfies Event<EventLLMMessageOnErrorParams>)(e => {
			this.llmMessageHooks.onError[e.requestId]?.(e);
			this._clearChannelHooks(e.requestId);
			// Mask secrets in error logs
			const config = this.secretDetectionService.getConfig();
			if (config.enabled) {
				const redacted = this.secretDetectionService.redactSecretsInObject(e);
				console.error('Error in LLMMessageService:', JSON.stringify(redacted.redacted))
			} else {
				console.error('Error in LLMMessageService:', JSON.stringify(e))
			}
		}))
		// .list()
		this._register((this.channel.listen('onSuccess_list_ollama') satisfies Event<EventModelListOnSuccessParams<OllamaModelResponse>>)(e => {
			this.listHooks.ollama.success[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onError_list_ollama') satisfies Event<EventModelListOnErrorParams<OllamaModelResponse>>)(e => {
			this.listHooks.ollama.error[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onSuccess_list_openAICompatible') satisfies Event<EventModelListOnSuccessParams<OpenaiCompatibleModelResponse>>)(e => {
			this.listHooks.openAICompat.success[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onError_list_openAICompatible') satisfies Event<EventModelListOnErrorParams<OpenaiCompatibleModelResponse>>)(e => {
			this.listHooks.openAICompat.error[e.requestId]?.(e)
		}))

	}

	sendLLMMessage(params: ServiceSendLLMMessageParams) {
		const { onText, onFinalMessage, onError, onAbort, modelSelection, ...proxyParams } = params;

		if (isWeb) {
			onError({ message: 'AI features are not available in the web version. Please use the desktop app.', fullError: null });
			return null;
		}

		// throw an error if no model/provider selected (this should usually never be reached, the UI should check this first, but might happen in cases like Apply where we haven't built much UI/checks yet, good practice to have check logic on backend)
		if (modelSelection === null) {
			const message = `Please add a provider in CortexIDE Settings.`
			onError({ message, fullError: null })
			return null
		}

		if (params.messagesType === 'chatMessages' && (params.messages?.length ?? 0) === 0) {
			const message = `No messages detected.`
			onError({ message, fullError: null })
			return null
		}

		// Detect and redact secrets at the SINGLE outbound dispatch boundary, before the
		// payload crosses the IPC channel to electron-main. This covers EVERY payload that
		// can leave the machine: chat messages (string content, text parts, AND tool_result
		// content such as `cat .env` output) plus FIM/autocomplete prefix/suffix. Previously
		// only chatMessages text parts were scanned, so autocomplete and terminal-tool output
		// shipped raw to cloud providers -- contradicting the "never leaks a secret" guarantee.
		// The message-walking logic lives in the pure, unit-tested common/outboundRedaction.ts.
		let redactionApplied = false; // recorded in the egress audit ledger below
		const config = this.secretDetectionService.getConfig();
		if (config.enabled) {
			const detect = (text: string) => this.secretDetectionService.detectSecrets(text);

			if (params.messagesType === 'chatMessages' && params.messages) {
				const summary = redactChatMessages(params.messages, detect);
				redactionApplied = summary.hasSecrets;
				this.logService.trace('[SecretDetection] Chat messages scanned.', summary.hasSecrets ? `Redacted: ${summarizeRedaction(summary)}` : 'No secrets detected (paths in system message are not redacted).');

				if (summary.hasSecrets && config.mode === 'block') {
					const typesListForUser = Array.from(summary.countByType.entries())
						.map(([name, count]) => `${name} (${count})`)
						.join(', ');
					this.notificationService.warn(
						`Secret detected: ${typesListForUser}. Message blocked from sending. Use environment variables or secure vaults instead of pasting keys into chat.`
					);
					onError({
						message: `Message blocked: Secrets detected (${typesListForUser}). Please remove secrets before sending.`,
						fullError: null,
					});
					return null;
				}
				// Redact mode: secrets already redacted in place; send silently.
			} else if (params.messagesType === 'FIMMessage' && params.messages) {
				// Autocomplete must redact-and-continue (never block / never notify) so a
				// secret in the surrounding code can't ship to a cloud model, without
				// breaking completions or spamming the user on every keystroke.
				const summary = redactFimMessage(params.messages, detect);
				redactionApplied = summary.hasSecrets;
				if (summary.hasSecrets) {
					this.logService.trace('[SecretDetection] FIM payload redacted.', summarizeRedaction(summary));
				}
			}
		}

		const { settingsOfProvider, } = this.cortexideSettingsService.state

		// Phase 8: stamp local-only privacy mode from the routing policy DIRECTLY (not from the
		// resolved model), so the electron-main dispatch can refuse any cloud egress as a second
		// line of defense behind the router.
		const localOnly = this.cortexideSettingsService.state.globalSettings.routingPolicy === 'local-only'

		// Egress ledger: record EVERY outbound LLM decision (allowed AND blocked) -- provider,
		// destination (loopback/remote), whether it leaves the machine, and whether a secret was
		// redacted from it -- using the SAME classification the egress gate enforces. Gated behind
		// the (opt-in) audit log; fire-and-forget so it never blocks or fails a request.
		const egressProvider = modelSelection.providerName // 'auto' is resolved upstream; narrow it out
		if (this.auditLogService.isEnabled() && egressProvider !== 'auto') {
			const endpoint = settingsOfProvider[egressProvider]?.endpoint
			const destinationKind = classifyProviderDestination(egressProvider, endpoint)
			const decision = canDispatchToProvider(localOnly, egressProvider, endpoint)
			this.auditLogService.append(buildEgressAuditEvent({
				ts: Date.now(),
				providerName: egressProvider,
				modelName: modelSelection.modelName,
				destinationKind,
				allowed: decision.allowed,
				reason: decision.reason,
				redactionApplied,
				modality: params.messagesType === 'FIMMessage' ? 'autocomplete' : 'cloud-llm',
			})).catch(err => this.logService.warn('[AuditLog] egress append failed', err))
		}

		const mcpTools = this.mcpService.getMCPTools()

		// add state for request id
		const requestId = generateUuid();

		// Free-tier quota tracking: wrap success/error callbacks so we update
		// the in-process quota service whenever a call completes or hits 429.
		// Wrapping happens here (common/ layer) rather than electron-main to
		// keep the quota service strictly in common/ - the impl has no way to
		// reach back to common/ services.
		const freeTierId = freeTierIdOfProviderName(modelSelection.providerName);
		const wrappedOnFinalMessage = freeTierId === null
			? onFinalMessage
			: (params: EventLLMMessageOnFinalMessageParams) => {
				try {
					// Cheap proxy for tokens until SDK responses expose real usage.
					// Output tokens ~ chars/4 is the standard approximation.
					const estTokens = Math.ceil((params.fullText?.length ?? 0) / 4);
					this.freeTierQuotaService.recordCall(freeTierId, modelSelection.modelName, estTokens);
				} catch (err) {
					this.logService.warn('[FreeTierQuota] recordCall failed', err);
				}
				onFinalMessage(params);
			};
		const wrappedOnError = freeTierId === null
			? onError
			: (params: EventLLMMessageOnErrorParams) => {
				try {
					if (isRateLimitError(params)) {
						this.freeTierQuotaService.markExhausted(freeTierId, parseRetryAt(params));
						// Centralized graceful exhaustion: if every configured free-tier
						// provider is now unusable, replace the raw provider 429 with an
						// actionable message so NO feature (chat, apply, ctrl+k, commit,
						// codeReview, ...) ever strands the user on a bare rate-limit error.
						const exhaustion = describeFreeTierExhaustion({
							configuredModels: this._configuredModels(),
							quotas: this.freeTierQuotaService.getAllRemaining(),
							now: Date.now(),
						});
						if (exhaustion.allExhausted) {
							onError({ ...params, message: exhaustion.message });
							return;
						}
					}
				} catch (err) {
					this.logService.warn('[FreeTierQuota] markExhausted failed', err);
				}
				onError(params);
			};

		this.llmMessageHooks.onText[requestId] = onText
		this.llmMessageHooks.onFinalMessage[requestId] = wrappedOnFinalMessage
		this.llmMessageHooks.onError[requestId] = wrappedOnError
		this.llmMessageHooks.onAbort[requestId] = onAbort // used internally only

		// params will be stripped of all its functions over the IPC channel
		this.channel.call('sendLLMMessage', {
			...proxyParams,
			requestId,
			settingsOfProvider,
			modelSelection,
			mcpTools,
			localOnly,
		} satisfies MainSendLLMMessageParams);

		return requestId
	}

	abort(requestId: string) {
		this.llmMessageHooks.onAbort[requestId]?.() // calling the abort hook here is instant (doesn't go over a channel)
		this.channel.call('abort', { requestId } satisfies MainLLMMessageAbortParams);
		this._clearChannelHooks(requestId)
	}


	ollamaList = (params: ServiceModelListParams<OllamaModelResponse>) => {
		const { onSuccess, onError, ...proxyParams } = params

		const { settingsOfProvider } = this.cortexideSettingsService.state

		// EGRESS GATE: a model-list refresh to a non-loopback endpoint still leaves the machine; skip
		// the IPC under local-only (the default localhost endpoint is allowed).
		const localOnly = this.cortexideSettingsService.state.globalSettings.routingPolicy === 'local-only'
		const ollamaEgress = canDispatchToProvider(localOnly, 'ollama', settingsOfProvider['ollama']?.endpoint)
		if (!ollamaEgress.allowed) {
			onError({ error: ollamaEgress.reason ?? 'Local-only privacy mode is on: model refresh skipped.' })
			return
		}

		// add state for request id
		const requestId_ = generateUuid();
		this.listHooks.ollama.success[requestId_] = onSuccess
		this.listHooks.ollama.error[requestId_] = onError

		this.channel.call('ollamaList', {
			...proxyParams,
			settingsOfProvider,
			providerName: 'ollama',
			requestId: requestId_,
			localOnly,
		} satisfies MainModelListParams<OllamaModelResponse>)
	}

	// Request-response (returns the vectors directly). Powers the local Ollama embedding provider for
	// hybrid RAG; same loopback egress gate as ollamaList (Ollama is on-machine, allowed under local-only).
	ollamaEmbed = async (params: { modelName: string; input: string[] }): Promise<number[][]> => {
		const { settingsOfProvider } = this.cortexideSettingsService.state
		const localOnly = this.cortexideSettingsService.state.globalSettings.routingPolicy === 'local-only'
		const ollamaEgress = canDispatchToProvider(localOnly, 'ollama', settingsOfProvider['ollama']?.endpoint)
		if (!ollamaEgress.allowed) {
			throw new Error(ollamaEgress.reason ?? 'Local-only privacy mode is on: embeddings skipped.')
		}
		const OLLAMA_EMBED_TIMEOUT_MS = 30_000;
		return Promise.race<number[][]>([
			this.channel.call('ollamaEmbed', {
				settingsOfProvider,
				modelName: params.modelName,
				input: params.input,
				localOnly,
			} satisfies MainOllamaEmbedParams) as Promise<number[][]>,
			new Promise<number[][]>((_, reject) =>
				setTimeout(() => reject(new Error('Ollama embed timed out')), OLLAMA_EMBED_TIMEOUT_MS)),
		]);
	}


	openAICompatibleList = (params: ServiceModelListParams<OpenaiCompatibleModelResponse>) => {
		const { onSuccess, onError, ...proxyParams } = params

		const { settingsOfProvider } = this.cortexideSettingsService.state

		// EGRESS GATE: same as ollamaList -- don't refresh a remotely-pointed provider under local-only
		const localOnly = this.cortexideSettingsService.state.globalSettings.routingPolicy === 'local-only'
		const compatEgress = canDispatchToProvider(localOnly, proxyParams.providerName, settingsOfProvider[proxyParams.providerName]?.endpoint)
		if (!compatEgress.allowed) {
			onError({ error: compatEgress.reason ?? 'Local-only privacy mode is on: model refresh skipped.' })
			return
		}

		// add state for request id
		const requestId_ = generateUuid();
		this.listHooks.openAICompat.success[requestId_] = onSuccess
		this.listHooks.openAICompat.error[requestId_] = onError

		this.channel.call('openAICompatibleList', {
			...proxyParams,
			settingsOfProvider,
			requestId: requestId_,
			localOnly,
		} satisfies MainModelListParams<OpenaiCompatibleModelResponse>)
	}

	/** Configured + visible models across all filled-in providers (mirrors the router's getAvailableModels). */
	private _configuredModels(): ModelSelection[] {
		const models: ModelSelection[] = [];
		const { settingsOfProvider } = this.cortexideSettingsService.state;
		for (const providerName of Object.keys(settingsOfProvider) as ProviderName[]) {
			const ps = settingsOfProvider[providerName];
			if (!ps._didFillInProviderSettings) continue;
			for (const m of ps.models) {
				if (!m.isHidden) {
					models.push({ providerName, modelName: m.modelName });
				}
			}
		}
		return models;
	}

	private _clearChannelHooks(requestId: string) {
		delete this.llmMessageHooks.onText[requestId]
		delete this.llmMessageHooks.onFinalMessage[requestId]
		delete this.llmMessageHooks.onError[requestId]
		delete this.llmMessageHooks.onAbort[requestId] // was never cleared -> a closure leaked per LLM request

		delete this.listHooks.ollama.success[requestId]
		delete this.listHooks.ollama.error[requestId]

		delete this.listHooks.openAICompat.success[requestId]
		delete this.listHooks.openAICompat.error[requestId]
	}
}

/**
 * Detect 429 / rate-limit errors from the provider error payload.  The
 * underlying impl normalises a wide range of provider-specific shapes into a
 * single `message` string, plus an opaque `fullError`.  We sniff both.
 */
function isRateLimitError(params: EventLLMMessageOnErrorParams): boolean {
	const msg = (params.message || '').toLowerCase();
	if (msg.includes('rate limit') || msg.includes('rate-limit') || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
		return true;
	}
	const full = params.fullError as unknown;
	if (full && typeof full === 'object') {
		const candidate = full as { status?: unknown; code?: unknown };
		if (candidate.status === 429 || candidate.code === 429) {
			return true;
		}
	}
	return false;
}

/**
 * Best-effort: extract a retry-at timestamp from a rate-limit error.  If
 * nothing is parseable, returns `null` - the quota service applies a
 * conservative 60s default.
 */
function parseRetryAt(params: EventLLMMessageOnErrorParams): number | null {
	const full = params.fullError as unknown;
	if (full && typeof full === 'object') {
		const candidate = full as { headers?: Record<string, string>; retryAfter?: unknown };
		const headers = candidate.headers;
		if (headers && typeof headers === 'object') {
			const retryAfter = headers['retry-after'] || headers['Retry-After'];
			if (retryAfter) {
				const seconds = Number(retryAfter);
				if (Number.isFinite(seconds) && seconds > 0) {
					return Date.now() + seconds * 1000;
				}
			}
		}
		if (typeof candidate.retryAfter === 'number' && candidate.retryAfter > 0) {
			return Date.now() + candidate.retryAfter * 1000;
		}
	}
	// Try to parse "...retry in 57s..." patterns from the message
	const m = (params.message || '').match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
	if (m) {
		const seconds = Number(m[1]);
		if (Number.isFinite(seconds) && seconds > 0) {
			return Date.now() + seconds * 1000;
		}
	}
	return null;
}

registerSingleton(ILLMMessageService, LLMMessageService, InstantiationType.Eager);

