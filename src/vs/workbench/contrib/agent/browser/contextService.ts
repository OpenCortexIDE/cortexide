import { IContextService } from 'vs/workbench/contrib/agent/common/contextService';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { GlobalState, RooCodeSettings, GLOBAL_STATE_KEYS, SECRET_STATE_KEYS, isSecretStateKey } from '@roo-code/types';
import { ILogService } from 'vs/platform/log/common/log';
import { Memento } from 'vs/workbench/common/memento';

export class ContextService implements IContextService {
  _serviceBrand: undefined;

  private stateCache: GlobalState = {};
  private memento: Memento;

  constructor(
    @IStorageService private readonly storageService: IStorageService,
    @ILogService private readonly logService: ILogService
  ) {
    this.memento = new Memento('cortex-agent', this.storageService);
    this.loadState();
  }

  private loadState(): void {
    const state = this.memento.getMemento(StorageScope.APPLICATION, StorageTarget.MACHINE);
    for (const key of GLOBAL_STATE_KEYS) {
      this.stateCache[key] = state[key];
    }
  }

  private saveState(): void {
    const state = this.memento.getMemento(StorageScope.APPLICATION, StorageTarget.MACHINE);
    for (const key of GLOBAL_STATE_KEYS) {
        state[key] = this.stateCache[key];
    }
    this.memento.saveMemento();
  }

  getValue<K extends keyof RooCodeSettings>(key: K): RooCodeSettings[K] {
    if (isSecretStateKey(key)) {
      this.logService.warn(`Attempted to access secret key '${key}' through non-secret method.`);
      return undefined;
    }
    return this.stateCache[key as keyof GlobalState] as RooCodeSettings[K];
  }

  async setValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]): Promise<void> {
    if (isSecretStateKey(key)) {
        this.logService.warn(`Attempted to set secret key '${key}' through non-secret method.`);
        return;
    }
    this.stateCache[key as keyof GlobalState] = value;
    this.saveState();
  }

  getValues(): RooCodeSettings {
    return this.stateCache as RooCodeSettings;
  }

  async setValues(values: RooCodeSettings): Promise<void> {
    for (const key in values) {
      await this.setValue(key as keyof RooCodeSettings, values[key as keyof RooCodeSettings]);
    }
  }
}
