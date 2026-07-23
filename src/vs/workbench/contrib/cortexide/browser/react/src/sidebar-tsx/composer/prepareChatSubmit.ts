/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatImageAttachment, ChatPDFAttachment } from '../../../../common/chatThreadServiceTypes.js';
import {
	getProcessingPDFFilenames,
	ImageAttachmentDraft,
	PDFAttachmentDraft,
	toChatImageAttachments,
	toChatPDFAttachments,
} from '../../../../common/prepareChatAttachments.js';
import { ModelSelection, SettingsOfProvider } from '../../../../common/cortexideSettingsTypes.js';

type NotificationServiceLike = {
	warn: (message: string) => void;
	error: (message: string) => void;
};

export type PrepareChatSubmitParams = {
	imageAttachments: ImageAttachmentDraft[];
	pdfAttachments: PDFAttachmentDraft[];
	modelSelection: ModelSelection | null;
	settingsOfProvider: SettingsOfProvider;
	notificationService: NotificationServiceLike;
};

export type PrepareChatSubmitResult =
	| { ok: true; images: ChatImageAttachment[]; pdfs: ChatPDFAttachment[] }
	| { ok: false };

/** Convert composer attachments and validate vision support before send. */
export const prepareChatSubmitAttachments = async ({
	imageAttachments,
	pdfAttachments,
	modelSelection,
	settingsOfProvider,
	notificationService,
}: PrepareChatSubmitParams): Promise<PrepareChatSubmitResult> => {
	const images = toChatImageAttachments(imageAttachments);
	const pdfs = toChatPDFAttachments(pdfAttachments);

	const processingNames = getProcessingPDFFilenames(pdfAttachments);
	if (processingNames.length > 0) {
		notificationService.warn(
			`Some PDFs are still processing: ${processingNames.join(', ')}. They will be sent but may not have extracted text available yet.`,
		);
	}

	if ((images.length === 0 && pdfs.length === 0) || !modelSelection) {
		return { ok: true, images, pdfs };
	}

	const {
		isSelectedModelVisionCapable,
		checkOllamaModelVisionCapable,
		hasVisionCapableApiKey,
		hasOllamaVisionModel,
		isOllamaAccessible,
	} = await import('../../util/visionModelHelper.js');

	if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') {
		if (images.length > 0) {
			const hasApiKey = hasVisionCapableApiKey(settingsOfProvider, modelSelection);
			const ollamaAccessible = await isOllamaAccessible();
			const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();
			if (!hasApiKey && !hasOllamaVision) {
				notificationService.error(
					'No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava) to use images.',
				);
				return { ok: false };
			}
		}
		return { ok: true, images, pdfs };
	}

	let isVisionCapable = isSelectedModelVisionCapable(modelSelection, settingsOfProvider);
	if (!isVisionCapable && modelSelection.providerName === 'ollama') {
		const ollamaAccessible = await isOllamaAccessible();
		if (ollamaAccessible) {
			isVisionCapable = await checkOllamaModelVisionCapable(modelSelection.modelName);
		}
	}

	if (!isVisionCapable) {
		const hasApiKey = hasVisionCapableApiKey(settingsOfProvider, modelSelection);
		const ollamaAccessible = await isOllamaAccessible();
		const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();
		if (!hasApiKey && !hasOllamaVision) {
			notificationService.error(
				'The selected model does not support images or PDFs. Please select a vision-capable model (e.g., Claude, GPT-4, Gemini, or an Ollama vision model like llava).',
			);
			return { ok: false };
		}
		notificationService.warn(
			'The selected model may not support images or PDFs. Consider switching to a vision-capable model for better results.',
		);
	}

	return { ok: true, images, pdfs };
};
