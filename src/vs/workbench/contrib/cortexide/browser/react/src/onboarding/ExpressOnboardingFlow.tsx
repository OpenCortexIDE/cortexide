/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *
 *  ExpressOnboardingFlow
 *  ---------------------
 *  The "zero-friction" express path. Renders by default on first launch when
 *  the user has no provider configured. Goal: working chat in ~90s, no
 *  settings touched.
 *
 *  Flow:
 *    1.  Detect Ollama + hardware (in parallel).
 *    2.  If Ollama already running -> auto-pull the hw-recommended pack.
 *    3.  If Ollama not running    -> show ONE confirmation modal asking to install,
 *                                    OR offer the Groq free-tier fallback.
 *    4.  When pull completes      -> set the freshly-pulled model as the active
 *                                    Chat model and mark onboarding complete.
 *    5.  Groq fallback page       -> deep-links to console.groq.com/keys, exposes
 *                                    a paste box, persists the key via
 *                                    ICortexideSettingsService, completes onboarding.
 *
 *  Power users can always click "Customize setup" to launch the full LocalSetupWizard.
 *
 *  No telemetry events are fired from this component (privacy-first).
 *--------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cpu, ExternalLink, Loader2, Settings, X, Zap } from 'lucide-react';
import { useAccessor } from '../util/services.js';
import { useTranslation } from '../util/useTranslation.js';
import { MODEL_PACKS, type ModelPackKey } from '../../../../common/ollamaInstallerService.js';
import { LocalSetupWizard } from './LocalSetupWizard.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';

type Phase =
	| 'detecting'
	| 'awaiting-install-confirm'
	| 'installing'
	| 'pulling'
	| 'ready'
	| 'groq-fallback'
	| 'error-install'
	| 'error-pull';

type Hardware = { vramGB: number | null; recommendedPack: ModelPackKey };

interface ExpressOnboardingFlowProps {
	onCustomize: () => void;
	onDismiss: () => void;
}

const GROQ_KEYS_URL = 'https://console.groq.com/keys';
// Conservative, well-supported free-tier default. Keep in sync with
// common/modelCapabilities.ts groq model list.
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const interpolate = (template: string, ...args: (string | number)[]): string => {
	return template.replace(/\{(\d+)\}/g, (_, idx) => String(args[Number(idx)] ?? ''));
};

