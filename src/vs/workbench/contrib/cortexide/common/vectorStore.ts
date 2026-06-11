/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ICortexideSettingsService } from './cortexideSettingsService.js';
import { canEgress, classifyDestination } from './egressPolicy.js';

export interface VectorDocument {
	id: string; // Unique document ID (e.g., file path + chunk index)
	text: string; // Original text
	embedding: number[]; // Vector embedding
	metadata?: Record<string, any>; // Additional metadata (file path, line numbers, etc.)
}

export interface VectorSearchResult {
	id: string;
	text: string;
	score: number; // Similarity score (0-1, higher is better)
	metadata?: Record<string, any>;
}

export const IVectorStore = createDecorator<IVectorStore>('vectorStore');

export interface IVectorStore {
	readonly _serviceBrand: undefined;
	isEnabled(): boolean;
	initialize(): Promise<void>;
	index(documents: VectorDocument[]): Promise<void>;
	query(queryEmbedding: number[], k: number, filter?: Record<string, any>): Promise<VectorSearchResult[]>;
	delete(ids: string[]): Promise<void>;
	clear(): Promise<void>;
}

// No-op implementation (when vector store is disabled)
class NoOpVectorStore implements IVectorStore {
	declare readonly _serviceBrand: undefined;

	isEnabled(): boolean {
		return false;
	}

	async initialize(): Promise<void> {
		// No-op
	}

	async index(_documents: VectorDocument[]): Promise<void> {
		// No-op
	}

	async query(_queryEmbedding: number[], _k: number, _filter?: Record<string, any>): Promise<VectorSearchResult[]> {
		return [];
	}

	async delete(_ids: string[]): Promise<void> {
		// No-op
	}

	async clear(): Promise<void> {
		// No-op
	}
}

// Qdrant adapter
class QdrantVectorStore implements IVectorStore {
	declare readonly _serviceBrand: undefined;

	private _url: string;
	private _collectionName: string = 'cortexide_index';
	private _initialized = false;

	constructor(
		private readonly _configurationService: IConfigurationService,
		private readonly _logService: ILogService,
	) {
		this._url = this._configurationService.getValue<string>('cortexide.rag.vectorStoreUrl') || 'http://localhost:6333';
	}

	isEnabled(): boolean {
		return true;
	}

	async initialize(): Promise<void> {
		if (this._initialized) {
			return;
		}

		try {
			// Check if collection exists, create if not
			const checkResponse = await fetch(`${this._url}/collections/${this._collectionName}`);
			if (checkResponse.status === 404) {
				// Create collection
				await fetch(`${this._url}/collections/${this._collectionName}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						vectors: {
							size: 1536, // Default OpenAI embedding size, adjust if needed
							distance: 'Cosine',
						},
					}),
				});
			}
			this._initialized = true;
		} catch (error) {
			this._logService.error('[QdrantVectorStore] Failed to initialize:', error);
			throw error;
		}
	}

	async index(documents: VectorDocument[]): Promise<void> {
		if (!this._initialized) {
			await this.initialize();
		}

		try {
			// Batch upsert points
			const points = documents.map(doc => ({
				id: this._hashId(doc.id),
				vector: doc.embedding,
				payload: {
					text: doc.text,
					...doc.metadata,
				},
			}));

			// Qdrant supports batch upsert
			await fetch(`${this._url}/collections/${this._collectionName}/points`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ points }),
			});
		} catch (error) {
			this._logService.error('[QdrantVectorStore] Failed to index documents:', error);
			throw error;
		}
	}

	async query(queryEmbedding: number[], k: number, filter?: Record<string, any>): Promise<VectorSearchResult[]> {
		if (!this._initialized) {
			await this.initialize();
		}

		try {
			const requestBody: any = {
				vector: queryEmbedding,
				limit: k,
				with_payload: true,
			};

			if (filter) {
				requestBody.filter = { must: Object.entries(filter).map(([key, value]) => ({ key: { [key]: value } })) };
			}

			const response = await fetch(`${this._url}/collections/${this._collectionName}/points/search`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				throw new Error(`Qdrant query failed: ${response.statusText}`);
			}

			const data = await response.json();
			return (data.result || []).map((point: any) => ({
				id: point.id?.toString() || '',
				text: point.payload?.text || '',
				score: point.score || 0,
				metadata: { ...point.payload, text: undefined }, // Exclude text from metadata
			}));
		} catch (error) {
			this._logService.error('[QdrantVectorStore] Failed to query:', error);
			return [];
		}
	}

	async delete(ids: string[]): Promise<void> {
		if (!this._initialized) {
			return;
		}

		try {
			const pointIds = ids.map(id => this._hashId(id));
			await fetch(`${this._url}/collections/${this._collectionName}/points/delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ points: pointIds }),
			});
		} catch (error) {
			this._logService.error('[QdrantVectorStore] Failed to delete:', error);
		}
	}

	async clear(): Promise<void> {
		if (!this._initialized) {
			return;
		}

		try {
			await fetch(`${this._url}/collections/${this._collectionName}`, {
				method: 'DELETE',
			});
			this._initialized = false;
		} catch (error) {
			this._logService.error('[QdrantVectorStore] Failed to clear:', error);
		}
	}

	private _hashId(id: string): number {
		// Simple hash function to convert string ID to number (Qdrant requires numeric IDs)
		let hash = 0;
		for (let i = 0; i < id.length; i++) {
			const char = id.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash);
	}
}

