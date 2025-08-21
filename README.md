# AI Product – Angular 19 CORE
>_Last updated: 2025-08-21_

> 🚀 Modern Angular 19 project (Proximus core Angular SDK) with runtime environment configs, standalone components, NgRx state management, dynamic forms, internationalization, and full CI/CD support.


---

## 🧭 Quick Start for Developers

1. Set up a Keycloak client (Public + PKCE S256) and brokered IdPs if needed.  
2. Update `public/assets/config.dev.json` (`auth.url/realm/clientId`).  
3. `npm start` → app redirects to Keycloak and back.  
4. Verify API calls include Bearer token.  
5. For CSP, start with Report‑Only and review DevTools for violations.

---

## 🧱 Project Overview

This repository provides a scalable, production-ready **Angular 19** setup using best practices including:

- ✅ **Standalone component architecture**
- 🌐 **Runtime environment configuration** via `public/assets/config.json`
- 🔐 **Authentication with Keycloak (Broker, PKCE, iframe‑free)**
- 🔒 **Strict Content Security Policy (CSP)** compatible with Keycloak (no iframes)
- 🔄 **NgRx** for reactive global state (Store + Effects + Actions + Selectors + Models)
- 🧩 **Dynamic Forms** via reusable `FieldConfig` pattern
- 🌍 **Internationalization** with `@ngx-translate`
- 🎨 **Angular Material + CDK** UI framework
- 🐳 **Docker + Nginx** with runtime-templated CSP
- 🦾 **CI/CD** examples (Azure Pipelines & GitLab CI)

---


## 📐 Features Used

- ✅ **Angular 19 Standalone APIs**
- ✅ **Runtime config injection** via `ConfigService`
- ✅ **NgRx** for scalable and reactive global state
- ✅ **Reactive Forms** with dynamic schema rendering
- ✅ **Internationalization (i18n)** via `@ngx-translate`
- ✅ **Angular Material** UI with responsive layout
- ✅ **Signal-based ThemeService** Theming
- ✅ Integrated **Toasts**, **Dialogs**, and **Tooltips**
- ✅ Integrated Custom **Forms** Builder and custom reusable **Fields**
- ✅ Strict **TypeScript** config (`strict: true`) with ESLint
- ✅ **CI/CD-ready** with Azure Pipelines & GitLab CI support


## 6. 📥 Consuming the Library in Apps

In any Angular app:

```bash
npm install @cadai/pxs-ng-core
```

Since `.npmrc` is already configured, npm resolves it via the Azure feed.

---

## 📦 Dependencies

### Framework & Core

- **Angular 19** (`@angular/core`, `@angular/common`, etc.)
- **Standalone APIs** (`bootstrapApplication`, `ApplicationConfig`)
- **RxJS 7.8**

### UI & Layout

- `@angular/material` – Material Design UI components
- `@angular/cdk` – Layout utilities
- `@angular/flex-layout` – Responsive layout engine

### State Management

- `@ngrx/store`, `@ngrx/effects`, `@ngrx/store-devtools`
- `ngrx-store-localstorage` – persistent global state

### Forms & UX

- **Reactive Forms**
- **Custom DynamicFormComponent**
- `FieldConfigService` for reusable, schema-based field configuration

### Internationalization (i18n)

- `@ngx-translate/core`
- `@ngx-translate/http-loader`


## 📁 Project Structure Highlights

This library follows an opinionated but consistent structure to keep features isolated and exports predictable.  
Below is an overview of the main directories and their responsibilities:

---

### Root
- **ng-package.json** – Configuration for `ng-packagr`, defines build output for the library.
- **package.json** – Library metadata, dependencies, scripts, version (used for CI/CD tagging).
- **tsconfig.*.json** – TypeScript configs for library, production build, and tests.
- **README.md** – Project overview and contributor guide.

---

### `core/`
- **core.ts** – Core entry point logic and root exports.
- **index.ts** – Barrel file re-exporting everything in `core`.
- **public-api.ts** – Public surface of the `core` module.
- **ng-package.json** – Packaging config for this submodule.

