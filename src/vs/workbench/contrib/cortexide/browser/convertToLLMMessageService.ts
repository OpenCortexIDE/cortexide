import { Disposable } from '../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ChatMessage, ChatImageAttachment } from '../common/chatThreadServiceTypes.js';
import { VSBuffer, encodeBase64 } from '../../../../base/common/buffer.js';

// Use VS Code's built-in base64 encoding (tested, optimized, handles edge cases)
function uint8ArrayToBase64(data: Uint8Array): string {
	if (!data || data.length === 0) {
		console.error('[uint8ArrayToBase64] Empty or null data provided', { dataLength: data?.length ?? 0 });
		throw new Error('Cannot encode empty data to base64');
	}

	try {
		const buffer = VSBuffer.wrap(data);
		if (!buffer || buffer.byteLength === 0) {
			console.error('[uint8ArrayToBase64] VSBuffer is empty', { originalLength: data.length });
			throw new Error('VSBuffer is empty after wrapping');
		}

		const base64 = encodeBase64(buffer, true, false); // padded = true, urlSafe = false

		if (!base64 || base64.length === 0) {
			console.error('[uint8ArrayToBase64] encodeBase64 returned empty string', {
				bufferLength: buffer.byteLength,
				dataLength: data.length
			});
			throw new Error('encodeBase64 returned empty string');
		}

		// OpenAI requires clean base64 without any whitespace or newlines
		// Remove any potential whitespace (though encodeBase64 shouldn't add any)
		const cleaned = base64.trim().replace(/\s+/g, '');

		if (cleaned.length === 0) {
			console.error('[uint8ArrayToBase64] Base64 became empty after cleaning', {
				original: base64.substring(0, 50),
				originalLength: base64.length
			});
			throw new Error('Base64 became empty after cleaning whitespace');
		}

		return cleaned;
	} catch (error) {
		console.error('[uint8ArrayToBase64] Encoding failed', {
			error: error instanceof Error ? error.message : String(error),
			dataLength: data.length,
			dataType: data.constructor.name
		});
		throw error;
	}
}
import { getIsReasoningEnabledState, getReservedOutputTokenSpace, getModelCapabilities } from '../common/modelCapabilities.js';
import { effectiveSpecialToolFormat } from '../common/providerToolFormat.js';
import { reParsedToolXMLString, chat_systemMessage, chat_systemMessage_local } from '../common/prompt/prompts.js';
import { isCapableLocalModel } from '../common/routing/codingModelScore.js';
import { AnthropicLLMChatMessage, AnthropicReasoning, GeminiLLMChatMessage, LLMChatMessage, LLMFIMMessage, OpenAILLMChatMessage, RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { ChatMode, FeatureName, ModelSelection, ProviderName } from '../common/cortexideSettingsTypes.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';
import { ITerminalToolService } from './terminalToolService.js';
import { ICortexideModelService } from '../common/cortexideModelService.js';
import { URI } from '../../../../base/common/uri.js';
import { EndOfLinePreference } from '../../../../editor/common/model.js';
import { ToolName } from '../common/toolsServiceTypes.js';
import { IMCPService } from '../common/mcpService.js';
import { IRepoIndexerService } from './repoIndexerService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IMemoriesService } from '../common/memoriesService.js'
import { ICortexideRulesService } from '../common/cortexideRulesService.js';
import { ICortexideAgentsService } from '../common/cortexideAgentsService.js';

export const EMPTY_MESSAGE = '(empty message)'



type SimpleLLMMessage = {
	role: 'tool';
	content: string;
	id: string;
	name: ToolName;
	rawParams: RawToolParamsObj;
} | {
	role: 'user';
	content: string;
	images?: ChatImageAttachment[];
} | {
	role: 'assistant';
	content: string;
	anthropicReasoning: AnthropicReasoning[] | null;
}



const CHARS_PER_TOKEN = 4 // assume abysmal chars per token
const TRIM_TO_LEN = 120
// Safety clamp to avoid hitting provider TPM limits (e.g., OpenAI 30k TPM)
// 20k tokens (~80k chars) gives more conservative headroom for output tokens and image tokens
// Images can add significant tokens (~85 per 512x512 tile), so we need more headroom
const MAX_INPUT_TOKENS_SAFETY = 20_000

// Helper function to detect if a provider is local
// Used for optimizing prompts and token budgets for local models
export function isLocalProvider(providerName: ProviderName, settingsOfProvider: any): boolean {
	const isExplicitLocalProvider = providerName === 'ollama' || providerName === 'vLLM' || providerName === 'lmStudio'
	if (isExplicitLocalProvider) return true

	// Check for localhost endpoints in openAICompatible or liteLLM
	if (providerName === 'openAICompatible' || providerName === 'liteLLM') {
		const endpoint = settingsOfProvider[providerName]?.endpoint || ''
		if (endpoint) {
			try {
				const url = new URL(endpoint)
				const hostname = url.hostname.toLowerCase()
				return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1'
			} catch (e) {
				return false
			}
		}
	}
	return false
}

// Feature-specific token caps for local models (brutally small to minimize latency)
const LOCAL_MODEL_TOKEN_CAPS: Record<FeatureName, number> = {
	'Ctrl+K': 2000,      // Minimal for quick edits
	'Apply': 2000,       // Minimal for apply operations
	'Autocomplete': 1000, // Very minimal for autocomplete
	'Chat': 8192,        // More generous for chat, but still capped
	'SCM': 4096,         // Moderate for commit messages
}

// Reserved output space for local models (smaller to allow more input)
const LOCAL_MODEL_RESERVED_OUTPUT = 1024

// Estimate tokens for images in OpenAI format
// OpenAI uses ~85 tokens per 512x512 tile, plus base overhead
// For detailed images, tokens scale with image dimensions
// Reference: https://platform.openai.com/docs/guides/vision#calculating-costs
const estimateImageTokens = (images: ChatImageAttachment[] | undefined): number => {
	if (!images || images.length === 0) return 0
	let totalTokens = 0
	for (const img of images) {
		// Base overhead per image: ~85 tokens
		totalTokens += 85
		// Estimate tokens based on image dimensions
		// Images are resized to fit within 2048x2048, then scaled so shortest side is 768px
		// Each 512x512 tile costs ~170 tokens (85 for base + 85 for detail)
		// For a rough estimate, use image size as a proxy
		// Base64 encoding increases size by ~33%, so we estimate conservatively
		const base64Size = Math.ceil((img.size || img.data.length) * 1.33)
		// Very rough estimate: ~1 token per 100 bytes of base64 (conservative)
		// This accounts for the fact that images are tokenized more efficiently than text
		totalTokens += Math.ceil(base64Size / 100)
	}
	return totalTokens
}




// convert messages as if about to send to openai
/*
reference - https://platform.openai.com/docs/guides/function-calling#function-calling-steps
openai MESSAGE (role=assistant):
"tool_calls":[{
	"type": "function",
	"id": "call_12345xyz",
	"function": {
	"name": "get_weather",
	"arguments": "{\"latitude\":48.8566,\"longitude\":2.3522}"
}]

openai RESPONSE (role=user):
{   "role": "tool",
	"tool_call_id": tool_call.id,
	"content": str(result)    }

also see
openai on prompting - https://platform.openai.com/docs/guides/reasoning#advice-on-prompting
openai on developer system message - https://cdn.openai.com/spec/model-spec-2024-05-08.html#follow-the-chain-of-command
*/


const prepareMessages_openai_tools = (messages: SimpleLLMMessage[]): AnthropicOrOpenAILLMMessage[] => {

	const newMessages: OpenAILLMChatMessage[] = [];

	for (let i = 0; i < messages.length; i += 1) {
		const currMsg = messages[i]

		if (currMsg.role === 'user') {
			// Convert images to OpenAI format if present
			const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
			const hasImages = currMsg.images && currMsg.images.length > 0;

			// Prepare text content
			let textContent = currMsg.content && currMsg.content.trim() ? currMsg.content : '';

			// When images are present, always add explicit instruction to analyze them
			// This ensures models prioritize image analysis even if the text is ambiguous
			if (hasImages && currMsg.images) {
				if (!textContent || textContent.trim().length === 0) {
					// Better default prompt for software development context
					textContent = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
				} else {
					// Enhance user's question with context about image analysis
					const imageContext = currMsg.images.length === 1
						? ' (The user has attached an image with this message - analyze the image content in your response.)'
						: ` (The user has attached ${currMsg.images.length} images with this message - analyze all images in your response.)`;
					textContent = textContent + imageContext;
				}
			}

			// Add text content - for images, we always need a text part
			if (textContent) {
				contentParts.push({ type: 'text', text: textContent });
			} else if (hasImages) {
				// If we have images but no text, add default image analysis prompt
				const imageAnalysisPrompt = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
				contentParts.push({ type: 'text', text: imageAnalysisPrompt });
			}

			// Add images if present (OpenAI format: data URL)
			if (hasImages && currMsg.images) {
				for (const image of currMsg.images) {
					// OpenAI only supports: image/png, image/jpeg, image/gif, image/webp
					// Convert unsupported types (like SVG) to png
					let mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = 'image/png';
					if (image.mimeType === 'image/png' || image.mimeType === 'image/jpeg' || image.mimeType === 'image/gif' || image.mimeType === 'image/webp') {
						mimeType = image.mimeType;
					} else {
						// For SVG or any other unsupported type, default to PNG
						mimeType = 'image/png';
					}

					// Validate image data is not empty and is valid
					if (!image.data) {
						console.error('Image data is null or undefined', { image: { mimeType: image.mimeType, hasData: !!image.data } });
						throw new Error('Image data is null or undefined');
					}

					// Ensure image.data is a Uint8Array
					// TypeScript knows image.data is Uint8Array from the type definition, but we validate at runtime
					// Use 'any' to bypass TypeScript's type narrowing for runtime validation
					const data: any = image.data;
					let imageData: Uint8Array;

					if (data instanceof Uint8Array) {
						imageData = data;
					} else if (Array.isArray(data)) {
						imageData = new Uint8Array(data);
					} else if (typeof data === 'string') {
						// Handle base64 string (from storage deserialization)
						if (data.startsWith('__base64__:')) {
							try {
								const base64 = data.substring(11); // Remove '__base64__:' prefix
								const binaryString = atob(base64);
								const bytes = new Uint8Array(binaryString.length);
								for (let i = 0; i < binaryString.length; i++) {
									bytes[i] = binaryString.charCodeAt(i);
								}
								imageData = bytes;
							} catch (error) {
								console.error('Failed to decode base64 image data', { error, mimeType: image.mimeType });
								throw new Error('Failed to decode base64 image data from storage');
							}
						} else {
							// Regular string (shouldn't happen, but handle gracefully)
							console.error('Image data is a plain string, expected Uint8Array', {
								mimeType: image.mimeType,
								dataType: typeof data,
								dataLength: data.length
							});
							throw new Error('Image data format not supported: received plain string, expected Uint8Array or base64');
						}
					} else if (data && typeof data === 'object' && !Array.isArray(data) && !(data instanceof Uint8Array)) {
						// Handle object that might be a serialized array or have array-like properties
						// Only try to convert if it has numeric keys (indicating it was an array serialized as object)

						// First, check if this object has been visited (prevent circular references)
						// We'll use a simple approach: if keys.length is reasonable (< 1M entries)
						const keys = Object.keys(data);

						// Safety check: if too many keys, it's probably not image data
						if (keys.length > 10000000) {
							console.error('Image data object has too many keys, likely not image data', {
								mimeType: image.mimeType,
								keyCount: keys.length
							});
							throw new Error(`Image data object has too many keys (${keys.length}), likely not image data`);
						}

						const numericKeys = keys.filter(k => /^\d+$/.test(k));

						if (numericKeys.length > 0 && numericKeys.length === keys.length) {
							// All keys are numeric - this looks like a serialized array
							try {
								// Convert numeric-keyed object back to array
								// Find max index safely (avoid spread operator which can cause stack overflow)
								let maxIndex = -1;
								for (const k of numericKeys) {
									const idx = parseInt(k, 10);
									if (idx > maxIndex) {
										maxIndex = idx;
									}
								}

								// Limit to reasonable size to prevent stack overflow
								const maxAllowedSize = 50000000; // 50MB max
								if (maxIndex > maxAllowedSize) {
									throw new Error(`Image data too large: ${maxIndex} bytes (max ${maxAllowedSize})`);
								}

								if (maxIndex < 0) {
									throw new Error(`Invalid max index: ${maxIndex}`);
								}

								const values: number[] = [];
								// Process in chunks to avoid stack overflow
								const chunkSize = 10000;
								for (let start = 0; start <= maxIndex; start += chunkSize) {
									const end = Math.min(start + chunkSize, maxIndex + 1);
									for (let i = start; i < end; i++) {
										// Use hasOwnProperty check to avoid getters/prototype issues
										if (Object.prototype.hasOwnProperty.call(data, String(i))) {
											const val = (data as any)[String(i)];
											if (typeof val === 'number' && val >= 0 && val <= 255 && Number.isInteger(val)) {
												values.push(val);
											} else if (val !== undefined && val !== null) {
												throw new Error(`Invalid byte value at index ${i}: ${val} (type: ${typeof val})`);
											} else {
												// Missing index - this might be a sparse array, fill with 0 or skip
												// For image data, we probably want to preserve indices, so skip for now
												// values.push(0); // or skip
											}
										}
									}
								}

								if (values.length === 0) {
									throw new Error('No valid byte values found in object');
								}

								imageData = new Uint8Array(values);
							} catch (error) {
								console.error('Failed to convert object to Uint8Array', {
									error: error instanceof Error ? error.message : String(error),
									mimeType: image.mimeType,
									keyCount: keys.length,
									numericKeyCount: numericKeys.length,
									sampleKeys: keys.slice(0, 5)
								});
								throw new Error(`Image data is an object that cannot be converted to Uint8Array: ${error instanceof Error ? error.message : String(error)}`);
							}
						} else {
							// Unknown object structure - doesn't look like serialized array
							const dataType = typeof data;
							const constructorName = data?.constructor?.name;

							console.error('Image data has invalid object structure', {
								mimeType: image.mimeType,
								dataType: dataType,
								constructor: constructorName,
								totalKeys: keys.length,
								numericKeys: numericKeys.length,
								sampleKeys: keys.slice(0, 10),
								sampleNumericKeys: numericKeys.slice(0, 5)
							});

							// Instead of throwing immediately, check if we can access the data differently
							// Maybe it's a VSBuffer or similar object?
							if ('buffer' in data || 'byteLength' in data) {
								console.error('Object appears to be a Buffer-like object but conversion failed', {
									hasBuffer: 'buffer' in data,
									hasByteLength: 'byteLength' in data
								});
							}

							throw new Error(`Image data has invalid object structure: ${constructorName || 'unknown'} (${keys.length} keys, ${numericKeys.length} numeric)`);
						}
					} else {
						// Unknown type
						const dataType = typeof data;
						console.error('Image data has completely invalid type', {
							mimeType: image.mimeType,
							dataType: dataType
						});
						throw new Error(`Image data has invalid type: ${dataType}, expected Uint8Array`);
					}

					// Validate image data is not empty
					if (imageData.length === 0) {
						console.error('Image data array is empty', { mimeType: image.mimeType });
						throw new Error('Image data is empty');
					}

					// Check image size (OpenAI limit is 20MB, but we should check base64 encoded size)
					// Base64 encoding increases size by ~33%, so check if original is under ~15MB
					const maxImageSize = 15 * 1024 * 1024; // 15MB
					if (imageData.length > maxImageSize) {
						console.error(`Image too large: ${imageData.length} bytes (max ${maxImageSize})`);
						throw new Error(`Image is too large: ${Math.round(imageData.length / 1024 / 1024)}MB. Maximum size is 20MB.`);
					}

					// Use VS Code's built-in base64 encoder (already tested and optimized)
					let base64 = uint8ArrayToBase64(imageData);

					// Validate base64 format - must contain only valid base64 characters
					// OpenAI is strict: base64 must be clean, no whitespace, proper padding
					if (!base64 || base64.length === 0) {
						console.error('Base64 encoding returned empty string');
						throw new Error('Failed to encode image to base64');
					}

					// Ensure base64 contains only valid characters (A-Z, a-z, 0-9, +, /, =)
					const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
					if (!base64Regex.test(base64)) {
						console.error('Base64 contains invalid characters:', base64.substring(0, 100));
						throw new Error('Invalid base64 encoding: contains invalid characters');
					}

					// Validate padding - base64 should end with 0, 1, or 2 '=' characters
					const paddingCount = (base64.match(/=+$/) || [''])[0].length;
					if (paddingCount > 2) {
						console.error('Base64 has invalid padding:', base64.substring(base64.length - 10));
						throw new Error('Invalid base64 encoding: too many padding characters');
					}

					// Construct data URL - OpenAI expects format: data:image/<type>;base64,<base64>
					// Ensure no whitespace in the final URL
					const dataUrl = `data:${mimeType};base64,${base64}`.trim();

					// Additional validation: ensure data URL is reasonable size
					if (dataUrl.length > 30 * 1024 * 1024) { // 30MB as safety limit
						console.error('Data URL too large:', dataUrl.length);
						throw new Error('Image data URL is too large');
					}

					contentParts.push({
						type: 'image_url',
						image_url: { url: dataUrl },
					});
				}
			}

			// Use array format if we have images or multiple parts, otherwise use string
			// For OpenAI, if we have images, we MUST use array format with at least text + images
			const userMsg: OpenAILLMChatMessage = {
				role: 'user',
				content: hasImages ? contentParts : (contentParts.length > 0 ? contentParts : (textContent || '')),
			};
			newMessages.push(userMsg);
			continue
		}

		if (currMsg.role !== 'tool') {
			newMessages.push(currMsg as OpenAILLMChatMessage)
			continue
		}

		// edit previous assistant message to have called the tool
		// Check the last message in newMessages (not messages[i-1] since arrays might have different lengths)
		const lastMsg = newMessages.length > 0 ? newMessages[newMessages.length - 1] : undefined
		if (lastMsg?.role === 'assistant') {
			// Add tool_calls to the assistant message if not already present
			if (!lastMsg.tool_calls) {
				lastMsg.tool_calls = []
			}
			lastMsg.tool_calls.push({
				type: 'function',
				id: currMsg.id,
				function: {
					name: currMsg.name,
					arguments: JSON.stringify(currMsg.rawParams)
				}
			})
		} else {
			// Tool message without preceding assistant message - this violates OpenAI API requirements
			// Skip this tool message to avoid API errors
			console.warn(`Skipping tool message ${currMsg.name} (id: ${currMsg.id}) because it doesn't follow an assistant message. Last message role: ${lastMsg?.role || 'none'}`)
			continue
		}

		// add the tool
		newMessages.push({
			role: 'tool',
			tool_call_id: currMsg.id,
			content: currMsg.content,
		})
	}
	return newMessages

}



// convert messages as if about to send to anthropic
/*
https://docs.anthropic.com/en/docs/build-with-claude/tool-use#tool-use-examples
anthropic MESSAGE (role=assistant):
"content": [{
	"type": "text",
	"text": "<thinking>I need to call the get_weather function, and the user wants SF, which is likely San Francisco, CA.</thinking>"
}, {
	"type": "tool_use",
	"id": "toolu_01A09q90qw90lq917835lq9",
	"name": "get_weather",
	"input": { "location": "San Francisco, CA", "unit": "celsius" }
}]
anthropic RESPONSE (role=user):
"content": [{
	"type": "tool_result",
	"tool_use_id": "toolu_01A09q90qw90lq917835lq9",
	"content": "15 degrees"
}]


Converts:
assistant: ...content
tool: (id, name, params)
->
assistant: ...content, call(name, id, params)
user: ...content, result(id, content)
*/

type AnthropicOrOpenAILLMMessage = AnthropicLLMChatMessage | OpenAILLMChatMessage

const prepareMessages_anthropic_tools = (messages: SimpleLLMMessage[], supportsAnthropicReasoning: boolean): AnthropicOrOpenAILLMMessage[] => {
	const newMessages: (AnthropicLLMChatMessage | (SimpleLLMMessage & { role: 'tool' }))[] = messages;

	for (let i = 0; i < messages.length; i += 1) {
		const currMsg = messages[i]

		// add anthropic reasoning
		if (currMsg.role === 'assistant') {
			if (currMsg.anthropicReasoning && supportsAnthropicReasoning) {
				const content = currMsg.content
				newMessages[i] = {
					role: 'assistant',
					content: content ? [...currMsg.anthropicReasoning, { type: 'text' as const, text: content }] : currMsg.anthropicReasoning
				}
			}
			else {
				newMessages[i] = {
					role: 'assistant',
					content: currMsg.content,
					// strip away anthropicReasoning
				}
			}
			continue
		}

		if (currMsg.role === 'user') {
			// Convert images to Anthropic format if present
			const contentParts: Array<{ type: 'text'; text: string } | { type: 'tool_result'; tool_use_id: string; content: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } }> = [];
			const hasImages = currMsg.images && currMsg.images.length > 0;

			// Prepare text content
			let textContent = currMsg.content && currMsg.content.trim() ? currMsg.content : '';

			// When images are present, always add explicit instruction to analyze them
			// This ensures models prioritize image analysis even if the text is ambiguous
			if (hasImages && currMsg.images) {
				if (!textContent || textContent.trim().length === 0) {
					// Better default prompt for software development context
					textContent = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
				} else {
					// Enhance user's question with context about image analysis
					const imageContext = currMsg.images.length === 1
						? ' (The user has attached an image with this message - analyze the image content in your response.)'
						: ` (The user has attached ${currMsg.images.length} images with this message - analyze all images in your response.)`;
					textContent = textContent + imageContext;
				}
			}

			// Add text content - for images, we always need a text part
			if (textContent) {
				contentParts.push({ type: 'text', text: textContent });
			} else if (hasImages) {
				// If we have images but no text, add default image analysis prompt
				const imageAnalysisPrompt = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
				contentParts.push({ type: 'text', text: imageAnalysisPrompt });
			}

			// Add images if present
			if (hasImages && currMsg.images) {
				for (const image of currMsg.images) {
					// Convert Uint8Array to base64
					const base64 = uint8ArrayToBase64(image.data);
					// Anthropic SDK expects specific MIME types, cast appropriately
					const mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' =
						image.mimeType === 'image/svg+xml' ? 'image/png' :
							(image.mimeType === 'image/png' || image.mimeType === 'image/jpeg' || image.mimeType === 'image/webp' || image.mimeType === 'image/gif'
								? image.mimeType : 'image/png');
					contentParts.push({
						type: 'image',
						source: {
							type: 'base64',
							media_type: mediaType,
							data: base64,
						},
					});
				}
			}

			// Use array format if we have images or multiple parts, otherwise use string
			// For Anthropic, if we have images, we MUST use array format with at least text + images
			const userMsg: AnthropicLLMChatMessage = {
				role: 'user',
				content: hasImages ? contentParts : (contentParts.length > 0 ? contentParts : (textContent || '')),
			};
			newMessages[i] = userMsg;
			continue
		}

		if (currMsg.role === 'tool') {
			// add anthropic tools
			const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : undefined

			// make it so the assistant called the tool
			if (prevMsg?.role === 'assistant') {
				if (typeof prevMsg.content === 'string') prevMsg.content = [{ type: 'text', text: prevMsg.content }]
				prevMsg.content.push({ type: 'tool_use', id: currMsg.id, name: currMsg.name, input: currMsg.rawParams })
			}

			// turn each tool into a user message with tool results at the end
			newMessages[i] = {
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: currMsg.id, content: currMsg.content }]
			}
			continue
		}

	}

	// we just removed the tools
	return newMessages as AnthropicLLMChatMessage[]
}


