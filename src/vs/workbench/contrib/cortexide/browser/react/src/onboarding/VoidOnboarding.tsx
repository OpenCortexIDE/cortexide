/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css';
import { useEffect, useState, useMemo } from 'react';
import { useAccessor, useIsDark, useSettingsState } from '../util/services.js';
import { useTranslation } from '../util/useTranslation.js';
import { Brain, Check, ChevronRight, DollarSign, ExternalLink, Lock, X } from 'lucide-react';
import { displayInfoOfProviderName, ProviderName, providerNames, localProviderNames, nonlocalProviderNames, featureNames, FeatureName, isFeatureNameDisabled } from '../../../../common/cortexideSettingsTypes.js';
import { isCapableLocalCoder } from '../../../../common/routing/codingModelScore.js';
import { builtinToolCount } from '../../../../common/builtinToolNames.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';
import { OllamaSetupInstructions, OneClickSwitchButton, SettingsForProvider, ModelDump } from '../settings/Settings.js';
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { FileAccess } from '../../../../../../../base/common/network.js';
import { LocalSetupWizard } from './LocalSetupWizard.js';
import { ExpressOnboardingFlow } from './ExpressOnboardingFlow.js';
import { applyLlamaServerPreset, tryAutoAssignAutocompleteModel, tryAutoAssignChatModel } from '../../../../common/onboardingHelpers.js';

const OVERRIDE_VALUE = false

const getHeroLogoUri = () => FileAccess.asBrowserUri('vs/workbench/browser/media/code-icon.svg').toString(true)

const welcomeHighlights = [
	'Chat + Quick Edit',
	'Fast Apply diffs',
	'PDF & image uploads',
	'Local & cloud models',
];

const welcomeStats = [
	{ label: 'Uploads', value: 'PDFs + Images', detail: 'Drop specs, screenshots, and research straight into chat' },
	{ label: 'Fast Apply', value: 'Line-by-line', detail: 'Approve every change from the diff that generated it' },
	{ label: 'Model router', value: 'Auto-switch', detail: 'Chooses Anthropic, GPT-4o, Gemini, DeepSeek, or Ollama per task' },
	{ label: 'Agent tools', value: `${builtinToolCount} built-ins`, detail: 'File edits, terminal, web search, LSP navigation, code review, and more' },
];

export const VoidOnboarding = () => {

	const accessor = useAccessor()
	const settingsService = accessor.get('ICortexideSettingsService')

	const voidSettingsState = useSettingsState()
	const isOnboardingComplete = voidSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE

	const isDark = useIsDark()

	// "Use the full guided wizard" escape hatch — flips the express UI off
	// for power users who want the legacy multi-step flow.
	const [useExpressFlow, setUseExpressFlow] = useState<boolean>(true)

	// "Capable setup" = the user already has something that can do agentic coding out of the box: a
	// configured cloud provider, OR a local coder big enough for agentic work (>= 7B). We show the
	// express flow (which, when ollama is running, auto-pulls the hardware-recommended coder) not only
	// on a genuine first launch, but also when ollama is running with only tiny/general models and no
	// capable coder — so a fresh user is never left with a local setup that can't actually do agentic
	// coding. A user WITH a capable setup skips express; selection is then handled by Auto + the router.
	const hasCloudProvider = nonlocalProviderNames.some((p) => voidSettingsState.settingsOfProvider[p]?._didFillInProviderSettings)
	const hasCapableLocalCoder = localProviderNames.some((p) => {
		const ps = voidSettingsState.settingsOfProvider[p] as { _didFillInProviderSettings?: boolean; models?: { modelName: string }[] } | undefined
		return !!ps?._didFillInProviderSettings && (ps?.models ?? []).some((m) => isCapableLocalCoder((m.modelName || '').toLowerCase()))
	})
	const hasCapableSetup = hasCloudProvider || hasCapableLocalCoder

	// Express path is the default when onboarding is incomplete, the user hasn't opted into the legacy
	// wizard, and they don't yet have a capable setup for agentic coding.
	const showExpressFlow = useExpressFlow && !isOnboardingComplete && !hasCapableSetup

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
			<div
				className={`
					cortex-onboarding-root fixed inset-0 z-[99999] flex items-start justify-center px-6 py-12
					backdrop-blur-[28px]
					overflow-y-auto
					transition-all duration-700 ease-in-out
					${isOnboardingComplete ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 pointer-events-auto'}
				`}
				style={{
					backgroundColor: 'var(--vscode-editor-background, #050507)',
					backgroundImage: 'radial-gradient(circle at 18% -15%, rgba(255,255,255,0.06), transparent 55%), radial-gradient(circle at 82% 0%, rgba(0,0,0,0.55), transparent 50%)',
				}}
			>
				<ErrorBoundary>
					<div className="w-full max-w-[1200px] py-6">
						{showExpressFlow ? (
							<ExpressOnboardingFlow
								onCustomize={() => setUseExpressFlow(false)}
								onDismiss={() => {
									// "Skip for now" / "Start chatting" - mark onboarding complete so
									// the overlay closes. The full settings pane remains reachable
									// for later configuration.
									settingsService.setGlobalSetting('isOnboardingComplete', true)
								}}
							/>
						) : (
							<VoidOnboardingContent />
						)}
					</div>
				</ErrorBoundary>
			</div>
		</div>
	)
}

