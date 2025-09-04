import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CoreOptions, RuntimeConfig } from '@cadai/pxs-ng-core/interfaces';
import { KeycloakService } from '@cadai/pxs-ng-core/services';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

export const authGuard: CanActivateFn = async () => {
  const { environments } = inject(CORE_OPTIONS) as Required<CoreOptions>;
  const hasKeycloak = !!(environments as RuntimeConfig).auth?.hasKeycloak;

  if (!hasKeycloak) return true;

  const kc = inject(KeycloakService);
  if (!kc.isReady) await firstValueFrom(kc.whenReady());
  return kc.isAuthenticated;
};
