/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { TextEdit } from '../../../../editor/common/core/edits/textEdit.js';

/**
 * Pure edit risk/confidence scoring, extracted from EditRiskScoringService so it is node-testable. This
 * score gates auto-apply: a HIGH-risk edit can never be silently auto-approved (see autoApprovePolicy),
 * and YOLO mode keys its silent-apply threshold off riskScore/confidenceScore -- so the LOW/MEDIUM/HIGH
 * classifier and the 0.2/0.7 boundaries are a tested safety contract here.
 *
 * The ONLY impure input is factor #6 (count of pre-existing syntax errors), which needs the live model +
 * markers; the service computes it and passes it in as `existingErrorCount`. Everything else is a pure
 * function of the EditContext, byte-identical to the old inline scoreEdit.
 */

export interface EditRiskScore {
	/** Overall risk score (0.0 = safe, 1.0 = dangerous) */
	riskScore: number;
	/** Confidence in the edit (0.0 = uncertain, 1.0 = confident) */
	confidenceScore: number;
	/** Risk level classification */
	riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
	/** Reasons for risk score */
	riskFactors: string[];
	/** Reasons for confidence score */
	confidenceFactors: string[];
}

export interface EditContext {
	/** URI of file being edited */
	uri: URI;
	/** Original file content (if available) */
	originalContent?: string;
	/** New file content (for rewrite_file) */
	newContent?: string;
	/** Text edits (for edit_file) */
	textEdits?: TextEdit[];
	/** Operation type */
	operation: 'rewrite_file' | 'edit_file' | 'create_file_or_folder' | 'delete_file_or_folder';
	/** Model selection used for this edit */
	modelSelection?: { providerName: string; modelName: string };
	/** Whether file was read before edit */
	fileWasRead?: boolean;
	/** Number of files being edited in this operation */
	totalFilesInOperation?: number;
}

/** Critical file patterns that should be treated with extra caution. */
export const CRITICAL_FILE_PATTERNS = [
	/package\.json$/i,
	/package-lock\.json$/i,
	/yarn\.lock$/i,
	/tsconfig\.json$/i,
	/jsconfig\.json$/i,
	/webpack\.config\./i,
	/vite\.config\./i,
	/\.env$/i,
	/\.env\./i,
	/dockerfile$/i,
	/docker-compose\./i,
	/\.gitignore$/i,
	/\.gitattributes$/i,
	/\.github\/workflows\//i,
	/ci\.yml$/i,
	/ci\.yaml$/i,
	/\.github\/actions\//i,
];

/** Test file patterns. */
export const TEST_FILE_PATTERNS = [
	/\.test\./i,
	/\.spec\./i,
	/__tests__\//i,
	/__mocks__\//i,
	/test\//i,
	/tests\//i,
	/\.test$/i,
	/\.spec$/i,
];

/**
 * Score an edit. `existingErrorCount` is the number of pre-existing Error-severity markers on the file
 * (factor #6), computed by the caller from the live model/markers -- pass 0 when the model is unavailable
 * or the operation has no newContent (mirrors the old `if (model && context.newContent)` guard).
 */
