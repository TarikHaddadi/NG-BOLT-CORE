import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Show a concise message
      const message = err.error?.message ?? err.statusText ?? 'Unexpected error. Please try again.';

      snack.open(message, 'Close', { duration: 4000 });

      // Example handling

      if (err.status === 401) {
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      } else if (err.status === 403) {
        void router.navigate(['/forbidden']);
      }

      return throwError(() => err);
    }),
  );
};
