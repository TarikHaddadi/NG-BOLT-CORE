import { Injectable, signal } from '@angular/core';

import { AppFeature, RuntimeConfig, UserCtx } from '@cadai/pxs-ng-core/interfaces';

import { ConfigService } from './config.service';

export interface FeatureNavItem {
  key: string;
  label: string;
  icon?: string;
  route?: string;
}

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private cfg!: RuntimeConfig;
  private userSig = signal<UserCtx | null>(null);

  constructor(private readonly config: ConfigService) {
    // Expect ConfigService to expose .all(): RuntimeConfig (as in your docs).
    // If your API differs, replace the next line with your accessor.
    this.cfg = this.config.getAll() as RuntimeConfig;
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

  /** Get a variant value (globally or within a specific feature). */
  variant<T = unknown>(path: string, fallback?: T, featureKey?: string): T | undefined {
    const pick = (f?: AppFeature) =>
      f?.variants && Object.prototype.hasOwnProperty.call(f.variants, path)
        ? (f.variants[path] as T)
        : undefined;

    if (featureKey) return pick(this.cfg.features?.[featureKey]) ?? fallback;

    for (const f of Object.values(this.cfg.features ?? {})) {
      const v = pick(f);
      if (v !== undefined) return v;
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
