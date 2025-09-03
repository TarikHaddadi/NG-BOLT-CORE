import { createReducer, on } from '@ngrx/store';

import { VariantsState, VariantValue } from '@cadai/pxs-ng-core/interfaces';

import * as VariantsActions from './ai-variants.actions';

export const initialVariantsState: VariantsState = {
  features: {},
  modelsByProvider: {},
  error: null,
};

// helper: shallow merge of records
function mergeRecords<
  T extends Record<string, VariantValue>,
  U extends Record<string, VariantValue>,
>(base: T, override: U): Record<string, VariantValue> {
  return { ...base, ...override };
}

// helper: merge nested feature maps
function mergeFeatureMaps<
  T extends Record<string, Record<string, VariantValue>>,
  U extends Record<string, Record<string, VariantValue>>,
>(base: T, override: U): Record<string, Record<string, VariantValue>> {
  const allKeys = new Set([...Object.keys(base), ...Object.keys(override)]);
  const out: Record<string, Record<string, VariantValue>> = {};
  for (const k of allKeys) {
    out[k] = mergeRecords(base[k] ?? {}, override[k] ?? {});
  }
  return out;
}

export const variantsReducer = createReducer(
  initialVariantsState,

  on(VariantsActions.hydrateSuccess, (state, { features }) => ({
    ...state,
    features: mergeFeatureMaps(features ?? {}, state.features),
    error: null,
  })),
  on(VariantsActions.hydrateFailure, (state, { error }) => ({ ...state, error })),
  on(VariantsActions.setVariant, (state, { featureKey, path, value }) => {
    if (!featureKey) return state;
    const fv = state.features[featureKey] ?? {};
    return {
      ...state,
      features: {
        ...state.features,
        [featureKey]: {
          ...fv,
          [path]: value,
        },
      },
    };
  }),
  on(VariantsActions.setModelsByProvider, (state, { featureKey, map }) => ({
    ...state,
    modelsByProvider: {
      ...state.modelsByProvider,
      [featureKey]: map,
    },
  })),
  on(VariantsActions.reset, () => initialVariantsState),
);
