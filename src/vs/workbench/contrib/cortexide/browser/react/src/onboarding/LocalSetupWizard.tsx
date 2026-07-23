/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect, useState } from 'react';
import { useAccessor } from '../util/services.js';
import { Check, X, Loader2, AlertCircle, ChevronRight, ChevronLeft, Cpu } from 'lucide-react';
import { ModelPackType, LocalSetupState, SystemCheckResult, VerificationResults } from '../../../../common/localSetupServiceTypes.js';
import { getAllModelPacks } from '../../../../common/modelPacks.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { MODEL_PACKS, ModelPackKey } from '../../../../common/ollamaInstallerService.js';

interface LocalSetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const LocalSetupWizard = ({ onComplete, onSkip }: LocalSetupWizardProps) => {
  const accessor = useAccessor();
  const localSetupService = accessor.get('ILocalSetupService');

  // Return null if service isn't available
  if (!localSetupService) {
    return null;
  }

  const ollamaInstallerService = accessor.get('OllamaInstallerService') as any;

  const [step, setStep] = useState<number>(0);
  const [state, setState] = useState<LocalSetupState>(localSetupService.state);
  const [systemCheck, setSystemCheck] = useState<SystemCheckResult | null>(null);
  const [selectedPack, setSelectedPack] = useState<ModelPackType>('balanced');
  const [verificationResults, setVerificationResults] = useState<VerificationResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedVramGB, setDetectedVramGB] = useState<number | null>(null);
  const [recommendedPackKey, setRecommendedPackKey] = useState<ModelPackKey>('balanced');

  // Detect hardware on mount so model pack step can show a smart recommendation
  useEffect(() => {
    if (!ollamaInstallerService) return;
    ollamaInstallerService.getHardwareInfo().then((info: { vramGB: number | null; recommendedPack: ModelPackKey }) => {
      setDetectedVramGB(info.vramGB);
      setRecommendedPackKey(info.recommendedPack);
      // Pre-select the recommended pack automatically
      setSelectedPack(info.recommendedPack as unknown as ModelPackType);
    // allow-any-unicode-next-line
    }).catch(() => { /* hardware detection unavailable — keep default */ });
  }, [ollamaInstallerService]);

  useEffect(() => {
    const disposable = localSetupService.onDidChangeState((newState) => {
      setState(newState);
      // Clear error message when state changes away from error
      if (newState.type !== 'error') {
        setErrorMessage(null);
      }
    });
    return () => disposable.dispose();
  }, [localSetupService]);

  // Handle persisted error states - if wizard reopens with an error state, show it
  useEffect(() => {
    if (state.type === 'error' && step === 0) {
      // If we're on step 0 but have an error state, we likely resumed from a persisted error
      // Determine which step we should be on based on error type
      if (state.error.code === 'DOWNLOAD_FAILED') {
        setStep(2); // Go back to model pack selection
      } else if (state.error.code === 'VERIFICATION_FAILED') {
        setStep(3); // Go back to verification step
      } else if (state.error.code === 'INSTALL_FAILED') {
        setStep(1); // Go back to system check
      }
    }
  }, [state, step]);

  // Step 0: Choice
  const handleChoice = async (choice: 'local' | 'cloud' | 'later') => {
    if (choice === 'local') {
      localSetupService.startWizard();
      const checkResult = await localSetupService.checkSystem();
      setSystemCheck(checkResult);
      setStep(1);
    } else if (choice === 'cloud') {
      onSkip(); // Skip to regular onboarding (Add Providers page)
    } else {
      onSkip();
    }
  };

  // Step 1: System Check
  const handleInstallOllama = async () => {
    try {
      setErrorMessage(null);
      await localSetupService.installOllama();
      // Re-check system after install
      const checkResult = await localSetupService.checkSystem();
      setSystemCheck(checkResult);
      if (checkResult.ollamaRunning) {
        setStep(2);
      } else {
        setErrorMessage('Ollama installation completed but service is not running. Please start Ollama manually.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to install Ollama. Please install it manually from https://ollama.com';
      setErrorMessage(message);
      console.error('Install failed:', error);
    }
  };

  // Step 2: Model Pack Selection
  const handleSelectPack = (packType: ModelPackType) => {
    setSelectedPack(packType);
  };

  const handleDownloadModels = async () => {
    try {
      setErrorMessage(null);
      await localSetupService.downloadModelPack(selectedPack);
      // Only advance if state is not error (download might have failed)
      if (localSetupService.state.type !== 'error') {
        setStep(3);
      } else {
        // Error state will be handled by the error UI
        setErrorMessage(localSetupService.state.error.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download models. Please check your internet connection and try again.';
      setErrorMessage(message);
      console.error('Download failed:', error);
    }
  };

  // Step 3: Verification
  const handleVerify = async () => {
    try {
      setErrorMessage(null);
      const results = await localSetupService.verifyCapabilities();
      setVerificationResults(results);
      setStep(4);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify model capabilities. Please check that your models are properly installed.';
      setErrorMessage(message);
      console.error('Verification failed:', error);
    }
  };

  // Handle skip verification - allow user to proceed even if verification fails
  const handleSkipVerification = () => {
    // Create mock results that indicate verification was skipped
    setVerificationResults({
      chat: { passed: false, error: 'Verification skipped' },
      toolCalling: { passed: false, error: 'Verification skipped' },
      webCalling: { passed: false, skipped: true },
      vision: { passed: false, skipped: true }
    });
    setStep(4);
  };

  // Step 4: Set Defaults
  const handleSetDefaults = async () => {
    try {
      setErrorMessage(null);
      await localSetupService.setDefaults(selectedPack);
      setStep(5);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set default models. You can configure them manually in settings.';
      setErrorMessage(message);
      console.error('Set defaults failed:', error);
    }
  };

  const handleCancel = () => {
    localSetupService.cancel();
    onSkip();
  };

  const handleBack = () => {
    // Don't allow going back during active operations
    if (state.type === 'downloading' || state.type === 'verifying') {
      return;
    }

    if (step === 0) {
      // Go back to main onboarding
      onSkip();
    } else if (step === 1) {
      // Go back to choice step
      setStep(0);
      setSystemCheck(null);
    } else if (step === 2) {
      // Go back to system check
      setStep(1);
    } else if (step === 3) {
      // Go back to model pack selection
      setStep(2);
    } else if (step === 4) {
      // Go back to verification
      setStep(3);
      setVerificationResults(null);
    } else if (step === 5) {
      // Go back to verification results
      setStep(4);
    }
  };

  const progress = localSetupService.getProgress();
  const canGoBack = step > 0 && state.type !== 'downloading' && state.type !== 'verifying';

  // Handle error state - show error recovery UI
  if (state.type === 'error') {
    return (
      <ErrorBoundary>
				<div className="w-full max-w-4xl mx-auto p-8">
					<div className="rounded-[32px] border border-border-3 bg-bg-2/70 backdrop-blur-xl shadow-[0_45px_120px_rgba(0,0,0,0.45)] p-8">
						<div className="text-center space-y-6">
							<AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
							<h2 className="text-3xl font-light text-fg-0">Setup Error</h2>
							<div className="text-fg-3 max-w-2xl mx-auto">
								<p className="mb-4">{state.error.message}</p>
								{state.error.code === 'DOWNLOAD_FAILED' && state.error.model &&
                <p className="text-sm">Failed while downloading: {state.error.model}</p>
                }
								{state.error.code === 'INSUFFICIENT_DISK_SPACE' &&
                <p className="text-sm">
										Required: {state.error.requiredGb.toFixed(1)} GB, Available: {state.error.availableGb.toFixed(1)} GB
									</p>
                }
							</div>
							<div className="flex gap-4 justify-center mt-8">
								<button
                  onClick={() => {
                    localSetupService.cancel();
                    setStep(0);
                    setErrorMessage(null);
                  }}
                  className="px-6 py-3 rounded-2xl border border-border-3 bg-bg-3 text-fg-0 font-medium">

									Start Over
								</button>
								<button
                  onClick={onSkip}
                  className="btn btn-primary px-6 py-3 font-medium">

									Skip Setup
								</button>
							</div>
						</div>
					</div>
				</div>
			</ErrorBoundary>);

  }

  return (
    <ErrorBoundary>
			<div className="w-full max-w-4xl mx-auto p-8">
				{/* Progress Bar */}
				<div className="mb-8">
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm text-fg-3">Step {progress.currentStep} of {progress.totalSteps}</span>
						{progress.canCancel &&
            <button
              onClick={handleCancel}
              className="btn btn-ghost btn-sm text-sm">

								Cancel
							</button>
            }
					</div>
					<div className="w-full bg-bg-3 rounded-full h-2">
						<div
              className="bg-gradient-to-r from-[var(--cortex-brand)] to-[var(--cortex-brand-dim)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.currentStep / progress.totalSteps * 100}%` }} />

					</div>
				</div>

				{/* Step Content */}
				<div className="rounded-[32px] border border-border-3 bg-bg-2/70 backdrop-blur-xl shadow-[0_45px_120px_rgba(0,0,0,0.45)] p-8">
					{errorMessage &&
          <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/15 text-warning text-sm">
							<div className="flex items-start gap-2">
								<AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
								<span>{errorMessage}</span>
							</div>
						</div>
          }
					{step === 0 && <ChoiceStep onChoice={handleChoice} onBack={onSkip} />}
					{step === 1 && systemCheck && <SystemCheckStep systemCheck={systemCheck} onInstall={handleInstallOllama} onNext={() => {setStep(2);setErrorMessage(null);}} onBack={handleBack} canGoBack={canGoBack} />}
					{step === 2 && <ModelPackStep selectedPack={selectedPack} onSelect={handleSelectPack} onDownload={handleDownloadModels} state={state} onBack={handleBack} canGoBack={canGoBack} detectedVramGB={detectedVramGB} recommendedPackKey={recommendedPackKey} />}
					{step === 3 && <VerificationStep onVerify={handleVerify} onSkip={handleSkipVerification} state={state} onBack={handleBack} canGoBack={canGoBack} />}
					{step === 4 && verificationResults && <VerificationResultsStep results={verificationResults} onNext={handleSetDefaults} onBack={handleBack} canGoBack={canGoBack} />}
					{step === 5 && <DefaultsStep onComplete={onComplete} onBack={handleBack} canGoBack={canGoBack} />}
				</div>
			</div>
		</ErrorBoundary>);

};

const ChoiceStep = ({ onChoice, onBack }: {onChoice: (choice: 'local' | 'cloud' | 'later') => void;onBack: () => void;}) => {
  return (
    <div className="space-y-6">
			<div className="flex items-center gap-4 mb-4">
				<button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-4 py-2">

					<ChevronLeft className="w-4 h-4" />
					Back
				</button>
			</div>
			<div className="text-center space-y-4">
				<h2 className="text-4xl font-light text-fg-0">Choose your setup</h2>
				<p className="text-fg-3 max-w-2xl mx-auto">
					Get started with CortexIDE. Choose local models for privacy, or use cloud providers.
				</p>
			</div>

			<div className="grid gap-4 mt-8">
				<button
          onClick={() => onChoice('local')}
          className="p-6 rounded-2xl border-2 border-border-2 bg-bg-3/60 hover:border-[var(--cortex-brand)] hover:bg-bg-3 transition-all text-left">

					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-xl font-medium text-fg-0 mb-2">Use local models (no API keys)</h3>
							<p className="text-fg-3">Run models on your computer for complete privacy. We'll help you set up Ollama.</p>
						</div>
						<ChevronRight className="w-6 h-6 text-fg-3" />
					</div>
				</button>

				<button
          onClick={() => onChoice('cloud')}
          className="p-6 rounded-2xl border border-border-3 bg-bg-3/40 hover:border-border-2 transition-all text-left">

					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-xl font-medium text-fg-0 mb-2">Use cloud provider</h3>
							<p className="text-fg-3">Connect to Anthropic, OpenAI, or other cloud providers with API keys.</p>
						</div>
						<ChevronRight className="w-6 h-6 text-fg-3" />
					</div>
				</button>

				<button
          onClick={() => onChoice('later')}
          className="p-4 rounded-2xl border border-border-4 bg-transparent hover:bg-bg-3/20 transition-all text-center">

					<span className="text-fg-3">Decide later</span>
				</button>
			</div>
		</div>);

};

const SystemCheckStep = ({ systemCheck, onInstall, onNext, onBack, canGoBack }: {systemCheck: SystemCheckResult;onInstall: () => void;onNext: () => void;onBack: () => void;canGoBack: boolean;}) => {
  return (
    <div className="space-y-6">
			<h2 className="text-3xl font-light text-fg-0 mb-4">System Check</h2>

			<div className="space-y-4">
				<CheckItem
          label="Ollama installed"
          status={systemCheck.ollamaInstalled ? 'pass' : 'fail'} />

				<CheckItem
          label="Ollama running"
          status={systemCheck.ollamaRunning ? 'pass' : 'fail'} />

				{systemCheck.diskSpaceGb !== null &&
        <CheckItem
          label={`Disk space: ${systemCheck.diskSpaceGb.toFixed(1)} GB available`}
          status={systemCheck.diskSpaceGb > 10 ? 'pass' : 'warn'} />

        }
			</div>

			<div className="flex gap-4 mt-8">
				{canGoBack &&
        <button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-5 py-3">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
				{!systemCheck.ollamaInstalled &&
        <button
          onClick={onInstall}
          className="btn btn-primary px-6 py-3 font-medium">

						Install Ollama
					</button>
        }
				{systemCheck.ollamaRunning &&
        <button
          onClick={onNext}
          className="btn btn-secondary px-6 py-3 font-medium">

						Next
					</button>
        }
			</div>
		</div>);

};

const CheckItem = ({ label, status }: {label: string;status: 'pass' | 'fail' | 'warn';}) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border-3 bg-bg-3/40">
			{status === 'pass' && <Check className="w-5 h-5 text-emerald-400" />}
			{status === 'fail' && <X className="w-5 h-5 text-rose-500" />}
			{status === 'warn' && <AlertCircle className="w-5 h-5 text-amber-400" />}
			<span className="text-fg-1">{label}</span>
		</div>);

};

const ModelPackStep = ({ selectedPack, onSelect, onDownload, state, onBack, canGoBack, detectedVramGB, recommendedPackKey }: {selectedPack: ModelPackType;onSelect: (pack: ModelPackType) => void;onDownload: () => void;state: LocalSetupState;onBack: () => void;canGoBack: boolean; detectedVramGB?: number | null; recommendedPackKey?: ModelPackKey;}) => {
  const packs = getAllModelPacks();
  const isDownloading = state.type === 'downloading';

  return (
    <div className="space-y-6">
			<div className="flex items-center gap-4 mb-4">
				{canGoBack &&
        <button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-4 py-2">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
			</div>
			<h2 className="text-3xl font-light text-fg-0 mb-4">Choose a model pack</h2>

			{/* Hardware detection badge */}
			{detectedVramGB != null &&
			<div className="flex items-center gap-2 p-3 rounded-xl border border-border-3 bg-bg-3/40 text-sm text-fg-2 mb-2">
				<Cpu className="w-4 h-4 text-[var(--cortex-brand)] flex-shrink-0" />
				// allow-any-unicode-next-line
				<span>Detected <strong>{detectedVramGB} GB</strong> GPU memory — best model pre-selected for your hardware.</span>
			</div>
			}

			<p className="text-fg-3 mb-6">Select a pre-configured set of models optimized for different use cases.</p>

			<div className="grid gap-4">
				{packs.map((pack) => {
          const isHwRecommended = !!recommendedPackKey && (pack.id === recommendedPackKey);
          return (
          <button
            key={pack.id}
            onClick={() => onSelect(pack.id as ModelPackType)}
            className={`p-6 rounded-2xl border-2 text-left transition-all ${
            selectedPack === pack.id ? "border-[var(--cortex-brand)] bg-bg-3/80" : "border-border-3 bg-bg-3/40 hover:border-border-2"}`}>

						<div className="flex items-start justify-between">
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-2">
									<h3 className="text-xl font-medium text-fg-0">{pack.name}</h3>
									{isHwRecommended &&
                  <span className="px-2 py-1 text-xs bg-[var(--cortex-brand)]/20 text-[var(--cortex-brand)] rounded">Best for your hardware</span>
                  }
                  {!isHwRecommended && pack.id === 'balanced' && !recommendedPackKey &&
                  <span className="px-2 py-1 text-xs bg-[var(--cortex-brand)]/20 text-[var(--cortex-brand)] rounded">Recommended</span>
                  }
								</div>
								<p className="text-fg-3 mb-3">{pack.description}</p>
								<div className="flex gap-4 text-sm text-fg-4">
									<span>~{pack.estimatedSizeGb} GB</span>
									<span>{pack.minRamGb}+ GB RAM</span>
								</div>
							</div>
							{selectedPack === pack.id && <Check className="w-5 h-5 text-[var(--cortex-brand)]" />}
						</div>
					</button>
          );
        })}
			</div>

			{isDownloading && state.type === 'downloading' &&
      <div className="mt-6 p-4 rounded-xl border border-border-3 bg-bg-3/40">
					<div className="flex items-center gap-3 mb-2">
						<Loader2 className="w-5 h-5 text-[var(--cortex-brand)] animate-spin" />
						<span className="text-fg-1">Downloading {state.currentModel}...</span>
					</div>
					<div className="w-full bg-bg-1 rounded-full h-2">
						<div
            className="bg-[var(--cortex-brand)] h-2 rounded-full transition-all"
            style={{ width: `${state.progress / state.totalModels * 100}%` }} />

					</div>
					<span className="text-sm text-fg-4 mt-2">
						{state.progress} of {state.totalModels} models
					</span>
				</div>
      }

			<div className="flex gap-4 mt-6">
				{canGoBack &&
        <button
          onClick={onBack}
          disabled={isDownloading}
          className="btn btn-secondary flex items-center gap-2 px-5 py-3 disabled:opacity-50">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
				<button
          onClick={onDownload}
          disabled={isDownloading}
          className="btn btn-primary flex-1 px-6 py-3 font-medium disabled:opacity-50">

					{isDownloading ? 'Downloading...' : 'Download Models'}
				</button>
			</div>
		</div>);

};

const VerificationStep = ({ onVerify, onSkip, state, onBack, canGoBack }: {onVerify: () => void;onSkip?: () => void;state: LocalSetupState;onBack: () => void;canGoBack: boolean;}) => {
  const isVerifying = state.type === 'verifying';

  return (
    <div className="space-y-6">
			<div className="flex items-center gap-4 mb-4">
				{canGoBack &&
        <button
          onClick={onBack}
          disabled={isVerifying}
          className="btn btn-secondary flex items-center gap-2 px-4 py-2 disabled:opacity-50">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
			</div>
			<h2 className="text-3xl font-light text-fg-0 mb-4">Verifying Capabilities</h2>
			<p className="text-fg-3 mb-6">Testing that your local models work correctly.</p>

			{isVerifying && state.type === 'verifying' &&
      <div className="space-y-4">
					<div className="p-4 rounded-xl border border-border-3 bg-bg-3/40">
						<div className="flex items-center gap-3">
							<Loader2 className="w-5 h-5 text-[var(--cortex-brand)] animate-spin" />
							<span className="text-fg-1">Testing {state.currentTest}...</span>
						</div>
					</div>
				</div>
      }

			{!isVerifying &&
      <div className="flex gap-4 mt-6">
					{canGoBack &&
        <button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-5 py-3">

							<ChevronLeft className="w-4 h-4" />
							Back
						</button>
        }
					<button
          onClick={onVerify}
          className="btn btn-primary flex-1 px-6 py-3 font-medium">

						Run Verification
					</button>
					{onSkip &&
        <button
          onClick={onSkip}
          className="btn btn-secondary px-6 py-3 font-medium">

							Skip
						</button>
        }
				</div>
      }
		</div>);

};

const VerificationResultsStep = ({ results, onNext, onBack, canGoBack }: {results: VerificationResults;onNext: () => void;onBack: () => void;canGoBack: boolean;}) => {
  const allPassed = results.chat.passed && results.toolCalling.passed;
  const hasFailures = !results.chat.passed || !results.toolCalling.passed;

  return (
    <div className="space-y-6">
			<div className="flex items-center gap-4 mb-4">
				{canGoBack &&
        <button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-4 py-2">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
			</div>
			<h2 className="text-3xl font-light text-fg-0 mb-4">Verification Results</h2>

			<div className="space-y-3">
				<ResultItem label="Chat" passed={results.chat.passed} error={results.chat.error} />
				<ResultItem label="Tool Calling" passed={results.toolCalling.passed} error={results.toolCalling.error} />
				<ResultItem
          label="Web Calling"
          passed={results.webCalling.passed}
          skipped={results.webCalling.skipped}
          error={results.webCalling.error} />

			</div>

			{hasFailures &&
      <div className="mt-4 p-4 rounded-xl border border-warning/30 bg-warning/15 text-fg-3 text-sm">
					<p>Some verification tests failed. You can still proceed, but some features may not work correctly.</p>
				</div>
      }

			<div className="flex gap-4 mt-6">
				{canGoBack &&
        <button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-5 py-3">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
				<button
          onClick={onNext}
          className="btn btn-primary flex-1 px-6 py-3 font-medium">

					{allPassed ? 'Continue' : 'Continue Anyway'}
				</button>
			</div>
		</div>);

};

const ResultItem = ({ label, passed, skipped, error }: {label: string;passed: boolean;skipped?: boolean;error?: string;}) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border-3 bg-bg-3/40">
			{passed && <Check className="w-5 h-5 text-emerald-400" />}
			{!passed && !skipped && <X className="w-5 h-5 text-rose-500" />}
			{skipped && <AlertCircle className="w-5 h-5 text-fg-4" />}
			<div className="flex-1">
				<span className="text-fg-1">{label}</span>
				{skipped && <span className="text-fg-4 ml-2">(skipped)</span>}
				{error && <span className="text-rose-500 ml-2 text-sm">({error})</span>}
			</div>
		</div>);

};

const DefaultsStep = ({ onComplete, onBack, canGoBack }: {onComplete: () => void;onBack: () => void;canGoBack: boolean;}) => {
  return (
    <div className="space-y-6">
			<div className="flex items-center gap-4 mb-4">
				{canGoBack &&
        <button
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-2 px-4 py-2">

						<ChevronLeft className="w-4 h-4" />
						Back
					</button>
        }
			</div>
			<div className="text-center">
				<Check className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
				<h2 className="text-3xl font-light text-fg-0 mb-4">Setup Complete!</h2>
				<p className="text-fg-3 mb-8 max-w-2xl mx-auto">
					Your local models are configured and ready to use. CortexIDE will use local models by default.
				</p>
				<button
          onClick={onComplete}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[var(--cortex-brand)] to-[var(--cortex-brand-dim)] text-white font-medium text-lg">

					Start using CortexIDE
				</button>
			</div>
		</div>);

};