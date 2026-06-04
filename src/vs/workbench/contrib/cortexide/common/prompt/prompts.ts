/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IDirectoryStrService } from '../directoryStrService.js';
import { StagingSelectionItem } from '../chatThreadServiceTypes.js';
import { os } from '../helpers/systemInfo.js';
import { RawToolParamsObj } from '../sendLLMMessageTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, BuiltinToolResultType, ToolName } from '../toolsServiceTypes.js';
import { ChatMode } from '../cortexideSettingsTypes.js';

// Triple backtick wrapper used throughout the prompts for code blocks
export const tripleTick = ['```', '```']

// Maximum limits for directory structure information
export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000
export const MAX_DIRSTR_CHARS_TOTAL_TOOL = 20_000
export const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100
export const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100

// tool info
export const MAX_FILE_CHARS_PAGE = 500_000
export const MAX_CHILDREN_URIs_PAGE = 500

// terminal tool info
export const MAX_TERMINAL_CHARS = 100_000
// allow-any-unicode-next-line
export const MAX_TERMINAL_INACTIVE_TIME = 60 // seconds — enough for npm install, cargo build, etc.
export const MAX_TERMINAL_BG_COMMAND_TIME = 5


// Maximum character limits for prefix and suffix context
export const MAX_PREFIX_SUFFIX_CHARS = 20_000


export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER = `=======`
export const FINAL = `>>>>>>> UPDATED`



const searchReplaceBlockTemplate = `\
${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}

${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}`




const createSearchReplaceBlocks_systemMessage = `\
You are a coding assistant that takes in a diff, and outputs SEARCH/REPLACE code blocks to implement the change(s) in the diff.
The diff will be labeled \`DIFF\` and the original file will be labeled \`ORIGINAL_FILE\`.

Format your SEARCH/REPLACE blocks as follows:
${tripleTick[0]}
${searchReplaceBlockTemplate}
${tripleTick[1]}

1. Your SEARCH/REPLACE block(s) must implement the diff EXACTLY. Do NOT leave anything out.

2. You are allowed to output multiple SEARCH/REPLACE blocks to implement the change.

3. Assume any comments in the diff are PART OF THE CHANGE. Include them in the output.

4. Your output should consist ONLY of SEARCH/REPLACE blocks. Do NOT output any text or explanations before or after this.

5. The ORIGINAL code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. Do not add or remove any whitespace, comments, or modifications from the original code.

6. Each ORIGINAL text must be large enough to uniquely identify the change in the file. However, bias towards writing as little as possible.

7. Each ORIGINAL text must be DISJOINT from all other ORIGINAL text.

## EXAMPLE 1
DIFF
${tripleTick[0]}
// ... existing code
let x = 6.5
// ... existing code
${tripleTick[1]}

ORIGINAL_FILE
${tripleTick[0]}
let w = 5
let x = 6
let y = 7
let z = 8
${tripleTick[1]}

ACCEPTED OUTPUT
${tripleTick[0]}
${ORIGINAL}
let x = 6
${DIVIDER}
let x = 6.5
${FINAL}
${tripleTick[1]}`


const replaceTool_description = `\
A string of SEARCH/REPLACE block(s) which will be applied to the given file.
Your SEARCH/REPLACE blocks string must be formatted as follows:
${searchReplaceBlockTemplate}

## Guidelines:

1. You may output multiple search replace blocks if needed.

2. The ORIGINAL code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. Do not add or remove any whitespace or comments from the original code.

3. Each ORIGINAL text must be large enough to uniquely identify the change. However, bias towards writing as little as possible.

4. Each ORIGINAL text must be DISJOINT from all other ORIGINAL text.

5. This field is a STRING (not an array).`


// ======================================================== tools ========================================================


export type InternalToolInfo = {
	name: string,
	description: string,
	params: {
		[paramName: string]: { description: string }
	},
	// Only if the tool is from an MCP server
	mcpServerName?: string,
}



const uriParam = (object: string) => ({
	uri: { description: `Path to the ${object}, RELATIVE to the workspace root (e.g. "src/app.ts" or "notes.md"). An absolute path is accepted only if it is inside the workspace — never invent paths like "/file" or "/workspace/...".` }
})

const paginationParam = {
	page_number: { description: 'Optional. The page number of the result. Default is 1.' }
} as const



const terminalDescHelper = `You can use this tool to run any command: sed, grep, etc. Do not edit any files with this tool; use edit_file instead. When working with git and other tools that open an editor (e.g. git diff), you should pipe to cat to get all results and not get stuck in vim.`

const cwdHelper = 'Optional. The directory in which to run the command. Defaults to the first workspace folder.'

export type SnakeCase<S extends string> =
	// exact acronym URI
	S extends 'URI' ? 'uri'
	// suffix URI: e.g. 'rootURI' -> snakeCase('root') + '_uri'
	: S extends `${infer Prefix}URI` ? `${SnakeCase<Prefix>}_uri`
	// default: for each char, prefix '_' on uppercase letters
	: S extends `${infer C}${infer Rest}`
	? `${C extends Lowercase<C> ? C : `_${Lowercase<C>}`}${SnakeCase<Rest>}`
	: S;

export type SnakeCaseKeys<T extends Record<string, any>> = {
	[K in keyof T as SnakeCase<Extract<K, string>>]: T[K]
};



