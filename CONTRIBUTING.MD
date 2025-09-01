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

1. **Install**:
   ```bash
   npm ci
   ```

2. **Lint (CI rules)**:
   ```bash
   npm run lint:ci
   ```

3. **Build**:
   ```bash
   npm run build:core
   ```

4. **Pack (preview the artifact)**:
   ```bash
   cd dist/core
   npm pack --dry-run
   ```

> The library uses `ng-packagr`. Only `tslib` is allowed as a non-peer dependency; all Angular/NgRx/Translate/Keycloak/RxJS are **peers** (provided by consumers).


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


## 4. ⚙️ Routing & Roles (on Host App)

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

## 5. ⚡ package.json Scripts

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

## 6. 🚀 Contributing & Publishing — Core SDK (`@cadai/pxs-ng-core`)

This document explains **how CI/CD works** for the Core SDK and **what contributors must do** to keep builds green and releases smooth.

> **TL;DR**  
> - Target branches: `develop` (integration), `main|master` (release).  
> - CI runs **lint + build** on PRs that touch `projects/core/**`.  
> - Merges into `main` automatically **publish** `@cadai/pxs-ng-core` to Azure Artifacts and **create a git tag** `PXS-NG-CORE@<version>`.  
> - The **package version is read from** `projects/core/package.json` and must be bumped **before merging** to `main`.


### How to Release

1. From latest `develop`, bump the version:

2. Open a PR: **`develop` → `main`**. Wait for **Build & Test** to pass.

3. Merge the PR. On `main`:
   - CI **publishes** to Azure Artifacts (if new version).
   - CI creates **tag** `PXS-NG-CORE@x.y.z`.

---
---

## 7. 👣 Branching & PR Policy

- Work on **feature branches** cut from `develop`.
- Open PRs **into `develop`** for regular work.  
- When preparing a release:
  1. Bump version in `projects/core/package.json` (using the `npm run version:patch|minor|major`).
  2. Merge `develop` → `main` via PR.
- CI is **triggered only for changes** to:
  - `projects/core/**` (library code),
  - pipeline files and workspace configs (`azure-pipelines.yml`, `package.json`, `package-lock.json`, `tsconfig*.json`, `projects/**`).

### Required checks on PRs
- **ESLint (CI)** must pass.
- **Library build** must succeed (`ng build core --configuration production`).

> CI also runs on PRs targeting `main`, `master`, or `develop` if they modify `projects/core/**`.

---

## 8. 🚀 CI/CD Overview (Azure Pipelines)

| Stage            | When it runs                                   | What it does                                                                                                 |
|------------------|--------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| **Build & Test** | On any commit/PR that matches the path filters  | Uses Node `20.x`, `npm ci`, runs `npm run lint:ci`, builds the library (`npm run build:core`). Publishes `dist/core` as artifact `pxs-ng-core`. |
| **Publish**      | **Only** on `main` after a successful build     | Downloads artifact. Creates `.npmrc` for the artifact. Authenticates with **NpmAuthenticate**. Skips if the version already exists. Otherwise **publishes** to Azure Artifacts feed. |
| **Tag**          | **Only** on `main` after publish                | Reads version from `projects/core/package.json`, creates git tag `PXS-NG-CORE@<version>` and pushes it to origin. |

### Environments / Variables
- Node version: `20.x`
- Feed URL: `https://pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/`
- Artifact name: `pxs-ng-core`
- Library paths: `projects/core` → `dist/core`

---

### Recommended commit style
We follow **Conventional Commits**:
- `feat(core): add X`
- `fix(core): handle Y`
- `chore(release): bump to 1.2.3`

---

## 9. 📝 Publishing Details

### Authentication
The pipeline creates a **scoped `.npmrc` inside the artifact directory** and authenticates it with **NpmAuthenticate@0**. This ensures `npm publish` uses the Azure Artifacts feed.

### Idempotent publish
Before publishing, CI checks if `@cadai/pxs-ng-core@<version>` already exists on the feed:
- If **exists** → **skip** publish gracefully.
- If **not found** → `npm publish --ignore-scripts --registry <FEED_URL>`.

> Lifecycle scripts are disabled for safety during CI publishing.

### Tagging
- CI uses `System.AccessToken` to push the tag.  
- The tag format is **`PXS-NG-CORE@<version>`**.

---

## 10. 📥 Consuming the Package (Host Apps)

Add the Azure Artifacts registry in your **Host** project:

```npmrc
@cadai:registry=https://pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/
always-auth=true
```

Install:
```bash
npm i @cadai/pxs-ng-core@^<major>.<minor>.<patch>
```

Host apps must satisfy the **peer dependencies** (Angular/NgRx/Translate/Keycloak/RxJS).

---

## 11. 🪲 Troubleshooting

- **Publish skipped**: The exact version already exists. Bump `projects/core/package.json` and retry a `develop → main` merge.
- **Auth errors (`npm publish`)**: Ensure the pipeline ran **NpmAuthenticate@0** and the `.npmrc` path points to the **file inside the artifact directory**.
- **Tag push failed**: Confirm the pipeline has **`persistCredentials: true`** on checkout and uses `$(System.AccessToken)`.
- **Build fails on missing types**: Ensure the **SDK workspace** has peer packages in **devDependencies** (they are required for type-checking during build). This does not affect published peers.

---

## 12. 🛡️ Security Notes

- Do **not** print tokens or `.npmrc` contents in logs.  
- Use **`--ignore-scripts`** on `npm publish` in CI to avoid executing arbitrary lifecycle scripts.  
- Tags are created by CI using a dedicated identity (`Build Bot`).

---

###  ✅ Checklist Before Publishing

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