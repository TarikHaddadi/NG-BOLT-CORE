import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { FeatureService } from '@cadai/pxs-ng-core/services';
import { KeycloakService } from '@cadai/pxs-ng-core/services';
import { CORE_GET_USER_CTX, GetUserCtx } from '@cadai/pxs-ng-core/tokens';

export function featureGuard(key: string, opts?: { forbid?: string }): CanActivateFn {
  return () => {
    const features = inject(FeatureService);
    const router = inject(Router);
    const getUser = inject<GetUserCtx>(CORE_GET_USER_CTX, { optional: true });
    const kc = inject(KeycloakService, { optional: true });

    const user = getUser ? getUser() : { isAuthenticated: false, roles: [], tenant: null };

    // Allowed → proceed
    if (features.isEnabled(key, user)) return true;

    // Lookup feature to see if auth is required
    const f = (features as any)['cfg']?.features?.[key];
    const needsAuth = !!f?.requireAuth;

    // Unauthenticated + needs auth → let Keycloak handle login
    if (needsAuth && !user.isAuthenticated) {
      // Use current URL as the post-login redirect
      const redirectUri = typeof window !== 'undefined' ? window.location.href : undefined;
      // Fire and forget; guard cancels navigation
      void kc?.login(redirectUri ? { redirectUri } : undefined);
      return false; // cancel current navigation until SSO returns
    }

    // Authenticated but not allowed (roles/tenant/enabled mismatch)
    // Redirect to a forbid route if provided, else just cancel navigation
    return opts?.forbid ? router.parseUrl(opts.forbid) : false;
  };
}
