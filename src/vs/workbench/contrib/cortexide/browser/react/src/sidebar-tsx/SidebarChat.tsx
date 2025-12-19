/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, {
	ButtonHTMLAttributes,
	FormEvent,
	FormHTMLAttributes,
	Fragment,
	KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	useAccessor,
	useChatThreadsState,
	useChatThreadsStreamState,
	useSettingsState,
	useActiveURI,
	useCommandBarState,
	useFullChatThreadsStreamState,
} from "../util/services.js";
import { ScrollType } from "../../../../../../../editor/common/editorCommon.js";

import {
	ChatMarkdownRender,
	ChatMessageLocation,
	getApplyBoxId,
} from "../markdown/ChatMarkdownRender.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { IDisposable } from "../../../../../../../base/common/lifecycle.js";
import { ErrorDisplay } from "./ErrorDisplay.js";
import {
	BlockCode,
	TextAreaFns,
	VoidCustomDropdownBox,
	VoidInputBox2,
	VoidSlider,
	VoidSwitch,
	VoidDiffEditor,
} from "../util/inputs.js";
import { ModelDropdown } from "../void-settings-tsx/ModelDropdown.js";
import { PastThreadsList } from "./SidebarThreadSelector.js";
import { CORTEXIDE_CTRL_L_ACTION_ID } from "../../../actionIDs.js";
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from "../../../cortexideSettingsPane.js";
import {
	ChatMode,
	displayInfoOfProviderName,
	FeatureName,
	isFeatureNameDisabled,
	isValidProviderModelSelection,
} from "../../../../../../../workbench/contrib/cortexide/common/cortexideSettingsTypes.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { WarningBox } from "../void-settings-tsx/WarningBox.js";
import {
	getModelCapabilities,
	getIsReasoningEnabledState,
	getReservedOutputTokenSpace,
} from "../../../../common/modelCapabilities.js";
import {
	AlertTriangle,
	File,
	Ban,
	Check,
	ChevronRight,
	Dot,
	FileIcon,
	Pencil,
	Undo,
	Undo2,
	X,
	Flag,
	Copy as CopyIcon,
	Info,
	CirclePlus,
	Ellipsis,
	CircleEllipsis,
	Folder,
	ALargeSmall,
	TypeOutline,
	Text,
	Image as ImageIcon,
	FileText,
	Plus,
} from "lucide-react";
import {
	ChatMessage,
	CheckpointEntry,
	StagingSelectionItem,
	ToolMessage,
	PlanMessage,
	ReviewMessage,
	PlanStep,
	StepStatus,
	PlanApprovalState,
} from "../../../../common/chatThreadServiceTypes.js";
import {
	approvalTypeOfBuiltinToolName,
	BuiltinToolCallParams,
	BuiltinToolName,
	ToolName,
	LintErrorItem,
	ToolApprovalType,
	toolApprovalTypes,
} from "../../../../common/toolsServiceTypes.js";
import {
	CopyButton,
	EditToolAcceptRejectButtonsHTML,
	IconShell1,
	JumpToFileButton,
	JumpToTerminalButton,
	StatusIndicator,
	StatusIndicatorForApplyButton,
	useApplyStreamState,
	useEditToolStreamState,
} from "../markdown/ApplyBlockHoverButtons.js";
import { IsRunningType } from "../../../chatThreadService.js";
import {
	acceptAllBg,
	acceptBorder,
	buttonFontSize,
	buttonTextColor,
	rejectAllBg,
	rejectBg,
	rejectBorder,
} from "../../../../common/helpers/colors.js";
import {
	builtinToolNames,
	isABuiltinToolName,
	MAX_FILE_CHARS_PAGE,
	MAX_TERMINAL_INACTIVE_TIME,
} from "../../../../common/prompt/prompts.js";
import { RawToolCallObj } from "../../../../common/sendLLMMessageTypes.js";
import ErrorBoundary from "./ErrorBoundary.js";
import { ToolApprovalTypeSwitch } from "../void-settings-tsx/Settings.js";

import { persistentTerminalNameOfId } from "../../../terminalToolService.js";
import { removeMCPToolNamePrefix } from "../../../../common/mcpServiceTypes.js";
import { useImageAttachments } from "../util/useImageAttachments.js";
import { usePDFAttachments } from "../util/usePDFAttachments.js";
import { PDFAttachmentList } from "../util/PDFAttachmentList.js";
import { ImageAttachmentList } from "../util/ImageAttachmentList.js";
import {
	ChatImageAttachment,
	ChatPDFAttachment,
} from "../../../../common/chatThreadServiceTypes.js";
import { ImageMessageRenderer } from "../util/ImageMessageRenderer.js";
import { PDFMessageRenderer } from "../util/PDFMessageRenderer.js";

export const IconX = ({
	size,
	className = "",
	...props
}: { size: number; className?: string } & React.SVGProps<SVGSVGElement>) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			className={className}
			{...props}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M6 18 18 6M6 6l12 12"
			/>
		</svg>
	);
};

