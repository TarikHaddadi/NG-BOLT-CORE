import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { tap, withLatestFrom } from 'rxjs/operators';

import { AppActions } from '../../app.actions';
import { AppSelectors } from '../../app.selectors';

export const applyLangOnChange = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const translate = inject(TranslateService);

    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT, AppActions.LangActions.setLang),
      withLatestFrom(store.select(AppSelectors.LangSelectors.selectLang)),
      tap(([, lang]) => {
        if (!lang) return;
        translate.use(lang);
        // keeps <html lang="xx"> in sync (helps a11y & SEO)
        document.documentElement.setAttribute('lang', lang);
      }),
    );
  },
  { functional: true, dispatch: false },
);
