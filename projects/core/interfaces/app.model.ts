import { AuthState, TeamManagementState, UserState, VariantsState } from './public-api';

export interface AppState {
  user: UserState;
  teamManagement: TeamManagementState;
  auth: AuthState;
  aiVariants: VariantsState;
  theme: ThemeState;
  lang: LangState;
}

export type Lang = 'Français' | 'English';
export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
}

export interface LangState {
  lang: Lang;
}
