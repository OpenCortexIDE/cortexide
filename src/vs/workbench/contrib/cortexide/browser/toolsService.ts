/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js';
import { ISearchService } from '../../../services/search/common/search.js';
import { IEditCodeService } from './editCodeServiceInterface.js';
import { ITerminalToolService } from './terminalToolService.js';
import { LintErrorItem, BuiltinToolCallParams, BuiltinToolResultType, BuiltinToolName } from '../common/toolsServiceTypes.js';
import { ICortexideModelService } from '../common/cortexideModelService.js';
import { IRepoIndexerService } from './repoIndexerService.js';
import { EndOfLinePreference } from '../../../../editor/common/model.js';
import { ICortexideCommandBarService } from './cortexideCommandBarService.js';
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { timeout } from '../../../../base/common/async.js';
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from '../common/prompt/prompts.js';
import { ICortexideSettingsService } from '../common/cortexideSettingsService.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IRequestService, asJson, asTextOrError } from '../../../../platform/request/common/request.js';
import { IWebContentExtractorService } from '../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { LRUCache } from '../../../../base/common/map.js';
import { OfflinePrivacyGate } from '../common/offlinePrivacyGate.js';
import { INLShellParserService } from '../common/nlShellParserService.js';
import { ISecretDetectionService } from '../common/secretDetectionService.js';


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] };
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>; interruptTool?: () => void }> };
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string };


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined';
};

const validateStr = (argName: string, value: unknown, allowEmpty: boolean = true) => {
	if (value === null) { throw new Error(`Invalid LLM output: ${argName} was null.`); }
	if (typeof value !== 'string') { throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`); }
	if (!allowEmpty && value.trim().length === 0) { throw new Error(`Invalid LLM output: ${argName} cannot be empty.`); }
	return value;
};


/**
 * Validates a URI string and converts it to a URI object.
 * Now includes workspace validation for safety in Agent Mode.
 */
const validateURI = (uriStr: unknown, workspaceContextService?: IWorkspaceContextService, requireWorkspace: boolean = true) => {
	if (uriStr === null) { throw new Error(`Invalid LLM output: uri was null.`); }
	if (typeof uriStr !== 'string') { throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`); }

	// Normalize the path string first
	let normalizedPath = uriStr.trim();

	// Check for invalid root path
	if (normalizedPath === '/' || normalizedPath === '') {
		throw new Error(`Invalid file path: "${uriStr}" is not a valid file path. Please provide a specific file or directory path.`);
	}

	// Check for paths that are only whitespace
	if (normalizedPath.length === 0 || /^\s+$/.test(normalizedPath)) {
		throw new Error(`Invalid file path: Path contains only whitespace. Please provide a valid file or directory path.`);
	}

	// Normalize path separators and remove double slashes (but preserve leading // on Windows UNC paths)
	// Replace backslashes with forward slashes for cross-platform compatibility
	normalizedPath = normalizedPath.replace(/\\/g, '/');
	// Remove double slashes, but preserve leading // for UNC paths and :// for protocol
	// Only collapse slashes if it doesn't start with // (UNC) and doesn't contain :// (protocol)
	if (!normalizedPath.startsWith('//') && !normalizedPath.includes('://')) {
		normalizedPath = normalizedPath.replace(/\/+/g, '/');
	} else if (normalizedPath.includes('://')) {
		// For protocol URIs, collapse slashes but preserve ://
		const [scheme, rest] = normalizedPath.split('://', 2);
		normalizedPath = scheme + '://' + rest.replace(/\/+/g, '/');
	}
	// Remove trailing slashes (except for root paths)
	if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
		normalizedPath = normalizedPath.slice(0, -1);
	}

	let uri: URI;
	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	if (normalizedPath.includes('://')) {
		try {
			uri = URI.parse(normalizedPath);
		} catch (e) {
			throw new Error(`Invalid URI format: ${normalizedPath}. Error: ${e}`);
		}
	} else {
		// No scheme present, treat as file path
		// Use normalized path
		uri = URI.file(normalizedPath);

		// Check for dangerous path patterns
		// Reject paths with .. that would escape workspace
		if (normalizedPath.includes('../') || normalizedPath === '..' || normalizedPath.endsWith('/..')) {
			throw new Error(`Invalid file path: "${normalizedPath}" contains parent directory references (..) which are not allowed for security. Use a relative path without ..`);
		}

		// If we have a workspace and the path is relative (doesn't start with /), resolve it
		if (workspaceContextService && !normalizedPath.startsWith('/')) {
			const workspace = workspaceContextService.getWorkspace();
			if (workspace.folders.length > 0) {
				// Resolve relative path against workspace root
				uri = joinPath(workspace.folders[0].uri, normalizedPath);
			}
		}
		// If path is absolute (starts with /), check if it's actually within workspace
		// This handles cases where LLM returns paths like "/carepilot-api/src" that should be relative
		else if (workspaceContextService && normalizedPath.startsWith('/')) {
			const workspace = workspaceContextService.getWorkspace();
			let resolved = false;
			for (const folder of workspace.folders) {
				const workspacePath = folder.uri.fsPath;
				// Check if the absolute path is actually within this workspace folder
				// by checking if workspace path is a prefix
				if (normalizedPath.startsWith(workspacePath)) {
					// Path is already correctly absolute within workspace
					resolved = true;
					break;
				}
				// Check if path starts with workspace folder name (common LLM mistake)
				const workspaceFolderName = folder.name || folder.uri.path.split('/').pop() || '';
				if (normalizedPath.startsWith(`/${workspaceFolderName}/`) || normalizedPath === `/${workspaceFolderName}`) {
					// Treat as relative path - remove leading slash and folder name
					const relativePath = normalizedPath.replace(`/${workspaceFolderName}`, '').replace(/^\//, '');
					uri = joinPath(folder.uri, relativePath);
					resolved = true;
					break;
				}
			}
			// If path starts with / but doesn't match workspace, treat as relative path
			// This handles cases where LLM thinks "/auth-api/" means relative to workspace root
			if (!resolved && workspace.folders.length > 0) {
				// Remove leading slash and treat as relative to workspace root
				const relativePath = normalizedPath.replace(/^\//, '');
				uri = joinPath(workspace.folders[0].uri, relativePath);
			}
		}
	}

	// Normalize the URI to ensure consistent format (removes redundant slashes, normalizes path)
	// This helps prevent issues where the same file might be referenced with different URI formats
	uri = uri.with({ path: uri.path.replace(/\/+/g, '/').replace(/\/$/, '') || '/' });

	// Strict workspace enforcement for Agent Mode safety
	if (requireWorkspace && workspaceContextService) {
		const workspace = workspaceContextService.getWorkspace();
		// If no workspace is open, provide a helpful error
		if (workspace.folders.length === 0) {
			throw new Error(`Cannot access file "${uri.fsPath}" because no workspace is open. Please open a workspace folder first.`);
		}
		const isInWorkspace = workspaceContextService.isInsideWorkspace(uri);
		if (!isInWorkspace) {
			// Provide helpful error message with workspace info
			const workspaceFolders = workspace.folders.map(f => f.uri.fsPath).join(', ');
			throw new Error(`File ${uri.fsPath} is outside the workspace and cannot be accessed. Only files within the workspace are allowed for safety. Current workspace: ${workspaceFolders || 'none'}. If this is a relative path, ensure it's relative to the workspace root.`);
		}
	}

	return uri;
};

const validateOptionalURI = (uriStr: unknown, workspaceContextService?: IWorkspaceContextService) => {
	if (isFalsy(uriStr)) { return null; }
	return validateURI(uriStr, workspaceContextService, true);
};

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) { return null; }
	return validateStr(argName, str);
};


