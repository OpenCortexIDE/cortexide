import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';

export const IKnowledgeGraphService = createDecorator<IKnowledgeGraphService>('knowledgeGraphService');

export interface IKnowledgeGraphService extends IWorkbenchContribution {
  _serviceBrand: undefined;

  buildGraph(): Promise<void>;
  queryGraph(query: string): Promise<any[]>;
}
