import { createAction, props } from '@ngrx/store';

import { SerializedError, VariantValue } from '@cadai/pxs-ng-core/interfaces';

export const hydrateFromConfig = createAction('[Variants] Hydrate From Config');

export const hydrateSuccess = createAction(
  '[Variants] Hydrate Success',
  props<{
    features: Record<string, Record<string, VariantValue>>;
  }>(),
);

export const hydrateFailure = createAction(
  '[Variants] Hydrate Failure',
  props<{ error: SerializedError }>(),
);

export const setVariant = createAction(
  '[Variants] Set Variant',
  props<{ path: string; value: VariantValue; featureKey?: string }>(),
);

export const setModelsByProvider = createAction(
  '[Variants] Set Models By Provider',
  props<{ featureKey: string; map: Record<string, string[]> }>(),
);

export const reset = createAction('[Variants] Reset');