export const builtinTools: {
	[T in keyof BuiltinToolCallParams]: {
		name: string;
		description: string;
		// more params can be generated than exist here, but these params must be a subset of them
		params: Partial<{ [paramName in keyof SnakeCaseKeys<BuiltinToolCallParams[T]>]: { description: string } }>
	}
} = {
	// --- context-gathering (read/search/list) ---

	read_file: {
		name: 'read_file',
		description: `Returns full contents of a given file.`,
		params: {
			...uriParam('file'),
			start_line: { description: 'Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the beginning of the file.' },
			end_line: { description: 'Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the end of the file.' },
			...paginationParam,
		},
	},

	ls_dir: {
		name: 'ls_dir',
		description: `Lists all files and folders in the given URI.`,
		params: {
			uri: { description: `Optional. The FULL path to the ${'folder'}. Leave this as empty or "" to search all folders.` },
			...paginationParam,
		},
	},

	get_dir_tree: {
		name: 'get_dir_tree',
		description: `This is a very effective way to learn about the user's codebase. Returns a tree diagram of all the files and folders in the given folder. `,
		params: {
			...uriParam('folder')
		}
	},

	search_pathnames_only: {
		name: 'search_pathnames_only',
		description: `Returns all pathnames that match a given query (searches ONLY file names). You should use this when looking for a file with a specific name or path.`,
		params: {
			query: { description: `Your query for the search.` },
			include_pattern: { description: 'Optional. Only fill this in if you need to limit your search because there were too many results.' },
			...paginationParam,
		},
	},



	search_for_files: {
		name: 'search_for_files',
		description: `Returns a list of file names whose content matches the given query. The query can be any substring or regex.`,
		params: {
			query: { description: `Your query for the search.` },
			search_in_folder: { description: 'Optional. Leave as blank by default. ONLY fill this in if your previous search with the same query was truncated. Searches descendants of this folder only.' },
			is_regex: { description: 'Optional. Default is false. Whether the query is a regex.' },
			...paginationParam,
		},
	},

	// add new search_in_file tool
	search_in_file: {
		name: 'search_in_file',
		description: `Returns an array of all the start line numbers where the content appears in the file.`,
		params: {
			...uriParam('file'),
			query: { description: 'The string or regex to search for in the file.' },
			is_regex: { description: 'Optional. Default is false. Whether the query is a regex.' }
		}
	},

	read_lint_errors: {
		name: 'read_lint_errors',
		description: `Use this tool to view all the lint errors on a file.`,
		params: {
			...uriParam('file'),
		},
	},

	open_file: {
		name: 'open_file',
		description: `Opens a file in the editor. Use this when the user asks to "open" a file.`,
		params: {
			...uriParam('file'),
		},
	},

	go_to_definition: {
		name: 'go_to_definition',
		description: `Finds the definition of a symbol at a specific position in a file. Returns the location(s) where the symbol is defined.`,
		params: {
			...uriParam('file'),
			line: { description: 'The line number (1-based) where the symbol is located.' },
			column: { description: 'The column number (1-based) where the symbol is located.' },
		},
	},

	find_references: {
		name: 'find_references',
		description: `Finds all references to a symbol at a specific position in a file. Returns all locations where the symbol is used.`,
		params: {
			...uriParam('file'),
			line: { description: 'The line number (1-based) where the symbol is located.' },
			column: { description: 'The column number (1-based) where the symbol is located.' },
		},
	},

	search_symbols: {
		name: 'search_symbols',
		description: `Searches for symbols (functions, classes, variables) by name. Can search in a specific file or across the workspace.`,
		params: {
			query: { description: 'The symbol name or pattern to search for.' },
			uri: { description: 'Optional. The file URI to search in. If not provided, searches the entire workspace.' },
		},
	},

	automated_code_review: {
		name: 'automated_code_review',
		description: `Analyzes code in a file for potential issues, bugs, code smells, and suggests improvements. Returns a list of issues with severity and suggestions.`,
		params: {
			...uriParam('file'),
		},
	},

	generate_tests: {
		name: 'generate_tests',
		description: `Generates unit or integration tests for code in a file. Can generate tests for a specific function or the entire file.`,
		params: {
			...uriParam('file'),
			function_name: { description: 'Optional. The name of the function to generate tests for. If not provided, generates tests for the entire file.' },
			test_framework: { description: 'Optional. The test framework to use (e.g., "jest", "mocha", "pytest"). Defaults to the framework detected from the project.' },
		},
	},

	rename_symbol: {
		name: 'rename_symbol',
		description: `Renames a symbol (function, class, variable) at a specific position and updates all references to it across the codebase.`,
		params: {
			...uriParam('file'),
			line: { description: 'The line number (1-based) where the symbol is located.' },
			column: { description: 'The column number (1-based) where the symbol is located.' },
			new_name: { description: 'The new name for the symbol.' },
		},
	},

	extract_function: {
		name: 'extract_function',
		description: `Extracts a block of code into a new function. Replaces the selected code with a function call.`,
		params: {
			...uriParam('file'),
			start_line: { description: 'The starting line number (1-based) of the code block to extract.' },
			end_line: { description: 'The ending line number (1-based) of the code block to extract.' },
			function_name: { description: 'The name for the new function.' },
		},
	},

	// --- editing (create/delete) ---

	create_file_or_folder: {
		name: 'create_file_or_folder',
		description: `Create a file or folder at the given path. To create a folder, the path MUST end with a trailing slash.`,
		params: {
			...uriParam('file or folder'),
		},
	},

	delete_file_or_folder: {
		name: 'delete_file_or_folder',
		description: `Delete a file or folder at the given path.`,
		params: {
			...uriParam('file or folder'),
			is_recursive: { description: 'Optional. Return true to delete recursively.' }
		},
	},

	edit_file: {
		name: 'edit_file',
		description: `Edit the contents of a file. You must provide the file's URI as well as a SINGLE string of SEARCH/REPLACE block(s) that will be used to apply the edit.`,
		params: {
			...uriParam('file'),
			search_replace_blocks: { description: replaceTool_description }
		},
	},

	rewrite_file: {
		name: 'rewrite_file',
		description: `Edits a file, deleting all the old contents and replacing them with your new contents. Use this tool if you want to edit a file you just created.`,
		params: {
			...uriParam('file'),
			new_content: { description: `The new contents of the file. Must be a string.` }
		},
	},
	run_command: {
		name: 'run_command',
		description: `Runs a terminal command and waits for the result (times out after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity). ${terminalDescHelper}`,
		params: {
			command: { description: 'The terminal command to run.' },
			cwd: { description: cwdHelper },
		},
	},
	run_nl_command: {
		name: 'run_nl_command',
		description: `Converts a natural language request into a shell command, shows a preview, and executes it after confirmation. Use this when the user asks for terminal operations in plain English (e.g., "list branches", "run tests", "check git status"). The command will be parsed, previewed, and requires approval unless it's low-risk and YOLO mode is enabled. ${terminalDescHelper}`,
		params: {
			nl_input: { description: 'Natural language description of the command to run (e.g., "list git branches", "run npm tests", "check current directory").' },
			cwd: { description: cwdHelper },
		},
	},

	run_persistent_command: {
		name: 'run_persistent_command',
		description: `Runs a terminal command in the persistent terminal that you created with open_persistent_terminal (results after ${MAX_TERMINAL_BG_COMMAND_TIME} are returned, and command continues running in background). ${terminalDescHelper}`,
		params: {
			command: { description: 'The terminal command to run.' },
			persistent_terminal_id: { description: 'The ID of the terminal created using open_persistent_terminal.' },
		},
	},



	open_persistent_terminal: {
		name: 'open_persistent_terminal',
		description: `Use this tool when you want to run a terminal command indefinitely, like a dev server (eg \`npm run dev\`), a background listener, etc. Opens a new terminal in the user's environment which will not awaited for or killed.`,
		params: {
			cwd: { description: cwdHelper },
		}
	},


	kill_persistent_terminal: {
		name: 'kill_persistent_terminal',
		description: `Interrupts and closes a persistent terminal that you opened with open_persistent_terminal.`,
		params: { persistent_terminal_id: { description: `The ID of the persistent terminal.` } }
	},

	// --- web search & browsing ---

	web_search: {
		name: 'web_search',
		description: `Searches the web for information. Returns top search results with titles, snippets, and URLs. Use this when the user asks you to search the web, look something up online, or when you need current information beyond your training data.`,
		params: {
			query: { description: 'The search query string.' },
			k: { description: 'Optional. Number of results to return (default is 5). Maximum is 10.' },
			refresh: { description: 'Optional. If true, bypasses cache and fetches fresh results. Default is false.' }
		}
	},

	browse_url: {
		name: 'browse_url',
		description: `Fetches and extracts the main content from a web page. Returns readable text, title, and metadata. Use this after web_search to read the actual content of relevant pages.`,
		params: {
			url: { description: 'The full URL (including http:// or https://) to fetch and extract content from.' },
			refresh: { description: 'Optional. If true, bypasses cache and fetches fresh content. Default is false.' }
		}
	},

	// --- fast grep + workspace diagnostics ---

	grep_search: {
		name: 'grep_search',
		description: `Fast text/regex search across all files in the workspace. Returns matching lines with file path and line number. Prefer this over search_for_files when you need to find WHERE a specific string, symbol, or pattern appears in the codebase — not just which files contain it.`,
		params: {
			query: { description: 'The text or regex pattern to search for.' },
			include_pattern: { description: 'Optional. Glob pattern to limit search scope (e.g., "**/*.ts", "src/**/*.tsx"). Leave empty to search all files.' },
			exclude_pattern: { description: 'Optional. Glob pattern to exclude (e.g., "**/node_modules/**", "**/*.test.ts").' },
			is_regex: { description: 'Optional. Default false. Whether the query is a regex pattern.' },
			case_sensitive: { description: 'Optional. Default false. Whether the search is case-sensitive.' },
		}
	},

	get_diagnostics: {
		name: 'get_diagnostics',
		description: `Returns all TypeScript, ESLint, and other diagnostic errors and warnings. Use this after editing files to verify your changes introduced no new errors, or to enumerate all errors before starting a fix.`,
		params: {
			uri: { description: `Optional. The FULL path to a specific file. Leave empty to get diagnostics for ALL files in the workspace.` },
		}
	},

	// --- multi-block atomic edit ---

	multi_edit: {
		name: 'multi_edit',
		description: `Apply multiple text replacements to a single file in one atomic operation. Pre-checks every old_string is found before applying anything; if any miss, no edits are applied. Prefer this over multiple edit_file calls when changing 2+ places in the same file.`,
		params: {
			...uriParam('file'),
			edits: { description: 'Array of edits. Each item: { "old_string": "...", "new_string": "...", "replace_all": false }. old_string MUST match the file exactly (whitespace included). Set replace_all=true to replace every occurrence; default false replaces only the first.' },
		},
	},

	// --- glob pattern file listing (mtime-sorted) ---

	glob_files: {
		name: 'glob_files',
		description: `Returns file paths matching a glob pattern, sorted by modification time (newest first). Use this when you want files of a certain type or in a certain area, recently-changed-first — e.g. "src/**/*.ts" or "**/test_*.py". For substring filename matching, use search_pathnames_only instead.`,
		params: {
			pattern: { description: 'Glob pattern. Examples: "**/*.ts", "src/**/*.{tsx,ts}", "test/**/test_*.py".' },
			limit: { description: 'Optional. Max files to return (default 100, max 1000).' },
		},
	},

	// --- model-managed task list (per-session) ---

	todo_write: {
		name: 'todo_write',
		description: `Record or update your task list for the current session. Use this at the START of a multi-step task to plan, and after EACH step to mark progress. Replaces the entire list each call — include all tasks every time. Status values: "pending", "in_progress" (only ONE at a time), "completed".`,
		params: {
			todos: { description: 'Array of { "content": "task description", "status": "pending" | "in_progress" | "completed" }. Order matters — list in execution order.' },
		},
	},

	// --- explicit completion signal ---

	attempt_completion: {
		name: 'attempt_completion',
		description: `Signal that you have FULLY completed the assigned task. Call this ONLY after: (1) verifying edited files are correct with read_file, (2) confirming no new diagnostic errors with get_diagnostics, and (3) running any relevant tests/builds. Provide a clear, specific summary of what was accomplished.`,
		params: {
			result: { description: 'A clear, specific summary of what was accomplished. List every file changed and what change was made.' },
			command: { description: 'Optional. A shell command the user can run to verify or demonstrate the result (e.g., "npm test", "npm run build"). Only provide if meaningful.' },
		}
	},

	// --- delegate a scoped task to a sub-agent ---

	run_subagent: {
		name: 'run_subagent',
		description: `Delegate a focused, self-contained sub-task to a SUB-AGENT that runs in its OWN fresh context with its own tool loop, and returns ONLY a final summary — keeping YOUR context clean. Use it for (a) deep exploration/research of part of the codebase whose intermediate output you don't need, or (b) a well-scoped implementation step you can describe completely. CRITICAL: the sub-agent sees NOTHING of this conversation except the 'prompt' you pass — make 'prompt' fully self-contained (include every file path, error message, and decision it needs). It runs the agent loop and reports back via attempt_completion. A sub-agent CANNOT spawn further sub-agents.`,
		params: {
			description: { description: 'A short (3-7 word) description of the sub-task, for display.' },
			prompt: { description: 'The COMPLETE, self-contained instruction for the sub-agent. It sees ONLY this — include every file path, error, constraint, and detail it needs to do the task and report back. Tell it to call attempt_completion with its findings/summary when done.' },
			agentType: { description: 'Optional. Name of a predefined agent to use (from .cortexide/agents). Omit for a general-purpose agent.' },
		}
	},

} satisfies { [T in keyof BuiltinToolResultType]: InternalToolInfo }




