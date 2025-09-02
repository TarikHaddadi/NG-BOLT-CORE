import { createReducer, on } from '@ngrx/store';

import { ThemeMode, ThemeState } from '@cadai/pxs-ng-core/interfaces';

import * as ThemeActions from './theme.actions';

export const initialThemeState: ThemeState = {
  mode: 'light',
} as const;

export const themeReducer = createReducer(
  initialThemeState,
  on(ThemeActions.setTheme, (s, { mode }) => ({ ...s, mode })),
  on(ThemeActions.toggleTheme, (s) => ({
    ...s,
    mode: (s.mode === 'dark' ? 'light' : 'dark') as ThemeMode,
  })),
);
