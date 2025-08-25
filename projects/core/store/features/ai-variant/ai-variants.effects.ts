// projects/.../store/variants/variants.effects.ts
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

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
            if (f?.variants && typeof f.variants === 'object') {
              featureVariants[key] = f.variants as Record<string, unknown>;
            }
          }

          return of(VariantsActions.hydrateSuccess({ global: {}, features: featureVariants }));
        } catch (error) {
          return of(VariantsActions.hydrateFailure({ error }));
        }
      }),
      catchError((error) => of(VariantsActions.hydrateFailure({ error }))),
    );
  },
  { functional: true },
);
