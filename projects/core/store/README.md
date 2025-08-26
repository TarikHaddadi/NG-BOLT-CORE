# 🗃️ State Management with NgRx (Store + Effects)

**Philosophy**

- **Single global store** for app‑wide data (auth session, UI status, features).
- **Feature slices** per domain (`auth`, `teamManagement`, …).
- **Pure reducers**, **typed actions**, **selectors** for consumption.
- **Functional effects** (Angular 16+) for side‑effects (HTTP, navigation, toasts).

**Conventions**

- **Action names**: `[Feature] verb object` (e.g., `[Auth] Login Redirect`).
- **Reducers**: immutable updates, no side‑effects.
- **Selectors**: the only way UI reads store. Compose them.
- **Effects**: functional `createEffect(() => …, { functional: true })`.
- **Persistence**: persist only what you need (e.g., `teamManagement`) using `ngrx-store-localstorage`. Never persist tokens.

**Auth in the Store**

- On app init, a small bootstrap dispatch **hydrates** from the Keycloak instance (profile, token expiry).
- A periodic **refresh effect** updates `expiresAt` in store when Keycloak refreshes.
- **Logout** clears `auth` slice; other slices subscribe to it if they need to reset on logout.

**Debugging**

- Enable **Store DevTools** in non‑prod.
- Use **selectors** in components (`selectIsAuthenticated`, `selectProfile`, …).

**Purpose:** state management for app and features.

### A) Folder Structure

```text
projects/core/store/
├─ features/
│  ├─ auth/  {actions,effects,reducer,selectors}/
│  ├─ aiVariant/  {actions,effects,reducer,selectors}/
│  ├─ team/  {actions,effects,reducer,selectors}/
│  ├─ user/  {actions,effects,reducer,selectors}/
│  └─ custom/  {actions,effects,reducer,selectors}/ {.. your custom store}
├─ app.actions.ts      # Aggregates feature actions -> AppActions
├─ app.effects.ts      # Root effects registration list -> AppEffects
├─ app.reducer.ts      # Root reducer map -> AppReducers
├─ app.selectors.ts    # Aggregates feature selectors -> AppSelectors
├─ app.state.ts        # Root AppState
├─ ng-package.json
├─ index.ts
└─ public-api.ts      # provideAppStore(), metaReducers (localStorageSync), etc.
```

**In `store/public-api.ts`** we re-export the two root objects so components can import from `@core` only:

```ts
export { AppActions } from './app.actions';
export { AppSelectors } from './app.selectors';
export { metaReducers, provideAppStore } from './store';
```

---

### B) Root Wiring

#### `store/store.ts`

Provides the root store and effects, and applies persistence to specific slices.

```ts
import { ActionReducer, MetaReducer, provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { localStorageSync } from 'ngrx-store-localstorage';
import { AppEffects } from './app.effects';
import { AppReducers } from './app.reducer';
import { AppState } from '@core/interfaces';

const localStorageSyncReducer = (reducer: ActionReducer<AppState>): ActionReducer<AppState> =>
  localStorageSync({ keys: ['teamManagement'], rehydrate: true })(reducer);

export const metaReducers: MetaReducer<AppState>[] = [localStorageSyncReducer];

export const provideAppStore = () => [
  provideStore(AppReducers, {
    metaReducers,
    runtimeChecks: {
      strictActionImmutability: true,
      strictStateImmutability: true,
    },
  }),
  provideEffects(AppEffects),
];
```

> **Note:** `AppReducers` and `AppEffects` are maintained in their respective files (**_DO NOT TOUCH_**); this guide focuses on **actions** and **selectors** aggregation.

---

### C) Aggregation (Root Objects)

#### `store/app.actions.ts`

Aggregate feature action namespaces into a single `AppActions` object:

```ts
import * as UserActions from './features/user/user.actions';
import * as TeamActions from './features/team-management/team-management.actions';
import * as AuthActions from './features/auth/auth.actions';

export const AppActions = {
  UserActions,
  TeamActions,
  AuthActions,
};
```

