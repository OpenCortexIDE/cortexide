/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// registered in app.ts
// can't make a service responsible for this, because it needs
// to be connected to the main process and node dependencies

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MCPConfigFileJSON, MCPConfigFileEntryJSON, MCPServer, RawMCPToolCall, MCPToolErrorResponse, MCPServerEventResponse, MCPToolCallParams, removeMCPToolNamePrefix, mcpToolNamePrefix } from '../common/mcpServiceTypes.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPUserStateOfName } from '../common/cortexideSettingsTypes.js';
import { canEgress, classifyDestination } from '../common/egressPolicy.js';

const getClientConfig = (serverName: string) => {
	return {
		name: `${serverName}-client`,
		version: '0.1.0',
		// debug: true,
	}
}

type MCPServerNonError = MCPServer & { status: Omit<MCPServer['status'], 'error'> }
type MCPServerError = MCPServer & { status: 'error' }



type ClientInfo = {
	_client: Client, // _client is the client that connects with an mcp client. We're calling mcp clients "server" everywhere except here for naming consistency.
	mcpServerEntryJSON: MCPConfigFileEntryJSON,
	mcpServer: MCPServerNonError,
} | {
	_client?: undefined,
	mcpServerEntryJSON: MCPConfigFileEntryJSON,
	mcpServer: MCPServerError,
}

type InfoOfClientId = {
	[clientId: string]: ClientInfo
}

export class MCPChannel implements IServerChannel {

	private readonly infoOfClientId: InfoOfClientId = {}
	private readonly _refreshingServerNames: Set<string> = new Set()

	// Phase 8: local-only privacy mode, stamped by the renderer (from routingPolicy) on every
	// refresh/toggle. When on, _createClientUnsafe refuses to connect to a non-loopback MCP
	// server -- closing the only ungated MCP egress (the connect/discovery at server-add time;
	// the agent's MCP tool INVOCATION is already blocked by checkToolAllowedInMode).
	private _localOnly = false

	// mcp emitters
	private readonly mcpEmitters = {
		serverEvent: {
			onAdd: new Emitter<MCPServerEventResponse>(),
			onUpdate: new Emitter<MCPServerEventResponse>(),
			onDelete: new Emitter<MCPServerEventResponse>(),
		}
	} satisfies {
		serverEvent: {
			onAdd: Emitter<MCPServerEventResponse>,
			onUpdate: Emitter<MCPServerEventResponse>,
			onDelete: Emitter<MCPServerEventResponse>,
		}
	}

	constructor(
	) { }

	// browser uses this to listen for changes
	listen(_: unknown, event: string): Event<any> {

		// server events
		if (event === 'onAdd_server') return this.mcpEmitters.serverEvent.onAdd.event;
		else if (event === 'onUpdate_server') return this.mcpEmitters.serverEvent.onUpdate.event;
		else if (event === 'onDelete_server') return this.mcpEmitters.serverEvent.onDelete.event;
		// else if (event === 'onLoading_server') return this.mcpEmitters.serverEvent.onChangeLoading.event;

		// tool call events

		// handle unknown events
		else throw new Error(`Event not found: ${event}`);
	}

	// browser uses this to call (see this.channel.call() in mcpConfigService.ts for all usages)
	async call(_: unknown, command: string, params: any): Promise<any> {
		// Phase 8: the renderer stamps the current local-only privacy state onto every
		// refresh/toggle so the connect gate always reflects the latest routing policy.
		if (params && typeof params.localOnly === 'boolean') {
			this._localOnly = params.localOnly
		}
		if (command === 'refreshMCPServers') {
			await this._refreshMCPServers(params)
		}
		else if (command === 'closeAllMCPServers') {
			await this._closeAllMCPServers()
		}
		else if (command === 'toggleMCPServer') {
			await this._toggleMCPServer(params.serverName, params.isOn)
		}
		else if (command === 'callTool') {
			const p: MCPToolCallParams = params
			const response = await this._safeCallTool(p.serverName, p.toolName, p.params)
			return response
		}
		else {
			throw new Error(`CortexIDE: command "${command}" not recognized.`)
		}
	}

	// server functions


