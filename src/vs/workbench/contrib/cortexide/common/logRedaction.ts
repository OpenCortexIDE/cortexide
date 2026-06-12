/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { SecretDetectionConfig, detectSecrets, redactSecretsInObject } from './secretDetection.js';

/**
 * Pure log-redaction core, extracted from RedactingLogService so it is node-testable WITHOUT the DI
 * service. This is the "never leaks a secret into logs/telemetry/console" guarantee. RedactingLogService
 * delegates to these (its injected ISecretDetectionService is a thin wrapper that calls these same free
 * detectSecrets/redactSecretsInObject with its config), so the real redaction path is what gets tested.
 *
 * When `config.enabled` is false, input passes through untouched (redaction is opt-in / configurable).
 */

/** Redact a log message string. Returns it unchanged when redaction is disabled or no secret is found. */
export function redactLogMessage(message: string, config: SecretDetectionConfig): string {
	if (!config.enabled) { return message; }
	const result = detectSecrets(message, config);
	return result.hasSecrets ? result.redactedText : message;
}

/** Redact the variadic log args: strings via detectSecrets, objects deeply via redactSecretsInObject. */
export function redactLogArgs(args: unknown[], config: SecretDetectionConfig): unknown[] {
	if (!config.enabled) { return args; }
	return args.map(arg => {
		if (typeof arg === 'string') {
			const result = detectSecrets(arg, config);
			return result.hasSecrets ? result.redactedText : arg;
		}
		if (arg && typeof arg === 'object') {
			const result = redactSecretsInObject(arg, config);
			return result.hasSecrets ? result.redacted : arg;
		}
		return arg;
	});
}
