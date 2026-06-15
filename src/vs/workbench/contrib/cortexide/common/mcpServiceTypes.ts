/**
 * mcp-response-types.ts
 * --------------------------------------------------
 * **Pure** TypeScript interfaces (no external imports)
 * describing the JSON-RPC response shapes for:
 *
 *   1. tools/list      -> ToolsListResponse
 *   2. prompts/list    -> PromptsListResponse
 *   3. tools/call      -> ToolCallResponse
 *
 * They are distilled directly from the official MCP
 * 2025-03-26 specification:
 *   • Tools list response examples
 *   • Prompts list response examples
 *   • Tool call response examples
 *
 * Use them to get full IntelliSense when working with
 * @modelcontextprotocol/inspector-cli responses.
 */


/* -------------------------------------------------- */
/* Core JSON-RPC envelope                              */
/* -------------------------------------------------- */

// export interface JsonRpcSuccess<T> {
// 	/** JSON-RPC version - always '2.0' */
// 	jsonrpc: '2.0';
// 	/** Request identifier echoed back by the server */
// 	id: string | number | null;
// 	/** The successful result payload */
// 	result: T;
// }

/* -------------------------------------------------- */
/* Utility: pagination                                 */
/* -------------------------------------------------- */

// export interface Paginated {
// 	/** Opaque cursor for fetching the next page */
// 	nextCursor?: string;
// }

/* -------------------------------------------------- */
/* 1. tools/list                                       */
/* -------------------------------------------------- */

export interface MCPTool {
	/** Unique tool identifier */
	name: string;
	/** Human-readable description */
	description?: string;
	/** JSON schema describing expected arguments */
	inputSchema?: Record<string, unknown>;
	/** Free-form annotations describing behaviour, security, etc. */
	annotations?: Record<string, unknown>;
}

// export interface ToolsListResult extends Paginated {
// 	tools: MCPTool[];
// }

// export type ToolsListResponse = JsonRpcSuccess<ToolsListResult>;

/* -------------------------------------------------- */
/* 2. prompts/list                                     */
/* -------------------------------------------------- */

// export interface PromptArgument {
// 	name: string;
// 	description?: string;
// 	/** Whether the argument is required */
// 	required?: boolean;
// }

// export interface Prompt {
// 	name: string;
// 	description?: string;
// 	arguments?: PromptArgument[];
// }

// export interface PromptsListResult extends Paginated {
// 	prompts: Prompt[];
// }

// export type PromptsListResponse = JsonRpcSuccess<PromptsListResult>;

/* -------------------------------------------------- */
/* 3. tools/call                                       */
/* -------------------------------------------------- */

/** Additional resource structure that can be embedded in tool results */
// export interface Resource {
// 	uri: string;
// 	mimeType: string;
// 	/** Either plain-text or base64-encoded binary data */
// 	text?: string;
// 	data?: string;
// }

/** Individual content items returned by a tool */
// export type ToolContent =
// 	| { type: 'text'; text: string }
// 	| { type: 'image'; data: string; mimeType: string }
// 	| { type: 'audio'; data: string; mimeType: string }
// 	| { type: 'resource'; resource: Resource };

// export interface ToolCallResult {
// 	/** List of content parts (text, images, resources, etc.) */
// 	content: ToolContent[];
// 	/** True if the tool itself encountered a domain-level error */
// 	isError?: boolean;
// }

// export type ToolCallResponse = JsonRpcSuccess<ToolCallResult>;

// MCP SERVER CONFIG FILE TYPES -----------------------------

/**
 * Configuration entry for an MCP server in the CortexIDE mcp.json config file.
 *
 * Supports two connection modes:
 * 1. Command-based (stdio): Use `command` and `args` to run a local process
 * 2. URL-based (HTTP/SSE): Use `url` to connect to a remote server
 *
 * For URL-based servers:
 * - If `type` is 'sse', connects using Server-Sent Events (SSE) transport
 * - If `type` is 'http', connects using Streamable HTTP transport
 * - If `type` is not specified, tries HTTP first, then falls back to SSE
 * - If URL path contains '/sse', automatically uses SSE transport
 *
 * Examples:
 * ```json
 * {
 *   "my-server": {
 *     "url": "https://mcp.example.com/sse?key=****",
 *     "type": "sse"
 *   }
 * }
 * ```
 * or
 * ```json
 * {
 *   "my-server": {
 *     "url": "https://mcp.example.com/sse?key=****"
 *   }
 * }
 * ```
 * (The '/sse' in the URL path will automatically select SSE transport)
 */
export interface MCPConfigFileEntryJSON {
	// Command-based server properties
	command?: string;
	args?: string[];
	env?: Record<string, string>;

	// URL-based server properties
	url?: string | URL; // String from JSON, or URL object if converted
	/**
	 * Optional transport type: 'http' for Streamable HTTP, 'sse' for Server-Sent Events.
	 * If not specified, tries HTTP first, then falls back to SSE.
	 * If URL path contains '/sse', automatically uses SSE transport.
	 */
	type?: 'http' | 'sse';
	headers?: Record<string, string>;
}

