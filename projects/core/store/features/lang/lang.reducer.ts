import { createReducer, on } from '@ngrx/store';

import { Lang, LangState } from '@cadai/pxs-ng-core/interfaces';

import * as ThemeActions from './lang.actions';

export const initialLangState: LangState = {
  lang: 'English',
} as const;

export const langReducer = createReducer(
  initialLangState,
  on(ThemeActions.setLang, (s, { lang }) => ({ ...s, lang })),
  on(ThemeActions.toggleLang, (s) => ({
    ...s,
    lang: (s.lang === 'Français' ? 'English' : 'Français') as Lang,
  })),
);
