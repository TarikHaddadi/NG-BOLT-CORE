import { Inject, Injectable } from '@angular/core';

import { AppEnvConfig, CoreOptions } from '@cadai/pxs-ng-core/interfaces';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config!: AppEnvConfig;

  constructor(@Inject(CORE_OPTIONS) private readonly coreOpts: Required<CoreOptions>) {}

  async loadConfig(): Promise<void> {
    const appEnvVars = this.coreOpts.environments;

    if (!appEnvVars) throw new Error('Failed to load config: No environment variables found');

    this.config = {
      ...appEnvVars, // ✅ app env variables comes from host app, not library
      version: this.coreOpts.appVersion, // ✅ app version comes from host app, not library
    };
  }

  get<K extends keyof AppEnvConfig>(key: K): AppEnvConfig[K] {
    return this.config[key];
  }

  getAll(): AppEnvConfig {
    return this.config;
  }
}