export interface MCPConfigFileJSON {
	mcpServers: Record<string, MCPConfigFileEntryJSON>;
}

/**
 * Curated MCP servers offered as a one-click add (see IMCPService.addRecommendedMCPServer + the
 * Settings MCP tab). Playwright gives the agent real browser automation out of the box; it runs via
 * `npx`, so there is no global install step (npx fetches it on first use).
 */
export const RECOMMENDED_MCP_SERVERS: Record<string, { entry: MCPConfigFileEntryJSON; title: string; blurb: string }> = {
	playwright: {
		entry: { command: 'npx', args: ['@playwright/mcp@latest'] },
		title: 'Playwright (browser automation)',
		blurb: 'Lets the agent open pages, click, type, and read the DOM. Requires Node/npx.',
	},
};


// SERVER EVENT TYPES ------------------------------------------

export type MCPServer = {
	// Command-based server properties
	tools: MCPTool[],
	status: 'loading' | 'success' | 'offline',
	command?: string,
	error?: string,
} | {
	tools?: undefined,
	status: 'error',
	command?: string,
	error: string,
}

export interface MCPServerOfName {
	[serverName: string]: MCPServer;
}

export type MCPServerEvent = {
	name: string;
	prevServer?: MCPServer;
	newServer?: MCPServer;
}
export type MCPServerEventResponse = { response: MCPServerEvent }

export interface MCPConfigFileParseErrorResponse {
	response: {
		type: 'config-file-error';
		error: string | null;
	}
}


// export type MCPServerResponse = MCPAddResponse | MCPUpdateResponse | MCPDeleteResponse | MCPLoadingResponse;

// Event parameter types
// export type MCPServerEventAddParam = { response: MCPAddResponse };
// export type MCPServerEventUpdateParam = { response: MCPUpdateResponse };
// export type MCPServerEventDeleteParam = { response: MCPDeleteResponse };
// export type MCPServerEventLoadingParam = { response: MCPLoadingResponse };

// Event Param union type
// export type MCPServerEventParam = MCPServerEventAddParam | MCPServerEventUpdateParam | MCPServerEventDeleteParam | MCPServerEventLoadingParam;

// TOOL CALL EVENT TYPES ------------------------------------------

type MCPToolResponseType = 'text' | 'image' | 'audio' | 'resource' | 'error';

type ResponseImageTypes = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/svg+xml' | 'image/bmp' | 'image/tiff' | 'image/vnd.microsoft.icon';

interface ImageData {
	data: string;
	mimeType: ResponseImageTypes;
}

interface MCPToolResponseBase {
	toolName: string;
	serverName?: string;
	event: MCPToolResponseType;
	text?: string;
	image?: ImageData;
}

type MCPToolResponseConstraints = {
	'text': {
		image?: never;
		text: string;
	};
	'error': {
		image?: never;
		text: string;
	};
	'image': {
		text?: never;
		image: ImageData;
	};
	'audio': {
		text?: never;
		image?: never;
	};
	'resource': {
		text?: never;
		image?: never;
	}
}

type MCPToolEventResponse<T extends MCPToolResponseType> = Omit<MCPToolResponseBase, 'event' | keyof MCPToolResponseConstraints> & MCPToolResponseConstraints[T] & { event: T };

// Response types
export type MCPToolTextResponse = MCPToolEventResponse<'text'>;
export type MCPToolErrorResponse = MCPToolEventResponse<'error'>;
export type MCPToolImageResponse = MCPToolEventResponse<'image'>;
export type MCPToolAudioResponse = MCPToolEventResponse<'audio'>;
export type MCPToolResourceResponse = MCPToolEventResponse<'resource'>;
export type RawMCPToolCall = MCPToolTextResponse | MCPToolErrorResponse | MCPToolImageResponse | MCPToolAudioResponse | MCPToolResourceResponse;

export interface MCPToolCallParams {
	serverName: string;
	toolName: string;
	params: Record<string, unknown>;
}



export const removeMCPToolNamePrefix = (name: string) => {
	return name.split('_').slice(1).join('_')
}

/**
 * Deterministic 6-char [0-9a-z] prefix for an MCP server's tool names, derived from the server name
 * (FNV-1a). Used to keep tool names unique across servers. Deterministic -- unlike the old Math.random
 * prefix it is STABLE across reconnects/reloads (so the model sees the same tool name each session) and
 * all tools from one server share one prefix. Contains no '_', so removeMCPToolNamePrefix strips it cleanly.
 */
export const mcpToolNamePrefix = (serverName: string): string => {
	let h = 2166136261 // FNV-1a 32-bit offset basis
	for (let i = 0; i < serverName.length; i++) {
		h ^= serverName.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6)
}
