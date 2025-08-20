import { UserState, TeamManagementState, AuthState } from "./public-api";

export interface AppState {
  user: UserState;
  teamManagement: TeamManagementState,
  auth: AuthState
}