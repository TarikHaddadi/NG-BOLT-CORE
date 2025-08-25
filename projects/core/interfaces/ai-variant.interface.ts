export type VariantRecord = Record<string, unknown>;

export interface VariantsState {
  /** Global variants (keep empty unless you introduce a top-level variants bag) */
  global: VariantRecord;
  /** Per-feature variants */
  features: Record<string, VariantRecord>;
}
