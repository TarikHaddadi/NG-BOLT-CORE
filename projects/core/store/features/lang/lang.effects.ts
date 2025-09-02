import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { map, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';

import { Lang } from '@cadai/pxs-ng-core/interfaces';

import { AppActions } from '../../app.actions';
import { AppSelectors } from '../../app.selectors';

const norm = (l?: Lang | null) => (l || 'en').toLowerCase() as Lang;

/** 1) On app start: read lang from store once and activate it */
export const bootstrapLang = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const translate = inject(TranslateService);

    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      switchMap(() => store.select(AppSelectors.LangSelectors.selectLang).pipe(take(1))),
      switchMap((lang) => {
        const L = norm(lang);

        return translate.use(L).pipe(
          take(1),
          map(() => {
            document.documentElement.setAttribute('lang', L);
            // If store was null, seed it now.
            return lang ? { type: '[Lang] noop' } : AppActions.LangActions.setLang({ lang: L });
          }),
        );
      }),
    );
  },
  { functional: true },
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
