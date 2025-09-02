import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { filter, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';

import { Lang } from '@cadai/pxs-ng-core/interfaces';

import { AppActions } from '../../app.actions';
import { AppSelectors } from '../../app.selectors';

const norm = (l?: string | null) => (l || 'en').toLowerCase().split('-')[0] as 'en' | 'fr';

/** 1) On app start: read lang from store once and activate it */
export const initLangFromStoreOnce = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const translate = inject(TranslateService);

    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      switchMap(() =>
        store.select(AppSelectors.LangSelectors.selectLang).pipe(
          filter((l): l is Lang => !!l), // wait until rehydrated
          take(1),
          switchMap((l) =>
            translate.use(norm(l)).pipe(
              take(1),
              tap(() => document.documentElement.setAttribute('lang', norm(l))),
            ),
          ),
        ),
      ),
    );
  },
  { functional: true, dispatch: false },
);

export const applyLangOnChange = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const translate = inject(TranslateService);

    return actions$.pipe(
      ofType(AppActions.LangActions.setLang, AppActions.LangActions.toggleLang),
      withLatestFrom(store.select(AppSelectors.LangSelectors.selectLang)),
      switchMap(([, lang]) => {
        const L = norm(lang);
        // use() returns an Observable that completes when the file is loaded
        return translate.use(L).pipe(
          take(1),
          tap(() => document.documentElement.setAttribute('lang', L)),
        );
      }),
    );
  },
  { functional: true, dispatch: false },
);
