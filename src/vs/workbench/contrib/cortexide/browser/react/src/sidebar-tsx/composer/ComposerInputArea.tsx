/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { KeyboardEvent, RefObject } from 'react';
import { VoidChatArea } from './VoidChatArea.js';
import { VoidInputBox2, TextAreaFns } from '../../util/inputs.js';
import { StagingContextChips } from './StagingContextChips.js';
import { ImageAttachmentList } from '../../util/ImageAttachmentList.js';
import { PDFAttachmentList } from '../../util/PDFAttachmentList.js';
import { StagingSelectionItem, ChatImageAttachment, ChatPDFAttachment } from '../../../../common/chatThreadServiceTypes.js';
import { ImageValidationError } from '../../util/imageUtils.js';

const AttachmentValidationBanner = ({ message }: { message: string }) => (
	<div className="px-2 py-1 text-xs text-[var(--cortex-danger)] bg-[var(--cortex-danger)]/10 border border-[var(--cortex-danger)]/20 rounded-md mx-2">
		{message}
	</div>
);

export type ComposerInputAreaProps = {
	onSubmit: () => void;
	onAbort: () => void;
	isStreaming: boolean;
	isDisabled: boolean;
	selections: StagingSelectionItem[];
	setSelections: (selections: StagingSelectionItem[]) => void;
	textAreaRef: RefObject<HTMLTextAreaElement | null>;
	textAreaFnsRef: RefObject<TextAreaFns | null>;
	onChangeText: (value: string) => void;
	onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
	onInputFocus: () => void;
	imageAttachments: ChatImageAttachment[];
	removeImage: (id: string) => void;
	retryImage: (id: string) => Promise<void>;
	cancelImage: (id: string) => void;
	focusedImageIndex: number | null;
	setFocusedImageIndex: (index: number | null) => void;
	imageValidationError: ImageValidationError | null;
	addImages: (files: File[]) => Promise<void>;
	pdfAttachments: ChatPDFAttachment[];
	removePDF: (id: string) => void;
	retryPDF: (id: string) => Promise<void>;
	cancelPDF: (id: string) => void;
	focusedPDFIndex: number | null;
	setFocusedPDFIndex: (index: number | null) => void;
	pdfValidationError: string | null;
	addPDFs: (files: File[]) => Promise<void>;
};

export const ComposerInputArea = ({
	onSubmit,
	onAbort,
	isStreaming,
	isDisabled,
	selections,
	setSelections,
	textAreaRef,
	textAreaFnsRef,
	onChangeText,
	onKeyDown,
	onInputFocus,
	imageAttachments,
	removeImage,
	retryImage,
	cancelImage,
	focusedImageIndex,
	setFocusedImageIndex,
	imageValidationError,
	addImages,
	pdfAttachments,
	removePDF,
	retryPDF,
	cancelPDF,
	focusedPDFIndex,
	setFocusedPDFIndex,
	pdfValidationError,
	addPDFs,
}: ComposerInputAreaProps) => (
	<VoidChatArea
		featureName='Chat'
		onSubmit={onSubmit}
		onAbort={onAbort}
		isStreaming={isStreaming}
		isDisabled={isDisabled}
		showSelections={true}
		selections={selections}
		setSelections={setSelections}
		onClickAnywhere={() => { textAreaRef.current?.focus() }}
		imageAttachments={
			imageAttachments.length > 0 ? (
				<>
					<ImageAttachmentList
						attachments={imageAttachments}
						onRemove={removeImage}
						onRetry={retryImage}
						onCancel={cancelImage}
						focusedIndex={focusedImageIndex}
						onFocusChange={setFocusedImageIndex}
					/>
					{imageValidationError ? (
						<AttachmentValidationBanner message={imageValidationError.message} />
					) : null}
				</>
			) : null
		}
		onImagePaste={addImages}
		onImageDrop={addImages}
		onPDFDrop={addPDFs}
		pdfAttachments={
			pdfAttachments.length > 0 ? (
				<>
					<PDFAttachmentList
						attachments={pdfAttachments}
						onRemove={removePDF}
						onRetry={retryPDF}
						onCancel={cancelPDF}
						focusedIndex={focusedPDFIndex}
						onFocusChange={setFocusedPDFIndex}
					/>
					{pdfValidationError ? (
						<AttachmentValidationBanner message={pdfValidationError} />
					) : null}
				</>
			) : null
		}
	>
		<VoidInputBox2
			enableAtToMention
			appearance="chatDark"
			className="min-h-[60px] px-3 py-3 rounded-2xl"
			placeholder="Plan, @ for context"
			onChangeText={onChangeText}
			onKeyDown={onKeyDown}
			onFocus={onInputFocus}
			ref={textAreaRef}
			fnsRef={textAreaFnsRef}
			multiline={true}
		/>
		<StagingContextChips
			selections={selections}
			onRemoveAt={(idx) => setSelections(selections.filter((_, i) => i !== idx))}
		/>
	</VoidChatArea>
);
