import { KeycloakInitOptions } from 'keycloak-js';

import { UserRole } from '@cadai/pxs-ng-core/enums';

export interface AuthRuntimeConfig {
  url: string;
  realm: string;
  clientId: string;
  hasKeycloak?: boolean;
  init?: Partial<KeycloakInitOptions>; // onLoad, pkceMethod, checkLoginIframe, ...
}

export interface AuthProfile {
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  authorization?: UserRole[];
  tenant?: string[] | null;
}
