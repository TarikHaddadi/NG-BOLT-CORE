# 📝 Contributing Guide – `@cadai/pxs-ng-core`
>_Last updated: 2025-08-21_

Welcome! This document explains how to work with the **PXS-NG-CORE** library: setup, development, versioning, and publishing to our private Azure Artifacts feed.

---

## 1. 🚀 Prerequisites

- [Node.js LTS](https://nodejs.org/) (v18+ or v20+ recommended)  
- [Angular CLI](https://angular.dev/cli):  
  ```bash
  npm install -g @angular/cli
  ```
- A valid **Azure DevOps Personal Access Token (PAT)** with **Packaging: Read & Write** permissions.

---

## 2. 🔑 Authentication Setup

At the **root of the repo**, create/update `.npmrc`:

```ini
registry=https://pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/

//pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/:always-auth=true
//pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/:username=azure
//pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/:_password=<BASE64_PAT>
//pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/:email=tarik.haddadi@proximus.lu
```

👉 Replace `<BASE64_PAT>` with your Personal Access Token encoded in Base64:  
```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("your_PAT_here"))
```

✅ Test login:
```bash
npm whoami --registry=https://pkgs.dev.azure.com/cadai/Socle/_packaging/PXS-NG-CORE/npm/registry/
```
Should return: `azure`

---

## 3. 🛠 Development

- Source code lives in `projects/core/`  
- Build output goes to `dist/core/`  

Build locally:
```bash
npm run build:core
```

---

## 4. 📦 Versioning

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

## 5. 🚀 Publishing to Azure Artifacts

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



## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19 and modern best practices (2025).