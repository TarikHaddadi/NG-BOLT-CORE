import { createReducer, on } from '@ngrx/store';

import { initialAuthState } from '@cadai/pxs-ng-core/interfaces';

import * as AuthActions from './auth.actions';

export const authReducer = createReducer(
  initialAuthState,
  on(AuthActions.loginSuccess, (s, a) => ({
    ...s,
    isAuthenticated: true,
    profile: a.profile,
    expiresAt: a.expiresAt,
  })),
  on(AuthActions.tokenRefreshed, (s, a) => ({
    ...s,
    expiresAt: a.expiresAt,
  })),
  on(AuthActions.logout, () => initialAuthState),
);