	private async _refreshMCPServers(params: { mcpConfigFileJSON: MCPConfigFileJSON, userStateOfName: MCPUserStateOfName, addedServerNames: string[], removedServerNames: string[], updatedServerNames: string[], localOnly?: boolean }) {

		const {
			mcpConfigFileJSON,
			userStateOfName,
			addedServerNames,
			removedServerNames,
			updatedServerNames,
		} = params

		const { mcpServers: mcpServersJSON } = mcpConfigFileJSON

		const allChanges: { type: 'added' | 'removed' | 'updated', serverName: string }[] = [
			...addedServerNames.map(n => ({ serverName: n, type: 'added' }) as const),
			...removedServerNames.map(n => ({ serverName: n, type: 'removed' }) as const),
			...updatedServerNames.map(n => ({ serverName: n, type: 'updated' }) as const),
		]

		await Promise.all(
			allChanges.map(async ({ serverName, type }) => {

				// check if already refreshing
				if (this._refreshingServerNames.has(serverName)) return
				this._refreshingServerNames.add(serverName)

				const prevServer = this.infoOfClientId[serverName]?.mcpServer;

				// close and delete the old client
				if (type === 'removed' || type === 'updated') {
					await this._closeClient(serverName)
					delete this.infoOfClientId[serverName]
					this.mcpEmitters.serverEvent.onDelete.fire({ response: { prevServer, name: serverName, } })
				}

				// create a new client
				if (type === 'added' || type === 'updated') {
					const clientInfo = await this._createClient(mcpServersJSON[serverName], serverName, userStateOfName[serverName]?.isOn)
					this.infoOfClientId[serverName] = clientInfo
					this.mcpEmitters.serverEvent.onAdd.fire({ response: { newServer: clientInfo.mcpServer, name: serverName, } })
				}
			})
		)

		allChanges.forEach(({ serverName, type }) => {
			this._refreshingServerNames.delete(serverName)
		})

	}

