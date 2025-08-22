import { inject, Injectable } from '@angular/core';
import Keycloak, {
  KeycloakConfig,
  KeycloakInitOptions,
  KeycloakLoginOptions,
  KeycloakLogoutOptions,
  KeycloakTokenParsed,
} from 'keycloak-js';
import { BehaviorSubject, interval, Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthRuntimeConfig } from '@cadai/pxs-ng-core/interfaces';

import { ConfigService } from './public-api';

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private kc!: Keycloak;
  private ready$ = new BehaviorSubject<boolean>(false);
  private auth$ = new BehaviorSubject<boolean>(false);
  private refreshSub?: Subscription;
  private initPromise?: Promise<void>; // ← idempotent init

  private config = inject(ConfigService);

  /** Call once at app start (provideCore initializer). Safe if called again. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const cfgAll = this.config.getAll?.();
      if (!cfgAll?.auth) throw new Error('[KeycloakService] Missing auth config');
      const cfg: AuthRuntimeConfig = cfgAll.auth;

      const kcConfig: KeycloakConfig = {
        url: cfg.url,
        realm: cfg.realm,
        clientId: cfg.clientId,
      };

      this.kc = new Keycloak(kcConfig);

      const initOpts: KeycloakInitOptions = {
        onLoad: cfg.init?.onLoad ?? 'login-required',
        checkLoginIframe: false,
        pkceMethod: cfg.init?.pkceMethod ?? 'S256',
        // silentCheckSsoRedirectUri: ...
      };

      await this.kc.init(initOpts);

      // Keep local state in sync
      this.auth$.next(!!this.kc.authenticated);
      this.kc.onAuthSuccess = () => this.auth$.next(true);
      this.kc.onAuthLogout = () => this.auth$.next(false);
      this.kc.onTokenExpired = () => {
        // try to refresh just-in-time; if it fails, re-login
        void this.kc.updateToken(30).catch(() => this.kc.login());
      };

      // background refresh (no iframe)
      this.refreshSub?.unsubscribe();
      this.refreshSub = interval(20_000).subscribe(async () => {
        if (!this.kc?.authenticated) return;
        try {
          await this.kc.updateToken(60);
        } catch (e) {
          console.warn('[Keycloak] token refresh failed; will not auto-login', e);
          this.auth$.next(false); // let guard/interceptor decide later
        }
      });

      this.ready$.next(true);
    })();

    return this.initPromise;
  }

  /** Emits when Keycloak is fully initialized */
  whenReady(): Observable<boolean> {
    return this.ready$.asObservable().pipe(filter(Boolean));
  }

  /** Current token (string or null) */
  get token(): string | null {
    this.assertReady('token');
    return this.kc?.token ?? null;
  }

  /** Quick boolean getter */
  get isAuthenticated(): boolean {
    return !!this.kc?.authenticated;
  }

  /** Authenticated state stream */
  isAuthenticated$(): Observable<boolean> {
    return this.auth$.asObservable();
  }

  /** Helpers you can inject/use anywhere */
  login(options?: KeycloakLoginOptions): Promise<void> {
    this.assertReady('login');
    return this.kc.login(options);
  }

  logout(opts?: string | KeycloakLogoutOptions): Promise<void> {
    this.assertReady('logout');
    if (typeof opts === 'string') return this.kc.logout({ redirectUri: opts });
    return this.kc.logout(opts);
  }

  account(): Promise<void> {
    this.assertReady('account');
    return this.kc.accountManagement();
  }

  async ensureFreshToken(minSeconds = 60): Promise<string | null> {
    if (!this.kc?.authenticated) return null;
    try {
      await this.kc.updateToken(minSeconds);
      return this.kc.token ?? null;
    } catch {
      return null; // let caller decide (no redirect here)
    }
  }

  /** Expose the raw instance if needed */
  get instance(): Keycloak {
    this.assertReady('instance');
    return this.kc;
  }

  // ———————————————————————————
  // Utilities
  private assertReady(method: string) {
    if (!this.kc) {
      throw new Error(`[KeycloakService.${method}] Service not initialized yet`);
    }
  }

  /** Parsed JWT payload (or null if not available). */
  get tokenParsed(): KeycloakTokenParsed | null {
    this.assertReady('tokenParsed');
    return this.kc?.tokenParsed ?? null;
  }

  /** Realm roles from token (`realm_access.roles`). */
  getRealmRoles(): string[] {
    return (this.tokenParsed as any)?.realm_access?.roles ?? [];
  }

  /**
   * Client roles from token (`resource_access[clientId].roles`).
   * If `clientId` is omitted, returns a flat list of all client roles.
   */
  getClientRoles(clientId?: string): string[] {
    const ra = (this.tokenParsed as any)?.resource_access ?? {};
    if (!ra) return [];
    if (clientId) return ra[clientId]?.roles ?? [];
    // flatten all client roles
    return Object.values(ra).flatMap((v: any) => v?.roles ?? []);
  }

  /** Union of realm + all client roles (deduped). */
  getAllRoles(): string[] {
    const all = [...this.getRealmRoles(), ...this.getClientRoles()];
    return Array.from(new Set(all));
  }

  /** Tenant claim (defaults to 'tenant'; change claimName if your mapper differs). */
  getTenant(claimName: string = 'tenant'): string | null {
    const tp = this.tokenParsed as any;
    const t = tp?.[claimName];
    return typeof t === 'string' && t.length ? t : null;
  }

  /** Convenient snapshot for feature system / guards. */
  getUserCtx(): { isAuthenticated: boolean; roles: string[]; tenant: string | null } {
    return {
      isAuthenticated: this.isAuthenticated,
      roles: this.getAllRoles(),
      tenant: this.getTenant(),
    };
  }
}
