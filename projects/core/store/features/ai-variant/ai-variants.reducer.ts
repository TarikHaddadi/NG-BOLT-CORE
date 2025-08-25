import { createReducer, on } from '@ngrx/store';

import { VariantsState } from '@cadai/pxs-ng-core/interfaces';

import * as VariantsActions from './ai-variants.actions';

export const initialVariantsState: VariantsState = {
  global: {},
  features: {},
};

export const variantsReducer = createReducer(
  initialVariantsState,

  // Replace state with the hydrated maps from RuntimeConfig
  on(VariantsActions.hydrateSuccess, (_state, { global, features }) => ({
    global: global ?? {},
    features: features ?? {},
  })),

  // No state change on failure (you can add an error field if desired)
  on(VariantsActions.hydrateFailure, (state) => state),

  // Upsert or clear a variant (global or feature-scoped)
  on(VariantsActions.setVariant, (state, { path, value, featureKey }) => {
    // If feature-scoped
    if (featureKey) {
      const current = state.features[featureKey] ?? {};
      // Support "remove" when value is undefined
      if (value === undefined) {
        const { [path]: _omit, ...rest } = current;
        return {
          ...state,
          features: { ...state.features, [featureKey]: rest },
        };
      }
      return {
        ...state,
        features: { ...state.features, [featureKey]: { ...current, [path]: value } },
      };
    }

    // Global scope
    if (value === undefined) {
      const { [path]: _omit, ...rest } = state.global;
      return { ...state, global: rest };
    }
    return { ...state, global: { ...state.global, [path]: value } };
  }),

  // Reset to initial empty maps
  on(VariantsActions.reset, () => initialVariantsState),
);
