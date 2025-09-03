import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfig } from '@cadai/pxs-ng-core/interfaces';
import { ConfigService, KeycloakService } from '@cadai/pxs-ng-core/services';

export const authGuard: CanActivateFn = async () => {
  const config = inject(ConfigService);
  const hasKeycloak = !!(config.getAll() as RuntimeConfig).auth?.hasKeycloak;

  if (!hasKeycloak) return true;

  const kc = inject(KeycloakService);
  if (!kc.isReady) await firstValueFrom(kc.whenReady());
  return kc.isAuthenticated;
};
