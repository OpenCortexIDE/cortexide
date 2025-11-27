import { IModelService } from 'vs/workbench/contrib/agent/common/modelService';
import { IContextService } from 'vs/workbench/contrib/agent/common/contextService';
import { ProviderSettings, ProviderSettingsEntry, Mode } from '@roo-code/types';
import { Emitter, Event } from 'vs/base/common/event';

export class ModelService implements IModelService {
  _serviceBrand: undefined;

  private readonly _onDidActivateProviderProfile = new Emitter<{ name: string; provider?: string }>();
  public readonly onDidActivateProviderProfile: Event<{ name: string; provider?: string }> = this._onDidActivateProviderProfile.event;

  constructor(@IContextService private readonly contextService: IContextService) {}

  getProviderProfiles(): ProviderSettingsEntry[] {
    return this.contextService.getValue('listApiConfigMeta') || [];
  }

  getProviderProfile(name: string): ProviderSettingsEntry | undefined {
    return this.getProviderProfiles().find((profile) => profile.name === name);
  }

  async upsertProviderProfile(name: string, providerSettings: ProviderSettings, activate: boolean = true): Promise<string | undefined> {
    const profiles = this.getProviderProfiles();
    const id = Math.random().toString(36).substring(7);
    const newProfile: ProviderSettingsEntry = {
      id,
      name,
      apiProvider: providerSettings.apiProvider,
    };

    const existingIndex = profiles.findIndex(p => p.name === name);
    if (existingIndex !== -1) {
      newProfile.id = profiles[existingIndex].id;
      profiles[existingIndex] = newProfile;
    } else {
      profiles.push(newProfile);
    }

    await this.contextService.setValue('listApiConfigMeta', profiles);
    // In a real implementation, we would save the full providerSettings
    // using a secure method.

    if (activate) {
      await this.activateProviderProfile({ name });
    }

    return id;
  }

  async deleteProviderProfile(profileToDelete: ProviderSettingsEntry): Promise<void> {
    let profiles = this.getProviderProfiles();
    profiles = profiles.filter(p => p.id !== profileToDelete.id);
    await this.contextService.setValue('listApiConfigMeta', profiles);

    const currentProfileName = this.contextService.getValue('currentApiConfigName');
    if (currentProfileName === profileToDelete.name) {
      const newProfileToActivate = profiles[0];
      if (newProfileToActivate) {
        await this.activateProviderProfile({ name: newProfileToActivate.name });
      }
    }
  }

  async activateProviderProfile(args: { name: string } | { id: string }): Promise<void> {
    const profile = 'name' in args
        ? this.getProviderProfile(args.name)
        : this.getProviderProfiles().find(p => p.id === args.id);

    if (profile) {
        await this.contextService.setValue('currentApiConfigName', profile.name);
        // In a real implementation, we would load the full provider settings here.
        this._onDidActivateProviderProfile.fire({ name: profile.name, provider: profile.apiProvider });
    }
  }
}