const IconArrowUp = ({
	size,
	className = "",
}: {
	size: number;
	className?: string;
}) => {
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

const IconSquare = ({
	size,
	className = "",
}: {
	size: number;
	className?: string;
}) => {
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

export const IconWarning = ({
	size,
	className = "",
}: {
	size: number;
	className?: string;
}) => {
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

// Spinner component with smooth CSS animation
const Spinner = ({ className = "", size = 14 }: { className?: string; size?: number }) => {
	return (
		<svg
			className={`animate-spin ${className}`}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<circle
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeDasharray="31.416"
				strokeDashoffset="31.416"
				opacity="0.25"
			/>
			<circle
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeDasharray="31.416"
				strokeDashoffset="23.562"
				opacity="0.75"
			/>
		</svg>
	);
};

// Pulsing dots animation for a softer loading indicator
const PulsingDots = ({ className = "" }: { className?: string }) => {
	return (
		<div className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
			<span className="w-1 h-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "0ms" }} />
			<span className="w-1 h-1 rounded-full bg-current opacity-60 animate-pulse" style={{ animationDelay: "150ms" }} />
			<span className="w-1 h-1 rounded-full bg-current opacity-80 animate-pulse" style={{ animationDelay: "300ms" }} />
		</div>
	);
};

export const IconLoading = ({
	className = "",
	showTokenCount,
	showSpinner = false,
	size = 14,
}: {
	className?: string;
	showTokenCount?: number;
	showSpinner?: boolean;
	size?: number;
}) => {
	const [dots, setDots] = useState(1);

	useEffect(() => {
		// Optimized: Use requestAnimationFrame for smoother animation, update every 400ms
		let frameId: number;
		let lastUpdate = Date.now();

		const animate = () => {
			const now = Date.now();
			if (now - lastUpdate >= 400) {
				setDots((prev) => (prev >= 3 ? 1 : prev + 1));
				lastUpdate = now;
			}
			frameId = requestAnimationFrame(animate);
		};

		frameId = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(frameId);
	}, []);

	const dotsText = ".".repeat(dots);
	const tokenText =
		showTokenCount !== undefined ? ` (${showTokenCount} tokens)` : "";

	return (
		<div className={`${className} inline-flex items-center gap-1.5`}>
			{showSpinner ? (
				<Spinner className="text-current" size={size} />
			) : (
				<PulsingDots className="opacity-70" />
			)}
			{tokenText && (
				<span className="opacity-70 text-[11px]">{tokenText}</span>
			)}
		</div>
	);
};

// SLIDER ONLY:
const ReasoningOptionSlider = ({
	featureName,
}: {
	featureName: FeatureName;
}) => {
	const accessor = useAccessor();

	const cortexideSettingsService = accessor.get("ICortexideSettingsService");
	const voidSettingsState = useSettingsState();

	const modelSelection = voidSettingsState.modelSelectionOfFeature[featureName];
	const overridesOfModel = voidSettingsState.overridesOfModel;

	if (!modelSelection) return null;

	// Skip "auto" - it's not a real provider
	if (!isValidProviderModelSelection(modelSelection)) {
		return null;
	}

	const { modelName, providerName } = modelSelection;
	const { reasoningCapabilities } = getModelCapabilities(
		providerName,
		modelName,
		overridesOfModel,
	);
	const { canTurnOffReasoning, reasoningSlider: reasoningBudgetSlider } =
		reasoningCapabilities || {};

	const modelSelectionOptions =
		voidSettingsState.optionsOfModelSelection[featureName][providerName]?.[
			modelName
		];
	const isReasoningEnabled = getIsReasoningEnabledState(
		featureName,
		providerName,
		modelName,
		modelSelectionOptions,
		overridesOfModel,
	);

	if (canTurnOffReasoning && !reasoningBudgetSlider) {
		// if it's just a on/off toggle without a power slider
		return (
			<div className="flex items-center gap-x-2">
				<span className="text-void-fg-3 text-xs pointer-events-none inline-block w-10 pr-1">
					Thinking
				</span>
				<VoidSwitch
					size="xxs"
					value={isReasoningEnabled}
					onChange={(newVal) => {
						const isOff = canTurnOffReasoning && !newVal;
						cortexideSettingsService.setOptionsOfModelSelection(
							featureName,
							modelSelection.providerName,
							modelSelection.modelName,
							{ reasoningEnabled: !isOff },
						);
					}}
				/>
			</div>
		);
	}

	if (reasoningBudgetSlider?.type === "budget_slider") {
		// if it's a slider
		const { min: min_, max, default: defaultVal } = reasoningBudgetSlider;

		const nSteps = 8; // only used in calculating stepSize, stepSize is what actually matters
		const stepSize = Math.round((max - min_) / nSteps);

		const valueIfOff = min_ - stepSize;
		const min = canTurnOffReasoning ? valueIfOff : min_;
		const value = isReasoningEnabled
			? (voidSettingsState.optionsOfModelSelection[featureName][
					modelSelection.providerName
				]?.[modelSelection.modelName]?.reasoningBudget ?? defaultVal)
			: valueIfOff;

		return (
			<div className="flex items-center gap-x-2">
				<span className="text-void-fg-3 text-xs pointer-events-none inline-block w-10 pr-1">
					Thinking
				</span>
				<VoidSlider
					width={50}
					size="xs"
					min={min}
					max={max}
					step={stepSize}
					value={value}
					onChange={(newVal) => {
						if (
							modelSelection.providerName === "auto" &&
							modelSelection.modelName === "auto"
						)
							return;
						const isOff = canTurnOffReasoning && newVal === valueIfOff;
						cortexideSettingsService.setOptionsOfModelSelection(
							featureName,
							modelSelection.providerName,
							modelSelection.modelName,
							{ reasoningEnabled: !isOff, reasoningBudget: newVal },
						);
					}}
				/>
				<span className="text-void-fg-3 text-xs pointer-events-none">
					{isReasoningEnabled ? `${value} tokens` : "Thinking disabled"}
				</span>
			</div>
		);
	}

	if (reasoningBudgetSlider?.type === "effort_slider") {
		const { values, default: defaultVal } = reasoningBudgetSlider;

		const min = canTurnOffReasoning ? -1 : 0;
		const max = values.length - 1;

		const currentEffort =
			voidSettingsState.optionsOfModelSelection[featureName][
				modelSelection.providerName
			]?.[modelSelection.modelName]?.reasoningEffort ?? defaultVal;
		const valueIfOff = -1;
		const value =
			isReasoningEnabled && currentEffort
				? values.indexOf(currentEffort)
				: valueIfOff;

		const currentEffortCapitalized =
			currentEffort.charAt(0).toUpperCase() + currentEffort.slice(1, Infinity);

		return (
			<div className="flex items-center gap-x-2">
				<span className="text-void-fg-3 text-xs pointer-events-none inline-block w-10 pr-1">
					Thinking
				</span>
				<VoidSlider
					width={30}
					size="xs"
					min={min}
					max={max}
					step={1}
					value={value}
					onChange={(newVal) => {
						if (
							modelSelection.providerName === "auto" &&
							modelSelection.modelName === "auto"
						)
							return;
						const isOff = canTurnOffReasoning && newVal === valueIfOff;
						cortexideSettingsService.setOptionsOfModelSelection(
							featureName,
							modelSelection.providerName,
							modelSelection.modelName,
							{
								reasoningEnabled: !isOff,
								reasoningEffort: values[newVal] ?? undefined,
							},
						);
					}}
				/>
				<span className="text-void-fg-3 text-xs pointer-events-none">
					{isReasoningEnabled
						? `${currentEffortCapitalized}`
						: "Thinking disabled"}
				</span>
			</div>
		);
	}

	return null;
};

const nameOfChatMode = {
	normal: "Chat",
	gather: "Gather",
	agent: "Agent",
};

const detailOfChatMode = {
	normal: "Normal chat",
	gather: "Reads files, but can't edit",
	agent: "Edits files and uses tools",
};

const ChatModeDropdown = ({ className }: { className: string }) => {
	const accessor = useAccessor();

	const cortexideSettingsService = accessor.get("ICortexideSettingsService");
	const settingsState = useSettingsState();

	const options: ChatMode[] = useMemo(() => ["normal", "gather", "agent"], []);

	const onChangeOption = useCallback(
		(newVal: ChatMode) => {
			cortexideSettingsService.setGlobalSetting("chatMode", newVal);
		},
		[cortexideSettingsService],
	);

	return (
		<VoidCustomDropdownBox
			className={className}
			options={options}
			selectedOption={settingsState.globalSettings.chatMode}
			onChangeOption={onChangeOption}
			getOptionDisplayName={(val) => nameOfChatMode[val]}
			getOptionDropdownName={(val) => nameOfChatMode[val]}
			getOptionDropdownDetail={(val) => detailOfChatMode[val]}
			getOptionsEqual={(a, b) => a === b}
		/>
	);
};

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

	selections?: StagingSelectionItem[];
	setSelections?: (s: StagingSelectionItem[]) => void;
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
	className = "",
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

	// Handle paste
	React.useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			const items = Array.from(e.clipboardData?.items || []);
			const imageFiles: File[] = [];
			const pdfFiles: File[] = [];

			for (const item of items) {
				if (item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) {
						imageFiles.push(file);
					}
				} else if (item.type === "application/pdf") {
					const file = item.getAsFile();
					if (file) {
						pdfFiles.push(file);
					}
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

		const container = containerRef.current || divRef?.current;
		if (container) {
			container.addEventListener("paste", handlePaste);
			return () => {
				container.removeEventListener("paste", handlePaste);
			};
		}
	}, [divRef, onImagePaste]);

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

		const hasFiles = Array.from(e.dataTransfer.items).some(
			(item) =>
				item.type.startsWith("image/") || item.type === "application/pdf",
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

		const imageFiles = Array.from(e.dataTransfer.files).filter((file) =>
			file.type.startsWith("image/"),
		);
		const pdfFiles = Array.from(e.dataTransfer.files).filter(
			(file) => file.type === "application/pdf",
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
		const files = Array.from(e.target.files || []).filter((file) =>
			file.type.startsWith("image/"),
		);
		if (files.length > 0 && onImageDrop) {
			onImageDrop(files);
		}
		e.target.value = ""; // Reset input
	};

	const handlePDFInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []).filter(
			(file) => file.type === "application/pdf",
		);
		if (files.length > 0 && onPDFDrop) {
			onPDFDrop(files);
		}
		e.target.value = ""; // Reset input
	};

	return (
		<div
			ref={(node) => {
				if (divRef) {
					if (typeof divRef === "function") {
						divRef(node);
					} else {
						divRef.current = node;
					}
				}
				containerRef.current = node;
			}}
			className={`
				gap-x-1
				flex flex-col p-2.5 relative input text-left shrink-0
				rounded-2xl
				bg-void-bg-1
				transition-all duration-200
				border border-void-border-3 focus-within:border-void-border-2 hover:border-void-border-2
				${isDragOver ? "border-void-link-color bg-void-link-color/10" : ""}
				max-h-[80vh] overflow-y-auto
				${className}
			`}
			onClick={(e) => {
				onClickAnywhere?.();
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
					type="staging"
					selections={selections}
					setSelections={setSelections}
					showProspectiveSelections={showProspectiveSelections}
				/>
			)}

			{/* Input section - Modern Cursor-style layout */}
			<div className="relative w-full flex items-end gap-2">
				<div className="flex-1 min-w-0">{children}</div>

				{/* Right-side icon bar - Cursor style */}
				<div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
					{/* Image upload button */}
					<button
						type="button"
						onClick={handleImageUploadClick}
						className="flex-shrink-0 p-1.5 rounded hover:bg-void-bg-2-alt text-void-fg-4 hover:text-void-fg-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						aria-label="Upload images"
						title="Upload images (or paste/drag & drop)"
					>
						<ImageIcon size={16} />
					</button>

					{/* PDF upload button */}
					<button
						type="button"
						onClick={handlePDFUploadClick}
						className="flex-shrink-0 p-1.5 rounded hover:bg-void-bg-2-alt text-void-fg-4 hover:text-void-fg-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						aria-label="Upload PDFs"
						title="Upload PDFs (or paste/drag & drop)"
					>
						<FileText size={16} />
					</button>

					{/* Submit button */}
					{isStreaming ? (
						<ButtonStop onClick={onAbort} />
					) : (
						<ButtonSubmit onClick={onSubmit} disabled={isDisabled} />
					)}
				</div>

				{/* Close button (X) if onClose is provided */}
				{onClose && (
					<div className="absolute -top-1 -right-1 cursor-pointer z-1">
						<IconX
							size={12}
							className="stroke-[2] opacity-80 text-void-fg-3 hover:brightness-95"
							onClick={onClose}
						/>
					</div>
				)}
			</div>

			{/* Bottom row - Model selector and settings */}
			<div className="flex flex-row justify-between items-center gap-2 mt-1 pt-1 border-t border-void-border-3/50">
				{showModelDropdown && (
					<div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-nowrap flex-1 min-w-0">
						{featureName === "Chat" && (
							<ChatModeDropdown className="text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-2 rounded py-0.5 px-1.5" />
						)}
						<ModelDropdown
							featureName={featureName}
							className="text-xs text-void-fg-3 bg-void-bg-1 rounded"
						/>
						<ReasoningOptionSlider featureName={featureName} />
					</div>
				)}

				{/* Loading indicator */}
				{isStreaming && loadingIcon && (
					<div className="flex items-center">{loadingIcon}</div>
				)}
			</div>
		</div>
	);
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
const DEFAULT_BUTTON_SIZE = 22;
export const ButtonSubmit = ({
	className,
	disabled,
	...props
}: ButtonProps & Required<Pick<ButtonProps, "disabled">>) => {
	return (
		<button
			type="button"
			className={`rounded-full flex-shrink-0 flex-grow-0 flex items-center justify-center
			${disabled ? "bg-vscode-disabled-fg cursor-default" : "bg-white cursor-pointer"}
			${className}
		`}
			// data-tooltip-id='void-tooltip'
			// data-tooltip-content={'Send'}
			// data-tooltip-place='left'
			{...props}
		>
			<IconArrowUp size={DEFAULT_BUTTON_SIZE} className="stroke-[2] p-[2px]" />
		</button>
	);
};

export const ButtonStop = ({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => {
	return (
		<button
			className={`rounded-full flex-shrink-0 flex-grow-0 cursor-pointer flex items-center justify-center
			bg-white
			${className}
		`}
			type="button"
			{...props}
		>
			<IconSquare size={DEFAULT_BUTTON_SIZE} className="stroke-[3] p-[7px]" />
		</button>
	);
};

const scrollToBottom = (divRef: { current: HTMLElement | null }) => {
	if (divRef.current) {
		divRef.current.scrollTop = divRef.current.scrollHeight;
	}
};

const ScrollToBottomContainer = ({
	children,
	className,
	style,
	scrollContainerRef,
}: {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
}) => {
	const [isAtBottom, setIsAtBottom] = useState(true); // Start at bottom

	const divRef = scrollContainerRef;

	const onScroll = () => {
		const div = divRef.current;
		if (!div) return;

		const isBottom =
			Math.abs(div.scrollHeight - div.clientHeight - div.scrollTop) < 4;

		setIsAtBottom(isBottom);
	};

	// When children change (new messages added)
	useEffect(() => {
		if (isAtBottom) {
			scrollToBottom(divRef);
		}
	}, [children, isAtBottom]); // Dependency on children to detect new messages

	// Initial scroll to bottom
	useEffect(() => {
		scrollToBottom(divRef);
	}, []);

	return (
		<div ref={divRef} onScroll={onScroll} className={className} style={style}>
			{children}
		</div>
	);
};

export const getRelative = (
	uri: URI,
	accessor: ReturnType<typeof useAccessor>,
) => {
	const workspaceContextService = accessor.get("IWorkspaceContextService");
	let path: string;
	const isInside = workspaceContextService.isInsideWorkspace(uri);
	if (isInside) {
		const f = workspaceContextService
			.getWorkspace()
			.folders.find((f) => uri.fsPath?.startsWith(f.uri.fsPath));
		if (f) {
			path = uri.fsPath.replace(f.uri.fsPath, "");
		} else {
			path = uri.fsPath;
		}
	} else {
		path = uri.fsPath;
	}
	return path || undefined;
};

export const getFolderName = (pathStr: string) => {
	// 'unixify' path
	pathStr = pathStr.replace(/[/\\]+/g, "/"); // replace any / or \ or \\ with /
	const parts = pathStr.split("/"); // split on /
	// Filter out empty parts (the last element will be empty if path ends with /)
	const nonEmptyParts = parts.filter((part) => part.length > 0);
	if (nonEmptyParts.length === 0) return "/"; // Root directory
	if (nonEmptyParts.length === 1) return nonEmptyParts[0] + "/"; // Only one folder
	// Get the last two parts
	const lastTwo = nonEmptyParts.slice(-2);
	return lastTwo.join("/") + "/";
};

export const getBasename = (pathStr: string, parts: number = 1) => {
	// 'unixify' path
	pathStr = pathStr.replace(/[/\\]+/g, "/"); // replace any / or \ or \\ with /
	const allParts = pathStr.split("/"); // split on /
	if (allParts.length === 0) return pathStr;
	return allParts.slice(-parts).join("/");
};

// Open file utility function
export const voidOpenFileFn = (
	uri: URI,
	accessor: ReturnType<typeof useAccessor>,
	range?: [number, number],
) => {
	const commandService = accessor.get("ICommandService");
	const editorService = accessor.get("ICodeEditorService");

	// Get editor selection from CodeSelection range
	let editorSelection = undefined;

	// If we have a selection, create an editor selection from the range
	if (range) {
		editorSelection = {
			startLineNumber: range[0],
			startColumn: 1,
			endLineNumber: range[1],
			endColumn: Number.MAX_SAFE_INTEGER,
		};
	}

	// open the file
	commandService.executeCommand("vscode.open", uri).then(() => {
		// select the text
		setTimeout(() => {
			if (!editorSelection) return;

			const editor = editorService.getActiveCodeEditor();
			if (!editor) return;

			editor.setSelection(editorSelection);
			editor.revealRange(editorSelection, ScrollType.Immediate);
		}, 50); // needed when document was just opened and needs to initialize
	});
};

export const SelectedFiles = ({
	type,
	selections,
	setSelections,
	showProspectiveSelections,
	messageIdx,
}:
	| {
			type: "past";
			selections: StagingSelectionItem[];
			setSelections?: undefined;
			showProspectiveSelections?: undefined;
			messageIdx: number;
		}
	| {
			type: "staging";
			selections: StagingSelectionItem[];
			setSelections: (newSelections: StagingSelectionItem[]) => void;
			showProspectiveSelections?: boolean;
			messageIdx?: number;
		}) => {
	const accessor = useAccessor();
	const commandService = accessor.get("ICommandService");
	const modelReferenceService = accessor.get("ICortexideModelService");

	// state for tracking prospective files
	const { uri: currentURI } = useActiveURI();
	const [recentUris, setRecentUris] = useState<URI[]>([]);
	const maxRecentUris = 10;
	const maxProspectiveFiles = 3;
	useEffect(() => {
		// handle recent files
		if (!currentURI) return;
		setRecentUris((prev) => {
			const withoutCurrent = prev.filter(
				(uri) => uri.fsPath !== currentURI.fsPath,
			); // remove duplicates
			const withCurrent = [currentURI, ...withoutCurrent];
			return withCurrent.slice(0, maxRecentUris);
		});
	}, [currentURI]);
	const [prospectiveSelections, setProspectiveSelections] = useState<
		StagingSelectionItem[]
	>([]);

	// handle prospective files
	useEffect(() => {
		const computeRecents = async () => {
			const prospectiveURIs = recentUris
				.filter(
					(uri) =>
						!selections.find(
							(s) => s.type === "File" && s.uri.fsPath === uri.fsPath,
						),
				)
				.slice(0, maxProspectiveFiles);

			const answer: StagingSelectionItem[] = [];
			for (const uri of prospectiveURIs) {
				answer.push({
					type: "File",
					uri: uri,
					language:
						(
							await modelReferenceService.getModelSafe(uri)
						).model?.getLanguageId() || "plaintext",
					state: { wasAddedAsCurrentFile: false },
				});
			}
			return answer;
		};

		// add a prospective file if type === 'staging' and if the user is in a file, and if the file is not selected yet
		if (type === "staging" && showProspectiveSelections) {
			computeRecents().then((a) => setProspectiveSelections(a));
		} else {
			setProspectiveSelections([]);
		}
	}, [recentUris, selections, type, showProspectiveSelections]);

	const allSelections = [...selections, ...prospectiveSelections];

	if (allSelections.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center flex-wrap text-left relative gap-x-0.5 gap-y-1 pb-0.5">
			{allSelections.map((selection, i) => {
				const isThisSelectionProspective = i > selections.length - 1;

				const thisKey =
					selection.type === "CodeSelection"
						? selection.type +
							selection.language +
							selection.range +
							selection.state.wasAddedAsCurrentFile +
							selection.uri.fsPath
						: selection.type === "File"
							? selection.type +
								selection.language +
								selection.state.wasAddedAsCurrentFile +
								selection.uri.fsPath
							: selection.type === "Folder"
								? selection.type +
									selection.language +
									selection.state +
									selection.uri.fsPath
								: i;

				const SelectionIcon =
					selection.type === "File"
						? File
						: selection.type === "Folder"
							? Folder
							: selection.type === "CodeSelection"
								? Text
								: (undefined as never);

				return (
					<div // container for summarybox and code
						key={thisKey}
						className={`flex flex-col space-y-[1px]`}
					>
						{/* tooltip for file path */}
						<span
							className="truncate overflow-hidden text-ellipsis"
							data-tooltip-id="void-tooltip"
							data-tooltip-content={getRelative(selection.uri, accessor)}
							data-tooltip-place="top"
							data-tooltip-delay-show={3000}
						>
							{/* summarybox */}
							<div
								className={`
								flex items-center gap-1 relative
								px-1
								w-fit h-fit
								select-none
								text-xs text-nowrap
								border rounded-md
								${isThisSelectionProspective ? "bg-void-bg-1 text-void-fg-3 opacity-80" : "bg-void-bg-1 hover:brightness-95 text-void-fg-1"}
								${isThisSelectionProspective ? "border-void-border-2" : "border-void-border-1"}
								hover:border-void-border-1
								transition-all duration-150
							`}
								onClick={() => {
									if (type !== "staging") return; // (never)
									if (isThisSelectionProspective) {
										// add prospective selection to selections
										setSelections([...selections, selection]);
									} else if (selection.type === "File") {
										// open files
										voidOpenFileFn(selection.uri, accessor);

										const wasAddedAsCurrentFile =
											selection.state.wasAddedAsCurrentFile;
										if (wasAddedAsCurrentFile) {
											// make it so the file is added permanently, not just as the current file
											const newSelection: StagingSelectionItem = {
												...selection,
												state: {
													...selection.state,
													wasAddedAsCurrentFile: false,
												},
											};
											setSelections([
												...selections.slice(0, i),
												newSelection,
												...selections.slice(i + 1),
											]);
										}
									} else if (selection.type === "CodeSelection") {
										voidOpenFileFn(selection.uri, accessor, selection.range);
									} else if (selection.type === "Folder") {
										// TODO!!! reveal in tree
									}
								}}
							>
								{<SelectionIcon size={10} />}

								{
									// file name and range
									getBasename(selection.uri.fsPath) +
										(selection.type === "CodeSelection"
											? ` (${selection.range[0]}-${selection.range[1]})`
											: "")
								}

								{selection.type === "File" &&
								selection.state.wasAddedAsCurrentFile &&
								messageIdx === undefined &&
								currentURI?.fsPath === selection.uri.fsPath ? (
									<span
										className={`text-[8px] 'void-opacity-60 text-void-fg-4`}
									>
										{`(Current File)`}
									</span>
								) : null}

								{type === "staging" && !isThisSelectionProspective ? ( // X button
									<div // box for making it easier to click
										className="cursor-pointer z-1 self-stretch flex items-center justify-center"
										onClick={(e) => {
											e.stopPropagation(); // don't open/close selection
											if (type !== "staging") return;
											setSelections([
												...selections.slice(0, i),
												...selections.slice(i + 1),
											]);
										}}
									>
										<IconX className="stroke-[2]" size={10} />
									</div>
								) : (
									<></>
								)}
							</div>
						</span>
					</div>
				);
			})}
		</div>
	);
};

type ToolHeaderParams = {
	icon?: React.ReactNode;
	title: React.ReactNode;
	desc1: React.ReactNode;
	desc1OnClick?: () => void;
	desc2?: React.ReactNode;
	isError?: boolean;
	info?: string;
	desc1Info?: string;
	isRejected?: boolean;
	numResults?: number;
	hasNextPage?: boolean;
	children?: React.ReactNode;
	bottomChildren?: React.ReactNode;
	onClick?: () => void;
	desc2OnClick?: () => void;
	isOpen?: boolean;
	className?: string;
};

const ToolHeaderWrapper = ({
	icon,
	title,
	desc1,
	desc1OnClick,
	desc1Info,
	desc2,
	numResults,
	hasNextPage,
	children,
	info,
	bottomChildren,
	isError,
	onClick,
	desc2OnClick,
	isOpen,
	isRejected,
	className, // applies to the main content
}: ToolHeaderParams) => {
	const [isOpen_, setIsOpen] = useState(false);
	const isExpanded = isOpen !== undefined ? isOpen : isOpen_;

	const isDropdown = children !== undefined; // null ALLOWS dropdown
	const isClickable = !!(isDropdown || onClick);

	const isDesc1Clickable = !!desc1OnClick;

	const desc1HTML = (
		<span
			className={`text-void-fg-4 text-xs italic truncate ml-2
			${isDesc1Clickable ? "cursor-pointer hover:brightness-125 transition-all duration-150" : ""}
		`}
			onClick={desc1OnClick}
			{...(desc1Info
				? {
						"data-tooltip-id": "void-tooltip",
						"data-tooltip-content": desc1Info,
						"data-tooltip-place": "top",
						"data-tooltip-delay-show": 1000,
					}
				: {})}
		>
			{desc1}
		</span>
	);

	return (
		<div className="">
			<div
				className={`w-full border border-void-border-3 rounded px-2 py-1 bg-void-bg-3 overflow-hidden ${className}`}
			>
				{/* header */}
				<div className={`select-none flex items-center min-h-[24px]`}>
					<div
						className={`flex items-center w-full gap-x-2 overflow-hidden justify-between ${isRejected ? "line-through" : ""}`}
					>
						{/* left */}
						<div // container for if desc1 is clickable
							className="ml-1 flex items-center overflow-hidden"
						>
							{/* title eg "> Edited File" */}
							<div
								className={`
							flex items-center min-w-0 overflow-hidden grow
							${isClickable ? "cursor-pointer hover:brightness-125 transition-all duration-150" : ""}
						`}
								onClick={() => {
									if (isDropdown) {
										setIsOpen((v) => !v);
									}
									if (onClick) {
										onClick();
									}
								}}
							>
								{isDropdown && (
									<ChevronRight
										className={`
								text-void-fg-3 mr-0.5 h-4 w-4 flex-shrink-0 transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)]
								${isExpanded ? "rotate-90" : ""}
							`}
									/>
								)}
								<span className="text-void-fg-3 flex-shrink-0">{title}</span>

								{!isDesc1Clickable && desc1HTML}
							</div>
							{isDesc1Clickable && desc1HTML}
						</div>

						{/* right */}
						<div className="flex items-center gap-x-2 flex-shrink-0">
							{info && (
								<CircleEllipsis
									className="ml-2 text-void-fg-4 opacity-60 flex-shrink-0"
									size={14}
									data-tooltip-id="void-tooltip"
									data-tooltip-content={info}
									data-tooltip-place="top-end"
								/>
							)}

							{isError && (
								<AlertTriangle
									className="text-void-warning opacity-90 flex-shrink-0"
									size={14}
									data-tooltip-id="void-tooltip"
									data-tooltip-content={"Error running tool"}
									data-tooltip-place="top"
								/>
							)}
							{isRejected && (
								<Ban
									className="text-void-fg-4 opacity-90 flex-shrink-0"
									size={14}
									data-tooltip-id="void-tooltip"
									data-tooltip-content={"Canceled"}
									data-tooltip-place="top"
								/>
							)}
							{desc2 && (
								<span className="text-void-fg-4 text-xs" onClick={desc2OnClick}>
									{desc2}
								</span>
							)}
							{numResults !== undefined && (
								<span className="text-void-fg-4 text-xs ml-auto mr-1">
									{`${numResults}${hasNextPage ? "+" : ""} result${numResults !== 1 ? "s" : ""}`}
								</span>
							)}
						</div>
					</div>
				</div>
				{/* children */}
				{
					<div
						className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? "opacity-100 py-1" : "max-h-0 opacity-0"}
						text-void-fg-4 rounded-md overflow-x-auto
					`}
						//    bg-black bg-opacity-10 border border-void-border-4 border-opacity-50
					>
						{children}
					</div>
				}
			</div>
			{bottomChildren}
		</div>
	);
};

const EditTool = ({
	toolMessage,
	threadId,
	messageIdx,
	content,
}: Parameters<ResultWrapper<"edit_file" | "rewrite_file">>[0] & {
	content: string;
}) => {
	const accessor = useAccessor();
	const isError = false;
	const isRejected = toolMessage.type === "rejected";

	const title = getTitle(toolMessage);

	const { desc1, desc1Info } = toolNameToDesc(
		toolMessage.name,
		toolMessage.params,
		accessor,
	);
	const icon = null;

	const { rawParams, params, name } = toolMessage;
	const desc1OnClick = () => voidOpenFileFn(params.uri, accessor);
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		desc1OnClick,
		desc1Info,
		isError,
		icon,
		isRejected,
	};

	const editToolType = toolMessage.name === "edit_file" ? "diff" : "rewrite";
	if (
		toolMessage.type === "running_now" ||
		toolMessage.type === "tool_request"
	) {
		componentParams.children = (
			<ToolChildrenWrapper className="bg-void-bg-3">
				<EditToolChildren uri={params.uri} code={content} type={editToolType} />
			</ToolChildrenWrapper>
		);
		// JumpToFileButton removed in favor of FileLinkText
	} else if (
		toolMessage.type === "success" ||
		toolMessage.type === "rejected" ||
		toolMessage.type === "tool_error"
	) {
		// add apply box
		const applyBoxId = getApplyBoxId({
			threadId: threadId,
			messageIdx: messageIdx,
			tokenIdx: "N/A",
		});
		componentParams.desc2 = (
			<EditToolHeaderButtons
				applyBoxId={applyBoxId}
				uri={params.uri}
				codeStr={content}
				toolName={name}
				threadId={threadId}
			/>
		);

		// add children
		componentParams.children = (
			<ToolChildrenWrapper className="bg-void-bg-3">
				<EditToolChildren uri={params.uri} code={content} type={editToolType} />
			</ToolChildrenWrapper>
		);

		if (toolMessage.type === "success" || toolMessage.type === "rejected") {
			const { result } = toolMessage;
			componentParams.bottomChildren = (
				<BottomChildren title="Lint errors">
					{result?.lintErrors?.map((error, i) => (
						<div key={i} className="whitespace-nowrap">
							Lines {error.startLineNumber}-{error.endLineNumber}:{" "}
							{error.message}
						</div>
					))}
				</BottomChildren>
			);
		} else if (toolMessage.type === "tool_error") {
			// error
			const { result } = toolMessage;
			componentParams.bottomChildren = (
				<BottomChildren title="Error">
					<CodeChildren>{result}</CodeChildren>
				</BottomChildren>
			);
		}
	}

	return <ToolHeaderWrapper {...componentParams} />;
};

const SimplifiedToolHeader = ({
	title,
	children,
}: {
	title: string;
	children?: React.ReactNode;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const isDropdown = children !== undefined;
	return (
		<div>
			<div className="w-full">
				{/* header */}
				<div
					className={`select-none flex items-center min-h-[24px] ${isDropdown ? "cursor-pointer" : ""}`}
					onClick={() => {
						if (isDropdown) {
							setIsOpen((v) => !v);
						}
					}}
				>
					{isDropdown && (
						<ChevronRight
							className={`text-void-fg-3 mr-0.5 h-4 w-4 flex-shrink-0 transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? "rotate-90" : ""}`}
						/>
					)}
					<div className="flex items-center w-full overflow-hidden">
						<span className="text-void-fg-3">{title}</span>
					</div>
				</div>
				{/* children */}
				{
					<div
						className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? "opacity-100" : "max-h-0 opacity-0"} text-void-fg-4`}
					>
						{children}
					</div>
				}
			</div>
		</div>
	);
};

