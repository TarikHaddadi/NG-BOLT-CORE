import { AuthState, TeamManagementState, UserState } from './public-api';

export interface AppState {
  user: UserState;
  teamManagement: TeamManagementState;
  auth: AuthState;
}
