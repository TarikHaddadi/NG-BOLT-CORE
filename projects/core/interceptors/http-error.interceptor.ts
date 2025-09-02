import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { KeycloakService } from '@cadai/pxs-ng-core/services';

// Prevent multiple concurrent login redirects
let loginInProgress = false;

const isAssetsUrl = (url: string) => {
  // covers "assets/..." and "/assets/..." and query strings
  return url.startsWith('assets/') || url.startsWith('/assets/');
};

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  const router = inject(Router);
  const kc = inject(KeycloakService);

  // ✅ Always pass-through static assets and DO NOT show snackbars / redirect
  if (isAssetsUrl(req.url)) {
    return next(req).pipe(catchError((err) => throwError(() => err)));
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Friendly message
      const message =
        (err.error && (err.error.message || err.error.error_description)) ||
        err.statusText ||
        'Unexpected error. Please try again.';
      snack.open(message, 'Close', { duration: 4000 });

      // Respect explicit opt-out header
      const skipAuthRedirect =
        req.headers.has('X-Skip-Auth-Redirect') || req.headers.has('x-skip-auth-redirect');

      if (err.status === 401) {
        if (!skipAuthRedirect && !loginInProgress) {
          loginInProgress = true;
          void kc.login().finally(() => {
            loginInProgress = false;
          });
        }
        return throwError(() => err);
      }

      if (err.status === 403) {
        void router.navigate(['/403']);
        return throwError(() => err);
      }

      return throwError(() => err);
    }),
  );
};