export const ExpressOnboardingFlow = ({ onCustomize, onDismiss }: ExpressOnboardingFlowProps) => {
	const { t } = useTranslation();
	const accessor = useAccessor();
	const settingsService = accessor.get('ICortexideSettingsService');
	const ollamaInstaller = accessor.get('OllamaInstallerService');

	const [phase, setPhase] = useState<Phase>('detecting');
	const [hardware, setHardware] = useState<Hardware | null>(null);
	const [progressPercent, setProgressPercent] = useState<number>(0);
	const [progressStatus, setProgressStatus] = useState<string>('');
	const [groqApiKey, setGroqApiKey] = useState<string>('');
	const [groqError, setGroqError] = useState<string | null>(null);
	const [showLocalWizard, setShowLocalWizard] = useState<boolean>(false);

	// Track timers / subscriptions for clean disposal.
	const disposablesRef = useRef<Array<() => void>>([]);
	const installInFlightRef = useRef<boolean>(false);

	const chosenPack = useMemo(() => {
		const key: ModelPackKey = hardware?.recommendedPack ?? 'fast';
		return { key, ...MODEL_PACKS[key] };
	}, [hardware]);

	// Cleanup any subscriptions / timers on unmount.
	useEffect(() => {
		return () => {
			for (const dispose of disposablesRef.current) {
				try { dispose(); } catch { /* swallow */ }
			}
			disposablesRef.current = [];
		};
	}, []);

	// Step 1: detect hardware + check if Ollama is already running.
	useEffect(() => {
		if (!ollamaInstaller) {
			// No installer service -> fall straight back to Groq.
			setPhase('groq-fallback');
			return;
		}

		let cancelled = false;

		(async () => {
			try {
				const [hw, running] = await Promise.all([
					ollamaInstaller.getHardwareInfo().catch(() => ({ vramGB: null, recommendedPack: 'fast' as ModelPackKey })),
					ollamaInstaller.isOllamaRunning().catch(() => false),
				]);
				if (cancelled) return;
				setHardware(hw);
				if (running) {
					// Ollama already running -> skip the install prompt entirely.
					await startPull(hw.recommendedPack);
				} else {
					setPhase('awaiting-install-confirm');
				}
			} catch {
				if (!cancelled) setPhase('groq-fallback');
			}
		})();

		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ollamaInstaller]);

	const startPull = async (packKey: ModelPackKey) => {
		if (!ollamaInstaller) {
			setPhase('groq-fallback');
			return;
		}
		const pack = MODEL_PACKS[packKey];
		setPhase('pulling');
		setProgressPercent(0);
		setProgressStatus('');

		const progressSub = ollamaInstaller.onPullProgress(({ percent, status }) => {
			setProgressPercent(percent);
			setProgressStatus(status);
		});
		disposablesRef.current.push(() => progressSub.dispose());

		try {
			await ollamaInstaller.pullModel(pack.tag);
			// Pull completed -> mark agent ready: add model to ollama provider,
			// select it for Chat, persist onboarding complete.
			// (_didFillInProviderSettings auto-recomputes inside the settings
			// service because ollama only requires `endpoint`, which has a
			// non-empty default.)
			settingsService.addModel('ollama', pack.tag);
			await settingsService.setModelSelectionOfFeature('Chat', { providerName: 'ollama', modelName: pack.tag });
			const fimTag = pack.tag.includes('coder') ? pack.tag : 'qwen2.5-coder:7b';
			settingsService.addModel('ollama', fimTag);
			await settingsService.setModelSelectionOfFeature('Autocomplete', { providerName: 'ollama', modelName: fimTag });
			settingsService.setGlobalSetting('isOnboardingComplete', true);
			setPhase('ready');
		} catch (e) {
			console.error('[Express onboarding] Pull failed:', e);
			setPhase('error-pull');
		}
	};

	const handleConfirmInstall = async () => {
		if (!ollamaInstaller || installInFlightRef.current) return;
		installInFlightRef.current = true;
		setPhase('installing');

		try {
			await new Promise<void>((resolve, reject) => {
				const doneSub = ollamaInstaller.onDone((ok) => {
					doneSub.dispose();
					if (ok) resolve();
					else reject(new Error('Ollama install reported failure'));
				});
				disposablesRef.current.push(() => doneSub.dispose());
				ollamaInstaller.install({ method: 'auto' });
			});

			// Re-check health: install completion does not always equal daemon
			// reachable. Give it up to ~15s before giving up.
			const ready = await waitForOllamaReady(ollamaInstaller, 15);
			if (!ready) throw new Error('Ollama installed but daemon not reachable');

			// Re-resolve hardware in case detection failed earlier (no GPU drivers
			// before install, etc.). Fall back to the existing recommendation.
			const hwNext = hardware ?? await ollamaInstaller.getHardwareInfo().catch(() => ({ vramGB: null, recommendedPack: 'fast' as ModelPackKey }));
			if (!hardware) setHardware(hwNext);
			await startPull(hwNext.recommendedPack);
		} catch (e) {
			console.error('[Express onboarding] Install failed:', e);
			setPhase('error-install');
		} finally {
			installInFlightRef.current = false;
		}
	};

	const handleDeclineInstall = () => {
		setPhase('groq-fallback');
	};

	const handleUseGroqKey = async () => {
		const trimmed = groqApiKey.trim();
		if (!trimmed.startsWith('gsk_') || trimmed.length < 20) {
			setGroqError(t('express.invalidKey'));
			return;
		}
		setGroqError(null);
		try {
			await settingsService.setSettingOfProvider('groq', 'apiKey', trimmed);
			settingsService.addModel('groq', GROQ_DEFAULT_MODEL);
			await settingsService.setModelSelectionOfFeature('Chat', { providerName: 'groq', modelName: GROQ_DEFAULT_MODEL });
			settingsService.setGlobalSetting('isOnboardingComplete', true);
			setPhase('ready');
		} catch (e) {
			console.error('[Express onboarding] Groq key save failed:', e);
			setGroqError(t('common.error'));
		}
	};

	const handleStartChatting = () => {
		// Settings already persisted; just close the UI.
		onDismiss();
	};

	// --- Power-user escape hatch: full LocalSetupWizard ---
	if (showLocalWizard) {
		return (
			<ErrorBoundary>
				<LocalSetupWizard
					onComplete={() => { setShowLocalWizard(false); onDismiss(); }}
					onSkip={() => setShowLocalWizard(false)}
				/>
			</ErrorBoundary>
		);
	}

	return (
		<ExpressShell onCustomize={() => setShowLocalWizard(true)} onDismiss={onDismiss}>
			{phase === 'detecting' && <DetectingPanel t={t} />}
			{phase === 'awaiting-install-confirm' && (
				<InstallConfirmPanel
					t={t}
					hardware={hardware}
					pack={chosenPack}
					onConfirm={handleConfirmInstall}
					onDecline={handleDeclineInstall}
				/>
			)}
			{phase === 'installing' && <InstallingPanel t={t} />}
			{phase === 'pulling' && (
				<PullingPanel
					t={t}
					modelTag={chosenPack.tag}
					percent={progressPercent}
					status={progressStatus}
				/>
			)}
			{phase === 'ready' && (
				<ReadyPanel t={t} onStart={handleStartChatting} />
			)}
			{phase === 'groq-fallback' && (
				<GroqFallbackPanel
					t={t}
					apiKey={groqApiKey}
					onApiKeyChange={(v) => { setGroqApiKey(v); if (groqError) setGroqError(null); }}
					onSubmit={handleUseGroqKey}
					errorMessage={groqError}
				/>
			)}
			{phase === 'error-install' && (
				<ErrorPanel
					t={t}
					message={t('express.error.installFailed')}
					onRetry={handleConfirmInstall}
					onFallback={() => setPhase('groq-fallback')}
				/>
			)}
			{phase === 'error-pull' && (
				<ErrorPanel
					t={t}
					message={t('express.error.pullFailed')}
					onRetry={() => startPull(chosenPack.key)}
					onFallback={() => setPhase('groq-fallback')}
				/>
			)}
		</ExpressShell>
	);
};

