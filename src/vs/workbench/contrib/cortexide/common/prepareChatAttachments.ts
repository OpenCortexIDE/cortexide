/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatImageAttachment, ChatPDFAttachment } from './chatThreadServiceTypes.js';

export type ImageAttachmentDraft = {
	id: string;
	data: string;
	mimeType: string;
	filename: string;
	width?: number;
	height?: number;
	size?: number;
	uploadStatus?: string;
};

export type PDFAttachmentDraft = {
	id: string;
	data: string;
	filename: string;
	size?: number;
	pageCount?: number;
	selectedPages?: number[];
	extractedText?: string;
	pagePreviews?: string[];
	uploadStatus?: string;
};

export const toChatImageAttachments = (attachments: ImageAttachmentDraft[]): ChatImageAttachment[] =>
	attachments
		.filter(att => att.uploadStatus === 'success' || !att.uploadStatus)
		.map(att => ({
			id: att.id,
			data: att.data,
			mimeType: att.mimeType,
			filename: att.filename,
			width: att.width,
			height: att.height,
			size: att.size,
		}));

export const toChatPDFAttachments = (attachments: PDFAttachmentDraft[]): ChatPDFAttachment[] =>
	attachments
		.filter(att => att.uploadStatus !== 'failed')
		.map(att => ({
			id: att.id,
			data: att.data,
			filename: att.filename,
			size: att.size,
			pageCount: att.pageCount,
			selectedPages: att.selectedPages,
			extractedText: att.extractedText,
			pagePreviews: att.pagePreviews,
		}));

export const getProcessingPDFFilenames = (attachments: PDFAttachmentDraft[]): string[] =>
	attachments
		.filter(att => att.uploadStatus === 'uploading' || att.uploadStatus === 'processing')
		.map(p => p.filename);
