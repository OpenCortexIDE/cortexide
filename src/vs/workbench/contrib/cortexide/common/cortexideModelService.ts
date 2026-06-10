import { Disposable, IReference } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IFileService, FileSystemProviderCapabilities } from '../../../../platform/files/common/files.js';
import { FileOperationError, FileOperationResult } from '../../../../platform/files/common/files.js';
import { LRUCache } from '../../../../base/common/map.js';

type CortexideModelType = {
	model: ITextModel | null;
	editorModel: IResolvedTextEditorModel | null;
};

export interface ICortexideModelService {
	readonly _serviceBrand: undefined;
	initializeModel(uri: URI): Promise<void>;
	getModel(uri: URI): CortexideModelType;
	getModelFromFsPath(fsPath: string): CortexideModelType;
	getModelSafe(uri: URI): Promise<CortexideModelType>;
	saveModel(uri: URI): Promise<void>;

}

export const ICortexideModelService = createDecorator<ICortexideModelService>('cortexideModelService');

export class CortexideModelService extends Disposable implements ICortexideModelService {
	_serviceBrand: undefined;
	static readonly ID = 'cortexideModelService';
	private readonly _modelRefOfURI: Record<string, IReference<IResolvedTextEditorModel>> = {};

	// LRU cache for model references (keep last 100 models in memory for instant access)
	private readonly _modelCache: LRUCache<string, IReference<IResolvedTextEditorModel>> = new LRUCache(100);

	// Cache file existence checks (TTL: 5 seconds) to avoid redundant file system calls
	private readonly _fileExistenceCache: Map<string, { exists: boolean; timestamp: number }> = new Map();
	private static readonly FILE_EXISTENCE_CACHE_TTL_MS = 5000;

	constructor(
		@ITextModelService private readonly _textModelService: ITextModelService,
		@ITextFileService private readonly _textFileService: ITextFileService,
		@IFileService private readonly _fileService: IFileService,
	) {
		super();
	}

	saveModel = async (uri: URI) => {
		// Phase 1: persist AI edits with an ATOMIC (temp file + rename) write so a crash/ENOSPC mid-write
		// cannot leave the user's file empty or half-written. This goes through the normal save path
		// (textFileService.save -> textFileEditorModel.doSave), so the working copy's dirty/etag/saved
		// state stays correct — only the underlying disk write becomes atomic. Guarded by the provider's
		// FileAtomicWrite capability: on providers that don't support it (e.g. some remote/virtual file
		// systems) we fall back to the normal save instead of throwing.
		const atomicWrite = this._fileService.hasCapability(uri, FileSystemProviderCapabilities.FileAtomicWrite)
		await this._textFileService.save(uri, { // we want [our change] -> [save] so it's all treated as one change.
			skipSaveParticipants: true, // avoid triggering extensions etc (if they reformat the page, it will add another item to the undo stack)
			atomicWrite
		})
	}

	initializeModel = async (uri: URI) => {
		try {
			// Validate URI is actually a URI instance
			if (!uri || typeof uri.fsPath !== 'string') {
				console.debug('InitializeModel error: Invalid URI provided', uri);
				return;
			}

			// Only process file:// URIs - skip other schemes like vscode-scm:, untitled:, etc.
			if (uri.scheme !== 'file') {
				return;
			}

			const fsPath = uri.fsPath;

			// Check cache first
			if (fsPath in this._modelRefOfURI) return;
			const cachedRef = this._modelCache.get(fsPath);
			if (cachedRef && !cachedRef.object.isDisposed()) {
				this._modelRefOfURI[fsPath] = cachedRef;
				return;
			}

			// Check file existence cache first (avoid redundant file system calls)
			const cachedExistence = this._fileExistenceCache.get(fsPath);
			const now = Date.now();
			let exists: boolean;

			if (cachedExistence && (now - cachedExistence.timestamp) < CortexideModelService.FILE_EXISTENCE_CACHE_TTL_MS) {
				exists = cachedExistence.exists;
			} else {
				// Check if file exists before trying to create model reference
				// This prevents noisy error logs for expected cases (e.g., .voidrules file doesn't exist)
				exists = await this._fileService.exists(uri);
				this._fileExistenceCache.set(fsPath, { exists, timestamp: now });

				// Clean up old cache entries (keep cache size reasonable)
				if (this._fileExistenceCache.size > 1000) {
					const entriesToDelete: string[] = [];
					for (const [path, entry] of this._fileExistenceCache.entries()) {
						if (now - entry.timestamp > CortexideModelService.FILE_EXISTENCE_CACHE_TTL_MS) {
							entriesToDelete.push(path);
						}
					}
					for (const path of entriesToDelete) {
						this._fileExistenceCache.delete(path);
					}
				}
			}

			if (!exists) {
				return; // File doesn't exist, which is fine - just return silently
			}

			const editorModelRef = await this._textModelService.createModelReference(uri);
			// Keep a strong reference to prevent disposal
			this._modelRefOfURI[fsPath] = editorModelRef;
			// Also add to LRU cache
			this._modelCache.set(fsPath, editorModelRef);
		}
		catch (e) {
			// Only log unexpected errors (not file not found errors)
			if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				// File not found is expected, don't log
				return;
			}
			// Log other unexpected errors at debug level
			console.debug('InitializeModel error:', e)
		}
	};

	getModelFromFsPath = (fsPath: string): CortexideModelType => {
		// Check primary cache first
		let editorModelRef = this._modelRefOfURI[fsPath];

		// If not in primary cache, check LRU cache
		if (!editorModelRef) {
			const cachedRef = this._modelCache.get(fsPath);
			if (cachedRef && !cachedRef.object.isDisposed()) {
				// Move to primary cache
				editorModelRef = cachedRef;
				this._modelRefOfURI[fsPath] = cachedRef;
			}
		}

		if (!editorModelRef) {
			return { model: null, editorModel: null };
		}

		const model = editorModelRef.object.textEditorModel;

		if (!model) {
			return { model: null, editorModel: editorModelRef.object };
		}

		return { model, editorModel: editorModelRef.object };
	};

	getModel = (uri: URI) => {
		return this.getModelFromFsPath(uri.fsPath)
	}


	getModelSafe = async (uri: URI): Promise<CortexideModelType> => {
		if (!(uri.fsPath in this._modelRefOfURI)) await this.initializeModel(uri);
		return this.getModel(uri);

	};

	override dispose() {
		super.dispose();
		for (const ref of Object.values(this._modelRefOfURI)) {
			ref.dispose(); // release reference to allow disposal
		}
		// Clear LRU cache (references will be disposed when evicted)
		this._modelCache.clear();
		this._fileExistenceCache.clear();
	}
}

registerSingleton(ICortexideModelService, CortexideModelService, InstantiationType.Eager);