const prepareMessages_XML_tools = (messages: SimpleLLMMessage[], supportsAnthropicReasoning: boolean): AnthropicOrOpenAILLMMessage[] => {

	const llmChatMessages: AnthropicOrOpenAILLMMessage[] = [];
	for (let i = 0; i < messages.length; i += 1) {

		const c = messages[i]
		const next = 0 <= i + 1 && i + 1 <= messages.length - 1 ? messages[i + 1] : null

		if (c.role === 'assistant') {
			// if called a tool (message after it), re-add its XML to the message
			// alternatively, could just hold onto the original output, but this way requires less piping raw strings everywhere
			let content: AnthropicOrOpenAILLMMessage['content'] = c.content
			if (next?.role === 'tool') {
				content = `${content}\n\n${reParsedToolXMLString(next.name, next.rawParams)}`
			}

			// anthropic reasoning
			if (c.anthropicReasoning && supportsAnthropicReasoning) {
				content = content ? [...c.anthropicReasoning, { type: 'text' as const, text: content }] : c.anthropicReasoning
			}
			llmChatMessages.push({
				role: 'assistant',
				content
			})
		}
		// add user or tool to the previous user message
		else if (c.role === 'user' || c.role === 'tool') {
			if (c.role === 'tool')
				c.content = `<${c.name}_result>\n${c.content}\n</${c.name}_result>`

			if (llmChatMessages.length === 0 || llmChatMessages[llmChatMessages.length - 1].role !== 'user') {
				// Convert images to Anthropic format if present (only for user messages)
				const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } }> = [];
				const hasImages = c.role === 'user' && c.images && c.images.length > 0;

				// Prepare text content
				let textContent = c.content && c.content.trim() ? c.content : '';

				// When images are present, always add explicit instruction to analyze them
				// This ensures models prioritize image analysis even if the text is ambiguous
				if (hasImages && c.images) {
					if (!textContent || textContent.trim().length === 0) {
						// Better default prompt for software development context
						textContent = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
					} else {
						// Enhance user's question with context about image analysis
						const imageContext = c.images.length === 1
							? ' (The user has attached an image with this message - analyze the image content in your response.)'
							: ` (The user has attached ${c.images.length} images with this message - analyze all images in your response.)`;
						textContent = textContent + imageContext;
					}
				}

				// Add text content - for images, we always need a text part
				if (textContent) {
					contentParts.push({ type: 'text', text: textContent });
				} else if (hasImages && c.images) {
					// If we have images but no text, add default image analysis prompt
					const imageAnalysisPrompt = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
					contentParts.push({ type: 'text', text: imageAnalysisPrompt });
				}

				// Add images if present (only for user messages)
				if (hasImages && c.images) {
					for (const image of c.images) {
						// Convert Uint8Array to base64
						const base64 = uint8ArrayToBase64(image.data);
						// Anthropic SDK expects specific MIME types, cast appropriately
						const mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' =
							image.mimeType === 'image/svg+xml' ? 'image/png' :
								(image.mimeType === 'image/png' || image.mimeType === 'image/jpeg' || image.mimeType === 'image/webp' || image.mimeType === 'image/gif'
									? image.mimeType : 'image/png');
						contentParts.push({
							type: 'image',
							source: {
								type: 'base64',
								media_type: mediaType,
								data: base64,
							},
						});
					}
				}

				// For Anthropic XML tools, if we have images, we MUST use array format with at least text + images
				const userMsg: AnthropicLLMChatMessage = {
					role: 'user',
					content: hasImages ? contentParts : (contentParts.length > 0 ? contentParts : (c.content || ''))
				};
				llmChatMessages.push(userMsg);
			} else {
				// Append to existing user message
				const lastMsg = llmChatMessages[llmChatMessages.length - 1];
				if (lastMsg.role === 'user') {
					const hasImages = c.role === 'user' && c.images && c.images.length > 0;

					if (typeof lastMsg.content === 'string') {
						// If we have images, convert string content to array format
						if (hasImages && c.images) {
							const contentArray: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } }> = [
								{ type: 'text', text: lastMsg.content + '\n\n' + (c.content || '') }
							];
							// Add images
							for (const image of c.images) {
								const base64 = uint8ArrayToBase64(image.data);
								const mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' =
									image.mimeType === 'image/svg+xml' ? 'image/png' :
										(image.mimeType === 'image/png' || image.mimeType === 'image/jpeg' || image.mimeType === 'image/webp' || image.mimeType === 'image/gif'
											? image.mimeType : 'image/png');
								contentArray.push({
									type: 'image',
									source: {
										type: 'base64',
										media_type: mediaType,
										data: base64,
									},
								});
							}
							lastMsg.content = contentArray as any;
						} else {
							// No images, just append text
							lastMsg.content += '\n\n' + c.content;
						}
					} else {
						// If it's already an array, append text
						const contentArray = lastMsg.content as Array<{ type: 'text'; text: string } | { type: 'tool_result'; tool_use_id: string; content: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } }>;

						// Ensure we have a text part if images are being added
						const hasTextPart = contentArray.some(item => item.type === 'text');
						if (hasImages && c.images && !hasTextPart) {
							const imageAnalysisPrompt = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';
							contentArray.unshift({ type: 'text', text: imageAnalysisPrompt });
						}

						if (c.content && c.content.trim()) {
							contentArray.push({ type: 'text', text: '\n\n' + c.content });
						}
						// Also append images if any (only for user messages)
						if (hasImages && c.images) {
							for (const image of c.images) {
								const base64 = uint8ArrayToBase64(image.data);
								// Anthropic SDK expects specific MIME types, cast appropriately
								const mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' =
									image.mimeType === 'image/svg+xml' ? 'image/png' :
										(image.mimeType === 'image/png' || image.mimeType === 'image/jpeg' || image.mimeType === 'image/webp' || image.mimeType === 'image/gif'
											? image.mimeType : 'image/png');
								contentArray.push({
									type: 'image',
									source: {
										type: 'base64',
										media_type: mediaType,
										data: base64,
									},
								});
							}
						}
					}
				}
			}
		}
	}
	return llmChatMessages
}


