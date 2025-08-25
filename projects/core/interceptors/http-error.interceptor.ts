import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { KeycloakService } from '@cadai/pxs-ng-core/services';

// Prevent multiple concurrent login redirects
let loginInProgress = false;

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  const router = inject(Router);
  const kc = inject(KeycloakService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Friendly message
      const message =
        (err.error && (err.error.message || err.error.error_description)) ||
        err.statusText ||
        'Unexpected error. Please try again.';
      snack.open(message, 'Close', { duration: 4000 });

      // Heuristics: skip auth redirect for static assets/i18n or if caller opted out
      const isAsset = req.url.startsWith('/assets/');
      const skipAuthRedirect =
        req.headers.has('X-Skip-Auth-Redirect') || req.headers.has('x-skip-auth-redirect');

      if (err.status === 401) {
        // Let Keycloak drive the login flow (no /login route)
        if (!isAsset && !skipAuthRedirect && !loginInProgress) {
          loginInProgress = true;
          // Optionally pass a redirectUri if you want to control return (defaults to current location)
          void kc.login().finally(() => {
            loginInProgress = false;
          });
        }
        // Propagate the error to callers
        return throwError(() => err);
      }

      if (err.status === 403) {
        // Forbidden → go to /403 (or customize)
        void router.navigate(['/403']);
        return throwError(() => err);
      }

      return throwError(() => err);
    }),
  );
};
