import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { CoreOptions } from '@cadai/pxs-ng-core/interfaces';
import { KeycloakService } from '@cadai/pxs-ng-core/services';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const kc = inject(KeycloakService);
  const { environments } = inject(CORE_OPTIONS) as Required<CoreOptions>;

  const isAsset =
    req.url.startsWith('/assets/') || req.url.startsWith('assets/') || req.url.endsWith('.json');

  const skip = isAsset || req.headers.has('X-Skip-Auth');

  const apiBase = environments.apiUrl;

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