// --- CHAT ---

const prepareOpenAIOrAnthropicMessages = ({
	messages: messages_,
	systemMessage,
	aiInstructions,
	supportsSystemMessage,
	specialToolFormat,
	supportsAnthropicReasoning,
	contextWindow,
	reservedOutputTokenSpace,
}: {
	messages: SimpleLLMMessage[],
	systemMessage: string,
	aiInstructions: string,
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated',
	specialToolFormat: 'openai-style' | 'anthropic-style' | undefined,
	supportsAnthropicReasoning: boolean,
	contextWindow: number,
	reservedOutputTokenSpace: number | null | undefined,
}): { messages: AnthropicOrOpenAILLMMessage[], separateSystemMessage: string | undefined } => {

	// Reserve output space WITHOUT starving the input. This previously reserved HALF the context
	// window (max(contextWindow/2, ...)) — note the comment said 1/4 — so a small/4096-window model
	// reserved its ENTIRE window, leaving ~0 input budget; every message was then slashed to a stub and
	// the agent lost its own task + tool results ("smart truncations, achieves nothing"). Reserve the
	// model's configured output space, capped at a quarter of the window so input always keeps ~75%+.
	reservedOutputTokenSpace = Math.min(
		reservedOutputTokenSpace ?? 4_096,
		Math.max(512, Math.floor(contextWindow / 4)) // never reserve more than 1/4 of the window
	)
	// Optimized: shallow clone + selective deep clone only for mutable fields
	// Images (Uint8Array) are large and don't need cloning since we won't mutate them
	let messages: (SimpleLLMMessage | { role: 'system', content: string })[] = messages_.map(msg => {
		if (msg.role === 'user' && msg.images) {
			// Shallow clone but keep images reference (we don't mutate images)
			return { ...msg, images: msg.images }
		}
		// For other messages, shallow clone is sufficient since content is string
		return { ...msg }
	}) as (SimpleLLMMessage | { role: 'system', content: string })[]

	// ================ system message ================
	// A COMPLETE HACK: last message is system message for context purposes

	const sysMsgParts: string[] = []
	if (aiInstructions) sysMsgParts.push(`GUIDELINES (from the user's .voidrules file):\n${aiInstructions}`)
	if (systemMessage) sysMsgParts.push(systemMessage)
	const combinedSystemMessage = sysMsgParts.join('\n\n')

	messages.unshift({ role: 'system', content: combinedSystemMessage })

	// ================ trim ================
	messages = messages.map(m => ({ ...m, content: m.role !== 'tool' ? m.content.trim() : m.content }))

	type MesType = (typeof messages)[0]

	// ================ fit into context ================

	// the higher the weight, the higher the desire to truncate - TRIM HIGHEST WEIGHT MESSAGES
	const alreadyTrimmedIdxes = new Set<number>()
	const weight = (message: MesType, messages: MesType[], idx: number) => {
		const base = message.content.length

		let multiplier: number
		multiplier = 1 + (messages.length - 1 - idx) / messages.length // slow rampdown from 2 to 1 as index increases
		if (message.role === 'user') {
			multiplier *= 1
		}
		else if (message.role === 'system') {
			multiplier *= .01 // very low weight
		}
		else {
			multiplier *= 10 // llm tokens are far less valuable than user tokens
		}

		// any already modified message should not be trimmed again
		if (alreadyTrimmedIdxes.has(idx)) {
			multiplier = 0
		}
		// 1st and last messages should be very low weight
		if (idx <= 1 || idx >= messages.length - 1 - 3) {
			multiplier *= .05
		}
		return base * multiplier
	}

	const _findLargestByWeight = (messages_: MesType[]) => {
		let largestIndex = -1
		let largestWeight = -Infinity
		for (let i = 0; i < messages.length; i += 1) {
			const m = messages[i]
			const w = weight(m, messages_, i)
			if (w > largestWeight) {
				largestWeight = w
				largestIndex = i
			}
		}
		return largestIndex
	}

	let totalLen = 0
	for (const m of messages) { totalLen += m.content.length }
	const charsNeedToTrim = totalLen - Math.max(
		(contextWindow - reservedOutputTokenSpace) * CHARS_PER_TOKEN, // can be 0, in which case charsNeedToTrim=everything, bad
		// Minimum input budget so a small-context model keeps the original request + a couple recent
		// turns/tool results intact (otherwise the loop can never converge). Clamped to 60% of the
		// window so a genuinely tiny window doesn't get a floor it can't physically hold (overflow).
		Math.min(12_000, Math.floor(contextWindow * CHARS_PER_TOKEN * 0.6))
	)


	// <----------------------------------------->
	// 0                      |    |             |
	//                        |    contextWindow |
	//                     contextWindow - maxOut|putTokens
	//                                          totalLen
	let remainingCharsToTrim = charsNeedToTrim
	let i = 0

	while (remainingCharsToTrim > 0) {
		i += 1
		if (i > 100) break

		const trimIdx = _findLargestByWeight(messages)
		const m = messages[trimIdx]

		// if can finish here, do
		const numCharsWillTrim = m.content.length - TRIM_TO_LEN
		if (numCharsWillTrim > remainingCharsToTrim) {
			// trim remainingCharsToTrim + '...'.length chars
			m.content = m.content.slice(0, m.content.length - remainingCharsToTrim - '...'.length).trim() + '...'
			break
		}

		remainingCharsToTrim -= numCharsWillTrim
		m.content = m.content.substring(0, TRIM_TO_LEN - '...'.length) + '...'
		alreadyTrimmedIdxes.add(trimIdx)
	}

	// ================ safety clamp to avoid TPM overage ================
	// After context-based trimming, also enforce a hard upper bound on total input size
	// This accounts for text tokens, image tokens, system messages, tool definitions, and message structure overhead
	const safetyTrim = () => {
		// Estimate total tokens: text content + images + system message overhead
		let textChars = 0
		let imageTokens = 0
		for (const m of messages) {
			textChars += m.content.length
			// Check if message has images (SimpleLLMMessage with images property)
			if ('images' in m && m.images) {
				imageTokens += estimateImageTokens(m.images)
			}
		}

		// Add system message tokens (will be added separately or prepended)
		const systemMessageTokens = Math.ceil(combinedSystemMessage.length / CHARS_PER_TOKEN)

		// Message structure overhead: JSON formatting, role names, etc.
		// Estimate ~8 tokens per message for structure (role, content wrapper, etc.)
		const messageStructureOverhead = messages.length * 8

		// Native tool definitions overhead (when using openai-style, tools are sent separately)
		// Conservative estimate: ~500-2000 tokens depending on number of tools
		// Since we don't have tool info here, use a conservative buffer
		const nativeToolDefinitionsOverhead = specialToolFormat === 'openai-style' ? 1000 : 0

		// Total estimated tokens
		const textTokens = Math.ceil(textChars / CHARS_PER_TOKEN)
		const totalEstimatedTokens = textTokens + imageTokens + systemMessageTokens + messageStructureOverhead + nativeToolDefinitionsOverhead

		// If we're under the limit, no need to trim
		if (totalEstimatedTokens <= MAX_INPUT_TOKENS_SAFETY) return

		// Need to trim more aggressively
		const excessTokens = totalEstimatedTokens - MAX_INPUT_TOKENS_SAFETY
		const excessChars = excessTokens * CHARS_PER_TOKEN

		let guardLoops = 0
		let charsTrimmed = 0
		while (charsTrimmed < excessChars && guardLoops < 200) {
			guardLoops += 1
			const trimIdx = _findLargestByWeight(messages)
			const m = messages[trimIdx]
			if (m.content.length <= TRIM_TO_LEN) {
				// Already tiny, skip to next largest
				alreadyTrimmedIdxes.add(trimIdx)
				continue
			}
			const before = m.content.length
			m.content = m.content.substring(0, TRIM_TO_LEN - '...'.length) + '...'
			alreadyTrimmedIdxes.add(trimIdx)
			charsTrimmed += (before - m.content.length)
		}
	}

	safetyTrim()

	// ================ system message hack ================
	const newSysMsg = messages.shift()!.content


	// ================ tools and anthropicReasoning ================
	// SYSTEM MESSAGE HACK: we shifted (removed) the system message role, so now SimpleLLMMessage[] is valid

	let llmChatMessages: AnthropicOrOpenAILLMMessage[] = []
	if (!specialToolFormat) { // XML tool behavior
		llmChatMessages = prepareMessages_XML_tools(messages as SimpleLLMMessage[], supportsAnthropicReasoning)
	}
	else if (specialToolFormat === 'anthropic-style') {
		llmChatMessages = prepareMessages_anthropic_tools(messages as SimpleLLMMessage[], supportsAnthropicReasoning)
	}
	else if (specialToolFormat === 'openai-style') {
		llmChatMessages = prepareMessages_openai_tools(messages as SimpleLLMMessage[])
	}
	const llmMessages = llmChatMessages


	// ================ system message add as first llmMessage ================

	let separateSystemMessageStr: string | undefined = undefined

	// if supports system message
	if (supportsSystemMessage) {
		if (supportsSystemMessage === 'separated')
			separateSystemMessageStr = newSysMsg
		else if (supportsSystemMessage === 'system-role')
			llmMessages.unshift({ role: 'system', content: newSysMsg }) // add new first message
		else if (supportsSystemMessage === 'developer-role')
			llmMessages.unshift({ role: 'developer', content: newSysMsg }) // add new first message
	}
	// if does not support system message
	else {
		const firstMsg = llmMessages[0];
		const systemMsgPrefix = `<SYSTEM_MESSAGE>\n${newSysMsg}\n</SYSTEM_MESSAGE>\n`;

		// Handle both string and array content formats
		if (typeof firstMsg.content === 'string') {
			const newFirstMessage = {
				role: 'user',
				content: systemMsgPrefix + firstMsg.content
			} as const;
			llmMessages.splice(0, 1); // delete first message
			llmMessages.unshift(newFirstMessage); // add new first message
		} else {
			// Content is an array (may contain images/text parts)
			// Prepend system message to the first text part, or add a new text part
			const contentArray = [...firstMsg.content] as any[];
			const firstTextIndex = contentArray.findIndex((c: any) => c.type === 'text');

			if (firstTextIndex !== -1) {
				// Prepend to existing text part
				contentArray[firstTextIndex] = {
					type: 'text',
					text: systemMsgPrefix + (contentArray[firstTextIndex] as any).text
				};
			} else {
				// No text part exists, add one at the beginning
				contentArray.unshift({
					type: 'text',
					text: systemMsgPrefix.trim()
				});
			}

			const newFirstMessage: AnthropicOrOpenAILLMMessage = {
				role: 'user',
				content: contentArray
			};
			llmMessages.splice(0, 1); // delete first message
			llmMessages.unshift(newFirstMessage); // add new first message
		}
	}


	// ================ no empty message ================
	for (let i = 0; i < llmMessages.length; i += 1) {
		const currMsg: AnthropicOrOpenAILLMMessage = llmMessages[i]
		const nextMsg: AnthropicOrOpenAILLMMessage | undefined = llmMessages[i + 1]

		if (currMsg.role === 'tool') continue

		// if content is a string, replace string with empty msg
		if (typeof currMsg.content === 'string') {
			currMsg.content = currMsg.content || EMPTY_MESSAGE
		}
		else {
			// allowed to be empty if has a tool in it or following it
			if (currMsg.content.find(c => c.type === 'tool_result' || c.type === 'tool_use')) {
				currMsg.content = currMsg.content.filter(c => !(c.type === 'text' && !c.text)) as any
				continue
			}
			if (nextMsg?.role === 'tool') continue

			// Check if we have images in the content array
			const hasImagesInContent = currMsg.content.some(c => c.type === 'image' || c.type === 'image_url');

			// For messages with images, we need a proper text part (not empty)
			if (hasImagesInContent) {
				// Find or create a proper text part for images
				const textPartIndex = currMsg.content.findIndex(c => c.type === 'text');
				const imageAnalysisPrompt = 'Analyze the attached image(s). Describe what you see in detail. If this appears to be code, a UI, an error message, a diagram, or something related to software development, provide a detailed analysis and actionable insights.';

				if (textPartIndex === -1) {
					// No text part exists, add one at the beginning
					currMsg.content.unshift({ type: 'text', text: imageAnalysisPrompt } as any);
				} else {
					// Text part exists, ensure it's not empty
					const textPart = currMsg.content[textPartIndex];
					if (textPart.type === 'text' && (!textPart.text || textPart.text.trim() === '' || textPart.text === EMPTY_MESSAGE)) {
						// Replace empty text with proper image analysis prompt
						currMsg.content[textPartIndex] = { type: 'text', text: imageAnalysisPrompt } as any;
					}
				}
			} else {
				// No images, just replace empty text with EMPTY_MESSAGE
				for (const c of currMsg.content) {
					if (c.type === 'text') c.text = c.text || EMPTY_MESSAGE
				}
			}

			// If array is completely empty, add a text entry
			if (currMsg.content.length === 0) currMsg.content = [{ type: 'text', text: EMPTY_MESSAGE }]
		}
	}

	return {
		messages: llmMessages,
		separateSystemMessage: separateSystemMessageStr,
	} as const
}




