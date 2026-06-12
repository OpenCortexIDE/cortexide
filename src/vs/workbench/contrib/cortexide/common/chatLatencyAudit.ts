/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { metricsCollector } from './metricsCollector.js';

/**
 * Chat Latency Audit Service
 *
 * Measures and reports key performance metrics:
 * - TTFS (Time To First Token)
 * - TTS (Time To Stable - when response is complete)
 * - Render FPS during streaming
 * - Network round-trip times (DNS/TLS/HTTP)
 * - Token counts (prompt + attachments)
 * - Prompt assembly time
 * - Tokenization time
 */

export interface ChatLatencyMetrics {
	// Timing metrics
	ttfs: number; // Time to first token (ms)
	tts: number; // Time to stable/complete (ms)
	routerDecisionTime: number; // Time for router to select model (ms)
	networkLatency: number; // DNS + TLS + HTTP overhead (ms)
	promptAssemblyTime: number; // Time to assemble prompt (ms)
	tokenizationTime: number; // Time to tokenize prompt (ms)
	firstChunkProcessTime: number; // Time to process first chunk (ms)

	// Token metrics
	promptTokens: number;
	attachmentTokens: number;
	totalInputTokens: number;
	outputTokens: number;

	// Network metrics
	dnsTime?: number;
	tlsTime?: number;
	httpTime?: number;

	// Render metrics
	renderFPS: number; // Average FPS during streaming
	droppedFrames: number;
	framesDropped: number; // Total frames dropped (alias for droppedFrames)
	avgBatchSize: number; // Average batch size for token updates

	// Context metrics
	contextSize: number; // Characters in context
	contextTruncated: boolean;

	// Provider info
	providerName: string;
	modelName: string;

	// Request info
	requestId: string;
	timestamp: number;
}

export interface LatencyAuditContext {
	requestId: string;
	startTime: number;
	routerStartTime?: number;
	routerEndTime?: number;
	promptStartTime?: number;
	promptEndTime?: number;
	tokenizationStartTime?: number;
	tokenizationEndTime?: number;
	networkStartTime?: number;
	networkEndTime?: number;
	firstTokenTime?: number;
	streamCompleteTime?: number;
	renderFrameCount: number;
	renderLastFrameTime: number;
	renderDroppedFrames: number;
	renderBatchSizes: number[]; // Track batch sizes for token updates
	lastBatchTime: number;
	currentBatchSize: number;

	// Token tracking
	promptTokens: number;
	attachmentTokens: number;
	outputTokens: number;

	// Network
	dnsTime?: number;
	tlsTime?: number;
	httpTime?: number;

	// Context
	contextSize: number;
	contextTruncated: boolean;

	// Provider
	providerName: string;
	modelName: string;
}

export class ChatLatencyAudit {
	private contexts: Map<string, LatencyAuditContext> = new Map();

	/**
	 * Get context for a request (for updating provider/model info)
	 */
	getContext(requestId: string): LatencyAuditContext | undefined {
		return this.contexts.get(requestId);
	}
	private renderFrameInterval?: number;
	private readonly TARGET_FPS = 60;
	private readonly FRAME_INTERVAL = 1000 / this.TARGET_FPS;

	/**
	 * Start tracking a new chat request
	 */
	startRequest(requestId: string, providerName: string, modelName: string): void {
		const context: LatencyAuditContext = {
			requestId,
			startTime: performance.now(),
			renderFrameCount: 0,
			renderLastFrameTime: performance.now(),
			renderDroppedFrames: 0,
			renderBatchSizes: [],
			lastBatchTime: performance.now(),
			currentBatchSize: 0,
			promptTokens: 0,
			attachmentTokens: 0,
			outputTokens: 0,
			contextSize: 0,
			contextTruncated: false,
			providerName,
			modelName,
		};
		this.contexts.set(requestId, context);

		// Start render FPS monitoring
		if (!this.renderFrameInterval) {
			this.startRenderMonitoring();
		}
	}