// Chroma adapter
class ChromaVectorStore implements IVectorStore {
	declare readonly _serviceBrand: undefined;

	private _url: string;
	private _collectionName: string = 'cortexide_index';
	private _initialized = false;

	constructor(
		private readonly _configurationService: IConfigurationService,
		private readonly _logService: ILogService,
	) {
		this._url = this._configurationService.getValue<string>('cortexide.rag.vectorStoreUrl') || 'http://localhost:8000';
	}

	isEnabled(): boolean {
		return true;
	}

	async initialize(): Promise<void> {
		if (this._initialized) {
			return;
		}

		try {
			// Check if collection exists, create if not
			const checkResponse = await fetch(`${this._url}/api/v1/collections/${this._collectionName}`);
			if (checkResponse.status === 404) {
				// Create collection
				await fetch(`${this._url}/api/v1/collections`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: this._collectionName,
						metadata: {},
					}),
				});
			}
			this._initialized = true;
		} catch (error) {
			this._logService.error('[ChromaVectorStore] Failed to initialize:', error);
			throw error;
		}
	}

	async index(documents: VectorDocument[]): Promise<void> {
		if (!this._initialized) {
			await this.initialize();
		}

		try {
			// Chroma uses upsert with ids, embeddings, documents, and metadatas
			const ids = documents.map(doc => doc.id);
			const embeddings = documents.map(doc => doc.embedding);
			const texts = documents.map(doc => doc.text);
			const metadatas = documents.map(doc => doc.metadata || {});

			await fetch(`${this._url}/api/v1/collections/${this._collectionName}/upsert`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ids,
					embeddings,
					documents: texts,
					metadatas,
				}),
			});
		} catch (error) {
			this._logService.error('[ChromaVectorStore] Failed to index documents:', error);
			throw error;
		}
	}

	async query(queryEmbedding: number[], k: number, filter?: Record<string, any>): Promise<VectorSearchResult[]> {
		if (!this._initialized) {
			await this.initialize();
		}

		try {
			const requestBody: any = {
				query_embeddings: [queryEmbedding],
				n_results: k,
				include: ['documents', 'metadatas', 'distances'],
			};

			if (filter) {
				requestBody.where = filter;
			}

			const response = await fetch(`${this._url}/api/v1/collections/${this._collectionName}/query`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				throw new Error(`Chroma query failed: ${response.statusText}`);
			}

			const data = await response.json();
			const results: VectorSearchResult[] = [];

			if (data.ids && data.ids[0] && data.documents && data.documents[0]) {
				for (let i = 0; i < data.ids[0].length; i++) {
					results.push({
						id: data.ids[0][i],
						text: data.documents[0][i] || '',
						score: data.distances?.[0]?.[i] ? 1 - data.distances[0][i] : 0, // Convert distance to similarity
						metadata: data.metadatas?.[0]?.[i] || {},
					});
				}
			}

			return results;
		} catch (error) {
			this._logService.error('[ChromaVectorStore] Failed to query:', error);
			return [];
		}
	}

	async delete(ids: string[]): Promise<void> {
		if (!this._initialized) {
			return;
		}

		try {
			await fetch(`${this._url}/api/v1/collections/${this._collectionName}/delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			});
		} catch (error) {
			this._logService.error('[ChromaVectorStore] Failed to delete:', error);
		}
	}

	async clear(): Promise<void> {
		if (!this._initialized) {
			return;
		}

		try {
			await fetch(`${this._url}/api/v1/collections/${this._collectionName}`, {
				method: 'DELETE',
			});
			this._initialized = false;
		} catch (error) {
			this._logService.error('[ChromaVectorStore] Failed to clear:', error);
		}
	}
}

// Factory service
export class VectorStoreService implements IVectorStore {
	declare readonly _serviceBrand: undefined;

	private _delegate: IVectorStore = new NoOpVectorStore();

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@ICortexideSettingsService private readonly _settingsService: ICortexideSettingsService,
	) {
		this._updateDelegate();
		this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cortexide.rag')) {
				this._updateDelegate();
			}
		});
	}

	private _updateDelegate(): void {
		const provider = this._configurationService.getValue<'none' | 'qdrant' | 'chroma'>('cortexide.rag.vectorStore') || 'none';

		switch (provider) {
			case 'qdrant':
				this._delegate = new QdrantVectorStore(this._configurationService, this._logService);
				break;
			case 'chroma':
				this._delegate = new ChromaVectorStore(this._configurationService, this._logService);
				break;
			default:
				this._delegate = new NoOpVectorStore();
				break;
		}
	}

	/**
	 * Phase 8 egress gate: under local-only privacy mode, a vector store reachable only at a
	 * remote URL would ship (redacted) code text + embeddings off the machine. Block it LIVE so a
	 * runtime policy change takes effect immediately, and gate every operation (not just callers
	 * that check isEnabled()). A localhost vector store is still allowed under local-only.
	 */
	private _localOnlyBlocksStore(): boolean {
		const provider = this._configurationService.getValue<'none' | 'qdrant' | 'chroma'>('cortexide.rag.vectorStore') || 'none';
		if (provider === 'none') { return false; } // NoOp delegate anyway
		const url = this._configurationService.getValue<string>('cortexide.rag.vectorStoreUrl')
			|| (provider === 'chroma' ? 'http://localhost:8000' : 'http://localhost:6333');
		const decision = canEgress(
			{ routingPolicy: this._settingsService.state.globalSettings.routingPolicy },
			{ modality: 'vector-store', destinationKind: classifyDestination(url) }
		);
		return !decision.allowed;
	}

	isEnabled(): boolean {
		if (this._localOnlyBlocksStore()) { return false; }
		return this._delegate.isEnabled();
	}

	async initialize(): Promise<void> {
		if (this._localOnlyBlocksStore()) { return; }
		await this._delegate.initialize();
	}

	async index(documents: VectorDocument[]): Promise<void> {
		if (this._localOnlyBlocksStore()) { return; }
		await this._delegate.index(documents);
	}

	async query(queryEmbedding: number[], k: number, filter?: Record<string, any>): Promise<VectorSearchResult[]> {
		if (this._localOnlyBlocksStore()) { return []; }
		return await this._delegate.query(queryEmbedding, k, filter);
	}

	async delete(ids: string[]): Promise<void> {
		if (this._localOnlyBlocksStore()) { return; }
		await this._delegate.delete(ids);
	}

	async clear(): Promise<void> {
		if (this._localOnlyBlocksStore()) { return; }
		await this._delegate.clear();
	}
}

registerSingleton(IVectorStore, VectorStoreService, InstantiationType.Delayed);

