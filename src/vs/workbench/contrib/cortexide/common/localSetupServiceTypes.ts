/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  Types for the guided local model setup wizard.
 *  Consumed by LocalSetupWizard.tsx and LocalSetupService.ts.
 *--------------------------------------------------------------------------------------*/

export type ModelPackType = 'minimal' | 'fast' | 'balanced' | 'powerful' | 'reasoning' | 'kimi';

export type LocalSetupState =
	| { type: 'idle' }
	| { type: 'checking' }
	| { type: 'installing_ollama' }
	| { type: 'downloading'; currentModel: string; progress: number; totalModels: number; percent: number }
	| { type: 'verifying'; currentTest: string }
	| { type: 'complete' }
	| {
		type: 'error';
		error: {
			code:
			| 'INSTALL_FAILED'
			| 'DOWNLOAD_FAILED'
			| 'VERIFICATION_FAILED'
			| 'INSUFFICIENT_DISK_SPACE'
			| 'OLLAMA_NOT_RUNNING';
			message: string;
			model?: string;
			requiredGb?: number;
			availableGb?: number;
		};
	};

export type SystemCheckResult = {
	ollamaInstalled: boolean;
	ollamaRunning: boolean;
	diskSpaceGb: number | null;
	vramGB: number | null;
	recommendedPack: ModelPackType;
};

export type CapabilityTestResult = {
	passed: boolean;
	error?: string;
	skipped?: boolean;
};

export type VerificationResults = {
	chat: CapabilityTestResult;
	toolCalling: CapabilityTestResult;
	webCalling: CapabilityTestResult;
	vision: CapabilityTestResult;
};

export type SetupProgress = {
	currentStep: number;
	totalSteps: number;
	canCancel: boolean;
};
