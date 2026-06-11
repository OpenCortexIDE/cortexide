/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Phase 5 -- apply VERIFICATION.
 *
 * After the agent applies an edit, CortexIDE should tell the model whether the edit INTRODUCED
 * new problems (compile/lint errors), not dump every diagnostic in the file. Today the edit_file
 * tool reads `_getLintErrors(uri)` immediately after apply, which (a) races the language server
 * (diagnostics recompute asynchronously, so it often reads STALE markers) and (b) surfaces ALL
 * current diagnostics, leaving the model to guess which its edit caused.
 *
 * This pure module is the testable core: given a BEFORE snapshot and an AFTER snapshot of a
 * file's diagnostics, it computes which problems the edit INTRODUCED vs resolved vs left in
 * place (a multiset diff keyed on severity+code+message, ignoring line numbers since an edit
 * shifts lines), and formats a concise, model-facing verification note. The browser layer is
 * responsible for snapshotting before, WAITING for diagnostics to settle after (debounce on
 * IMarkerService.onMarkerChanged with a timeout), and feeding both snapshots here.
 */

export type DiagnosticSeverity = 'error' | 'warning';

export interface VerificationDiagnostic {
	readonly message: string;
	readonly severity: DiagnosticSeverity;
	readonly startLine: number;
	readonly endLine?: number;
	readonly code?: string;
	readonly source?: string;
}

export interface DiagnosticsDiff {
	/** Problems present AFTER but not (or fewer times) BEFORE -- attributable to the edit. */
	readonly introduced: VerificationDiagnostic[];
	/** Problems present BEFORE but gone AFTER -- the edit fixed them. */
	readonly resolved: VerificationDiagnostic[];
	/** Problems present both before and after (pre-existing, not caused by the edit). */
	readonly preexistingCount: number;
}

/**
 * Stable key for matching "the same problem" across an edit. Line is intentionally EXCLUDED so a
 * pre-existing diagnostic that merely shifted lines (because the edit added/removed lines above it)
 * is correctly seen as pre-existing, not as "introduced" -- this avoids flooding the model with
 * false alarms on every edit. The documented trade-off: if an edit adds a NEW occurrence of a
 * message that ALREADY existed in the file (same severity+code+message at a different line), the
 * multiset diff matches it against the existing count and UNDER-reports it (introduced omits it).
 * That is the safer failure direction here (a missed near-duplicate vs. noisy false positives on
 * every line shift); keying on line would invert it into the noisy direction.
 */
function keyOf(d: VerificationDiagnostic): string {
	return `${d.severity} ${d.code ?? ''} ${d.message.trim()}`;
}

function countByKey(list: readonly VerificationDiagnostic[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const d of list) { m.set(keyOf(d), (m.get(keyOf(d)) ?? 0) + 1); }
	return m;
}

/**
 * Multiset diff of two diagnostic snapshots. A problem counts as INTRODUCED only for the
 * occurrences beyond what already existed (so 1 pre-existing + 1 new of the same message yields
 * exactly 1 introduced). Line numbers are ignored for matching (edits renumber lines) but the
 * emitted `introduced` items keep their AFTER line numbers so the model can locate them.
 */
export function diffDiagnostics(before: readonly VerificationDiagnostic[], after: readonly VerificationDiagnostic[]): DiagnosticsDiff {
	const beforeCounts = countByKey(before);
	const afterCounts = countByKey(after);

	const introduced: VerificationDiagnostic[] = [];
	const remainingBudget = new Map(beforeCounts); // how many of each key are "already accounted for"
	for (const d of after) {
		const k = keyOf(d);
		const budget = remainingBudget.get(k) ?? 0;
		if (budget > 0) {
			remainingBudget.set(k, budget - 1); // matches a pre-existing one
		} else {
			introduced.push(d); // beyond the pre-existing count -> introduced by the edit
		}
	}

	const resolved: VerificationDiagnostic[] = [];
	const afterBudget = new Map(afterCounts);
	for (const d of before) {
		const k = keyOf(d);
		const budget = afterBudget.get(k) ?? 0;
		if (budget > 0) {
			afterBudget.set(k, budget - 1); // still present after
		} else {
			resolved.push(d); // gone after -> resolved by the edit
		}
	}

	const preexistingCount = before.length - resolved.length;
	return { introduced, resolved, preexistingCount };
}

export interface ApplyVerificationSummary {
	readonly hasNewProblems: boolean;
	readonly newErrorCount: number;
	readonly newWarningCount: number;
	/** Model-facing note, or null when the edit introduced no new problems. */
	readonly message: string | null;
}

const MAX_LISTED = 20;

/**
 * Format a concise verification note for the model. Returns `message: null` when the edit
 * introduced no new problems (the caller should then surface nothing, instead of noisily
 * repeating pre-existing diagnostics on every edit).
 */
export function summarizeApplyVerification(diff: DiagnosticsDiff, fileLabel: string): ApplyVerificationSummary {
	const newErrors = diff.introduced.filter(d => d.severity === 'error');
	const newWarnings = diff.introduced.filter(d => d.severity === 'warning');

	if (diff.introduced.length === 0) {
		return { hasNewProblems: false, newErrorCount: 0, newWarningCount: 0, message: null };
	}

	// Errors first, then warnings, so the most important problems are listed even when truncated.
	const ordered = [...newErrors, ...newWarnings];
	const listed = ordered.slice(0, MAX_LISTED).map(d => {
		const loc = d.endLine && d.endLine !== d.startLine ? `lines ${d.startLine}-${d.endLine}` : `line ${d.startLine}`;
		const codePart = d.code ? ` (${d.code})` : '';
		return `  [${d.severity.toUpperCase()}] ${loc}${codePart}: ${d.message}`;
	});
	const more = ordered.length > MAX_LISTED ? `\n  ... and ${ordered.length - MAX_LISTED} more` : '';

	const counts = `${newErrors.length} new error${newErrors.length === 1 ? '' : 's'}` +
		`, ${newWarnings.length} new warning${newWarnings.length === 1 ? '' : 's'}`;

	const message =
		`Your edit to ${fileLabel} introduced ${counts}:\n` +
		`${listed.join('\n')}${more}\n` +
		`These problems were NOT present before your edit. Fix them before continuing.`;

	return { hasNewProblems: true, newErrorCount: newErrors.length, newWarningCount: newWarnings.length, message };
}
