import { createAction, props } from '@ngrx/store';

import { ThemeMode } from '@cadai/pxs-ng-core/interfaces';

export const setTheme = createAction('[Theme] Set', props<{ mode: ThemeMode }>());
export const toggleTheme = createAction('[Theme] Toggle');
