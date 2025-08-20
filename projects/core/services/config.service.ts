import { Inject, Injectable } from '@angular/core';
import { AuthRuntimeConfig, CoreOptions } from '@cadai/pxs-ng-core/interfaces';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

export interface AppConfig {
  name: string;
  production: boolean;
  apiUrl: string;
  version: string;
  auth: AuthRuntimeConfig;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config!: AppConfig;

  constructor(@Inject(CORE_OPTIONS) private readonly coreOpts: Required<CoreOptions>) { }

  async loadConfig(): Promise<void> {
    const res = await fetch('/assets/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load config: ${res.status} ${res.statusText}`);
    const json = await res.json();

    this.config = {
      ...json,
      version: this.coreOpts.appVersion, // ✅ app version comes from host app, not library
    };
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getAll(): AppConfig {
    return this.config;
  }
}
