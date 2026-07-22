/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Outbound secret-redaction at the single LLM dispatch boundary.
 *
 * Every payload that can leave the machine flows through sendLLMMessage before it
 * crosses the IPC channel to electron-main: chat messages (including tool_result
 * content) AND FIM/autocomplete prefix/suffix. Previously redaction ran ONLY on
 * chatMessages text parts, so two paths leaked raw to cloud providers:
 *   1. FIM/autocomplete shipped the raw surrounding code on every keystroke.
 *   2. tool_result content (e.g. `cat .env` output routed back as a tool result)
 *      was never walked, because the scan only looked at {type:'text'} parts.
 *
 * These helpers redact IN PLACE so the redacted objects are exactly what ships,
 * and are pure (a detect function is injected) so they are node-unit-testable
 * without the renderer DI graph -- the layer where the leak actually occurred.
 */

export type SecretDetectFn = (text: string) => {
	hasSecrets: boolean;
	redactedText: string;
	matches: { pattern: { name: string } }[];
};

export type RedactionSummary = {
	hasSecrets: boolean;
	/** secret-type name -> number of redacted matches (for trace logging / UX) */
	countByType: Map<string, number>;
};

function emptySummary(): RedactionSummary {
	return { hasSecrets: false, countByType: new Map() };
}

function accumulate(summary: RedactionSummary, matches: { pattern: { name: string } }[]): void {
	for (const m of matches) {
		const name = m.pattern.name;
		summary.countByType.set(name, (summary.countByType.get(name) ?? 0) + 1);
	}
	if (matches.length > 0) {
		summary.hasSecrets = true;
	}
}

function redactString(text: unknown, detect: SecretDetectFn, summary: RedactionSummary): string | unknown {
	if (typeof text !== 'string' || text.length === 0) {
		return text;
	}
	const d = detect(text);
	if (d.hasSecrets) {
		accumulate(summary, d.matches);
		return d.redactedText;
	}
	return text;
}

/**
 * Redact secrets in chat messages IN PLACE across every text-bearing shape:
 * string content; OpenAI/Anthropic array parts ({type:'text'} text AND
 * {type:'tool_result'} content); and Gemini `parts`. Returns a summary.
 */
export function redactChatMessages(messages: any[], detect: SecretDetectFn): RedactionSummary {
	const summary = emptySummary();
	if (!Array.isArray(messages)) {
		return summary;
	}
	for (const msg of messages) {
		if (!msg || typeof msg !== 'object') {
			continue;
		}
		if ('content' in msg) {
			if (typeof msg.content === 'string') {
				msg.content = redactString(msg.content, detect, summary);
			} else if (Array.isArray(msg.content)) {
				for (const part of msg.content) {
					if (!part || typeof part !== 'object') {
						continue;
					}
					// Anthropic/OpenAI text parts.
					if (part.type === 'text' && typeof part.text === 'string') {
						part.text = redactString(part.text, detect, summary);
					}
					// Tool results carry command/file output back to the model on the
					// `content` field (NOT `text`) -- this is the path that leaked
					// terminal output such as `cat .env`.
					else if (part.type === 'tool_result' && typeof part.content === 'string') {
						part.content = redactString(part.content, detect, summary);
					}
				}
			}
		} else if ('parts' in msg && Array.isArray(msg.parts)) {
			// Gemini-style message.
			for (const part of msg.parts) {
				if (part && typeof part === 'object' && typeof part.text === 'string') {
					part.text = redactString(part.text, detect, summary);
				}
			}
		}
	}
	return summary;
}

/**
 * Redact secrets in a FIM (autocomplete) payload IN PLACE: prefix + suffix.
 *
 * Autocomplete must redact-and-continue, never block: blocking would break the
 * completion and a notification on every keystroke would be unusable. Callers
 * therefore should NOT apply the chat `block` mode to FIM.
 */
export function redactFimMessage(
	fim: { prefix?: unknown; suffix?: unknown } | undefined | null,
	detect: SecretDetectFn
): RedactionSummary {
	const summary = emptySummary();
	if (!fim || typeof fim !== 'object') {
		return summary;
	}
	if (typeof fim.prefix === 'string') {
		fim.prefix = redactString(fim.prefix, detect, summary);
	}
	if (typeof fim.suffix === 'string') {
		fim.suffix = redactString(fim.suffix, detect, summary);
	}
	return summary;
}

/** Render a redaction summary as `name=count, ...` for trace logging. */
export function summarizeRedaction(summary: RedactionSummary): string {
	return Array.from(summary.countByType.entries())
		.map(([name, count]) => `${name}=${count}`)
		.join(', ');
}