// allow-any-unicode-next-line
// ─── helper: poll for Ollama health ──────────────────────────────────────────

const waitForOllamaReady = async (
	installer: { isOllamaRunning(): Promise<boolean> },
	timeoutSeconds: number,
): Promise<boolean> => {
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		if (await installer.isOllamaRunning().catch(() => false)) return true;
		await new Promise<void>(r => setTimeout(r, 1000));
	}
	return false;
};

// allow-any-unicode-next-line
// ─── presentational sub-components ───────────────────────────────────────────

const ExpressShell = ({ children, onCustomize, onDismiss }: {
	children: React.ReactNode;
	onCustomize: () => void;
	onDismiss: () => void;
}) => {
	const { t } = useTranslation();
	return (
		<div
			className="w-full max-w-[640px] mx-auto rounded-[28px] border p-8 backdrop-blur-xl"
			style={{
				borderColor: 'var(--cortex-border-3, rgba(255,255,255,0.1))',
				background: 'var(--cortex-bg-2, rgba(15,15,20,0.72))',
				boxShadow: '0 40px 110px rgba(0,0,0,0.55)',
			}}
		>
			<div className="flex items-start justify-between mb-6">
				<div className="flex items-center gap-3">
					<div
						className="w-10 h-10 rounded-2xl flex items-center justify-center"
						style={{ background: 'var(--cortex-brand, #6b5bff)' }}
					>
						<Zap className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-xl font-semibold" style={{ color: 'var(--cortex-fg-0, #ffffff)' }}>
							{t('express.title')}
						</h1>
						<p className="text-sm mt-0.5" style={{ color: 'var(--cortex-fg-3, rgba(255,255,255,0.6))' }}>
							{t('express.subtitle')}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onDismiss}
					aria-label={t('express.dismiss')}
					className="btn btn-icon btn-ghost p-2"
				>
					<X className="w-4 h-4" />
				</button>
			</div>

			<div className="mb-6">{children}</div>

			<div
				className="flex items-center justify-between pt-4 border-t"
				style={{ borderColor: 'var(--cortex-border-4, rgba(255,255,255,0.06))' }}
			>
				<button
					type="button"
					onClick={onCustomize}
					className="btn btn-ghost btn-sm inline-flex items-center gap-2 text-xs font-medium"
				>
					<Settings className="w-3.5 h-3.5" />
					{t('express.customize')}
				</button>
				<button
					type="button"
					onClick={onDismiss}
					className="btn btn-ghost btn-sm text-xs font-medium"
				>
					{t('express.dismiss')}
				</button>
			</div>
		</div>
	);
};