	private async _createClientUnsafe(server: MCPConfigFileEntryJSON, serverName: string, isOn: boolean): Promise<ClientInfo> {

		const clientConfig = getClientConfig(serverName)
		const client = new Client(clientConfig)
		let transport: Transport;
		let info: MCPServerNonError;

		if (server.url) {
			// Normalize URL to URL object (MCP SDK transports accept URL objects)
			let url: URL;
			try {
				url = typeof server.url === 'string' ? new URL(server.url) : server.url;
			} catch (urlErr) {
				throw new Error(`Invalid URL for server ${serverName}: ${server.url}. ${urlErr instanceof Error ? urlErr.message : String(urlErr)}`);
			}
			const urlString = url.toString();
			// EGRESS GATE (Phase 8): under local-only privacy mode, refuse to connect to a
			// non-loopback MCP server. localhost MCP servers are the common, legitimate case and
			// remain allowed; a remote/private-network server would receive a connection (and
			// later tool args/results) from this machine. stdio servers (below) are local and
			// always allowed.
			if (this._localOnly) {
				const decision = canEgress({ routingPolicy: 'local-only' }, { modality: 'mcp', destinationKind: classifyDestination(urlString) })
				if (!decision.allowed) {
					throw new Error(`${decision.reason} (server "${serverName}" at ${urlString})`)
				}
			}
			// Determine transport type: explicit type, or infer from URL path
			let transportType = server.type;
			// If no explicit type, check if URL path suggests SSE (e.g., contains '/sse')
			if (!transportType && urlString.toLowerCase().includes('/sse')) {
				transportType = 'sse';
			}

			// If type is explicitly 'sse' or inferred as SSE, use SSE directly
			if (transportType === 'sse') {
				try {
					transport = new SSEClientTransport(url);
					await client.connect(transport);
					console.log(`Connected via SSE to ${serverName}`);
					const { tools } = await client.listTools()
					const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(serverName, name), ...rest }))
					info = {
						status: isOn ? 'success' : 'offline',
						tools: toolsWithUniqueName,
						command: urlString,
					}
				} catch (sseErr) {
					throw new Error(`Failed to connect to SSE server at ${urlString}: ${sseErr instanceof Error ? sseErr.message : String(sseErr)}`);
				}
			}
			// If type is explicitly 'http', only try HTTP
			else if (transportType === 'http') {
				try {
					transport = new StreamableHTTPClientTransport(url);
					await client.connect(transport);
					console.log(`Connected via HTTP to ${serverName}`);
					const { tools } = await client.listTools()
					const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(serverName, name), ...rest }))
					info = {
						status: isOn ? 'success' : 'offline',
						tools: toolsWithUniqueName,
						command: urlString,
					}
				} catch (httpErr) {
					throw new Error(`Failed to connect to HTTP server at ${urlString}: ${httpErr instanceof Error ? httpErr.message : String(httpErr)}`);
				}
			}
			// If type is not specified, try HTTP first, fall back to SSE
			else {
				try {
					transport = new StreamableHTTPClientTransport(url);
					await client.connect(transport);
					console.log(`Connected via HTTP to ${serverName}`);
					const { tools } = await client.listTools()
					const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(serverName, name), ...rest }))
					info = {
						status: isOn ? 'success' : 'offline',
						tools: toolsWithUniqueName,
						command: urlString,
					}
				} catch (httpErr) {
					console.warn(`HTTP failed for ${serverName}, trying SSE…`, httpErr);
					transport = new SSEClientTransport(url);
					await client.connect(transport);
					const { tools } = await client.listTools()
					const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(serverName, name), ...rest }))
					console.log(`Connected via SSE to ${serverName}`);
					info = {
						status: isOn ? 'success' : 'offline',
						tools: toolsWithUniqueName,
						command: urlString,
					}
				}
			}
		} else if (server.command) {
			// User-provided env vars take precedence over system env so custom PATHs work on all platforms
			const mergedEnv = Object.fromEntries(
				Object.entries({ ...process.env, ...server.env })
					.filter((entry): entry is [string, string] => entry[1] !== undefined)
			);
			transport = new StdioClientTransport({
				command: server.command,
				args: server.args,
				env: mergedEnv,
			});

			await client.connect(transport)

			// Get the tools from the server
			const { tools } = await client.listTools()
			const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(serverName, name), ...rest }))

			// Create a full command string for display
			const fullCommand = `${server.command} ${server.args?.join(' ') || ''}`

			// Format server object
			info = {
				status: isOn ? 'success' : 'offline',
				tools: toolsWithUniqueName,
				command: fullCommand,
			}

		} else {
			throw new Error(`No url or command for server ${serverName}`);
		}


		return { _client: client, mcpServerEntryJSON: server, mcpServer: info }
	}

	private _addUniquePrefix(serverName: string, base: string) {
		// Deterministic per-server prefix (was Math.random, which gave every tool a different prefix that
		// also changed on every reconnect). mcpToolNamePrefix is stable + '_'-free so removeMCPToolNamePrefix
		// strips it cleanly, and routing uses the separate serverName, not the prefix.
		return `${mcpToolNamePrefix(serverName)}_${base}`;
	}

	private async _createClient(serverConfig: MCPConfigFileEntryJSON, serverName: string, isOn = true): Promise<ClientInfo> {
		try {
			const c: ClientInfo = await this._createClientUnsafe(serverConfig, serverName, isOn)
			return c
		} catch (err) {
			// allow-any-unicode-next-line
			console.error(`❌ Failed to connect to server "${serverName}":`, err);
			const fullCommand = !serverConfig.command ? '' : `${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`;
			const c: MCPServerError = { status: 'error', error: err + '', command: fullCommand, };
			return { mcpServerEntryJSON: serverConfig, mcpServer: c, };
		}
	}

	private async _closeAllMCPServers() {
		for (const serverName in this.infoOfClientId) {
			await this._closeClient(serverName);
			delete this.infoOfClientId[serverName];
		}
		console.log('Closed all MCP servers');
	}

	private async _closeClient(serverName: string) {
		const info = this.infoOfClientId[serverName];
		if (!info) {
			return;
		}
		const { _client: client } = info;
		if (client) {
			await client.close();
		}
		console.log(`Closed MCP server ${serverName}`);
	}


	private async _toggleMCPServer(serverName: string, isOn: boolean) {
		const prevServer = this.infoOfClientId[serverName]?.mcpServer;
		// Handle turning on the server
		if (isOn) {
			try {
				const clientInfo = await this._createClientUnsafe(this.infoOfClientId[serverName].mcpServerEntryJSON, serverName, isOn);
				this.infoOfClientId[serverName] = clientInfo;
				this.mcpEmitters.serverEvent.onUpdate.fire({
					response: {
						name: serverName,
						newServer: clientInfo.mcpServer,
						prevServer: prevServer,
					}
				});
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err);
				console.error(`Failed to toggle on MCP server "${serverName}":`, err);
				const fullCommand = this.infoOfClientId[serverName]?.mcpServerEntryJSON?.command || '';
				this.mcpEmitters.serverEvent.onUpdate.fire({
					response: {
						name: serverName,
						newServer: { status: 'error', error: errorMessage, command: fullCommand },
						prevServer: prevServer,
					}
				});
			}
		}
		// Handle turning off the server
		else {
			await this._closeClient(serverName);
			if (this.infoOfClientId[serverName]) {
				delete (this.infoOfClientId[serverName] as any)._client;
			}

			this.mcpEmitters.serverEvent.onUpdate.fire({
				response: {
					name: serverName,
					newServer: {
						status: 'offline',
						tools: [],
						command: prevServer?.command || '',
						error: undefined,
					},
					prevServer: prevServer,
				}
			});
		}
	}

	// tool call functions

	private async _callTool(serverName: string, toolName: string, params: Record<string, unknown>): Promise<RawMCPToolCall> {
		const server = this.infoOfClientId[serverName];
		if (!server) {
			throw new Error(`Server ${serverName} not found`);
		}
		const { _client: client } = server;
		if (!client) {
			throw new Error(`Client for server ${serverName} not found`);
		}

		// Call the tool with the provided parameters
		const response = await client.callTool({
			name: removeMCPToolNamePrefix(toolName),
			arguments: params
		});
		const { content } = response as CallToolResult;
		const returnValue = content[0];

		if (returnValue.type === 'text') {
			// handle text response

			if (response.isError) {
				throw new Error(`Tool call error: ${returnValue.text}`);
			}

			// handle success
			return {
				event: 'text',
				text: returnValue.text,
				toolName,
				serverName,
			};
		}

		// if (returnValue.type === 'audio') {
		// 	// handle audio response
		// }

		// if (returnValue.type === 'image') {
		// 	// handle image response
		// }

		// if (returnValue.type === 'resource') {
		// 	// handle resource response
		// }

		throw new Error(`Tool call error: We don\'t support ${returnValue.type} tool response yet for tool ${toolName} on server ${serverName}`);
	}

	// tool call error wrapper
	private async _safeCallTool(serverName: string, toolName: string, params: Record<string, unknown>): Promise<RawMCPToolCall> {
		try {
			const response = await this._callTool(serverName, toolName, params);
			return response;
		} catch (err) {

			let errorMessage: string;

			if (typeof err === 'object' && err !== null && err['code']) {
				const code = err.code;
				let codeDescription = '';
				if (code === -32700) {
					codeDescription = 'Parse Error';
				}
				if (code === -32600) {
					codeDescription = 'Invalid Request';
				}
				if (code === -32601) {
					codeDescription = 'Method Not Found';
				}
				if (code === -32602) {
					codeDescription = 'Invalid Parameters';
				}
				if (code === -32603) {
					codeDescription = 'Internal Error';
				}
				errorMessage = `${codeDescription}. Full response:\n${JSON.stringify(err, null, 2)}`;
			}
			// Check if it's an MCP error with a code
			else if (typeof err === 'string') {
				// String error
				errorMessage = err;
			} else {
				// Unknown error format
				errorMessage = JSON.stringify(err, null, 2);
			}

			// allow-any-unicode-next-line
			const fullErrorMessage = `❌ Failed to call tool "${toolName}" on server "${serverName}": ${errorMessage}`;
			const errorResponse: MCPToolErrorResponse = {
				event: 'error',
				text: fullErrorMessage,
				toolName,
				serverName,
			};
			return errorResponse;
		}
	}
}


