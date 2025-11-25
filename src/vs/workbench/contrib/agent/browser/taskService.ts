import { ITaskService } from 'vs/workbench/contrib/agent/common/taskService';
import { ITask } from 'vs/workbench/contrib/agent/common/task';
import { IAgentService, AgentRole } from 'vs/workbench/contrib/agent/common/agentService';
import { RooCodeSettings, CreateTaskOptions } from '@roo-code/types';
import { Task } from 'vs/workbench/contrib/agent/browser/task';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class TaskService implements ITaskService {
  _serviceBrand: undefined;

  private readonly taskStack: ITask[] = [];

  constructor(
    @IInstantiationService private readonly instantiationService: IInstantiationService
  ) {}

  async createTask(text?: string, images?: string[], parentTask?: ITask, options?: CreateTaskOptions, configuration?: RooCodeSettings): Promise<ITask> {
    const agentService = this.instantiationService.invokeFunction(accessor => accessor.get(IAgentService));
    const task = this.instantiationService.createInstance(Task, agentService, 'developer', text || '', images);
    this.taskStack.push(task);
    return task;
  }

  async cancelTask(): Promise<void> {
    this.taskStack.pop();
  }

  getCurrentTask(): ITask | undefined {
    return this.taskStack[this.taskStack.length - 1];
  }
}