type GeminiUserPart = (GeminiLLMChatMessage & { role: 'user' })['parts'][0]
type GeminiModelPart = (GeminiLLMChatMessage & { role: 'model' })['parts'][0]
const prepareGeminiMessages = (messages: AnthropicLLMChatMessage[]) => {
	let latestToolName: ToolName | undefined = undefined
	const messages2: GeminiLLMChatMessage[] = messages.map((m): GeminiLLMChatMessage | null => {
		if (m.role === 'assistant') {
			if (typeof m.content === 'string') {
				return { role: 'model', parts: [{ text: m.content }] }
			}
			else {
				const parts: GeminiModelPart[] = m.content.map((c): GeminiModelPart | null => {
					if (c.type === 'text') {
						return { text: c.text }
					}
					else if (c.type === 'tool_use') {
						latestToolName = c.name
						return { functionCall: { id: c.id, name: c.name, args: c.input } }
					}
					else return null
				}).filter(m => !!m)
				return { role: 'model', parts, }
			}
		}
		else if (m.role === 'user') {
			if (typeof m.content === 'string') {
				return { role: 'user', parts: [{ text: m.content }] } satisfies GeminiLLMChatMessage
			}
			else {
				const parts: GeminiUserPart[] = m.content.map((c): GeminiUserPart | null => {
					if (c.type === 'text') {
						return { text: c.text }
					}
					else if (c.type === 'image') {
						// Convert Anthropic image format to Gemini inlineData format
						return {
							inlineData: {
								mimeType: c.source.media_type,
								data: c.source.data,
							},
						}
					}
					else if (c.type === 'tool_result') {
						if (!latestToolName) return null
						return { functionResponse: { id: c.tool_use_id, name: latestToolName, response: { output: c.content } } }
					}
					else return null
				}).filter(m => !!m)

				// Ensure we have at least one part, and if we have images, ensure we have text
				const hasImages = parts.some(p => 'inlineData' in p);
				const hasText = parts.some(p => 'text' in p);

				if (parts.length === 0) {
					parts.push({ text: '(empty message)' });
				} else if (hasImages && !hasText) {
					// If we have images but no text, prepend a text part (required by Gemini)
					parts.unshift({ text: '(empty message)' });
				}

				return { role: 'user', parts, }
			}

		}
		else return null
	}).filter(m => !!m)

	return messages2
}


