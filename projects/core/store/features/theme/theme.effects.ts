import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { select } from '@ngrx/store';
import { map, withLatestFrom } from 'rxjs/operators';

import { ThemeService } from '@cadai/pxs-ng-core/services';

import * as ThemeActions from './theme.actions';
import * as ThemeSelectors from './theme.selectors';

export const applyThemeOnChange = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const theme = inject(ThemeService);

    // When app starts, or when theme changes, apply to DOM
    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT, ThemeActions.setTheme, ThemeActions.toggleTheme),
      withLatestFrom(store.pipe(select(ThemeSelectors.selectThemeMode))),
      map(([, mode]) => {
        theme.apply(mode === 'dark');
      }),
    );
  },
  { functional: true, dispatch: false },
);
