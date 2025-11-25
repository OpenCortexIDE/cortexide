import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { ProviderSettings, ProviderSettingsEntry } from '@roo-code/types';

export const IModelService = createDecorator<IModelService>('modelService');

export interface IModelService extends IWorkbenchContribution {
  _serviceBrand: undefined;

  getProviderProfiles(): ProviderSettingsEntry[];
  getProviderProfile(name: string): ProviderSettingsEntry | undefined;
  upsertProviderProfile(name: string, providerSettings: ProviderSettings, activate?: boolean): Promise<string | undefined>;
  deleteProviderProfile(profileToDelete: ProviderSettingsEntry): Promise<void>;
  activateProviderProfile(args: { name: string } | { id: string }): Promise<void>;
}
