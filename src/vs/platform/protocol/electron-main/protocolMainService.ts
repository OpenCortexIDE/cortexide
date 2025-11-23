/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { session } from "electron";
import { existsSync } from "fs";
import {
	Disposable,
	IDisposable,
	toDisposable,
} from "../../../base/common/lifecycle.js";
import {
	COI,
	FileAccess,
	Schemas,
	CacheControlheaders,
	DocumentPolicyheaders,
} from "../../../base/common/network.js";
import { basename, extname, normalize } from "../../../base/common/path.js";
import { isLinux, isMacintosh } from "../../../base/common/platform.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { ILogService } from "../../log/common/log.js";
import { IIPCObjectUrl, IProtocolMainService } from "./protocol.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";

type ProtocolCallback = {
	(result: string | Electron.FilePathWithHeaders | { error: number }): void;
};

export class ProtocolMainService
	extends Disposable
	implements IProtocolMainService
{
	declare readonly _serviceBrand: undefined;

	private readonly validRoots = TernarySearchTree.forPaths<boolean>(!isLinux);
	private readonly validExtensions = new Set([
		".svg",
		".png",
		".jpg",
		".jpeg",
		".gif",
		".bmp",
		".webp",
		".mp4",
		".otf",
		".ttf",
	]); // https://github.com/microsoft/vscode/issues/119384

	constructor(
		@INativeEnvironmentService
		private readonly environmentService: INativeEnvironmentService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		// Define an initial set of roots we allow loading from
		// - appRoot	: all files installed as part of the app
		// - extensions : all files shipped from extensions
		// - storage    : all files in global and workspace storage (https://github.com/microsoft/vscode/issues/116735)
		this.addValidFileRoot(environmentService.appRoot);
		this.addValidFileRoot(environmentService.extensionsPath);
		this.addValidFileRoot(
			userDataProfilesService.defaultProfile.globalStorageHome.with({
				scheme: Schemas.file,
			}).fsPath,
		);
		this.addValidFileRoot(
			environmentService.workspaceStorageHome.with({ scheme: Schemas.file })
				.fsPath,
		);

		// Log appRoot for diagnostics (especially important on macOS)
		this.logService.trace(
			`ProtocolMainService: appRoot=${environmentService.appRoot}, isBuilt=${environmentService.isBuilt}`,
		);
		if (isMacintosh && environmentService.isBuilt) {
			// Verify critical workbench.html exists at expected location
			const workbenchPath = FileAccess.asFileUri(
				"vs/code/electron-browser/workbench/workbench.html",
			).fsPath;
			if (existsSync(workbenchPath)) {
				this.logService.trace(
					`ProtocolMainService: ✓ workbench.html found at ${workbenchPath}`,
				);
			} else {
				this.logService.warn(
					`ProtocolMainService: ⚠ workbench.html NOT found at ${workbenchPath}`,
				);
				this.logService.warn(
					`ProtocolMainService: This may cause blank screen on macOS. Check app bundle structure.`,
				);
			}
		}

		// Handle protocols
		this.handleProtocols();
	}

	private handleProtocols(): void {
		const { defaultSession } = session;

		// Register vscode-file:// handler
		defaultSession.protocol.registerFileProtocol(
			Schemas.vscodeFileResource,
			(request, callback) => this.handleResourceRequest(request, callback),
		);

		// Block any file:// access
		defaultSession.protocol.interceptFileProtocol(
			Schemas.file,
			(request, callback) => this.handleFileRequest(request, callback),
		);

		// Cleanup
		this._register(
			toDisposable(() => {
				defaultSession.protocol.unregisterProtocol(Schemas.vscodeFileResource);
				defaultSession.protocol.uninterceptProtocol(Schemas.file);
			}),
		);
	}

	addValidFileRoot(root: string): IDisposable {
		// Pass to `normalize` because we later also do the
		// same for all paths to check against.
		const normalizedRoot = normalize(root);

		if (!this.validRoots.get(normalizedRoot)) {
			this.validRoots.set(normalizedRoot, true);

			return toDisposable(() => this.validRoots.delete(normalizedRoot));
		}

		return Disposable.None;
	}

	//#region file://

	private handleFileRequest(
		request: Electron.ProtocolRequest,
		callback: ProtocolCallback,
	) {
		const uri = URI.parse(request.url);

		this.logService.error(
			`Refused to load resource ${uri.fsPath} from ${Schemas.file}: protocol (original URL: ${request.url})`,
		);

		return callback({ error: -3 /* ABORTED */ });
	}

	//#endregion

	//#region vscode-file://

	private handleResourceRequest(
		request: Electron.ProtocolRequest,
		callback: ProtocolCallback,
	): void {
		const path = this.requestToNormalizedFilePath(request);
		const pathBasename = basename(path);

		// Enhanced diagnostics for workbench.html requests (critical for blank screen debugging)
		if (
			pathBasename === "workbench.html" ||
			pathBasename === "workbench-dev.html"
		) {
			this.logService.trace(
				`ProtocolMainService: Handling workbench request - URL: ${request.url}, Resolved path: ${path}`,
			);

			// Verify file exists before attempting to serve
			if (!existsSync(path)) {
				this.logService.error(
					`ProtocolMainService: CRITICAL - workbench.html file does not exist at: ${path}`,
				);
				this.logService.error(
					`ProtocolMainService: Original request URL: ${request.url}`,
				);
				this.logService.error(
					`ProtocolMainService: appRoot: ${this.environmentService.appRoot}`,
				);
				this.logService.error(
					`ProtocolMainService: isBuilt: ${this.environmentService.isBuilt}`,
				);

				// Check if file exists in valid roots
				const validRoot = this.validRoots.findSubstr(path);
				if (validRoot) {
					this.logService.error(
						`ProtocolMainService: Path is under valid root: ${validRoot}`,
					);
				} else {
					this.logService.error(
						`ProtocolMainService: Path is NOT under any valid root`,
					);
					// Log all valid roots for debugging
					const roots: string[] = [];
					this.validRoots.forEach((value, key) => roots.push(key));
					this.logService.error(
						`ProtocolMainService: Valid roots: ${roots.join(", ")}`,
					);
				}

				// Return error - this will cause blank screen
				return callback({ error: -6 /* FILE_NOT_FOUND */ });
			} else {
				this.logService.trace(
					`ProtocolMainService: ✓ workbench.html file exists at: ${path}`,
				);
			}
		}

		let headers: Record<string, string> | undefined;
		if (this.environmentService.crossOriginIsolated) {
			if (
				pathBasename === "workbench.html" ||
				pathBasename === "workbench-dev.html"
			) {
				headers = COI.CoopAndCoep;
			} else {
				headers = COI.getHeadersFromQuery(request.url);
			}
		}

		// In OSS, evict resources from the memory cache in the renderer process
		// Refs https://github.com/microsoft/vscode/issues/148541#issuecomment-2670891511
		if (!this.environmentService.isBuilt) {
			headers = {
				...headers,
				...CacheControlheaders,
			};
		}

		// Document-policy header is needed for collecting
		// JavaScript callstacks via https://www.electronjs.org/docs/latest/api/web-frame-main#framecollectjavascriptcallstack-experimental
		// until https://github.com/electron/electron/issues/45356 is resolved.
		if (
			pathBasename === "workbench.html" ||
			pathBasename === "workbench-dev.html"
		) {
			headers = {
				...headers,
				...DocumentPolicyheaders,
			};
		}

		// first check by validRoots
		if (this.validRoots.findSubstr(path)) {
			return callback({ path, headers });
		}

		// then check by validExtensions
		if (this.validExtensions.has(extname(path).toLowerCase())) {
			return callback({ path, headers });
		}

		// finally block to load the resource
		this.logService.error(
			`${Schemas.vscodeFileResource}: Refused to load resource ${path} from ${Schemas.vscodeFileResource}: protocol (original URL: ${request.url})`,
		);

		return callback({ error: -3 /* ABORTED */ });
	}

	private requestToNormalizedFilePath(
		request: Electron.ProtocolRequest,
	): string {
		// 1.) Use `URI.parse()` util from us to convert the raw
		//     URL into our URI.
		const requestUri = URI.parse(request.url);

		// 2.) Use `FileAccess.asFileUri` to convert back from a
		//     `vscode-file:` URI to a `file:` URI.
		const unnormalizedFileUri = FileAccess.uriToFileUri(requestUri);

		// 3.) Strip anything from the URI that could result in
		//     relative paths (such as "..") by using `normalize`
		const normalizedPath = normalize(unnormalizedFileUri.fsPath);

		// Enhanced diagnostics for path resolution issues
		if (
			basename(normalizedPath) === "workbench.html" ||
			basename(normalizedPath) === "workbench-dev.html"
		) {
			this.logService.trace(
				`ProtocolMainService: Path resolution - Original URL: ${request.url}, Normalized path: ${normalizedPath}`,
			);
		}

		return normalizedPath;
	}

	//#endregion

	//#region IPC Object URLs

	createIPCObjectUrl<T>(): IIPCObjectUrl<T> {
		let obj: T | undefined = undefined;

		// Create unique URI
		const resource = URI.from({
			scheme: "vscode", // used for all our IPC communication (vscode:<channel>)
			path: generateUuid(),
		});

		// Install IPC handler
		const channel = resource.toString();
		const handler = async (): Promise<T | undefined> => obj;
		validatedIpcMain.handle(channel, handler);

		this.logService.trace(`IPC Object URL: Registered new channel ${channel}.`);

		return {
			resource,
			update: (updatedObj) => (obj = updatedObj),
			dispose: () => {
				this.logService.trace(`IPC Object URL: Removed channel ${channel}.`);

				validatedIpcMain.removeHandler(channel);
			},
		};
	}

	//#endregion
}