const UserMessageComponent = ({
	chatMessage,
	messageIdx,
	isCheckpointGhost,
	currCheckpointIdx,
	_scrollToBottom,
}: {
	chatMessage: ChatMessage & { role: "user" };
	messageIdx: number;
	currCheckpointIdx: number | undefined;
	isCheckpointGhost: boolean;
	_scrollToBottom: (() => void) | null;
}) => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get("IChatThreadService");

	// Subscribe to thread state changes properly
	const chatThreadsState = useChatThreadsState();
	const currentThreadId = chatThreadsState.currentThreadId;

	// global state
	let isBeingEdited = false;
	let stagingSelections: StagingSelectionItem[] = [];
	let setIsBeingEdited = (_: boolean) => {};
	let setStagingSelections = (_: StagingSelectionItem[]) => {};

	if (messageIdx !== undefined) {
		const _state = chatThreadsService.getCurrentMessageState(messageIdx);
		isBeingEdited = _state.isBeingEdited;
		stagingSelections = _state.stagingSelections;
		setIsBeingEdited = (v) =>
			chatThreadsService.setCurrentMessageState(messageIdx, {
				isBeingEdited: v,
			});
		setStagingSelections = (s) =>
			chatThreadsService.setCurrentMessageState(messageIdx, {
				stagingSelections: s,
			});
	}

	// local state
	const mode: ChatBubbleMode = isBeingEdited ? "edit" : "display";
	const [isFocused, setIsFocused] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isDisabled, setIsDisabled] = useState(false);
	const [textAreaRefState, setTextAreaRef] =
		useState<HTMLTextAreaElement | null>(null);
	const textAreaFnsRef = useRef<TextAreaFns | null>(null);
	// initialize on first render, and when edit was just enabled
	const _mustInitialize = useRef(true);
	const _justEnabledEdit = useRef(false);
	useEffect(() => {
		const canInitialize = mode === "edit" && textAreaRefState;
		const shouldInitialize =
			_justEnabledEdit.current || _mustInitialize.current;
		if (canInitialize && shouldInitialize) {
			setStagingSelections(
				(chatMessage.selections || []).map((s) => {
					// quick hack so we dont have to do anything more
					if (s.type === "File")
						return {
							...s,
							state: { ...s.state, wasAddedAsCurrentFile: false },
						};
					else return s;
				}),
			);

			if (textAreaFnsRef.current)
				textAreaFnsRef.current.setValue(chatMessage.displayContent || "");

			textAreaRefState.focus();

			_justEnabledEdit.current = false;
			_mustInitialize.current = false;
		}
	}, [chatMessage, mode, textAreaRefState, setStagingSelections]);

	const onOpenEdit = () => {
		setIsBeingEdited(true);
		chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
		_justEnabledEdit.current = true;
	};
	const onCloseEdit = () => {
		setIsFocused(false);
		setIsHovered(false);
		setIsBeingEdited(false);
		chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);
	};

	const EditSymbol = mode === "display" ? Pencil : X;

	let chatbubbleContents: React.ReactNode;
	if (mode === "display") {
		const hasImages = chatMessage.images && chatMessage.images.length > 0;
		const hasPDFs = chatMessage.pdfs && chatMessage.pdfs.length > 0;
		const hasAttachments = hasImages || hasPDFs;

		chatbubbleContents = (
			<>
				<SelectedFiles
					type="past"
					messageIdx={messageIdx}
					selections={chatMessage.selections || []}
				/>
				{hasImages && (
					<div className="px-0.5 py-2">
						<ImageMessageRenderer images={chatMessage.images} />
					</div>
				)}
				{hasPDFs && (
					<div className="px-0.5 py-2">
						<PDFMessageRenderer pdfs={chatMessage.pdfs} />
					</div>
				)}
				{chatMessage.displayContent && (
					<span className="px-0.5">{chatMessage.displayContent}</span>
				)}
			</>
		);
	} else if (mode === "edit") {
		const onSubmit = async () => {
			if (isDisabled) return;
			if (!textAreaRefState) return;
			if (messageIdx === undefined) return;

			// cancel any streams on this thread - use subscribed state
			const threadId = currentThreadId;

			// Defensive check: verify the message is still a user message before editing
			const thread = chatThreadsState.allThreads[threadId];
			if (
				!thread ||
				!thread.messages ||
				thread.messages[messageIdx]?.role !== "user"
			) {
				console.error(
					"Error while editing message: Message is not a user message or no longer exists",
				);
				setIsBeingEdited(false);
				chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);
				return;
			}

			await chatThreadsService.abortRunning(threadId);

			// update state
			setIsBeingEdited(false);
			chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);

			// stream the edit
			const userMessage = textAreaRefState.value;
			try {
				await chatThreadsService.editUserMessageAndStreamResponse({
					userMessage,
					messageIdx,
					threadId,
				});
			} catch (e) {
				console.error("Error while editing message:", e);
			}
			await chatThreadsService.focusCurrentChat();
			requestAnimationFrame(() => _scrollToBottom?.());
		};

		const onAbort = async () => {
			// use subscribed state
			const threadId = currentThreadId;
			await chatThreadsService.abortRunning(threadId);
		};

		const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Escape") {
				onCloseEdit();
			}
			if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
				onSubmit();
			}
		};

		if (!chatMessage.content) {
			// don't show if empty and not loading (if loading, want to show).
			return null;
		}

		chatbubbleContents = (
			<VoidChatArea
				featureName="Chat"
				onSubmit={onSubmit}
				onAbort={onAbort}
				isStreaming={false}
				isDisabled={isDisabled}
				showSelections={true}
				showProspectiveSelections={false}
				selections={stagingSelections}
				setSelections={setStagingSelections}
			>
				<VoidInputBox2
					enableAtToMention
					appearance="chatDark"
					ref={setTextAreaRef}
					className="min-h-[60px] px-3 py-3 rounded-2xl"
					placeholder="Plan, @ for context, / for commands"
					onChangeText={(text) => setIsDisabled(!text)}
					onFocus={() => {
						setIsFocused(true);
						chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
					}}
					onBlur={() => {
						setIsFocused(false);
					}}
					onKeyDown={onKeyDown}
					fnsRef={textAreaFnsRef}
					multiline={true}
				/>
			</VoidChatArea>
		);
	}

	const isMsgAfterCheckpoint =
		currCheckpointIdx !== undefined && currCheckpointIdx === messageIdx - 1;

	return (
		<div
			// align chatbubble accoridng to role
			className={`
				relative ml-auto
				${
					mode === "edit"
						? "w-full max-w-full"
						: mode === "display"
							? `self-end w-fit max-w-full whitespace-pre-wrap`
							: "" // user words should be pre
				}

				${isCheckpointGhost && !isMsgAfterCheckpoint ? "opacity-50 pointer-events-none" : ""}
			`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div
				// style chatbubble according to role
				className={`
					text-left rounded-lg max-w-full
					${
						mode === "edit"
							? ""
							: mode === "display"
								? "px-3 py-2.5 flex flex-col bg-void-bg-2 border border-void-border-3 text-void-fg-1 overflow-x-auto cursor-pointer hover:bg-void-bg-2-alt hover:border-void-border-2 transition-all duration-200"
								: ""
					}
				`}
				onClick={() => {
					if (mode === "display") {
						onOpenEdit();
					}
				}}
			>
				{chatbubbleContents}
			</div>

			<div
				className="absolute -top-1 -right-1 translate-x-0 -translate-y-0 z-1"
				// data-tooltip-id='void-tooltip'
				// data-tooltip-content='Edit message'
				// data-tooltip-place='left'
			>
				<EditSymbol
					size={18}
					className={`
						cursor-pointer
						p-[2px]
						bg-void-bg-2 border border-void-border-2 rounded-md
						transition-all duration-200 ease-in-out
						hover:bg-void-bg-2-alt hover:border-void-border-1
						${isHovered || (isFocused && mode === "edit") ? "opacity-100" : "opacity-0"}
					`}
					onClick={() => {
						if (mode === "display") {
							onOpenEdit();
						} else if (mode === "edit") {
							onCloseEdit();
						}
					}}
				/>
			</div>
		</div>
	);
};

const SmallProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return (
		<div
			className="
text-void-fg-4
prose
prose-sm
break-words
max-w-none
leading-snug
text-[13px]

[&>:first-child]:!mt-0
[&>:last-child]:!mb-0

prose-h1:text-[14px]
prose-h1:my-4

prose-h2:text-[13px]
prose-h2:my-4

prose-h3:text-[13px]
prose-h3:my-3

prose-h4:text-[13px]
prose-h4:my-2

prose-p:my-2
prose-p:leading-snug
prose-hr:my-2

prose-ul:my-2
prose-ul:pl-4
prose-ul:list-outside
prose-ul:list-disc
prose-ul:leading-snug


prose-ol:my-2
prose-ol:pl-4
prose-ol:list-outside
prose-ol:list-decimal
prose-ol:leading-snug

marker:text-inherit

prose-blockquote:pl-2
prose-blockquote:my-2

prose-code:text-void-fg-3
prose-code:text-[12px]
prose-code:before:content-none
prose-code:after:content-none

prose-pre:text-[12px]
prose-pre:p-2
prose-pre:my-2

prose-table:text-[13px]
"
		>
			{children}
		</div>
	);
};

const ProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return (
		<div
			className="
text-void-fg-2
prose
prose-sm
break-words
prose-p:block
prose-hr:my-4
prose-pre:my-2
marker:text-inherit
prose-ol:list-outside
prose-ol:list-decimal
prose-ul:list-outside
prose-ul:list-disc
prose-li:my-0
prose-code:before:content-none
prose-code:after:content-none
prose-headings:prose-sm
prose-headings:font-bold

prose-p:leading-normal
prose-ol:leading-normal
prose-ul:leading-normal

max-w-none
"
		>
			{children}
		</div>
	);
};
const AssistantMessageComponent = React.memo(
	({
		chatMessage,
		isCheckpointGhost,
		isCommitted,
		messageIdx,
	}: {
		chatMessage: ChatMessage & { role: "assistant" };
		isCheckpointGhost: boolean;
		messageIdx: number;
		isCommitted: boolean;
	}) => {
		const accessor = useAccessor();
		const chatThreadsService = accessor.get("IChatThreadService");

		const reasoningStr = chatMessage.reasoning?.trim() || null;
		const hasReasoning = !!reasoningStr;
		const isDoneReasoning = !!chatMessage.displayContent;
		const thread = chatThreadsService.getCurrentThread();

		const chatMessageLocation: ChatMessageLocation = useMemo(
			() => ({
				threadId: thread.id,
				messageIdx: messageIdx,
			}),
			[thread.id, messageIdx],
		);

		const isEmpty = !chatMessage.displayContent && !chatMessage.reasoning;
		if (isEmpty) return null;

		return (
			<>
				{/* reasoning token */}
				{hasReasoning && (
					<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
						<ReasoningWrapper
							isDoneReasoning={isDoneReasoning}
							isStreaming={!isCommitted}
						>
							<SmallProseWrapper>
								<ChatMarkdownRender
									string={reasoningStr}
									chatMessageLocation={chatMessageLocation}
									isApplyEnabled={false}
									isLinkDetectionEnabled={true}
								/>
							</SmallProseWrapper>
						</ReasoningWrapper>
					</div>
				)}

				{/* assistant message */}
				{chatMessage.displayContent && (
					<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
						<ProseWrapper>
							<ChatMarkdownRender
								string={chatMessage.displayContent || ""}
								chatMessageLocation={chatMessageLocation}
								isApplyEnabled={true}
								isLinkDetectionEnabled={true}
							/>
						</ProseWrapper>
					</div>
				)}
			</>
		);
	},
	(prev, next) => {
		// Custom comparison: only re-render if message content, checkpoint state, or committed state changes
		return (
			prev.chatMessage.displayContent === next.chatMessage.displayContent &&
			prev.chatMessage.reasoning === next.chatMessage.reasoning &&
			prev.isCheckpointGhost === next.isCheckpointGhost &&
			prev.isCommitted === next.isCommitted &&
			prev.messageIdx === next.messageIdx
		);
	},
);

const ReasoningWrapper = ({
	isDoneReasoning,
	isStreaming,
	children,
}: {
	isDoneReasoning: boolean;
	isStreaming: boolean;
	children: React.ReactNode;
}) => {
	const isDone = isDoneReasoning || !isStreaming;
	const isWriting = !isDone;
	const [isOpen, setIsOpen] = useState(isWriting);
	useEffect(() => {
		if (!isWriting) setIsOpen(false); // if just finished reasoning, close
	}, [isWriting]);
	return (
		<ToolHeaderWrapper
			title="Reasoning"
			desc1={isWriting ? <IconLoading /> : ""}
			isOpen={isOpen}
			onClick={() => setIsOpen((v) => !v)}
		>
			<ToolChildrenWrapper>
				<div className="!select-text cursor-auto">{children}</div>
			</ToolChildrenWrapper>
		</ToolHeaderWrapper>
	);
};

// should either be past or "-ing" tense, not present tense. Eg. when the LLM searches for something, the user expects it to say "I searched for X" or "I am searching for X". Not "I search X".

const loadingTitleWrapper = (item: React.ReactNode): React.ReactNode => {
	return (
		<span className="flex items-center flex-nowrap">
			{item}
			<IconLoading className="w-3 text-sm" />
		</span>
	);
};

const titleOfBuiltinToolName = {
	read_file: {
		done: "Read file",
		proposed: "Read file",
		running: loadingTitleWrapper("Reading file"),
	},
	ls_dir: {
		done: "Inspected folder",
		proposed: "Inspect folder",
		running: loadingTitleWrapper("Inspecting folder"),
	},
	get_dir_tree: {
		done: "Inspected folder tree",
		proposed: "Inspect folder tree",
		running: loadingTitleWrapper("Inspecting folder tree"),
	},
	search_pathnames_only: {
		done: "Searched by file name",
		proposed: "Search by file name",
		running: loadingTitleWrapper("Searching by file name"),
	},
	search_for_files: {
		done: "Searched",
		proposed: "Search",
		running: loadingTitleWrapper("Searching"),
	},
	create_file_or_folder: {
		done: `Created`,
		proposed: `Create`,
		running: loadingTitleWrapper(`Creating`),
	},
	delete_file_or_folder: {
		done: `Deleted`,
		proposed: `Delete`,
		running: loadingTitleWrapper(`Deleting`),
	},
	edit_file: {
		done: `Edited file`,
		proposed: "Edit file",
		running: loadingTitleWrapper("Editing file"),
	},
	rewrite_file: {
		done: `Wrote file`,
		proposed: "Write file",
		running: loadingTitleWrapper("Writing file"),
	},
	run_command: {
		done: `Ran terminal`,
		proposed: "Run terminal",
		running: loadingTitleWrapper("Running terminal"),
	},
	run_persistent_command: {
		done: `Ran terminal`,
		proposed: "Run terminal",
		running: loadingTitleWrapper("Running terminal"),
	},

	open_persistent_terminal: {
		done: `Opened terminal`,
		proposed: "Open terminal",
		running: loadingTitleWrapper("Opening terminal"),
	},
	kill_persistent_terminal: {
		done: `Killed terminal`,
		proposed: "Kill terminal",
		running: loadingTitleWrapper("Killing terminal"),
	},

	read_lint_errors: {
		done: `Read lint errors`,
		proposed: "Read lint errors",
		running: loadingTitleWrapper("Reading lint errors"),
	},
	search_in_file: {
		done: "Searched in file",
		proposed: "Search in file",
		running: loadingTitleWrapper("Searching in file"),
	},
	web_search: {
		done: "Searched the web",
		proposed: "Search the web",
		running: loadingTitleWrapper("Searching the web"),
	},
	browse_url: {
		done: "Fetched web page",
		proposed: "Fetch web page",
		running: loadingTitleWrapper("Fetching web page"),
	},
} as const satisfies Record<
	BuiltinToolName,
	{ done: any; proposed: any; running: any }
>;

const getTitle = (
	toolMessage: Pick<
		ChatMessage & { role: "tool" },
		"name" | "type" | "mcpServerName"
	>,
): React.ReactNode => {
	const t = toolMessage;

	// non-built-in title
	if (!builtinToolNames.includes(t.name as BuiltinToolName)) {
		// descriptor of Running or Ran etc
		const descriptor =
			t.type === "success"
				? "Called"
				: t.type === "running_now"
					? "Calling"
					: t.type === "tool_request"
						? "Call"
						: t.type === "rejected"
							? "Call"
							: t.type === "invalid_params"
								? "Call"
								: t.type === "tool_error"
									? "Call"
									: "Call";

		const title = `${descriptor} ${toolMessage.mcpServerName || "MCP"}`;
		if (t.type === "running_now" || t.type === "tool_request")
			return loadingTitleWrapper(title);
		return title;
	}

	// built-in title
	else {
		const toolName = t.name as BuiltinToolName;
		if (t.type === "success") return titleOfBuiltinToolName[toolName].done;
		if (t.type === "running_now")
			return titleOfBuiltinToolName[toolName].running;
		return titleOfBuiltinToolName[toolName].proposed;
	}
};

const toolNameToDesc = (
	toolName: BuiltinToolName,
	_toolParams: BuiltinToolCallParams[BuiltinToolName] | undefined,
	accessor: ReturnType<typeof useAccessor>,
): {
	desc1: React.ReactNode;
	desc1Info?: string;
} => {
	if (!_toolParams) {
		return { desc1: "" };
	}

	const x = {
		read_file: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["read_file"];
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		ls_dir: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["ls_dir"];
			return {
				desc1: getFolderName(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		search_pathnames_only: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["search_pathnames_only"];
			return {
				desc1: `"${toolParams.query}"`,
			};
		},
		search_for_files: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["search_for_files"];
			return {
				desc1: `"${toolParams.query}"`,
			};
		},
		search_in_file: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["search_in_file"];
			return {
				desc1: `"${toolParams.query}"`,
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		create_file_or_folder: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["create_file_or_folder"];
			return {
				desc1: toolParams.isFolder
					? (getFolderName(toolParams.uri.fsPath) ?? "/")
					: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		delete_file_or_folder: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["delete_file_or_folder"];
			return {
				desc1: toolParams.isFolder
					? (getFolderName(toolParams.uri.fsPath) ?? "/")
					: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		rewrite_file: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["rewrite_file"];
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		edit_file: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["edit_file"];
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		run_command: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["run_command"];
			return {
				desc1: `"${toolParams.command}"`,
			};
		},
		run_persistent_command: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["run_persistent_command"];
			return {
				desc1: `"${toolParams.command}"`,
			};
		},
		open_persistent_terminal: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["open_persistent_terminal"];
			return { desc1: "" };
		},
		kill_persistent_terminal: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["kill_persistent_terminal"];
			return { desc1: toolParams.persistentTerminalId };
		},
		get_dir_tree: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["get_dir_tree"];
			return {
				desc1: getFolderName(toolParams.uri.fsPath) ?? "/",
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		read_lint_errors: () => {
			const toolParams =
				_toolParams as BuiltinToolCallParams["read_lint_errors"];
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		web_search: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["web_search"];
			return {
				desc1: `"${toolParams.query}"`,
			};
		},
		browse_url: () => {
			const toolParams = _toolParams as BuiltinToolCallParams["browse_url"];
			return {
				desc1: toolParams.url,
				desc1Info: new URL(toolParams.url).hostname,
			};
		},
	};

	try {
		return x[toolName]?.() || { desc1: "" };
	} catch {
		return { desc1: "" };
	}
};

const ToolRequestAcceptRejectButtons = ({
	toolName,
}: {
	toolName: ToolName;
}) => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get("IChatThreadService");
	const metricsService = accessor.get("IMetricsService");
	const cortexideSettingsService = accessor.get("ICortexideSettingsService");
	const voidSettingsState = useSettingsState();

	// Subscribe to thread state changes properly
	const chatThreadsState = useChatThreadsState();
	const currentThreadId = chatThreadsState.currentThreadId;

	const onAccept = useCallback(() => {
		try {
			// this doesn't need to be wrapped in try/catch anymore
			// use subscribed state
			chatThreadsService.approveLatestToolRequest(currentThreadId);
			metricsService.capture("Tool Request Accepted", {});
		} catch (e) {
			console.error("Error while approving message in chat:", e);
		}
	}, [chatThreadsService, metricsService, currentThreadId]);

	const onReject = useCallback(() => {
		try {
			// use subscribed state
			chatThreadsService.rejectLatestToolRequest(currentThreadId);
		} catch (e) {
			console.error("Error while approving message in chat:", e);
		}
		metricsService.capture("Tool Request Rejected", {});
	}, [chatThreadsService, metricsService, currentThreadId]);

	const approveButton = (
		<button
			onClick={onAccept}
			className={`
				px-2 py-1
				bg-[var(--vscode-button-background)]
				text-[var(--vscode-button-foreground)]
				hover:bg-[var(--vscode-button-hoverBackground)]
				rounded
				text-sm font-medium
			`}
		>
			Approve
		</button>
	);

	const cancelButton = (
		<button
			onClick={onReject}
			className={`
				px-2 py-1
				bg-[var(--vscode-button-secondaryBackground)]
				text-[var(--vscode-button-secondaryForeground)]
				hover:bg-[var(--vscode-button-secondaryHoverBackground)]
				rounded
				text-sm font-medium
			`}
		>
			Cancel
		</button>
	);

	const approvalType = isABuiltinToolName(toolName)
		? approvalTypeOfBuiltinToolName[toolName]
		: "MCP tools";
	const approvalToggle = approvalType ? (
		<div key={approvalType} className="flex items-center ml-2 gap-x-1">
			<ToolApprovalTypeSwitch
				size="xs"
				approvalType={approvalType}
				desc={`Auto-approve ${approvalType}`}
			/>
		</div>
	) : null;

	return (
		<div className="flex gap-2 mx-0.5 items-center">
			{approveButton}
			{cancelButton}
			{approvalToggle}
		</div>
	);
};

export const ToolChildrenWrapper = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return (
		<div className={`${className ? className : ""} cursor-default select-none`}>
			<div className="px-2 min-w-full overflow-hidden">{children}</div>
		</div>
	);
};
export const CodeChildren = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return (
		<div className={`${className ?? ""} p-1 rounded-sm overflow-auto text-sm`}>
			<div className="!select-text cursor-auto">{children}</div>
		</div>
	);
};

export const ListableToolItem = ({
	name,
	onClick,
	isSmall,
	className,
	showDot,
}: {
	name: React.ReactNode;
	onClick?: () => void;
	isSmall?: boolean;
	className?: string;
	showDot?: boolean;
}) => {
	return (
		<div
			className={`
			${onClick ? "hover:brightness-125 hover:cursor-pointer transition-all duration-200 " : ""}
			flex items-center flex-nowrap whitespace-nowrap
			${className ? className : ""}
			`}
			onClick={onClick}
		>
			{showDot === false ? null : (
				<div className="flex-shrink-0">
					<svg
						className="w-1 h-1 opacity-60 mr-1.5 fill-current"
						viewBox="0 0 100 40"
					>
						<rect x="0" y="15" width="100" height="10" />
					</svg>
				</div>
			)}
			<div
				className={`${isSmall ? "italic text-void-fg-4 flex items-center" : ""}`}
			>
				{name}
			</div>
		</div>
	);
};

const EditToolChildren = ({
	uri,
	code,
	type,
}: {
	uri: URI | undefined;
	code: string;
	type: "diff" | "rewrite";
}) => {
	const content =
		type === "diff" ? (
			<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
		) : (
			<ChatMarkdownRender
				string={`\`\`\`\n${code}\n\`\`\``}
				codeURI={uri}
				chatMessageLocation={undefined}
			/>
		);

	return (
		<div className="!select-text cursor-auto">
			<SmallProseWrapper>{content}</SmallProseWrapper>
		</div>
	);
};

