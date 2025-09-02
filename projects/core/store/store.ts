import { isDevMode } from '@angular/core';
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
    runtimeChecks: isDevMode() ? devRuntimeChecks : prodRuntimeChecks,
  }),
  provideEffects(AppEffects),
];

const devRuntimeChecks = {
  strictActionImmutability: true,
  strictStateImmutability: true,
  strictActionSerializability: true,
  strictStateSerializability: true,
  strictActionWithinNgZone: true,
  strictActionTypeUniqueness: true,
};

const prodRuntimeChecks = {
  strictActionImmutability: true,
  strictStateImmutability: true,
  strictActionSerializability: false,
  strictStateSerializability: false,
  strictActionWithinNgZone: false,
  strictActionTypeUniqueness: false,
};
