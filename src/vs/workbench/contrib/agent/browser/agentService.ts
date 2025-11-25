import { IAgentService, IAgent, AgentRole } from 'vs/workbench/contrib/agent/common/agentService';
import { ITaskService } from 'vs/workbench/contrib/agent/common/taskService';
import { IContextService } from 'vs/workbench/contrib/agent/common/contextService';
import { IModelService } from 'vs/workbench/contrib/agent/common/modelService';
import { ICodeIndexService } from 'vs/workbench/contrib/agent/common/codeIndexService';
import { IKnowledgeGraphService } from 'vs/workbench/contrib/agent/common/knowledgeGraphService';
import { ITask } from 'vs/workbench/contrib/agent/common/task';
import { Task } from 'vs/workbench/contrib/agent/browser/task';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

class Agent implements IAgent {
  constructor(
    public readonly role: AgentRole,
    private readonly taskService: ITaskService,
    private readonly instantiationService: IInstantiationService
  ) {}

  startTask(text: string, images?: string[]): Promise<ITask> {
      const task = this.instantiationService.createInstance(Task, this, this.role, text, images);
      // In a real implementation, we would manage the task lifecycle here.
      (task as Task).run();
      return Promise.resolve(task);
  }
}

export class AgentService implements IAgentService {
  _serviceBrand: undefined;

  private readonly agents: Map<AgentRole, IAgent> = new Map();

  constructor(
    @ITaskService private readonly taskService: ITaskService,
    @IContextService private readonly contextService: IContextService,
    @IModelService private readonly modelService: IModelService,
    @ICodeIndexService private readonly codeIndexService: ICodeIndexService,
    @IKnowledgeGraphService private readonly knowledgeGraphService: IKnowledgeGraphService,
    @IInstantiationService private readonly instantiationService: IInstantiationService,
  ) {
    this.agents.set('architect', new Agent('architect', this.taskService, this.instantiationService));
    this.agents.set('developer', new Agent('developer', this.taskService, this.instantiationService));
    this.agents.set('tester', new Agent('tester', this.taskService, this.instantiationService));
  }

  getAgent(role: AgentRole): IAgent | undefined {
    return this.agents.get(role);
  }

  async startTask(role: AgentRole, text: string, images?: string[]): Promise<ITask> {
    const agent = this.getAgent(role);
    if (!agent) {
      throw new Error(`Agent with role '${role}' not found.`);
    }
    return agent.startTask(text, images);
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.taskService.cancelTask();
  }

  getCurrentTask(): ITask | undefined {
    return this.taskService.getCurrentTask();
  }
}
