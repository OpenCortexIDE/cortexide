/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * The auto-approve safety boundary, extracted pure from chatThreadService so it is node-testable.
 *
 * This decides whether a tool call (edit / terminal / MCP) runs WITHOUT user confirmation. It is the
 * core of the project's "never silently does something destructive" guarantee, so it is pinned with a
 * golden table + a differential fuzz against the original inline order.
 *
 * The decision is a sequence of overrides applied to a baseline, in this EXACT order (mirrors the old
 * inline chatThreadService logic byte-for-byte):
 *   0. a CATASTROPHIC terminal command -> hard-block (refused outright, never even offered for approval)
 *   1. baseline = the user's autoApprove[type] setting; 'edits' defaults to TRUE when unset
 *   2. a DANGEROUS (but not catastrophic) terminal command can never be auto-approved
 *   3. a terminal command whose cwd escapes the workspace can never be auto-approved
 *   4. a YOLO-mode natural-language command judged "safe" by the heuristic -> auto-approve
 *   5. a HIGH-risk edit can never be auto-approved (even if the setting says so)
 *   6. a YOLO-mode edit under the risk/confidence thresholds -> auto-approve
 *
 * The per-rule `...Fired` flags exist so the caller can fire the SAME telemetry it always did (the
 * original fired metrics conditionally at each override); they reproduce the original guards exactly,
 * including the "only when this rule actually changed the decision" conditions for the force-approval rules.
 */

export interface AutoApproveInputs {
	/** the tool's approval bucket: 'edits' | 'terminal' | 'MCP tools' (kept as string for forward-compat). */
	readonly approvalType: string;
	/** the user's globalSettings.autoApprove[approvalType] value (undefined = never set). */
	readonly autoApproveSetting: boolean | undefined;
	/** whether this tool is an edit operation (drives the edit-risk overrides). */
	readonly isEditOperation: boolean;
	/** classifyCommandRisk() result for a terminal run_command / run_persistent_command; undefined otherwise. */
	readonly commandRisk?: { readonly hardBlock: boolean; readonly requiresApproval: boolean };
	/** for a terminal command: does its cwd escape the workspace? (only ever set for terminal commands). */
	readonly cwdEscapes?: boolean;
	/** result of the YOLO natural-language-command safe heuristic (only set for run_nl_command under YOLO). */
	readonly nlCommandYoloSafe?: boolean;
	/** edit risk scoring result (only set for edit ops, and only when scoring succeeded). */
	readonly editRisk?: { readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; readonly riskScore: number; readonly confidenceScore: number };
	/** YOLO thresholds (only consulted for edit ops; enabled mirrors globalSettings.enableYOLOMode). */
	readonly yolo?: { readonly enabled: boolean; readonly riskThreshold: number; readonly confidenceThreshold: number };
}

export type AutoApproveOutcome = 'hard-block' | 'auto-approve' | 'require-approval';

export interface AutoApproveDecision {
	readonly outcome: AutoApproveOutcome;
	/** a dangerous (requiresApproval) command flipped an otherwise-auto-approve to require-approval. */
	readonly dangerousCommandForcedApproval: boolean;
	/** a cwd-escaping command flipped an otherwise-auto-approve to require-approval. */
	readonly cwdEscapeForcedApproval: boolean;
	/** the YOLO NL-command heuristic auto-approved (fires whenever the heuristic said "safe"). */
	readonly yoloNlAutoApproved: boolean;
	/** a HIGH-risk edit flipped an otherwise-auto-approve to require-approval. */
	readonly highRiskBlockedDespiteAutoApprove: boolean;
	/** the YOLO edit thresholds auto-approved (fires whenever the thresholds were met). */
	readonly yoloEditAutoApproved: boolean;
}

/** Baseline auto-approve from the user's per-type setting; 'edits' defaults to TRUE when unset. */
export function computeAutoApproveBaseline(approvalType: string, autoApproveSetting: boolean | undefined): boolean {
	if (approvalType === 'edits' && autoApproveSetting === undefined) { return true; }
	return autoApproveSetting === true;
}

/** The full auto-approve decision. Pure and total. See the module doc for the override order. */
export function decideAutoApprove(inp: AutoApproveInputs): AutoApproveDecision {
	const none = {
		dangerousCommandForcedApproval: false,
		cwdEscapeForcedApproval: false,
		yoloNlAutoApproved: false,
		highRiskBlockedDespiteAutoApprove: false,
		yoloEditAutoApproved: false,
	};

	// 0) catastrophic terminal command -> hard block (refused outright)
	if (inp.commandRisk?.hardBlock) {
		return { outcome: 'hard-block', ...none };
	}

	// 1) baseline from the setting
	let auto = computeAutoApproveBaseline(inp.approvalType, inp.autoApproveSetting);

	// 2) a dangerous command can never be auto-approved (force explicit approval)
	let dangerousCommandForcedApproval = false;
	if (inp.commandRisk?.requiresApproval && auto) { auto = false; dangerousCommandForcedApproval = true; }

	// 3) a cwd escaping the workspace can never be auto-approved
	let cwdEscapeForcedApproval = false;
	if (auto && inp.cwdEscapes) { auto = false; cwdEscapeForcedApproval = true; }

	// 4) YOLO NL-command safe heuristic -> auto-approve
	let yoloNlAutoApproved = false;
	if (inp.nlCommandYoloSafe) { auto = true; yoloNlAutoApproved = true; }

	// 5 + 6) edit-operation risk overrides
	let highRiskBlockedDespiteAutoApprove = false;
	let yoloEditAutoApproved = false;
	if (inp.isEditOperation && inp.editRisk) {
		// 5) HIGH-risk edits always require approval, even if auto-approve is on
		if (auto && inp.editRisk.riskLevel === 'HIGH') { auto = false; highRiskBlockedDespiteAutoApprove = true; }
		// 6) YOLO: low risk + high confidence -> auto-approve (even if the setting wasn't on)
		if (inp.yolo?.enabled
			&& inp.editRisk.riskScore < inp.yolo.riskThreshold
			&& inp.editRisk.confidenceScore > inp.yolo.confidenceThreshold) {
			auto = true; yoloEditAutoApproved = true;
		}
	}

	return {
		outcome: auto ? 'auto-approve' : 'require-approval',
		dangerousCommandForcedApproval,
		cwdEscapeForcedApproval,
		yoloNlAutoApproved,
		highRiskBlockedDespiteAutoApprove,
		yoloEditAutoApproved,
	};
}