const LintErrorChildren = ({ lintErrors }: { lintErrors: LintErrorItem[] }) => {
	return (
		<div className="text-xs text-void-fg-4 opacity-80 border-l-2 border-void-warning px-2 py-0.5 flex flex-col gap-0.5 overflow-x-auto whitespace-nowrap">
			{lintErrors.map((error, i) => (
				<div key={i}>
					Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}
				</div>
			))}
		</div>
	);
};

const BottomChildren = ({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	if (!children) return null;
	return (
		<div className="w-full px-2 mt-0.5">
			<div
				className={`flex items-center cursor-pointer select-none transition-colors duration-150 pl-0 py-0.5 rounded group`}
				onClick={() => setIsOpen((o) => !o)}
				style={{ background: "none" }}
			>
				<ChevronRight
					className={`mr-1 h-3 w-3 flex-shrink-0 transition-transform duration-100 text-void-fg-4 group-hover:text-void-fg-3 ${isOpen ? "rotate-90" : ""}`}
				/>
				<span className="font-medium text-void-fg-4 group-hover:text-void-fg-3 text-xs">
					{title}
				</span>
			</div>
			<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? "opacity-100" : "max-h-0 opacity-0"} text-xs pl-4`}
			>
				<div className="overflow-x-auto text-void-fg-4 opacity-90 border-l-2 border-void-warning px-2 py-0.5">
					{children}
				</div>
			</div>
		</div>
	);
};

const EditToolHeaderButtons = ({
	applyBoxId,
	uri,
	codeStr,
	toolName,
	threadId,
}: {
	threadId: string;
	applyBoxId: string;
	uri: URI;
	codeStr: string;
	toolName: "edit_file" | "rewrite_file";
}) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri });
	return (
		<div className="flex items-center gap-1">
			{/* <StatusIndicatorForApplyButton applyBoxId={applyBoxId} uri={uri} /> */}
			{/* <JumpToFileButton uri={uri} /> */}
			{streamState === "idle-no-changes" && (
				<CopyButton codeStr={codeStr} toolTipName="Copy" />
			)}
			<EditToolAcceptRejectButtonsHTML
				type={toolName}
				codeStr={codeStr}
				applyBoxId={applyBoxId}
				uri={uri}
				threadId={threadId}
			/>
		</div>
	);
};

const InvalidTool = ({
	toolName,
	message,
	mcpServerName,
}: {
	toolName: ToolName;
	message: string;
	mcpServerName: string | undefined;
}) => {
	const accessor = useAccessor();
	const title = getTitle({
		name: toolName,
		type: "invalid_params",
		mcpServerName,
	});
	const desc1 = "Invalid parameters";
	const icon = null;
	const isError = true;
	const componentParams: ToolHeaderParams = { title, desc1, isError, icon };

	componentParams.children = (
		<ToolChildrenWrapper>
			<CodeChildren className="bg-void-bg-3">{message}</CodeChildren>
		</ToolChildrenWrapper>
	);
	return <ToolHeaderWrapper {...componentParams} />;
};

const CanceledTool = ({
	toolName,
	mcpServerName,
}: {
	toolName: ToolName;
	mcpServerName: string | undefined;
}) => {
	const accessor = useAccessor();
	const title = getTitle({ name: toolName, type: "rejected", mcpServerName });
	const desc1 = "";
	const icon = null;
	const isRejected = true;
	const componentParams: ToolHeaderParams = { title, desc1, icon, isRejected };
	return <ToolHeaderWrapper {...componentParams} />;
};

const CommandTool = ({
	toolMessage,
	type,
	threadId,
}: { threadId: string } & (
	| {
			toolMessage: Exclude<
				ToolMessage<"run_command">,
				{ type: "invalid_params" }
			>;
			type: "run_command";
		}
	| {
			toolMessage: Exclude<
				ToolMessage<"run_persistent_command">,
				{ type: "invalid_params" }
			>;
			type: "run_persistent_command";
		}
)) => {
	const accessor = useAccessor();

	const commandService = accessor.get("ICommandService");
	const terminalToolsService = accessor.get("ITerminalToolService");
	const toolsService = accessor.get("IToolsService");
	const isError = false;
	const title = getTitle(toolMessage);
	const { desc1, desc1Info } = toolNameToDesc(
		toolMessage.name,
		toolMessage.params,
		accessor,
	);
	const icon = null;
	const streamState = useChatThreadsStreamState(threadId);

	const divRef = useRef<HTMLDivElement | null>(null);

	const isRejected = toolMessage.type === "rejected";
	const { rawParams, params } = toolMessage;
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		desc1Info,
		isError,
		icon,
		isRejected,
	};

	const effect = async () => {
		if (streamState?.isRunning !== "tool") return;
		if (type !== "run_command" || toolMessage.type !== "running_now") return;

		// wait for the interruptor so we know it's running

		await streamState?.interrupt;
		const container = divRef.current;
		if (!container) return;

		const terminal = terminalToolsService.getTemporaryTerminal(
			toolMessage.params.terminalId,
		);
		if (!terminal) return;

		try {
			terminal.attachToElement(container);
			terminal.setVisible(true);
		} catch {}

		// Listen for size changes of the container and keep the terminal layout in sync.
		const resizeObserver = new ResizeObserver((entries) => {
			const height = entries[0].borderBoxSize[0].blockSize;
			const width = entries[0].borderBoxSize[0].inlineSize;
			if (typeof terminal.layout === "function") {
				terminal.layout({ width, height });
			}
		});

		resizeObserver.observe(container);
		return () => {
			terminal.detachFromElement();
			resizeObserver?.disconnect();
		};
	};

	useEffect(() => {
		effect();
	}, [terminalToolsService, toolMessage, toolMessage.type, type]);

	if (toolMessage.type === "success") {
		const { result } = toolMessage;

		// it's unclear that this is a button and not an icon.
		// componentParams.desc2 = <JumpToTerminalButton
		// 	onClick={() => { terminalToolsService.openTerminal(terminalId) }}
		// />

		let msg: string;
		if (type === "run_command")
			msg = toolsService.stringOfResult["run_command"](
				toolMessage.params,
				result,
			);
		else
			msg = toolsService.stringOfResult["run_persistent_command"](
				toolMessage.params,
				result,
			);

		if (type === "run_persistent_command") {
			componentParams.info = persistentTerminalNameOfId(
				toolMessage.params.persistentTerminalId,
			);
		}

		componentParams.children = (
			<ToolChildrenWrapper className="whitespace-pre text-nowrap overflow-auto text-sm">
				<div className="!select-text cursor-auto">
					<BlockCode initValue={`${msg.trim()}`} language="shellscript" />
				</div>
			</ToolChildrenWrapper>
		);
	} else if (toolMessage.type === "tool_error") {
		const { result } = toolMessage;
		componentParams.bottomChildren = (
			<BottomChildren title="Error">
				<CodeChildren>{result}</CodeChildren>
			</BottomChildren>
		);
	} else if (toolMessage.type === "running_now") {
		if (type === "run_command")
			componentParams.children = (
				<div ref={divRef} className="relative h-[300px] text-sm" />
			);
	} else if (
		toolMessage.type === "rejected" ||
		toolMessage.type === "tool_request"
	) {
	}

	return (
		<>
			<ToolHeaderWrapper
				{...componentParams}
				isOpen={
					type === "run_command" && toolMessage.type === "running_now"
						? true
						: undefined
				}
			/>
		</>
	);
};

type WrapperProps<T extends ToolName> = {
	toolMessage: Exclude<ToolMessage<T>, { type: "invalid_params" }>;
	messageIdx: number;
	threadId: string;
};
const MCPToolWrapper = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor();
	const mcpService = accessor.get("IMCPService");

	const title = getTitle(toolMessage);
	const desc1 = removeMCPToolNamePrefix(toolMessage.name);
	const icon = null;

	if (toolMessage.type === "running_now") return null; // do not show running

	const isError = false;
	const isRejected = toolMessage.type === "rejected";
	const { rawParams, params } = toolMessage;

	// Redact sensitive values in params before display/copy
	const redactParams = (value: any): any => {
		const SENSITIVE_KEYS = new Set([
			"token",
			"apiKey",
			"apikey",
			"password",
			"authorization",
			"auth",
			"secret",
			"clientSecret",
			"accessToken",
			"bearer",
		]);
		const redactValue = (v: any) =>
			typeof v === "string"
				? v.length > 6
					? v.slice(0, 3) + "***" + v.slice(-2)
					: "***"
				: v;
		if (Array.isArray(value)) return value.map(redactParams);
		if (value && typeof value === "object") {
			const out: any = Array.isArray(value) ? [] : {};
			for (const k of Object.keys(value)) {
				if (SENSITIVE_KEYS.has(k.toLowerCase())) out[k] = redactValue(value[k]);
				else out[k] = redactParams(value[k]);
			}
			return out;
		}
		return value;
	};
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		isError,
		icon,
		isRejected,
	};

	const redactedParams = redactParams(params);
	const paramsStr = JSON.stringify(redactedParams, null, 2);
	componentParams.desc2 = (
		<CopyButton
			codeStr={paramsStr}
			toolTipName={`Copy inputs (redacted): ${paramsStr}`}
		/>
	);

	componentParams.info = !toolMessage.mcpServerName
		? "MCP tool not found"
		: undefined;

	// Add copy inputs button in desc2

	if (toolMessage.type === "success" || toolMessage.type === "tool_request") {
		const { result } = toolMessage;
		const resultStr = result ? mcpService.stringifyResult(result) : "null";
		componentParams.children = (
			<ToolChildrenWrapper>
				<SmallProseWrapper>
					<ChatMarkdownRender
						string={`\`\`\`json\n${resultStr}\n\`\`\``}
						chatMessageLocation={undefined}
						isApplyEnabled={false}
						isLinkDetectionEnabled={true}
					/>
				</SmallProseWrapper>
			</ToolChildrenWrapper>
		);
	} else if (toolMessage.type === "tool_error") {
		const { result } = toolMessage;
		componentParams.bottomChildren = (
			<BottomChildren title="Error">
				<CodeChildren>{result}</CodeChildren>
			</BottomChildren>
		);
	}

	return <ToolHeaderWrapper {...componentParams} />;
};

type ResultWrapper<T extends ToolName> = (
	props: WrapperProps<T>,
) => React.ReactNode;

const builtinToolNameToComponent: {
	[T in BuiltinToolName]: { resultWrapper: ResultWrapper<T> };
} = {
	read_file: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");

			const title = getTitle(toolMessage);

			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			let range: [number, number] | undefined = undefined;
			if (
				toolMessage.params.startLine !== null ||
				toolMessage.params.endLine !== null
			) {
				const start =
					toolMessage.params.startLine === null
						? `1`
						: `${toolMessage.params.startLine}`;
				const end =
					toolMessage.params.endLine === null
						? ``
						: `${toolMessage.params.endLine}`;
				const addStr = `(${start}-${end})`;
				componentParams.desc1 += ` ${addStr}`;
				range = [params.startLine || 1, params.endLine || 1];
			}

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor, range);
				};
				if (result.hasNextPage && params.pageNumber === 1)
					// first page
					componentParams.desc2 = `(truncated after ${Math.round(MAX_FILE_CHARS_PAGE) / 1000}k)`;
				else if (params.pageNumber > 1)
					// subsequent pages
					componentParams.desc2 = `(part ${params.pageNumber})`;
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	get_dir_tree: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");

			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.uri) {
				const rel = getRelative(params.uri, accessor);
				if (rel) componentParams.info = `Only search in ${rel}`;
			}

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={`\`\`\`\n${result.str}\n\`\`\``}
								chatMessageLocation={undefined}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	ls_dir: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const explorerService = accessor.get("IExplorerService");
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.uri) {
				const rel = getRelative(params.uri, accessor);
				if (rel) componentParams.info = `Only search in ${rel}`;
			}

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.numResults = result.children?.length;
				componentParams.hasNextPage = result.hasNextPage;
				componentParams.children =
					!result.children ||
					(result.children.length ?? 0) === 0 ? undefined : (
						<ToolChildrenWrapper>
							{result.children.map((child, i) => (
								<ListableToolItem
									key={i}
									name={`${child.name}${child.isDirectory ? "/" : ""}`}
									className="w-full overflow-auto"
									onClick={() => {
										voidOpenFileFn(child.uri, accessor);
										// commandService.executeCommand('workbench.view.explorer'); // open in explorer folders view instead
										// explorerService.select(child.uri, true);
									}}
								/>
							))}
							{result.hasNextPage && (
								<ListableToolItem
									name={`Results truncated (${result.itemsRemaining} remaining).`}
									isSmall={true}
									className="w-full overflow-auto"
								/>
							)}
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	search_pathnames_only: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.includePattern) {
				componentParams.info = `Only search in ${params.includePattern}`;
			}

			if (toolMessage.type === "success") {
				const { result, rawParams } = toolMessage;
				componentParams.numResults = result.uris.length;
				componentParams.hasNextPage = result.hasNextPage;
				componentParams.children =
					result.uris.length === 0 ? undefined : (
						<ToolChildrenWrapper>
							{result.uris.map((uri, i) => (
								<ListableToolItem
									key={i}
									name={getBasename(uri.fsPath)}
									className="w-full overflow-auto"
									onClick={() => {
										voidOpenFileFn(uri, accessor);
									}}
								/>
							))}
							{result.hasNextPage && (
								<ListableToolItem
									name={"Results truncated."}
									isSmall={true}
									className="w-full overflow-auto"
								/>
							)}
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	search_for_files: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.searchInFolder || params.isRegex) {
				let info: string[] = [];
				if (params.searchInFolder) {
					const rel = getRelative(params.searchInFolder, accessor);
					if (rel) info.push(`Only search in ${rel}`);
				}
				if (params.isRegex) {
					info.push(`Uses regex search`);
				}
				componentParams.info = info.join("; ");
			}

			if (toolMessage.type === "success") {
				const { result, rawParams } = toolMessage;
				componentParams.numResults = result.uris.length;
				componentParams.hasNextPage = result.hasNextPage;
				componentParams.children =
					result.uris.length === 0 ? undefined : (
						<ToolChildrenWrapper>
							{result.uris.map((uri, i) => (
								<ListableToolItem
									key={i}
									name={getBasename(uri.fsPath)}
									className="w-full overflow-auto"
									onClick={() => {
										voidOpenFileFn(uri, accessor);
									}}
								/>
							))}
							{result.hasNextPage && (
								<ListableToolItem
									name={`Results truncated.`}
									isSmall={true}
									className="w-full overflow-auto"
								/>
							)}
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}
			return <ToolHeaderWrapper {...componentParams} />;
		},
	},

	search_in_file: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get("IToolsService");
			const title = getTitle(toolMessage);
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			const infoarr: string[] = [];
			const uriStr = getRelative(params.uri, accessor);
			if (uriStr) infoarr.push(uriStr);
			if (params.isRegex) infoarr.push("Uses regex search");
			componentParams.info = infoarr.join("; ");

			if (toolMessage.type === "success") {
				const { result } = toolMessage; // result is array of snippets
				componentParams.numResults = result.lines.length;
				componentParams.children =
					result.lines.length === 0 ? undefined : (
						<ToolChildrenWrapper>
							<CodeChildren className="bg-void-bg-3">
								<pre className="font-mono whitespace-pre">
									{toolsService.stringOfResult["search_in_file"](
										params,
										result,
									)}
								</pre>
							</CodeChildren>
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},

	read_lint_errors: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");

			const title = getTitle(toolMessage);

			const { uri } = toolMessage.params ?? {};
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			componentParams.info = getRelative(uri, accessor); // full path

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
				if (result.lintErrors)
					componentParams.children = (
						<LintErrorChildren lintErrors={result.lintErrors} />
					);
				else componentParams.children = `No lint errors found.`;
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},

	// ---

	create_file_or_folder: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			componentParams.info = getRelative(params.uri, accessor); // full path

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "rejected") {
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				if (params) {
					componentParams.onClick = () => {
						voidOpenFileFn(params.uri, accessor);
					};
				}
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			} else if (toolMessage.type === "running_now") {
				// nothing more is needed
			} else if (toolMessage.type === "tool_request") {
				// nothing more is needed
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	delete_file_or_folder: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isFolder = toolMessage.params?.isFolder ?? false;
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			componentParams.info = getRelative(params.uri, accessor); // full path

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "rejected") {
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				if (params) {
					componentParams.onClick = () => {
						voidOpenFileFn(params.uri, accessor);
					};
				}
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			} else if (toolMessage.type === "running_now") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "tool_request") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	rewrite_file: {
		resultWrapper: (params) => {
			return (
				<EditTool {...params} content={params.toolMessage.params.newContent} />
			);
		},
	},
	edit_file: {
		resultWrapper: (params) => {
			return (
				<EditTool
					{...params}
					content={params.toolMessage.params.searchReplaceBlocks}
				/>
			);
		},
	},

	// ---

	run_command: {
		resultWrapper: (params) => {
			return <CommandTool {...params} type="run_command" />;
		},
	},

	run_persistent_command: {
		resultWrapper: (params) => {
			return <CommandTool {...params} type="run_persistent_command" />;
		},
	},
	open_persistent_terminal: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const terminalToolsService = accessor.get("ITerminalToolService");

			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const title = getTitle(toolMessage);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			const relativePath = params.cwd
				? getRelative(URI.file(params.cwd), accessor)
				: "";
			componentParams.info = relativePath
				? `Running in ${relativePath}`
				: undefined;

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				const { persistentTerminalId } = result;
				componentParams.desc1 =
					persistentTerminalNameOfId(persistentTerminalId);
				componentParams.onClick = () =>
					terminalToolsService.focusPersistentTerminal(persistentTerminalId);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	kill_persistent_terminal: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const terminalToolsService = accessor.get("ITerminalToolService");

			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const title = getTitle(toolMessage);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { persistentTerminalId } = params;
				componentParams.desc1 =
					persistentTerminalNameOfId(persistentTerminalId);
				componentParams.onClick = () =>
					terminalToolsService.focusPersistentTerminal(persistentTerminalId);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	web_search: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get("IToolsService");
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") {
				// Show loading indicator
				const componentParams: ToolHeaderParams = {
					title,
					desc1,
					desc1Info,
					isError: false,
					icon,
					isRejected: false,
				};
				componentParams.children = (
					<ToolChildrenWrapper>
						<div className="flex items-center gap-2 text-sm text-void-fg-3">
							<IconLoading />
							<span>Searching the web...</span>
						</div>
					</ToolChildrenWrapper>
				);
				return <ToolHeaderWrapper {...componentParams} />;
			}

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.numResults = result.results?.length || 0;

				if (result.results && result.results.length > 0) {
					componentParams.children = (
						<ToolChildrenWrapper>
							<div className="space-y-3">
								{result.results.map(
									(
										r: { title: string; snippet: string; url: string },
										i: number,
									) => (
										<div
											key={i}
											className="border border-void-border-2 bg-void-bg-2 rounded p-3 hover:bg-void-bg-3 transition-colors"
										>
											<a
												href={r.url}
												target="_blank"
												rel="noopener noreferrer"
												className="block group"
											>
												<div className="text-sm font-semibold text-blue-400 group-hover:text-blue-300 mb-1 line-clamp-2">
													{r.title}
												</div>
												<div className="text-xs text-void-fg-4 mb-2 truncate">
													{r.url}
												</div>
												<div className="text-sm text-void-fg-2 line-clamp-3">
													{r.snippet}
												</div>
											</a>
										</div>
									),
								)}
							</div>
						</ToolChildrenWrapper>
					);
				} else {
					componentParams.children = (
						<ToolChildrenWrapper>
							<div className="text-sm text-void-fg-3">
								No search results found.
							</div>
						</ToolChildrenWrapper>
					);
				}
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	browse_url: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get("IToolsService");
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor,
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") {
				// Show loading indicator
				const componentParams: ToolHeaderParams = {
					title,
					desc1,
					desc1Info,
					isError: false,
					icon,
					isRejected: false,
				};
				componentParams.children = (
					<ToolChildrenWrapper>
						<div className="flex items-center gap-2 text-sm text-void-fg-3">
							<IconLoading />
							<span>Fetching content from URL...</span>
						</div>
					</ToolChildrenWrapper>
				);
				return <ToolHeaderWrapper {...componentParams} />;
			}

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				const urlStr = result.url || params.url;

				componentParams.onClick = () => {
					if (urlStr) {
						window.open(urlStr, "_blank", "noopener,noreferrer");
					}
				};
				componentParams.info = urlStr
					? `Source: ${new URL(urlStr).hostname}`
					: undefined;

				if (result.content) {
					const contentPreview =
						result.content.length > 2000
							? result.content.substring(0, 2000) +
								"\n\n... (content truncated)"
							: result.content;

					componentParams.children = (
						<ToolChildrenWrapper>
							<div className="space-y-3">
								{result.title && (
									<div className="text-lg font-semibold text-void-fg-1">
										{result.title}
									</div>
								)}
								{result.metadata?.publishedDate && (
									<div className="text-xs text-void-fg-4">
										Published: {result.metadata.publishedDate}
									</div>
								)}
								{urlStr && (
									<a
										href={urlStr}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-blue-400 hover:text-blue-300 block truncate"
									>
										{urlStr}
									</a>
								)}
								<div className="text-sm text-void-fg-2 whitespace-pre-wrap max-h-96 overflow-y-auto border border-void-border-2 bg-void-bg-3 rounded p-3">
									{contentPreview}
								</div>
							</div>
						</ToolChildrenWrapper>
					);
				} else {
					componentParams.children = (
						<ToolChildrenWrapper>
							<div className="text-sm text-void-fg-3">
								No content extracted from URL.
							</div>
						</ToolChildrenWrapper>
					);
				}
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
};

