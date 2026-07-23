/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { ButtonHTMLAttributes, useCallback, useMemo } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { useAccessor, useSettingsState } from '../../util/services.js';
import { VoidCustomDropdownBox, VoidSlider, VoidSwitch } from '../../util/inputs.js';
import { ModelDropdown } from '../../settings/ModelDropdown.js';
import { ChatMode, FeatureName, isValidProviderModelSelection } from '../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js';
import { getModelCapabilities, getIsReasoningEnabledState } from '../../../../common/modelCapabilities.js';
import { StagingSelectionItem } from '../../../../common/chatThreadServiceTypes.js';
import { IconX, IconArrowUp, IconSquare } from '../shared/icons.js';
import { SelectedFiles } from './SelectedFiles.js';

// SLIDER ONLY:
const ReasoningOptionSlider = ({ featureName }: { featureName: FeatureName }) => {
	const accessor = useAccessor()

	const cortexideSettingsService = accessor.get('ICortexideSettingsService')
	const voidSettingsState = useSettingsState()

	const modelSelection = voidSettingsState.modelSelectionOfFeature[featureName]
	const overridesOfModel = voidSettingsState.overridesOfModel

	if (!modelSelection) return null

	// Skip "auto" - it's not a real provider
	if (!isValidProviderModelSelection(modelSelection)) {
		return null;
	}

	const { modelName, providerName } = modelSelection
	const { reasoningCapabilities } = getModelCapabilities(providerName, modelName, overridesOfModel)
	const { canTurnOffReasoning, reasoningSlider: reasoningBudgetSlider } = reasoningCapabilities || {}

	const modelSelectionOptions = voidSettingsState.optionsOfModelSelection[featureName][providerName]?.[modelName]
	const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)

	if (canTurnOffReasoning && !reasoningBudgetSlider) { // if it's just a on/off toggle without a power slider
		return <div className='flex items-center gap-x-2'>
			<span className='text-void-fg-3 text-xs pointer-events-none inline-block w-10 pr-1'>Thinking</span>
			<VoidSwitch
				size='xxs'
				value={isReasoningEnabled}
				onChange={(newVal) => {
					const isOff = canTurnOffReasoning && !newVal
					cortexideSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff })
				}}
			/>
		</div>
	}

	if (reasoningBudgetSlider?.type === 'budget_slider') { // if it's a slider
		const { min: min_, max, default: defaultVal } = reasoningBudgetSlider

		const nSteps = 8 // only used in calculating stepSize, stepSize is what actually matters
		const stepSize = Math.round((max - min_) / nSteps)

		const valueIfOff = min_ - stepSize
		const min = canTurnOffReasoning ? valueIfOff : min_
		const value = isReasoningEnabled ? voidSettingsState.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]?.reasoningBudget ?? defaultVal
			: valueIfOff

		return <div className='flex items-center gap-x-2'>
			<span className='text-void-fg-3 text-xs pointer-events-none inline-block w-10 pr-1'>Thinking</span>
			<VoidSlider
				width={50}
				size='xs'
				min={min}
				max={max}
				step={stepSize}
				value={value}
				onChange={(newVal) => {
					if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') return;
					const isOff = canTurnOffReasoning && newVal === valueIfOff
					cortexideSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff, reasoningBudget: newVal })
				}}
			/>
			<span className='text-void-fg-3 text-xs pointer-events-none'>{isReasoningEnabled ? `${value} tokens` : 'Thinking disabled'}</span>
		</div>
	}

	if (reasoningBudgetSlider?.type === 'effort_slider') {

		const { values, default: defaultVal } = reasoningBudgetSlider

		const min = canTurnOffReasoning ? -1 : 0
		const max = values.length - 1

		const currentEffort = voidSettingsState.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]?.reasoningEffort ?? defaultVal
		const valueIfOff = -1
		const value = isReasoningEnabled && currentEffort ? values.indexOf(currentEffort) : valueIfOff

		const currentEffortCapitalized = currentEffort.charAt(0).toUpperCase() + currentEffort.slice(1, Infinity)

		return <div className='flex items-center gap-x-2'>
			<span className='text-void-fg-3 text-xs pointer-events-none inline-block w-10 pr-1'>Thinking</span>
			<VoidSlider
				width={30}
				size='xs'
				min={min}
				max={max}
				step={1}
				value={value}
				onChange={(newVal) => {
					if (modelSelection.providerName === 'auto' && modelSelection.modelName === 'auto') return;
					const isOff = canTurnOffReasoning && newVal === valueIfOff
					cortexideSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff, reasoningEffort: values[newVal] ?? undefined })
				}}
			/>
			<span className='text-void-fg-3 text-xs pointer-events-none'>{isReasoningEnabled ? `${currentEffortCapitalized}` : 'Thinking disabled'}</span>
		</div>
	}

	return null
}



