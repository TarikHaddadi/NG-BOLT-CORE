import { createReducer, on } from '@ngrx/store';

import { VariantsState, VariantValue } from '@cadai/pxs-ng-core/interfaces';

import * as VariantsActions from './ai-variants.actions';

export const initialVariantsState: VariantsState = {
  features: {},
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
    features: mergeFeatureMaps(features ?? {}, state.features),
  })),

  on(VariantsActions.hydrateFailure, (state) => state),

  on(VariantsActions.setVariant, (state, { path, value, featureKey }) => {
    if (featureKey) {
      const current = state.features[featureKey] ?? {};
      if (value === undefined) {
        const { [path]: _omit, ...rest } = current;
        return { ...state, features: { ...state.features, [featureKey]: rest } };
      }
      return {
        ...state,
        features: { ...state.features, [featureKey]: { ...current, [path]: value } },
      };
    }

    if (value === undefined) {
      return { ...state };
    }
    return { ...state };
  }),

  on(VariantsActions.setModelsByProvider, (state, { featureKey, map }) => ({
    ...state,
    features: {
      ...state.features,
      [featureKey]: {
        ...(state.features[featureKey] ?? {}),
        ['__ai.modelsByProvider']: map,
      },
    },
  })),

  on(VariantsActions.reset, () => initialVariantsState),
);
