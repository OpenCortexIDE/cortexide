/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isWeb } from '../../../../base/common/platform.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { MCPServerOfName, MCPConfigFileJSON, MCPServer, MCPToolCallParams, RawMCPToolCall, MCPServerEventResponse, RECOMMENDED_MCP_SERVERS } from './mcpServiceTypes.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { InternalToolInfo } from './prompt/prompts.js';
import { ICortexideSettingsService } from './cortexideSettingsService.js';
import { MCPUserStateOfName } from './cortexideSettingsTypes.js';


type MCPServiceState = {
	mcpServerOfName: MCPServerOfName,
	error: string | undefined, // global parsing error
}

export interface IMCPService {
	readonly _serviceBrand: undefined;
	revealMCPConfigFile(): Promise<void>;
	/**
	 * One-click add a curated MCP server (see RECOMMENDED_MCP_SERVERS) to mcp.json. Never overwrites an
	 * existing entry of the same name. Returns 'added' or 'already-exists'. The config-file watcher then
	 * connects the server and surfaces its tools automatically.
	 */
	addRecommendedMCPServer(serverName: string): Promise<'added' | 'already-exists'>;
	toggleServerIsOn(serverName: string, isOn: boolean): Promise<void>;

	readonly state: MCPServiceState; // NOT persisted
	onDidChangeState: Event<void>;

	getMCPTools(): InternalToolInfo[] | undefined;
	callMCPTool(toolData: MCPToolCallParams): Promise<{ result: RawMCPToolCall }>;
	stringifyResult(result: RawMCPToolCall): string
}

export const IMCPService = createDecorator<IMCPService>('mcpConfigService');



const MCP_CONFIG_FILE_NAME = 'mcp.json';
const MCP_CONFIG_SAMPLE = { mcpServers: {} }
const MCP_CONFIG_SAMPLE_STRING = JSON.stringify(MCP_CONFIG_SAMPLE, null, 2);


// export interface MCPCallToolOfToolName {
// 	[toolName: string]: (params: any) => Promise<{
// 		result: any | Promise<any>,
// 		interruptTool?: () => void
// 	}>;
// }


class MCPService extends Disposable implements IMCPService {
	_serviceBrand: undefined;


	private readonly channel: IChannel // MCPChannel

	// list of MCP servers pulled from mcpChannel
	state: MCPServiceState = {
		mcpServerOfName: {},
		error: undefined,
	}

	// Emitters for server events
	private readonly _onDidChangeState = new Emitter<void>();
	public readonly onDidChangeState = this._onDidChangeState.event;

