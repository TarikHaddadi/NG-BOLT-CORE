import { AuthState, TeamManagementState, UserState, VariantsState } from './public-api';

export interface AppState {
  user: UserState;
  teamManagement: TeamManagementState;
  auth: AuthState;
  aiVariants: VariantsState;
  theme: ThemeState;
}

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
}
