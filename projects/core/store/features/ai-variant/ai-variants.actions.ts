import { createAction, props } from '@ngrx/store';

import { VariantValue } from '@cadai/pxs-ng-core/interfaces';

export const hydrateFromConfig = createAction('[Variants] Hydrate From Config');

export const hydrateSuccess = createAction(
  '[Variants] Hydrate Success',
  props<{
    global: Record<string, VariantValue>;
    features: Record<string, Record<string, VariantValue>>;
  }>(),
);

export const hydrateFailure = createAction(
  '[Variants] Hydrate Failure',
  props<{ error: unknown }>(),
);

export const setVariant = createAction(
  '[Variants] Set Variant',
  props<{ path: string; value: VariantValue; featureKey?: string }>(),
);

export const reset = createAction('[Variants] Reset');
