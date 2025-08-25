import { createAction, props } from '@ngrx/store';

/** Kick off hydration from RuntimeConfig (effects will read ConfigService). */
export const hydrateFromConfig = createAction('[Variants] Hydrate From Config');

/** Hydration succeeded with resolved variant maps. */
export const hydrateSuccess = createAction(
  '[Variants] Hydrate Success',
  props<{
    global: Record<string, unknown>;
    features: Record<string, Record<string, unknown>>;
  }>(),
);

/** Hydration failed (effects will surface error here). */
export const hydrateFailure = createAction(
  '[Variants] Hydrate Failure',
  props<{ error: unknown }>(),
);

/** Set or override a variant value (optionally scoped to a feature). */
export const setVariant = createAction(
  '[Variants] Set Variant',
  props<{ path: string; value: unknown; featureKey?: string }>(),
);

/** Reset slice to defaults (empty maps). */
export const reset = createAction('[Variants] Reset');
