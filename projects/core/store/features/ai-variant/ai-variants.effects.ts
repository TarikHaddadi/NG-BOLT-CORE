import { inject } from '@angular/core';
import { Actions, createEffect, ofType,ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
        try {
          const cfg = (config.getAll?.() ?? {}) as RuntimeConfig;
          const featuresCfg = (cfg.features ?? {}) as Record<string, AppFeature>;

          const featureVariants: Record<string, Record<string, VariantValue>> = {};

          // Per-feature extraction
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
                if (!list.length) return;

                byProv[prov] = Array.from(new Set([...(byProv[prov] ?? []), ...list]));
                list.forEach((m) => models.add(m));
              });

              featureVariants[featureKey] = {
                'ai.provider': Array.from(providers),
                'ai.model': Array.from(models),
                '__ai.modelsByProvider': byProv,
              };
            } else if (v && typeof v === 'object') {
              // Legacy single-object shape
              const obj = v as Record<string, unknown>;
              const prov = normProvider(obj['ai.provider']);
              const list = normModels(obj['ai.model']);
              const byProv: ModelsByProvider = prov ? { [prov]: list } : {};

              featureVariants[featureKey] = {
                ...(obj as Record<string, VariantValue>),
                '__ai.modelsByProvider': byProv,
              };
            }
            // else: no variants → skip
          });

          // GLOBAL scope: merge all features
          const globalByProv: ModelsByProvider = {};
          Object.values(featureVariants).forEach((rec) => {
            const m = rec['__ai.modelsByProvider'] as ModelsByProvider | undefined;
            if (!m) return;
            Object.entries(m).forEach(([prov, list]) => {
              const acc = globalByProv[prov] ?? [];
              globalByProv[prov] = Array.from(new Set([...acc, ...list]));
            });
          });

          featureVariants[''] = {
            '__ai.modelsByProvider': globalByProv,
            'ai.provider': Object.keys(globalByProv),
            'ai.model': Array.from(new Set(Object.values(globalByProv).flat())),
          };

          return VariantsActions.hydrateSuccess({
            features: featureVariants,
          });
        } catch (error) {
          return VariantsActions.hydrateFailure({ error });
        }
      }),
      catchError((error) => of(VariantsActions.hydrateFailure({ error }))),
    );
  },
  { functional: true },
);
