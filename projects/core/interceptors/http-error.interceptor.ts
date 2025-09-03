import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ConfigService } from '@cadai/pxs-ng-core/services';

const toAbs = (url: string) => new URL(url, document.baseURI).href;
const ASSETS_PREFIX_ABS = new URL('assets/', document.baseURI).href;

const isAssetsUrl = (url: string) => {
  if (url.startsWith('assets/') || url.startsWith('/assets/')) return true;
  return toAbs(url).startsWith(ASSETS_PREFIX_ABS);
};

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  const router = inject(Router);
  const conf = inject(ConfigService);

  // 1) Assets: never handle/snackbar/redirect
  if (isAssetsUrl(req.url)) {
    return next(req).pipe(catchError((err) => throwError(() => err)));
  }

  // 2) Keycloak endpoints: detect via config (no kc.instance!)
  const reqAbs = toAbs(req.url);
  const kcBase = conf.getAll()?.auth?.url; // e.g. https://auth.example.com
  const isKeycloakUrl = !!kcBase && reqAbs.toLowerCase().startsWith(kcBase.toLowerCase());
  if (isKeycloakUrl) {
    return next(req).pipe(catchError((err) => throwError(() => err)));
  }

  // 3) Your API origin/base
  const apiBase = conf.getAll()?.apiUrl;
  const isApiUrl = apiBase
    ? reqAbs.toLowerCase().startsWith(apiBase.toLowerCase())
    : new URL(reqAbs).origin === new URL(document.baseURI).origin;

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Let auth interceptor / guards decide (don’t double-handle)
        return throwError(() => err);
      }

      if (err.status === 403 && isApiUrl) {
        void router.navigate(['/403']);
        return throwError(() => err);
      }

      const message =
        (err.error && (err.error.message || err.error.error_description)) ||
        err.statusText ||
        'Unexpected error. Please try again.';
      snack.open(message, 'Close', { duration: 4000 });

      return throwError(() => err);
    }),
  );
};
