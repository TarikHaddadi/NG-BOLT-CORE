import { HttpInterceptorFn } from '@angular/common/http';

import { UserRole } from '@cadai/pxs-ng-core/enums';

import { AuthRuntimeConfig } from './keycloack.model';

export type CoreTheme = 'light' | 'dark';

export interface RealtimeTransportSse {
  enabled: boolean;
  endpoint: string;
}

export interface RealtimeTransportWs {
  enabled: boolean;
  url: string;
}

export interface RealtimeTransportPush {
  enabled: boolean;
  vapidPublicKey?: string;
  topics?: string[];
  requireUserOptIn?: boolean;
}

export interface AppFeature {
  enabled: boolean;
  roles?: UserRole[];
  allow?: { tenants?: string[] };
  key?: string;
  label?: string;
  icon?: string;
  route?: string;
  requireAuth?: boolean;
  variants?: Record<string, unknown>;
}

export interface RuntimeConfig {
  name: 'dev' | 'uat' | 'prod' | string;
  production: boolean;
  apiUrl: string;

  realtime?: {
    enabled: boolean;
    order: Array<'sse' | 'websocket' | 'push'>;
    transports: {
      sse?: RealtimeTransportSse;
      websocket?: RealtimeTransportWs;
      push?: RealtimeTransportPush;
    };
  };
  features: Record<string, AppFeature>;
  version: string;
  auth: AuthRuntimeConfig;
}

export interface CoreI18nOptions {
  prefix?: string; // e.g. '/assets/i18n/'
  suffix?: string; // e.g. '.json'
  fallbackLang?: string; // e.g. 'en'
  lang?: string; // e.g. 'en' | 'fr'
}

export interface UserCtx {
  isAuthenticated: boolean;
  roles: UserRole[];
  tenant?: string | null;
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
  environments?: RuntimeConfig;
}

export interface FeatureNavItem {
  key: string;
  label: string;
  icon?: string;
  route?: string;
}
