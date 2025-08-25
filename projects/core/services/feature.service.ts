import { inject, Injectable, signal } from '@angular/core';
import { Store } from '@ngrx/store';

import {
  AppFeature,
  FeatureNavItem,
  RuntimeConfig,
  UserCtx,
  VariantsState,
} from '@cadai/pxs-ng-core/interfaces';

import { ConfigService } from './config.service';

export const VARIANTS_SLICE_KEY = 'variants' as const;
const selectVariantsUnsafe = (root: unknown): VariantsState =>
  ((root as any)?.[VARIANTS_SLICE_KEY] as VariantsState) ?? { global: {}, features: {} };

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private cfg?: RuntimeConfig; // ← may be undefined until config is loaded
  private readonly store = inject(Store, { optional: true });

  private variantCache: VariantsState = { global: {}, features: {} };
  private userSig = signal<UserCtx | null>(null);

  constructor(private readonly config: ConfigService) {
    // Try to grab whatever is available now (may be undefined before loadConfig)
    this.cfg = (this.config.getAll?.() as RuntimeConfig | undefined) ?? undefined;

    if (this.store) {
      this.store.select(selectVariantsUnsafe).subscribe((s) => (this.variantCache = s));
    } else {
      // No store: seed lazily from cfgSafe (empty until config is available)
      this.reseedFromConfig();
    }
  }

  /** Call this after ConfigService.loadConfig() if you don’t use the store. */
  reseedFromConfig(): void {
    const features: Record<string, Record<string, unknown>> = {};
    const cfg = this.cfgSafe(); // guarantees an object with features:{}
    Object.entries(cfg.features ?? {}).forEach(([k, f]) => {
      if (f?.variants && typeof f.variants === 'object') {
        features[k] = f.variants as Record<string, unknown>;
      }
    });
    // Only seed if there is no store keeping this up to date
    if (!this.store) this.variantCache = { global: {}, features };
  }

  /** Optional: set a global user context once (e.g., after KC init). */
  setUser(user: UserCtx | null) {
    this.userSig.set(user);
  }

  isEnabled(key: string, user?: UserCtx): boolean {
    const f = this.cfgSafe().features?.[key];
    if (!f) return false;
    return this.passes(f, user ?? this.userSig() ?? undefined);
  }

  visibleFeatures(user?: UserCtx): FeatureNavItem[] {
    const u = user ?? this.userSig() ?? undefined;
    const out: FeatureNavItem[] = [];
    const feats = this.cfgSafe().features ?? {};
    for (const [key, f] of Object.entries(feats)) {
      if (!this.passes(f as AppFeature, u)) continue;
      const af = f as AppFeature;
      if (!af.label) continue;
      out.push({ key, label: af.label, icon: af.icon, route: af.route });
    }
    return out;
  }

  /**
   * Get a variant value (global or feature-scoped).
   * Resolution order:
   *  1) featureKey scope → variants[path]
   *  2) global variants[path]
   *  3) first feature that defines variants[path]
   *  4) fallback
   */
  variant<T = unknown>(path: string, fallback?: T, featureKey?: string): T | undefined {
    const fromFeature = (fk?: string) =>
      fk ? (this.variantCache.features[fk]?.[path] as T | undefined) : undefined;

    if (featureKey) {
      const hit = fromFeature(featureKey);
      if (hit !== undefined) return hit;
      return fallback;
    }

    const globalHit = this.variantCache.global[path];
    if (globalHit !== undefined) return globalHit as T;

    for (const rec of Object.values(this.variantCache.features)) {
      const v = rec?.[path];
      if (v !== undefined) return v as T;
    }

    // As last resort, peek config (covers no-store + early phase)
    const feats = this.cfgSafe().features ?? {};
    for (const f of Object.values(feats)) {
      const v = (f as AppFeature)?.variants?.[path];
      if (v !== undefined) return v as T;
    }

    return fallback;
  }

  list(): string[] {
    return Object.keys(this.cfgSafe().features ?? {});
  }

  // ---- internals

  /** Always returns a safe config object with at least `features: {}`. */
  private cfgSafe(): RuntimeConfig & { features: Record<string, AppFeature> } {
    if (!this.cfg) {
      this.cfg = ((this.config.getAll?.() as RuntimeConfig | undefined) ?? {
        // minimal shape so consumers don’t explode
        name: 'unknown',
        production: false,
        apiUrl: '',
        version: '0.0.0',
        auth: {} as any,
        features: {},
      }) as RuntimeConfig;
    }
    // Ensure features bag exists
    if (!this.cfg.features) (this.cfg as any).features = {};
    return this.cfg as RuntimeConfig & { features: Record<string, AppFeature> };
  }

  private passes(f: AppFeature, user?: UserCtx): boolean {
    if (!f.enabled) return false;
    if (f.requireAuth && !user?.isAuthenticated) return false;

    if (f.roles?.length) {
      const ok = !!user?.roles?.some((r) => f.roles!.includes(r));
      if (!ok) return false;
    }

    const tenants = f.allow?.tenants;
    if (tenants?.length) {
      const ok = !!user?.tenant && tenants.includes(user.tenant);
      if (!ok) return false;
    }
    return true;
  }
}
