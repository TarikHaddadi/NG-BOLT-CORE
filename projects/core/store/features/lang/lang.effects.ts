import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { switchMap, take, tap, withLatestFrom } from 'rxjs/operators';

import { AppActions } from '../../app.actions';
import { AppSelectors } from '../../app.selectors';
export const applyLangOnChange = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const translate = inject(TranslateService);

    const norm = (l?: string | null) => (l || 'en').toLowerCase().split('-')[0] as 'en' | 'fr';

    // One-time base setup
    translate.addLangs(['fr', 'en']);
    translate.setFallbackLang('en');

    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT, AppActions.LangActions.setLang, AppActions.LangActions.toggleLang),
      withLatestFrom(store.select(AppSelectors.LangSelectors.selectLang)),
      // Preload the file, then switch to it: prevents “keys” flashes
      // and avoids races with OnPush.
      // If you prefer Rx, keep it as below; otherwise you can await inside tap with lastValueFrom.
      switchMap(([, lang]) => {
        const L = norm(lang);
        return translate.use(L).pipe(
          take(1),
          tap(() => {
            document.documentElement.setAttribute('lang', L);
          }),
        );
      }),
    );
  },
  { functional: true, dispatch: false },
);
