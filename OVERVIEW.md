# 🎯 Project Roadmap – Ordered Checklist (Angular 19 + NgRx + Keycloak)

> _Last updated: 2025-08-22_

Legend: **✅ Done** · **🟡 In progress** · **❌ To do**  
Severity: **P0 Critical**, **P1 High**, **P2 Medium**, **P3 Low**  
Workload (est.): **S ≤1d**, **M 2–3d**, **L 4–7d**, **XL >1wk**

> Update **Status**, **Owner**, and **Next Actions** as you progress. Add links to PRs or wiki when relevant.

## ✅ Summary Table (Done → In Progress → To Do)

| Category | Item                                                                    | Status | Severity | Workload | Summary                                                                                                             | Key Files / Paths                                                                                      | Next Actions      | Owner |
| -------- | ----------------------------------------------------------------------- | -----: | -------- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------- | ----- |
| Core     | Barrels and config                                                      |     ✅ | P1       | XL       | App uses standalone components, strict TS/ESLint. Also imports are done via barels `@cadai/pxs-ng-core/*`           | `See core repository on Azure actifacts https://dev.azure.com/cadai/Socle/_artifacts/feed/PXS-NG-CORE` | —                 | FE    |
| Core     | Theming                                                                 |     ❌ | P2       | XL       | Customize app theming by providing primary, secondary, error, success, infor, danger,etc.. colors `*.scss*`         | `See theming docs`                                                                                     | to be implement   | FE    |
| Core     | CI/CD                                                                   |     ✅ | P1       | M        | Automatic builds and deployments + Bumping versions                                                                 | `azure-pipelines.ylm`                                                                                  | -------           | FE    |
| Core     | TS linter                                                               |     ✅ | P1       | S        | Lint implementation to prevent from committing unsecure scripts + lint bfrore commit                                | `husky`                                                                                                | --                | FE    |
| Core     | Pre-commit Lints all over the project                                   |     ✅ | P1       | S        | use ling before commit                                                                                              | `husky`                                                                                                | -----             | FE    |
| Core     | Versionning                                                             |     ✅ | P1       | S        | Auto upgrade version by bumping a Tag and pushing it when commiting a new release + creating a release note + CI/CD | ---                                                                                                    |                   | FE    |
| Core     | Storybook                                                               |     ❌ | P2       | XL       | Storybook implementation for every custom component in the app                                                      | `projects/core/shared/*`                                                                               | TO BE IMPLEMENTED | FE    |
| Core     | Backend For Front (BFF)                                                 |     ❌ | P2       | XL       | TO BE IMPLEMENTED                                                                                                   | see `REAMD-ENV-CONFIG-UPGRADE-V2-BFF`                                                                  | TO BE IMPLEMENTED | FE    |
| Core     | Typings `<any>` to be correctly typed + Linter enhanced also            |     ❌ | P2       | M        | TO BE IMPLEMENTED                                                                                                   | see `REAMD-ENV-CONFIG-UPGRADE-V2-BFF`                                                                  | TO BE IMPLEMENTED | FE    |
| Core     | ngFor amnd ngIf to be removed and replaced with the new implementations |     ❌ | P2       | M        | TO BE IMPLEMENTED                                                                                                   | see `REAMD-ENV-CONFIG-UPGRADE-V2-BFF`                                                                  | TO BE IMPLEMENTED | FE    |
| Core     | Env Vars                                                                |     ✅ | P1       | XL       | Adapt the ENV configuration multitenant and multi feature                                                           | `REAMD-ENV-CONFIG-ASIS`                                                                                | ---               | FE    |
| Core     | Docs                                                                    |     🟡 | P1       | M        | Update all documentations                                                                                           | ---                                                                                                    | Inprogress        | FE    |

## 📃 Documentation Index

Legend: **✅ Done** · **🟡 Ongoing** · **❌ To do**

- [[✅] - Global Readme](./README.md)
- [[✅] - Core Overview](./README-OVERVIEW.md)
- [[✅] - Authentication and state management](./projects/core/store/README.md)
- [[✅] - Theming, Assets and translattions](./README-ASSETS-TRANSLATIONS.md)
- [[✅] - Contribution Guide](./CONTRIBUTING.md)
- [[✅] - Contributing on forms](projects/core/shared/CONTRIBUTING.md)
- [[✅] - Custom Form Builder and custom fields](projects/core/shared/README-FORMS.md)
- [[✅] - Authentication Flow](README-CURRENT-AUTH.md)
- [[🟡] - Content Security Policw CSP](./README-CSP.md)
- [[✅] - Environment Config Custom AS IS](README-ENV-CONFIG-ASIS.md)
- [[❌] - Environment Config – Upgrade BFF V2](README-ENV-CONFIG-UPGRADE-V2-BBF.md)
- [[❌] - Authentication Flow Upgrade BFF](README-AUTH-UPGRADE-V2-BFF.md)

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19 and modern best practices (2025).
