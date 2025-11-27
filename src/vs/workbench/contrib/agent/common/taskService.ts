import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { ITask } from 'vs/workbench/contrib/agent/common/task';
import { RooCodeSettings, CreateTaskOptions } from '@roo-code/types';

export const ITaskService = createDecorator<ITaskService>('taskService');

export interface ITaskService extends IWorkbenchContribution {
  _serviceBrand: undefined;

  createTask(text?: string, images?: string[], parentTask?: ITask, options?: CreateTaskOptions, configuration?: RooCodeSettings): Promise<ITask>;
  cancelTask(): Promise<void>;
  getCurrentTask(): ITask | undefined;
}
