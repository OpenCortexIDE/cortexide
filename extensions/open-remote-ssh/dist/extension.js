"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
async function activate(context) {
    // Register command: openremotessh.openEmptyWindow
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.openEmptyWindow', async () => {
        // This command should open a new window to connect to a host
        // For now, we'll just show a message or trigger the connection flow
        const host = await vscode.window.showInputBox({
            prompt: 'Enter SSH host to connect to',
            placeHolder: 'user@hostname'
        });
        if (host) {
            await vscode.commands.executeCommand('workbench.action.remote.showQuickPick');
        }
    }));
    // Register command: openremotessh.openEmptyWindowInCurrentWindow
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.openEmptyWindowInCurrentWindow', async () => {
        const host = await vscode.window.showInputBox({
            prompt: 'Enter SSH host to connect to',
            placeHolder: 'user@hostname'
        });
        if (host) {
            await vscode.commands.executeCommand('workbench.action.remote.showQuickPick');
        }
    }));
    // Register command: openremotessh.openConfigFile
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.openConfigFile', async () => {
        await openSSHConfigFile();
    }));
    // Register command: openremotessh.showLog
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.showLog', async () => {
        // Show the output channel for SSH logs
        const outputChannel = vscode.window.createOutputChannel('Remote - SSH');
        outputChannel.show();
    }));
    // Register command: openremotessh.explorer.add
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.add', async () => {
        // Add new SSH host - open the config file
        await openSSHConfigFile();
    }));
    // Register command: openremotessh.explorer.configure
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.configure', async () => {
        // Configure SSH - open the config file
        await openSSHConfigFile();
    }));
    // Register command: openremotessh.explorer.refresh
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.refresh', async () => {
        // Refresh the SSH hosts view
        await vscode.commands.executeCommand('workbench.views.remote.refresh');
    }));
    // Register command: openremotessh.explorer.emptyWindowInNewWindow
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.emptyWindowInNewWindow', async (host) => {
        if (host) {
            // Connect to the specified host in a new window
            await vscode.commands.executeCommand('workbench.action.remote.showQuickPick');
        }
    }));
    // Register command: openremotessh.explorer.emptyWindowInCurrentWindow
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.emptyWindowInCurrentWindow', async (host) => {
        if (host) {
            // Connect to the specified host in the current window
            await vscode.commands.executeCommand('workbench.action.remote.showQuickPick');
        }
    }));
    // Register command: openremotessh.explorer.reopenFolderInCurrentWindow
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.reopenFolderInCurrentWindow', async (folder) => {
        if (folder) {
            await vscode.commands.executeCommand('vscode.openFolder', folder, false);
        }
    }));
    // Register command: openremotessh.explorer.reopenFolderInNewWindow
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.reopenFolderInNewWindow', async (folder) => {
        if (folder) {
            await vscode.commands.executeCommand('vscode.openFolder', folder, true);
        }
    }));
    // Register command: openremotessh.explorer.deleteFolderHistoryItem
    context.subscriptions.push(vscode.commands.registerCommand('openremotessh.explorer.deleteFolderHistoryItem', async (_item) => {
        // Remove item from recent list
        // This would typically interact with the recent folders list
    }));
}
async function openSSHConfigFile() {
    const config = vscode.workspace.getConfiguration('remote.SSH');
    const configFile = config.get('configFile', '');
    let configPath;
    if (configFile && configFile.trim() !== '') {
        configPath = configFile;
    }
    else {
        // Default SSH config file location
        const homeDir = os.homedir();
        configPath = path.join(homeDir, '.ssh', 'config');
    }
    // Ensure the .ssh directory exists
    const sshDir = path.dirname(configPath);
    if (!fs.existsSync(sshDir)) {
        try {
            fs.mkdirSync(sshDir, { recursive: true });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create .ssh directory: ${error}`);
            return;
        }
    }
    // Create the config file if it doesn't exist
    if (!fs.existsSync(configPath)) {
        try {
            fs.writeFileSync(configPath, '', { mode: 0o600 });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create SSH config file: ${error}`);
            return;
        }
    }
    // Open the config file
    const uri = vscode.Uri.file(configPath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
}
function deactivate() {
    // Cleanup if needed
}
//# sourceMappingURL=extension.js.map