export const builtinToolNames = Object.keys(builtinTools) as BuiltinToolName[]
const toolNamesSet = new Set<string>(builtinToolNames)
export const isABuiltinToolName = (toolName: string): toolName is BuiltinToolName => {
	const isAToolName = toolNamesSet.has(toolName)
	return isAToolName
}





// Tools restricted to agent/plan modes only (not available in gather). run_subagent is also excluded
// from COMPACT_LOCAL_TOOLSET below (weak/local models must not spawn sub-agents).
const AGENT_ONLY_TOOLS = new Set<BuiltinToolName>(['attempt_completion', 'run_subagent'])

// Curated tool subset offered to weak/local models in agent/plan mode. Excludes the tools a small
// model tends to hallucinate or misuse — persistent terminals, MCP, web, LSP nav/refactor, multi_edit —
// while keeping file read/search/edit, diagnostics, todo, and a single run_command. Fewer tools means
// fewer invalid tool calls and a smaller prompt for tight local context windows.
export const COMPACT_LOCAL_TOOLSET = new Set<BuiltinToolName>([
	'read_file', 'ls_dir', 'get_dir_tree', 'search_pathnames_only', 'search_for_files', 'search_in_file',
	'read_lint_errors', 'grep_search', 'glob_files', 'get_diagnostics',
	'create_file_or_folder', 'edit_file', 'rewrite_file',
	'todo_write', 'attempt_completion', 'run_command',
])