	// private readonly _onLoadingServersChange = new Emitter<MCPServerEventLoadingParam>();
	// public readonly onLoadingServersChange = this._onLoadingServersChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@IProductService private readonly productService: IProductService,
		@IEditorService private readonly editorService: IEditorService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@ICortexideSettingsService private readonly cortexideSettingsService: ICortexideSettingsService,
	) {
		super();

		// allow-any-unicode-next-line
		// MCP requires the Electron main process — not available in the web build
		if (isWeb) {
			this.channel = null as any;
			this.logWeb('MCPService');
			return;
		}

		this.channel = this.mainProcessService.getChannel('void-channel-mcp')


		const onEvent = (e: MCPServerEventResponse) => {
			// console.log('GOT EVENT', e)
			this._setMCPServerState(e.response.name, e.response.newServer)
		}
		this._register((this.channel.listen('onAdd_server') satisfies Event<MCPServerEventResponse>)(onEvent));
		this._register((this.channel.listen('onUpdate_server') satisfies Event<MCPServerEventResponse>)(onEvent));
		this._register((this.channel.listen('onDelete_server') satisfies Event<MCPServerEventResponse>)(onEvent));

		this._initialize();
	}


	private logWeb(serviceName: string) {
		// allow-any-unicode-next-line
		console.info(`[${serviceName}] Running in web mode — Electron IPC unavailable, feature disabled.`);
	}

	private async _initialize() {
		if (isWeb) return; // no IPC channel in web mode
		try {
			await this.cortexideSettingsService.waitForInitState;

			// Create .mcpConfig if it doesn't exist
			const mcpConfigUri = await this._getMCPConfigFilePath();
			const fileExists = await this._configFileExists(mcpConfigUri);
			if (!fileExists) {
				await this._createMCPConfigFile(mcpConfigUri);
				console.log('MCP Config file created:', mcpConfigUri.toString());
			}
			await this._addMCPConfigFileWatcher();
			await this._refreshMCPServers();
		} catch (error) {
			console.error('Error initializing MCPService:', error);
		}
	}

	private readonly _setMCPServerState = async (serverName: string, newServer: MCPServer | undefined) => {
		if (newServer === undefined) {
			// Remove the server from the state
			const { [serverName]: removed, ...remainingServers } = this.state.mcpServerOfName;
			this.state = {
				...this.state,
				mcpServerOfName: remainingServers
			}
		} else {
			// Add or update the server
			this.state = {
				...this.state,
				mcpServerOfName: {
					...this.state.mcpServerOfName,
					[serverName]: newServer
				}
			}
		}
		this._onDidChangeState.fire();
	}

	private readonly _setHasError = async (errMsg: string | undefined) => {
		this.state = {
			...this.state,
			error: errMsg,
		}
		this._onDidChangeState.fire();
	}

	// Create the file/directory if it doesn't exist
	private async _createMCPConfigFile(mcpConfigUri: URI): Promise<void> {
		await this.fileService.createFile(mcpConfigUri.with({ path: mcpConfigUri.path }));
		const buffer = VSBuffer.fromString(MCP_CONFIG_SAMPLE_STRING);
		await this.fileService.writeFile(mcpConfigUri, buffer);
	}


	private _isRefreshing = false;

	private async _addMCPConfigFileWatcher(): Promise<void> {
		const mcpConfigUri = await this._getMCPConfigFilePath();
		this._register(
			this.fileService.watch(mcpConfigUri)
		)

		this._register(this.fileService.onDidFilesChange(async e => {
			if (!e.contains(mcpConfigUri)) return
			if (this._isRefreshing) return; // skip if a refresh is already in-flight
			await this._refreshMCPServers();
		}));
	}

	// Client-side functions

	public async revealMCPConfigFile(): Promise<void> {
		try {
			const mcpConfigUri = await this._getMCPConfigFilePath();
			await this.editorService.openEditor({
				resource: mcpConfigUri,
				options: {
					pinned: true,
					revealIfOpened: true,
				}
			});
		} catch (error) {
			console.error('Error opening MCP config file:', error);
		}
	}

	public async addRecommendedMCPServer(serverName: string): Promise<'added' | 'already-exists'> {
		const recommended = RECOMMENDED_MCP_SERVERS[serverName];
		if (!recommended) throw new Error(`Unknown recommended MCP server: ${serverName}`);

		const mcpConfigUri = await this._getMCPConfigFilePath();
		if (!(await this._configFileExists(mcpConfigUri))) {
			await this._createMCPConfigFile(mcpConfigUri);
		}

		const parsed: MCPConfigFileJSON = (await this._parseMCPConfigFile()) ?? { mcpServers: {} };
		if (!parsed.mcpServers) parsed.mcpServers = {};

		// Never clobber an existing entry of the same name — just reveal the file so the user can edit it.
		if (parsed.mcpServers[serverName]) {
			await this.revealMCPConfigFile();
			return 'already-exists';
		}

		parsed.mcpServers[serverName] = recommended.entry;
		const buffer = VSBuffer.fromString(JSON.stringify(parsed, null, 2));
		await this.fileService.writeFile(mcpConfigUri, buffer);
		// The config-file watcher picks up the write and (re)connects servers; reveal the file too so the
		// user can see what was added (and add credentials/args if needed).
		await this.revealMCPConfigFile();
		return 'added';
	}

	public getMCPTools(): InternalToolInfo[] | undefined {
		const allTools: InternalToolInfo[] = []
		for (const serverName in this.state.mcpServerOfName) {
			const server = this.state.mcpServerOfName[serverName];
			server.tools?.forEach(tool => {
				allTools.push({
					description: tool.description || '',
					params: this._transformInputSchemaToParams(tool.inputSchema),
					name: tool.name,
					mcpServerName: serverName,
				})
			})
		}
		if (allTools.length === 0) return undefined
		return allTools
	}

	private _transformInputSchemaToParams(inputSchema?: Record<string, any>): { [paramName: string]: { description: string } } {

		// Check if inputSchema is valid
		if (!inputSchema || !inputSchema.properties) return {};

		const params: { [paramName: string]: { description: string } } = {};
		Object.keys(inputSchema.properties).forEach(paramName => {
			const propertyValues = inputSchema.properties[paramName];

			// Check if propertyValues is not an object
			if (typeof propertyValues !== 'object') {
				console.warn(`Invalid property value for ${paramName}: expected object, got ${typeof propertyValues}`);
				return; // in forEach the return is equivalent to continue
			}

			// Add the parameter to the params object
			params[paramName] = {
				description: JSON.stringify(propertyValues.description || '', null, 2) || '',
			}
		});
		return params;
	}

	private async _getMCPConfigFilePath(): Promise<URI> {
		const appName = this.productService.dataFolderName
		const userHome = await this.pathService.userHome();
		const uri = URI.joinPath(userHome, appName, MCP_CONFIG_FILE_NAME)
		return uri
	}

	private async _configFileExists(mcpConfigUri: URI): Promise<boolean> {
		try {
			await this.fileService.stat(mcpConfigUri);
			return true;
		} catch (error) {
			return false;
		}
	}


	private async _parseMCPConfigFile(): Promise<MCPConfigFileJSON | null> {
		const mcpConfigUri = await this._getMCPConfigFilePath();
		try {
			const fileContent = await this.fileService.readFile(mcpConfigUri);
			const contentString = fileContent.value.toString();
			const configFileJson = JSON.parse(contentString);
			if (!configFileJson.mcpServers) {
				throw new Error('Missing mcpServers property');
			}
			return configFileJson as MCPConfigFileJSON;
		} catch (error) {
			const fullError = `Error parsing MCP config file: ${error}`;
			this._setHasError(fullError)
			return null;
		}
	}


	// Handle server state changes
	private async _refreshMCPServers(): Promise<void> {
		if (this._isRefreshing) return;
		this._isRefreshing = true;

		try {
			await this._setHasError(undefined)

			const newConfigFileJSON = await this._parseMCPConfigFile();
			if (!newConfigFileJSON) { console.log(`Not setting state: MCP config file not found`); return }
			if (!newConfigFileJSON?.mcpServers) { console.log(`Not setting state: MCP config file did not have an 'mcpServers' field`); return }


			const oldConfigFileNames = Object.keys(this.state.mcpServerOfName)
			const newConfigFileNames = Object.keys(newConfigFileJSON.mcpServers)

			const addedServerNames = newConfigFileNames.filter(serverName => !oldConfigFileNames.includes(serverName)); // in new and not in old
			const removedServerNames = oldConfigFileNames.filter(serverName => !newConfigFileNames.includes(serverName)); // in old and not in new

			// set isOn to any new servers in the config
			const addedUserStateOfName: MCPUserStateOfName = {}
			for (const name of addedServerNames) { addedUserStateOfName[name] = { isOn: true } }
			await this.cortexideSettingsService.addMCPUserStateOfNames(addedUserStateOfName);

			// delete isOn for any servers that no longer show up in the config
			await this.cortexideSettingsService.removeMCPUserStateOfNames(removedServerNames);

			// set all servers to loading
			for (const serverName in newConfigFileJSON.mcpServers) {
				this._setMCPServerState(serverName, { status: 'loading', tools: [] })
			}
			const updatedServerNames = Object.keys(newConfigFileJSON.mcpServers).filter(serverName => !addedServerNames.includes(serverName) && !removedServerNames.includes(serverName))

			await this.channel.call('refreshMCPServers', {
				mcpConfigFileJSON: newConfigFileJSON,
				addedServerNames,
				removedServerNames,
				updatedServerNames,
				userStateOfName: this.cortexideSettingsService.state.mcpUserStateOfName,
				// Phase 8: stamp local-only privacy mode so electron-main refuses to connect to a
				// remote MCP server. Sent on every refresh so the gate tracks the routing policy.
				localOnly: this.cortexideSettingsService.state.globalSettings.routingPolicy === 'local-only',
			}).catch((e: unknown) => this._setHasError(`Failed to refresh MCP servers: ${e instanceof Error ? e.message : String(e)}`));
		} finally {
			this._isRefreshing = false;
		}
	}

	stringifyResult(result: RawMCPToolCall): string {
		let toolResultStr: string
		if (result.event === 'text') {
			toolResultStr = result.text
		} else if (result.event === 'image') {
			toolResultStr = `[Image: ${result.image.mimeType}]`
		} else if (result.event === 'audio') {
			toolResultStr = `[Audio content]`
		} else if (result.event === 'resource') {
			toolResultStr = `[Resource content]`
		} else {
			toolResultStr = JSON.stringify(result)
		}
		return toolResultStr
	}

	// toggle MCP server and update isOn in void settings
	public async toggleServerIsOn(serverName: string, isOn: boolean): Promise<void> {
		await this._setMCPServerState(serverName, { status: 'loading', tools: [] })

		await this.cortexideSettingsService.setMCPServerState(serverName, { isOn });
		await this.channel.call('toggleMCPServer', { serverName, isOn, localOnly: this.cortexideSettingsService.state.globalSettings.routingPolicy === 'local-only' })
			.catch((e: unknown) => this._setMCPServerState(serverName, {
				status: 'error',
				error: `Toggle failed: ${e instanceof Error ? e.message : String(e)}`,
			}));
	}


	public async callMCPTool(toolData: MCPToolCallParams): Promise<{ result: RawMCPToolCall }> {
		try {
			const result = await this.channel.call<RawMCPToolCall>('callTool', toolData);
			// Surface error results inline so the chat thread can render them without crashing
			return { result };
		} catch (e) {
			const errorText = e instanceof Error ? e.message : String(e);
			const errorResult: RawMCPToolCall = {
				event: 'error',
				text: `Tool call failed: ${errorText}`,
				toolName: toolData.toolName,
				serverName: toolData.serverName,
			};
			return { result: errorResult };
		}
	}

	// public getMCPToolFns(): MCPToolResultType {
	// 	const tools = this.getMCPTools();
	// 	const toolFns: MCPToolResultType = {};

	// 	tools.forEach((tool) => {
	// 		const name = tool.name;
	// 		// Define the tool call function
	// 		const toolFn = async (params: {
	// 			serverName: string,
	// 			toolName: string,
	// 			args: any
	// 		}) => {
	// 			const { serverName, toolName, args } = params;
	// 			const response = await this.callMCPTool({
	// 				serverName,
	// 				toolName,
	// 				params: args,
	// 			});
	// 			return { result: response }
	// 		};
	// 		toolFns[name] = toolFn;
	// 	});

	// 	return toolFns
	// }
}

registerSingleton(IMCPService, MCPService, InstantiationType.Eager);
