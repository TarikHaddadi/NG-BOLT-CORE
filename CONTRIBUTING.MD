# 📝 Contributing Guide – `@cadai/pxs-ng-core`
>_Last updated: 2025-08-21_

Welcome! This document explains how to work with the **PXS-NG-CORE** library: setup, development, versioning, and publishing to our private Azure Artifacts feed.

This document is the **source of truth** for how to work in this repository. It explains the folder structure, barrel usage, contribution workflow, and a pre‑push checklist to keep everything aligned.

---

## 1. 🚀 Prerequisites

- [Node.js LTS](https://nodejs.org/) (v18+ or v20+ recommended)  
- [Angular CLI](https://angular.dev/cli):  
  ```bash
  npm install -g @angular/cli
  ```
- A valid **Azure DevOps Personal Access Token (PAT)** with **Packaging: Read & Write** permissions.
---

## 2. 🛠 Development

- Source code lives in `projects/core/`  
- Build output goes to `dist/core/`  

Build locally:
```bash
npm run build:core
```


### Core Layer

**Purpose:** framework-agnostic services, models, guards, interceptors, and the **single init point**.
> We use **barrel files** (`index.ts`) so consumers import from a single entry per layer. This keeps imports stable and avoids deep relative paths.

```text
projects/
└─ core/
   ├─ core/                           # Framework-agnostic building blocks
   ├─ services/                    # Config, Http, Keycloak, Layout, Theme, Toast, User, etc.
   ├─ directives/                  # Shared TS Directives
   ├─ factories/                  # Shared TS Factories
   ├─ interfaces/                  # Shared TS interfaces & models
   ├─ enums/                       # Shared enums (e.g., UserRole)
   ├─ utils/                       # Pure helpers & validators
   ├─ guards/                      # Route guards (e.g., authGuard)
   ├─ interceptors/                # Http interceptors (auth, error)
   │
   ├─ shared/                         # Reusable UI + headless components
   │  ├─ dialog/                      # Confirm dialogs, etc.
   │  ├─ forms/                       # Form system & fields
   │  ├─ fields/                      # Input, select, chips, autocomplete, etc.
   │  ├─ dynamic-form-builder/        # Dynamic form engine/components
   │  ├─ seo/                         # SEO component / meta service
   │  ├─ layout/                      # AppLayoutComponent (standalone)
   │  ├─ public-api.ts/             # barrels definition
   │  ├─ index.ts/                  # exposes public-api
   │  └─ ng-package.json/           # used for building the Core SDK Module
   │
   ├─ realtime/                       # Realtime CLients to use depending on the configuration
   │  ├─ pushClient.ts/
   │  ├─ SseClient.ts/
   │  ├─ WebSocketClient.ts/
   │  ├─ public-api.ts/             # barrels definition
   │  ├─ index.ts/                  # exposes public-api
   │  └─ ng-package.json/           # used for building the Core SDK Module
   │
   └─ store/                          # NgRx (root + features)
   │   ├─ features/
   │   │  ├─ auth/ {actions,effects,reducer,selectors}/
   │   │  ├─ team/ {actions,effects,reducer,selectors}/
   │   │  └─ user/ {actions,effects,reducer,selectors}/
   │   ├─ app.actions.ts               # Global app actions (optional)
   │   ├─ app.effects.ts               # Global effects (optional)
   │   ├─ app.reducer.ts               # Root reducer map
   │   ├─ app.selectors.ts             # Root selectors (optional)
   │   ├─ app.state.ts                 # Root state
   │   └─ index.ts                     # Barrel: provideAppStore(), actions, selectors
   │
   ├─ tokens/                       # App configurations
   │  ├─ usertCtx/
   │  ├─ public-api.ts/             # barrels definition
   │  ├─ index.ts/                  # exposes public-api
   │  ├─ ng-package.json/           # used for building the Core SDK Module
   │  └─ CoreOpts
   │
   ├─ public-api.ts/             # barrels definition
   ├─ index.ts/                  # exposes public-api
   └─ ng-package.json/           # used for building the Core SDK Module
   
```

### Path Aliases (tsconfig)

Make sure these exist so barrel imports work:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@cadai/pxs-ng-core": ["projects/core/src/public-api.ts"],
      "@cadai/pxs-ng-core/*": ["projects/core/*/public-api.ts"]
    },
  }
}
```

### ESLint (Flat Config) Barrel Policy

- **Allowed deep alias imports**: `@cadai/pxs-ng-core/core`, `@cadai/pxs-ng-core/shared`, and so on (interfaces, interceptors, guards, enums, services, etc......)

(See `eslint.config.js` in repo for exact rules.)

### Example Imports

```ts
// Allowed deep @core/@shared
import {{ KeycloakService }} from '@cadai/pxs-ng-core/services';
import {{ AppLayoutComponent }} from '@cadai/pxs-ng-core/shared';
```

### Key Files

- `core/core.ts` – registers HttpClient (interceptors), i18n, date providers, loads runtime config, initializes Keycloak, hydrates store.
- `services/keycloak.service.ts` – PKCE, `login-required` (no auto-login in refresh loop), `ensureFreshToken`.
- `interceptors/auth.interceptor.ts` – injects token, skips KC endpoints, only redirects to login on API `401`.
- `guards/auth.guard.ts` – waits for Keycloak readiness and authorizes; with `login-required`, it does not call `login()`.

---

## 3. 📦 Versioning

We follow **semantic versioning** (`MAJOR.MINOR.PATCH`):

- **Patch**: Bug fixes, no breaking changes → `1.0.0 → 1.0.1`
- **Minor**: Backward-compatible features → `1.0.0 → 1.1.0`
- **Major**: Breaking changes → `1.0.0 → 2.0.0`

Bump version inside `projects/core/package.json`:

```bash
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0
```

---

## 4. 🚀 Publishing to Azure Artifacts

1. Build the library:
   ```bash
   npm run build:core
   ```

2. Publish:
   ```bash
   npm run publish:core
   ```

This will:
- Build with Angular CLI  
- Copy `.npmrc` into `dist/core`  
- Publish to the Azure feed  

---

## 5. Routing & Roles (on Host App)

```ts
// app.routes.ts
import {{ Routes }} from '@angular/router';
import {{ authGuard, UserRole }} from '@core';
import { AppLayoutComponent } from '@shared/layout/app-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: '{customPath}', pathMatch: 'full' },
  {
    path: '',
    component: AppLayoutComponent,
    canActivateChild: [authGuard],
    children: [
      {
        path: '{customPath}',
        canActivate: [featureGuard('{customPath}', { forbid: '/403' })],
        data: { roles: [UserRole.ROLE_admin, UserRole.ROLE_user] },
        loadComponent: () =>
          import('./features/{customComponent}/{customComponent}.component').then(m => m.DashboardComponent),
      },
      { path: '403', loadComponent: () => import('@cadai/pxs-ng-core/shared').then(m => m.ForbiddenComponent) },
      { path: '**', loadComponent: () => import('@cadai/pxs-ng-core/shared').then(m => m.NotFoundComponent) },
    ]
  },
];
```

## 7. ⚡ package.json Scripts

Available at the repo root:

```json
{
  "scripts": {
    "build:core": "ng build core",
    "version:patch": "npm version patch --prefix projects/core",
    "version:minor": "npm version minor --prefix projects/core",
    "version:major": "npm version major --prefix projects/core",
    "publish:core": "ng build core && copy .npmrc dist\\core\\.npmrc && cd dist/core && npm publish"
  }
}
```

---

## 8. ✅ Checklist Before Publishing

- [ ] Run `npm run build:core` – build passes with no errors  
- [ ] Update version with `npm run version:patch|minor|major`  
- [ ] Run `npm run publish:core`  
- [ ] Verify package is available on [Azure Artifacts feed](https://dev.azure.com/cadai/Socle/_packaging?_a=feed&feed=PXS-NG-CORE)  

###  Pre‑Push Checklist

- [ ] **Build passes**: `npm run build:core`
- [ ] **Lint passes**: `pnpm lint` (or `npm run lint`)
- [ ] **No deep relative imports** into `core/shared/features/store` (respect barrel policy)
- [ ] **Barrels updated**: new public APIs re‑exported via `index.ts`
- [ ] **Store wired**: reducer registered, effects provided, selectors exported
- [ ] **i18n keys** added/updated
- [ ] **Types**: no `any`; strict mode friendly
- [ ] **Changelog/commit messages** follow Conventional Commits
- [ ] **Version bump** planned if releasing

---


## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).