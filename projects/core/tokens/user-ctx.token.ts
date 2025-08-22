import { InjectionToken } from '@angular/core';

import { UserCtx } from '@cadai/pxs-ng-core/interfaces';

/** Optional provider that lets the guard read user ctx without coupling to Keycloak/NgRx. */
export type GetUserCtx = () => UserCtx;

export const CORE_GET_USER_CTX = new InjectionToken<GetUserCtx>('CORE_GET_USER_CTX');
