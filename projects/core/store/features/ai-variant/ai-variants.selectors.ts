import { createFeatureSelector, createSelector } from '@ngrx/store';

import { VariantsState } from '@cadai/pxs-ng-core/interfaces';

export const selectVariants = createFeatureSelector<VariantsState>('variants');

export const selectFeatureVariants = createSelector(selectVariants, (s) => s.features);

export const selectVariantInFeature = (featureKey: string, path: string) =>
  createSelector(selectFeatureVariants, (f) => f[featureKey]?.[path]);

export const selectVariantResolved = (path: string) =>
  createSelector(selectVariants, (s) => {
    for (const rec of Object.values(s.features)) {
      if (rec && rec[path] !== undefined) return rec[path];
    }
    return undefined;
  });

export const selectFeatureRecord = (featureKey: string) =>
  createSelector(selectFeatureVariants, (f) => f[featureKey] ?? {});

export const selectModelsByProvider = (featureKey: string) =>
  createSelector(selectFeatureRecord(featureKey), (rec) => {
    const meta = rec['__ai.modelsByProvider'] as Record<string, string[]> | undefined;
    return meta ?? {};
  });

/** Return resolved value(s) always as array of strings */
export const selectVariantResolvedArray = (path: string) =>
  createSelector(selectVariants, (s) => {
    const v = Object.values(s.features).find((rec) => rec?.[path] !== undefined)?.[path];

    if (Array.isArray(v)) return v as string[];
    if (v == null) return [];
    return [String(v)];
  });
