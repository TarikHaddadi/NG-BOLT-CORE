import { HttpInterceptorFn } from '@angular/common/http';

import { AppEnvConfig } from './app.model';

export type CoreTheme = 'light' | 'dark';

export interface CoreI18nOptions {
  prefix?: string; // e.g. '/assets/i18n/'
  suffix?: string; // e.g. '.json'
  fallbackLang?: string; // e.g. 'en'
  lang?: string; // e.g. 'en' | 'fr'
}

export interface CoreOptions {
  theme?: CoreTheme;
  i18n?: CoreI18nOptions;
  /** Extra HttpInterceptorFn(s) inserted between auth and error interceptors. */
  interceptors?: HttpInterceptorFn[];
  /** Optional: app version (inject from host app) */
  appVersion?: string;
  /** Optional: disable animations if host doesn’t use @angular/animations */
  animations?: boolean; // default: true
  environments: AppEnvConfig;
}
