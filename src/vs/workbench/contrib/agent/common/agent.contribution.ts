import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IAgentService } from 'vs/workbench/contrib/agent/common/agentService';
import { IContextService } from 'vs/workbench/contrib/agent/common/contextService';
import { IModelService } from 'vs/workbench/contrib/agent/common/modelService';
import { ICodeIndexService } from 'vs/workbench/contrib/agent/common/codeIndexService';
import { ITaskService } from 'vs/workbench/contrib/agent/common/taskService';
import { IKnowledgeGraphService } from 'vs/workbench/contrib/agent/common/knowledgeGraphService';
import { AgentService } from 'vs/workbench/contrib/agent/browser/agentService';
import { ContextService } from 'vs/workbench/contrib/agent/browser/contextService';
import { ModelService } from 'vs/workbench/contrib/agent/browser/modelService';
import { CodeIndexService } from 'vs/workbench/contrib/agent/browser/codeIndexService';
import { TaskService } from 'vs/workbench/contrib/agent/browser/taskService';
import { KnowledgeGraphService } from 'vs/workbench/contrib/agent/browser/knowledgeGraphService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IViewsRegistry, Extensions, ViewContainer, ViewContainerLocation } from 'vs/workbench/common/views';
import { AgentView } from 'vs/workbench/contrib/agent/browser/agentView';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Codicon } from 'vs/base/common/codicons';

registerSingleton(IAgentService, AgentService, InstantiationType.Delayed);
registerSingleton(IContextService, ContextService, InstantiationType.Delayed);
registerSingleton(IModelService, ModelService, InstantiationType.Delayed);
registerSingleton(ICodeIndexService, CodeIndexService, InstantiationType.Delayed);
registerSingleton(ITaskService, TaskService, InstantiationType.Delayed);
registerSingleton(IKnowledgeGraphService, KnowledgeGraphService, InstantiationType.Delayed);

const container: ViewContainer = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).registerViewContainer({
    id: 'cortex-agent',
    title: 'Cortex Agent',
    icon: Codicon.hubot,
    order: 100,
}, ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).registerViews([{
    id: 'cortex-agent-view',
    name: 'Cortex Agent',
    containerIcon: Codicon.hubot,
    ctorDescriptor: new SyncDescriptor(AgentView),
    canToggleVisibility: true,
    canMoveView: true,
    collapsed: false,
    order: 1,
}], container);
