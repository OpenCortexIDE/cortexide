/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';

export const IconX = ({ size, className = '', ...props }: { size: number, className?: string } & React.SVGProps<SVGSVGElement>) => {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			className={className}
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M6 18 18 6M6 6l12 12'
			/>
		</svg>
	);
};

export const IconArrowUp = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			width={size}
			height={size}
			className={className}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fill="black"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
			></path>
		</svg>
	);
};

export const IconSquare = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			stroke="black"
			fill="black"
			strokeWidth="0"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
		</svg>
	);
};

export const IconWarning = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			stroke="currentColor"
			fill="currentColor"
			strokeWidth="0"
			viewBox="0 0 16 16"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z"
			/>
		</svg>
	);
};

type LoadingState = 'thinking' | 'typing' | 'processing' | 'default';

const formatTokenCount = (count: number): string => {
	if (count >= 1000000) {
		return `${(count / 1000000).toFixed(1)}M`;
	} else if (count >= 1000) {
		return `${(count / 1000).toFixed(1)}k`;
	}
	return count.toString();
};

export const IconLoading = ({
	className = '',
	showTokenCount,
	state = 'default',
	inline = false
}: {
	className?: string,
	showTokenCount?: number,
	state?: LoadingState,
	inline?: boolean
}) => {
	const [prevTokenCount, setPrevTokenCount] = useState<number | undefined>(undefined);
	const [shouldPulse, setShouldPulse] = useState(false);

	useEffect(() => {
		if (showTokenCount !== undefined && showTokenCount !== prevTokenCount) {
			setShouldPulse(true);
			setPrevTokenCount(showTokenCount);
			const timer = setTimeout(() => setShouldPulse(false), 300);
			return () => clearTimeout(timer);
		}
	}, [showTokenCount, prevTokenCount]);

	const tokenText = showTokenCount !== undefined
		? ` (${formatTokenCount(showTokenCount)} tokens)`
		: '';

	const animationSpeed = state === 'thinking' ? '1.6s' : state === 'processing' ? '1.2s' : '1.4s';

	const dots = (
		<span
			className={`inline-flex items-center gap-0.5 ${inline ? 'ml-1' : ''}`}
			style={{ animationDuration: animationSpeed }}
			aria-label={state === 'thinking' ? 'Thinking' : state === 'typing' ? 'Typing' : state === 'processing' ? 'Processing' : 'Loading'}
			role="status"
		>
			<span className="loading-dot" />
			<span className="loading-dot" />
			<span className="loading-dot" />
		</span>
	);

	return (
		<div className={`inline-flex items-center gap-1 ${className}`}>
			{dots}
			{tokenText && (
				<span className={`text-xs opacity-70 ${shouldPulse ? 'token-count-update' : ''}`}>
					{tokenText}
				</span>
			)}
		</div>
	);
};

export const TypingCursor = ({ className = '' }: { className?: string }) => {
	return (
		<span
			className={`typing-cursor ${className}`}
			aria-hidden="true"
		/>
	);
};
