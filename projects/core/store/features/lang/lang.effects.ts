import { inject } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, map, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';

import { Lang } from '@cadai/pxs-ng-core/interfaces';

import { AppActions } from '../../app.actions';
import { AppSelectors } from '../../app.selectors';

export const applyLang = createEffect(
  () => {
    const actions$ = inject(Actions);
    const store = inject(Store);
    const translate = inject(TranslateService);

    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT, AppActions.LangActions.setLang, AppActions.LangActions.toggleLang),
      withLatestFrom(store.select(AppSelectors.LangSelectors.selectLang)),
      map(([, l]) => (l ?? 'en').toLowerCase() as Lang),
      distinctUntilChanged(),
      switchMap(async (L) => {
        translate.addLangs(['en', 'fr']);
        translate.setFallbackLang(L!);

        await firstValueFrom(translate.use(L!));

        return translate.use(L).pipe(
          take(1),
          tap(() => document.documentElement.setAttribute('lang', L)),
        );
      }),
    );
  },
  { functional: true, dispatch: false },
);
