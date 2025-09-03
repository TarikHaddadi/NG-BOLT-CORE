import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const kc = inject(KeycloakService);
  const cfg = inject(ConfigService);

  // 1) Never touch static files or explicit opt-out
  const isAsset =
    req.url.startsWith('/assets/') || req.url.startsWith('assets/') || req.url.endsWith('.json'); // keeps i18n/env safe
  const skip = isAsset || req.headers.has('X-Skip-Auth');

  // 2) Optionally, restrict to your API base (recommended)
  const apiBase = cfg.getAll().apiUrl; // adapt to your config accessor
  const isApi = apiBase ? req.url.startsWith(apiBase) : !isAsset;

  if (skip || !isApi || !kc.isReady || !kc.isAuthenticated) {
    return next(req);
  }

  // 3) Refresh token just-in-time, then attach if we have it
  return from(kc.ensureFreshToken(60)).pipe(
    map((tok) => tok ?? kc.tokenUnsafe),
    map((token) => (token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)),
    switchMap((cloned) => next(cloned)),
  );
};
