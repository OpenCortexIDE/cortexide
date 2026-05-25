/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css';
import { useEffect, useState, useMemo } from 'react';
import { useAccessor, useIsDark, useSettingsState } from '../util/services.js';
import { useTranslation } from '../util/useTranslation.js';
import { Brain, Check, ChevronRight, DollarSign, ExternalLink, Lock, X } from 'lucide-react';
import { displayInfoOfProviderName, ProviderName, providerNames, localProviderNames, featureNames, FeatureName, isFeatureNameDisabled } from '../../../../common/cortexideSettingsTypes.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';
import { OllamaSetupInstructions, OneClickSwitchButton, SettingsForProvider, ModelDump } from '../settings/Settings.js';
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { FileAccess } from '../../../../../../../base/common/network.js';
import { LocalSetupWizard } from './LocalSetupWizard.js';
import { ExpressOnboardingFlow } from './ExpressOnboardingFlow.js';

const OVERRIDE_VALUE = false

const getHeroLogoUri = () => FileAccess.asBrowserUri('vs/workbench/browser/media/cortexide-main.png').toString(true)

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
	{ label: 'Agent tools', value: '27 built-ins', detail: 'File edits, terminal, web search, LSP navigation, code review, and more' },
];

// Returns true if the user has configured at least one provider with a complete
// set of fields. Used to decide whether to show the express path (no provider yet)
// or fall back to the full multi-step wizard (user has started configuring providers).
const userHasAnyProvider = (state: ReturnType<typeof useSettingsState>): boolean => {
	const providers = state.settingsOfProvider as Record<string, { _didFillInProviderSettings?: boolean }>;
	for (const key of Object.keys(providers)) {
		if (providers[key]?._didFillInProviderSettings) return true;
	}
	return false;
}

