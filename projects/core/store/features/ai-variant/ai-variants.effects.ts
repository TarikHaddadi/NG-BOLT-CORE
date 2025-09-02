import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';

import { AppFeature, RuntimeConfig, VariantValue } from '@cadai/pxs-ng-core/interfaces';
import { ConfigService } from '@cadai/pxs-ng-core/services';

import * as VariantsActions from './ai-variants.actions';

type ModelsByProvider = Record<string, string[]>;

const normProvider = (p: unknown): string => (typeof p === 'string' ? p.trim().toLowerCase() : '');

const normModels = (m: unknown): string[] => {
  const arr = Array.isArray(m) ? m : m != null ? [String(m)] : [];
  return Array.from(
    new Set(
      arr
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
};

export const hydrateFromConfigEffect = createEffect(
  () => {
    const actions$ = inject(Actions);
    const config = inject(ConfigService);

    return actions$.pipe(
      ofType(VariantsActions.hydrateFromConfig, ROOT_EFFECTS_INIT),
      map(() => {
        const cfg = (config.getAll?.() ?? {}) as RuntimeConfig;
        const featuresCfg = (cfg.features ?? {}) as Record<string, AppFeature>;

        const features: Record<string, Record<string, VariantValue>> = {};

        // Per-feature options (meta)
        Object.entries(featuresCfg).forEach(([featureKey, f]) => {
          const v = f?.variants as unknown;
          if (Array.isArray(v)) {
            const providers = new Set<string>();
            const models = new Set<string>();
            const byProv: ModelsByProvider = {};

            (v as Array<Record<string, unknown>>).forEach((group) => {
              const prov = normProvider(group['ai.provider']);
              if (!prov) return;
              providers.add(prov);
              const list = normModels(group['ai.model']);
              if (list.length) {
                byProv[prov] = Array.from(new Set([...(byProv[prov] ?? []), ...list]));
                list.forEach((m) => models.add(m));
              }
            });

            features[featureKey] = {
              '__ai.providers': Array.from(providers),
              '__ai.models': Array.from(models),
              '__ai.modelsByProvider': byProv,
            };
          } else if (v && typeof v === 'object') {
            const obj = v as Record<string, unknown>;
            const prov = normProvider(obj['ai.provider']);
            const list = normModels(obj['ai.model']);
            const byProv: ModelsByProvider = prov ? { [prov]: list } : {};
            features[featureKey] = {
              '__ai.providers': prov ? [prov] : [],
              '__ai.models': list,
              '__ai.modelsByProvider': byProv,
            };
          }
        });

        return VariantsActions.hydrateSuccess({ features });
      }),
      catchError((error) => of(VariantsActions.hydrateFailure({ error }))),
    );
  },
  { functional: true },
);

/** Optional: set sensible defaults after hydrate, if user hasn't chosen yet */
export const ensureDefaultsEffect = createEffect(
  () => {
    const actions$ = inject(Actions);

    return actions$.pipe(
      ofType(VariantsActions.hydrateSuccess),
      mergeMap(({ features }) => {
        const toDispatch: any[] = [];
        Object.entries(features).forEach(([featureKey, rec]) => {
          if (!featureKey) return; // skip global
          const providers = rec['__ai.providers'] as string[] | undefined;
          const map = rec['__ai.modelsByProvider'] as ModelsByProvider | undefined;
          if (!providers?.length || !map) return;
          const p = providers[0];
          const m = (map[p] ?? [])[0];
          if (p)
            toDispatch.push(
              VariantsActions.setVariant({ featureKey, path: 'ai.provider', value: p }),
            );
          if (m)
            toDispatch.push(VariantsActions.setVariant({ featureKey, path: 'ai.model', value: m }));
        });
        return toDispatch.length ? toDispatch : [];
      }),
    );
  },
  { functional: true },
);
