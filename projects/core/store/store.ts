import { provideEffects } from '@ngrx/effects';
import { ActionReducer, MetaReducer, provideStore } from '@ngrx/store';
import { localStorageSync } from 'ngrx-store-localstorage';

import { AppState } from '@cadai/pxs-ng-core/interfaces';

import { AppEffects } from './app.effects';
import { AppReducers } from './app.reducer';

const localStorageSyncReducer = (reducer: ActionReducer<AppState>): ActionReducer<AppState> =>
  localStorageSync({ keys: ['teamManagement'], rehydrate: true })(reducer);

export const metaReducers: MetaReducer<AppState>[] = [localStorageSyncReducer];

export const provideAppStore = () => [
  provideStore(AppReducers, {
    metaReducers,
    runtimeChecks: {
      strictActionImmutability: true,
      strictStateImmutability: true,
    },
  }),
  provideEffects(AppEffects),
];