	/**
	 * Mark router decision start
	 */
	markRouterStart(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.routerStartTime = performance.now();
		}
	}

	/**
	 * Mark router decision end
	 */
	markRouterEnd(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.routerEndTime = performance.now();
		}
	}

	/**
	 * Mark prompt assembly start
	 */
	markPromptAssemblyStart(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.promptStartTime = performance.now();
		}
	}

	/**
	 * Mark prompt assembly end
	 */
	markPromptAssemblyEnd(requestId: string, promptTokens: number, attachmentTokens: number, contextSize: number, truncated: boolean): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.promptEndTime = performance.now();
			context.promptTokens = promptTokens;
			context.attachmentTokens = attachmentTokens;
			context.contextSize = contextSize;
			context.contextTruncated = truncated;
		}
	}

	/**
	 * Mark tokenization start
	 */
	markTokenizationStart(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.tokenizationStartTime = performance.now();
		}
	}

	/**
	 * Mark tokenization end
	 */
	markTokenizationEnd(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.tokenizationEndTime = performance.now();
		}
	}

	/**
	 * Mark network request start
	 */
	markNetworkStart(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.networkStartTime = performance.now();
		}
	}

	/**
	 * Mark network request end (after first byte received)
	 */
	markNetworkEnd(requestId: string, dnsTime?: number, tlsTime?: number, httpTime?: number): void {
		const context = this.contexts.get(requestId);
		if (context) {
			// Only set if not already set (idempotent)
			if (!context.networkEndTime) {
				context.networkEndTime = performance.now();
			}
			if (dnsTime !== undefined) context.dnsTime = dnsTime;
			if (tlsTime !== undefined) context.tlsTime = tlsTime;
			if (httpTime !== undefined) context.httpTime = httpTime;
		}
	}

	/**
	 * Mark first token received (TTFS)
	 */
	markFirstToken(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context && !context.firstTokenTime) {
			context.firstTokenTime = performance.now();
		}
	}

	/**
	 * Mark stream complete (TTS)
	 */
	markStreamComplete(requestId: string, outputTokens: number): void {
		const context = this.contexts.get(requestId);
		if (context) {
			context.streamCompleteTime = performance.now();
			context.outputTokens = outputTokens;
		}
	}

	/**
	 * Record a render frame (for FPS calculation)
	 * Throttled to avoid performance issues during high-frequency streaming
	 */
	recordRenderFrame(requestId: string): void {
		const context = this.contexts.get(requestId);
		if (context) {
			const now = performance.now();
			// Always record the first frame (renderLastFrameTime is initialized to startTime)
			const isFirstFrame = context.renderFrameCount === 0;
			const timeSinceLastFrame = now - context.renderLastFrameTime;

			if (!isFirstFrame && timeSinceLastFrame < this.FRAME_INTERVAL) {
				// Skip this frame - too soon since last frame (but always record first frame)
				context.renderDroppedFrames++;
				return;
			}

			const elapsed = isFirstFrame ? 0 : timeSinceLastFrame;

			// Check for dropped frames (frame took longer than expected)
			if (!isFirstFrame && elapsed > this.FRAME_INTERVAL * 1.5) {
				const expectedFrames = Math.floor(elapsed / this.FRAME_INTERVAL);
				context.renderDroppedFrames += Math.max(0, expectedFrames - 1);
			}

			context.renderFrameCount++;
			context.renderLastFrameTime = now;
		}
	}

	/**
	 * Get final metrics for a request
	 */
	getMetrics(requestId: string): ChatLatencyMetrics | null {
		const context = this.contexts.get(requestId);
		if (!context) return null;

		const now = performance.now();

		// Calculate TTFS
		const ttfs = context.firstTokenTime
			? context.firstTokenTime - context.startTime
			: -1;

		// Calculate TTS
		const tts = context.streamCompleteTime
			? context.streamCompleteTime - context.startTime
			: -1;

		// Calculate router decision time
		const routerDecisionTime = context.routerStartTime && context.routerEndTime
			? context.routerEndTime - context.routerStartTime
			: -1;

		// Calculate network latency
		const networkLatency = context.networkStartTime && context.networkEndTime
			? context.networkEndTime - context.networkStartTime
			: -1;

		// Calculate prompt assembly time
		const promptAssemblyTime = context.promptStartTime && context.promptEndTime
			? context.promptEndTime - context.promptStartTime
			: -1;

		// Calculate tokenization time
		const tokenizationTime = context.tokenizationStartTime && context.tokenizationEndTime
			? context.tokenizationEndTime - context.tokenizationStartTime
			: -1;

		// Calculate first chunk process time
		const firstChunkProcessTime = context.firstTokenTime && context.networkEndTime
			? context.firstTokenTime - context.networkEndTime
			: -1;

		// Calculate render FPS (only during actual streaming/rendering period)
		// Use duration from first token to completion, not total request duration
		const renderStartTime = context.firstTokenTime || context.startTime;
		const renderEndTime = context.streamCompleteTime || now;
		const renderDuration = renderEndTime - renderStartTime;
		const renderFPS = renderDuration > 0 && context.renderFrameCount > 0
			? (context.renderFrameCount / renderDuration) * 1000
			: 0;

		return {
			ttfs,
			tts,
			routerDecisionTime,
			networkLatency,
			promptAssemblyTime,
			tokenizationTime,
			firstChunkProcessTime,
			promptTokens: context.promptTokens,
			attachmentTokens: context.attachmentTokens,
			totalInputTokens: context.promptTokens + context.attachmentTokens,
			outputTokens: context.outputTokens,
			dnsTime: context.dnsTime,
			tlsTime: context.tlsTime,
			httpTime: context.httpTime,
			renderFPS,
			droppedFrames: context.renderDroppedFrames,
			framesDropped: context.renderDroppedFrames,
			avgBatchSize: context.renderBatchSizes.length > 0
				? context.renderBatchSizes.reduce((a, b) => a + b, 0) / context.renderBatchSizes.length
				: 0,
			contextSize: context.contextSize,
			contextTruncated: context.contextTruncated,
			providerName: context.providerName,
			modelName: context.modelName,
			requestId: context.requestId,
			timestamp: context.startTime,
		};
	}

	/**
	 * Complete and remove a request context
	 */
	completeRequest(requestId: string): ChatLatencyMetrics | null {
		const metrics = this.getMetrics(requestId);
		this.releaseContext(requestId);
		return metrics;
	}

	/**
	 * Release a context + stop render monitoring when idle, WITHOUT computing metrics. The caller MUST
	 * call this (or completeRequest) for every startRequest, else the context + the 60Hz interval leak.
	 * Idempotent.
	 */
	releaseContext(requestId: string): void {
		this.contexts.delete(requestId);
		if (this.contexts.size === 0 && this.renderFrameInterval) {
			this.stopRenderMonitoring();
		}
	}

	/**
	 * Start render FPS monitoring
	 * This interval only detects dropped frames, not actual renders
	 */
	private startRenderMonitoring(): void {
		this.renderFrameInterval = window.setInterval(() => {
			// Check all active contexts for dropped frames
			for (const context of this.contexts.values()) {
				if (context.firstTokenTime && !context.streamCompleteTime) {
					// Still streaming, check if we've missed expected frames
					const now = performance.now();
					const timeSinceLastFrame = now - context.renderLastFrameTime;

					// If more than 1.5x frame interval has passed, we've dropped frames
					if (timeSinceLastFrame > this.FRAME_INTERVAL * 1.5) {
						const expectedFrames = Math.floor(timeSinceLastFrame / this.FRAME_INTERVAL);
						context.renderDroppedFrames += Math.max(0, expectedFrames - 1);
					}
				}
			}
		}, this.FRAME_INTERVAL);
	}

	/**
	 * Stop render FPS monitoring
	 */
	private stopRenderMonitoring(): void {
		if (this.renderFrameInterval) {
			clearInterval(this.renderFrameInterval);
			this.renderFrameInterval = undefined;
		}
	}

	/**
	 * Log metrics to console (for debugging)
	 * Also auto-collects metrics for aggregate reporting
	 */
	logMetrics(metrics: ChatLatencyMetrics): void {
		console.group(`[Chat Latency] Request ${metrics.requestId}`);
		console.log(`Provider: ${metrics.providerName}/${metrics.modelName}`);
		console.log(`TTFS: ${metrics.ttfs.toFixed(2)}ms`);
		console.log(`TTS: ${metrics.tts.toFixed(2)}ms`);
		if (metrics.routerDecisionTime > 0) console.log(`Router Decision: ${metrics.routerDecisionTime.toFixed(2)}ms`);
		console.log(`Network Latency: ${metrics.networkLatency.toFixed(2)}ms`);
		console.log(`Prompt Assembly: ${metrics.promptAssemblyTime.toFixed(2)}ms`);
		console.log(`Tokenization: ${metrics.tokenizationTime.toFixed(2)}ms`);
		console.log(`First Chunk Process: ${metrics.firstChunkProcessTime.toFixed(2)}ms`);
		console.log(`Input Tokens: ${metrics.totalInputTokens} (prompt: ${metrics.promptTokens}, attachments: ${metrics.attachmentTokens})`);
		console.log(`Output Tokens: ${metrics.outputTokens}`);
		console.log(`Context Size: ${metrics.contextSize} chars (truncated: ${metrics.contextTruncated})`);
		console.log(`Render FPS: ${metrics.renderFPS.toFixed(1)} (dropped: ${metrics.droppedFrames})`);
		if (metrics.dnsTime) console.log(`DNS: ${metrics.dnsTime.toFixed(2)}ms`);
		if (metrics.tlsTime) console.log(`TLS: ${metrics.tlsTime.toFixed(2)}ms`);
		if (metrics.httpTime) console.log(`HTTP: ${metrics.httpTime.toFixed(2)}ms`);
		console.groupEnd();

		// Auto-collect for aggregate reporting
		metricsCollector.add(metrics);
	}

	/**
	 * Format metrics as a report string
	 */
	formatReport(metrics: ChatLatencyMetrics): string {
		const lines: string[] = [];
		lines.push(`Chat Latency Report - Request ${metrics.requestId}`);
		lines.push(`Provider: ${metrics.providerName}/${metrics.modelName}`);
		lines.push(`TTFS: ${metrics.ttfs.toFixed(2)}ms`);
		lines.push(`TTS: ${metrics.tts.toFixed(2)}ms`);
		if (metrics.routerDecisionTime > 0) lines.push(`Router Decision: ${metrics.routerDecisionTime.toFixed(2)}ms`);
		lines.push(`Network: ${metrics.networkLatency.toFixed(2)}ms`);
		lines.push(`Prompt Assembly: ${metrics.promptAssemblyTime.toFixed(2)}ms`);
		lines.push(`Tokenization: ${metrics.tokenizationTime.toFixed(2)}ms`);
		lines.push(`Tokens: ${metrics.totalInputTokens} in / ${metrics.outputTokens} out`);
		lines.push(`Context: ${metrics.contextSize} chars${metrics.contextTruncated ? ' (truncated)' : ''}`);
		lines.push(`Render: ${metrics.renderFPS.toFixed(1)} FPS (${metrics.droppedFrames} dropped)`);
		return lines.join('\n');
	}

	/**
	 * Aggregate metrics from multiple requests for performance analysis
	 */
	static aggregateMetrics(metricsList: ChatLatencyMetrics[]): {
		count: number;
		ttfs: { median: number; p95: number; mean: number };
		tts: { median: number; p95: number; mean: number };
		routerDecisionTime: { median: number; p95: number; mean: number };
		networkLatency: { median: number; p95: number; mean: number };
		promptAssemblyTime: { median: number; p95: number; mean: number };
		renderFPS: { median: number; p95: number; mean: number };
		totalInputTokens: { median: number; mean: number };
		outputTokens: { median: number; mean: number };
	} {
		if (metricsList.length === 0) {
			return {
				count: 0,
				ttfs: { median: 0, p95: 0, mean: 0 },
				tts: { median: 0, p95: 0, mean: 0 },
				routerDecisionTime: { median: 0, p95: 0, mean: 0 },
				networkLatency: { median: 0, p95: 0, mean: 0 },
				promptAssemblyTime: { median: 0, p95: 0, mean: 0 },
				renderFPS: { median: 0, p95: 0, mean: 0 },
				totalInputTokens: { median: 0, mean: 0 },
				outputTokens: { median: 0, mean: 0 },
			};
		}

		const calculateStats = (values: number[]) => {
			const sorted = [...values].sort((a, b) => a - b);
			const median = sorted[Math.floor(sorted.length / 2)];
			const p95 = sorted[Math.floor(sorted.length * 0.95)];
			const mean = values.reduce((a, b) => a + b, 0) / values.length;
			return { median, p95, mean };
		};

		const validMetrics = metricsList.filter(m => m.ttfs > 0 && m.tts > 0);

		return {
			count: validMetrics.length,
			ttfs: calculateStats(validMetrics.map(m => m.ttfs)),
			tts: calculateStats(validMetrics.map(m => m.tts)),
			routerDecisionTime: calculateStats(validMetrics.map(m => m.routerDecisionTime).filter(v => v > 0)),
			networkLatency: calculateStats(validMetrics.map(m => m.networkLatency).filter(v => v > 0)),
			promptAssemblyTime: calculateStats(validMetrics.map(m => m.promptAssemblyTime).filter(v => v > 0)),
			renderFPS: calculateStats(validMetrics.map(m => m.renderFPS).filter(v => v > 0)),
			totalInputTokens: calculateStats(validMetrics.map(m => m.totalInputTokens)),
			outputTokens: calculateStats(validMetrics.map(m => m.outputTokens)),
		};
	}

	/**
	 * Format aggregated metrics as a performance report
	 */
	static formatAggregateReport(aggregate: ReturnType<typeof ChatLatencyAudit.aggregateMetrics>): string {
		const lines: string[] = [];
		lines.push('=== Chat Performance Aggregate Report ===');
		lines.push(`Total Requests: ${aggregate.count}`);
		lines.push('');
		lines.push('TTFS (Time To First Token):');
		lines.push(`  Median: ${aggregate.ttfs.median.toFixed(2)}ms`);
		lines.push(`  P95: ${aggregate.ttfs.p95.toFixed(2)}ms`);
		lines.push(`  Mean: ${aggregate.ttfs.mean.toFixed(2)}ms`);
		lines.push('');
		lines.push('TTS (Time To Stable):');
		lines.push(`  Median: ${aggregate.tts.median.toFixed(2)}ms`);
		lines.push(`  P95: ${aggregate.tts.p95.toFixed(2)}ms`);
		lines.push(`  Mean: ${aggregate.tts.mean.toFixed(2)}ms`);
		lines.push('');
		if (aggregate.routerDecisionTime.median > 0) {
			lines.push('Router Decision Time:');
			lines.push(`  Median: ${aggregate.routerDecisionTime.median.toFixed(2)}ms`);
			lines.push(`  P95: ${aggregate.routerDecisionTime.p95.toFixed(2)}ms`);
			lines.push(`  Mean: ${aggregate.routerDecisionTime.mean.toFixed(2)}ms`);
			lines.push('');
		}
		lines.push('Network Latency:');
		lines.push(`  Median: ${aggregate.networkLatency.median.toFixed(2)}ms`);
		lines.push(`  P95: ${aggregate.networkLatency.p95.toFixed(2)}ms`);
		lines.push(`  Mean: ${aggregate.networkLatency.mean.toFixed(2)}ms`);
		lines.push('');
		lines.push('Prompt Assembly:');
		lines.push(`  Median: ${aggregate.promptAssemblyTime.median.toFixed(2)}ms`);
		lines.push(`  P95: ${aggregate.promptAssemblyTime.p95.toFixed(2)}ms`);
		lines.push(`  Mean: ${aggregate.promptAssemblyTime.mean.toFixed(2)}ms`);
		lines.push('');
		lines.push('Render FPS:');
		lines.push(`  Median: ${aggregate.renderFPS.median.toFixed(1)}`);
		lines.push(`  P95: ${aggregate.renderFPS.p95.toFixed(1)}`);
		lines.push(`  Mean: ${aggregate.renderFPS.mean.toFixed(1)}`);
		lines.push('');
		lines.push('Tokens:');
		lines.push(`  Input (median): ${aggregate.totalInputTokens.median} tokens`);
		lines.push(`  Output (median): ${aggregate.outputTokens.median} tokens`);
		return lines.join('\n');
	}
}

// Singleton instance
export const chatLatencyAudit = new ChatLatencyAudit();

function getMetricsReport(): string {
	const metrics = metricsCollector.getAll();
	if (metrics.length === 0) {
		return 'No metrics collected yet. Send some chat messages to collect data.';
	}
	const aggregate = ChatLatencyAudit.aggregateMetrics(metrics);
	return ChatLatencyAudit.formatAggregateReport(aggregate);
}

// Expose performance audit functions globally for console access
if (typeof window !== 'undefined') {
	(window as any).cortexidePerformanceAudit = {
		printReport: (mode: 'auto' | 'single' = 'auto') => {
			import('./performanceAudit.js').then(m => m.printPerformanceAuditReport(mode));
		},
		generateReport: (mode: 'auto' | 'single' = 'auto') => {
			return import('./performanceAudit.js').then(m => m.generatePerformanceAuditReport(mode));
		},
		clearMetrics: () => {
			import('./performanceAudit.js').then(m => m.clearPerformanceMetrics());
		},
		exportMetrics: () => {
			return import('./performanceAudit.js').then(m => m.exportPerformanceMetrics());
		},
		getReport: () => {
			return getMetricsReport();
		},
	};
}

