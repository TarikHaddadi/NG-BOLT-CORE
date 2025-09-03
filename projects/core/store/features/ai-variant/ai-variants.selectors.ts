import { createFeatureSelector, createSelector, MemoizedSelector } from '@ngrx/store';

import { VariantsState, VariantValue } from '@cadai/pxs-ng-core/interfaces';

export const selectVariants = createFeatureSelector<VariantsState>('aiVariants');
export const selectFeatureVariants = createSelector(selectVariants, (s) => s.features);
export const selectFeatureRecord = (featureKey: string) =>
  createSelector(selectFeatureVariants, (f) => f[featureKey] ?? {});

/** Selected provider is always a scalar string (or undefined if not chosen yet) */
export const selectProviderInFeature = (
  featureKey: string,
): MemoizedSelector<object, string | undefined> =>
  createSelector(selectFeatureRecord(featureKey), (rec) => {
    const v = rec['ai.provider'] as VariantValue | undefined;
    return typeof v === 'string' ? v : undefined;
  });

/** Selected model is always a scalar string (or undefined); guard against accidental arrays */
export const selectModelInFeature = (
  featureKey: string,
): MemoizedSelector<object, string | undefined> =>
  createSelector(selectFeatureRecord(featureKey), (rec) => {
    const v = rec['ai.model'] as VariantValue | undefined;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0]; // defensive
    return undefined;
  });

/** Meta (unchanged): provider -> models[] for this feature scope */
export const selectModelsByProvider = (
  featureKey: string,
): MemoizedSelector<object, Record<string, string[]>> =>
  createSelector(
    selectFeatureRecord(featureKey),
    (rec) => (rec['__ai.modelsByProvider'] as Record<string, string[]>) ?? {},
  );