const nameOfChatMode: Record<ChatMode, string> = {
	'normal': 'Ask',
	'gather': 'Gather',
	'plan': 'Plan',
	'agent': 'Agent',
}

const detailOfChatMode: Record<ChatMode, string> = {
	'normal': 'Ask questions about your code',
	'gather': 'Reads files, no edits',
	'plan': 'Plans first, then executes',
	'agent': 'Edits files and uses tools',
}


const ChatModeDropdown = ({ className }: { className: string }) => {
	const accessor = useAccessor()

	const cortexideSettingsService = accessor.get('ICortexideSettingsService')
	const settingsState = useSettingsState()

	const options: ChatMode[] = useMemo(() => ['normal', 'gather', 'plan', 'agent'], [])

	const onChangeOption = useCallback((newVal: ChatMode) => {
		cortexideSettingsService.setGlobalSetting('chatMode', newVal)
	}, [cortexideSettingsService])

	const getModeDisplayName = (val: ChatMode) => nameOfChatMode[val] ?? val

	return <VoidCustomDropdownBox
		className={className}
		options={options}
		selectedOption={settingsState.globalSettings.chatMode}
		onChangeOption={onChangeOption}
		getOptionDisplayName={getModeDisplayName}
		getOptionDropdownName={getModeDisplayName}
		getOptionDropdownDetail={(val) => detailOfChatMode[val]}
		getOptionsEqual={(a, b) => a === b}
	/>

}





interface CortexideChatAreaProps {
	// Required
	children: React.ReactNode; // This will be the input component

	// Form controls
	onSubmit: () => void;
	onAbort: () => void;
	isStreaming: boolean;
	isDisabled?: boolean;
	divRef?: React.RefObject<HTMLDivElement | null>;

	// UI customization
	className?: string;
	showModelDropdown?: boolean;
	showSelections?: boolean;
	showProspectiveSelections?: boolean;
	loadingIcon?: React.ReactNode;

	selections?: StagingSelectionItem[]
	setSelections?: (s: StagingSelectionItem[]) => void
	// selections?: any[];
	// onSelectionsChange?: (selections: any[]) => void;

	onClickAnywhere?: () => void;
	// Optional close button
	onClose?: () => void;

	// Image attachments
	imageAttachments?: React.ReactNode;
	onImagePaste?: (files: File[]) => void;
	onImageDrop?: (files: File[]) => void;
	onImageUpload?: () => void;
	onPDFDrop?: (files: File[]) => void;
	pdfAttachments?: React.ReactNode;

	featureName: FeatureName;
}