const DetectingPanel = ({ t }: { t: ReturnType<typeof useTranslation>['t'] }) => (
	<div className="flex items-center gap-3">
		<Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cortex-brand, #6b5bff)' }} />
		<span style={{ color: 'var(--cortex-fg-2, rgba(255,255,255,0.8))' }}>{t('express.detecting')}</span>
	</div>
);

const InstallConfirmPanel = ({ t, hardware, pack, onConfirm, onDecline }: {
	t: ReturnType<typeof useTranslation>['t'];
	hardware: Hardware | null;
	pack: { key: ModelPackKey; tag: string; label: string; description: string };
	onConfirm: () => void;
	onDecline: () => void;
}) => (
	<div className="space-y-5">
		{hardware && (
			<div
				className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
				style={{
					background: 'var(--cortex-bg-3, rgba(255,255,255,0.04))',
					color: 'var(--cortex-fg-2, rgba(255,255,255,0.8))',
				}}
			>
				<Cpu className="w-4 h-4" style={{ color: 'var(--cortex-brand, #6b5bff)' }} />
				<span>
					{hardware.vramGB != null
						? interpolate(t('express.detected'), hardware.vramGB)
						: t('express.detectedNoGPU')}
				</span>
			</div>
		)}
		<div>
			<h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--cortex-fg-0, #ffffff)' }}>
				{t('express.installPromptTitle')}
			</h2>
			<p className="text-sm" style={{ color: 'var(--cortex-fg-3, rgba(255,255,255,0.6))' }}>
				{t('express.installPromptBody')}
			</p>
			<p className="text-xs mt-3" style={{ color: 'var(--cortex-fg-4, rgba(255,255,255,0.45))' }}>
				{pack.label} ({pack.tag}) - {pack.description}
			</p>
		</div>
		<div className="flex flex-col sm:flex-row gap-2">
			<button
				type="button"
				onClick={onConfirm}
				className="btn btn-primary flex-1 px-4 py-2.5 font-medium"
			>
				{t('express.installConfirm')}
			</button>
			<button
				type="button"
				onClick={onDecline}
				className="btn btn-secondary flex-1 px-4 py-2.5 font-medium"
			>
				{t('express.installDecline')}
			</button>
		</div>
	</div>
);

const InstallingPanel = ({ t }: { t: ReturnType<typeof useTranslation>['t'] }) => (
	<div className="flex items-center gap-3">
		<Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cortex-brand, #6b5bff)' }} />
		<span style={{ color: 'var(--cortex-fg-2, rgba(255,255,255,0.8))' }}>{t('express.installing')}</span>
	</div>
);

