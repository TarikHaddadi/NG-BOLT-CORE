import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideAppInitializer } from '@angular/core';
import { MatNativeDateModule } from '@angular/material/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Store } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { authInterceptor, httpErrorInterceptor } from '@cadai/pxs-ng-core/interceptors';
import { CoreOptions } from '@cadai/pxs-ng-core/interfaces';
import { APP_DATE_PROVIDERS, ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';
import { AppActions } from '@cadai/pxs-ng-core/store';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

function loadTheme(theme: 'light' | 'dark' = 'light') {
  const href = `assets/theme/${theme}.css`;
  const id = 'theme-style';
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
}

function normalize(opts: CoreOptions): Required<CoreOptions> {
  return {
    theme: opts.theme ?? 'light',
    i18n: {
      prefix: opts.i18n?.prefix ?? 'assets/i18n/',
      suffix: opts.i18n?.suffix ?? '.json',
      fallbackLang: opts.i18n?.fallbackLang ?? 'en',
      lang: opts.i18n?.lang ?? 'en',
    },
    interceptors: opts.interceptors ?? [],
    animations: opts.animations ?? true,
    appVersion: opts.appVersion ?? '0.0.0', // keep if you use version injection
  } as Required<CoreOptions>;
}

export function provideCore(opts: CoreOptions = {}): EnvironmentProviders {
  const normalized = normalize(opts);

  return makeEnvironmentProviders([
    // Make options injectable
    { provide: CORE_OPTIONS, useValue: normalized },

    // Singletons
    ConfigService,
    KeycloakService,

    // Angular Material date providers
    MatNativeDateModule,
    ...APP_DATE_PROVIDERS,

    // HttpClient with curated interceptor order: auth -> (extras) -> error
    provideHttpClient(
      withInterceptors([authInterceptor, ...normalized.interceptors, httpErrorInterceptor]),
    ),

    // i18n
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: normalized.i18n.prefix,
        suffix: normalized.i18n.suffix,
      }),
      fallbackLang: normalized.i18n.fallbackLang,
      lang: normalized.i18n.lang,
    }),

    // Theme init
    provideAppInitializer(() => loadTheme(normalized.theme)),

    // Optional animations (default ON)
    ...(normalized.animations === false ? [] : [provideAnimations()]),

    // Async boot: config -> keycloak -> hydrate store (if present)
    provideAppInitializer(() => {
      const env = inject(EnvironmentInjector);
      const config = env.get(ConfigService);
      const kc = env.get(KeycloakService);

      let store: Store | undefined;
      try {
        store = env.get(Store);
      } catch {}

      return (async () => {
        await config.loadConfig();
        await kc.init();
        if (store) store.dispatch(AppActions.AuthActions.hydrateFromKc());
      })();
    }),
  ]);
}