export const VoidChatArea: React.FC<CortexideChatAreaProps> = ({
	children,
	onSubmit,
	onAbort,
	onClose,
	onClickAnywhere,
	divRef,
	isStreaming = false,
	isDisabled = false,
	className = '',
	showModelDropdown = true,
	showSelections = false,
	showProspectiveSelections = false,
	selections,
	setSelections,
	imageAttachments,
	onImagePaste,
	onImageDrop,
	onImageUpload,
	onPDFDrop,
	pdfAttachments,
	featureName,
	loadingIcon,
}) => {
	const [isDragOver, setIsDragOver] = React.useState(false);
	const imageInputRef = React.useRef<HTMLInputElement>(null);
	const pdfInputRef = React.useRef<HTMLInputElement>(null);
	const containerRef = React.useRef<HTMLDivElement>(null);

		// allow-any-unicode-next-line
		// Handle paste — listens on container (bubbles from textarea) AND document level
	// (document listener catches Ctrl+V when the sidebar panel is focused but textarea isn't)
	React.useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			const items = Array.from(e.clipboardData?.items || []);
			const imageFiles: File[] = [];
			const pdfFiles: File[] = [];

			for (const item of items) {
				if (item.type.startsWith('image/')) {
					const file = item.getAsFile();
					if (file) imageFiles.push(file);
				} else if (item.type === 'application/pdf') {
					const file = item.getAsFile();
					if (file) pdfFiles.push(file);
				}
			}

			if (imageFiles.length > 0 && onImagePaste) {
				e.preventDefault();
				onImagePaste(imageFiles);
			}
			if (pdfFiles.length > 0 && onPDFDrop) {
				e.preventDefault();
				onPDFDrop(pdfFiles);
			}
		};

		// Primary: attach to container so it catches events bubbling from the textarea
		const container = containerRef.current || divRef?.current;
		if (container) {
			container.addEventListener('paste', handlePaste);
		}

		// Fallback: document-level listener catches paste when chat area is visible but
		// the textarea isn't focused (e.g. user focuses sidebar panel then Ctrl+V)
		const handleDocumentPaste = (e: ClipboardEvent) => {
			// Only intercept if the target is not already inside our container
			// and our container is mounted in the DOM
			const cont = containerRef.current || divRef?.current;
			if (!cont) return;
			if (cont.contains(e.target as Node)) return; // already handled by container listener
			// Only fire if the paste comes from a non-input element (avoid stealing from other inputs)
			const target = e.target as HTMLElement;
			const tag = target?.tagName?.toLowerCase();
			if (tag === 'input' || tag === 'textarea') return;

			const items = Array.from(e.clipboardData?.items || []);
			const imageFiles = items
				.filter(i => i.type.startsWith('image/'))
				.map(i => i.getAsFile())
				.filter((f): f is File => f !== null);

			if (imageFiles.length > 0 && onImagePaste) {
				e.preventDefault();
				onImagePaste(imageFiles);
			}
		};
		document.addEventListener('paste', handleDocumentPaste);

		return () => {
			if (container) container.removeEventListener('paste', handlePaste);
			document.removeEventListener('paste', handleDocumentPaste);
		};
	}, [divRef, onImagePaste, onPDFDrop]);

	// Throttle drag over events to prevent jank
	const lastDragOverTimeRef = React.useRef<number>(0);
	const DRAG_THROTTLE_MS = 50; // Update at most every 50ms

	// Handle drag and drop
	const handleDragOver = React.useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const now = Date.now();
		if (now - lastDragOverTimeRef.current < DRAG_THROTTLE_MS) {
			return;
		}
		lastDragOverTimeRef.current = now;

		const hasFiles = Array.from(e.dataTransfer.items).some(item =>
			item.type.startsWith('image/') || item.type === 'application/pdf'
		);
		if (hasFiles) {
			setIsDragOver(true);
		}
	}, []);

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);

		const imageFiles = Array.from(e.dataTransfer.files).filter(file =>
			file.type.startsWith('image/')
		);
		const pdfFiles = Array.from(e.dataTransfer.files).filter(file =>
			file.type === 'application/pdf'
		);

		if (imageFiles.length > 0 && onImageDrop) {
			onImageDrop(imageFiles);
		}
		if (pdfFiles.length > 0 && onPDFDrop) {
			onPDFDrop(pdfFiles);
		}
	};

	const handleImageUploadClick = () => {
		imageInputRef.current?.click();
	};

	const handlePDFUploadClick = () => {
		pdfInputRef.current?.click();
	};

	const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []).filter(file =>
			file.type.startsWith('image/')
		);
		if (files.length > 0 && onImageDrop) {
			onImageDrop(files);
		}
		e.target.value = ''; // Reset input
	};

	const handlePDFInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []).filter(file =>
			file.type === 'application/pdf'
		);
		if (files.length > 0 && onPDFDrop) {
			onPDFDrop(files);
		}
		e.target.value = ''; // Reset input
	};

	return (
		<div
			ref={(node) => {
				if (divRef) {
					if (typeof divRef === 'function') {
						divRef(node);
					} else {
						divRef.current = node;
					}
				}
				containerRef.current = node;
			}}
			className={`
				gap-x-1
                flex flex-col p-2.5 relative cortex-composer-shell text-left shrink-0
                rounded-2xl
				transition-all duration-200
				${isDragOver ? 'border-[var(--cortex-brand)] bg-[var(--cortex-brand-soft)]' : ''}
				max-h-[80vh] overflow-y-auto
                ${className}
            `}
			onClick={(e) => {
				onClickAnywhere?.()
			}}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Hidden file inputs - separate for images and PDFs */}
			<input
				ref={imageInputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
				multiple
				className="hidden"
				onChange={handleImageInputChange}
			/>
			<input
				ref={pdfInputRef}
				type="file"
				accept="application/pdf"
				multiple
				className="hidden"
				onChange={handlePDFInputChange}
			/>

			{/* Image attachments section */}
			{imageAttachments}

			{/* PDF attachments section */}
			{pdfAttachments}

			{/* Selections section */}
			{showSelections && selections && setSelections && (
				<SelectedFiles
					type='staging'
					selections={selections}
					setSelections={setSelections}
					showProspectiveSelections={showProspectiveSelections}
				/>
			)}

			{/* Input section - Modern Cursor-style layout */}
			<div className="relative w-full flex items-end gap-2">
				<div className="flex-1 min-w-0">
					{children}
				</div>

				{/* Right-side icon bar - Cursor style */}
				<div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
					{/* Image upload button */}
					<button
						type="button"
						onClick={handleImageUploadClick}
						className="cortex-composer-icon-btn"
						aria-label="Upload images"
						title="Upload images (or paste/drag & drop)"
					>
						<ImageIcon size={16} />
					</button>

					{/* PDF upload button */}
					<button
						type="button"
						onClick={handlePDFUploadClick}
						className="cortex-composer-icon-btn"
						aria-label="Upload PDFs"
						title="Upload PDFs (or paste/drag & drop)"
					>
						<FileText size={16} />
					</button>

					{/* Submit button */}
					{isStreaming ? (
						<ButtonStop onClick={onAbort} />
					) : (
						<ButtonSubmit
							onClick={onSubmit}
							disabled={isDisabled}
						/>
					)}
				</div>

				{/* Close button (X) if onClose is provided */}
				{onClose && (
					<div className='absolute -top-1 -right-1 z-1'>
						<button
							type="button"
							className="cursor-pointer void-focus-ring rounded-md p-0.5"
							onClick={onClose}
							aria-label="Close"
						>
							<IconX
								size={12}
								className="stroke-[2] opacity-80 text-void-fg-3 hover:brightness-95"
								aria-hidden="true"
							/>
						</button>
					</div>
				)}
			</div>

			{/* Bottom row - Model selector and settings */}
			<div className='cortex-composer-toolbar flex flex-row justify-between items-center gap-2'>
				{showModelDropdown && (
					<div className='flex items-center flex-wrap gap-x-2 gap-y-1 text-nowrap flex-1 min-w-0'>
						{featureName === 'Chat' && <ChatModeDropdown className='cortex-composer-control' />}
						<ModelDropdown featureName={featureName} className='cortex-composer-control' />
						<ReasoningOptionSlider featureName={featureName} />
					</div>
				)}

				{/* Loading indicator */}
				{isStreaming && loadingIcon && (
					<div className="flex items-center">
						{loadingIcon}
					</div>
				)}
			</div>
		</div>
	);
};




type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>
const DEFAULT_BUTTON_SIZE = 22;
export const ButtonSubmit = ({ className, disabled, ...props }: ButtonProps & Required<Pick<ButtonProps, 'disabled'>>) => {

	return <button
		type='button'
		className={`rounded-full flex-shrink-0 flex-grow-0 flex items-center justify-center
			btn btn-icon btn-submit button-press-animation
			${disabled ? 'cursor-default' : 'cursor-pointer'}
			${className}
		`}
		disabled={disabled}
		aria-label="Send message"
		// data-tooltip-id='cortex-tooltip'
		// data-tooltip-content={'Send'}
		// data-tooltip-place='left'
		{...props}
	>
		<IconArrowUp size={DEFAULT_BUTTON_SIZE} className="stroke-[2] p-[2px]" />
	</button>
}

export const ButtonStop = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => {
	return <button
		className={`rounded-full flex-shrink-0 flex-grow-0 cursor-pointer flex items-center justify-center
			btn btn-icon btn-stop button-press-animation
			${className}
		`}
		type='button'
		aria-label="Stop generation"
		{...props}
	>
		<IconSquare size={DEFAULT_BUTTON_SIZE} className="stroke-[3] p-[7px] text-[var(--cortex-danger)]" />
	</button>
}