const VoidIcon = () => {
	const heroLogoUri = useMemo(() => getHeroLogoUri(), []);
	return (
		<div className="w-full max-w-[220px] aspect-square rounded-full border border-white/10 bg-black shadow-[0_45px_120px_rgba(0,0,0,0.95)] overflow-hidden">
			<img
				src={heroLogoUri}
				alt="CortexIDE logo"
				className="w-full h-full object-contain opacity-95"
				draggable={false}
				onError={(e) => {
					console.error('Failed to load CortexIDE logo:', heroLogoUri);
					// Fallback: try direct path
					const fallbackUri = FileAccess.asBrowserUri('vs/workbench/browser/media/cortexide-main.png').toString(true);
					if (fallbackUri !== heroLogoUri) {
						(e.target as HTMLImageElement).src = fallbackUri;
					}
				}}
			/>
		</div>
	)
}

const FADE_DURATION_MS = 2000

const FadeIn = ({ children, className, delayMs = 0, durationMs, ...props }: { children: React.ReactNode, delayMs?: number, durationMs?: number, className?: string } & React.HTMLAttributes<HTMLDivElement>) => {

	const [opacity, setOpacity] = useState(0)

	const effectiveDurationMs = durationMs ?? FADE_DURATION_MS

	useEffect(() => {

		const timeout = setTimeout(() => {
			setOpacity(1)
		}, delayMs)

		return () => clearTimeout(timeout)
	}, [setOpacity, delayMs])


	return (
		<div className={className} style={{ opacity, transition: `opacity ${effectiveDurationMs}ms ease-in-out` }} {...props}>
			{children}
		</div>
	)
}

// Onboarding

// =============================================
//  New AddProvidersPage Component and helpers
// =============================================

const tabNames = ['Free', 'Paid', 'Local'] as const;

type TabName = typeof tabNames[number] | 'Cloud/Other';

// Data for cloud providers tab
const cloudProviders: ProviderName[] = ['googleVertex', 'liteLLM', 'microsoftAzure', 'awsBedrock', 'openAICompatible'];

const freeProviders: ProviderName[] = ['gemini', 'openRouter', 'pollinations', 'moonshot'];

const localTabProviders: ProviderName[] = [...localProviderNames, 'openAICompatible'];

// Data structures for provider tabs
const providerNamesOfTab: Record<TabName, ProviderName[]> = {
	Free: freeProviders,
	Local: localTabProviders,
	Paid: providerNames.filter(pn => !([...freeProviders, ...localProviderNames, ...cloudProviders] as string[]).includes(pn)) as ProviderName[],
	'Cloud/Other': cloudProviders,
};

const descriptionOfTab: Record<TabName, string> = {
	Free: `Providers with a 100% free tier. Add as many as you'd like!`,
	Paid: `Connect directly with any provider (bring your own key).`,
	Local: `Active providers should appear automatically. Add as many as you'd like! `,
	'Cloud/Other': `Add as many as you'd like! Reach out for custom configuration requests.`,
};


const featureNameMap: { display: string, featureName: FeatureName }[] = [
	{ display: 'Chat', featureName: 'Chat' },
	{ display: 'Quick Edit', featureName: 'Ctrl+K' },
	{ display: 'Autocomplete', featureName: 'Autocomplete' },
	{ display: 'Fast Apply', featureName: 'Apply' },
	{ display: 'Source Control', featureName: 'SCM' },
];