#### `store/app.selectors.ts`

Aggregate feature selectors into a single `AppSelectors` object:

```ts
import * as UserSelectors from './features/user/user.selectors';
import * as TeamSelectors from './features/team-management/team-management.selectors';
import * as AuthSelectors from './features/auth/auth.selectors';

export const AppSelectors = {
  UserSelectors,
  TeamSelectors,
  AuthSelectors,
};
```

These are re-exported by `@core/index.ts`, so components use:

```ts
import { AppActions, AppSelectors } from '@core';
```

---

### D) Feature Pattern (Actions / Effects / Reducer / Selectors)

Below is the **canonical** pattern your features follow. Example: **User**.

#### 4.1 Actions (`user.actions.ts`)

```ts
import { createAction, props } from '@ngrx/store';
import { User } from '@cadai/pxs-ng-core/interfaces';

// Get one user
export const loadUser = createAction('[User] Load');
export const loadUserSuccess = createAction('[User] Load Success', props<{ user: User }>());
export const loadUserFailure = createAction('[User] Load Failure', props<{ error: string }>());

// Get all users
export const loadUsers = createAction('[User] Load All');
export const loadUsersSuccess = createAction('[User] Load All Success', props<{ users: User[] }>());
export const loadUsersFailure = createAction('[User] Load All Failure', props<{ error: string }>());

// Create
export const createUser = createAction('[User] Create', props<{ user: Partial<User> }>());
export const createUserSuccess = createAction('[User] Create Success', props<{ user: User }>());
export const createUserFailure = createAction('[User] Create Failure', props<{ error: string }>());

// Update
export const updateUser = createAction(
  '[User] Update',
  props<{ id: string; user: Partial<User> }>(),
);
export const updateUserSuccess = createAction('[User] Update Success', props<{ user: User }>());
export const updateUserFailure = createAction('[User] Update Failure', props<{ error: string }>());

// Delete
export const deleteUser = createAction('[User] Delete', props<{ id: string }>());
export const deleteUserSuccess = createAction('[User] Delete Success', props<{ id: string }>());
export const deleteUserFailure = createAction('[User] Delete Failure', props<{ error: string }>());
```

#### 4.2 Effects (`user.effects.ts`)

Functional effects that inject dependencies inside the effect factory:

```ts
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import * as UserActions from './user.actions';
import { catchError, map, mergeMap, of } from 'rxjs';
import { UserService } from '@cadai/pxs-ng-core/services';

export const loadUser = createEffect(
  () => {
    const actions$ = inject(Actions);
    const userService = inject(UserService);
    return actions$.pipe(
      ofType(UserActions.loadUser),
      mergeMap(() =>
        userService.getCurrentUser().pipe(
          map((user) => UserActions.loadUserSuccess({ user })),
          catchError((error) => of(UserActions.loadUserFailure({ error: error.message }))),
        ),
      ),
    );
  },
  { functional: true },
);

// Similar for loadUsers, createUser, updateUser, deleteUser ...
```

#### 4.3 Reducer (`user.reducer.ts`)