const Checkpoint = ({
	message,
	threadId,
	messageIdx,
	isCheckpointGhost,
	threadIsRunning,
}: {
	message: CheckpointEntry;
	threadId: string;
	messageIdx: number;
	isCheckpointGhost: boolean;
	threadIsRunning: boolean;
}) => {
	const accessor = useAccessor();
	const chatThreadService = accessor.get("IChatThreadService");
	const streamState = useFullChatThreadsStreamState();

	// Subscribe to thread state changes properly
	const chatThreadsState = useChatThreadsState();

	const isRunning = useChatThreadsStreamState(threadId)?.isRunning;
	const isDisabled = useMemo(() => {
		if (isRunning) return true;
		// Use Object.values().some() instead of Object.keys().find() for better performance
		return Object.values(streamState).some(
			(threadState) => threadState?.isRunning,
		);
	}, [isRunning, streamState]);

	// Memoize message count lookup to avoid direct state access in render
	const threadMessagesLength =
		chatThreadsState.allThreads[threadId]?.messages.length ?? 0;

	return (
		<div className={`flex items-center justify-center px-2 `}>
			<div
				className={`
					text-xs
					text-void-fg-3
					select-none
					${isCheckpointGhost ? "opacity-50" : "opacity-100"}
					${isDisabled ? "cursor-default" : "cursor-pointer"}
				`}
				style={{ position: "relative", display: "inline-block" }} // allow absolute icon
				onClick={() => {
					if (threadIsRunning) return;
					if (isDisabled) return;
					chatThreadService.jumpToCheckpointBeforeMessageIdx({
						threadId,
						messageIdx,
						jumpToUserModified: messageIdx === threadMessagesLength - 1,
					});
				}}
				{...(isDisabled
					? {
							"data-tooltip-id": "void-tooltip",
							"data-tooltip-content": `Disabled ${isRunning ? "when running" : "because another thread is running"}`,
							"data-tooltip-place": "top",
						}
					: {})}
			>
				Checkpoint
			</div>
		</div>
	);
};

type ChatBubbleMode = "display" | "edit";
type ChatBubbleProps = {
	chatMessage: ChatMessage;
	messageIdx: number;
	isCommitted: boolean;
	chatIsRunning: IsRunningType;
	threadId: string;
	currCheckpointIdx: number | undefined;
	_scrollToBottom: (() => void) | null;
};