const prepareMessages = (params: {
	messages: SimpleLLMMessage[],
	systemMessage: string,
	aiInstructions: string,
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated',
	specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined,
	supportsAnthropicReasoning: boolean,
	contextWindow: number,
	reservedOutputTokenSpace: number | null | undefined,
	providerName: ProviderName
}): { messages: LLMChatMessage[], separateSystemMessage: string | undefined } => {

	const specialFormat = params.specialToolFormat // this is just for ts stupidness

	// if need to convert to gemini style of messaes, do that (treat as anthropic style, then convert to gemini style)
	if (params.providerName === 'gemini' || specialFormat === 'gemini-style') {
		const res = prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat === 'gemini-style' ? 'anthropic-style' : undefined })
		const messages = res.messages as AnthropicLLMChatMessage[]
		const messages2 = prepareGeminiMessages(messages)
		return { messages: messages2, separateSystemMessage: res.separateSystemMessage }
	}

	return prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat })
}




export interface IConvertToLLMMessageService {
	readonly _serviceBrand: undefined;
	prepareLLMSimpleMessages: (opts: { simpleMessages: SimpleLLMMessage[], systemMessage: string, modelSelection: ModelSelection | null, featureName: FeatureName }) => { messages: LLMChatMessage[], separateSystemMessage: string | undefined }
	prepareLLMChatMessages: (opts: { chatMessages: ChatMessage[], chatMode: ChatMode, modelSelection: ModelSelection | null, repoIndexerPromise?: Promise<{ results: string[], metrics: any } | null>, subagentSystemPrompt?: string, allowedToolNames?: string[], todoReminder?: string }) => Promise<{ messages: LLMChatMessage[], separateSystemMessage: string | undefined }>
	prepareFIMMessage(opts: { messages: LLMFIMMessage, modelSelection: ModelSelection | null, featureName: FeatureName, languageId?: string }): { prefix: string, suffix: string, stopTokens: string[] }
	startRepoIndexerQuery: (chatMessages: ChatMessage[], chatMode: ChatMode) => Promise<{ results: string[], metrics: any } | null>
}

export const IConvertToLLMMessageService = createDecorator<IConvertToLLMMessageService>('ConvertToLLMMessageService');


class ConvertToLLMMessageService extends Disposable implements IConvertToLLMMessageService {
	_serviceBrand: undefined;

	// Cache system messages to avoid rebuilding on every request
	// Optimized: Longer TTL since system messages rarely change during a session
	private _systemMessageCache: Map<string, { message: string; timestamp: number }> = new Map();
	private readonly _systemMessageCacheTTL = 120_000; // 2 minutes cache TTL (increased from 30s for better performance)

	constructor(
		@IModelService private readonly modelService: IModelService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly editorService: IEditorService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@ICortexideSettingsService private readonly cortexideSettingsService: ICortexideSettingsService,
		@ICortexideModelService private readonly cortexideModelService: ICortexideModelService,
		@IMCPService private readonly mcpService: IMCPService,
		@IRepoIndexerService private readonly repoIndexerService: IRepoIndexerService,
		@INotificationService private readonly notificationService: INotificationService,
		@IMemoriesService private readonly memoriesService: IMemoriesService,
		@ICortexideRulesService private readonly rulesService: ICortexideRulesService,
		@ICortexideAgentsService private readonly agentsService: ICortexideAgentsService,
	) {
		super()
	}

