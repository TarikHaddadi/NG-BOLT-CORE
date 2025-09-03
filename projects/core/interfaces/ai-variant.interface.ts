import { SerializedError } from './app.model';

export type VariantValue = string | string[] | Record<string, unknown> | undefined;

export interface VariantsState {
  /** Per-feature variants */
  features: Record<string, Record<string, VariantValue>>;
  modelsByProvider: Record<string, Record<string, string[]>>;
  error: SerializedError | null;
}