export function scoreEditFromContext(context: EditContext, existingErrorCount: number): EditRiskScore {
	const riskFactors: string[] = [];
	const confidenceFactors: string[] = [];
	let riskScore = 0.0;
	let confidenceScore = 0.7; // Start with moderate confidence

	const filePath = context.uri.fsPath;
	const fileName = filePath.split('/').pop() || '';

	// === RISK FACTORS ===

	// 1. File deletion (highest risk)
	if (context.operation === 'delete_file_or_folder') {
		riskScore = 1.0;
		riskFactors.push('File deletion is high risk');
		return {
			riskScore,
			confidenceScore: 0.5, // Lower confidence for deletions
			riskLevel: 'HIGH',
			riskFactors,
			confidenceFactors: ['Deletion operations require careful review'],
		};
	}

	// 2. Critical file patterns
	const isCriticalFile = CRITICAL_FILE_PATTERNS.some(pattern => pattern.test(filePath));
	if (isCriticalFile) {
		riskScore += 0.5;
		riskFactors.push(`Critical file: ${fileName}`);
	}

	// 3. Large file size changes (for rewrite_file)
	if (context.operation === 'rewrite_file' && context.originalContent && context.newContent) {
		const originalSize = context.originalContent.length;
		const newSize = context.newContent.length;
		const sizeChangeRatio = Math.abs(newSize - originalSize) / Math.max(originalSize, 1);

		if (sizeChangeRatio > 0.5) {
			// More than 50% change
			const changeRisk = Math.min(0.6, sizeChangeRatio * 0.8);
			riskScore += changeRisk;
			riskFactors.push(`Large file change: ${Math.round(sizeChangeRatio * 100)}% size difference`);
		}
	}

	// 4. Test file modifications (lower risk, but still notable)
	const isTestFile = TEST_FILE_PATTERNS.some(pattern => pattern.test(filePath));
	if (isTestFile) {
		riskScore += 0.2;
		riskFactors.push('Test file modification');
	}

	// 5. Multiple file edits in one operation
	if (context.totalFilesInOperation && context.totalFilesInOperation > 1) {
		const multiFileRisk = Math.min(0.3, (context.totalFilesInOperation - 1) * 0.1);
		riskScore += multiFileRisk;
		riskFactors.push(`Multi-file operation: ${context.totalFilesInOperation} files`);
	}

	// 6. Pre-existing syntax errors (count computed by the caller from the live model/markers).
	// Mirrors the old `if (model && context.newContent) { if (errorCount > 5) ... }` -- the caller passes
	// 0 when the model is unavailable or there is no newContent, so this is skipped in exactly those cases.
	if (existingErrorCount > 5) {
		riskScore += 0.2;
		riskFactors.push(`File has ${existingErrorCount} existing errors`);
	}

	// 7. File creation (low risk, especially for non-critical files)
	if (context.operation === 'create_file_or_folder') {
		// Only add minimum risk if not already a critical file
		if (!isCriticalFile) {
			riskScore = Math.max(0.05, riskScore); // Very low risk for new non-critical files
			if (riskScore === 0.05) {
				riskFactors.push('New file creation (low risk)');
			}
		} else {
			riskScore = Math.max(0.1, riskScore); // Slightly higher for critical files
		}
	}

	// 8. Small edits are very low risk (basic operations like adding comments, small changes)
	if (context.operation === 'edit_file' && context.originalContent && context.newContent) {
		const sizeChangeRatio = Math.abs(context.newContent.length - context.originalContent.length) / Math.max(context.originalContent.length, 1);
		if (sizeChangeRatio < 0.05 && !isCriticalFile) {
			// Very small changes (< 5%) to non-critical files are very low risk
			riskScore = Math.max(0.05, riskScore);
			confidenceFactors.push('Very small change (< 5%)');
		}
	}

	// Clamp risk score to [0, 1]
	riskScore = Math.min(1.0, Math.max(0.0, riskScore));

	// === CONFIDENCE FACTORS ===

	// 1. Model capability (if provided)
	if (context.modelSelection) {
		// Higher confidence for known good models
		const { providerName, modelName } = context.modelSelection;
		if (
			(providerName === 'anthropic' && (modelName.includes('3.5') || modelName.includes('4') || modelName.includes('opus') || modelName.includes('sonnet'))) ||
			(providerName === 'openai' && (modelName.includes('4o') || modelName.includes('4.1') || modelName.includes('gpt-4'))) ||
			(providerName === 'gemini' && (modelName.includes('pro') || modelName.includes('ultra')))
		) {
			confidenceScore += 0.15;
			confidenceFactors.push('High-quality model used');
		} else if (modelName.includes('code') || modelName.includes('coder')) {
			confidenceScore += 0.1;
			confidenceFactors.push('Code-tuned model used');
		}
	}

	// 2. File was read before edit (higher confidence)
	if (context.fileWasRead) {
		confidenceScore += 0.1;
		confidenceFactors.push('File was read before edit');
	}

	// 3. Edit complexity (simpler edits = higher confidence)
	if (context.operation === 'edit_file' && context.textEdits) {
		const editCount = context.textEdits.length;
		if (editCount <= 3) {
			confidenceScore += 0.05;
			confidenceFactors.push('Simple edit operation');
		} else if (editCount > 10) {
			confidenceScore -= 0.1;
			confidenceFactors.push('Complex edit operation');
		}
	} else if (context.operation === 'rewrite_file') {
		// Rewrite is more complex than edit
		confidenceScore -= 0.05;
		confidenceFactors.push('Full file rewrite');
	}

	// 4. Small changes are more confident
	if (context.operation === 'rewrite_file' && context.originalContent && context.newContent) {
		const sizeChangeRatio = Math.abs(context.newContent.length - context.originalContent.length) / Math.max(context.originalContent.length, 1);
		if (sizeChangeRatio < 0.1) {
			confidenceScore += 0.05;
			confidenceFactors.push('Small change');
		}
	}

	// Clamp confidence score to [0, 1]
	confidenceScore = Math.min(1.0, Math.max(0.0, confidenceScore));

	// Determine risk level
	let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
	if (riskScore < 0.2 && confidenceScore > 0.7) {
		riskLevel = 'LOW';
	} else if (riskScore > 0.6 || confidenceScore < 0.5) {
		riskLevel = 'HIGH';
	} else {
		riskLevel = 'MEDIUM';
	}

	return {
		riskScore,
		confidenceScore,
		riskLevel,
		riskFactors: riskFactors.length > 0 ? riskFactors : ['No significant risk factors'],
		confidenceFactors: confidenceFactors.length > 0 ? confidenceFactors : ['Standard confidence'],
	};
}
