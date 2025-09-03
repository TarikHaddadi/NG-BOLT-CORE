import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const kc = inject(KeycloakService);
  const cfg = inject(ConfigService);

  const isAsset =
    req.url.startsWith('/assets/') || req.url.startsWith('assets/') || req.url.endsWith('.json');

  const skip = isAsset || req.headers.has('X-Skip-Auth');

  const apiBase = (cfg.getAll?.() as any)?.apiUrl as string | undefined;

  const isApi = apiBase ? req.url.startsWith(apiBase) : !isAsset;

  if (skip || !isApi || !kc.isReady || !kc.isAuthenticated) {
    return next(req);
  }

  return from(kc.ensureFreshToken(60)).pipe(
    map((tok) => tok ?? kc.tokenUnsafe),
    map((token) => (token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)),
    switchMap((cloned) => next(cloned)),
  );
};