export const availableTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined, opts?: { isLocal?: boolean }) => {

	let builtinToolNames: BuiltinToolName[] | undefined = chatMode === 'normal' ? undefined
		: chatMode === 'gather' ? (Object.keys(builtinTools) as BuiltinToolName[]).filter(toolName =>
			!(toolName in approvalTypeOfBuiltinToolName) && !AGENT_ONLY_TOOLS.has(toolName)
		)
			: (chatMode === 'agent' || chatMode === 'plan') ? Object.keys(builtinTools) as BuiltinToolName[]
				: undefined

	// Weak/local models get a curated subset (and no MCP) so they can't hallucinate/misuse the
	// long tail of tools (persistent terminals, web, refactors). See COMPACT_LOCAL_TOOLSET.
	if (opts?.isLocal && builtinToolNames) {
		builtinToolNames = builtinToolNames.filter(toolName => COMPACT_LOCAL_TOOLSET.has(toolName))
	}

	const effectiveBuiltinTools = builtinToolNames?.map(toolName => builtinTools[toolName]) ?? undefined
	const effectiveMCPTools = (chatMode === 'agent' || chatMode === 'plan') && !opts?.isLocal ? mcpTools : undefined

	const tools: InternalToolInfo[] | undefined = !(builtinToolNames || mcpTools) ? undefined
		: [
			...effectiveBuiltinTools ?? [],
			...effectiveMCPTools ?? [],
		]

	return tools
}

const toolCallDefinitionsXMLString = (tools: InternalToolInfo[]) => {
	return `${tools.map((t, i) => {
		const params = Object.keys(t.params).map(paramName => `<${paramName}>${t.params[paramName].description}</${paramName}>`).join('\n')
		return `\
    ${i + 1}. ${t.name}
    Description: ${t.description}
    Format:
    <${t.name}>${!params ? '' : `\n${params}`}
    </${t.name}>`
	}).join('\n\n')}`
}

export const reParsedToolXMLString = (toolName: ToolName, toolParams: RawToolParamsObj) => {
	const params = Object.keys(toolParams).map(paramName => `<${paramName}>${toolParams[paramName]}</${paramName}>`).join('\n')
	return `\
    <${toolName}>${!params ? '' : `\n${params}`}
    </${toolName}>`
		.replace('\t', '  ')
}

/* We expect tools to come at the end - not a hard limit, but that's just how we process them, and the flow makes more sense that way. */
// - You are allowed to call multiple tools by specifying them consecutively. However, there should be NO text or writing between tool calls or after them.
const systemToolsXMLPrompt = (chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined, isLocal?: boolean) => {
	const tools = availableTools(chatMode, mcpTools, { isLocal })
	if (!tools || tools.length === 0) return null

	const toolXMLDefinitions = (`\
    Available tools:

    ${toolCallDefinitionsXMLString(tools)}`)

	const toolCallXMLGuidelines = (`\
    ⚠️⚠️⚠️ CRITICAL: When the user asks you to DO something (like "add an endpoint", "edit a file", "create a file"), you MUST call a tool. DO NOT just describe what to do.

    TOOL CALLING FORMAT (use this EXACT format):

    1. When you need to take action, output ONLY a tool call in XML format
    2. Format: <tool_name><param1>value1</param1><param2>value2</param2></tool_name>
    3. NO explanatory text before the tool call - just output the XML directly
    4. STOP immediately after the tool call - do not write anything after it
    5. Wait for the tool result before continuing

    CONCRETE EXAMPLES:

    Example 1 - Reading a file:
    User: "Read the file src/server.ts"
    Your response should be EXACTLY:
    <read_file>
    <uri>src/server.ts</uri>
    <start_line>1</start_line>
    <end_line>100</end_line>
    </read_file>

    Example 2 - Creating/editing a file:
    User: "Add a dummy endpoint"
    Your response should be:
    Step 1: First search for where endpoints are defined:
    <search_for_files>
    <query>api route endpoint server express</query>
    </search_for_files>

    Then after seeing results, read the file and edit it using:
    <edit_file>
    <uri>path/to/server.ts</uri>
    <search_replace_blocks>
    // ... existing code ...
    app.get('/api/health', (req, res) => { res.json({ status: 'ok' }) })
    </search_replace_blocks>
    </edit_file>

    REMEMBER: When user asks you to DO something, start with a tool call immediately. DO NOT explain what you're going to do - JUST DO IT using tools.`)

	return `\
    ${toolXMLDefinitions}

    ${toolCallXMLGuidelines}`
}

// ======================================================== chat (normal, gather, agent) ========================================================