```ts
import { createReducer, on } from '@ngrx/store';
import * as UserActions from './user.actions';
import { UserState } from '@cadai/pxs-ng-core/interfaces';

const initialState: UserState = {
  user: null,
  users: [],
  loading: false,
  error: null,
};

export const userReducer = createReducer(
  initialState,
  on(UserActions.loadUser, (s) => ({ ...s, loading: true, error: null })),
  on(UserActions.loadUserSuccess, (s, { user }) => ({ ...s, loading: false, user })),
  on(UserActions.loadUserFailure, (s, { error }) => ({ ...s, loading: false, error })),

  on(UserActions.loadUsers, (s) => ({ ...s, loading: true, error: null })),
  on(UserActions.loadUsersSuccess, (s, { users }) => ({ ...s, loading: false, users })),
  on(UserActions.loadUsersFailure, (s, { error }) => ({ ...s, loading: false, error })),

  on(UserActions.createUser, (s) => ({ ...s, loading: true, error: null })),
  on(UserActions.createUserSuccess, (s, { user }) => ({
    ...s,
    loading: false,
    users: [...s.users, user],
  })),
  on(UserActions.createUserFailure, (s, { error }) => ({ ...s, loading: false, error })),

  on(UserActions.updateUser, (s) => ({ ...s, loading: true, error: null })),
  on(UserActions.updateUserSuccess, (s, { user }) => ({
    ...s,
    loading: false,
    users: s.users.map((u) => (u.id === user.id ? user : u)),
  })),
  on(UserActions.updateUserFailure, (s, { error }) => ({ ...s, loading: false, error })),

  on(UserActions.deleteUser, (s) => ({ ...s, loading: true, error: null })),
  on(UserActions.deleteUserSuccess, (s, { id }) => ({
    ...s,
    loading: false,
    users: s.users.filter((u) => u.id !== id),
  })),
  on(UserActions.deleteUserFailure, (s, { error }) => ({ ...s, loading: false, error })),
);
```

#### 4.4 Selectors (`user.selectors.ts`)

```ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from '@cadai/pxs-ng-core/interfaces';

export const selectUserState = createFeatureSelector<UserState>('user');
export const selectUser = createSelector(selectUserState, (s) => s.user);
export const selectUserRole = createSelector(selectUser, (u) => u?.role ?? null);
export const selectUserLoading = createSelector(selectUserState, (s) => s.loading);
export const selectUsers = createSelector(selectUserState, (s) => s.users);
export const selectUserError = createSelector(selectUserState, (s) => s.error);
```

---

### E) Usage in Components

Use only the **root objects re-exported by `@core`**:

```ts
import { AppActions, AppSelectors } from '@core';
import { Store } from '@ngrx/store';

// Select
this.user$ = this.store.select(AppSelectors.UserSelectors.selectUser);
this.userLoading$ = this.store.select(AppSelectors.UserSelectors.selectUserLoading);

// Dispatch
this.store.dispatch(AppActions.UserActions.loadUser());
```

This keeps components free from deep store paths.

---

### F) Adding a New Store Feature (Checklist)

1. **Scaffold feature** under `store/features/<name>/{actions,effects,reducer,selectors}`.
2. **Register reducer** in `app.reducer.ts` (update `AppReducers`).
3. **Register effects** in `app.effects.ts` (add to `AppEffects` list).
4. **Aggregate** in root:
   - `app.actions.ts`: `import * as <Name>Actions ...; export const AppActions = { ...AppActions, <Name>Actions };`
   - `app.selectors.ts`: `import * as <Name>Selectors ...; export const AppSelectors = { ...AppSelectors, <Name>Selectors };`
5. **Export** `AppActions` & `AppSelectors` through `@core/index.ts` (already wired).
6. **Use** in components via `@core` (no deep imports).

---

### G) Persistence Policy

- We sync **`teamManagement`** slice to `localStorage` via `localStorageSync` in `store/index.ts`.
- To persist another slice:
  1. Add its key to `keys: [...]` in `localStorageSync({ keys: [...] })`.
  2. Ensure its state is serializable.
  3. Consider versioning/migrations if shape changes.

---

### H) PR Checklist (NgRx-specific)

- [ ] Reducer added to `AppReducers`
- [ ] Effects added to `AppEffects`
- [ ] Feature selectors/actions aggregated in `app.selectors.ts` / `app.actions.ts`
- [ ] Components use `AppActions` / `AppSelectors` from `@core`
- [ ] No deep relative imports into `store/**` from components
- [ ] Side effects live in **effects**, not components
- [ ] State is serializable; no plain class instances in store
- [ ] Tests/lint pass (`ng build`, `npm lint`, `npm test` if present)

---

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
