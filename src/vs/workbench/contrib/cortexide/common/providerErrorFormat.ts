/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure provider-error message formatters + classifiers extracted from the provider dispatch and the
 * agent loop so they are node-unit-testable (electron-main pulls in the provider SDKs and is excluded
 * from the node runner; the browser agent loop is also excluded). These turn a provider's raw error
 * string into a user-friendly message or a classification. Pure - no I/O, no SDK imports. Tested in
 * `test/common/providerErrorFormat.test.ts`.
 */

/**
 * Classify whether an LLM error message is a rate-limit / quota-exhaustion error. SAFETY-CRITICAL: this
 * MUST match the same shapes the service layer treats as rate-limits (it injects the "all free tiers
 * exhausted" message on these), and it drives the agent loop's `avoidFreeTier` failover decision. The
 * keyword set deliberately includes Google's "quota" / "resource_exhausted" / "exceeded your current
 * quota" (the older 429-only check missed these, so avoidFreeTier never engaged for gemini free-tier).
 * Mirrors chatThreadService.ts:4172-4176 byte-for-byte (case-insensitive substring match).
 */
export const isRateLimitErrorMessage = (errorMessage: string): boolean => {
	const lo = errorMessage.toLowerCase();
	return lo.includes('429') ||
		lo.includes('rate limit') || lo.includes('rate-limit') ||
		lo.includes('tokens per min') || lo.includes('tpm') ||
		lo.includes('quota') || lo.includes('resource_exhausted') || lo.includes('exceeded your current quota');
};

/**
 * Format a Gemini rate-limit / quota error into a friendly message with a parsed retry delay.
 *
 * Mirrors `sendGeminiChat`'s inline catch byte-for-byte. `errorMessage` is the raw `error.message`
 * (the caller has already matched it as a 429 / RESOURCE_EXHAUSTED / quota error). The Gemini error
 * message is often a JSON string (sometimes itself wrapping another JSON string under
 * `error.message`), with the retry hint in a `google.rpc.RetryInfo` detail (`retryDelay: "57s"` /
 * `"57.6s"`). Best-effort: any parse failure falls back to a generic message - this never throws.
 */
export const formatGeminiRateLimitError = (errorMessage: string): string => {
	const GENERIC_FALLBACK = 'Rate limit reached. Please check your Gemini API quota and billing details. See https://ai.google.dev/gemini-api/docs/rate-limits';

	let rateLimitMessage = 'Rate limit reached. Please check your plan and billing details.';
	let retryDelay: string | undefined;

	try {
		// Try to parse the error message which may contain JSON
		let errorData: any = null;

		// First, try to parse the error message as JSON (it might be a JSON string)
		try {
			errorData = JSON.parse(errorMessage);
		} catch {
			// If that fails, check if error.message contains a JSON string
			const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				errorData = JSON.parse(jsonMatch[0]);
			}
		}

		// Extract user-friendly message from nested structure
		if (errorData?.error?.message) {
			// The message might itself be a JSON string
			try {
				const innerError = JSON.parse(errorData.error.message);
				if (innerError?.error?.message) {
					rateLimitMessage = innerError.error.message;
					// Extract retry delay if available
					const retryInfo = innerError.error.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
					if (retryInfo?.retryDelay) {
						retryDelay = retryInfo.retryDelay;
					}
				}
			} catch {
				// If inner parse fails, use the outer message
				rateLimitMessage = errorData.error.message;
			}
		} else if (errorData?.error?.code === 429 || errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
			// Fallback: use a generic rate limit message
			rateLimitMessage = 'You exceeded your current quota. Please check your plan and billing details.';
		}

		// Format the final message
		let finalMessage = rateLimitMessage;
		if (retryDelay) {
			// Parse retry delay (format: "57s" or "57.627694635s")
			const delaySeconds = parseFloat(retryDelay.replace('s', ''));
			const delayMinutes = Math.floor(delaySeconds / 60);
			const remainingSeconds = Math.ceil(delaySeconds % 60);
			if (delayMinutes > 0) {
				finalMessage += ` Please retry in ${delayMinutes} minute${delayMinutes > 1 ? 's' : ''}${remainingSeconds > 0 ? ` and ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}` : ''}.`;
			} else {
				finalMessage += ` Please retry in ${Math.ceil(delaySeconds)} second${Math.ceil(delaySeconds) > 1 ? 's' : ''}.`;
			}
		} else {
			finalMessage += ' Please wait a moment before trying again.';
		}

		// Add helpful links
		finalMessage += ' For more information, see https://ai.google.dev/gemini-api/docs/rate-limits';

		return finalMessage;
	} catch (parseError) {
		// If parsing fails, use a generic message
		return GENERIC_FALLBACK;
	}
};
