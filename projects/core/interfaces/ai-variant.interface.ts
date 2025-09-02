export type VariantValue = string | string[] | Record<string, unknown> | undefined;

export interface VariantsState {
  /** Per-feature variants */
  features: Record<string, Record<string, VariantValue>>;
}