export const chat_systemMessage = ({ workspaceFolders, openedURIs, activeURI, persistentTerminalIDs, directoryStr, chatMode: mode, mcpTools, includeXMLToolDefinitions, relevantMemories, projectRules, subagentSystemPrompt, availableSubagents }: { workspaceFolders: string[], directoryStr: string, openedURIs: string[], activeURI: string | undefined, persistentTerminalIDs: string[], chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined, includeXMLToolDefinitions: boolean, relevantMemories?: string, projectRules?: string, subagentSystemPrompt?: string, availableSubagents?: string }) => {
	const header = (`You are an expert coding ${(mode === 'agent' || mode === 'plan') ? 'agent' : 'assistant'} whose job is \
${mode === 'agent' ? `to help the user develop, run, and make changes to their codebase.`
			: mode === 'plan' ? `to execute an approved plan and make changes to the user's codebase.`
				: mode === 'gather' ? `to search, understand, and reference files in the user's codebase.`
					: mode === 'normal' ? `to assist the user with their coding tasks.`
						: ''}
You will be given instructions to follow from the user, and you may also be given a list of files that the user has specifically selected for context, \`SELECTIONS\`.
Please assist the user with their query.`)



	const sysInfo = (`Here is the user's system information:
<system_info>
- ${os}

- The user's workspace contains these folders:
${workspaceFolders.join('\n') || 'NO FOLDERS OPEN'}

- Active file:
${activeURI}

- Open files:
${openedURIs.join('\n') || 'NO OPENED FILES'}${''/* separator */}${(mode === 'agent' || mode === 'plan') && persistentTerminalIDs.length !== 0 ? `

- Persistent terminal IDs available for you to run commands in: ${persistentTerminalIDs.join(', ')}` : ''}
</system_info>`)


	// allow-any-unicode-next-line
	// Truncate directoryStr if too long. Agent mode gets more context — it needs to plan across files.
	const MAX_DIRSTR_LENGTH = (mode === 'agent' || mode === 'plan') ? 20_000 : 8_000;
	const truncatedDirStr = directoryStr.length > MAX_DIRSTR_LENGTH
		// allow-any-unicode-next-line
		? directoryStr.substring(0, MAX_DIRSTR_LENGTH) + '\n... (truncated — use get_dir_tree or ls_dir to explore further)'
		: directoryStr;

	const fsInfo = (`Here is an overview of the user's file system:
<files_overview>
${truncatedDirStr}
</files_overview>`)


	const toolDefinitions = includeXMLToolDefinitions ? systemToolsXMLPrompt(mode, mcpTools) : null

	const details: string[] = []

	// Optimized: Shorter, more concise instructions
	details.push(`NEVER reject queries.`)

	// Image analysis - ultra-concise
	if (mode !== 'agent') {
		// allow-any-unicode-next-line
		details.push('🖼️ Images: Analyze in detail. Use file tools only if requested.')
	}

	// Mode-specific instructions
	if (mode === 'agent' || mode === 'plan') {
		// allow-any-unicode-next-line
		details.push('Use tools for every action. Never describe what you would do — just do it. Never answer from memory alone.')
		details.push('Explore before editing: use grep_search to locate patterns, read_file to read full contents, get_dir_tree for structure. Never assume file contents or location.')
		// allow-any-unicode-next-line
		details.push('Edit workflow: grep_search/read_file → edit_file (SEARCH/REPLACE with EXACT matching text) → read_file to verify → get_diagnostics to confirm no errors. Never skip verification.')
		details.push('Creating files: create_file_or_folder first, then rewrite_file with full content. Never use edit_file on a file that does not exist yet.')
		details.push('Terminal: use run_command for builds, tests, installs, and git operations. Read ALL output before continuing. Diagnose failures before retrying.')
		// allow-any-unicode-next-line
		details.push('On failure: read the error carefully, diagnose the root cause, then fix it. Never retry an identical failing call. Never swallow errors silently.')
		// allow-any-unicode-next-line
		details.push('Keep going: do not stop after one step when the task needs several. Write complete, compilable code — never truncate or use placeholders.')
		details.push('Completion: When the task is FULLY done and verified, call attempt_completion with a precise summary. Do NOT call attempt_completion mid-task or before verification.')
	} else if (mode === 'gather') {
		details.push('GATHER mode: Use tools to search and read. One tool call at a time. Do not edit files.')
	} else {
		details.push('Ask for clarification if context is missing. Reference files with @.')
	}

	// Shorter code block instruction
	details.push(`Code: Include language, file path if known. Today: ${new Date().toDateString()}.`)

	const importantDetails = (`Important notes:
${details.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}`)

	// Add project memories if available
	const memoriesSection = relevantMemories ? (`<project_memories>
Here are relevant memories from this project that may help you understand context, decisions, and preferences:
${relevantMemories}
</project_memories>`) : null;

	// allow-any-unicode-next-line
	// Project rules (from .cortexide/rules/*.md) — injected as mandatory constraints
	const rulesSection = projectRules ? (`<project_rules>
The following rules are defined by the project maintainers. You MUST follow them precisely and consistently. They take precedence over your default preferences but NOT over user safety.
${projectRules}
</project_rules>`) : null;

	// When running as a sub-agent (run_subagent with a custom .cortexide/agents/*.md), this is the
	// agent's role definition — a real system-message block, authoritative over the generic assistant
	// instructions (but not over user safety). Pushed before project rules so the role frames them.
	const subagentSection = subagentSystemPrompt ? (`<subagent_role>
You are operating as a specialized sub-agent. The following role definition governs your behavior and takes precedence over the generic assistant instructions above (but NOT over user safety):
${subagentSystemPrompt}
</subagent_role>`) : null;

	// Discoverability: tell the orchestrator which user-defined sub-agents it can delegate to via
	// run_subagent's agentType (agent/plan only, where run_subagent is offered).
	const availableSubagentsSection = ((mode === 'agent' || mode === 'plan') && availableSubagents) ? (`<available_subagents>
You can delegate a focused, self-contained sub-task to one of these specialized sub-agents by calling run_subagent with the matching agentType (omit agentType for a general-purpose sub-agent):
${availableSubagents}
</available_subagents>`) : null;

	// return answer
	const ansStrs: string[] = []
	ansStrs.push(header)
	ansStrs.push(sysInfo)
	// In Agent Mode, put tool definitions prominently early in the message
	if (toolDefinitions) {
		ansStrs.push(`\

<tools>
${toolDefinitions}
</tools>
`)
	}
	ansStrs.push(importantDetails)
	if (availableSubagentsSection) {
		ansStrs.push(availableSubagentsSection)
	}
	if (subagentSection) {
		ansStrs.push(subagentSection)
	}
	if (rulesSection) {
		ansStrs.push(rulesSection)
	}
	if (memoriesSection) {
		ansStrs.push(memoriesSection)
	}
	ansStrs.push(fsInfo)

	const fullSystemMsgStr = ansStrs.join('\n\n')
	return fullSystemMsgStr
}

