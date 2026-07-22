/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useId } from 'react';

export type ContextUsageBarProps = {
	contextTotal: number;
	contextBudget: number;
	contextPct: number;
	className?: string;
};

export const ContextUsageBar = ({
	contextTotal,
	contextBudget,
	contextPct,
	className = '',
}: ContextUsageBarProps) => {
	const labelId = useId();
	const pctNum = Math.max(0, Math.min(100, Math.round(contextPct * 100)));
	const color = contextPct >= 1
		? 'text-[var(--cortex-danger)]'
		: contextPct > 0.8
			? 'text-[var(--cortex-warning)]'
			: 'text-void-fg-3';
	const barColor = contextPct >= 1
		? 'bg-[var(--cortex-danger)]'
		: contextPct > 0.8
			? 'bg-[var(--cortex-warning)]'
			: 'bg-void-fg-3/60';

	return (
		<div className={className}>
			<div className={`text-[10px] ${color}`} id={labelId}>
				Context ~{contextTotal} / {contextBudget} tokens ({pctNum}%)
			</div>
			<div
				className="h-[3px] w-full bg-void-border-3 rounded mt-0.5"
				role="progressbar"
				aria-labelledby={labelId}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={pctNum}
			>
				<div className={`h-[3px] ${barColor} rounded`} style={{ width: `${pctNum}%` }} />
			</div>
		</div>
	);
};
