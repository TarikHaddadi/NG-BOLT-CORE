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

// Local, zero-dependency selector to avoid importing from the store barrel
const selectVariantsUnsafe = (root: unknown): VariantsState => {
  const v = (root as any)?.['variants'];
  return v ?? { global: {}, features: {} };
};

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private cfg!: RuntimeConfig;

  // Optional NgRx store (service still works without it)
  private readonly store = inject(Store, { optional: true });

  // Cache variants so `variant()` stays sync & fast
  private variantCache: VariantsState = { global: {}, features: {} };

  private userSig = signal<UserCtx | null>(null);

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.getAll() as RuntimeConfig;

    if (this.store) {
      // Keep cache in sync with the store slice
      this.store.select(selectVariantsUnsafe).subscribe((s) => (this.variantCache = s));
    } else {
      // No store: seed cache from RuntimeConfig once
      const features: Record<string, Record<string, unknown>> = {};
      Object.entries(this.cfg.features ?? {}).forEach(([k, f]) => {
        if (f?.variants && typeof f.variants === 'object') {
          features[k] = f.variants as Record<string, unknown>;
        }
      });
      this.variantCache = { global: {}, features };
    }
  }

  /** Optional: set a global user context once (e.g., after KC init). */
  setUser(user: UserCtx | null) {
    this.userSig.set(user);
  }

  isEnabled(key: string, user?: UserCtx): boolean {
    const f = this.cfg.features?.[key];
    if (!f) return false;
    return this.passes(f, user ?? this.userSig() ?? undefined);
  }

  visibleFeatures(user?: UserCtx): FeatureNavItem[] {
    const u = user ?? this.userSig() ?? undefined;
    const out: FeatureNavItem[] = [];
    for (const [key, f] of Object.entries(this.cfg.features ?? {})) {
      if (!this.passes(f, u)) continue;
      if (!f.label) continue;
      out.push({ key, label: f.label, icon: f.icon, route: f.route });
    }
    return out;
  }

  /**
   * Get a variant value (global or feature-scoped).
   * Resolution order (no store vs store is the same):
   *  1) If featureKey given → that feature’s variants[path]
   *  2) Global variants[path]
   *  3) First feature that defines variants[path]
   *  4) fallback
   */
  variant<T = unknown>(path: string, fallback?: T, featureKey?: string): T | undefined {
    // Prefer reading from the cache (NgRx if present, else seeded from config)
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

    return fallback;
  }

  list(): string[] {
    return Object.keys(this.cfg.features ?? {});
  }

  // ---- rules
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
