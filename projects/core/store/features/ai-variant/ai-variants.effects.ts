import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

import { VariantValue } from '@cadai/pxs-ng-core/interfaces';
import { ConfigService } from '@cadai/pxs-ng-core/services';

import * as VariantsActions from './ai-variants.actions';

/**
 * Reads RuntimeConfig and extracts features[*].variants into the store shape.
 * This runs when you dispatch VariantsActions.hydrateFromConfig() from provideCore.
 */
export const hydrateFromConfigEffect = createEffect(
  () => {
    const actions$ = inject(Actions);
    const config = inject(ConfigService);

    return actions$.pipe(
      ofType(VariantsActions.hydrateFromConfig),
      mergeMap(() => {
        try {
          const cfg = config.getAll?.();
          const featuresCfg = (cfg?.features ?? {}) as Record<
            string,
            { variants?: Record<string, unknown> | null | undefined }
          >;

          const featureVariants: Record<string, Record<string, unknown>> = {};
          for (const [key, f] of Object.entries(featuresCfg)) {
            if (!f?.variants) continue;

            // We'll build: providers[], models[], and modelsByProvider{}
            if (Array.isArray(f.variants)) {
              const providers = new Set<string>();
              const models = new Set<string>();
              const modelsByProvider: Record<string, string[]> = {};

              for (const group of f.variants as Array<Record<string, string | string[]>>) {
                const provRaw = group['ai.provider'];
                const modelRaw = group['ai.model'];

                if (typeof provRaw === 'string' && provRaw) {
                  providers.add(provRaw);
                  const list = Array.isArray(modelRaw) ? modelRaw : modelRaw ? [modelRaw] : [];
                  const unique = Array.from(new Set(list.filter(Boolean) as string[]));
                  if (unique.length) {
                    modelsByProvider[provRaw] = Array.from(
                      new Set([...(modelsByProvider[provRaw] ?? []), ...unique]),
                    );
                    unique.forEach((m) => models.add(m));
                  }
                } else {
                  // handle any other keys in groups (if you decide to support them later)
                  for (const [k, _] of Object.entries(group)) {
                    if (k === 'ai.provider' || k === 'ai.model') continue;
                    // You can extend normalization here if needed
                  }
                }
              }

              featureVariants[key] = {
                'ai.provider': Array.from(providers),
                'ai.model': Array.from(models),
                // store meta map under a namespaced key
                '__ai.modelsByProvider': modelsByProvider,
              };
            } else if (typeof f.variants === 'object') {
              // Legacy shape: keep as-is
              featureVariants[key] = f.variants as Record<string, unknown>;
            }
          }

          return of(
            VariantsActions.hydrateSuccess({
              global: {}, // Record<string, VariantValue>
              features: featureVariants as Record<string, Record<string, VariantValue>>,
            }),
          );
        } catch (error) {
          return of(VariantsActions.hydrateFailure({ error }));
        }
      }),
      catchError((error) => of(VariantsActions.hydrateFailure({ error }))),
    );
  },
  { functional: true },
);
