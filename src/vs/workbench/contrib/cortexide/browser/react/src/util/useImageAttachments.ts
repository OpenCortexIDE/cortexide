/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
// @ts-nocheck

import { useState, useCallback, useRef } from 'react';
import { ChatImageAttachment } from '../../../../common/chatThreadServiceTypes.js';
import { processImage, validateImageFile, ImageValidationError, formatFileSize } from './imageUtils.js';

export type VisionCapabilityStatus = {
	hasVisionSupport: boolean;
	needsOllama: boolean;
	ollamaAccessible: boolean;
};

export interface UseImageAttachmentsReturn {
	attachments: ChatImageAttachment[];
	addImages: (files: File[]) => Promise<void>;
	removeImage: (id: string) => void;
	retryImage: (id: string) => Promise<void>;
	cancelImage: (id: string) => void;
	clearAll: () => void;
	focusedIndex: number | null;
	setFocusedIndex: (index: number | null) => void;
	validationError: ImageValidationError | null;
}

/**
 * Hook to manage image attachments in the chat composer
 */
export function useImageAttachments(): UseImageAttachmentsReturn {
	const [attachments, setAttachments] = useState<ChatImageAttachment[]>([]);
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
	const [validationError, setValidationError] = useState<ImageValidationError | null>(null);
	const processingRef = useRef<Set<string>>(new Set());
	const cancelRef = useRef<Map<string, () => void>>(new Map());
	const originalFilesRef = useRef<Map<string, File>>(new Map());

	const addImages = useCallback(async (files: File[]) => {
		setValidationError(null);

		// Validate each file with better error messages
		const validationErrors: ImageValidationError[] = [];
		for (const file of files) {
			const error = validateImageFile(file);
			if (error) {
				// Enhance error message with specific file details
				if (error.type === 'size') {
					validationErrors.push({
						...error,
						message: `${file.name}: ${error.message}`
					});
				} else {
					validationErrors.push({
						...error,
						message: `${file.name}: ${error.message}`
					});
				}
			}
		}

		if (validationErrors.length > 0) {
			setValidationError(validationErrors[0]);
			return;
		}

		// Check count limit
		if (attachments.length + files.length > 10) {
			setValidationError({
				type: 'count',
				message: `Too many images: ${attachments.length + files.length}. Maximum: 10 images per message.`
			});
			return;
		}

		// Process each file
		for (const file of files) {
			const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

			// Store original file for retry
			originalFilesRef.current.set(id, file);

			// Add placeholder attachment immediately
			const placeholder: ChatImageAttachment = {
				id,
				data: new Uint8Array(0),
				mimeType: file.type as ChatImageAttachment['mimeType'],
				filename: file.name,
				width: 0,
				height: 0,
				size: 0,
				uploadStatus: 'pending',
			};

			setAttachments(prev => [...prev, placeholder]);

			// Process image asynchronously with progress tracking
			processingRef.current.add(id);
			let cancelled = false;
			const cancelFn = () => {
				cancelled = true;
				processingRef.current.delete(id);
				cancelRef.current.delete(id);
				originalFilesRef.current.delete(id);
				setAttachments(prev => prev.filter(att => att.id !== id));
			};
			cancelRef.current.set(id, cancelFn);

			// Simulate upload progress (since images are processed locally, not uploaded to server)
			// We'll show progress during processing stages
			const updateProgress = (progress: number) => {
				if (cancelled) return;
				setAttachments(prev => prev.map(att =>
					att.id === id
						? { ...att, uploadStatus: 'uploading' as const, uploadProgress: progress }
						: att
				));
			};

			try {
				// Set status to uploading
				updateProgress(0.1);

				const processed = await processImage(file, (stageProgress: number) => {
					// Map processing stages to progress (0.1 to 0.9)
					const progress = 0.1 + (stageProgress * 0.8);
					updateProgress(progress);
				});

				if (cancelled) return;

				// Update attachment with processed data
				setAttachments(prev => prev.map(att =>
					att.id === id
						? {
							...att,
							data: processed.data,
							mimeType: processed.mimeType,
							filename: processed.filename,
							width: processed.width,
							height: processed.height,
							size: processed.size,
							uploadStatus: 'success',
							uploadProgress: 1,
						}
						: att
				));

				// Validate batch after adding - check total size and count
				setAttachments(prev => {
					const successful = prev.filter(a => a.uploadStatus === 'success');
					const totalSize = successful.reduce((sum, img) => sum + img.size, 0);
					const maxTotalSize = 20 * 1024 * 1024; // 20 MB

					if (successful.length > 10) {
						const error: ImageValidationError = {
							type: 'count',
							message: `Too many images: ${successful.length}. Maximum: 10.`
						};
						setValidationError(error);
						return prev.map(att =>
							att.id === id
								? { ...att, uploadStatus: 'failed' as const, error: error.message, uploadProgress: undefined }
								: att
						);
					}

					if (totalSize > maxTotalSize) {
						const error: ImageValidationError = {
							type: 'size',
							message: `Total image size too large: ${formatFileSize(totalSize)}. Maximum: ${formatFileSize(maxTotalSize)}.`
						};
						setValidationError(error);
						return prev.map(att =>
							att.id === id
								? { ...att, uploadStatus: 'failed' as const, error: error.message, uploadProgress: undefined }
								: att
						);
					}

					return prev;
				});

				// Clean up
				cancelRef.current.delete(id);
			} catch (error) {
				if (cancelled) return;
				const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
				setAttachments(prev => prev.map(att =>
					att.id === id
						? {
							...att,
							uploadStatus: 'failed' as const,
							error: errorMessage,
							uploadProgress: undefined,
						}
						: att
				));
				setValidationError({
					type: 'corrupt',
					message: errorMessage,
				});
			} finally {
				if (!cancelled) {
					processingRef.current.delete(id);
					cancelRef.current.delete(id);
				}
			}
		}
	}, [attachments.length]);

	const removeImage = useCallback((id: string) => {
		// Cancel if in progress
		const cancelFn = cancelRef.current.get(id);
		if (cancelFn) {
			cancelFn();
			return;
		}

		setAttachments(prev => prev.filter(att => att.id !== id));
		originalFilesRef.current.delete(id);
		setValidationError(null);
		if (focusedIndex !== null && focusedIndex >= attachments.length - 1) {
			setFocusedIndex(Math.max(0, attachments.length - 2));
		}
	}, [attachments.length, focusedIndex]);

	const cancelImage = useCallback((id: string) => {
		const cancelFn = cancelRef.current.get(id);
		if (cancelFn) {
			cancelFn();
		}
	}, []);

	const retryImage = useCallback(async (id: string) => {
		const attachment = attachments.find(att => att.id === id);
		if (!attachment) return;

		// Get original file for retry
		const originalFile = originalFilesRef.current.get(id);
		if (!originalFile) {
			// If no original file, can't retry - show error
			setAttachments(prev => prev.map(att =>
				att.id === id
					? {
						...att,
						uploadStatus: 'failed' as const,
						error: 'Cannot retry: original file not available',
					}
					: att
			));
			return;
		}

		// Reset status and retry with original file
		setAttachments(prev => prev.map(att =>
			att.id === id
				? { ...att, uploadStatus: 'pending' as const, error: undefined, uploadProgress: undefined }
				: att
		));

		// Reprocess the original file
		processingRef.current.add(id);
		let cancelled = false;
		const cancelFn = () => {
			cancelled = true;
			processingRef.current.delete(id);
			cancelRef.current.delete(id);
		};
		cancelRef.current.set(id, cancelFn);

		const updateProgress = (progress: number) => {
			if (cancelled) return;
			setAttachments(prev => prev.map(att =>
				att.id === id
					? { ...att, uploadStatus: 'uploading' as const, uploadProgress: progress }
					: att
			));
		};

		try {
			updateProgress(0.1);
			const processed = await processImage(originalFile, (stageProgress: number) => {
				const progress = 0.1 + (stageProgress * 0.8);
				updateProgress(progress);
			});

			if (cancelled) return;

			setAttachments(prev => prev.map(att =>
				att.id === id
					? {
						...att,
						data: processed.data,
						mimeType: processed.mimeType,
						filename: processed.filename,
						width: processed.width,
						height: processed.height,
						size: processed.size,
						uploadStatus: 'success',
						uploadProgress: 1,
					}
					: att
			));
		} catch (error) {
			if (cancelled) return;
			const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
			setAttachments(prev => prev.map(att =>
				att.id === id
					? {
						...att,
						uploadStatus: 'failed' as const,
						error: errorMessage,
						uploadProgress: undefined,
					}
					: att
			));
		} finally {
			if (!cancelled) {
				processingRef.current.delete(id);
				cancelRef.current.delete(id);
			}
		}
	}, [attachments]);

	const clearAll = useCallback(() => {
		// Cancel all in-progress uploads
		cancelRef.current.forEach(cancelFn => cancelFn());
		cancelRef.current.clear();
		processingRef.current.clear();
		originalFilesRef.current.clear();
		setAttachments([]);
		setValidationError(null);
		setFocusedIndex(null);
	}, []);

	return {
		attachments,
		addImages,
		removeImage,
		retryImage,
		cancelImage,
		clearAll,
		focusedIndex,
		setFocusedIndex,
		validationError,
	};
}

