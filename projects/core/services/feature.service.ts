import { computed, Inject, Injectable, signal } from '@angular/core';

import {
  AppFeature,
  CoreOptions,
  FeatureNavItem,
  UserCtx,
  VariantValue,
} from '@cadai/pxs-ng-core/interfaces';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

const META_MODELS_BY_PROVIDER = '__ai.modelsByProvider';

@Injectable({ providedIn: 'root' })
export class FeatureService {
  constructor(@Inject(CORE_OPTIONS) private readonly coreOpts: Required<CoreOptions>) {
    // if config is already present, normalize variants now
    this.reseedFromConfig();
  }

  private userSig = signal<UserCtx | null>(null);

  // keep normalized variants locally if there’s no store
  private variantsSig = signal<Record<string, VariantValue>>({});

  // expose a reactive list of visible features
  public readonly visibleFeaturesSig = computed<FeatureNavItem[]>(() => {
    const u = this.userSig() ?? undefined;
    const feats = this.coreOpts.environments.features ?? {};
    const out: FeatureNavItem[] = [];
    for (const [key, f] of Object.entries(feats)) {
      if (!this.passes(f as AppFeature, u)) continue;
      const af = f as AppFeature;
      if (!af.label) continue;
      out.push({ key, label: af.label, icon: af.icon, route: af.route });
    }
    return out;
  });

  private get hasKeycloak(): boolean {
    return !!this.coreOpts.environments.auth.hasKeycloak;
  }

  reseedFromConfig(): void {
    // no NgRx available: compute locally so the app still works
    const local: Record<string, Record<string, VariantValue>> = {};
    for (const [featureKey, feat] of Object.entries(this.coreOpts.environments.features ?? {})) {
      const vmap = normalizeFeatureVariants((feat as any)?.variants);
      if (Object.keys(vmap).length) local[featureKey] = vmap;
    }
    this.variantsSig.set(local as unknown as Record<string, VariantValue>);
  }

  /** Read normalized variants (works with or without NgRx). */
  getLocalVariants(): Record<string, VariantValue> {
    return this.variantsSig();
  }

  setUser(user: UserCtx | null) {
    this.userSig.set(user);
  }

  isEnabled(key: string, user?: UserCtx): boolean {
    const f = this.coreOpts.environments.features[key];
    if (!f) return false;
    return this.passes(f, user ?? this.userSig() ?? undefined);
  }

  // keep your existing list() if you need it
  list(): string[] {
    return Object.keys(this.coreOpts.environments.features ?? {});
  }

  // ---- internals (unchanged except for tiny safety)
  private passes(f: AppFeature, user?: UserCtx): boolean {
    const why: string[] = [];
    if (!this.hasKeycloak) return true;

    if (!f.enabled) {
      why.push('disabled');
      return false;
    }
    if (f.requireAuth && !user?.isAuthenticated) {
      why.push('auth');
      return false;
    }

    if (f.roles?.length) {
      const need = new Set(f.roles.map((r) => (r.startsWith('ROLE_') ? r : `ROLE_${r}`)));
      const have = (user?.roles ?? []).map((r) => (r.startsWith('ROLE_') ? r : `ROLE_${r}`));
      if (!have.some((r) => need.has(r))) {
        why.push('roles');
        return false;
      }
    }

    const tenants = f.allow?.tenants;
    if (tenants?.length) {
      if (!user?.tenant) {
        /* allow by policy */
      } else if (!tenants.includes(user.tenant)) {
        why.push('tenant');
        return false;
      }
    }

    if (why.length) console.warn('[feature blocked]', f, { user, why });
    return true;
  }
}

type VariantGroup = Record<string, string | string[]>;
// … keep your normalizeFeatureVariants, but hoist the meta key constant:
function normalizeFeatureVariants(v: unknown): Record<string, VariantValue> {
  if (!v) return {};
  if (Array.isArray(v)) {
    const out: Record<string, string[]> = {};
    const modelsByProvider: Record<string, string[]> = {};
    const add = (k: string, vals: string[]) =>
      (out[k] = Array.from(new Set([...(out[k] ?? []), ...vals])));

    for (const group of v as VariantGroup[]) {
      for (const [k, raw] of Object.entries(group)) {
        const vals = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
        add(k, vals);
        if (k === 'ai.model') {
          const provider = typeof group['ai.provider'] === 'string' ? group['ai.provider'] : '';
          if (provider) {
            modelsByProvider[provider] = Array.from(
              new Set([...(modelsByProvider[provider] ?? []), ...vals]),
            );
          }
        }
      }
    }
    return { ...out, [META_MODELS_BY_PROVIDER]: modelsByProvider } as Record<string, VariantValue>;
  }
  if (v && typeof v === 'object') return v as Record<string, VariantValue>;
  return {};
}
