import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

const toAbs = (url: string) => new URL(url, document.baseURI).href;
const ASSETS_PREFIX = new URL('./assets/', document.baseURI).href;

const isAssetsUrl = (url: string) => {
  const abs = toAbs(url);
  // match ".../assets/..." under current base href, keep it simple & robust
  return abs.startsWith(ASSETS_PREFIX);
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const kc = inject(KeycloakService);
  const conf = inject(ConfigService);

  if (req.method === 'OPTIONS') return next(req);

  // ✅ skip static assets and Keycloak endpoints entirely
  const reqAbs = toAbs(req.url);
  const kcBase = kc.instance?.authServerUrl ?? '';
  const isKeycloakUrl = kcBase && reqAbs.toLowerCase().startsWith(kcBase.toLowerCase());

  if (isAssetsUrl(req.url) || isKeycloakUrl) {
    return next(req);
  }

  // API origin check (handles sub-paths too)
  const apiBase = conf.getAll()?.apiUrl;
  const isApiUrl = apiBase
    ? reqAbs.toLowerCase().startsWith(apiBase.toLowerCase())
    : new URL(reqAbs).origin === new URL(document.baseURI).origin;

  return from(kc.ensureFreshToken(60)).pipe(
    switchMap((token) => {
      const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
      return next(authReq);
    }),
    catchError((err) => {
      if (isApiUrl && (err?.status === 401 || err?.status === 403)) {
        void kc.login({ redirectUri: window.location.href });
      }
      return throwError(() => err);
    }),
  );
};
