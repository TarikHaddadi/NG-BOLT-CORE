import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

const toAbs = (url: string) => new URL(url, document.baseURI).href;
// base-href aware absolute prefix for /assets/
const ASSETS_PREFIX_ABS = new URL('assets/', document.baseURI).href;

const isAssetsUrl = (url: string) => {
  // covers relative and root-relative quickly
  if (url.startsWith('assets/') || url.startsWith('/assets/')) return true;
  // also cover absolute under current base-href
  const abs = toAbs(url);
  return abs.startsWith(ASSETS_PREFIX_ABS);
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const kc = inject(KeycloakService);
  const conf = inject(ConfigService);

  if (req.method === 'OPTIONS') return next(req);

  const reqAbs = toAbs(req.url);
  const kcBase = kc.instance?.authServerUrl ?? '';
  const isKeycloakUrl = kcBase && reqAbs.toLowerCase().startsWith(kcBase.toLowerCase());

  // ✅ never touch static assets or KC endpoints
  if (isAssetsUrl(req.url) || isKeycloakUrl) {
    return next(req);
  }

  // limit auth header + 401 handling to your API only
  const apiBase = conf.getAll()?.apiUrl;
  const isApiUrl = apiBase
    ? reqAbs.toLowerCase().startsWith(apiBase.toLowerCase())
    : new URL(reqAbs).origin === new URL(document.baseURI).origin; // fallback: same-origin

  return from(kc.ensureFreshToken(60)).pipe(
    switchMap((token) => {
      // attach header only for API requests
      const authReq =
        isApiUrl && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
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