const AddProvidersPage = ({ pageIndex, setPageIndex }: { pageIndex: number, setPageIndex: (index: number) => void }) => {
	const [currentTab, setCurrentTab] = useState<TabName>('Free');
	const settingsState = useSettingsState();
	const accessor = useAccessor();
	const settingsService = accessor.get('ICortexideSettingsService');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [showLocalWizard, setShowLocalWizard] = useState(false);

	// Clear error message after 5 seconds
	useEffect(() => {
		let timeoutId: NodeJS.Timeout | null = null;

		if (errorMessage) {
			timeoutId = setTimeout(() => {
				setErrorMessage(null);
			}, 5000);
		}

		// Cleanup function to clear the timeout if component unmounts or error changes
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [errorMessage]);

	return (
		<div className="flex flex-col gap-8 w-full min-h-[75vh] max-w-[1000px] mx-auto">
			<div className="space-y-2 text-center md:text-left">
				<p className="text-xs uppercase tracking-[0.35em] text-void-fg-4">Step 02</p>
				<h2 className="text-4xl font-light text-void-fg-0">Choose your model providers</h2>
				<p className="text-base text-void-fg-3 max-w-2xl mx-auto md:mx-0">
					Load multiple providers at once. CortexIDE can route Chat, Quick Edit, and Autocomplete to the strongest model on every request.
				</p>
			</div>

			<div className="flex flex-col md:flex-row flex-1 gap-6">
				{/* Left rail */}
				<div className="md:w-1/3 w-full flex flex-col gap-6 p-6 cortex-card h-full overflow-y-auto">
					<div className="flex flex-wrap md:flex-col gap-2">
						{[...tabNames, 'Cloud/Other'].map(tab => (
							<button
								type="button"
								key={tab}
								className={`btn w-full text-left px-4 py-3 text-sm font-medium tracking-wide ${currentTab === tab ? 'btn-primary' : 'btn-secondary'}`}
								onClick={() => {
									setCurrentTab(tab as TabName);
									setErrorMessage(null);
								}}
							>
								{tab}
							</button>
						))}
					</div>

					<div className="grid gap-3 mt-2 text-sm">
						<p className="uppercase text-[11px] tracking-[0.4em] text-void-fg-4">Feature coverage</p>
						{featureNameMap.map(({ display, featureName }) => {
							const hasModel = settingsState.modelSelectionOfFeature[featureName] !== null;
							return (
								<div key={featureName} className="flex items-center justify-between cortex-card-muted px-4 py-3">
									<span>{display}</span>
									{hasModel ? (
										<span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
											<Check className="w-4 h-4" /> Connected
										</span>
									) : (
										<span className="text-xs text-void-fg-4">Pending</span>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 flex flex-col cortex-card p-6">
					<div className="w-full max-w-xl mx-auto text-center mb-8 space-y-3">
						<p className="text-xs uppercase tracking-[0.35em] text-void-fg-4">Active tab</p>
						<div className="text-4xl font-light text-void-fg-0">{currentTab}</div>
						<div className="text-sm text-void-fg-3">{descriptionOfTab[currentTab]}</div>
					</div>

					<div className="space-y-6 overflow-y-auto pr-1 flex-1">
						{currentTab === 'Local' && !showLocalWizard && (
							<button
								type="button"
								className="btn btn-primary w-full flex items-center justify-between px-5 py-4 text-left"
								onClick={() => setShowLocalWizard(true)}
							>
								<div>
									<div className="font-semibold text-sm text-void-fg-0">Set up local AI automatically</div>
									// allow-any-unicode-next-line
									<div className="text-xs text-void-fg-3 mt-0.5">Install Ollama + download the best model for your hardware — guided setup in 2 minutes</div>
								</div>
								<ChevronRight size={16} className="text-void-fg-3 flex-shrink-0 ml-4" />
							</button>
						)}
						{currentTab === 'Local' && !showLocalWizard && (
							<button
								type="button"
								className="btn btn-secondary w-full flex items-center justify-between px-5 py-4 text-left"
								onClick={() => { void applyLlamaServerPreset(settingsService); }}
							>
								<div>
									<div className="font-semibold text-sm text-void-fg-0">Use llama-server (llama.cpp)</div>
									<div className="text-xs text-void-fg-3 mt-0.5">Prefill OpenAI-Compatible endpoint http://127.0.0.1:8080/v1 — then add your .gguf model name below</div>
								</div>
								<ChevronRight size={16} className="text-void-fg-3 flex-shrink-0 ml-4" />
							</button>
						)}
						{currentTab === 'Local' && showLocalWizard && (
							<ErrorBoundary>
								<LocalSetupWizard
									onComplete={() => setShowLocalWizard(false)}
									onSkip={() => setShowLocalWizard(false)}
								/>
							</ErrorBoundary>
						)}
						{(!showLocalWizard) && providerNamesOfTab[currentTab].map((providerName) => (
							<div key={providerName} className="cortex-card-muted p-5">
								<div className="flex items-center justify-between mb-3">
									<div className="text-xl font-medium text-void-fg-0 flex items-center gap-2">
										Add {displayInfoOfProviderName(providerName).title}
										{(providerName === 'gemini' || providerName === 'openRouter' || providerName === 'pollinations') && (
											<span
												data-tooltip-id="cortex-tooltip-provider-info"
												data-tooltip-place="right"
												className="text-xs text-blue-400"
												data-tooltip-content={providerName === 'gemini'
													? 'Gemini 2.5 Pro offers 25 free chats daily, Flash offers ~500. Upgrade later if you exhaust credits.'
													: providerName === 'openRouter'
														? 'OpenRouter grants 50 free chats a day (1000 with a $10 deposit) on models tagged :free.'
														: 'Cheap API with many models (Pollen credits). Get your key at enter.pollinations.ai.'}
											>
												Details
											</span>
										)}
									</div>
									{providerName === 'ollama' && (
										<span className="inline-flex items-center gap-1 text-xs text-void-fg-3">
											<Lock size={12} /> Local
										</span>
									)}
								</div>

								<SettingsForProvider providerName={providerName} showProviderTitle={false} showProviderSuggestions={true} />

								{providerName === 'ollama' && (
									<div className="mt-4 cortex-card-muted bg-black/20">
										<OllamaSetupInstructions />
									</div>
								)}
							</div>
						))}
					</div>

					{(currentTab === 'Local' || currentTab === 'Cloud/Other') && !showLocalWizard && (
						<div className="w-full mt-6 cortex-card-muted p-6">
							<div className="flex items-center gap-2 mb-4">
								<div className="text-xl font-medium">Models</div>
							</div>
							{currentTab === 'Local' && (
								<div className="text-sm text-void-fg-3 mb-4">Local models auto-detect when possible. Add custom entries to fine tune routing.</div>
							)}
							{currentTab === 'Local' && <ModelDump filteredProviders={localTabProviders} />}
							{currentTab === 'Cloud/Other' && <ModelDump filteredProviders={cloudProviders} />}
						</div>
					)}

					<div className="flex flex-col gap-3 items-end w-full mt-6">
						{errorMessage && (
							<div className="w-full text-sm cortex-alert-warning px-4 py-3 text-right">
								{errorMessage}
							</div>
						)}
						<div className="flex items-center gap-2">
							<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
							<NextButton
								onClick={async () => {
									let state = settingsState;
									state = await tryAutoAssignChatModel(settingsService, state);
									await tryAutoAssignAutocompleteModel(settingsService, state);
									const isDisabled = isFeatureNameDisabled('Chat', settingsService.state);
									if (!isDisabled) {
										setPageIndex(pageIndex + 1);
										setErrorMessage(null);
									} else {
										setErrorMessage("Please connect at least one Chat-capable model before moving on.");
									}
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
// =============================================
// 	OnboardingPage
// 		title:
// 			div
// 				"Welcome to Void"
// 			image
// 		content:<></>
// 		title
// 		content
// 		prev/next

// 	OnboardingPage
// 		title:
// 			div
// 				"How would you like to use Void?"
// 		content:
// 			ModelQuestionContent
// 				|
// 					div
// 						"I want to:"
// 					div
// 						"Use the smartest models"
// 						"Keep my data fully private"
// 						"Save money"
// 						"I don't know"
// 				| div
// 					| div
// 						"We recommend using "
// 						"Set API"
// 					| div
// 						""
// 					| div
//
// 		title
// 		content
// 		prev/next
//
// 	OnboardingPage
// 		title
// 		content
// 		prev/next

const NextButton = ({ onClick, ...props }: { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	const { disabled, className = '', ...buttonProps } = props;

	return (
		<button
			type="button"
			onClick={disabled ? undefined : onClick}
			onDoubleClick={onClick}
			className={`btn btn-primary inline-flex items-center gap-2 ${className}`.trim()}
			disabled={disabled}
			{...disabled && {
				'data-tooltip-id': 'cortex-tooltip',
				"data-tooltip-content": 'Please enter all required fields or choose another provider',
				"data-tooltip-place": 'top',
			}}
			{...buttonProps}
		>
			Next
			<ChevronRight className="w-4 h-4" />
		</button>
	)
}

const PreviousButton = ({ onClick, ...props }: { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	return (
		<button
			type="button"
			onClick={onClick}
			className="btn btn-secondary"
			{...props}
		>
			Back
		</button>
	)
}



const OnboardingPageShell = ({ top, bottom, content, hasMaxWidth = true, className = '', }: {
	top?: React.ReactNode,
	bottom?: React.ReactNode,
	content?: React.ReactNode,
	hasMaxWidth?: boolean,
	className?: string,
}) => {
	return (
		<div className={`min-h-[70vh] w-full ${className}`}>
			<div className={`
				text-lg flex flex-col gap-6 w-full h-full mx-auto px-8 py-10 cortex-card
				${hasMaxWidth ? 'max-w-[720px]' : ''}
				max-h-[calc(100vh-6rem)]
				overflow-y-auto
			`}>
				{top && <FadeIn className='w-full mb-auto'>{top}</FadeIn>}
				{content && <FadeIn className='w-full my-auto'>{content}</FadeIn>}
				{bottom && <div className='w-full pt-6'>{bottom}</div>}
			</div>
		</div>
	)
}

const WelcomePage = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
	const { t } = useTranslation()
	return (
		<div className="space-y-8">
			<div className="cortex-card-elevated px-10 py-12">
				<div className="flex flex-col lg:flex-row gap-10 items-center">
					<div className="flex-1 flex flex-col gap-6 text-center lg:text-left">
						<p className="text-xs uppercase tracking-[0.45em] text-void-fg-4">{t('onboarding.welcome')}</p>
						<div>
							<h1 className="text-5xl font-light text-void-fg-0">{t('onboarding.headline')}</h1>
							<p className="text-base text-void-fg-2 mt-3 max-w-xl mx-auto lg:mx-0">
								CortexIDE keeps Chat, Quick Edit, Fast Apply, and source control in the same dark workspace-and it adds native PDF + image uploads so product specs and design mocks travel with every conversation.
							</p>
						</div>
						<div className="flex flex-wrap gap-3 justify-center lg:justify-start">
							{welcomeHighlights.map((highlight) => (
								<span key={highlight} className="cortex-chip">
									{highlight}
								</span>
							))}
						</div>
						<div className="flex flex-wrap gap-3 justify-center lg:justify-start">
							<PrimaryActionButton ringSize='xl' onClick={onNext}>{t('onboarding.startGuided')}</PrimaryActionButton>
							<SecondaryActionButton onClick={onSkip}>{t('onboarding.chooseLater')}</SecondaryActionButton>
						</div>
					</div>
					<div className="flex-1 w-full flex flex-col items-center gap-6">
						<div className="relative w-full max-w-sm aspect-square">
							<div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent blur-3xl rounded-[32px]" />
							<div className="relative w-full h-full cortex-card-muted flex items-center justify-center p-6">
								<VoidIcon />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4 w-full max-w-sm">
							{welcomeStats.map(({ label, value, detail }) => (
								<div key={label} className="cortex-card-muted p-4 text-center text-void-fg-2">
									<p className="text-[11px] uppercase tracking-[0.4em] text-void-fg-4">{label}</p>
									<p className="text-lg font-medium text-void-fg-0 mt-2">{value}</p>
									<p className="text-xs text-void-fg-3 mt-1">{detail}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

const OllamaDownloadOrRemoveModelButton = ({ modelName, isModelInstalled, sizeGb }: { modelName: string, isModelInstalled: boolean, sizeGb: number | false | 'not-known' }) => {
	// for now just link to the ollama download page
	return <a
		href={`https://ollama.com/library/${modelName}`}
		target="_blank"
		rel="noopener noreferrer"
		className="flex items-center justify-center text-void-fg-2 hover:text-void-fg-1"
	>
		<ExternalLink className="w-3.5 h-3.5" />
	</a>

}


const YesNoText = ({ val }: { val: boolean | null }) => {

	return <div
		className={
			val === true ? "text text-emerald-500"
				: val === false ? 'text-rose-600'
					: "text text-amber-300"
		}
	>
		{
			val === true ? "Yes"
				: val === false ? 'No'
					: "Yes*"
		}
	</div>

}



const abbreviateNumber = (num: number): string => {
	if (num >= 1000000) {
		// For millions
		return Math.floor(num / 1000000) + 'M';
	} else if (num >= 1000) {
		// For thousands
		return Math.floor(num / 1000) + 'K';
	} else {
		// For numbers less than 1000
		return num.toString();
	}
}





const PrimaryActionButton = ({ children, className = '', ringSize, ...props }: { children: React.ReactNode, ringSize?: undefined | 'xl' | 'screen' } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	const sizingClass = ringSize === 'xl'
		? 'px-10 py-4 text-lg'
		: ringSize === 'screen'
			? 'px-16 py-8 text-2xl w-full'
			: 'px-5 py-2.5 text-base';

	return (
		<button
			type='button'
			className={`
				btn btn-primary inline-flex items-center justify-center gap-2 font-semibold tracking-tight leading-normal min-h-[44px] group
				${sizingClass}
				${className}
			`.trim()}
			{...props}
		>
			<span className="inline-flex items-center gap-2">{children}</span>
			<ChevronRight
				className="transition-transform duration-300 ease-in-out group-hover:translate-x-1 group-active:translate-x-1"
			/>
		</button>
	)
}

const SecondaryActionButton = ({ children, className = '', ...props }: { children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
	<button
		type="button"
		className={`btn btn-secondary ${className}`.trim()}
		{...props}
	>
		{children}
	</button>
)


type WantToUseOption = 'smart' | 'private' | 'cheap' | 'all'

const VoidOnboardingContent = () => {

	const { t } = useTranslation()
	const accessor = useAccessor()
	const cortexideSettingsService = accessor.get('ICortexideSettingsService')
	const voidMetricsService = accessor.get('IMetricsService')

	const voidSettingsState = useSettingsState()

	const [pageIndex, setPageIndex] = useState(0)


	// page 1 state
	const [wantToUseOption, setWantToUseOption] = useState<WantToUseOption>('smart')

	// Replace the single selectedProviderName with four separate states
	// page 2 state - each tab gets its own state
	const [selectedIntelligentProvider, setSelectedIntelligentProvider] = useState<ProviderName>('anthropic');
	const [selectedPrivateProvider, setSelectedPrivateProvider] = useState<ProviderName>('ollama');
	const [selectedAffordableProvider, setSelectedAffordableProvider] = useState<ProviderName>('gemini');
	const [selectedAllProvider, setSelectedAllProvider] = useState<ProviderName>('anthropic');

	// Helper function to get the current selected provider based on active tab
	const getSelectedProvider = (): ProviderName => {
		switch (wantToUseOption) {
			case 'smart': return selectedIntelligentProvider;
			case 'private': return selectedPrivateProvider;
			case 'cheap': return selectedAffordableProvider;
			case 'all': return selectedAllProvider;
		}
	}

	// Helper function to set the selected provider for the current tab
	const setSelectedProvider = (provider: ProviderName) => {
		switch (wantToUseOption) {
			case 'smart': setSelectedIntelligentProvider(provider); break;
			case 'private': setSelectedPrivateProvider(provider); break;
			case 'cheap': setSelectedAffordableProvider(provider); break;
			case 'all': setSelectedAllProvider(provider); break;
		}
	}

	const providerNamesOfWantToUseOption: { [wantToUseOption in WantToUseOption]: ProviderName[] } = {
		smart: ['anthropic', 'openAI', 'gemini', 'openRouter'],
		private: ['ollama', 'vLLM', 'openAICompatible', 'lmStudio'],
		cheap: ['gemini', 'deepseek', 'openRouter', 'pollinations', 'ollama', 'vLLM'],
		all: providerNames,
	}


	const selectedProviderName = getSelectedProvider();
	const didFillInProviderSettings = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName]._didFillInProviderSettings
	const isApiKeyLongEnoughIfApiKeyExists = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].apiKey ? voidSettingsState.settingsOfProvider[selectedProviderName].apiKey.length > 15 : true
	const isAtLeastOneModel = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].models.length >= 1

	const didFillInSelectedProviderSettings = !!(didFillInProviderSettings && isApiKeyLongEnoughIfApiKeyExists && isAtLeastOneModel)

	const skipOnboarding = (reason: string) => {
		cortexideSettingsService.setGlobalSetting('isOnboardingComplete', true);
		voidMetricsService.capture('Skipped Onboarding', { reason, pageIndex, wantToUseOption, selectedProviderName });
	}

	const prevAndNextButtons = <div className="max-w-[600px] w-full mx-auto flex flex-col items-end">
		<div className="flex items-center gap-2">
			<PreviousButton
				onClick={() => { setPageIndex(pageIndex - 1) }}
			/>
			<NextButton
				onClick={() => { setPageIndex(pageIndex + 1) }}
			/>
		</div>
	</div>


	const lastPagePrevAndNextButtons = <div className="max-w-[600px] w-full mx-auto flex flex-col items-end">
		<div className="flex items-center gap-2">
			<PreviousButton
				onClick={() => { setPageIndex(pageIndex - 1) }}
			/>
			<SecondaryActionButton onClick={() => skipOnboarding('final-step-skip')}>{t('onboarding.chooseLater')}</SecondaryActionButton>
			<PrimaryActionButton
				onClick={() => {
					cortexideSettingsService.setGlobalSetting('isOnboardingComplete', true);
					voidMetricsService.capture('Completed Onboarding', { selectedProviderName, wantToUseOption })
				}}
				ringSize={voidSettingsState.globalSettings.isOnboardingComplete ? 'screen' : undefined}
			>{t('onboarding.startApp')}</PrimaryActionButton>
		</div>
	</div>


	// cannot be md
	const basicDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Models with the best performance on benchmarks.",
		private: "Host on your computer or local network for full data privacy.",
		cheap: "Free and affordable options.",
		all: "",
	}

	// can be md
	const detailedDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Most intelligent and best for agent mode.",
		private: "Private-hosted so your data never leaves your computer or network. [Email us](mailto:hello@cortexide.com) for help setting up at your company.",
		cheap: "Use great deals like Gemini 2.5 Pro, or self-host a model with Ollama or vLLM for free.",
		all: "",
	}

	// Modified: initialize separate provider states on initial render instead of watching wantToUseOption changes
	useEffect(() => {
		if (selectedIntelligentProvider === undefined) {
			setSelectedIntelligentProvider(providerNamesOfWantToUseOption['smart'][0]);
		}
		if (selectedPrivateProvider === undefined) {
			setSelectedPrivateProvider(providerNamesOfWantToUseOption['private'][0]);
		}
		if (selectedAffordableProvider === undefined) {
			setSelectedAffordableProvider(providerNamesOfWantToUseOption['cheap'][0]);
		}
		if (selectedAllProvider === undefined) {
			setSelectedAllProvider(providerNamesOfWantToUseOption['all'][0]);
		}
	}, []);

	// reset the page to page 0 if the user redos onboarding
	useEffect(() => {
		if (!voidSettingsState.globalSettings.isOnboardingComplete) {
			setPageIndex(0)
		}
	}, [setPageIndex, voidSettingsState.globalSettings.isOnboardingComplete])


	const contentOfIdx: { [pageIndex: number]: React.ReactNode } = {
		0: <WelcomePage onNext={() => setPageIndex(1)} onSkip={() => skipOnboarding('welcome-skip')} />,

		1: <OnboardingPageShell hasMaxWidth={false}
			content={
				<AddProvidersPage pageIndex={pageIndex} setPageIndex={setPageIndex} />
			}
		/>,
		2: <OnboardingPageShell

			content={
				<div>
					<div className="text-5xl font-light text-center">{t('onboarding.settingsAndThemes')}</div>

					<div className="mt-8 text-center flex flex-col items-center gap-4 w-full max-w-md mx-auto">
						<h4 className="text-void-fg-3 mb-4">{t('onboarding.transferSettings')}</h4>
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="VS Code" />
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="Cursor" />
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="Windsurf" />
					</div>
				</div>
			}
			bottom={lastPagePrevAndNextButtons}
		/>,
	}


	return <div key={pageIndex} className="w-full h-[80vh] text-left mx-auto flex flex-col items-center justify-center">
		<ErrorBoundary>
			{contentOfIdx[pageIndex]}
		</ErrorBoundary>
	</div>

}
