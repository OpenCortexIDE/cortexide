/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService, LogLevel } from '../../../../platform/log/common/log.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ISecretDetectionService } from './secretDetectionService.js';
import { redactLogMessage, redactLogArgs } from './logRedaction.js';

/**
 * Wraps ILogService to redact secrets from all log output
 * This ensures secrets never reach logs, telemetry, or console
 */
export class RedactingLogService extends Disposable implements ILogService {
	declare readonly _serviceBrand: undefined;

	constructor(
		private readonly logService: ILogService,
		private readonly secretDetectionService: ISecretDetectionService,
	) {
		super();
	}

	get onDidChangeLogLevel(): Event<LogLevel> {
		return this.logService.onDidChangeLogLevel;
	}

	setLevel(level: LogLevel): void {
		this.logService.setLevel(level);
	}

	getLevel(): LogLevel {
		return this.logService.getLevel();
	}

	// Delegate to the pure, node-tested core (common/logRedaction.ts). The injected service's
	// detectSecrets/redactSecretsInObject are thin wrappers over the same free functions + getConfig().
	private redactMessage(message: string): string {
		return redactLogMessage(message, this.secretDetectionService.getConfig());
	}

	private redactArgs(args: any[]): any[] {
		return redactLogArgs(args, this.secretDetectionService.getConfig()) as any[];
	}

	trace(message: string, ...args: any[]): void {
		this.logService.trace(this.redactMessage(message), ...this.redactArgs(args));
	}

	debug(message: string, ...args: any[]): void {
		this.logService.debug(this.redactMessage(message), ...this.redactArgs(args));
	}

	info(message: string, ...args: any[]): void {
		this.logService.info(this.redactMessage(message), ...this.redactArgs(args));
	}

	warn(message: string, ...args: any[]): void {
		this.logService.warn(this.redactMessage(message), ...this.redactArgs(args));
	}

	error(message: string | Error, ...args: any[]): void {
		if (message instanceof Error) {
			// Redact error message
			const redactedMessage = this.redactMessage(message.message);
			const redactedError = new Error(redactedMessage);
			redactedError.name = message.name;
			redactedError.stack = message.stack ? this.redactMessage(message.stack) : undefined;
			this.logService.error(redactedError, ...this.redactArgs(args));
		} else {
			this.logService.error(this.redactMessage(message), ...this.redactArgs(args));
		}
	}

	flush(): void {
		this.logService.flush();
	}
}

