import { AuthState, TeamManagementState, UserState, VariantsState } from './public-api';

export interface AppState {
  user: UserState;
  teamManagement: TeamManagementState;
  auth: AuthState;
  aiVariants: VariantsState;
}