const PullingPanel = ({ t, modelTag, percent, status }: {
	t: ReturnType<typeof useTranslation>['t'];
	modelTag: string;
	percent: number;
	status: string;
}) => (
	<div className="space-y-4">
		<div className="flex items-center gap-3">
			<Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cortex-brand, #6b5bff)' }} />
			<span style={{ color: 'var(--cortex-fg-2, rgba(255,255,255,0.8))' }}>
				{interpolate(t('express.pullingPercent'), modelTag, percent)}
			</span>
		</div>
		<div
			className="w-full h-2 rounded-full overflow-hidden"
			style={{ background: 'var(--cortex-bg-3, rgba(255,255,255,0.06))' }}
		>
			<div
				className="h-full rounded-full transition-all duration-300"
				style={{
					width: `${Math.min(100, Math.max(0, percent))}%`,
					background: 'var(--cortex-brand, #6b5bff)',
				}}
			/>
		</div>
		{status && (
			<div className="text-xs" style={{ color: 'var(--cortex-fg-4, rgba(255,255,255,0.45))' }}>
				{status}
			</div>
		)}
	</div>
);

const ReadyPanel = ({ t, onStart }: {
	t: ReturnType<typeof useTranslation>['t'];
	onStart: () => void;
}) => (
	<div className="space-y-4">
		<div className="flex items-center gap-3">
			<div
				className="w-9 h-9 rounded-xl flex items-center justify-center"
				style={{ background: 'rgba(16, 185, 129, 0.18)' }}
			>
				<Check className="w-5 h-5" style={{ color: 'rgb(52, 211, 153)' }} />
			</div>
			<span className="text-base font-medium" style={{ color: 'var(--cortex-fg-0, #ffffff)' }}>
				{t('express.ready')}
			</span>
		</div>
		<button
			type="button"
			onClick={onStart}
			className="btn btn-primary w-full px-4 py-2.5 font-medium"
		>
			{t('express.startChatting')}
		</button>
	</div>
);

const GroqFallbackPanel = ({ t, apiKey, onApiKeyChange, onSubmit, errorMessage }: {
	t: ReturnType<typeof useTranslation>['t'];
	apiKey: string;
	onApiKeyChange: (v: string) => void;
	onSubmit: () => void;
	errorMessage: string | null;
}) => (
	<div className="space-y-5">
		<div>
			<h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--cortex-fg-0, #ffffff)' }}>
				{t('express.fallbackTitle')}
			</h2>
			<p className="text-sm" style={{ color: 'var(--cortex-fg-3, rgba(255,255,255,0.6))' }}>
				{t('express.fallbackBody')}
			</p>
		</div>

		<a
			href={GROQ_KEYS_URL}
			target="_blank"
			rel="noopener noreferrer"
			className="btn btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
		>
			<ExternalLink className="w-4 h-4" />
			{t('express.openGroqKeyPage')}
		</a>

		<div className="space-y-2">
			<input
				type="password"
				autoComplete="off"
				spellCheck={false}
				value={apiKey}
				onChange={(e) => onApiKeyChange(e.target.value)}
				placeholder={t('express.pasteKeyPlaceholder')}
				className="input w-full px-3 py-2.5 text-sm font-mono outline-none"
			/>
			{errorMessage && (
				<p className="text-xs" style={{ color: 'rgb(248, 113, 113)' }}>{errorMessage}</p>
			)}
		</div>

		<button
			type="button"
			onClick={onSubmit}
			disabled={!apiKey.trim()}
			className="btn btn-primary w-full px-4 py-2.5 font-medium"
		>
			{t('express.useGroqKey')}
		</button>
	</div>
);

const ErrorPanel = ({ t, message, onRetry, onFallback }: {
	t: ReturnType<typeof useTranslation>['t'];
	message: string;
	onRetry: () => void;
	onFallback: () => void;
}) => (
	<div className="space-y-4">
		<p className="text-sm" style={{ color: 'var(--cortex-fg-2, rgba(255,255,255,0.8))' }}>
			{message}
		</p>
		<div className="flex flex-col sm:flex-row gap-2">
			<button
				type="button"
				onClick={onRetry}
				className="btn btn-primary flex-1 px-4 py-2.5 font-medium"
			>
				{t('express.retry')}
			</button>
			<button
				type="button"
				onClick={onFallback}
				className="btn btn-secondary flex-1 px-4 py-2.5 font-medium"
			>
				{t('express.useCloudInstead')}
			</button>
		</div>
	</div>
);
