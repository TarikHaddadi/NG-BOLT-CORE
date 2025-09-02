export type VariantValue = string | string[] | Record<string, unknown> | undefined;

export interface VariantsState {
  /** Global variants (keep empty unless you introduce a top-level variants bag) */
  global: Record<string, VariantValue>;
  /** Per-feature variants */
  features: Record<string, Record<string, VariantValue>>;
}
