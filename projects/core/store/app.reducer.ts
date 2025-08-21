import { ActionReducerMap } from '@ngrx/store';

import { AppState } from '@cadai/pxs-ng-core/interfaces';

import { authReducer } from './features/auth/auth.reducer';
import { teamManagementReducer } from './features/team-management/team-management.reducer';
import { userReducer } from './features/user/user.reducer';
// Fulfill imports with new added items

// Fulfill MAP with new added items
export const AppReducers: ActionReducerMap<AppState> = {
  user: userReducer,
  teamManagement: teamManagementReducer,
  auth: authReducer,
};
