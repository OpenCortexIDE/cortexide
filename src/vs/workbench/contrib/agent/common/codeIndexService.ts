import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { VectorStoreSearchResult } from 'vs/workbench/contrib/agent/common/vectorStore';
import { URI } from 'vs/base/common/uri';

export interface ISymbolReference {
  uri: URI;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export const ICodeIndexService = createDecorator<ICodeIndexService>('codeIndexService');

export interface ICodeIndexService extends IWorkbenchContribution {
  _serviceBrand: undefined;

  startIndexing(): Promise<void>;
  stopWatcher(): void;
  clearIndexData(): Promise<void>;
  searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]>;

  findSymbol(query: string): Promise<ISymbolReference[]>;
  findReferences(symbol: ISymbolReference): Promise<ISymbolReference[]>;
  insertAfterSymbol(symbol: ISymbolReference, content: string): Promise<void>;
}