	// Read .voidrules files from workspace folders
	private _getVoidRulesFileContents(): string {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			let voidRules = '';
			for (const folder of workspaceFolders) {
				const uri = URI.joinPath(folder.uri, '.voidrules')
				const { model } = this.cortexideModelService.getModel(uri)
				if (!model) continue
				voidRules += model.getValue(EndOfLinePreference.LF) + '\n\n';
			}
			return voidRules.trim();
		}
		catch (e) {
			return ''
		}
	}

	// Get combined AI instructions from settings, .voidrules files, and .cortexide/rules/*.md
	private _getCombinedAIInstructions(activeFileUri?: URI): string {
		const globalAIInstructions = this.cortexideSettingsService.state.globalSettings.aiInstructions;
		const voidRulesFileContent = this._getVoidRulesFileContents();
		// New: structured rules from .cortexide/rules/*.md (scoped per active file)
		const structuredRules = this.rulesService.buildRulesBlock(activeFileUri);

		const ans: string[] = []
		if (globalAIInstructions) ans.push(globalAIInstructions)
		if (voidRulesFileContent) ans.push(voidRulesFileContent)
		if (structuredRules) ans.push(structuredRules)
		return ans.join('\n\n')
	}


	// system message with caching
	private _generateChatMessagesSystemMessage = async (chatMode: ChatMode, specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined, subagentSystemPrompt?: string, allowedToolNames?: string[]) => {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders.map(f => f.uri.fsPath)

		const openedURIs = this.modelService.getModels().filter(m => m.isAttachedToEditor()).map(m => m.uri.fsPath) || [];
		const activeURI = this.editorService.activeEditor?.resource?.fsPath;

		// Discoverability: list the user's custom agents (.cortexide/agents/*.md) so the orchestrator
		// knows which agentType values it can delegate to via run_subagent. Undefined when none exist
		// (=> no injection, zero impact for users without custom agents). Cloud only — run_subagent is
		// curated out of the local toolset.
		const customAgents = this.agentsService.agents;
		const availableSubagents = customAgents.length > 0
			? customAgents.map(a => `- ${a.name}: ${a.description || '(no description)'}`).join('\n')
			: undefined;

		// Create cache key from relevant factors
		// Include sub-agent role + available-agents list so a sub-agent's system message is never served
		// from — or poisons — the normal-turn cache, and the agents list refreshes when it changes.
		const cacheKey = `${chatMode}|${specialToolFormat}|${workspaceFolders.join(',')}|${openedURIs.join(',')}|${activeURI || ''}|sa:${subagentSystemPrompt ?? ''}|agents:${availableSubagents ?? ''}|tools:${(allowedToolNames ?? []).join('+')}`;

		// Check cache
		const cached = this._systemMessageCache.get(cacheKey);
		const now = Date.now();
		if (cached && (now - cached.timestamp) < this._systemMessageCacheTTL) {
			return cached.message;
		}

		const directoryStr = await this.directoryStrService.getAllDirectoriesStr({
			cutOffMessage: chatMode === 'agent' || chatMode === 'gather' ?
				`...Directories string cut off, use tools to read more...`
				: `...Directories string cut off, ask user for more if necessary...`
		})

		// Only inject the XML tool-call contract when the model's tool calls will actually be parsed from
		// text (i.e. it has NO native tool-calling format). A native-format model (Anthropic/OpenAI/Gemini)
		// receives its tools via the provider `tools` parameter; force-feeding it the "output ONLY a tool
		// call in XML format ... STOP immediately after ... NO explanatory text" contract makes it emit
		// inert XML *text* that nothing extracts (extractXMLToolsWrapper only runs for !specialToolFormat),
		// so the action is silently dropped. See agentic-audit finding #3.
		const includeXMLToolDefinitions = !specialToolFormat

		const mcpTools = this.mcpService.getMCPTools()

		const persistentTerminalIDs = this.terminalToolService.listPersistentTerminalIds()

		// Get relevant memories for the current context (use active file and recent user messages as query)
		let relevantMemories: string | undefined;
		if (this.memoriesService.isEnabled()) {
			try {
				// Build query from active file and opened files for relevance
				const queryParts: string[] = [];
				if (activeURI) {
					const fileName = activeURI.split('/').pop() || '';
					queryParts.push(fileName);
				}
				openedURIs.forEach(uri => {
					const fileName = uri.split('/').pop() || '';
					queryParts.push(fileName);
				});
				const query = queryParts.join(' ') || 'project context';

				const memories = await this.memoriesService.getRelevantMemories(query, 5);
				if (memories.length > 0) {
					const memoryLines = memories.map(m => {
						const typeLabel = m.entry.type === 'decision' ? 'Decision' :
							m.entry.type === 'preference' ? 'Preference' :
								m.entry.type === 'recentFile' ? 'Recent File' : 'Context';
						return `- [${typeLabel}] ${m.entry.key}: ${m.entry.value}`;
					});
					relevantMemories = memoryLines.join('\n');
				}
			} catch (error) {
				// Memories unavailable, continue without them
				console.debug('[ConvertToLLMMessage] Failed to get memories:', error);
			}
		}

		const activeFileURI = this.editorService.activeEditor?.resource;
		const projectRules = this._getCombinedAIInstructions(activeFileURI) || undefined;
		const systemMessage = chat_systemMessage({ workspaceFolders, openedURIs, directoryStr, activeURI, persistentTerminalIDs, chatMode, mcpTools, includeXMLToolDefinitions, relevantMemories, projectRules, subagentSystemPrompt, availableSubagents, allowedToolNames })

		// Cache the result
		this._systemMessageCache.set(cacheKey, { message: systemMessage, timestamp: now });

		// Clean up old cache entries (keep cache size reasonable)
		if (this._systemMessageCache.size > 10) {
			for (const [key, value] of this._systemMessageCache.entries()) {
				if ((now - value.timestamp) >= this._systemMessageCacheTTL) {
					this._systemMessageCache.delete(key);
				}
			}
		}

		return systemMessage
	}




	// --- LLM Chat messages ---

	private _chatMessagesToSimpleMessages(chatMessages: ChatMessage[]): SimpleLLMMessage[] {
		const simpleLLMMessages: SimpleLLMMessage[] = []

		for (const m of chatMessages) {
			if (m.role === 'checkpoint') continue
			if (m.role === 'interrupted_streaming_tool') continue
			if (m.role === 'assistant') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.displayContent,
					anthropicReasoning: m.anthropicReasoning,
				})
			}
			else if (m.role === 'tool') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.content,
					name: m.name,
					id: m.id,
					rawParams: m.rawParams,
				})
			}
			else if (m.role === 'user') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.content,
					images: m.images,
				})
			}
		}
		return simpleLLMMessages
	}

	prepareLLMSimpleMessages: IConvertToLLMMessageService['prepareLLMSimpleMessages'] = ({ simpleMessages, systemMessage, modelSelection, featureName }) => {
		if (modelSelection === null) return { messages: [], separateSystemMessage: undefined }

		const { overridesOfModel, settingsOfProvider } = this.cortexideSettingsService.state

		const { providerName, modelName } = modelSelection
		// Skip "auto" - it's not a real provider
		if (providerName === 'auto' && modelName === 'auto') {
			throw new Error('Cannot prepare messages for "auto" model selection - must resolve to a real model first')
		}
		const {
			specialToolFormat,
			contextWindow,
			supportsSystemMessage,
		} = getModelCapabilities(providerName, modelName, overridesOfModel)

		const modelSelectionOptions = this.cortexideSettingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]

		// Detect if local provider for optimizations
		const isLocal = isLocalProvider(providerName, settingsOfProvider)

		// Get combined AI instructions (skip for local edit features to reduce tokens)
		const aiInstructions = (isLocal && (featureName === 'Ctrl+K' || featureName === 'Apply'))
			? '' // Skip verbose AI instructions for local edit features
			: this._getCombinedAIInstructions();

		// Keep this method synchronous (indexer enrichment handled in Chat flow)
		const enrichedSystemMessage = systemMessage;

		const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)
		const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled, overridesOfModel })

		// Apply feature-specific token caps for local models
		let effectiveContextWindow = contextWindow
		let effectiveReservedOutput = reservedOutputTokenSpace
		if (isLocal) {
			const featureTokenCap = LOCAL_MODEL_TOKEN_CAPS[featureName] || 4096
			effectiveContextWindow = Math.min(effectiveContextWindow, featureTokenCap + (reservedOutputTokenSpace || LOCAL_MODEL_RESERVED_OUTPUT))
			effectiveReservedOutput = LOCAL_MODEL_RESERVED_OUTPUT // Use smaller reserved space for locals
		}

		const { messages, separateSystemMessage } = prepareMessages({
			messages: simpleMessages,
			systemMessage: enrichedSystemMessage,
			aiInstructions,
			supportsSystemMessage,
			specialToolFormat: effectiveSpecialToolFormat(specialToolFormat, isLocal),
			supportsAnthropicReasoning: providerName === 'anthropic',
			contextWindow: effectiveContextWindow,
			reservedOutputTokenSpace: effectiveReservedOutput,
			providerName,
		})
		return { messages, separateSystemMessage };
	}
	startRepoIndexerQuery: IConvertToLLMMessageService['startRepoIndexerQuery'] = async (chatMessages, chatMode) => {
		// PERFORMANCE: Start repo indexer query early (can be done in parallel with router decision)
		if (!this.cortexideSettingsService.state.globalSettings.enableRepoIndexer) {
			return null;
		}

		const lastUserMessage = chatMessages.filter(m => m.role === 'user').pop();
		const userQuery = lastUserMessage?.content || chatMessages.filter(m => m.role === 'user').map(m => m.content).join(' ').slice(0, 200);
		if (!userQuery.trim()) {
			return null;
		}

		try {
			const k = chatMode === 'agent' ? 8 : 6;
			const result = await this.repoIndexerService.queryWithMetrics(userQuery, k);
			return result;
		} catch (error) {
			// Try to warm index if query failed (might not exist yet)
			this.repoIndexerService.warmIndex(undefined).catch(() => { });
			return null;
		}
	}

	prepareLLMChatMessages: IConvertToLLMMessageService['prepareLLMChatMessages'] = async ({ chatMessages, chatMode, modelSelection, repoIndexerPromise, subagentSystemPrompt, allowedToolNames, todoReminder }) => {
		if (modelSelection === null) return { messages: [], separateSystemMessage: undefined }

		const { overridesOfModel } = this.cortexideSettingsService.state

		const { providerName, modelName } = modelSelection
		// Skip "auto" - it's not a real provider
		if (providerName === 'auto' && modelName === 'auto') {
			throw new Error('Cannot prepare messages for "auto" model selection - must resolve to a real model first')
		}
		// At this point, TypeScript knows providerName is not "auto", but we need to assert it for the type system
		const validProviderName = providerName as Exclude<typeof providerName, 'auto'>
		const {
			specialToolFormat,
			contextWindow,
			supportsSystemMessage,
		} = getModelCapabilities(validProviderName, modelName, overridesOfModel)

		const { disableSystemMessage } = this.cortexideSettingsService.state.globalSettings;

		// For local models, use minimal system message template instead of truncating
		const isLocal = isLocalProvider(validProviderName, this.cortexideSettingsService.state.settingsOfProvider)
		// A capable local model (>=7B -- coder OR general) additionally gets the web tools (so "check online"
		// actually works); small local models stay on the compact set. Param size comes from the provider's
		// reported model details (ollama details.parameter_size), same source the router uses.
		const realParamSizeLocal: string | undefined = isLocal
			? this.cortexideSettingsService.state.settingsOfProvider[validProviderName]?.models?.find((m: { modelName: string; parameterSize?: string }) => m.modelName === modelName)?.parameterSize
			: undefined
		// Web tools are gated on model CAPABILITY (>=7B), not coder-ness -- a capable general model
		// (e.g. llama3:8b, which Auto may resolve to) should also get web_search, not just coders.
		const isCapableLocalModelFlag = isLocal && isCapableLocalModel(modelName.toLowerCase(), realParamSizeLocal)

		let systemMessage: string
		if (disableSystemMessage) {
			systemMessage = ''
		} else if (isLocal) {
			// Use minimal local template for local models
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders.map(f => f.uri.fsPath)
			const openedURIs = this.editorService.editors.map(e => e.resource?.fsPath || '').filter(Boolean)
			const activeURI = this.editorService.activeEditor?.resource?.fsPath
			const directoryStr = await this.directoryStrService.getAllDirectoriesStr({
				cutOffMessage: chatMode === 'agent' || chatMode === 'gather' ?
					`...Directories string cut off, use tools to read more...`
					: `...Directories string cut off, ask user for more if necessary...`
			})
			// Local models (ollama/vLLM/LM Studio) emit tool calls as XML/JSON TEXT even when tagged with a
			// native specialToolFormat — sendOllamaChat sends no native `tools` and the calls come back inside
			// message.content (see finding #8). They always need the XML tool definitions to know the format.
			const includeXMLToolDefinitions = true
			const mcpTools = this.mcpService.getMCPTools()
			const persistentTerminalIDs = this.terminalToolService.listPersistentTerminalIds()

			// Get relevant memories for the current context
			let relevantMemories: string | undefined;
			if (this.memoriesService.isEnabled()) {
				try {
					const queryParts: string[] = [];
					if (activeURI) {
						const fileName = activeURI.split('/').pop() || '';
						queryParts.push(fileName);
					}
					openedURIs.forEach(uri => {
						const fileName = uri.split('/').pop() || '';
						queryParts.push(fileName);
					});
					const query = queryParts.join(' ') || 'project context';
					const memories = await this.memoriesService.getRelevantMemories(query, 5);
					if (memories.length > 0) {
						const memoryLines = memories.map(m => {
							const typeLabel = m.entry.type === 'decision' ? 'Decision' :
								m.entry.type === 'preference' ? 'Preference' :
									m.entry.type === 'recentFile' ? 'Recent File' : 'Context';
							return `- [${typeLabel}] ${m.entry.key}: ${m.entry.value}`;
						});
						relevantMemories = memoryLines.join('\n');
					}
				} catch (error) {
					console.debug('[ConvertToLLMMessage] Failed to get memories:', error);
				}
			}

			const activeFileURILocal = this.editorService.activeEditor?.resource;
			const projectRulesLocal = this._getCombinedAIInstructions(activeFileURILocal) || undefined;
			systemMessage = chat_systemMessage_local({ workspaceFolders, openedURIs, directoryStr, activeURI, persistentTerminalIDs, chatMode, mcpTools, includeXMLToolDefinitions, relevantMemories, projectRules: projectRulesLocal, subagentSystemPrompt, allowedToolNames, isCapableLocalModel: isCapableLocalModelFlag })
		} else {
			// Use full system message for cloud models
			systemMessage = await this._generateChatMessagesSystemMessage(chatMode, specialToolFormat, subagentSystemPrompt, allowedToolNames)
		}

		// Query repo indexer if enabled - get context from the LAST user message (most relevant)
		// PERFORMANCE: Use pre-started promise if available (from parallel execution), otherwise start now
		if (this.cortexideSettingsService.state.globalSettings.enableRepoIndexer && !disableSystemMessage) {
			let indexResults: string[] | null = null;
			let metrics: any = null;

			if (repoIndexerPromise) {
				// Use pre-started query (from parallel execution with router)
				try {
					const result = await repoIndexerPromise;
					if (result) {
						indexResults = result.results;
						metrics = result.metrics;
					}
				} catch (error) {
					// Fall back to starting query now if pre-started failed
					const lastUserMessage = chatMessages.filter(m => m.role === 'user').pop();
					const userQuery = lastUserMessage?.content || chatMessages.filter(m => m.role === 'user').map(m => m.content).join(' ').slice(0, 200);
					if (userQuery.trim()) {
						try {
							const k = chatMode === 'agent' ? 8 : 6;
							const result = await this.repoIndexerService.queryWithMetrics(userQuery, k);
							indexResults = result.results;
							metrics = result.metrics;
						} catch (err) {
							this.repoIndexerService.warmIndex(undefined).catch(() => { });
						}
					}
				}
			} else {
				// Start query now (fallback for non-auto mode or if promise not provided)
				const lastUserMessage = chatMessages.filter(m => m.role === 'user').pop();
				const userQuery = lastUserMessage?.content || chatMessages.filter(m => m.role === 'user').map(m => m.content).join(' ').slice(0, 200);
				if (userQuery.trim()) {
					try {
						const k = chatMode === 'agent' ? 8 : 6;
						const result = await this.repoIndexerService.queryWithMetrics(userQuery, k);
						indexResults = result.results;
						metrics = result.metrics;
					} catch (error) {
						this.repoIndexerService.warmIndex(undefined).catch(() => { });
					}
				}
			}

			if (indexResults && indexResults.length > 0) {
				const guidance = `\n\n<repo_guidance>\nYou have access to repository context via <repo_context>. Use it to answer repo-specific questions and make changes. Do not claim that you lack access to the repository or files. When asked what the repo is about, summarize based on README.md, package/product metadata, and top-level docs if present.\n\nIMPORTANT: When referencing code or files from the context, cite them explicitly using the file path and line ranges provided (e.g., "In repoIndexerService.ts:42-56, the function does..."). This helps users verify your answers and navigate to the relevant code.\n</repo_guidance>`;
				const contextSection = `\n\n<repo_context>\nHere are relevant files and symbols from the codebase:\n${indexResults.map((r, i) => `${i + 1}. ${r}`).join('\n\n')}\n</repo_context>`;
				systemMessage = systemMessage + guidance + contextSection;

				// Log metrics for monitoring (only in dev/debug mode to avoid noise)
				if (console.debug && metrics) {
					const lastUserMessage = chatMessages.filter(m => m.role === 'user').pop();
					const userQuery = lastUserMessage?.content || chatMessages.filter(m => m.role === 'user').map(m => m.content).join(' ').slice(0, 200);
					console.debug('[RepoIndexer]', {
						query: userQuery.slice(0, 50),
						latencyMs: metrics.retrievalLatencyMs.toFixed(1),
						tokens: metrics.tokensInjected,
						results: metrics.resultsCount,
						topScore: metrics.topScore?.toFixed(2),
						timedOut: metrics.timedOut,
						earlyTerminated: metrics.earlyTerminated,
						mode: chatMode
					});
				}
			} else if (!repoIndexerPromise) {
				// Index might be empty - try to warm it in background (only if we started query ourselves)
				this.repoIndexerService.warmIndex(undefined).catch(() => { });
			}
		}

		// Get model options (providerName is already validated above)
		const modelSelectionOptions = this.cortexideSettingsService.state.optionsOfModelSelection['Chat'][validProviderName]?.[modelName]

		// Get combined AI instructions
		let aiInstructions = this._getCombinedAIInstructions();
		// Re-inject the agent's current todo list as fresh working memory each turn. Folded into the
		// per-turn instructions (like rules) rather than the CACHED system message, so it stays current
		// as steps complete. Empty -> caller passes undefined -> zero impact (e.g. normal/plan turns).
		if (todoReminder) {
			aiInstructions = aiInstructions ? `${aiInstructions}\n\n${todoReminder}` : todoReminder;
		}
		const isReasoningEnabled = getIsReasoningEnabledState('Chat', validProviderName, modelName, modelSelectionOptions, overridesOfModel)
		const reservedOutputTokenSpace = getReservedOutputTokenSpace(validProviderName, modelName, { isReasoningEnabled, overridesOfModel })
		let llmMessages = this._chatMessagesToSimpleMessages(chatMessages)

		// Smart context truncation: Prioritize recent messages and user selections
		const estimateTokens = (text: string) => Math.ceil(text.length / 4)
		const approximateTotalTokens = (msgs: { role: string, content: string }[], sys: string, instr: string) =>
			msgs.reduce((acc, m) => acc + estimateTokens(m.content), estimateTokens(sys) + estimateTokens(instr))
		const rot = reservedOutputTokenSpace ?? 0

		// Optimize context for local models: cap at reasonable values to reduce latency
		// Local models are slower with large contexts, so we cap them more aggressively
		// Detect local providers: explicit local providers + localhost endpoints
		const isExplicitLocalProvider: boolean = validProviderName === 'ollama' || validProviderName === 'vLLM' || validProviderName === 'lmStudio'
		let isLocalhostEndpoint: boolean = false
		if (validProviderName === 'openAICompatible' || validProviderName === 'liteLLM') {
			const endpoint = this.cortexideSettingsService.state.settingsOfProvider[validProviderName]?.endpoint || ''
			if (endpoint) {
				try {
					// Use proper URL parsing to check hostname (consistent with sendLLMMessage.impl.ts)
					const url = new URL(endpoint)
					const hostname = url.hostname.toLowerCase()
					isLocalhostEndpoint = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1'
				} catch (e) {
					// Invalid URL - assume non-local (safe default)
					isLocalhostEndpoint = false
				}
			}
		}
		const isLocalProviderForContext: boolean = isExplicitLocalProvider || isLocalhostEndpoint

		// For local models: apply feature-specific token caps and compress chat history
		// Instead of hard truncation, use semantic compression to preserve context
		if (isLocalProviderForContext) {
			// Note: Chat history compression is now handled by ChatHistoryCompressor
			// This keeps the last 5 turns uncompressed and compresses older messages
			// The compression happens in prepareLLMChatMessages before this point
			// For now, we keep a simple fallback limit if compression isn't available
			const maxTurnPairs = chatMode === 'agent' ? 5 : 3
			const userMessages = llmMessages.filter(m => m.role === 'user')
			if (userMessages.length > maxTurnPairs * 2) {
				// Keep only the last maxTurnPairs user messages and their corresponding assistant messages
				const lastUserIndices = userMessages.slice(-maxTurnPairs).map(um => llmMessages.indexOf(um))
				const firstIndexToKeep = Math.min(...lastUserIndices)
				llmMessages = llmMessages.slice(firstIndexToKeep)
			}
		}

		let effectiveContextWindow = contextWindow
		if (isLocalProviderForContext) {
			// Apply feature-specific token cap for Chat feature
			const chatTokenCap = LOCAL_MODEL_TOKEN_CAPS['Chat']
			effectiveContextWindow = Math.min(contextWindow, chatTokenCap + (reservedOutputTokenSpace || LOCAL_MODEL_RESERVED_OUTPUT))
		} else {
			// For cloud models, use existing logic
			// Cap local model contexts: use 50% of model's context window, up to 128k max
			// This reduces latency for large models while still allowing them to use their full capacity
			// allow-any-unicode-next-line
			// Small models (≤8k) keep full context, medium models (≤32k) get 16k, large models get min(50%, 128k)
			if (contextWindow <= 8_000) {
				effectiveContextWindow = contextWindow // Small models: use full context
			} else if (contextWindow <= 32_000) {
				effectiveContextWindow = Math.min(contextWindow, 16_000) // Medium models: cap at 16k
			} else {
				// Large models: use 50% of context, but cap at 128k to avoid excessive latency
				effectiveContextWindow = Math.min(Math.floor(contextWindow * 0.5), 128_000)
			}
		}

		// More aggressive budget: use 75% instead of 80% to leave more room for output
		// For local models, use 70% to further reduce latency
		const budgetMultiplier = isLocalProviderForContext ? 0.70 : 0.75
		const budget = Math.max(256, Math.floor(effectiveContextWindow * budgetMultiplier) - rot)
		const beforeTokens = approximateTotalTokens(llmMessages, systemMessage, aiInstructions)

		if (beforeTokens > budget && llmMessages.length > 6) {
			// Smart truncation: Keep recent messages + prioritize user messages with selections
			const keepTailCount = 6
			const head = llmMessages.slice(0, Math.max(0, llmMessages.length - keepTailCount))
			const tail = llmMessages.slice(-keepTailCount)

			// Prioritize user messages (they contain selections/context)
			const userMessages = head.filter(m => m.role === 'user')
			const otherMessages = head.filter(m => m.role !== 'user')

			// Keep more user messages, truncate assistant messages more aggressively
			const userSummary = userMessages.map(m => `${m.role}: ${m.content.slice(0, 2000)}`).join('\n').slice(0, 2500) // Reduced from 3000
			const otherSummary = otherMessages.map(m => `${m.role}: ${m.content.slice(0, 500)}`).join('\n').slice(0, 800) // Reduced from 1000

			const headConcat = userSummary + (otherSummary ? '\n' + otherSummary : '')
			const summary = `\n\n<chat_summary>\nPrior conversation summarized (${head.length} messages). Key points:\n${headConcat.slice(0, 800)}${headConcat.length > 800 ? '…' : ''}\n</chat_summary>` // Reduced from 1000
			systemMessage = (systemMessage || '') + summary
			llmMessages = tail
			const afterTokens = approximateTotalTokens(llmMessages, systemMessage, aiInstructions)
			try { this.notificationService.info(`Context: ~${beforeTokens} → ~${afterTokens} tokens (smart truncation)`) } catch { }
		}

		const { messages, separateSystemMessage } = prepareMessages({
			messages: llmMessages,
			systemMessage,
			aiInstructions,
			supportsSystemMessage,
			// Local providers don't actually return native tool_calls (the calls arrive as XML/JSON text),
			// so encode prior tool turns with the XML/text format to stay consistent with the system prompt
			// + parser — otherwise turn 2+ of the agent loop loses all prior tool context (finding #8).
			specialToolFormat: effectiveSpecialToolFormat(specialToolFormat, isLocalProviderForContext),
			supportsAnthropicReasoning: validProviderName === 'anthropic',
			contextWindow,
			reservedOutputTokenSpace,
			providerName: validProviderName,
		})
		return { messages, separateSystemMessage };
	}


	// --- FIM ---

	prepareFIMMessage: IConvertToLLMMessageService['prepareFIMMessage'] = ({ messages, modelSelection, featureName, languageId }) => {
		const { settingsOfProvider } = this.cortexideSettingsService.state

		// Detect if local provider for optimizations
		const isLocal = modelSelection && modelSelection.providerName !== 'auto' ? isLocalProvider(modelSelection.providerName, settingsOfProvider) : false

		// For local models, skip verbose AI instructions to reduce tokens
		const combinedInstructions = (isLocal && featureName === 'Autocomplete')
			? '' // Skip verbose AI instructions for local autocomplete
			: this._getCombinedAIInstructions();

		// Add language context to help model generate correct language code
		// This is the PROPER fix - tell the model what language it's completing
		// Make it explicit and strong to prevent wrong language or explanatory comments
		const languageContext = languageId && featureName === 'Autocomplete'
			? `// Language: ${languageId}\n// Generate ${languageId} code only. Do not add comments or explanations.\n`
			: '';

		let prefix = `\
${languageContext}\
${!combinedInstructions ? '' : `\
// Instructions:
// Do not output an explanation. Do not output comments. Only output the middle code.
${combinedInstructions.split('\n').map(line => `//${line}`).join('\n')}`}

${messages.prefix}`

		let suffix = messages.suffix
		const stopTokens = messages.stopTokens

		// Apply local token caps and smart truncation for local models
		if (isLocal && featureName === 'Autocomplete') {
			const autocompleteTokenCap = LOCAL_MODEL_TOKEN_CAPS['Autocomplete'] // 1,000 tokens
			const maxChars = autocompleteTokenCap * CHARS_PER_TOKEN // ~4,000 chars

			// Smart truncation: prioritize code near cursor, cut at line boundaries
			const truncatePrefixSuffix = (text: string, maxChars: number, isPrefix: boolean): string => {
				if (text.length <= maxChars) return text

				// Split into lines for line-boundary truncation
				const lines = text.split('\n')
				let totalChars = 0
				const resultLines: string[] = []

				// For prefix: keep lines from the end (closest to cursor)
				// For suffix: keep lines from the start (closest to cursor)
				if (isPrefix) {
					// Prefix: keep last lines (closest to cursor)
					for (let i = lines.length - 1; i >= 0; i--) {
						const line = lines[i]
						const lineWithNewline = line + '\n'
						if (totalChars + lineWithNewline.length > maxChars) break
						resultLines.unshift(line)
						totalChars += lineWithNewline.length
					}
					return resultLines.join('\n')
				} else {
					// Suffix: keep first lines (closest to cursor)
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i]
						const lineWithNewline = (i < lines.length - 1 ? line + '\n' : line)
						if (totalChars + lineWithNewline.length > maxChars) break
						resultLines.push(line)
						totalChars += lineWithNewline.length
					}
					return resultLines.join('\n')
				}
			}

			// Apply truncation to combined prefix+suffix, prioritizing code near cursor
			const combinedLength = prefix.length + suffix.length
			if (combinedLength > maxChars) {
				// Allocate space proportionally, but favor suffix (code after cursor) slightly
				const prefixMaxChars = Math.floor(maxChars * 0.45) // 45% for prefix
				const suffixMaxChars = Math.floor(maxChars * 0.55) // 55% for suffix

				prefix = truncatePrefixSuffix(prefix, prefixMaxChars, true)
				suffix = truncatePrefixSuffix(suffix, suffixMaxChars, false)
			}
		}

		return { prefix, suffix, stopTokens }
	}


}


registerSingleton(IConvertToLLMMessageService, ConvertToLLMMessageService, InstantiationType.Eager);








/*
Gemini has this, but they're openai-compat so we don't need to implement this
gemini request:
{   "role": "assistant",
	"content": null,
	"function_call": {
		"name": "get_weather",
		"arguments": {
			"latitude": 48.8566,
			"longitude": 2.3522
		}
	}
}

gemini response:
{   "role": "assistant",
	"function_response": {
		"name": "get_weather",
			"response": {
			// allow-any-unicode-next-line
			"temperature": "15°C",
				"condition": "Cloudy"
		}
	}
}
*/



