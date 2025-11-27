import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { ITask } from 'vs/workbench/contrib/agent/common/task';

export type AgentRole = 'architect' | 'developer' | 'tester';

export interface IAgent {
  readonly role: AgentRole;
  startTask(text: string, images?: string[]): Promise<ITask>;
}

export const IAgentService = createDecorator<IAgentService>('agentService');

export interface IAgentService extends IWorkbenchContribution {
  _serviceBrand: undefined;

  getAgent(role: AgentRole): IAgent | undefined;
  startTask(role: AgentRole, text: string, images?: string[]): Promise<ITask>;
  cancelTask(taskId: string): Promise<void>;
  getCurrentTask(): ITask | undefined;
}