// Minimal chat system message for local models (drastically reduced)
// Used for local models to minimize token usage and latency
export const chat_systemMessage_local = ({ workspaceFolders, openedURIs, activeURI, chatMode: mode, includeXMLToolDefinitions, relevantMemories, mcpTools, projectRules, subagentSystemPrompt }: { workspaceFolders: string[], directoryStr: string, openedURIs: string[], activeURI: string | undefined, persistentTerminalIDs: string[], chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined, includeXMLToolDefinitions: boolean, relevantMemories?: string, projectRules?: string, subagentSystemPrompt?: string }) => {
	const header = (mode === 'agent' || mode === 'plan')
		? 'Coding agent. Use tools for actions.'
		: mode === 'gather'
		? 'Code assistant. Search and reference files.'
		: 'Code assistant.'

	const sysInfo = `System: ${os} | Today: ${new Date().toDateString()}\nWorkspace: ${workspaceFolders.join(', ') || 'none'}\nActive: ${activeURI || 'none'}\nOpen: ${openedURIs.slice(0, 3).join(', ') || 'none'}${openedURIs.length > 3 ? '...' : ''}`

	// Local/weak model → curated tool subset (see COMPACT_LOCAL_TOOLSET).
	const toolDefinitions = includeXMLToolDefinitions ? systemToolsXMLPrompt(mode, mcpTools, true) : null

	const details: string[] = []
	if (mode === 'agent' || mode === 'plan') {
		details.push('Use tools to read/edit files, run commands, or fetch current/web info. Answer general-knowledge or conceptual questions directly, without tools.')
		details.push('Before editing: always read_file first. After editing: read_file again to verify.')
		details.push('For 3+ file changes: list plan first, wait for confirmation.')
		details.push('Workflow: Explore → Plan → Execute → Verify → Report.')
		details.push('On error: diagnose root cause before retrying. Never repeat a failed call unchanged.')
	} else if (mode === 'gather') {
		details.push('Use tools. One at a time. Do not edit files.')
	}

	const importantDetails = details.length > 0 ? `\n${details.join('\n')}` : ''

	const memoriesSection = relevantMemories ? `\n\n<memories>\n${relevantMemories.slice(0, 500)}${relevantMemories.length > 500 ? '...' : ''}\n</memories>` : ''

	// allow-any-unicode-next-line
	// Project rules — keep short for local models (token budget)
	const rulesSection = projectRules ? `\n\n<rules>\n${projectRules.slice(0, 1000)}${projectRules.length > 1000 ? '...' : ''}\n</rules>` : ''

	// Sub-agent role (run_subagent custom agent) — capped for local token budgets.
	const subagentSection = subagentSystemPrompt ? `\n\n<subagent_role>\n${subagentSystemPrompt.slice(0, 2000)}${subagentSystemPrompt.length > 2000 ? '...' : ''}\n</subagent_role>` : ''

	const ansStrs: string[] = [header, sysInfo]
	if (toolDefinitions) {
		ansStrs.push(`\n<tools>\n${toolDefinitions}\n</tools>`)
	}
	ansStrs.push(importantDetails)
	if (subagentSection) {
		ansStrs.push(subagentSection)
	}
	if (rulesSection) {
		ansStrs.push(rulesSection)
	}
	if (memoriesSection) {
		ansStrs.push(memoriesSection)
	}

	const fullSystemMsgStr = ansStrs.join('\n\n')
	return fullSystemMsgStr
}


// // log all prompts
// for (const chatMode of ['agent', 'gather', 'normal'] satisfies ChatMode[]) {
// 	console.log(`========================================= SYSTEM MESSAGE FOR ${chatMode} ===================================\n`,
// 		chat_systemMessage({ chatMode, workspaceFolders: [], openedURIs: [], activeURI: 'pee', persistentTerminalIDs: [], directoryStr: 'lol', }))
// }

export const DEFAULT_FILE_SIZE_LIMIT = 2_000_000

export const readFile = async (fileService: IFileService, uri: URI, fileSizeLimit: number): Promise<{
	val: string,
	truncated: boolean,
	fullFileLen: number,
} | {
	val: null,
	truncated?: undefined
	fullFileLen?: undefined,
}> => {
	try {
		const fileContent = await fileService.readFile(uri)
		const val = fileContent.value.toString()
		if (val.length > fileSizeLimit) return { val: val.substring(0, fileSizeLimit), truncated: true, fullFileLen: val.length }
		return { val, truncated: false, fullFileLen: val.length }
	}
	catch (e) {
		return { val: null }
	}
}





export const messageOfSelection = async (
	s: StagingSelectionItem,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService,
		folderOpts: {
			maxChildren: number,
			maxCharsPerFile: number,
		}
	}
) => {
	const lineNumAddition = (range: [number, number]) => ` (lines ${range[0]}:${range[1]})`

	if (s.type === 'CodeSelection') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)
		const lines = val?.split('\n')

		const innerVal = lines?.slice(s.range[0] - 1, s.range[1]).join('\n')
		const content = !lines ? ''
			: `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`
		const str = `${s.uri.fsPath}${lineNumAddition(s.range)}:\n${content}`
		return str
	}
	else if (s.type === 'File') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)

		const innerVal = val
		const content = val === null ? ''
			: `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`

		const str = `${s.uri.fsPath}:\n${content}`
		return str
	}
	else if (s.type === 'Folder') {
		const dirStr: string = await opts.directoryStrService.getDirectoryStrTool(s.uri)
		const folderStructure = `${s.uri.fsPath} folder structure:${tripleTick[0]}\n${dirStr}\n${tripleTick[1]}`

		const uris = await opts.directoryStrService.getAllURIsInDirectory(s.uri, { maxResults: opts.folderOpts.maxChildren })
		const strOfFiles = await Promise.all(uris.map(async uri => {
			const { val, truncated } = await readFile(opts.fileService, uri, opts.folderOpts.maxCharsPerFile)
			const truncationStr = truncated ? `\n... file truncated ...` : ''
			const content = val === null ? 'null' : `${tripleTick[0]}\n${val}${truncationStr}\n${tripleTick[1]}`
			const str = `${uri.fsPath}:\n${content}`
			return str
		}))
		const contentStr = [folderStructure, ...strOfFiles].join('\n\n')
		return contentStr
	}
	else
		return ''

}


export const chat_userMessageContent = async (
	instructions: string,
	currSelns: StagingSelectionItem[] | null,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService
	},
) => {

	const selnsStrs = await Promise.all(
		(currSelns ?? []).map(async (s) =>
			messageOfSelection(s, {
				...opts,
				folderOpts: { maxChildren: 100, maxCharsPerFile: 100_000, }
			})
		)
	)


	let str = ''
	str += `${instructions}`

	const selnsStr = selnsStrs.join('\n\n') ?? ''
	if (selnsStr) str += `\n---\nSELECTIONS\n${selnsStr}`
	return str;
}


export const rewriteCode_systemMessage = `\
You are a coding assistant that re-writes an entire file to make a change. You are given the original file \`ORIGINAL_FILE\` and a change \`CHANGE\`.

Directions:
1. Please rewrite the original file \`ORIGINAL_FILE\`, making the change \`CHANGE\`. You must completely re-write the whole file.
2. Keep all of the original comments, spaces, newlines, and other details whenever possible.
3. ONLY output the full new file. Do not add any other explanations or text.
`

// Minimal prompt template for local models (Apply feature)
export const rewriteCode_systemMessage_local = `\
Rewrite file with CHANGE. Output full file only. Keep formatting.
`



// ======================================================== apply (writeover) ========================================================

