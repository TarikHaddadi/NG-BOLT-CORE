import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  EnvironmentInjector,
  EnvironmentProviders,
  importProvidersFrom,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideAppInitializer } from '@angular/core';
import { MatNativeDateModule } from '@angular/material/core';
import { provideAnimations, provideNoopAnimations } from '@angular/platform-browser/animations';
import { Store } from '@ngrx/store';
import { provideTranslateService, TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom, map, of, take } from 'rxjs';

import { authInterceptor, httpErrorInterceptor } from '@cadai/pxs-ng-core/interceptors';
import { CoreOptions, RuntimeConfig } from '@cadai/pxs-ng-core/interfaces';
import {
  APP_DATE_PROVIDERS,
  ConfigService,
  FeatureService,
  KeycloakService,
} from '@cadai/pxs-ng-core/services';
import { AppActions, AppSelectors } from '@cadai/pxs-ng-core/store';
import { CORE_GET_USER_CTX, CORE_OPTIONS, GetUserCtx } from '@cadai/pxs-ng-core/tokens';

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
      prefix: opts.i18n?.prefix ?? '/assets/i18n/',
      suffix: opts.i18n?.suffix ?? '.json',
      fallbackLang: opts.i18n?.fallbackLang ?? 'en',
    },
    interceptors: opts.interceptors ?? [],
    animations: opts.animations ?? true,
    appVersion: opts.appVersion ?? '0.0.0',
    // If environments is optional in CoreOptions, prefer: environments: opts.environments as RuntimeConfig
    environments: (opts.environments as RuntimeConfig) ?? ({} as RuntimeConfig),
  } as Required<CoreOptions>;
}

export function provideCore(opts: CoreOptions = {}): EnvironmentProviders {
  const normalized = normalize(opts);

  return makeEnvironmentProviders([
    // Options
    { provide: CORE_OPTIONS, useValue: normalized },

    // Singletons
    ConfigService,
    KeycloakService,

    // Expose user context for guards
    {
      provide: CORE_GET_USER_CTX,
      deps: [KeycloakService],
      useFactory:
        (kc: KeycloakService): GetUserCtx =>
        () =>
          kc.getUserCtx(),
    },

    // Angular Material date providers
    importProvidersFrom(TranslateModule),
    importProvidersFrom(MatNativeDateModule),
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
    }),

    // Theme init
    provideAppInitializer(() => loadTheme(normalized.theme)),

    // Animations (ON/OFF)
    ...(normalized.animations === false ? [provideNoopAnimations()] : [provideAnimations()]),

    // Async boot: config -> keycloak -> hydrate store (if present) -> feature user -> variants
    provideAppInitializer(() => {
      const env = inject(EnvironmentInjector);
      const config = env.get(ConfigService);
      const kc = env.get(KeycloakService);
      const translate = env.get(TranslateService);

      let store: Store | undefined;
      try {
        store = env.get(Store);
      } catch {}

      return (async () => {
        // 1) runtime config + keycloak
        await config.loadConfig();
        await kc.init();

        // 2) resolve selected language from store (fallback to opts)
        const selectedLang$ = store
          ? store.select(AppSelectors.LangSelectors.selectLang)
          : of<string | undefined>(undefined);

        const selectedLang = await firstValueFrom(
          selectedLang$.pipe(
            take(1),
            map((l) => (l && l.trim()) || normalized.i18n.lang),
          ),
        );

        // 3) init i18n with the resolved language
        translate.addLangs(['en', 'fr']); // or drive from config
        translate.setFallbackLang(normalized.i18n.fallbackLang!);
        translate.use(selectedLang!);
        document.documentElement.setAttribute('lang', selectedLang!);

        // 4) feature/store hydration
        const features = env.get(FeatureService);
        features.reseedFromConfig();
        if (store) store.dispatch(AppActions.AuthActions.hydrateFromKc());

        const { isAuthenticated, roles, tenant } = kc.getUserCtx();
        features.setUser({ isAuthenticated, roles, tenant });
        if (store) store.dispatch(AppActions.AiVariantsActions.hydrateFromConfig());
      })();
    }),
  ]);
}
