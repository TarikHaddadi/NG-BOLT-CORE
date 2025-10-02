# PXS NG Core — Contributing & Dynamic Form Guide

> _Last updated: 2025-08-21_

> This document explains:
>
> 1. How to contribute safely (structure, exports, barrels, and common pitfalls).
> 2. How to add **custom Dynamic Form fields** end‑to‑end.

---

## 1) Contributing Guidelines (safe build & runtime)

### Project layout (multi‑entry Angular library)

```
projects/core/
  core/            # provideCore and root providers
  enums/           # shared enums
  guards/          # route guards
  interceptors/    # HTTP interceptors
  interfaces/      # types, models, FieldConfig, etc.
  providerss/      # Custom providers such as ChartsProvider.
  services/        # injectable services
  shared/          # standalone UI components (forms, layout, etc.)
  store/           # NgRx facades, actions, reducers, selectors
  tokens/          # DI tokens
  utils/           # validators, helpers
  src/public-api.ts  # root entry barrel
  ng-package.json    # ng-packagr config
```

Each subfolder (e.g., `interfaces`, `services`, …) is an **entry point** with **its own**:

- `public-api.ts` (explicit exports)
- `index.ts` (re-exports from `public-api.ts`)
- `ng-package.json` (local entry point config)

The root `dist/core/package.json` will expose them through `"exports"` — e.g.:

- `@cadai/pxs-ng-core` (root)
- `@cadai/pxs-ng-core/interfaces`
- `@cadai/pxs-ng-core/shared`  
  … etc.

### Golden rules (to prevent crashes & “ɵcmp/undefined” issues)

1. **Always use explicit barrels**
   - Export only from `public-api.ts` (per entry).
   - Make `index.ts` **only** re-export from `public-api.ts`.
   - Never deep-import internal files across entries (e.g., avoid `@cadai/pxs-ng-core/shared/forms/field-host/…`).

2. **No cross-entry default imports**  
   Use **named exports** everywhere and **never** `export default`. Angular tooling + ng-packagr expect named symbols.

3. **Avoid circular deps**
   - Don’t import `shared/public-api` **from inside** `shared/` components — use **relative** imports there.
   - Cross-area rules:
     - `interfaces` → can be imported by anyone.
     - `utils` → can import `interfaces`, but **not** `shared` or `store`.
     - `shared` (UI) → can import `interfaces` and `utils`, but **not** `store` or `core`.
     - `services`, `guards`, `interceptors` → can import `interfaces` and `utils`, **not** `shared`.
     - `core` (root providers) → can import from `services`, `tokens`, `interfaces`, `interceptors` (via barrels).
     - `store` → can import `interfaces` but keep it independent of `shared` and `core`.

4. **Standalone components**
   - Every Angular component in `shared/` is **standalone** and must declare its own `imports:`.
   - Consumers can lazy‑load or import them directly. Missing `imports` causes runtime `ɵcmp`/def errors.

5. **Material & CDK**
   - Each field component must import its own Material modules (`MatInputModule`, `MatSelectModule`, …).
   - Do **not** rely on a global material module.

6. **Form field inputs contract**
   - Each field component must declare `@Input() field: FieldConfig` and `@Input() control: FormControl<…>`.
   - Do **not** pass a `form` input into field components — `FieldHostComponent` passes **only** `{ field, control }`.

7. **`FIELD_MAP` lives in `FieldHostComponent`**
   - `FieldHostComponent` resolves `field.type → Component`.
   - Use **relative imports** within `shared/fields/*` to avoid library self‑imports.

8. **I18n keys & error messages**
   - Prefer runtime i18n keys like `form.errors.${field.name}.required`.
   - Allow per-field overrides via `field.errorMessages?.[key]`.

9. **Build hygiene**
   - Root `tsconfig.json` should not declare per-entry `paths` that point into source subfolders.
   - Let **ng-packagr** write your `exports` in `dist`.
   - If you see **“File is not under rootDir”** or **“circular dependency on itself”**, you are probably deep‑importing across entries or re‑exporting barrels that re-import their own entry.

10. **Version compatibility**

- Keep peerDependencies wide enough for Angular 19/20 but consistent across app and lib.
- Don’t ship Angular packages in `dependencies` — keep them in `peerDependencies`.

---

## 2) Adding a Custom Dynamic Form Field

This section shows how to add a brand-new field type end‑to‑end.

### A. Add/extend the types

**`projects/core/interfaces/field-config.model.ts`** (or where `FieldType` lives)

```ts
export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'phone'
  | 'textarea'
  | 'autocomplete'
  | 'chips'
  | 'dropdown'
  | 'select'
  | 'toggle'
  | 'file'
  | 'range'
  | 'datepicker'
  | 'myCustom'; // <-- add your new type

export interface FieldConfig {
  name: string;
  type: FieldType;
  label: string;
  // ...existing props

  // optional props for your field
  myCustomOptions?: {
    foo?: string;
    bar?: number;
  };
}
```

> **Rule:** Only add props that the field needs; keep shared `FieldConfig` generics minimal.

### B. Create the UI component

Create a new standalone component under `shared/fields/my-custom/`.

**`projects/core/shared/forms/fields/my-custom/my-custom.component.ts`**

```ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';

@Component({
  selector: 'app-my-custom',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- your control -->
    <div class="my-custom">
      <label [attr.for]="field.name">{{ field.label }}</label>
      <input [id]="field.name" [formControl]="control" (blur)="control.markAsTouched()" />

      @if (field.helperText && !showError) {
        <div class="hint">{{ field.helperText }}</div>
      }

      @if (showError) {
        <div class="error" role="alert" aria-live="polite">{{ errorText }}</div>
      }
    </div>
  `,
})
export class MyCustomComponent {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) control!: FormControl<string | null>;

  get showError() {
    return !!(this.control?.touched && this.control?.invalid);
  }
  get errorText() {
    return 'Invalid'; /* or i18n like in other fields */
  }
}
```

> Import any needed Material modules inside `imports: []`.

### C. Register in the Field Host map

**`projects/core/shared/forms/field-host/field-host.component.ts`**

```ts
import { MyCustomComponent } from '../fields/my-custom/my-custom.component';

const FIELD_MAP = {
  // ...
  mycustom: MyCustomComponent, // key = lowercase of your FieldType
} as const;
```

> **Tip:** `FIELD_MAP` keys are lowercase; either ensure your `FieldType` will map correctly or coerce (`toLowerCase()`).

### D. Export the component from the shared entry

**`projects/core/shared/public-api.ts`**

```ts
export { MyCustomComponent } from './forms/fields/my-custom/my-custom.component';
```

**`projects/core/shared/index.ts`**

```ts
export * from './public-api';
```

> Never export deep paths directly from `index.ts`; always re-export from the local `public-api.ts`.

### E. Create config and validators

If you have a helper that provides common fields:

**`projects/core/services/field-config.service.ts`**

```ts
getMyCustomField(name = 'custom', label = 'Custom'): FieldConfig {
  return {
    name,
    type: 'myCustom',
    label,
    required: true,
    // myCustomOptions: { foo: 'x', bar: 1 },
    validators: [], // add your custom validators if needed
  };
}
```

If you need a validator, place it under `utils/` and export via `utils/public-api.ts`. Don’t import UI (`shared`) from validators.

### F. i18n

Add keys to your translation files (e.g., `assets/i18n/en.json`):

```json
{
  "form": {
    "labels": { "custom": "Custom" },
    "errors": {
      "custom": {
        "required": "This field is required"
      }
    }
  }
}
```

### G. Use it in an app

```ts
const config: FieldConfig[] = [
  // ...
  {
    name: 'custom',
    type: 'myCustom',
    label: 'form.labels.custom',
    required: true,
    color: 'primary',
    layoutClass: 'primary',
  },
];
```

Dynamic form will create a control and `FieldHostComponent` will render `MyCustomComponent`.

---

## 3) Build & Publish Checklist

- [ ] No deep imports across entries (only through `public-api`/`index` or **relative** within the same entry).
- [ ] No circular deps (check build logs & VSCode circularity plugins if needed).
- [ ] Every field component declares `@Input() field` and `@Input() control` only.
- [ ] `FieldHostComponent` maps **all** supported `FieldType`s.
- [ ] `shared/public-api.ts` exports all components you want consumable.
- [ ] `interfaces/public-api.ts` exports **all** types (including `FieldType`, `FieldConfig`).
- [ ] `store` exports are grouped (e.g., `AppActions`, `AppSelectors`) and are **named**.
- [ ] `dist/core/package.json` after build shows correct `"exports"` including `./shared`, `./interfaces`, etc.
- [ ] Peer deps match the consuming app’s Angular major version.
- [ ] Run a consumer app locally against a **file:../dist/core** install to catch runtime issues before publishing.

**Build commands** (example):

```bash
# clean
rimraf dist out-tsc

# build the lib
ng build core

# locally test in an app
cd consumer-app
npm i ../dist/core
npm start
```

---

## 4) Common Errors & How to Fix

**A. `Cannot read properties of undefined (reading 'ɵcmp')`**  
Cause: Using a component that wasn’t compiled as standalone or missing its `imports` in the component.  
Fix: Ensure every UI component is `standalone: true` and declares needed Angular/Material modules in `imports:`.

**B. `NG0303: Can't set value of the 'form' input on ...`**  
Cause: Passing an input the child doesn’t declare.  
Fix: Our field components accept only `field` and `control`. Remove `form` from inputs.

**C. `File '...ngtypecheck.ts' is not under 'rootDir'` or `Entry point ... has a circular dependency on itself`**  
Cause: Cross-entry deep imports or exporting an entry via its own barrel, causing loops.  
Fix: Use **relative** imports inside an entry; use `public-api.ts`/`index.ts` **only one level up**; avoid re-importing your own entry in its `public-api`.

**D. `Cannot find module '@cadai/pxs-ng-core/interfaces'` in `dist`**  
Cause: `interfaces` entry wasn’t exported or the consumer’s TS path maps override the built package.  
Fix: Check `dist/core/package.json` `"exports"`. In consumer app, **remove** dev-time TS path mappings that shadow the installed package.

---

## 5) PR checklist

- [ ] New types added to `interfaces` and exported via its `public-api.ts`.
- [ ] New field component is standalone + has `@Input() field` and `@Input() control`.
- [ ] `FieldHostComponent` FIELD_MAP updated.
- [ ] Unit test or playground app tested with the new field.
- [ ] i18n keys added for label + error messages.
- [ ] No circular deps (verified by build).
- [ ] `shared/public-api.ts` exports the new component.
- [ ] Documentation updated (this file).

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
