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
      // (no 'lang' here on purpose; we’ll resolve later)
    },
    interceptors: opts.interceptors ?? [],
    animations: opts.animations ?? true,
    appVersion: opts.appVersion ?? '0.0.0',
    environments: (opts.environments as RuntimeConfig) ?? ({} as RuntimeConfig),
  } as Required<CoreOptions>;
}

export function provideCore(opts: CoreOptions = {}): EnvironmentProviders {
  const normalized = normalize(opts);

  // 🔎 Flags resolved synchronously from host-provided runtimeConfig
  const cfg = normalized.environments as RuntimeConfig;
  const hasNgrx = !!cfg.hasNgrx;
  const hasKeycloak = !!cfg.auth?.hasKeycloak;

  // 🧰 Build interceptors conditionally (KC auth only if enabled)
  const httpInterceptors = [
    ...(hasKeycloak ? [authInterceptor] : []),
    ...normalized.interceptors,
    httpErrorInterceptor,
  ];

  return makeEnvironmentProviders([
    { provide: CORE_OPTIONS, useValue: normalized },

    // Singletons
    ConfigService,
    KeycloakService, // safe to provide even if disabled; we simply won't init it

    // Expose user context for guards (guest when KC disabled)
    {
      provide: CORE_GET_USER_CTX,
      useFactory: () => {
        const kc = inject(KeycloakService);
        const guest = { isAuthenticated: true, roles: [], tenant: null } as const;
        return (() => (hasKeycloak ? kc.getUserCtx() : guest)) as GetUserCtx;
      },
    },

    // Angular Material date providers + translate pipe/directive
    importProvidersFrom(TranslateModule),
    importProvidersFrom(MatNativeDateModule),
    ...APP_DATE_PROVIDERS,

    // HttpClient with curated interceptor order
    provideHttpClient(withInterceptors(httpInterceptors)),

    // i18n service (do NOT eager-load a lang here)
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: normalized.i18n.prefix,
        suffix: normalized.i18n.suffix,
      }),
      fallbackLang: normalized.i18n.fallbackLang,
    }),

    // Theme init
    provideAppInitializer(() => loadTheme(normalized.theme)),

    // Animations
    ...(normalized.animations === false ? [provideNoopAnimations()] : [provideAnimations()]),

    // 🔄 Async boot (config → KC? → i18n → features → NgRx hydration?)
    provideAppInitializer(() => {
      const env = inject(EnvironmentInjector);
      const config = env.get(ConfigService);
      const kc = env.get(KeycloakService);
      const translate = env.get(TranslateService);
      const features = env.get(FeatureService);

      // Store is optional (and also gated by hasNgrx)
      let store: Store | undefined;
      try {
        store = env.get(Store);
      } catch {}

      return (async () => {
        // 1) runtime config (already seeded from CORE_OPTIONS)
        await config.loadConfig();
        const runtime = config.getAll();

        // 2) Keycloak (only if enabled)
        if (hasKeycloak) {
          await kc.init();
        }

        // 3) Resolve selected language (from NgRx if enabled, else fallback)
        const fallback = normalized.i18n.fallbackLang || 'en';
        const selectedLang$ =
          hasNgrx && store
            ? store.select(AppSelectors.LangSelectors.selectLang)
            : of<string | undefined>(undefined);

        const selectedLang = await firstValueFrom(
          selectedLang$.pipe(
            take(1),
            map((l) => (l && l.trim()) || fallback),
          ),
        );

        translate.addLangs(['en', 'fr']);
        translate.setFallbackLang(fallback);
        translate.use(selectedLang);
        document.documentElement.setAttribute('lang', selectedLang);

        // 4) Features + user (guest when Keycloak disabled)
        features.updateConfig(runtime); // ✅ <-- refresh FeatureService with the real config
        features.reseedFromConfig();
        const user = hasKeycloak
          ? kc.getUserCtx()
          : { isAuthenticated: true, roles: [], tenant: null };
        features.setUser(user);

        // 5) NgRx hydration (only if enabled & store present)
        if (hasNgrx && store) {
          if (hasKeycloak) store.dispatch(AppActions.AuthActions.hydrateFromKc());
          store.dispatch(AppActions.AiVariantsActions.hydrateFromConfig());
        }
      })();
    }),
  ]);
}