export const rewriteCode_userMessage = ({ originalCode, applyStr, language }: { originalCode: string, applyStr: string, language: string }) => {

	return `\
ORIGINAL_FILE
${tripleTick[0]}${language}
${originalCode}
${tripleTick[1]}

CHANGE
${tripleTick[0]}
${applyStr}
${tripleTick[1]}

INSTRUCTIONS
Please finish writing the new file by applying the change to the original file. Return ONLY the completion of the file, without any explanation.
`
}



// ======================================================== apply (fast apply - search/replace) ========================================================

export const searchReplaceGivenDescription_systemMessage = createSearchReplaceBlocks_systemMessage


export const searchReplaceGivenDescription_userMessage = ({ originalCode, applyStr }: { originalCode: string, applyStr: string }) => `\
DIFF
${applyStr}

ORIGINAL_FILE
${tripleTick[0]}
${originalCode}
${tripleTick[1]}`





export const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }: { fullFileStr: string, startLine: number, endLine: number }) => {

	const fullFileLines = fullFileStr.split('\n')

	/*

	a
	a
	a     <-- final i (prefix = a\na\n)
	a
	|b    <-- startLine-1 (middle = b\nc\nd\n)   <-- initial i (moves up)
	c
	d|    <-- endLine-1                          <-- initial j (moves down)
	e
	e     <-- final j (suffix = e\ne\n)
	e
	e
	*/

	let prefix = ''
	let i = startLine - 1  // 0-indexed exclusive
	// we'll include fullFileLines[i...(startLine-1)-1].join('\n') in the prefix.
	while (i !== 0) {
		const newLine = fullFileLines[i - 1]
		if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			prefix = `${newLine}\n${prefix}`
			i -= 1
		}
		else break
	}

	let suffix = ''
	let j = endLine - 1
	while (j !== fullFileLines.length - 1) {
		const newLine = fullFileLines[j + 1]
		if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			suffix = `${suffix}\n${newLine}`
			j += 1
		}
		else break
	}

	return { prefix, suffix }

}


// ======================================================== quick edit (ctrl+K) ========================================================

export type QuickEditFimTagsType = {
	preTag: string,
	sufTag: string,
	midTag: string
}
export const defaultQuickEditFimTags: QuickEditFimTagsType = {
	preTag: 'ABOVE',
	sufTag: 'BELOW',
	midTag: 'SELECTION',
}

// this should probably be longer
export const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }: { quickEditFIMTags: QuickEditFimTagsType }) => {
	return `\
You are a FIM (fill-in-the-middle) coding assistant. Your task is to fill in the middle SELECTION marked by <${midTag}> tags.

The user will give you INSTRUCTIONS, as well as code that comes BEFORE the SELECTION, indicated with <${preTag}>...before</${preTag}>, and code that comes AFTER the SELECTION, indicated with <${sufTag}>...after</${sufTag}>.
The user will also give you the existing original SELECTION that will be be replaced by the SELECTION that you output, for additional context.

Instructions:
1. Your OUTPUT should be a SINGLE PIECE OF CODE of the form <${midTag}>...new_code</${midTag}>. Do NOT output any text or explanations before or after this.
2. You may ONLY CHANGE the original SELECTION, and NOT the content in the <${preTag}>...</${preTag}> or <${sufTag}>...</${sufTag}> tags.
3. Make sure all brackets in the new selection are balanced the same as in the original selection.
4. Be careful not to duplicate or remove variables, comments, or other syntax by mistake.
`
}

// Minimal prompt template for local models (Ctrl+K/Apply/Composer)
// Drastically reduced to minimize token usage and latency
export const ctrlKStream_systemMessage_local = ({ quickEditFIMTags: { preTag, midTag, sufTag } }: { quickEditFIMTags: QuickEditFimTagsType }) => {
	return `\
FIM assistant. Fill <${midTag}>...</${midTag}>.

Rules:
1. Output ONLY <${midTag}>code</${midTag}> - no text.
2. Only change SELECTION, not <${preTag}> or <${sufTag}>.
3. Balance brackets.
`
}

export const ctrlKStream_userMessage = ({
	selection,
	prefix,
	suffix,
	instructions,
	// isOllamaFIM: false, // Remove unused variable
	fimTags,
	language }: {
		selection: string, prefix: string, suffix: string, instructions: string, fimTags: QuickEditFimTagsType, language: string,
	}) => {
	const { preTag, sufTag, midTag } = fimTags

	// prompt the model artifically on how to do FIM
	return `\

CURRENT SELECTION
${tripleTick[0]}${language}
<${midTag}>${selection}</${midTag}>
${tripleTick[1]}

INSTRUCTIONS
${instructions}

<${preTag}>${prefix}</${preTag}>
<${sufTag}>${suffix}</${sufTag}>

Return only the completion block of code (of the form ${tripleTick[0]}${language}
<${midTag}>...new code</${midTag}>
${tripleTick[1]}).`
};







