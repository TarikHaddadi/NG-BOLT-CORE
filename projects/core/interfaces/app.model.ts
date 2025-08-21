import { AuthRuntimeConfig, AuthState, TeamManagementState, UserState } from './public-api';

export interface AppState {
  user: UserState;
  teamManagement: TeamManagementState;
  auth: AuthState;
}

export interface AppEnvConfig {
  name: string;
  production: boolean;
  apiUrl: string;
  version: string;
  auth: AuthRuntimeConfig;
}
