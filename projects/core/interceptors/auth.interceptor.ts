import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

function isAbsoluteHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function toAbsolute(url: string): string {
  return isAbsoluteHttp(url) ? url : new URL(url, window.location.origin).href;
}

function isPublicUrl(url: string): boolean {
  const abs = toAbsolute(url);
  // match /assets/* (same-origin) and any “…/public/…” paths
  return abs.startsWith(new URL('/assets/', window.location.origin).href)
    || /\/public(\/|$)/i.test(abs);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const kc = inject(KeycloakService);
  const conf = inject(ConfigService);

  // 1) Skip preflight
  if (req.method === 'OPTIONS') {
    return next(req);
  }

  // 2) Skip public & Keycloak endpoints
  const reqAbs = toAbsolute(req.url);
  const kcBase = kc.instance?.authServerUrl ?? ''; // assume your KeycloakService#instance() returns the KC instance
  const isKeycloakUrl = kcBase && reqAbs.toLowerCase().startsWith(kcBase.toLowerCase());

  if (isPublicUrl(req.url) || isKeycloakUrl) {
    return next(req);
  }

  // 3) API origin check (used to decide if we force login on 401)
  const apiBase = conf.getAll()?.apiUrl;
  const isApiUrl = apiBase
    ? reqAbs.toLowerCase().startsWith(apiBase.toLowerCase())
    : new URL(reqAbs).origin === window.location.origin;

  // 4) Ensure token is fresh then attach
  return from(kc.ensureFreshToken(60)).pipe(
    switchMap(token => {
      const authReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(authReq);
    }),
    catchError(err => {
      // Only force login on *API* 401s; avoid loops on KC/CORS/etc.
      if (isApiUrl && (err?.status === 401 || err?.status === 403)) {
        // fire and forget; keep error flowing to caller
        kc.login({ redirectUri: window.location.href });
      }
      return throwError(() => err);
    })
  );
};
