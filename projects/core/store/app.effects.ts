import * as AiVariantsEffects from './features/ai-variant/ai-variants.effects';
import * as authEffects from './features/auth/auth.effects';
import * as LangEffects from './features/lang/lang.effects';
import * as teamEffect from './features/team-management/team-management.effects';
import * as ThemeEffects from './features/theme/theme.effects';
import * as UserEffects from './features/user/user.effects';
// Fulfill imports with new added items

// Fulfill Array with new added items
export const AppEffects = [
  UserEffects,
  teamEffect,
  authEffects,
  AiVariantsEffects,
  ThemeEffects,
  LangEffects,
];
