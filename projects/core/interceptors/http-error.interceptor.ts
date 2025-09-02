import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

const toAbs = (url: string) => new URL(url, document.baseURI).href;
const ASSETS_PREFIX_ABS = new URL('assets/', document.baseURI).href;

const isAssetsUrl = (url: string) => {
  if (url.startsWith('assets/') || url.startsWith('/assets/')) return true;
  return toAbs(url).startsWith(ASSETS_PREFIX_ABS); // absolute under <base href>
};

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  const router = inject(Router);
  const kc = inject(KeycloakService);
  const conf = inject(ConfigService);

  const reqAbs = toAbs(req.url);
  const kcBase = kc.instance?.authServerUrl ?? '';
  const isKeycloakUrl = kcBase && reqAbs.toLowerCase().startsWith(kcBase.toLowerCase());

  // ✅ No snackbars/redirects for static assets or KC endpoints
  if (isAssetsUrl(req.url) || isKeycloakUrl) {
    return next(req).pipe(catchError((err) => throwError(() => err)));
  }

  // Limit 403 routing (and any auth-ish behavior) to your API only
  const apiBase = conf.getAll()?.apiUrl;
  const isApiUrl = apiBase
    ? reqAbs.toLowerCase().startsWith(apiBase.toLowerCase())
    : new URL(reqAbs).origin === new URL(document.baseURI).origin;

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Let the AUTH interceptor handle 401 (prevents double login)
      if (err.status === 401) {
        return throwError(() => err);
      }

      if (err.status === 403 && isApiUrl) {
        void router.navigate(['/403']);
        return throwError(() => err);
      }

      // Generic message for other errors (non-assets/non-KC)
      const message =
        (err.error && (err.error.message || err.error.error_description)) ||
        err.statusText ||
        'Unexpected error. Please try again.';
      snack.open(message, 'Close', { duration: 4000 });

      return throwError(() => err);
    }),
  );
};