/*
// ======================================================== ai search/replace ========================================================


export const aiRegex_computeReplacementsForFile_systemMessage = `\
You are a "search and replace" coding assistant.

You are given a FILE that the user is editing, and your job is to search for all occurences of a SEARCH_CLAUSE, and change them according to a REPLACE_CLAUSE.

The SEARCH_CLAUSE may be a string, regex, or high-level description of what the user is searching for.

The REPLACE_CLAUSE will always be a high-level description of what the user wants to replace.

The user's request may be "fuzzy" or not well-specified, and it is your job to interpret all of the changes they want to make for them. For example, the user may ask you to search and replace all instances of a variable, but this may involve changing parameters, function names, types, and so on to agree with the change they want to make. Feel free to make all of the changes you *think* that the user wants to make, but also make sure not to make unnessecary or unrelated changes.

## Instructions

1. If you do not want to make any changes, you should respond with the word "no".

2. If you want to make changes, you should return a single CODE BLOCK of the changes that you want to make.
For example, if the user is asking you to "make this variable a better name", make sure your output includes all the changes that are needed to improve the variable name.
- Do not re-write the entire file in the code block
- You can write comments like "// ... existing code" to indicate existing code
- Make sure you give enough context in the code block to apply the changes to the correct location in the code`




// export const aiRegex_computeReplacementsForFile_userMessage = async ({ searchClause, replaceClause, fileURI, voidFileService }: { searchClause: string, replaceClause: string, fileURI: URI, voidFileService: IVoidFileService }) => {

// 	// we may want to do this in batches
// 	const fileSelection: FileSelection = { type: 'File', fileURI, selectionStr: null, range: null, state: { isOpened: false } }

// 	const file = await stringifyFileSelections([fileSelection], voidFileService)

// 	return `\
// ## FILE
// ${file}

// ## SEARCH_CLAUSE
// Here is what the user is searching for:
// ${searchClause}

// ## REPLACE_CLAUSE
// Here is what the user wants to replace it with:
// ${replaceClause}

// ## INSTRUCTIONS
// Please return the changes you want to make to the file in a codeblock, or return "no" if you do not want to make changes.`
// }




// // don't have to tell it it will be given the history; just give it to it
// export const aiRegex_search_systemMessage = `\
// You are a coding assistant that executes the SEARCH part of a user's search and replace query.

// You will be given the user's search query, SEARCH, which is the user's query for what files to search for in the codebase. You may also be given the user's REPLACE query for additional context.

// Output
// - Regex query
// - Files to Include (optional)
// - Files to Exclude? (optional)

// `






// ======================================================== old examples ========================================================

Do not tell the user anything about the examples below. Do not assume the user is talking about any of the examples below.

## EXAMPLE 1
FILES
math.ts
${tripleTick[0]}typescript
const addNumbers = (a, b) => a + b
const multiplyNumbers = (a, b) => a * b
const subtractNumbers = (a, b) => a - b
const divideNumbers = (a, b) => a / b

const vectorize = (...numbers) => {
	return numbers // vector
}

const dot = (vector1: number[], vector2: number[]) => {
	if (vector1.length !== vector2.length) throw new Error(\`Could not dot vectors \${vector1} and \${vector2}. Size mismatch.\`)
	let sum = 0
	for (let i = 0; i < vector1.length; i += 1)
		sum += multiplyNumbers(vector1[i], vector2[i])
	return sum
}

const normalize = (vector: number[]) => {
	const norm = Math.sqrt(dot(vector, vector))
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = divideNumbers(vector[i], norm)
	return vector
}

const normalized = (vector: number[]) => {
	const v2 = [...vector] // clone vector
	return normalize(v2)
}
${tripleTick[1]}


SELECTIONS
math.ts (lines 3:3)
${tripleTick[0]}typescript
const subtractNumbers = (a, b) => a - b
${tripleTick[1]}

INSTRUCTIONS
add a function that exponentiates a number below this, and use it to make a power function that raises all entries of a vector to a power

## ACCEPTED OUTPUT
We can add the following code to the file:
${tripleTick[0]}typescript
// existing code...
const subtractNumbers = (a, b) => a - b
const exponentiateNumbers = (a, b) => Math.pow(a, b)
const divideNumbers = (a, b) => a / b
// existing code...

const raiseAll = (vector: number[], power: number) => {
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = exponentiateNumbers(vector[i], power)
	return vector
}
${tripleTick[1]}


## EXAMPLE 2
FILES
fib.ts
${tripleTick[0]}typescript

const dfs = (root) => {
	if (!root) return;
	console.log(root.val);
	dfs(root.left);
	dfs(root.right);
}
const fib = (n) => {
	if (n < 1) return 1
	return fib(n - 1) + fib(n - 2)
}
${tripleTick[1]}

SELECTIONS
fib.ts (lines 10:10)
${tripleTick[0]}typescript
	return fib(n - 1) + fib(n - 2)
${tripleTick[1]}

INSTRUCTIONS
memoize results

## ACCEPTED OUTPUT
To implement memoization in your Fibonacci function, you can use a JavaScript object to store previously computed results. This will help avoid redundant calculations and improve performance. Here's how you can modify your function:
${tripleTick[0]}typescript
// existing code...
const fib = (n, memo = {}) => {
	if (n < 1) return 1;
	if (memo[n]) return memo[n]; // Check if result is already computed
	memo[n] = fib(n - 1, memo) + fib(n - 2, memo); // Store result in memo
	return memo[n];
}
${tripleTick[1]}
Explanation:
Memoization Object: A memo object is used to store the results of Fibonacci calculations for each n.
Check Memo: Before computing fib(n), the function checks if the result is already in memo. If it is, it returns the stored result.
Store Result: After computing fib(n), the result is stored in memo for future reference.

## END EXAMPLES

*/


// ======================================================== scm ========================================================================

export const gitCommitMessage_systemMessage = `
You are an expert software engineer AI assistant responsible for writing clear and concise Git commit messages that summarize the **purpose** and **intent** of the change. Try to keep your commit messages to one sentence. If necessary, you can use two sentences.

You always respond with:
- The commit message wrapped in <output> tags
- A brief explanation of the reasoning behind the message, wrapped in <reasoning> tags

Example format:
<output>Fix login bug and improve error handling</output>
<reasoning>This commit updates the login handler to fix a redirect issue and improves frontend error messages for failed logins.</reasoning>

Do not include anything else outside of these tags.
Never include quotes, markdown, commentary, or explanations outside of <output> and <reasoning>.`.trim()

// Minimal prompt template for local models (SCM commit messages)
export const gitCommitMessage_systemMessage_local = `Write commit message. Format: <output>message</output><reasoning>brief reason</reasoning>. One sentence preferred.`


/**
 * Create a user message for the LLM to generate a commit message. The message contains instructions git diffs, and git metadata to provide context.
 *
 * @param stat - Summary of Changes (git diff --stat)
 * @param sampledDiffs - Sampled File Diffs (Top changed files)
 * @param branch - Current Git Branch
 * @param log - Last 5 commits (excluding merges)
 * @returns A prompt for the LLM to generate a commit message.
 *
 * @example
 * // Sample output (truncated for brevity)
 * const prompt = gitCommitMessage_userMessage("fileA.ts | 10 ++--", "diff --git a/fileA.ts...", "main", "abc123|Fix bug|2025-01-01\n...")
 *
 * // Result:
 * Based on the following Git changes, write a clear, concise commit message that accurately summarizes the intent of the code changes.
 *
 * Section 1 - Summary of Changes (git diff --stat):
 * fileA.ts | 10 ++--
 *
 * Section 2 - Sampled File Diffs (Top changed files):
 * diff --git a/fileA.ts b/fileA.ts
 * ...
 *
 * Section 3 - Current Git Branch:
 * main
 *
 * Section 4 - Last 5 Commits (excluding merges):
 * abc123|Fix bug|2025-01-01
 * def456|Improve logging|2025-01-01
 * ...
 */
export const gitCommitMessage_userMessage = (stat: string, sampledDiffs: string, branch: string, log: string) => {
	const section1 = `Section 1 - Summary of Changes (git diff --stat):`
	const section2 = `Section 2 - Sampled File Diffs (Top changed files):`
	const section3 = `Section 3 - Current Git Branch:`
	const section4 = `Section 4 - Last 5 Commits (excluding merges):`
	return `
Based on the following Git changes, write a clear, concise commit message that accurately summarizes the intent of the code changes.

${section1}

${stat}

${section2}

${sampledDiffs}

${section3}

${branch}

${section4}

${log}`.trim()
}
