import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ThemeState } from '@cadai/pxs-ng-core/interfaces';

export const selectThemeState = createFeatureSelector<ThemeState>('theme');

export const selectThemeMode = createSelector(selectThemeState, (s) => s.mode);
export const selectIsDark = createSelector(selectThemeState, (s) => s.mode === 'dark');
