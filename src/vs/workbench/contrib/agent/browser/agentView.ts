import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWebviewViewService, IWebviewService } from 'vs/workbench/contrib/webview/browser/webview';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { URI } from 'vs/base/common/uri';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IAgentService } from 'vs/workbench/contrib/agent/common/agentService';

export class AgentView extends ViewPane {
    private webviewViewService: IWebviewViewService;
    private webview?: IWebviewService;
    private environmentService: IEnvironmentService;
    private agentService: IAgentService;

    constructor(
        options: IViewPaneOptions,
        @IKeybindingService keybindingService: IKeybindingService,
        @IContextMenuService contextMenuService: IContextMenuService,
        @IConfigurationService configurationService: IConfigurationService,
        @IInstantiationService instantiationService: IInstantiationService,
        @IViewDescriptorService viewDescriptorService: IViewDescriptorService,
        @IOpenerService openerService: IOpenerService,
        @IThemeService themeService: IThemeService,
        @ITelemetryService telemetryService: ITelemetryService,
        @IWebviewViewService webviewViewService: IWebviewViewService,
        @IContextKeyService contextKeyService: IContextKeyService,
        @IStorageService storageService: IStorageService,
        @IEnvironmentService environmentService: IEnvironmentService,
        @IAgentService agentService: IAgentService,
    ) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, instantiationService, viewDescriptorService, themeService, telemetryService, openerService);
        this.webviewViewService = webviewViewService;
        this.environmentService = environmentService;
        this.agentService = agentService;
    }

    protected override renderBody(container: HTMLElement): void {
        super.renderBody(container);

        const webviewView = this.webviewViewService.createWebviewView(this.id, {
            title: this.title,
            icon: this.icon,
        });

        this.webview = webviewView.webview;
        webviewView.webview.html = this.getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'startTask':
                    this.agentService.startTask('developer', message.text, message.images);
                    break;
            }
        });

        // Post initial state
        this.postStateToWebview();
    }

    private async postStateToWebview() {
        if (!this.webview) {
            return;
        }

        const state = {
            // This will be populated with the actual state from the services
        };

        this.webview.postMessage({ type: 'state', state });
    }

    private getHtmlForWebview(): string {
        if (!this.webview) {
            return '';
        }

        const webviewUiUri = this.webview.asWebviewUri(
            URI.joinPath(this.environmentService.appRoot, 'src', 'vs', 'workbench', 'contrib', 'agent', 'webview-ui', 'build', 'assets', 'index.js')
        );

        return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cortex IDE Agent</title>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${webviewUiUri}"></script>
            </body>
            </html>`;
    }

    protected override layoutBody(height: number, width: number): void {
        super.layoutBody(height, width);
    }
}
