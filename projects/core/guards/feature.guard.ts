import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { RuntimeConfig } from '@cadai/pxs-ng-core/interfaces';
import { ConfigService, FeatureService, KeycloakService } from '@cadai/pxs-ng-core/services';
import { CORE_GET_USER_CTX, GetUserCtx } from '@cadai/pxs-ng-core/tokens';

export function featureGuard(key: string, opts?: { forbid?: string }): CanActivateFn {
  return (route, state) => {
    const config = inject(ConfigService);
    const hasKeycloak = !!(config.getAll() as RuntimeConfig).auth?.hasKeycloak;

    if (!hasKeycloak) return true; // ✅ allow all features/routes when KC is off

    const features = inject(FeatureService);
    const router = inject(Router);
    const getUser = inject<GetUserCtx>(CORE_GET_USER_CTX, { optional: true });
    const kc = inject(KeycloakService, { optional: true });

    const user = getUser ? getUser() : { isAuthenticated: false, roles: [], tenant: null };

    const f = features?.cfg?.features?.[key];
    const needsAuth = !!f?.requireAuth;

    const routeRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
    const hasRouteRole = routeRoles.length
      ? routeRoles.some((r) => (user.roles as string[]).includes(r))
      : true;

    const featureAllows = features.isEnabled(key, user);

    if (featureAllows && hasRouteRole) return true;

    if (needsAuth && !user.isAuthenticated && kc?.isReady) {
      const redirectUri =
        typeof window !== 'undefined'
          ? state.url?.startsWith('http')
            ? state.url
            : `${window.location.origin}${state.url || window.location.pathname}`
          : undefined;
      void kc.login(redirectUri ? { redirectUri } : undefined);
      return false;
    }

    return opts?.forbid ? router.parseUrl(opts.forbid) : false;
  };
}