const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) { return 1; }
	const parsedInt = Number.parseInt(pageNumberUnknown + '');
	if (!Number.isInteger(parsedInt)) { throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`); }
	if (parsedInt < 1) { throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`); }
	return parsedInt;
};

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number') { return numStr; }
	if (isFalsy(numStr)) { return opts.default; }

	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '');
		if (!Number.isInteger(parsedInt)) { return opts.default; }
		return parsedInt;
	}

	return opts.default;
};

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (!terminalIdUnknown) { throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`); }
	const terminalId = terminalIdUnknown + '';
	return terminalId;
};

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') { return true; }
		if (b === 'false') { return false; }
	}
	if (typeof b === 'boolean') {
		return b;
	}
	return opts.default;
};


const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim();
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) { return true; }
	return false;
};

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	private readonly _webSearchCache = new LRUCache<string, { results: Array<{ title: string; snippet: string; url: string }>; timestamp: number }>(100);
	private readonly _browseCache = new LRUCache<string, { content: string; title?: string; url: string; metadata?: { publishedDate?: string }; timestamp: number }>(100);
	private readonly _cacheTTL = 60 * 60 * 1000; // 1 hour
	private readonly _offlineGate: OfflinePrivacyGate;

	constructor(
		@IFileService fileService: IFileService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICortexideModelService cortexideModelService: ICortexideModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@ICortexideCommandBarService private readonly commandBarService: ICortexideCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@ICortexideSettingsService private readonly cortexideSettingsService: ICortexideSettingsService,
		@INotificationService private readonly notificationService: INotificationService,
		@IRequestService private readonly requestService: IRequestService,
		@IWebContentExtractorService private readonly webContentExtractorService: IWebContentExtractorService,
		@IRepoIndexerService private readonly repoIndexerService: IRepoIndexerService,
		@INLShellParserService private readonly nlShellParserService: INLShellParserService,
		@ISecretDetectionService private readonly secretDetectionService: ISecretDetectionService,
	) {
		this._offlineGate = new OfflinePrivacyGate();
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		this.validateParams = {
			read_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params;
				const uri = validateURI(uriStr, workspaceContextService, true);
				const pageNumber = validatePageNum(pageNumberUnknown);

				let startLine = validateNumber(startLineUnknown, { default: null });
				let endLine = validateNumber(endLineUnknown, { default: null });

				if (startLine !== null && startLine < 1) { startLine = null; }
				if (endLine !== null && endLine < 1) { endLine = null; }

				return { uri, startLine, endLine, pageNumber };
			},
			ls_dir: (params: RawToolParamsObj) => {
				const { uri: uriStr, page_number: pageNumberUnknown } = params;

				const uri = validateURI(uriStr, workspaceContextService, true);
				const pageNumber = validatePageNum(pageNumberUnknown);
				return { uri, pageNumber };
			},
			get_dir_tree: (params: RawToolParamsObj) => {
				const { uri: uriStr, } = params;
				const uri = validateURI(uriStr, workspaceContextService, true);
				return { uri };
			},
			search_pathnames_only: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: includeUnknown,
					page_number: pageNumberUnknown
				} = params;

				const queryStr = validateStr('query', queryUnknown, false);
				if (queryStr.trim().length === 0) {
					throw new Error('Invalid query: Search query cannot be empty. Please provide a non-empty search term.');
				}
				const pageNumber = validatePageNum(pageNumberUnknown);
				const includePattern = validateOptionalStr('include_pattern', includeUnknown);

				return { query: queryStr.trim(), includePattern, pageNumber };

			},
			search_for_files: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: searchInFolderUnknown,
					is_regex: isRegexUnknown,
					page_number: pageNumberUnknown
				} = params;
				const queryStr = validateStr('query', queryUnknown, false);
				if (queryStr.trim().length === 0) {
					throw new Error('Invalid query: Search query cannot be empty. Please provide a non-empty search term.');
				}
				const pageNumber = validatePageNum(pageNumberUnknown);
				const searchInFolder = validateOptionalURI(searchInFolderUnknown, workspaceContextService);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return {
					query: queryStr.trim(),
					isRegex,
					searchInFolder,
					pageNumber
				};
			},
			search_in_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = validateURI(uriStr, workspaceContextService, true);
				const query = validateStr('query', queryUnknown, false);
				if (query.trim().length === 0) {
					throw new Error('Invalid query: Search query cannot be empty. Please provide a non-empty search term.');
				}
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query: query.trim(), isRegex };
			},

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params;
				const uri = validateURI(uriUnknown, workspaceContextService, true);
				return { uri };
			},

			// ---

			create_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown } = params;
				const uri = validateURI(uriUnknown, workspaceContextService, true);
				const uriStr = validateStr('uri', uriUnknown);
				const isFolder = checkIfIsFolder(uriStr);
				return { uri, isFolder };
			},

			delete_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params;
				const uri = validateURI(uriUnknown, workspaceContextService, true);
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false });
				const uriStr = validateStr('uri', uriUnknown);
				const isFolder = checkIfIsFolder(uriStr);
				return { uri, isRecursive, isFolder };
			},

			rewrite_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, new_content: newContentUnknown } = params;
				const uri = validateURI(uriStr, workspaceContextService, true);
				// Allow empty content for rewrite_file (user might want to clear file)
				const newContent = validateStr('newContent', newContentUnknown, true);
				return { uri, newContent };
			},

			edit_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params;
				const uri = validateURI(uriStr, workspaceContextService, true);
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown, false);
				if (searchReplaceBlocks.trim().length === 0) {
					throw new Error('Invalid searchReplaceBlocks: Cannot be empty. Please provide valid search and replace blocks.');
				}
				return { uri, searchReplaceBlocks: searchReplaceBlocks.trim() };
			},

			// ---

			run_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, cwd: cwdUnknown } = params;
				const command = validateStr('command', commandUnknown, false);
				if (command.trim().length === 0) {
					throw new Error('Invalid command: Command cannot be empty. Please provide a valid command to execute.');
				}
				const cwd = validateOptionalStr('cwd', cwdUnknown);
				// Validate cwd if provided - it should be a valid path within workspace
				if (cwd !== null && cwd.trim().length > 0) {
					try {
						validateURI(cwd.trim(), workspaceContextService, true);
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : String(error);
						throw new Error(`Invalid cwd (current working directory): ${errorMsg}`);
					}
				}
				const terminalId = generateUuid();
				return { command: command.trim(), cwd: cwd?.trim() || null, terminalId };
			},
			run_nl_command: (params: RawToolParamsObj) => {
				const { nl_input: nlInputUnknown, cwd: cwdUnknown } = params;
				const nlInput = validateStr('nl_input', nlInputUnknown, false);
				if (nlInput.trim().length === 0) {
					throw new Error('Invalid nl_input: Natural language command cannot be empty. Please provide a valid command description.');
				}
				const cwd = validateOptionalStr('cwd', cwdUnknown);
				// Validate cwd if provided - it should be a valid path within workspace
				if (cwd !== null && cwd.trim().length > 0) {
					try {
						validateURI(cwd.trim(), workspaceContextService, true);
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : String(error);
						throw new Error(`Invalid cwd (current working directory): ${errorMsg}`);
					}
				}
				const terminalId = generateUuid();
				return { nlInput: nlInput.trim(), cwd: cwd?.trim() || null, terminalId };
			},
			run_persistent_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown, false);
				if (command.trim().length === 0) {
					throw new Error('Invalid command: Command cannot be empty. Please provide a valid command to execute.');
				}
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown);
				return { command: command.trim(), persistentTerminalId };
			},
			open_persistent_terminal: (params: RawToolParamsObj) => {
				const { cwd: cwdUnknown } = params;
				const cwd = validateOptionalStr('cwd', cwdUnknown);
				// Validate cwd if provided - it should be a valid path within workspace
				if (cwd !== null && cwd.trim().length > 0) {
					try {
						validateURI(cwd.trim(), workspaceContextService, true);
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : String(error);
						throw new Error(`Invalid cwd (current working directory): ${errorMsg}`);
					}
				}
				// No parameters needed; will open a new background terminal
				return { cwd: cwd?.trim() || null };
			},
			kill_persistent_terminal: (params: RawToolParamsObj) => {
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},

			// ---

			web_search: (params: RawToolParamsObj) => {
				const { query: queryUnknown, k: kUnknown, refresh: refreshUnknown } = params;
				const query = validateStr('query', queryUnknown);
				// Validate query is not empty after trimming
				if (query.trim().length === 0) {
					throw new Error('Invalid query: Search query cannot be empty. Please provide a non-empty search term.');
				}
				const k = validateNumber(kUnknown, { default: 5 });
				if (k === null) {
					throw new Error('Invalid k parameter for web_search');
				}
				const validK = Math.min(Math.max(1, k), 10); // clamp between 1 and 10
				let refresh = false;
				if (refreshUnknown && typeof refreshUnknown === 'string') {
					refresh = refreshUnknown.toLowerCase() === 'true';
				}
				return { query: query.trim(), k: validK, refresh };
			},

			browse_url: (params: RawToolParamsObj) => {
				const { url: urlUnknown, refresh: refreshUnknown } = params;
				const url = validateStr('url', urlUnknown, false);
				const trimmedUrl = url.trim();
				if (trimmedUrl.length === 0) {
					throw new Error('Invalid URL: URL cannot be empty. Please provide a valid URL.');
				}
				// Basic URL validation
				if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
					throw new Error(`Invalid URL format: ${trimmedUrl}. URL must start with http:// or https://`);
				}
				try {
					new URL(trimmedUrl); // Validate URL format
				} catch (e) {
					const errorMsg = e instanceof Error ? e.message : String(e);
					throw new Error(`Invalid URL format: ${trimmedUrl}. Error: ${errorMsg}`);
				}
				let refresh = false;
				if (refreshUnknown && typeof refreshUnknown === 'string') {
					refresh = refreshUnknown.toLowerCase() === 'true';
				}
				return { url: trimmedUrl, refresh };
			},

		};


		this.callTool = {
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				const originalUri = uri.toString();
				await cortexideModelService.initializeModel(uri);
				let { model } = await cortexideModelService.getModelSafe(uri);
				if (model === null) {
					// Fallback: try to locate the file within the workspace by basename (grep-like)
					const requestedName = uri.fsPath.split(/[/\\]/).pop() || uri.fsPath;
					try {
						const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
							filePattern: requestedName,
							sortByScore: true,
						});
						const data = await searchService.fileSearch(query, CancellationToken.None);
						const fallback = data.results[0]?.resource;
						if (fallback) {
							uri = fallback;
							await cortexideModelService.initializeModel(uri);
							model = (await cortexideModelService.getModelSafe(uri)).model;
						}
					} catch { /* ignore and throw original error if still null */ }
					if (model === null) {
						throw new Error(`No contents; File does not exist: ${originalUri}. Please verify the file path is correct and the file exists in the workspace.`);
					}
				}

				const totalNumLines = model.getLineCount();

				// Validate line numbers are within valid range
				if (startLine !== null && (startLine < 1 || startLine > totalNumLines)) {
					throw new Error(`Invalid startLine: ${startLine}. Line number must be between 1 and ${totalNumLines} (file has ${totalNumLines} lines).`);
				}
				if (endLine !== null && (endLine < 1 || endLine > totalNumLines)) {
					throw new Error(`Invalid endLine: ${endLine}. Line number must be between 1 and ${totalNumLines} (file has ${totalNumLines} lines).`);
				}
				if (startLine !== null && endLine !== null && startLine > endLine) {
					throw new Error(`Invalid line range: startLine (${startLine}) must be less than or equal to endLine (${endLine}).`);
				}

				let contents: string;
				if (startLine === null && endLine === null) {
					contents = model.getValue(EndOfLinePreference.LF);
				}
				else {
					const startLineNumber = startLine === null ? 1 : startLine;
					const endLineNumber = endLine === null ? totalNumLines : endLine;
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF);
				}

				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1);
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1;
				const fileContents = contents.slice(fromIdx, toIdx + 1); // paginate
				const hasNextPage = (contents.length - 1) - toIdx >= 1;
				const totalFileLen = contents.length;
				return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } };
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber);
				return { result: dirResult };
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri);
				return { result: { str } };
			},

			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {

				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
					filePattern: queryStr,
					includePattern: includePattern ?? undefined,
					sortByScore: true, // makes results 10x better
				});
				const data = await searchService.fileSearch(query, CancellationToken.None);

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1);
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1;
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource);

				const hasNextPage = (data.results.length - 1) - toIdx >= 1;
				return { result: { uris, hasNextPage } };
			},

			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				// Validate regex pattern if isRegex is true
				if (isRegex) {
					try {
						new RegExp(queryStr);
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : String(error);
						throw new Error(`Invalid regex pattern: "${queryStr}". Error: ${errorMsg}. Please provide a valid regular expression.`);
					}
				}

				// Try indexer first for non-regex, whole-workspace queries
				let indexedUris: URI[] | null = null;
				if (!isRegex && searchInFolder === null) {
					try {
						const k = MAX_CHILDREN_URIs_PAGE * pageNumber;
						const results = await this.repoIndexerService.query(queryStr, k);
						if (results && results.length) {
							indexedUris = results.map(p => URI.file(p));
						}
					} catch { /* ignore and fall back */ }
				}

				if (indexedUris && indexedUris.length) {
					const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1);
					const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1;
					const paged = indexedUris.slice(fromIdx, toIdx + 1);
					const hasNextPage = (indexedUris.length - 1) - toIdx >= 1;
					return { result: { queryStr, uris: paged, hasNextPage } };
				}

				// Fallback: ripgrep-backed text search
				const searchFolders = searchInFolder === null ?
					workspaceContextService.getWorkspace().folders.map(f => f.uri)
					: [searchInFolder];

				const query = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders);

				const data = await searchService.textSearch(query, CancellationToken.None);

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1);
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1;
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource);

				const hasNextPage = (data.results.length - 1) - toIdx >= 1;
				return { result: { queryStr, uris, hasNextPage } };
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				const originalUri = uri.toString();
				await cortexideModelService.initializeModel(uri);
				let { model } = await cortexideModelService.getModelSafe(uri);
				if (model === null) {
					// Fallback: try to locate the file within the workspace by basename (grep-like)
					const requestedName = uri.fsPath.split(/[/\\]/).pop() || uri.fsPath;
					try {
						const query_ = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
							filePattern: requestedName,
							sortByScore: true,
						});
						const data = await searchService.fileSearch(query_, CancellationToken.None);
						const fallback = data.results[0]?.resource;
						if (fallback) {
							uri = fallback;
							await cortexideModelService.initializeModel(uri);
							model = (await cortexideModelService.getModelSafe(uri)).model;
						}
					} catch { /* ignore and throw original error if still null */ }
					if (model === null) {
						throw new Error(`No contents; File does not exist: ${originalUri}. Please verify the file path is correct and the file exists in the workspace.`);
					}
				}
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;

				// Validate regex pattern if isRegex is true
				let regex: RegExp | null = null;
				if (isRegex) {
					try {
						regex = new RegExp(query);
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : String(error);
						throw new Error(`Invalid regex pattern: "${query}". Error: ${errorMsg}. Please provide a valid regular expression.`);
					}
				}

				const lines: number[] = [];
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000);
				const { lintErrors } = this._getLintErrors(uri);
				return { result: { lintErrors } };
			},

			// ---

			create_file_or_folder: async ({ uri, isFolder }) => {
				if (isFolder) {
					await fileService.createFolder(uri);
				} else {
					// Check if file already exists
					const fileExists = await fileService.exists(uri);
					if (fileExists) {
						// Check if it's actually a file or a directory
						try {
							const stat = await fileService.stat(uri);
							if (stat.isDirectory) {
								throw new Error(`Cannot create file at ${uri.fsPath}: A directory with this name already exists.`);
							}
							// File exists - this is okay, we'll overwrite it
						} catch (error) {
							if (error instanceof Error && error.message.includes('directory')) {
								throw error;
							}
							// Other errors, continue with creation
						}
					}

					// Ensure parent directory exists and is actually a directory
					// Handle edge case: if path is root or has no parent, skip parent directory check
					const pathWithoutBasename = uri.path.replace(/\/[^/]*$/, '');
					if (pathWithoutBasename === '' || pathWithoutBasename === '/') {
						// Root path or no parent - skip parent directory validation
						// This handles cases like creating files at workspace root
					} else {
						const parentDir = uri.with({ path: pathWithoutBasename || '/' });
						try {
							const parentStat = await fileService.stat(parentDir);
							if (!parentStat.isDirectory) {
								throw new Error(`Cannot create file at ${uri.fsPath}: Parent path exists but is not a directory.`);
							}
						} catch (error) {
							// Parent doesn't exist, create it
							if (error instanceof Error && (error.message.includes('not found') || error.message.includes('ENOENT'))) {
								try {
									await fileService.createFolder(parentDir);
								} catch (createError) {
									// Parent directory might already exist (race condition), or creation failed
									// Verify it exists now
									try {
										const verifyStat = await fileService.stat(parentDir);
										if (!verifyStat.isDirectory) {
											throw new Error(`Cannot create file at ${uri.fsPath}: Parent path exists but is not a directory.`);
										}
									} catch (verifyError) {
										const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
										throw new Error(`Cannot create file at ${uri.fsPath}: Failed to create parent directory. Error: ${createErrorMsg}`);
									}
								}
							} else {
								throw error;
							}
						}
					}

					// Create the file
					await fileService.createFile(uri);

					// Verify file was actually created and is readable
					try {
						const stat = await fileService.stat(uri);
						if (stat.isDirectory) {
							throw new Error(`File creation failed: A directory was created instead of a file at ${uri.fsPath}.`);
						}
					} catch (error) {
						if (error instanceof Error && error.message.includes('directory')) {
							throw error;
						}
						throw new Error(`File was not created successfully at ${uri.fsPath}. Error: ${error}`);
					}
				}
				return { result: {} };
			},

			delete_file_or_folder: async ({ uri, isRecursive }) => {
				// Validate file/folder exists before attempting deletion
				try {
					const exists = await fileService.exists(uri);
					if (!exists) {
						throw new Error(`Cannot delete: File or folder at ${uri.fsPath} does not exist.`);
					}

					// Additional safety check: verify it's actually a file or directory
					const stat = await fileService.stat(uri);
					if (stat.isDirectory && !isRecursive) {
						// Check if directory is empty by resolving it
						try {
							const resolved = await fileService.resolve(uri);
							if (resolved.children && resolved.children.length > 0) {
								throw new Error(`Cannot delete directory ${uri.fsPath}: Directory is not empty. Use is_recursive=true to delete non-empty directories.`);
							}
						} catch (readError) {
							// If we can't read directory, it might be a permission issue
							if (readError instanceof Error && !readError.message.includes('not empty')) {
								throw new Error(`Cannot delete directory ${uri.fsPath}: ${readError.message}`);
							}
							throw readError;
						}
					}

					await fileService.del(uri, { recursive: isRecursive });

					// Verify deletion was successful
					const stillExists = await fileService.exists(uri);
					if (stillExists) {
						throw new Error(`Deletion may have failed: File or folder at ${uri.fsPath} still exists after deletion attempt.`);
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					throw new Error(`Failed to delete file or folder at ${uri.fsPath}: ${errorMsg}`);
				}
				return { result: {} };
			},

			rewrite_file: async ({ uri, newContent }) => {
				await cortexideModelService.initializeModel(uri);
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`);
				}
				await editCodeService.callBeforeApplyOrEdit(uri);
				editCodeService.instantlyRewriteFile({ uri, newContent });
				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000);
					const { lintErrors } = this._getLintErrors(uri);
					return { lintErrors };
				});
				return { result: lintErrorsPromise };
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				await cortexideModelService.initializeModel(uri);
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`);
				}
				await editCodeService.callBeforeApplyOrEdit(uri);
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks });

				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000);
					const { lintErrors } = this._getLintErrors(uri);
					return { lintErrors };
				});

				return { result: lintErrorsPromise };
			},
			// ---
			run_command: async ({ command, cwd, terminalId }) => {
				// Check for dangerous commands and warn
				const dangerLevel = this._detectCommandDanger(command);
				if (dangerLevel === 'high') {
					this.notificationService.warn(`⚠️ High-risk command detected: ${command}\nThis command may cause data loss or system changes. Please review carefully.`);
				} else if (dangerLevel === 'medium') {
					this.notificationService.info(`⚠️ Potentially risky command: ${command}\nReview before execution.`);
				}
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId });
				return { result: resPromise, interruptTool: interrupt };
			},
			run_nl_command: async ({ nlInput, cwd, terminalId }) => {
				// Parse natural language to shell command
				let parsed;
				try {
					parsed = await this.nlShellParserService.parseNLToShell(nlInput, cwd, CancellationToken.None);
				} catch (parseError) {
					const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
					throw new Error(`Failed to parse natural language command: ${errorMsg}. Please provide a clearer command description.`);
				}

				// Validate parsed command is not empty
				if (!parsed.command || parsed.command.trim().length === 0) {
					throw new Error(`Failed to parse natural language command: The parser did not generate a valid command from "${nlInput}". Please provide a clearer command description.`);
				}

				// Check for dangerous commands using existing detection
				const dangerLevel = this._detectCommandDanger(parsed.command);

				// Only show warnings for high/medium risk commands, not preview notifications
				if (dangerLevel === 'high') {
					this.notificationService.warn(`⚠️ High-risk command detected: ${parsed.command}\nThis command may cause data loss or system changes. Please review carefully.`);
				} else if (dangerLevel === 'medium') {
					this.notificationService.info(`⚠️ Potentially risky command: ${parsed.command}\nReview before execution.`);
				}

				// Execute the parsed command
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(parsed.command, { type: 'temporary', cwd, terminalId });

				// Wrap result to include parsed command info and mask secrets
				const maskedResPromise = resPromise.then(async (res) => {
					// Mask secrets in the result
					const secretResult = this.secretDetectionService.detectSecrets(res.result);
					const maskedResult = secretResult.hasSecrets ? secretResult.redactedText : res.result;

					return {
						result: maskedResult,
						resolveReason: res.resolveReason,
						parsedCommand: parsed.command,
						explanation: parsed.explanation,
					};
				});

				return { result: maskedResPromise, interruptTool: interrupt };
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				// Check for dangerous commands and warn
				const dangerLevel = this._detectCommandDanger(command);
				if (dangerLevel === 'high') {
					this.notificationService.warn(`⚠️ High-risk command detected: ${command}\nThis command may cause data loss or system changes. Please review carefully.`);
				} else if (dangerLevel === 'medium') {
					this.notificationService.info(`⚠️ Potentially risky command: ${command}\nReview before execution.`);
				}
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId });
				return { result: resPromise, interruptTool: interrupt };
			},
			open_persistent_terminal: async ({ cwd }) => {
				const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd });
				return { result: { persistentTerminalId } };
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				// Close the background terminal by sending exit
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId);
				return { result: {} };
			},

			// ---

			web_search: async ({ query, k, refresh }) => {
				// Check offline/privacy mode (centralized gate)
				this._offlineGate.ensureNotOfflineOrPrivacy('Web search', false);

				// Include refresh in cache key to ensure uniqueness
				const cacheKey = `search:${query}:${k}:${refresh ? 'refresh' : 'cached'}`;
				const cached = this._webSearchCache.get(cacheKey);
				if (!refresh && cached && Date.now() - cached.timestamp < this._cacheTTL) {
					return { result: { results: cached.results } };
				}

				const maxResults = k ?? 5;
				let lastError: Error | null = null;
				const errors: string[] = [];

				// Try multiple search methods with retries
				// Methods that use webContentExtractorService run in main process and bypass CORS
				const searchMethods: Array<{ name: string; method: () => Promise<Array<{ title: string; snippet: string; url: string }>> }> = [
					// Method 1: DuckDuckGo Instant Answer API (fast, direct API - may hit CORS but worth trying first)
					{
						name: 'DuckDuckGo Instant Answer API',
						method: async () => {
							const instantUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
							try {
								const response = await this.requestService.request({
									type: 'GET',
									url: instantUrl,
									timeout: 10000,
								}, CancellationToken.None);

								const json = await asJson<{ AbstractText?: string; Heading?: string; AbstractURL?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> }>(response);
								const results: Array<{ title: string; snippet: string; url: string }> = [];

								if (json?.AbstractText) {
									results.push({
										title: json.Heading || query,
										snippet: json.AbstractText,
										url: json.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
									});
								}

								if (json?.RelatedTopics && Array.isArray(json.RelatedTopics)) {
									for (const topic of json.RelatedTopics.slice(0, maxResults - results.length)) {
										if (topic?.Text && topic?.FirstURL) {
											results.push({
												title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
												snippet: topic.Text,
												url: topic.FirstURL,
											});
										}
									}
								}

								if (results.length === 0) {
									throw new Error('No results from DuckDuckGo Instant Answer API');
								}

								return results;
							} catch (error) {
								const errorMsg = error instanceof Error ? error.message : String(error);
								// Check if it's a CORS or network error
								if (errorMsg.includes('CORS') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
									throw new Error(`Network/CORS error: ${errorMsg}. The DuckDuckGo API may be blocked.`);
								}
								throw error;
							}
						}
					},
					// Method 2: DuckDuckGo HTML search via webContentExtractorService (reliable, bypasses CORS)
					{
						name: 'DuckDuckGo HTML via webContentExtractorService',
						method: async () => {
							const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
							try {
								const uri = URI.parse(searchUrl);
								const extracted = await this.webContentExtractorService.extract([uri]);

								if (!extracted || extracted.length === 0 || extracted[0]?.status !== 'ok' || !extracted[0].result) {
									throw new Error('Failed to extract DuckDuckGo search results');
								}

								const content = extracted[0].result;
								const results: Array<{ title: string; snippet: string; url: string }> = [];

								// Helper function to extract real URL from DuckDuckGo redirect
								const extractRealUrl = (url: string): string | null => {
									if (!url || !url.startsWith('http')) { return null; }

									// Check if it's a DuckDuckGo redirect URL
									if (url.includes('duckduckgo.com/l/')) {
										try {
											const urlObj = new URL(url);
											const uddgParam = urlObj.searchParams.get('uddg');
											if (uddgParam) {
												return decodeURIComponent(uddgParam);
											}
										} catch (e) {
											// If URL parsing fails, try regex extraction
											const uddgMatch = url.match(/uddg=([^&]+)/);
											if (uddgMatch) {
												try {
													return decodeURIComponent(uddgMatch[1]);
												} catch (e2) {
													// Ignore decode errors
												}
											}
										}
									}

									// Not a redirect, return as-is
									return url;
								};

								// Strategy 1: Parse markdown links [text](url) - most reliable
								const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
								const markdownLinks: Array<{ url: string; title: string; index: number }> = [];
								let match;
								markdownLinkRegex.lastIndex = 0;

								while ((match = markdownLinkRegex.exec(content)) !== null && markdownLinks.length < maxResults * 2) {
									const rawUrl = match[2].trim();
									const title = match[1].trim();

									// Skip empty titles or URLs
									if (!title || !rawUrl) { continue; }

									// Extract real URL (handles DuckDuckGo redirects)
									const realUrl = extractRealUrl(rawUrl);
									if (!realUrl) { continue; }

									// Filter out DuckDuckGo internal links and invalid URLs
									if (realUrl.startsWith('http://') || realUrl.startsWith('https://')) {
										if (!realUrl.includes('duckduckgo.com') &&
											!realUrl.includes('duck.com') &&
											!realUrl.startsWith('#') &&
											realUrl.length < 500) {
											markdownLinks.push({ url: realUrl, title, index: match.index });
											if (markdownLinks.length >= maxResults) {
												break;
											}
										}
									}
								}

								// Sort by position in content
								markdownLinks.sort((a, b) => a.index - b.index);

								for (let i = 0; i < Math.min(markdownLinks.length, maxResults); i++) {
									const link = markdownLinks[i];

									// Try to extract snippet from content around the link
									let snippet = '';
									const linkPattern = `[${link.title}](${link.url})`;
									const linkIndex = content.indexOf(linkPattern, link.index);
									if (linkIndex >= 0) {
										const start = Math.max(0, linkIndex - 100);
										const end = Math.min(content.length, linkIndex + linkPattern.length + 200);
										const context = content.substring(start, end)
											.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
											.replace(/<[^>]*>/g, ' ')
											.replace(/\s+/g, ' ')
											.trim();
										snippet = context.substring(0, 200);
									}

									results.push({
										title: link.title,
										snippet: snippet || 'No snippet available',
										url: link.url,
									});
								}

								// Strategy 2: Fallback - extract URLs directly if we don't have enough results
								if (results.length < maxResults) {
									const existingUrls = new Set(results.map(r => r.url));
									const urlRegex = /https?:\/\/[^\s<>"'\n\r\)]+/gi;
									const urlMatches: Array<{ url: string; index: number }> = [];

									urlRegex.lastIndex = 0;
									const needed = maxResults - results.length;
									while ((match = urlRegex.exec(content)) !== null && urlMatches.length < needed * 2) {
										const rawUrl = match[0].replace(/[.,;:!?]+$/, '');

										// Extract real URL from DuckDuckGo redirect if needed
										const realUrl = extractRealUrl(rawUrl);
										if (!realUrl) { continue; }

										if (realUrl.length > 10 && realUrl.length < 500 &&
											!realUrl.includes('duckduckgo.com') &&
											!realUrl.includes('duck.com') &&
											!existingUrls.has(realUrl)) {
											urlMatches.push({ url: realUrl, index: match.index });
											if (urlMatches.length >= needed) {
												break;
											}
										}
									}

									urlMatches.sort((a, b) => a.index - b.index);

									for (let i = 0; i < Math.min(urlMatches.length, needed); i++) {
										const { url, index } = urlMatches[i];

										// Extract context around URL for title/snippet
										const start = Math.max(0, index - 100);
										const end = Math.min(content.length, index + url.length + 200);
										const context = content.substring(start, end)
											.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
											.replace(/<[^>]*>/g, ' ')
											.replace(/\s+/g, ' ')
											.trim();

										// Extract title from before URL
										const beforeUrl = content.substring(start, index).trim();
										const words = beforeUrl.split(/\s+/).filter(w => w.length > 2);
										const title = words.length > 0
											? words.slice(-5).join(' ').substring(0, 100)
											: url;

										// Extract snippet from after URL
										const afterUrl = content.substring(index + url.length, end).trim();
										const snippet = afterUrl.substring(0, 200) || context.substring(0, 200) || 'No snippet available';

										results.push({
											title: title || url,
											snippet: snippet,
											url: url,
										});
									}
								}

								if (results.length === 0) {
									// Provide diagnostic info
									const contentPreview = content.substring(0, 1000).replace(/\s+/g, ' ');
									const hasUrls = /https?:\/\//i.test(content);
									const hasMarkdownLinks = /\[.*?\]\(.*?\)/.test(content);

									throw new Error(
										`No results found in DuckDuckGo search. ` +
										`Content length: ${content.length}, ` +
										`Has URLs: ${hasUrls}, ` +
										`Has markdown links: ${hasMarkdownLinks}, ` +
										`Preview: ${contentPreview.substring(0, 300)}...`
									);
								}

								return results;
							} catch (error) {
								throw error;
							}
						}
					},
				];

				// Try each method (with single retry only for transient errors)
				for (const { name, method } of searchMethods) {
					for (let attempt = 0; attempt < 2; attempt++) {
						try {
							const results = await method();
							const resultData = { results };
							this._webSearchCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
							return { result: resultData };
						} catch (error) {
							const errorMsg = error instanceof Error ? error.message : String(error);
							errors.push(`${name}: ${errorMsg}`);
							lastError = error instanceof Error ? error : new Error(String(error));

							// Only retry on transient errors (network/timeout), not parsing errors
							const isTransientError = errorMsg.includes('timeout') ||
								errorMsg.includes('network') ||
								errorMsg.includes('CORS') ||
								errorMsg.includes('Failed to fetch');

							if (attempt < 1 && isTransientError) {
								// Shorter wait before retry (500ms instead of 1000ms)
								await new Promise(resolve => setTimeout(resolve, 500));
							} else {
								// Don't retry parsing errors or if we've already retried
								break;
							}
						}
					}
				}

				// All methods failed
				const errorMessage = lastError?.message || 'Unknown error';
				const allErrors = errors.length > 0 ? errors.join('; ') : errorMessage;
				throw new Error(`Web search failed: ${allErrors}. This could be due to network issues or all search services being temporarily unavailable. Please check your internet connection and try again.`);
			},

			browse_url: async ({ url, refresh }) => {
				// Check offline/privacy mode (centralized gate)
				this._offlineGate.ensureNotOfflineOrPrivacy('URL browsing', false);

				const cacheKey = `browse:${url}`;
				const cached = this._browseCache.get(cacheKey);
				if (!refresh && cached && Date.now() - cached.timestamp < this._cacheTTL) {
					return { result: { content: cached.content, title: cached.title, url: cached.url, metadata: cached.metadata } };
				}

				try {
					const uri = URI.parse(url);
					const useHeadless = this.cortexideSettingsService.state.globalSettings.useHeadlessBrowsing !== false; // Default to true

					// Try using web content extractor first if headless browsing is enabled (better for complex pages)
					if (useHeadless) {
						try {
							const extracted = await this.webContentExtractorService.extract([uri]);
							const first = extracted?.[0];
							if (first?.status === 'ok') {
								const content = first.result;
								// Try to extract title from URL or content
								const titleMatch = content.match(/^[^\n]{0,200}/);
								const title = titleMatch ? titleMatch[0].trim().substring(0, 100) : undefined;

								const resultData = { content, title, url, metadata: {} };
								this._browseCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
								return { result: resultData };
							} else if (first?.status === 'redirect' && !refresh) {
								return this.callTool.browse_url({
									url: first.toURI.toString(),
									refresh
								});
							}
							// fallthrough for error status
						} catch (extractorError) {
							// Fallback to direct fetch if extractor fails
						}
					}

					// Fallback: fetch and extract text manually (always available as backup)
					let response;
					try {
						response = await this.requestService.request({
							type: 'GET',
							url,
							timeout: 15000,
						}, CancellationToken.None);
					} catch (requestError) {
						const errorMsg = requestError instanceof Error ? requestError.message : String(requestError);
						if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
							throw new Error(`Request timeout: Failed to fetch ${url} within 15 seconds. The server may be slow or unresponsive.`);
						}
						if (errorMsg.includes('CORS') || errorMsg.includes('network')) {
							throw new Error(`Network error: Failed to fetch ${url}. This may be due to CORS restrictions or network connectivity issues.`);
						}
						throw new Error(`Failed to fetch ${url}: ${errorMsg}`);
					}

					const html = await asTextOrError(response);
					if (!html) {
						throw new Error(`Failed to fetch page content from ${url}. The server returned an empty response.`);
					}

					// Simple HTML to text extraction
					let text = html
						.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
						.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
						.replace(/<[^>]+>/g, ' ')
						.replace(/\s+/g, ' ')
						.trim();

					// Extract title
					const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
					const title = titleMatch ? titleMatch[1].trim() : undefined;

					// Limit content size
					if (text.length > 50000) {
						text = text.substring(0, 50000) + '... (content truncated)';
					}

					const resultData = { content: text, title, url, metadata: {} };
					this._browseCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
					return { result: resultData };
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					throw new Error(`Failed to browse URL ${url}: ${errorMessage}. Please check the URL and your internet connection.`);
				}
			},
		};


		const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(more on next page...)' : '';

		const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
			return lintErrors
				.map((e, i) => `Error ${i + 1}:\nLines Affected: ${e.startLineNumber}-${e.endLineNumber}\nError message:${e.message}`)
				.join('\n\n')
				.substring(0, MAX_FILE_CHARS_PAGE);
		};

		// given to the LLM after the call for successful tool calls
		this.stringOfResult = {
			read_file: (params, result) => {
				return `${params.uri.fsPath}\n\`\`\`\n${result.fileContents}\n\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `\nMore info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ''}`;
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result);
				return dirTreeStr; // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str;
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage);
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage);
			},
			search_in_file: (params, result) => {
				const { model } = cortexideModelService.getModel(params.uri);
				if (!model) { return '<Error getting string of result>'; }
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF);
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``;
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.';
			},
			// ---
			create_file_or_folder: (params, result) => {
				const filePath = params.uri.fsPath;
				return `File successfully created at: ${filePath}\n\nTo open this file, use the exact path: ${filePath}`;
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`;
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.cortexideSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '');

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`;
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.cortexideSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '');

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`;
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result;
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`;
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by CortexIDE after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`;
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`);
			},
			run_nl_command: (params, result) => {
				const { resolveReason, result: result_, parsedCommand, explanation } = result;
				const commandInfo = `Parsed command: \`${parsedCommand}\`\n${explanation}\n\n`;
				// success
				if (resolveReason.type === 'done') {
					return `${commandInfo}${result_}\n(exit code ${resolveReason.exitCode})`;
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${commandInfo}${result_}\nTerminal command ran, but was automatically killed by CortexIDE after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`;
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`);
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result;
				const { persistentTerminalId } = params;
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`;
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`;
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`);
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},

			// ---

			web_search: (params, result) => {
				if (result.results.length === 0) {
					return `No search results found for "${params.query}".`;
				}
				return result.results.map((r, i) =>
					`${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
				).join('\n\n');
			},

			browse_url: (params, result) => {
				const titleStr = result.title ? `Title: ${result.title}\n\n` : '';
				const metadataStr = result.metadata?.publishedDate ? `Published: ${result.metadata.publishedDate}\n\n` : '';
				return `${titleStr}${metadataStr}Content from ${result.url}:\n\n${result.content.substring(0, 10000)}${result.content.length > 10000 ? '\n\n... (content truncated)' : ''}`;
			},
		};



	}


	/**
	 * Detects dangerous terminal commands that may cause data loss or system changes.
	 * Returns 'high' for extremely dangerous commands, 'medium' for potentially risky, or 'low' for safe.
	 */
	private _detectCommandDanger(command: string): 'high' | 'medium' | 'low' {
		const normalizedCmd = command.trim().toLowerCase();

		// High-risk commands: data loss, system modification, privilege escalation
		const highRiskPatterns = [
			/rm\s+-rf/,           // Recursive force delete
			/rm\s+-r\s+/,
			/dd\s+if=/,           // Disk operations
			/sudo\s+(rm|del|format|mkfs|fdisk)/, // Sudo with destructive ops
			/chmod\s+.*777/,       // Dangerous permissions
			/chown\s+-R/,         // Recursive ownership changes
			/format\s+/,
			/fdisk\s+/,
			/parted\s+/,
			/curl\s+.*\|?\s*sh\s*$/, // Piping to shell
			/wget\s+.*\|?\s*sh\s*$/,
			/echo\s+.*\|?\s*sh\s*$/,
			/\$\(curl\s+/,
			/\$\(wget\s+/,
			/uninstall/,
			/purge\s+/,
			/npm\s+uninstall\s+-g/,
			/pip\s+uninstall/,
			/git\s+reset\s+--hard/,
			/git\s+clean\s+-fd/,
			/git\s+push\s+--force/,
			/git\s+push\s+-f/,
		];

		// Medium-risk commands: potentially risky but context-dependent
		const mediumRiskPatterns = [
			/sudo\s+/,            // Privilege escalation
			/chmod\s+/,           // Permission changes
			/chown\s+/,           // Ownership changes
			/rm\s+/,              // Delete (but not recursive)
			/del\s+/,             // Windows delete
			/rmdir\s+/,           // Directory removal
			/unlink\s+/,          // File unlinking
			/mv\s+.*\s+\.\.\//,   // Moving files outside workspace
			/cp\s+.*\s+\.\.\//,   // Copying files outside workspace
			/git\s+push/,         // Git push (could push to wrong remote)
			/git\s+reset/,        // Git reset
			/npm\s+install\s+-g/, // Global npm installs
			/pip\s+install\s+--user/, // User-level pip installs
			/docker\s+rm/,        // Docker container removal
			/docker\s+rmi/,       // Docker image removal
			/kubectl\s+delete/,   // Kubernetes deletion
			/systemctl\s+/,
			/service\s+/,
			/apt\s+remove/,
			/yum\s+remove/,
			/pacman\s+-R/,
		];

		for (const pattern of highRiskPatterns) {
			if (pattern.test(normalizedCmd)) {
				return 'high';
			}
		}

		for (const pattern of mediumRiskPatterns) {
			if (pattern.test(normalizedCmd)) {
				return 'medium';
			}
		}

		return 'low';
	}

	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem));

		if (!lintErrors.length) { return { lintErrors: null }; }
		return { lintErrors, };
	}


}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
