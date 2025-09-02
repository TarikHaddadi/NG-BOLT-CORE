import { createFeatureSelector, createSelector } from '@ngrx/store';

import { LangState } from '@cadai/pxs-ng-core/interfaces';

export const selectLangState = createFeatureSelector<LangState>('lang');

export const selectLang = createSelector(selectLangState, (s) => s.lang);