// Plan Component - Shows structured execution plan as a todo list
const PlanComponent = React.memo(
	({
		message,
		isCheckpointGhost,
		threadId,
		messageIdx,
	}: {
		message: PlanMessage;
		isCheckpointGhost: boolean;
		threadId: string;
		messageIdx: number;
	}) => {
		const accessor = useAccessor();
		const chatThreadService = accessor.get("IChatThreadService");
		const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
		const [isCollapsed, setIsCollapsed] = useState(false);

		// Subscribe to thread state changes properly
		const chatThreadsState = useChatThreadsState();
		const approvalState = message.approvalState || "pending";
		const isRunning = useChatThreadsStreamState(threadId)?.isRunning;
		const isBusy =
			isRunning === "LLM" || isRunning === "tool" || isRunning === "preparing";
		const isIdleLike = isRunning === undefined || isRunning === "idle";

		// Get thread messages with proper subscription
		const thread = chatThreadsState.allThreads[threadId];
		const threadMessages = thread?.messages ?? [];

		// Memoize tool message lookup map for O(1) access instead of O(n) searches
		const toolMessagesMap = useMemo(() => {
			const map = new Map<string, ToolMessage<any>>();
			for (const msg of threadMessages) {
				if (msg.role === "tool") {
					const toolMsg = msg as ToolMessage<any>;
					map.set(toolMsg.id, toolMsg);
				}
			}
			return map;
		}, [threadMessages]);

		// Calculate progress - memoize to avoid recalculating on every render
		const totalSteps = message.steps.length;
		const completedSteps = useMemo(
			() =>
				message.steps.filter(
					(s) => s.status === "succeeded" || s.status === "skipped",
				).length,
			[message.steps],
		);
		const progressText = useMemo(
			() =>
				`${completedSteps} of ${totalSteps} ${totalSteps === 1 ? "Step" : "Steps"} Completed`,
			[completedSteps, totalSteps],
		);

		// Memoize hasPausedSteps to avoid recalculating on every render
		const hasPausedSteps = useMemo(
			() => message.steps.some((s) => s.status === "paused"),
			[message.steps],
		);

		const getCheckmarkIcon = (status?: StepStatus, isDisabled?: boolean) => {
			if (isDisabled) {
				return (
					<div className="w-5 h-5 rounded-full border-2 border-void-fg-4 flex items-center justify-center opacity-40" />
				);
			}

			switch (status) {
				case "succeeded":
					return (
						<div className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-500/20 flex items-center justify-center">
							<Check size={12} className="text-green-400" strokeWidth={3} />
						</div>
					);
				case "failed":
					return (
						<div className="w-5 h-5 rounded-full border-2 border-red-500 bg-red-500/20 flex items-center justify-center">
							<X size={12} className="text-red-400" strokeWidth={3} />
						</div>
					);
				case "running":
					return (
						<div className="w-5 h-5 rounded-full border-2 border-yellow-500 bg-yellow-500/20 flex items-center justify-center">
							<CircleEllipsis
								size={12}
								className="text-yellow-400 animate-spin"
							/>
						</div>
					);
				case "paused":
					return (
						<div className="w-5 h-5 rounded-full border-2 border-orange-500 bg-orange-500/20 flex items-center justify-center">
							<Dot size={12} className="text-orange-400" />
						</div>
					);
				case "skipped":
					return (
						<div className="w-5 h-5 rounded-full border-2 border-gray-500 bg-gray-500/20 flex items-center justify-center opacity-60">
							<Ban size={12} className="text-gray-400" />
						</div>
					);
				default: // queued
					return (
						<div className="w-5 h-5 rounded-full border-2 border-void-fg-3 flex items-center justify-center">
							<div className="w-1.5 h-1.5 rounded-full bg-void-fg-3 opacity-60" />
						</div>
					);
			}
		};

		const toggleStepExpanded = (stepNumber: number) => {
			setExpandedSteps((prev) => {
				const next = new Set(prev);
				if (next.has(stepNumber)) {
					next.delete(stepNumber);
				} else {
					next.add(stepNumber);
				}
				return next;
			});
		};

		const handleApprove = () => {
			if (isCheckpointGhost || isBusy) return;
			chatThreadService.approvePlan({ threadId, messageIdx });
		};

		const handleReject = () => {
			if (isCheckpointGhost || isBusy) return;
			chatThreadService.rejectPlan({ threadId, messageIdx });
		};

		const handleToggleStep = (stepNumber: number) => {
			if (isCheckpointGhost || isBusy) return;
			chatThreadService.toggleStepDisabled({
				threadId,
				messageIdx,
				stepNumber,
			});
		};

		const getStatusBadge = (status?: StepStatus) => {
			switch (status) {
				case "running":
					return (
						<span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
							Running
						</span>
					);
				case "failed":
					return (
						<span className="px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-400 border border-red-500/30">
							Failed
						</span>
					);
				case "paused":
					return (
						<span className="px-1.5 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
							Paused
						</span>
					);
				case "skipped":
					return (
						<span className="px-1.5 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
							Skipped
						</span>
					);
				default:
					return null;
			}
		};

		return (
			<div
				className={`${isCheckpointGhost ? "opacity-50 pointer-events-none" : ""} my-3`}
			>
				<div className="bg-void-bg-1 border border-void-border-1 rounded-lg overflow-hidden">
					{/* Header */}
					<div className="px-4 py-3 border-b border-void-border-1 bg-void-bg-2/30">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 flex-1 min-w-0">
								<button
									onClick={() => setIsCollapsed(!isCollapsed)}
									className="flex-shrink-0 p-1 hover:bg-void-bg-2 rounded transition-colors"
									disabled={isCheckpointGhost}
								>
									<ChevronRight
										size={16}
										className={`text-void-fg-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
									/>
								</button>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<h3 className="text-void-fg-1 font-medium text-sm truncate">
										{message.summary}
									</h3>
									{approvalState === "pending" && (
										<span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex-shrink-0">
											Pending Approval
										</span>
									)}
									{approvalState === "executing" && (
										<span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 flex-shrink-0">
											<CircleEllipsis size={12} className="animate-spin" />
											Executing
										</span>
									)}
									{approvalState === "completed" && (
										<span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1 flex-shrink-0">
											<Check size={12} />
											Completed
										</span>
									)}
								</div>
							</div>

							{!isCollapsed && (
								<div className="flex items-center gap-3 flex-shrink-0">
									<span className="text-void-fg-3 text-xs" aria-live="polite">
										{progressText}
									</span>
									{approvalState === "pending" && isIdleLike && (
										<div className="flex gap-2">
											<button
												title="Reject plan"
												aria-label="Reject plan"
												onClick={handleReject}
												className="px-3 py-1.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40"
											>
												Reject
											</button>
											<button
												title="Approve and execute"
												aria-label="Approve and execute plan"
												onClick={handleApprove}
												className="px-3 py-1.5 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/40"
											>
												Approve & Execute
											</button>
										</div>
									)}
									{approvalState === "executing" && isBusy && (
										<button
											aria-label="Pause plan execution"
											onClick={() =>
												chatThreadService.pauseAgentExecution({ threadId })
											}
											className="px-3 py-1.5 text-xs rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/40"
										>
											Pause
										</button>
									)}
									{hasPausedSteps && !isBusy && (
										<button
											aria-label="Resume plan execution"
											onClick={() =>
												chatThreadService.resumeAgentExecution({ threadId })
											}
											className="px-3 py-1.5 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/40"
										>
											Resume
										</button>
									)}
								</div>
							)}
						</div>
					</div>

					{/* Todo List */}
					{!isCollapsed && (
						<div className="py-2">
							{message.steps.map((step, idx) => {
								const isExpanded = expandedSteps.has(step.stepNumber);
								const isDisabled = step.disabled;
								const status = step.status || "queued";
								const hasDetails =
									step.tools || step.files || step.error || step.toolCalls;

								return (
									<div
										key={step.stepNumber}
										className={`flex items-start gap-3 px-4 py-2.5 hover:bg-void-bg-2/30 transition-colors ${
											isDisabled ? "opacity-50" : ""
										} ${status === "failed" ? "bg-red-500/5" : ""}`}
									>
										{/* Checkmark */}
										<div className="flex-shrink-0 mt-0.5">
											{getCheckmarkIcon(status, isDisabled)}
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between gap-3">
												<p
													className={`text-void-fg-1 text-sm flex-1 leading-relaxed ${
														isDisabled ? "line-through text-void-fg-3" : ""
													} ${status === "succeeded" ? "text-void-fg-2" : ""}`}
												>
													{step.description}
												</p>

												{/* Status Badge */}
												{getStatusBadge(status)}
											</div>

											{/* Actions Row */}
											{(approvalState === "pending" ||
												(approvalState === "executing" &&
													status === "failed")) &&
												!isCheckpointGhost && (
													<div className="flex items-center gap-2 mt-2">
														{approvalState === "pending" && !isRunning && (
															<button
																aria-label={`${isDisabled ? "Enable" : "Disable"} step ${step.stepNumber}`}
																onClick={() =>
																	handleToggleStep(step.stepNumber)
																}
																className="px-2 py-0.5 text-xs rounded bg-void-bg-2 text-void-fg-2 hover:bg-void-bg-2/80 border border-void-border-1 transition-colors"
															>
																{isDisabled ? "Enable" : "Disable"}
															</button>
														)}
														{approvalState === "executing" &&
															status === "failed" && (
																<>
																	<button
																		aria-label={`Retry step ${step.stepNumber}`}
																		onClick={() =>
																			chatThreadService.retryStep({
																				threadId,
																				messageIdx,
																				stepNumber: step.stepNumber,
																			})
																		}
																		className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors"
																	>
																		Retry
																	</button>
																	<button
																		aria-label={`Skip step ${step.stepNumber}`}
																		onClick={() =>
																			chatThreadService.skipStep({
																				threadId,
																				messageIdx,
																				stepNumber: step.stepNumber,
																			})
																		}
																		className="px-2 py-0.5 text-xs rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 border border-gray-500/20 transition-colors"
																	>
																		Skip
																	</button>
																	{step.checkpointIdx !== undefined &&
																		step.checkpointIdx !== null && (
																			<button
																				aria-label={`Rollback step ${step.stepNumber}`}
																				onClick={() => {
																					if (
																						confirm(
																							"Rollback to the checkpoint before this step?",
																						)
																					)
																						chatThreadService.rollbackToStep({
																							threadId,
																							messageIdx,
																							stepNumber: step.stepNumber,
																						});
																				}}
																				className="px-2 py-0.5 text-xs rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
																			>
																				Rollback
																			</button>
																		)}
																</>
															)}
													</div>
												)}

											{/* Expandable Details */}
											{hasDetails && (
												<button
													onClick={() => toggleStepExpanded(step.stepNumber)}
													className="mt-2 flex items-center gap-1 text-void-fg-3 hover:text-void-fg-2 text-xs transition-colors"
												>
													<ChevronRight
														size={12}
														className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
													/>
													<span>{isExpanded ? "Hide" : "Show"} details</span>
												</button>
											)}

											{/* Expanded Content */}
											{isExpanded && hasDetails && (
												<div className="mt-3 space-y-3 pt-3 border-t border-void-border-1">
													{step.tools && step.tools.length > 0 && (
														<div>
															<div className="text-void-fg-3 text-xs mb-2 font-medium">
																Expected Tools:
															</div>
															<div className="flex flex-wrap gap-1.5">
																{step.tools.map((tool, i) => (
																	<span
																		key={`${step.stepNumber}-tool-${tool}-${i}`}
																		className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded border border-blue-500/20"
																	>
																		{tool}
																	</span>
																))}
															</div>
														</div>
													)}
													{step.toolCalls && step.toolCalls.length > 0 && (
														<div>
															<div className="text-void-fg-3 text-xs mb-2 font-medium flex items-center gap-2">
																Tool Calls Executed{" "}
																<span className="inline-flex items-center justify-center rounded-full bg-void-bg-2 text-void-fg-3 text-[10px] px-1.5 py-0.5 border border-void-border-1">
																	{step.toolCalls.length}
																</span>
															</div>
															<div className="space-y-1.5">
																{step.toolCalls.map((toolId, i) => {
																	// Use memoized map for O(1) lookup instead of O(n) find
																	const toolMsg = toolMessagesMap.get(toolId);
																	if (!toolMsg) return null;

																	const isSuccess = toolMsg.type === "success";
																	const isError = toolMsg.type === "tool_error";

																	return (
																		<div
																			key={toolId}
																			className={`p-2 rounded border text-xs ${
																				isSuccess
																					? "bg-green-500/10 border-green-500/20"
																					: isError
																						? "bg-red-500/10 border-red-500/20"
																						: "bg-blue-500/10 border-blue-500/20"
																			}`}
																		>
																			<div className="flex items-center justify-between mb-1">
																				<span className="font-medium text-void-fg-1">
																					{toolMsg.name}
																				</span>
																				{isSuccess && (
																					<Check
																						size={12}
																						className="text-green-400"
																					/>
																				)}
																				{isError && (
																					<X
																						size={12}
																						className="text-red-400"
																					/>
																				)}
																			</div>
																			{isError && toolMsg.result && (
																				<div className="mt-1 text-red-400 text-xs">
																					{toolMsg.result}
																				</div>
																			)}
																			{isSuccess &&
																				toolMsg.result &&
																				typeof toolMsg.result === "object" && (
																					<details className="mt-1">
																						<summary className="text-void-fg-3 cursor-pointer text-xs hover:text-void-fg-2">
																							View result
																						</summary>
																						<pre className="mt-1 p-2 bg-void-bg-2 rounded text-xs overflow-auto max-h-32 border border-void-border-1">
																							{JSON.stringify(
																								toolMsg.result,
																								null,
																								2,
																							)}
																						</pre>
																					</details>
																				)}
																			{isError && toolMsg.params && (
																				<details className="mt-1">
																					<summary className="text-void-fg-3 cursor-pointer text-xs hover:text-void-fg-2">
																						View params
																					</summary>
																					<pre className="mt-1 p-2 bg-void-bg-2 rounded text-xs overflow-auto max-h-32 border border-void-border-1">
																						{JSON.stringify(
																							toolMsg.params,
																							null,
																							2,
																						)}
																					</pre>
																				</details>
																			)}
																		</div>
																	);
																})}
															</div>
														</div>
													)}
													{step.files && step.files.length > 0 && (
														<div>
															<div className="text-void-fg-3 text-xs mb-2 font-medium">
																Files Affected:
															</div>
															<div className="flex flex-wrap gap-1.5">
																{step.files.map((file, i) => (
																	<span
																		key={i}
																		className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded border border-purple-500/20 flex items-center gap-1"
																	>
																		<File size={12} />
																		{file.split("/").pop()}
																	</span>
																))}
															</div>
														</div>
													)}
													{step.error && (
														<div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs flex items-start gap-2">
															<AlertTriangle
																size={14}
																className="flex-shrink-0 mt-0.5"
															/>
															<span>{step.error}</span>
														</div>
													)}
													{step.startTime && step.endTime && (
														<div className="text-void-fg-3 text-xs">
															Duration:{" "}
															{((step.endTime - step.startTime) / 1000).toFixed(
																1,
															)}
															s
														</div>
													)}
													{step.checkpointIdx !== undefined &&
														step.checkpointIdx !== null && (
															<div className="text-void-fg-3 text-xs">
																Checkpoint: #{step.checkpointIdx}
															</div>
														)}
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		);
	},
	(prev, next) => {
		// Custom comparison: only re-render if plan message, checkpoint state, or thread changes
		return (
			prev.message === next.message &&
			prev.isCheckpointGhost === next.isCheckpointGhost &&
			prev.threadId === next.threadId &&
			prev.messageIdx === next.messageIdx
		);
	},
);

// Review Component - Shows summary after execution
const ReviewComponent = ({
	message,
	isCheckpointGhost,
}: {
	message: ReviewMessage;
	isCheckpointGhost: boolean;
}) => {
	return (
		<div className={`${isCheckpointGhost ? "opacity-50" : ""} my-2`}>
			<div
				className={`border rounded-lg p-4 ${
					message.completed
						? "bg-green-500/10 border-green-500/30"
						: "bg-amber-500/10 border-amber-500/30"
				}`}
			>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						{message.completed ? (
							<Check className="text-green-400" size={18} />
						) : (
							<AlertTriangle className="text-amber-400" size={18} />
						)}
						<h3
							className={`font-semibold text-sm ${
								message.completed ? "text-green-300" : "text-amber-300"
							}`}
						>
							{message.completed ? "Review Complete" : "Review: Issues Found"}
						</h3>
					</div>
					{(message.executionTime || message.stepsCompleted !== undefined) && (
						<div className="text-xs text-void-fg-3">
							{message.executionTime &&
								`${(message.executionTime / 1000).toFixed(1)}s`}
							{message.stepsCompleted !== undefined &&
								message.stepsTotal !== undefined && (
									<span className="ml-2">
										{message.stepsCompleted}/{message.stepsTotal} steps
									</span>
								)}
						</div>
					)}
				</div>
				<p className="text-void-fg-2 text-sm mb-3">{message.summary}</p>

				{message.filesChanged && message.filesChanged.length > 0 && (
					<div className="mb-3">
						<h4 className="text-void-fg-2 text-xs font-semibold mb-2">
							Files Changed:
						</h4>
						<div className="space-y-1">
							{message.filesChanged.map((file, i) => (
								<div key={i} className="flex items-center gap-2 text-xs">
									{file.changeType === "created" && (
										<CirclePlus className="text-green-400" size={12} />
									)}
									{file.changeType === "modified" && (
										<Pencil className="text-blue-400" size={12} />
									)}
									{file.changeType === "deleted" && (
										<X className="text-red-400" size={12} />
									)}
									<span className="text-void-fg-2">{file.path}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{message.issues && message.issues.length > 0 && (
					<div className="space-y-2 mb-3">
						{message.issues.map((issue, i) => (
							<div
								key={i}
								className={`flex gap-2 text-sm p-2 rounded ${
									issue.severity === "error"
										? "bg-red-500/10 border border-red-500/20"
										: issue.severity === "warning"
											? "bg-amber-500/10 border border-amber-500/20"
											: "bg-blue-500/10 border border-blue-500/20"
								}`}
							>
								{issue.severity === "error" ? (
									<X className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
								) : issue.severity === "warning" ? (
									<AlertTriangle
										className="text-amber-400 flex-shrink-0 mt-0.5"
										size={16}
									/>
								) : (
									<Info
										className="text-blue-400 flex-shrink-0 mt-0.5"
										size={16}
									/>
								)}
								<div className="flex-1">
									<p
										className={`${
											issue.severity === "error"
												? "text-red-300"
												: issue.severity === "warning"
													? "text-amber-300"
													: "text-blue-300"
										}`}
									>
										{issue.message}
									</p>
									{issue.file && (
										<p className="text-void-fg-3 text-xs mt-1 flex items-center gap-1">
											<File size={12} />
											{issue.file}
										</p>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{message.nextSteps && message.nextSteps.length > 0 && (
					<div className="mt-3 pt-3 border-t border-void-border-2">
						<p className="text-void-fg-3 text-xs mb-2 font-medium">
							Recommended Next Steps:
						</p>
						<ul className="space-y-1">
							{message.nextSteps.map((step, i) => (
								<li
									key={i}
									className="text-void-fg-2 text-xs flex items-start gap-2"
								>
									<span className="text-void-fg-4 mt-1">•</span>
									<span>{step}</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
};

const ChatBubble = React.memo(
	(props: ChatBubbleProps) => {
		return (
			<ErrorBoundary>
				<_ChatBubble {...props} />
			</ErrorBoundary>
		);
	},
	(prev, next) => {
		// Custom comparison: only re-render if props actually changed
		return (
			prev.chatMessage === next.chatMessage &&
			prev.messageIdx === next.messageIdx &&
			prev.isCommitted === next.isCommitted &&
			prev.chatIsRunning === next.chatIsRunning &&
			prev.currCheckpointIdx === next.currCheckpointIdx &&
			prev.threadId === next.threadId &&
			prev._scrollToBottom === next._scrollToBottom
		);
	},
);

const _ChatBubble = React.memo(
	({
		threadId,
		chatMessage,
		currCheckpointIdx,
		isCommitted,
		messageIdx,
		chatIsRunning,
		_scrollToBottom,
	}: ChatBubbleProps) => {
		const role = chatMessage.role;

		const isCheckpointGhost =
			messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning; // whether to show as gray (if chat is running, for good measure just dont show any ghosts)

		if (role === "user") {
			return (
				<UserMessageComponent
					chatMessage={chatMessage}
					isCheckpointGhost={isCheckpointGhost}
					currCheckpointIdx={currCheckpointIdx}
					messageIdx={messageIdx}
					_scrollToBottom={_scrollToBottom}
				/>
			);
		} else if (role === "assistant") {
			return (
				<AssistantMessageComponent
					chatMessage={chatMessage}
					isCheckpointGhost={isCheckpointGhost}
					messageIdx={messageIdx}
					isCommitted={isCommitted}
				/>
			);
		} else if (role === "tool") {
			if (chatMessage.type === "invalid_params") {
				return (
					<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
						<InvalidTool
							toolName={chatMessage.name}
							message={chatMessage.content}
							mcpServerName={chatMessage.mcpServerName}
						/>
					</div>
				);
			}

			const toolName = chatMessage.name;
			const isBuiltInTool = isABuiltinToolName(toolName);
			const ToolResultWrapper = isBuiltInTool
				? (builtinToolNameToComponent[toolName]
						?.resultWrapper as ResultWrapper<ToolName>)
				: (MCPToolWrapper as ResultWrapper<ToolName>);

			if (ToolResultWrapper)
				return (
					<>
						<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
							<ToolResultWrapper
								toolMessage={chatMessage}
								messageIdx={messageIdx}
								threadId={threadId}
							/>
						</div>
						{chatMessage.type === "tool_request" ? (
							<div
								className={`${isCheckpointGhost ? "opacity-50 pointer-events-none" : ""}`}
							>
								<ToolRequestAcceptRejectButtons toolName={chatMessage.name} />
							</div>
						) : null}
					</>
				);
			return null;
		} else if (role === "interrupted_streaming_tool") {
			return (
				<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
					<CanceledTool
						toolName={chatMessage.name}
						mcpServerName={chatMessage.mcpServerName}
					/>
				</div>
			);
		} else if (role === "checkpoint") {
			return (
				<Checkpoint
					threadId={threadId}
					message={chatMessage}
					messageIdx={messageIdx}
					isCheckpointGhost={isCheckpointGhost}
					threadIsRunning={!!chatIsRunning}
				/>
			);
		} else if (role === "plan") {
			return (
				<PlanComponent
					message={chatMessage}
					isCheckpointGhost={isCheckpointGhost}
					threadId={threadId}
					messageIdx={messageIdx}
				/>
			);
		} else if (role === "review") {
			return (
				<ReviewComponent
					message={chatMessage}
					isCheckpointGhost={isCheckpointGhost}
				/>
			);
		}
	},
	(prev, next) => {
		// Custom comparison for _ChatBubble
		return (
			prev.chatMessage === next.chatMessage &&
			prev.messageIdx === next.messageIdx &&
			prev.isCommitted === next.isCommitted &&
			prev.chatIsRunning === next.chatIsRunning &&
			prev.currCheckpointIdx === next.currCheckpointIdx &&
			prev.threadId === next.threadId &&
			prev._scrollToBottom === next._scrollToBottom
		);
	},
);

const CommandBarInChat = () => {
	const { stateOfURI: commandBarStateOfURI, sortedURIs: sortedCommandBarURIs } =
		useCommandBarState();
	const numFilesChanged = sortedCommandBarURIs.length;

	const accessor = useAccessor();
	const editCodeService = accessor.get("IEditCodeService");
	const commandService = accessor.get("ICommandService");
	const chatThreadsState = useChatThreadsState();
	const commandBarState = useCommandBarState();
	const chatThreadsStreamState = useChatThreadsStreamState(
		chatThreadsState.currentThreadId,
	);

	// (
	// 	<IconShell1
	// 		Icon={CopyIcon}
	// 		onClick={copyChatToClipboard}
	// 		data-tooltip-id='void-tooltip'
	// 		data-tooltip-place='top'
	// 		data-tooltip-content='Copy chat JSON'
	// 	/>
	// )

	const [fileDetailsOpenedState, setFileDetailsOpenedState] = useState<
		"auto-opened" | "auto-closed" | "user-opened" | "user-closed"
	>("auto-closed");
	const isFileDetailsOpened =
		fileDetailsOpenedState === "auto-opened" ||
		fileDetailsOpenedState === "user-opened";

	useEffect(() => {
		// close the file details if there are no files
		// this converts 'user-closed' to 'auto-closed'
		if (numFilesChanged === 0) {
			setFileDetailsOpenedState("auto-closed");
		}
		// open the file details if it hasnt been closed
		if (numFilesChanged > 0 && fileDetailsOpenedState !== "user-closed") {
			setFileDetailsOpenedState("auto-opened");
		}
	}, [fileDetailsOpenedState, setFileDetailsOpenedState, numFilesChanged]);

	const isFinishedMakingThreadChanges =
		// there are changed files
		commandBarState.sortedURIs.length !== 0 &&
		// none of the files are streaming
		commandBarState.sortedURIs.every(
			(uri) => !commandBarState.stateOfURI[uri.fsPath]?.isStreaming,
		);

	// ======== status of agent ========
	// This icon answers the question "is the LLM doing work on this thread?"
	// assume it is single threaded for now
	// green = Running
	// orange = Requires action
	// dark = Done

	const threadStatus =
		chatThreadsStreamState?.isRunning === "awaiting_user"
			? ({ title: "Needs Approval", color: "yellow" } as const)
			: chatThreadsStreamState?.isRunning === "LLM" ||
				chatThreadsStreamState?.isRunning === "tool" ||
				chatThreadsStreamState?.isRunning === "preparing"
				? ({
						title:
							chatThreadsStreamState?.isRunning === "preparing"
								? "Preparing"
								: "Running",
						color: "orange",
					} as const)
				: ({ title: "Done", color: "dark" } as const);

	const threadStatusHTML = (
		<StatusIndicator
			className="mx-1"
			indicatorColor={threadStatus.color}
			title={threadStatus.title}
		/>
	);

	// ======== info about changes ========
	// num files changed
	// acceptall + rejectall
	// popup info about each change (each with num changes + acceptall + rejectall of their own)

	const numFilesChangedStr =
		numFilesChanged === 0
			? "No files with changes"
			: `${sortedCommandBarURIs.length} file${numFilesChanged === 1 ? "" : "s"} with changes`;

	const acceptRejectAllButtons = (
		<div
			// do this with opacity so that the height remains the same at all times
			className={`flex items-center gap-0.5
			${isFinishedMakingThreadChanges ? "" : "opacity-0 pointer-events-none"}`}
		>
			<IconShell1 // RejectAllButtonWrapper
				// text="Reject All"
				// className="text-xs"
				Icon={X}
				onClick={() => {
					sortedCommandBarURIs.forEach((uri) => {
						editCodeService.acceptOrRejectAllDiffAreas({
							uri,
							removeCtrlKs: true,
							behavior: "reject",
							_addToHistory: true,
						});
					});
				}}
				data-tooltip-id="void-tooltip"
				data-tooltip-place="top"
				data-tooltip-content="Reject all"
			/>

			<IconShell1 // AcceptAllButtonWrapper
				// text="Accept All"
				// className="text-xs"
				Icon={Check}
				onClick={() => {
					sortedCommandBarURIs.forEach((uri) => {
						editCodeService.acceptOrRejectAllDiffAreas({
							uri,
							removeCtrlKs: true,
							behavior: "accept",
							_addToHistory: true,
						});
					});
				}}
				data-tooltip-id="void-tooltip"
				data-tooltip-place="top"
				data-tooltip-content="Accept all"
			/>
		</div>
	);

	// !select-text cursor-auto
	const fileDetailsContent = (
		<div className="px-2 gap-1 w-full overflow-y-auto">
			{sortedCommandBarURIs.map((uri, i) => {
				const basename = getBasename(uri.fsPath);

				const { sortedDiffIds, isStreaming } =
					commandBarStateOfURI[uri.fsPath] ?? {};
				const isFinishedMakingFileChanges = !isStreaming;

				const numDiffs = sortedDiffIds?.length || 0;

				const fileStatus = isFinishedMakingFileChanges
					? ({ title: "Done", color: "dark" } as const)
					: ({ title: "Running", color: "orange" } as const);

				const fileNameHTML = (
					<div
						className="flex items-center gap-1.5 text-void-fg-3 hover:brightness-125 transition-all duration-200 cursor-pointer"
						onClick={() => voidOpenFileFn(uri, accessor)}
					>
						{/* <FileIcon size={14} className="text-void-fg-3" /> */}
						<span className="text-void-fg-3">{basename}</span>
					</div>
				);

				const detailsContent = (
					<div className="flex px-4">
						<span className="text-void-fg-3 opacity-80">
							{numDiffs} diff{numDiffs !== 1 ? "s" : ""}
						</span>
					</div>
				);

				const acceptRejectButtons = (
					<div
						// do this with opacity so that the height remains the same at all times
						className={`flex items-center gap-0.5
					${isFinishedMakingFileChanges ? "" : "opacity-0 pointer-events-none"}
				`}
					>
						{/* <JumpToFileButton
					uri={uri}
					data-tooltip-id='void-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Go to file'
				/> */}
						<IconShell1 // RejectAllButtonWrapper
							Icon={X}
							onClick={() => {
								editCodeService.acceptOrRejectAllDiffAreas({
									uri,
									removeCtrlKs: true,
									behavior: "reject",
									_addToHistory: true,
								});
							}}
							data-tooltip-id="void-tooltip"
							data-tooltip-place="top"
							data-tooltip-content="Reject file"
						/>
						<IconShell1 // AcceptAllButtonWrapper
							Icon={Check}
							onClick={() => {
								editCodeService.acceptOrRejectAllDiffAreas({
									uri,
									removeCtrlKs: true,
									behavior: "accept",
									_addToHistory: true,
								});
							}}
							data-tooltip-id="void-tooltip"
							data-tooltip-place="top"
							data-tooltip-content="Accept file"
						/>
					</div>
				);

				const fileStatusHTML = (
					<StatusIndicator
						className="mx-1"
						indicatorColor={fileStatus.color}
						title={fileStatus.title}
					/>
				);

				return (
					// name, details
					<div key={i} className="flex justify-between items-center">
						<div className="flex items-center">
							{fileNameHTML}
							{detailsContent}
						</div>
						<div className="flex items-center gap-2">
							{acceptRejectButtons}
							{fileStatusHTML}
						</div>
					</div>
				);
			})}
		</div>
	);

	const fileDetailsButton = (
		<button
			className={`flex items-center gap-1 rounded ${numFilesChanged === 0 ? "cursor-pointer" : "cursor-pointer hover:brightness-125 transition-all duration-200"}`}
			onClick={() =>
				isFileDetailsOpened
					? setFileDetailsOpenedState("user-closed")
					: setFileDetailsOpenedState("user-opened")
			}
			type="button"
			disabled={numFilesChanged === 0}
		>
			<svg
				className="transition-transform duration-200 size-3.5"
				style={{
					transform: isFileDetailsOpened ? "rotate(0deg)" : "rotate(180deg)",
					transition: "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
				}}
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polyline points="18 15 12 9 6 15"></polyline>
			</svg>
			{numFilesChangedStr}
		</button>
	);

	return (
		<>
			{/* file details */}
			<div className="px-2">
				<div
					className={`
						select-none
						flex w-full rounded-t-lg bg-void-bg-3
						text-void-fg-3 text-xs text-nowrap

						overflow-hidden transition-all duration-200 ease-in-out
						${isFileDetailsOpened ? "max-h-24" : "max-h-0"}
					`}
				>
					{fileDetailsContent}
				</div>
			</div>
			{/* main content */}
			<div
				className={`
					select-none
					flex w-full rounded-t-lg bg-void-bg-3
					text-void-fg-3 text-xs text-nowrap
					border-t border-l border-r border-zinc-300/10

					px-2 py-1
					justify-between
				`}
			>
				<div className="flex gap-2 items-center">{fileDetailsButton}</div>
				<div className="flex gap-2 items-center">
					{acceptRejectAllButtons}
					{threadStatusHTML}
				</div>
			</div>
		</>
	);
};

const EditToolSoFar = ({
	toolCallSoFar,
}: {
	toolCallSoFar: RawToolCallObj;
}) => {
	if (!isABuiltinToolName(toolCallSoFar.name)) return null;

	const accessor = useAccessor();

	const uri = toolCallSoFar.rawParams.uri
		? URI.file(toolCallSoFar.rawParams.uri)
		: undefined;

	const title = titleOfBuiltinToolName[toolCallSoFar.name].proposed;

	const uriDone = toolCallSoFar.doneParams.includes("uri");
	const desc1 = (
		<span className="flex items-center">
			{uriDone
				? getBasename(toolCallSoFar.rawParams["uri"] ?? "unknown")
				: `Generating`}
			<IconLoading />
		</span>
	);

	const desc1OnClick = () => {
		uri && voidOpenFileFn(uri, accessor);
	};

	// If URI has not been specified
	return (
		<ToolHeaderWrapper title={title} desc1={desc1} desc1OnClick={desc1OnClick}>
			<EditToolChildren
				uri={uri}
				code={
					toolCallSoFar.rawParams.search_replace_blocks ??
					toolCallSoFar.rawParams.new_content ??
					""
				}
				type={"rewrite"} // as it streams, show in rewrite format, don't make a diff editor
			/>
			<IconLoading />
		</ToolHeaderWrapper>
	);
};

export const SidebarChat = () => {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
	const textAreaFnsRef = useRef<TextAreaFns | null>(null);

	const accessor = useAccessor();
	const commandService = accessor.get("ICommandService");
	const chatThreadsService = accessor.get("IChatThreadService");

	const settingsState = useSettingsState();
	// ----- HIGHER STATE -----

	// threads state
	const chatThreadsState = useChatThreadsState();

	const currentThread = chatThreadsService.getCurrentThread();
	const previousMessages = currentThread?.messages ?? [];

	const selections = currentThread.state.stagingSelections;
	const setSelections = (s: StagingSelectionItem[]) => {
		chatThreadsService.setCurrentThreadState({ stagingSelections: s });
	};

	// stream state
	const currThreadStreamState = useChatThreadsStreamState(
		chatThreadsState.currentThreadId,
	);
	const isRunning = currThreadStreamState?.isRunning;
	const latestError = currThreadStreamState?.error;
	const { displayContentSoFar, toolCallSoFar, reasoningSoFar } =
		currThreadStreamState?.llmInfo ?? {};

	// this is just if it's currently being generated, NOT if it's currently running
	const toolIsGenerating = toolCallSoFar && !toolCallSoFar.isDone; // show loading for slow tools (right now just edit)

	// ----- SIDEBAR CHAT state (local) -----

	// state of current message
	const initVal = "";
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(!initVal);

	// Image attachments management
	const {
		attachments: imageAttachments,
		addImages: addImagesRaw,
		removeImage,
		retryImage,
		cancelImage,
		clearAll: clearImages,
		focusedIndex: focusedImageIndex,
		setFocusedIndex: setFocusedImageIndex,
		validationError: imageValidationError,
	} = useImageAttachments();

	// PDF attachments management
	const {
		attachments: pdfAttachments,
		addPDFs: addPDFsRaw,
		removePDF,
		retryPDF,
		cancelPDF,
		clearAll: clearPDFs,
		focusedIndex: focusedPDFIndex,
		setFocusedIndex: setFocusedPDFIndex,
		validationError: pdfValidationError,
	} = usePDFAttachments();

	// Wrapper to check vision capabilities before adding PDFs
	// PDFs are more forgiving than images - they can work with non-vision models via text extraction
	const addPDFs = useCallback(
		async (files: File[]) => {
			const currentModelSel = settingsState.modelSelectionOfFeature["Chat"];

			// In auto mode, skip vision capability check - the router will select an appropriate model
			// PDFs can also work with non-vision models via text extraction, so we're more lenient
			if (
				currentModelSel?.providerName === "auto" &&
				currentModelSel?.modelName === "auto"
			) {
				await addPDFsRaw(files);
				return;
			}

			// For non-auto mode, allow PDFs even without vision models (they can use text extraction)
			// But we could optionally warn if no vision models are available
			await addPDFsRaw(files);
		},
		[addPDFsRaw, settingsState],
	);

	// Wrapper to check vision capabilities before adding images
	const addImages = useCallback(
		async (files: File[]) => {
			const currentModelSel = settingsState.modelSelectionOfFeature["Chat"];

			// In auto mode, skip vision capability check - the router will select an appropriate model
			if (
				currentModelSel?.providerName === "auto" &&
				currentModelSel?.modelName === "auto"
			) {
				await addImagesRaw(files);
				return;
			}

			// Check if user has vision-capable API keys or Ollama vision models
			const {
				isSelectedModelVisionCapable,
				checkOllamaModelVisionCapable,
				hasVisionCapableApiKey,
				hasOllamaVisionModel,
				isOllamaAccessible,
			} = await import("../util/visionModelHelper.js");

			// First, check if the currently selected model is vision-capable (synchronous check)
			let selectedIsVision = isSelectedModelVisionCapable(
				currentModelSel,
				settingsState.settingsOfProvider,
			);

			// If Ollama model and not detected by name, query Ollama API directly (async)
			if (!selectedIsVision && currentModelSel?.providerName === "ollama") {
				const ollamaAccessible = await isOllamaAccessible();
				if (ollamaAccessible) {
					selectedIsVision = await checkOllamaModelVisionCapable(
						currentModelSel.modelName,
					);
				}
			}

			if (selectedIsVision) {
				// User has selected a vision-capable model, proceed
				await addImagesRaw(files);
				return;
			}

			// If not selected, check if they have any vision-capable options available
			const hasApiKey = hasVisionCapableApiKey(
				settingsState.settingsOfProvider,
				currentModelSel,
			);
			const ollamaAccessible = await isOllamaAccessible();
			const hasOllamaVision =
				ollamaAccessible && (await hasOllamaVisionModel());

			if (!hasApiKey && !hasOllamaVision) {
				// Show notification with option to open Ollama setup
				const notificationService = accessor.get("INotificationService");
				const commandService = accessor.get("ICommandService");

				notificationService.notify({
					severity: 2, // Severity.Warning
					message:
						"No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava).",
					actions: {
						primary: [
							{
								id: "void.vision.setup",
								label: "Setup Ollama Vision Models",
								tooltip: "",
								class: undefined,
								enabled: true,
								run: () =>
									commandService.executeCommand(
										CORTEXIDE_OPEN_SETTINGS_ACTION_ID,
									),
							},
						],
					},
				});
				return;
			}

			// User has vision support available but not selected, proceed anyway (they might switch models)
			await addImagesRaw(files);
		},
		[addImagesRaw, settingsState, accessor],
	);

	const isDisabled =
		(instructionsAreEmpty &&
			imageAttachments.length === 0 &&
			pdfAttachments.length === 0) ||
		!!isFeatureNameDisabled("Chat", settingsState);

	const sidebarRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	// Memoize scrollToBottom callback to prevent unnecessary re-renders
	const scrollToBottomCallback = useCallback(() => {
		scrollToBottom(scrollContainerRef);
	}, [scrollContainerRef]);

	const onSubmit = useCallback(
		async (_forceSubmit?: string) => {
			if (isDisabled && !_forceSubmit) return;
			if (isRunning) return;

			// use subscribed state - currentThread.id is already from subscribed state
			const threadId = currentThread.id;

			// send message to LLM
			const userMessage = _forceSubmit || textAreaRef.current?.value || "";

			// Resolve @references in the input into staging selections before sending
			// Supports tokens like: @"src/app/file.ts", @path/to/file.ts, @folder, @workspace, @recent, @selection
			try {
				const toolsService = accessor.get("IToolsService");
				const workspaceService = accessor.get("IWorkspaceContextService");
				const editorService = accessor.get("IEditorService");
				const languageService = accessor.get("ILanguageService");
				const historyService = accessor.get("IHistoryService");
				const notificationService = accessor.get("INotificationService");
				let outlineService: any = undefined;
				try {
					outlineService = accessor.get("IOutlineModelService");
				} catch {}

				// Collect existing URIs to avoid duplicate attachments
				const existing = new Set<string>();
				const existingSelections =
					chatThreadsState.allThreads[currentThread.id]?.state
						?.stagingSelections || [];
				for (const s of existingSelections) existing.add(s.uri?.fsPath || "");

				const addFileSelection = async (uri: any) => {
					if (!uri) return;
					const key = uri.fsPath || uri.path || "";
					if (key && existing.has(key)) return;
					existing.add(key);
					const newSel = {
						type: "File",
						uri,
						language:
							languageService.guessLanguageIdByFilepathOrFirstLine(uri) || "",
						state: { wasAddedAsCurrentFile: false },
					};
					await chatThreadsService.addNewStagingSelection(newSel);
				};

				const addFolderSelection = async (uri: any) => {
					if (!uri) return;
					const key = uri.fsPath || uri.path || "";
					if (key && existing.has(key)) return;
					existing.add(key);
					const newSel = {
						type: "Folder",
						uri,
						language: undefined,
						state: undefined,
					};
					await chatThreadsService.addNewStagingSelection(newSel);
				};

				const tokens: string[] = [];
				{
					// Extract quoted paths first: @"..."
					const quoted = [...userMessage.matchAll(/@"([^"]+)"/g)].map(
						(m) => m[1],
					);
					tokens.push(...quoted);
					// Extract bare @word-like tokens (stop at whitespace or punctuation)
					for (const m of userMessage.matchAll(
						/@([\w\.\-_/]+(?::\d+(?:-\d+)?)?)/g,
					)) {
						const t = m[1];
						if (t) tokens.push(t);
					}
				}

				const special = new Set(["selection", "workspace", "recent", "folder"]);

				// Track unresolved references for error reporting
				const unresolvedRefs: string[] = [];

				for (const raw of tokens) {
					// Handle special tokens
					if (raw === "selection") {
						const active = editorService.activeTextEditorControl;
						const activeResource = editorService.activeEditor?.resource;
						const sel = active?.getSelection?.();
						if (activeResource && sel && !sel.isEmpty()) {
							const newSel = {
								type: "File",
								uri: activeResource,
								language:
									languageService.guessLanguageIdByFilepathOrFirstLine(
										activeResource,
									) || "",
								state: { wasAddedAsCurrentFile: false },
								range: sel,
							};
							const key = activeResource.fsPath || "";
							if (!existing.has(key)) {
								existing.add(key);
								await chatThreadsService.addNewStagingSelection(newSel);
							}
						} else {
							unresolvedRefs.push("@selection (no active selection)");
						}
						continue;
					}
					if (raw === "workspace") {
						for (const folder of workspaceService.getWorkspace().folders) {
							await addFolderSelection(folder.uri);
						}
						continue;
					}
					if (raw === "recent") {
						for (const h of historyService.getHistory()) {
							if (h.resource) await addFileSelection(h.resource);
						}
						continue;
					}

					// Handle explicit symbol: @sym:Name or @symbol:Name
					if (raw.startsWith("sym:") || raw.startsWith("symbol:")) {
						const symName = raw.replace(/^symbol?:/, "");
						let symbolFound = false;
						if (
							outlineService &&
							typeof outlineService.getCachedModels === "function"
						) {
							try {
								const models = outlineService.getCachedModels();
								for (const om of models) {
									const list =
										typeof om.asListOfDocumentSymbols === "function"
											? om.asListOfDocumentSymbols()
											: [];
									for (const s of list) {
										if (
											(s?.name || "").toLowerCase() === symName.toLowerCase()
										) {
											symbolFound = true;
											const uri = om.uri;
											const range = s.range;
											const key = uri?.fsPath || "";
											if (!existing.has(key)) {
												existing.add(key);
												await chatThreadsService.addNewStagingSelection({
													type: "File",
													uri,
													language:
														languageService.guessLanguageIdByFilepathOrFirstLine(
															uri,
														) || "",
													state: { wasAddedAsCurrentFile: false },
													range,
												});
											}
										}
									}
								}
							} catch (err) {
								// Service error - log but continue
								console.warn("Error resolving symbol:", err);
							}
						}
						if (!symbolFound) {
							unresolvedRefs.push(`@${raw} (symbol not found)`);
						}
						continue;
					}

					// Handle explicit folder keyword like: @folder:path or plain name that matches a folder
					let query = raw;
					let isFolderHint = false;
					if (raw.startsWith("folder:")) {
						isFolderHint = true;
						query = raw.slice("folder:".length);
					}

					// Use tools service to resolve best match in workspace
					let resolved = false;
					try {
						const res = await (
							await toolsService.callTool.search_pathnames_only({
								query,
								includePattern: null,
								pageNumber: 1,
							})
						).result;
						const [first] = res.uris || [];
						if (first) {
							resolved = true;
							// Heuristic: if hint says folder or resolved path ends with '/', treat as folder
							if (isFolderHint) await addFolderSelection(first);
							else await addFileSelection(first);
						}
					} catch (err) {
						// Service error - log but continue
						console.warn("Error resolving reference:", err);
					}
					if (!resolved) {
						unresolvedRefs.push(`@${raw}`);
					}
				}

				// Report unresolved references to user
				if (unresolvedRefs.length > 0) {
					const refList = unresolvedRefs.slice(0, 3).join(", ");
					const moreText =
						unresolvedRefs.length > 3
							? ` and ${unresolvedRefs.length - 3} more`
							: "";
					notificationService.warn(
						`Could not resolve reference${unresolvedRefs.length > 1 ? "s" : ""}: ${refList}${moreText}. Please check the file path or symbol name.`,
					);
				}
			} catch (err) {
				// Best-effort; do not block send, but log error
				console.warn("Error resolving @references:", err);
			}

			// Convert image attachments to ChatImageAttachment format
			const images: ChatImageAttachment[] = imageAttachments
				.filter((att) => att.uploadStatus === "success" || !att.uploadStatus)
				.map((att) => ({
					id: att.id,
					data: att.data,
					mimeType: att.mimeType,
					filename: att.filename,
					width: att.width,
					height: att.height,
					size: att.size,
				}));

			// Check if any PDFs are still processing
			const processingPDFs = pdfAttachments.filter(
				(att) =>
					att.uploadStatus === "uploading" || att.uploadStatus === "processing",
			);

			if (processingPDFs.length > 0) {
				const processingNames = processingPDFs
					.map((p) => p.filename)
					.join(", ");
				notificationService.warn(
					`Some PDFs are still processing: ${processingNames}. They will be sent but may not have extracted text available yet.`,
				);
			}

			// Convert PDF attachments to ChatPDFAttachment format
			// Include PDFs that are successful, have no status, or are still processing (they might have partial data)
			// Exclude only failed PDFs
			const pdfs: ChatPDFAttachment[] = pdfAttachments
				.filter((att) => att.uploadStatus !== "failed")
				.map((att) => ({
					id: att.id,
					data: att.data,
					filename: att.filename,
					size: att.size,
					pageCount: att.pageCount,
					selectedPages: att.selectedPages,
					extractedText: att.extractedText,
					pagePreviews: att.pagePreviews,
				}));

			// Validate that model supports vision/PDFs if attachments are present
			const currentModelSel = settingsState.modelSelectionOfFeature["Chat"];
			if ((images.length > 0 || pdfs.length > 0) && currentModelSel) {
				const {
					isSelectedModelVisionCapable,
					checkOllamaModelVisionCapable,
					hasVisionCapableApiKey,
					hasOllamaVisionModel,
					isOllamaAccessible,
				} = await import("../util/visionModelHelper.js");

				// In auto mode, check if user has any vision-capable models available
				if (
					currentModelSel.providerName === "auto" &&
					currentModelSel.modelName === "auto"
				) {
					// Images require vision-capable models (no fallback)
					if (images.length > 0) {
						const hasApiKey = hasVisionCapableApiKey(
							settingsState.settingsOfProvider,
							currentModelSel,
						);
						const ollamaAccessible = await isOllamaAccessible();
						const hasOllamaVision =
							ollamaAccessible && (await hasOllamaVisionModel());

						if (!hasApiKey && !hasOllamaVision) {
							notificationService.error(
								"No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava) to use images.",
							);
							return;
						}
					}
					// PDFs can work with non-vision models via text extraction, so we allow them even without vision-capable models
					// If vision-capable models are available, router will select appropriate model
				} else {
					// For non-auto mode, check if the selected model is vision-capable
					let isVisionCapable = isSelectedModelVisionCapable(
						currentModelSel,
						settingsState.settingsOfProvider,
					);

					// If Ollama, check via API
					if (!isVisionCapable && currentModelSel.providerName === "ollama") {
						const ollamaAccessible = await isOllamaAccessible();
						if (ollamaAccessible) {
							isVisionCapable = await checkOllamaModelVisionCapable(
								currentModelSel.modelName,
							);
						}
					}

					// If not vision-capable, show error
					if (!isVisionCapable) {
						const hasApiKey = hasVisionCapableApiKey(
							settingsState.settingsOfProvider,
							currentModelSel,
						);
						const ollamaAccessible = await isOllamaAccessible();
						const hasOllamaVision =
							ollamaAccessible && (await hasOllamaVisionModel());

						if (!hasApiKey && !hasOllamaVision) {
							notificationService.error(
								"The selected model does not support images or PDFs. Please select a vision-capable model (e.g., Claude, GPT-4, Gemini, or an Ollama vision model like llava).",
							);
							return;
						} else {
							notificationService.warn(
								"The selected model may not support images or PDFs. Consider switching to a vision-capable model for better results.",
							);
						}
					}
				}
			}

			// Capture staging selections BEFORE clearing them, so they're included in the message
			const stagingSelections =
				chatThreadsState.allThreads[currentThread.id]?.state
					?.stagingSelections || [];

			// Optimistic UI: Clear input and attachments immediately for perceived responsiveness
			setSelections([]); // clear staging
			if (textAreaFnsRef.current) {
				textAreaFnsRef.current.setValue("");
			}
			clearImages(); // clear image attachments
			clearPDFs(); // clear PDF attachments
			textAreaRef.current?.focus(); // focus input after submit

			// Send message (non-blocking for UI responsiveness)
			try {
				await chatThreadsService.addUserMessageAndStreamResponse({
					userMessage,
					threadId,
					images,
					pdfs,
					_chatSelections: stagingSelections,
				});
			} catch (e) {
				console.error("Error while sending message in chat:", e);
			}
		},
		[
			chatThreadsService,
			isDisabled,
			isRunning,
			textAreaRef,
			textAreaFnsRef,
			setSelections,
			settingsState,
			imageAttachments,
			pdfAttachments,
			clearImages,
			clearPDFs,
			currentThread.id,
		],
	);

	const onAbort = async () => {
		const threadId = currentThread.id;
		await chatThreadsService.abortRunning(threadId);
	};

	const keybindingString = accessor
		.get("IKeybindingService")
		.lookupKeybinding(CORTEXIDE_CTRL_L_ACTION_ID)
		?.getLabel();

	const threadId = currentThread.id;
	const currCheckpointIdx =
		chatThreadsState.allThreads[threadId]?.state?.currCheckpointIdx ??
		undefined; // if not exist, treat like checkpoint is last message (infinity)

	// resolve mount info
	// Accessing .current is safe - refs don't trigger re-renders when changed
	const mountedInfo = chatThreadsState.allThreads[threadId]?.state.mountedInfo;
	const isResolved = mountedInfo?.mountedIsResolvedRef.current;
	useEffect(() => {
		if (isResolved) return;
		mountedInfo?._whenMountedResolver?.({
			textAreaRef: textAreaRef,
			scrollToBottom: scrollToBottomCallback,
		});
	}, [
		threadId,
		textAreaRef,
		scrollContainerRef,
		isResolved,
		mountedInfo,
		scrollToBottomCallback,
	]);

	const previousMessagesHTML = useMemo(() => {
		// const lastMessageIdx = previousMessages.findLastIndex(v => v.role !== 'checkpoint')
		// tool request shows up as Editing... if in progress
		// Use stable keys based on message ID or index for better React reconciliation
		return previousMessages.map((message, i) => {
			// Use message ID if available, otherwise fall back to index
			const messageKey = (message as any).id || `msg-${i}`;
			return (
				<ChatBubble
					key={messageKey}
					currCheckpointIdx={currCheckpointIdx}
					chatMessage={message}
					messageIdx={i}
					isCommitted={true}
					chatIsRunning={isRunning}
					threadId={threadId}
					_scrollToBottom={scrollToBottomCallback}
				/>
			);
		});
	}, [
		previousMessages,
		threadId,
		currCheckpointIdx,
		isRunning,
		scrollToBottomCallback,
	]);

	const streamingChatIdx = previousMessagesHTML.length;
	// Memoize chatMessage object to avoid recreating on every render
	const streamingChatMessage = useMemo(
		() => ({
			role: "assistant" as const,
			displayContent: displayContentSoFar ?? "",
			reasoning: reasoningSoFar ?? "",
			anthropicReasoning: null,
		}),
		[displayContentSoFar, reasoningSoFar],
	);

	// Only show streaming message when actively streaming (LLM, tool, or preparing)
	// Don't show when idle/undefined to prevent duplicate messages and never-ending loading
	// Only show stop button when actively running (LLM, tool, preparing), not when idle
	const isActivelyStreaming =
		isRunning === "LLM" || isRunning === "tool" || isRunning === "preparing";

	const activityStatus = useMemo(() => {
		if (!isActivelyStreaming) {
			return null;
		}

		// Prefer explicit status text from the stream state when preparing
		if (isRunning === "preparing") {
			const primary =
				displayContentSoFar && displayContentSoFar.trim().length > 0
					? displayContentSoFar
					: "Preparing your request…";
			return { primary, secondary: undefined as string | undefined };
		}

		// Tool phase – surface which tool is running when possible
		if (isRunning === "tool" || toolIsGenerating) {
			let toolLabel = "Running tools…";
			if (toolCallSoFar?.name) {
				toolLabel = `Running tool: ${toolCallSoFar.name}`;
			}
			return {
				primary: toolLabel,
				secondary: "Applying changes and reading from your project.",
			};
		}

		// LLM phase – distinguish thinking vs. writing
		if (isRunning === "LLM") {
			if (!displayContentSoFar && !reasoningSoFar) {
				return {
					primary: "Thinking through your request…",
					secondary: "Analyzing your code, context, and instructions.",
				};
			}

			if (reasoningSoFar && !displayContentSoFar) {
				return {
					primary: "Planning the best set of changes…",
					secondary: undefined,
				};
			}

			if (displayContentSoFar) {
				return {
					primary: "Writing the answer…",
					secondary: undefined,
				};
			}
		}

		return {
			primary: "Working on your request…",
			secondary: undefined,
		};
	}, [
		isActivelyStreaming,
		isRunning,
		displayContentSoFar,
		reasoningSoFar,
		toolIsGenerating,
		toolCallSoFar,
	]);

	const currStreamingMessageHTML =
		isActivelyStreaming && (reasoningSoFar || displayContentSoFar) ? (
			<ChatBubble
				key={"curr-streaming-msg"}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={streamingChatMessage}
				messageIdx={streamingChatIdx}
				isCommitted={false}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={null}
			/>
		) : null;

	// the tool currently being generated
	const generatingTool = toolIsGenerating ? (
		toolCallSoFar.name === "edit_file" ||
		toolCallSoFar.name === "rewrite_file" ? (
			<EditToolSoFar
				key={"curr-streaming-tool"}
				toolCallSoFar={toolCallSoFar}
			/>
		) : null
	) : null;

	const messagesHTML = (
		<ScrollToBottomContainer
			key={"messages" + chatThreadsState.currentThreadId} // force rerender on all children if id changes
			scrollContainerRef={scrollContainerRef}
			className={`
			flex flex-col
			px-4 py-4 space-y-4
			w-full h-full
			overflow-x-hidden
			overflow-y-auto
			${previousMessagesHTML.length === 0 && !displayContentSoFar ? "hidden" : ""}
		`}
		>
			{/* previous messages */}
			{previousMessagesHTML}
			{currStreamingMessageHTML}

			{/* Generating tool */}
			{generatingTool}

			{/* Claude-style activity banner with spinner + loading indicator with token count */}
			{activityStatus ? (
				<ProseWrapper>
					<div className="mt-1 mb-2 inline-flex items-start gap-2.5 text-xs text-void-fg-3 transition-opacity duration-300 ease-in-out">
						<div className="flex-shrink-0 mt-0.5">
							<IconLoading
								className="opacity-80"
								showSpinner={true}
								size={16}
								showTokenCount={
									// Only show token count when actively streaming (LLM)
									// When isRunning is 'idle' or undefined, the message is complete and token count should stop
									displayContentSoFar && isRunning === "LLM"
										? Math.ceil(displayContentSoFar.length / 4)
										: undefined
								}
							/>
						</div>
						<div className="flex flex-col gap-0.5 min-w-0">
							<span className="font-medium text-void-fg-2 leading-tight">
								{activityStatus.primary}
							</span>
							{activityStatus.secondary && (
								<span className="text-void-fg-4 leading-tight text-[11px]">
									{activityStatus.secondary}
								</span>
							)}
						</div>
					</div>
				</ProseWrapper>
			) : null}

			{/* error message */}
			{latestError === undefined ? null : (
				<div className="px-2 my-1">
					<ErrorDisplay
						message={latestError.message}
						fullError={latestError.fullError}
						onDismiss={() => {
							chatThreadsService.dismissStreamError(currentThread.id);
						}}
						showDismiss={true}
					/>

					<WarningBox
						className="text-sm my-1 mx-3"
						onClick={() => {
							commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID);
						}}
						text="Open settings"
					/>
				</div>
			)}
		</ScrollToBottomContainer>
	);

	const onChangeText = useCallback(
		(newStr: string) => {
			setInstructionsAreEmpty(!newStr);
		},
		[setInstructionsAreEmpty],
	);
	const onKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
				onSubmit();
			} else if (e.key === "Escape" && isRunning) {
				onAbort();
			}
		},
		[onSubmit, onAbort, isRunning],
	);

	// Context usage calculation + warning (partially memoized - draft tokens calculated on each render)
	const [ctxWarned, setCtxWarned] = useState(false);
	const estimateTokens = useCallback(
		(s: string) => Math.ceil((s || "").length / 4),
		[],
	);
	const modelSel = settingsState.modelSelectionOfFeature["Chat"];

	// Memoize context budget and messages tokens (only recalculate when messages or model changes)
	const { contextBudget, messagesTokens } = useMemo(() => {
		let budget = 0;
		let tokens = 0;
		if (modelSel && isValidProviderModelSelection(modelSel)) {
			const { providerName, modelName } = modelSel;
			const caps = getModelCapabilities(
				providerName,
				modelName,
				settingsState.overridesOfModel,
			);
			const contextWindow = caps.contextWindow;
			const msOpts =
				settingsState.optionsOfModelSelection["Chat"][providerName]?.[
					modelName
				];
			const isReasoningEnabled2 = getIsReasoningEnabledState(
				"Chat",
				providerName,
				modelName,
				msOpts,
				settingsState.overridesOfModel,
			);
			const rot =
				getReservedOutputTokenSpace(providerName, modelName, {
					isReasoningEnabled: isReasoningEnabled2,
					overridesOfModel: settingsState.overridesOfModel,
				}) || 0;
			budget = Math.max(256, Math.floor(contextWindow * 0.8) - rot);
			tokens = previousMessages.reduce((acc, m) => {
				if (m.role === "user") return acc + estimateTokens(m.content || "");
				if (m.role === "assistant")
					return (
						acc +
						estimateTokens(
							(m.displayContent as string) || m.content || "" || "",
						)
					);
				return acc;
			}, 0);
		}
		return { contextBudget: budget, messagesTokens: tokens };
	}, [
		modelSel,
		previousMessages,
		settingsState.overridesOfModel,
		estimateTokens,
	]);

	// Calculate draft tokens and total on each render (draft changes frequently)
	const draftTokens = estimateTokens(textAreaRef.current?.value || "");
	const contextTotal = messagesTokens + draftTokens;
	const contextPct = contextBudget > 0 ? contextTotal / contextBudget : 0;

	useEffect(() => {
		if (contextPct > 0.8 && contextPct < 1 && !ctxWarned) {
			try {
				accessor
					.get("INotificationService")
					.info(
						`Context nearing limit: ~${contextTotal} / ${contextBudget} tokens. Older messages may be summarized.`,
					);
			} catch {}
			setCtxWarned(true);
		}
		if (contextPct < 0.6 && ctxWarned) setCtxWarned(false);
	}, [contextPct, ctxWarned, contextTotal, contextBudget, accessor]);

	const inputChatArea = (
		<VoidChatArea
			featureName="Chat"
			onSubmit={() => onSubmit()}
			onAbort={onAbort}
			isStreaming={isActivelyStreaming}
			isDisabled={isDisabled}
			showSelections={true}
			// showProspectiveSelections={previousMessagesHTML.length === 0}
			selections={selections}
			setSelections={setSelections}
			onClickAnywhere={() => {
				textAreaRef.current?.focus();
			}}
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
						{imageValidationError && (
							<div className="px-2 py-1 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-md mx-2">
								{imageValidationError.message}
							</div>
						)}
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
						{pdfValidationError && (
							<div className="px-2 py-1 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-md mx-2">
								{pdfValidationError}
							</div>
						)}
					</>
				) : null
			}
		>
			<VoidInputBox2
				enableAtToMention
				appearance="chatDark"
				className={`min-h-[60px] px-3 py-3 rounded-2xl`}
				placeholder="Plan, @ for context"
				onChangeText={onChangeText}
				onKeyDown={onKeyDown}
				onFocus={() => {
					chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);
				}}
				ref={textAreaRef}
				fnsRef={textAreaFnsRef}
				multiline={true}
			/>

			{/* Context chips for current selections */}
			{selections.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1.5 px-1">
					{selections.map((sel, idx) => {
						const name =
							sel.type === "Folder"
								? sel.uri?.path?.split("/").filter(Boolean).pop() || "folder"
								: sel.uri?.path?.split("/").pop() || "file";
						const fullPath = sel.uri?.fsPath || sel.uri?.path || name;
						const rangeLabel = (sel as any).range
							? ` • ${(sel as any).range.startLineNumber}-${(sel as any).range.endLineNumber}`
							: "";
						const tooltipText = (sel as any).range
							? `${fullPath} (lines ${(sel as any).range.startLineNumber}-${(sel as any).range.endLineNumber})`
							: fullPath;
						return (
							<span
								key={idx}
								className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-void-border-3 bg-void-bg-2 text-void-fg-2 text-[11px] hover:bg-void-bg-2-alt hover:border-void-border-2 transition-colors"
								title={tooltipText}
								aria-label={tooltipText}
							>
								<span className="opacity-80">
									{sel.type === "Folder" ? "Folder" : "File"}
								</span>
								<span className="text-void-fg-1">{name}</span>
								{rangeLabel && <span className="opacity-70">{rangeLabel}</span>}
								<button
									className="ml-1 text-void-fg-3 hover:text-void-fg-1 transition-colors"
									onClick={() => {
										// remove single selection
										chatThreadsService.popStagingSelections(1);
									}}
									aria-label={`Remove ${name}`}
								>
									×
								</button>
							</span>
						);
					})}
				</div>
			)}
		</VoidChatArea>
	);

	const isLandingPage = previousMessages.length === 0;

	const initiallySuggestedPromptsHTML = (
		<div className="flex flex-col gap-2 w-full text-nowrap select-none">
			{[
				"Summarize my codebase",
				"How do types work in Rust?",
				"Create a .voidrules file for me",
			].map((text, index) => (
				<div
					key={index}
					className="py-2 px-3 rounded-md text-sm bg-void-bg-2 border border-void-border-3 text-void-fg-2 hover:bg-void-bg-2-alt hover:border-void-border-2 hover:text-void-fg-1 cursor-pointer transition-all duration-200 ease-out"
					onClick={() => onSubmit(text)}
				>
					{text}
				</div>
			))}
		</div>
	);

	const threadPageInput = (
		<div key={"input" + chatThreadsState.currentThreadId}>
			<div className="px-4 pt-2">
				<CommandBarInChat />
			</div>
			<div className="px-4 pb-4">
				{inputChatArea}

				{/* Context usage indicator */}
				{modelSel
					? (() => {
							const pctNum = Math.max(
								0,
								Math.min(100, Math.round(contextPct * 100)),
							);
							const color =
								contextPct >= 1
									? "text-red-500"
									: contextPct > 0.8
										? "text-amber-500"
										: "text-void-fg-3";
							const barColor =
								contextPct >= 1
									? "bg-red-500"
									: contextPct > 0.8
										? "bg-amber-500"
										: "bg-void-fg-3/60";
							return (
								<div className="mt-1">
									<div className={`text-[10px] ${color}`}>
										Context ~{contextTotal} / {contextBudget} tokens ({pctNum}%)
									</div>
									<div className="h-[3px] w-full bg-void-border-3 rounded mt-0.5">
										<div
											className={`h-[3px] ${barColor} rounded`}
											style={{ width: `${pctNum}%` }}
											aria-label={`Context usage ${pctNum}%`}
										/>
									</div>
								</div>
							);
						})()
					: null}
			</div>
		</div>
	);

	const landingPageInput = (
		<div>
			<div className="pt-6">
				{inputChatArea}
				{modelSel
					? (() => {
							const pctNum = Math.max(
								0,
								Math.min(100, Math.round(contextPct * 100)),
							);
							const color =
								contextPct >= 1
									? "text-red-500"
									: contextPct > 0.8
										? "text-amber-500"
										: "text-void-fg-3";
							const barColor =
								contextPct >= 1
									? "bg-red-500"
									: contextPct > 0.8
										? "bg-amber-500"
										: "bg-void-fg-3/60";
							return (
								<div className="mt-1 px-2">
									<div className={`text-[10px] ${color}`}>
										Context ~{contextTotal} / {contextBudget} tokens ({pctNum}%)
									</div>
									<div className="h-[3px] w-full bg-void-border-3 rounded mt-0.5">
										<div
											className={`h-[3px] ${barColor} rounded`}
											style={{ width: `${pctNum}%` }}
											aria-label={`Context usage ${pctNum}%`}
										/>
									</div>
								</div>
							);
						})()
					: null}
			</div>
		</div>
	);

	const keybindingService = accessor.get("IKeybindingService");
	const quickActions: { id: string; label: string }[] = [
		{ id: "void.explainCode", label: "Explain" },
		{ id: "void.refactorCode", label: "Refactor" },
		{ id: "void.addTests", label: "Add Tests" },
		{ id: "void.fixTests", label: "Fix Tests" },
		{ id: "void.writeDocstring", label: "Docstring" },
		{ id: "void.optimizeCode", label: "Optimize" },
		{ id: "void.debugCode", label: "Debug" },
	];

	const QuickActionsBar = () => (
		<div className="w-full flex items-center justify-center gap-2 flex-wrap mt-4 select-none px-1">
			{quickActions.map(({ id, label }) => {
				const kb = keybindingService.lookupKeybinding(id)?.getLabel();
				return (
					<button
						key={id}
						className="px-3 py-1.5 rounded-md bg-void-bg-2 border border-void-border-3 text-xs text-void-fg-1 hover:bg-void-bg-2-alt hover:border-void-border-2 hover:-translate-y-0.5 transition-all duration-200 ease-out void-focus-ring"
						onClick={() => commandService.executeCommand(id)}
						title={kb ? `${label} (${kb})` : label}
					>
						<span>{label}</span>
						{kb && (
							<span className="ml-1 px-1 rounded bg-[var(--vscode-keybindingLabel-background)] text-[var(--vscode-keybindingLabel-foreground)] border border-[var(--vscode-keybindingLabel-border)]">
								{kb}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);

	// Lightweight context chips: active file and model
	const ContextChipsBar = () => {
		const editorService = accessor.get("IEditorService");
		const activeEditor = editorService?.activeEditor;
		// Try best-effort file label
		const activeResource = activeEditor?.resource;
		const activeFileLabel = activeResource
			? activeResource.path?.split("/").pop()
			: undefined;
		const modelSel = settingsState.modelSelectionOfFeature["Chat"];
		const modelLabel = modelSel
			? `${modelSel.providerName}:${modelSel.modelName}`
			: undefined;
		if (!activeFileLabel && !modelLabel) return null;
		return (
			<div className="w-full flex items-center gap-2 flex-wrap mt-3 mb-1 px-1">
				{activeFileLabel && (
					<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-void-border-3 bg-void-bg-2 text-void-fg-2 text-[11px]">
						<span>File</span>
						<span className="text-void-fg-1">{activeFileLabel}</span>
					</span>
				)}
				{modelLabel && (
					<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-void-border-3 bg-void-bg-2 text-void-fg-2 text-[11px]">
						<span>Model</span>
						<span className="text-void-fg-1">{modelLabel}</span>
					</span>
				)}
			</div>
		);
	};

	const landingPageContent = (
		<div
			ref={sidebarRef}
			className="w-full h-full flex flex-col overflow-auto px-4"
		>
			<ErrorBoundary>{landingPageInput}</ErrorBoundary>

			{/* Context chips */}
			<ErrorBoundary>
				<ContextChipsBar />
			</ErrorBoundary>

			{/* Quick Actions shortcuts */}
			<ErrorBoundary>
				<QuickActionsBar />
			</ErrorBoundary>

			{Object.keys(chatThreadsState.allThreads).length > 1 ? ( // show if there are threads
				<ErrorBoundary>
					<div className="pt-8 mb-3 text-void-fg-3 text-sm font-medium select-none pointer-events-none">
						Previous Threads
					</div>
					<PastThreadsList />
				</ErrorBoundary>
			) : (
				<ErrorBoundary>
					<div className="pt-8 mb-3 text-void-fg-3 text-sm font-medium select-none pointer-events-none">
						Suggestions
					</div>
					{initiallySuggestedPromptsHTML}
				</ErrorBoundary>
			)}
		</div>
	);

	// const threadPageContent = <div>
	// 	{/* Thread content */}
	// 	<div className='flex flex-col overflow-hidden'>
	// 		<div className={`overflow-hidden ${previousMessages.length === 0 ? 'h-0 max-h-0 pb-2' : ''}`}>
	// 			<ErrorBoundary>
	// 				{messagesHTML}
	// 			</ErrorBoundary>
	// 		</div>
	// 		<ErrorBoundary>
	// 			{inputForm}
	// 		</ErrorBoundary>
	// 	</div>
	// </div>
	const threadPageContent = (
		<div
			ref={sidebarRef}
			className="w-full h-full flex flex-col overflow-hidden"
		>
			<ErrorBoundary>{messagesHTML}</ErrorBoundary>
			<ErrorBoundary>{threadPageInput}</ErrorBoundary>
		</div>
	);

	// Chat Tabs Bar Component - displays all threads as tabs
	const ChatTabsBar = () => {
		// Track threads that have been accessed in the current session
		const accessedThreadsRef = useRef<Set<string>>(new Set());

		// Update accessed threads when switching
		useEffect(() => {
			if (chatThreadsState.currentThreadId) {
				accessedThreadsRef.current.add(chatThreadsState.currentThreadId);
			}
		}, [chatThreadsState.currentThreadId]);

		// Only show threads that are actively being used, not all historical threads
		// This prevents closed tabs from reappearing
		const MAX_TABS_TO_SHOW = 12;
		const now = Date.now();
		const RECENT_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

		const allThreadIds = Object.keys(chatThreadsState.allThreads)
			.filter((threadId) => {
				const thread = chatThreadsState.allThreads[threadId];
				if (!thread) return false;

				// Always include the current thread
				if (threadId === chatThreadsState.currentThreadId) return true;

				// Only include threads that have messages (active chats)
				if (thread.messages.length === 0) return false;

				// Include threads accessed in current session
				if (accessedThreadsRef.current.has(threadId)) return true;

				// Include threads accessed recently (within last 24 hours)
				const lastModified = new Date(thread.lastModified).getTime();
				return (now - lastModified) < RECENT_THRESHOLD;
			})
			.sort((a, b) => {
				const threadA = chatThreadsState.allThreads[a];
				const threadB = chatThreadsState.allThreads[b];
				if (!threadA || !threadB) return 0;

				// Prioritize current thread
				if (a === chatThreadsState.currentThreadId) return -1;
				if (b === chatThreadsState.currentThreadId) return 1;

				// Then prioritize threads accessed in session
				const aAccessed = accessedThreadsRef.current.has(a);
				const bAccessed = accessedThreadsRef.current.has(b);
				if (aAccessed && !bAccessed) return -1;
				if (!aAccessed && bAccessed) return 1;

				// Finally sort by last modified
				return (
					new Date(threadB.lastModified).getTime() -
					new Date(threadA.lastModified).getTime()
				);
			})
			.slice(0, MAX_TABS_TO_SHOW);

		const getThreadTitle = (threadId: string) => {
			const thread = chatThreadsState.allThreads[threadId];
			if (!thread) return "New Chat";
			const firstUserMsg = thread.messages.find((msg) => msg.role === "user");
			if (firstUserMsg && firstUserMsg.displayContent) {
				const title = firstUserMsg.displayContent.trim();
				return title.length > 28 ? title.substring(0, 28) + "..." : title;
			}
			return "New Chat";
		};

		const handleCloseTab = useCallback(
			(e: React.MouseEvent, threadId: string) => {
				e.stopPropagation();
				const allThreadIds = Object.keys(chatThreadsState.allThreads);

				// If this is the last tab, don't close it (always keep at least one tab)
				if (allThreadIds.length === 1) {
					return;
				}

				// Remove from accessed threads set
				accessedThreadsRef.current.delete(threadId);

				// If this is the active tab, switch to another one first
				if (threadId === chatThreadsState.currentThreadId) {
					// Find the next available thread from all threads
					const otherThreadId = allThreadIds.find((id) => id !== threadId);
					if (otherThreadId) {
						accessedThreadsRef.current.add(otherThreadId);
						chatThreadsService.switchToThread(otherThreadId);
					}
				}

				// Delete the thread
				chatThreadsService.deleteThread(threadId);
			},
			[chatThreadsService, chatThreadsState],
		);

		return (
			<div
				className="w-full flex items-center border-b border-void-border-3/60 bg-void-bg-2 flex-shrink-0"
				style={{ height: "44px" }}
			>
				<div
					className="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-void-border-3 scrollbar-track-transparent"
					style={{
						scrollbarWidth: "thin",
						scrollbarColor: "var(--void-border-3) transparent",
					}}
				>
					{allThreadIds.map((threadId, index) => {
						const isActive = threadId === chatThreadsState.currentThreadId;
						const title = getThreadTitle(threadId);
						const thread = chatThreadsState.allThreads[threadId];
						const hasMessages = thread && thread.messages.length > 0;
						const messageCount = thread
							? thread.messages.filter(
									(m) => m.role === "user" || m.role === "assistant",
								).length
							: 0;

						return (
							<div
								key={threadId}
								className={`
									group relative flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap
									px-3.5 py-2 text-xs
									transition-all duration-200 ease-out
									cursor-pointer
									${
										isActive
											? "bg-void-bg-1 text-void-fg-1 font-medium border-b-2 border-void-link-color"
											: "bg-transparent text-void-fg-3 hover:text-void-fg-2 hover:bg-void-bg-3/50 border-b-2 border-transparent"
									}
								`}
							>
								<button
									onClick={() => {
										accessedThreadsRef.current.add(threadId);
										chatThreadsService.switchToThread(threadId);
									}}
									className="flex items-center gap-2 flex-1 min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-void-link-color/50 focus-visible:ring-offset-1 rounded-sm"
									title={title}
									type="button"
								>
									<span
										className={`truncate max-w-[180px] ${isActive ? "text-void-fg-1" : "text-void-fg-3"}`}
									>
										{title}
									</span>
									{hasMessages && messageCount > 0 && (
										<span
											className={`
											text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0
											${
												isActive
													? "bg-void-link-color/20 text-void-link-color"
													: "bg-void-bg-2/60 text-void-fg-4 group-hover:bg-void-bg-2/80 group-hover:text-void-fg-3"
											}
											transition-colors duration-200
										`}
										>
											{messageCount}
										</span>
									)}
								</button>
								{/* Close button - always visible on active tab, hover on others */}
								{allThreadIds.length > 1 && (
									<button
										onClick={(e) => handleCloseTab(e, threadId)}
										className={`
											ml-0.5 p-1.5 flex items-center justify-center rounded-sm
											transition-all duration-200
											${
												isActive
													? "opacity-70 hover:opacity-100"
													: "opacity-0 group-hover:opacity-70"
											}
											text-void-fg-4 hover:text-void-fg-1
											hover:bg-void-bg-3/60 active:bg-void-bg-3/80
											outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-void-link-color/50
										`}
										aria-label={`Close ${title}`}
										title={`Close ${title}`}
										type="button"
									>
										<IconX size={12} className="stroke-[2.5]" />
									</button>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	return (
		<Fragment
			key={chatThreadsState.currentThreadId} // force rerender when change thread
		>
			<div className="w-full h-full flex flex-col overflow-hidden">
				{/* Tabs Bar - always visible when there are threads */}
				{Object.keys(chatThreadsState.allThreads).length > 0 && (
					<ErrorBoundary>
						<ChatTabsBar />
					</ErrorBoundary>
				)}
				{/* Content */}
				<div className="flex-1 overflow-hidden">
					{isLandingPage ? landingPageContent : threadPageContent}
				</div>
			</div>
		</Fragment>
	);
};