---

### `enums/`
- **roles.enum.ts** – Application role definitions (e.g., `ROLE_admin`, `ROLE_user`).
- **index.ts / public-api.ts** – Barrels to make enums available via `@cadai/pxs-ng-core/enums`.

---

### `guards/`
- **auth.guard.ts** – Route guard for authentication and role-based access.
- **index.ts / public-api.ts** – Export guard(s) to consumers.

---

### `interceptors/`
- **auth.interceptor.ts** – Injects tokens into HTTP requests.
- **http-error.interceptor.ts** – Global HTTP error handling.
- **index.ts / public-api.ts** – Exports interceptors.

---

### `interfaces/`
- **field-config.model.ts** – Schema used by the dynamic forms system.
- **auth.model.ts, user.model.ts, team-management.model.ts** – Domain models.
- **app.model.ts, core.interface.ts, keycloak.model.ts** – Core interface definitions.
- **index.ts / public-api.ts** – Export all interfaces.

---

### `services/`
- **config.service.ts** – Runtime environment configuration loader.
- **date-formats.ts** – Date adapters and format providers for Angular Material.
- **field-config.service.ts** – Utilities for dynamic form configuration.
- **http.service.ts** – Abstraction on top of Angular HttpClient.
- **keycloak.service.ts** – Keycloak auth integration (login, refresh, logout).
- **layout.service.ts** – State/control for global layout (side nav, theme, etc.).
- **theme.service.ts** – Dark/light theme switching.
- **toast.service.ts** – UI notifications.
- **user.service.ts** – User API integration.
- **index.ts / public-api.ts** – Barrel exports.

---

### `shared/`
- **index.ts / public-api.ts** – Shared exports (UI and utilities).
- **CONTRIBUTING.md** – Contribution guide for shared components.
- **README-FORMS.md** – Documentation for the dynamic form system.

#### Subfolders:
- **forms/** – Dynamic form engine
  - `dynamic-form.component.ts/html/scss` – Main dynamic form container.
  - `field-host/field-host.component.ts` – Resolves a field config to its UI component dynamically.
  - `fields/` – Library of input components (`text-input`, `chips`, `select`, `datepicker`, `toggle`, etc.).
- **dialog/** – Reusable dialog component.
- **layout/** – Application layout wrapper (header, sidenav, content).
- **seo/** – SEO meta component for setting `<title>` and meta tags.

---

### `store/`
- **app.actions.ts / app.reducer.ts / app.effects.ts / app.selectors.ts** – Root NgRx store setup.
- **features/** – Feature-based state slices:
  - `auth/` – Auth-related actions, reducer, effects, selectors.
  - `user/` – User-related store logic.
  - `team-management/` – Team management state slice.
- **index.ts / public-api.ts** – Export NgRx store setup.

---

### `tokens/`
- **core-options.token.ts** – Angular `InjectionToken` for providing global core options.
- **index.ts / public-api.ts** – Token exports.

---

### `utils/`
- **form-validators.ts** – Reusable validators for dynamic forms.
- **index.ts / public-api.ts** – Utility exports.

---

### `src/`
- **public-api.ts** – Global entry point of the SDK.
- **CONTRIBUTING.md** – Contribution guide at the library root.

---

## 🧭 Conventions
- **Barrels (`index.ts` / `public-api.ts`)**  
  Every folder has an `index.ts` and/or `public-api.ts` that re-exports symbols. Always import from the SDK root (`@cadai/pxs-ng-core/...`) instead of deep paths.
- **Ng-Packagr configs**  
  Each subfolder is its own entry-point with its own `ng-package.json`. This ensures consumers can tree-shake and only import what they need.
- **Dynamic Form system**  
  New form fields must be declared inside `shared/forms/fields`, exported in its local `index.ts`, and mapped inside `field-host.component.ts`.


# PxsNgCore

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.1.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
