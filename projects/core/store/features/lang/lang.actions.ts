import { createAction, props } from '@ngrx/store';

import { Lang } from '@cadai/pxs-ng-core/interfaces';

export const setLang = createAction('[Lang] Set', props<{ lang: Lang }>());
export const toggleLang = createAction('[Lang] Toggle');