export const VoidOnboarding = () => {

	const accessor = useAccessor()
	const settingsService = accessor.get('ICortexideSettingsService')

	const voidSettingsState = useSettingsState()
	const isOnboardingComplete = voidSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE

	const isDark = useIsDark()

	// "Use the full guided wizard" escape hatch — flips the express UI off
	// for power users who want the legacy multi-step flow.
	const [useExpressFlow, setUseExpressFlow] = useState<boolean>(true)

	const hasAnyProvider = userHasAnyProvider(voidSettingsState)
	// Express path is the default when:
	//   - onboarding is incomplete, AND
	//   - no provider is configured yet (i.e. genuine first-launch), AND
	//   - the user has not opted into the legacy wizard.
	const showExpressFlow = useExpressFlow && !isOnboardingComplete && !hasAnyProvider

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
			<div
				className={`
					fixed inset-0 z-[99999] flex items-start justify-center px-6 py-12
					bg-[#050507]
					backdrop-blur-[28px]
					overflow-y-auto
					transition-all duration-700 ease-in-out
					${isOnboardingComplete ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 pointer-events-auto'}
				`}
				style={{
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

// Data structures for provider tabs
const providerNamesOfTab: Record<TabName, ProviderName[]> = {
	Free: freeProviders,
	Local: localProviderNames,
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
				<div className="md:w-1/3 w-full flex flex-col gap-6 p-6 rounded-[28px] border border-void-border-3 bg-void-bg-2/70 shadow-[0_35px_90px_rgba(0,0,0,0.35)] h-full overflow-y-auto">
					<div className="flex flex-wrap md:flex-col gap-2">
						{[...tabNames, 'Cloud/Other'].map(tab => (
							<button
								key={tab}
								className={`
									w-full rounded-2xl px-4 py-3 text-left text-sm font-medium tracking-wide transition-all duration-200
									${currentTab === tab
										? 'bg-gradient-to-r from-[#0e70c0] to-[#6b5bff] text-white shadow-[0_18px_40px_rgba(28,107,219,0.35)]'
										: 'bg-void-bg-3/90 text-void-fg-2 border border-void-border-3 hover:border-void-border-1'}
								`}
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
								<div key={featureName} className="flex items-center justify-between rounded-2xl border border-void-border-4/80 bg-void-bg-3/60 px-4 py-3">
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
				<div className="flex-1 flex flex-col rounded-[32px] border border-void-border-3 bg-void-bg-1/70 backdrop-blur-xl shadow-[0_45px_120px_rgba(0,0,0,0.45)] p-6">
					<div className="w-full max-w-xl mx-auto text-center mb-8 space-y-3">
						<p className="text-xs uppercase tracking-[0.35em] text-void-fg-4">Active tab</p>
						<div className="text-4xl font-light text-void-fg-0">{currentTab}</div>
						<div className="text-sm text-void-fg-3">{descriptionOfTab[currentTab]}</div>
					</div>

					<div className="space-y-6 overflow-y-auto pr-1 flex-1">
						{currentTab === 'Local' && !showLocalWizard && (
							<button
								className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 border-[var(--cortex-brand)]/40 bg-[var(--cortex-brand)]/10 hover:bg-[var(--cortex-brand)]/20 transition-colors text-left"
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
						{currentTab === 'Local' && showLocalWizard && (
							<ErrorBoundary>
								<LocalSetupWizard
									onComplete={() => setShowLocalWizard(false)}
									onSkip={() => setShowLocalWizard(false)}
								/>
							</ErrorBoundary>
						)}
						{(!showLocalWizard) && providerNamesOfTab[currentTab].map((providerName) => (
							<div key={providerName} className="rounded-2xl border border-void-border-3/80 bg-void-bg-3/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
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
									<div className="mt-4 rounded-xl border border-void-border-4/80 bg-black/20">
										<OllamaSetupInstructions />
									</div>
								)}
							</div>
						))}
					</div>

					{(currentTab === 'Local' || currentTab === 'Cloud/Other') && !showLocalWizard && (
						<div className="w-full mt-6 rounded-2xl border border-void-border-4/80 bg-void-bg-2/70 p-6">
							<div className="flex items-center gap-2 mb-4">
								<div className="text-xl font-medium">Models</div>
							</div>
							{currentTab === 'Local' && (
								<div className="text-sm text-void-fg-3 mb-4">Local models auto-detect when possible. Add custom entries to fine tune routing.</div>
							)}
							{currentTab === 'Local' && <ModelDump filteredProviders={localProviderNames} />}
							{currentTab === 'Cloud/Other' && <ModelDump filteredProviders={cloudProviders} />}
						</div>
					)}

					<div className="flex flex-col gap-3 items-end w-full mt-6">
						{errorMessage && (
							<div className="w-full text-sm rounded-2xl border border-void-warning/30 bg-void-warning/15 text-void-warning px-4 py-3 text-right">
								{errorMessage}
							</div>
						)}
						<div className="flex items-center gap-2">
							<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
							<NextButton
								onClick={() => {
									const isDisabled = isFeatureNameDisabled('Chat', settingsState)
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
			className={`
				inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold tracking-tight transition-all duration-300 border border-white/10
				${disabled
					? 'bg-white/5 text-white/35 cursor-not-allowed'
					: 'bg-gradient-to-r from-[#2a2c34] via-[#1b1c23] to-[#101117] text-white shadow-[0_25px_55px_rgba(0,0,0,0.55)] hover:translate-y-[-1px] hover:shadow-[0_30px_70px_rgba(0,0,0,0.65)]'}
				${className}
			`}
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
			className="px-5 py-2.5 rounded-2xl border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10 transition-all duration-200"
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
				text-lg flex flex-col gap-6 w-full h-full mx-auto px-8 py-10
				rounded-[32px] border border-void-border-3 bg-void-bg-2/70 backdrop-blur-xl
				shadow-[0_30px_90px_rgba(0,0,0,0.45)]
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
			<div className="rounded-[32px] border border-void-border-2 bg-void-bg-2/90 backdrop-blur-2xl shadow-[0_60px_140px_rgba(0,0,0,0.75)] px-10 py-12">
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
								<span key={highlight} className="px-3 py-1.5 rounded-full border border-void-border-3 bg-void-bg-3/80 text-xs tracking-[0.3em] uppercase text-void-fg-3">
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
							<div className="relative w-full h-full rounded-[28px] border border-void-border-2 bg-void-bg-3/80 shadow-[0_45px_110px_rgba(0,0,0,0.7)] flex items-center justify-center p-6">
								<VoidIcon />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4 w-full max-w-sm">
							{welcomeStats.map(({ label, value, detail }) => (
								<div key={label} className="rounded-2xl border border-void-border-3 bg-void-bg-3/80 p-4 text-center text-void-fg-2">
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
				inline-flex items-center justify-center gap-2 rounded-[18px] font-semibold tracking-tight
				text-white border border-white/10
				bg-gradient-to-r from-[#3a3d47] via-[#23252c] to-[#111216]
				shadow-[0_35px_80px_rgba(0,0,0,0.6)]
				hover:shadow-[0_45px_100px_rgba(0,0,0,0.7)] hover:translate-y-[-1px]
				focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/20
				focus-visible:ring-offset-[#050612]
				transition-all duration-300 group
				${sizingClass}
				${className}
			`}
			{...props}
		>
			{children}
			<ChevronRight
				className="transition-transform duration-300 ease-in-out group-hover:translate-x-1 group-active:translate-x-1"
			/>
		</button>
	)
}

const SecondaryActionButton = ({ children, className = '', ...props }: { children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
	<button
		type="button"
		className={`
			inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5
			border border-void-border-2 text-void-fg-2
			hover:text-void-fg-0 hover:border-void-border-1
			transition-all duration-200
			${className}
		`}
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
