import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { FeatureService } from '@cadai/pxs-ng-core/services';
import { CORE_GET_USER_CTX, GetUserCtx } from '@cadai/pxs-ng-core/tokens';

/** Usage: canActivate: [featureGuard('ai.chat', { unauth: '/login', forbid: '/403' })] */
export function featureGuard(
  key: string,
  opts?: { unauth?: string; forbid?: string },
): CanActivateFn {
  return () => {
    const features = inject(FeatureService);
    const router = inject(Router);
    const getUser = inject<GetUserCtx>(CORE_GET_USER_CTX, { optional: true });
    const user = getUser ? getUser() : { isAuthenticated: false, roles: [], tenant: null };

    if (features.isEnabled(key, user)) return true;

    const f = (features as any)['cfg']?.features?.[key];
    if (f?.requireAuth && !user.isAuthenticated) return router.parseUrl(opts?.unauth ?? '/login');
    return router.parseUrl(opts?.forbid ?? '/403');
  };
}
