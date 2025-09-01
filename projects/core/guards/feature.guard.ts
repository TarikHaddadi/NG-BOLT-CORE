import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { FeatureService, KeycloakService } from '@cadai/pxs-ng-core/services';
import { CORE_GET_USER_CTX, GetUserCtx } from '@cadai/pxs-ng-core/tokens';

export function featureGuard(key: string, opts?: { forbid?: string }): CanActivateFn {
  return (route, state) => {
    const features = inject(FeatureService);
    const router = inject(Router);
    const getUser = inject<GetUserCtx>(CORE_GET_USER_CTX, { optional: true });
    const kc = inject(KeycloakService, { optional: true });

    const user = getUser ? getUser() : { isAuthenticated: false, roles: [], tenant: null };

    // Feature config lookup
    const f = features?.cfg?.features?.[key];
    const needsAuth = !!f?.requireAuth;

    // Route-level roles (optional)
    const routeRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
    const hasRouteRole = routeRoles.length
      ? routeRoles.some((r) => (user.roles as string[]).includes(r))
      : true; // no roles specified → don’t block

    // FeatureService decision (treat missing feature as disabled unless your policy says otherwise)
    const featureAllows = features.isEnabled(key, user);

    // Allowed → proceed
    if (featureAllows && hasRouteRole) return true;

    // Needs auth but user not authenticated → trigger login
    if (needsAuth && !user.isAuthenticated) {
      const redirectUri =
        typeof window !== 'undefined'
          ? state.url?.startsWith('http')
            ? state.url
            : `${window.location.origin}${state.url || window.location.pathname}`
          : undefined;
      void kc?.login(redirectUri ? { redirectUri } : undefined);
      return false; // cancel navigation until SSO returns
    }

    // Otherwise → 403 or cancel
    return opts?.forbid ? router.parseUrl(opts.forbid) : false;
  };
}
