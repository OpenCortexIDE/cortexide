import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { GlobalState, RooCodeSettings } from '@roo-code/types';

export const IContextService = createDecorator<IContextService>('contextService');

export interface IContextService extends IWorkbenchContribution {
  _serviceBrand: undefined;

  getValue<K extends keyof RooCodeSettings>(key: K): RooCodeSettings[K];
  setValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]): Promise<void>;
  getValues(): RooCodeSettings;
  setValues(values: RooCodeSettings): Promise<void>;
}
