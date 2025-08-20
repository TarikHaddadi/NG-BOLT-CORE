# 🎯 Project Roadmap – Ordered Checklist (Angular 19 + NgRx + Keycloak)
>_Last updated: 2025-08-20_

Legend: **✅ Done** · **🟡 In progress** · **❌ To do**  
Severity: **P0 Critical**, **P1 High**, **P2 Medium**, **P3 Low**  
Workload (est.): **S ≤1d**, **M 2–3d**, **L 4–7d**, **XL >1wk**

> Update **Status**, **Owner**, and **Next Actions** as you progress. Add links to PRs or wiki when relevant.


## ✅ Summary Table (Done → In Progress → To Do)

| Category | Item | Status | Severity | Workload | Summary | Key Files / Paths | Next Actions | Owner |
|---|---|---:|---|---|---|---|---|---|
| Core | Barrels and config | ✅ | P1 | XL | App uses standalone components, strict TS/ESLint. Also imports are done via barels `@cadai/pxs-ng-core/*` | `See core repository on Azure actifacts https://dev.azure.com/cadai/Socle/_artifacts/feed/PXS-NG-CORE` | — | FE |
| Core | CI/CD | ✅ | P1 | M | Automatic builds and deployments  + Bumping versions| `azure-pipelines.ylm` | ------- | FE |
| Core | Storybook| ❌ | P2 | XL | Storybook implementation for every custom component in the app| `projects/core/shared/*` | TO BE IMPLEMENTED | FE |
| Core | TS linter | ❌ | P1 | S | Lint implementation to prevent from committing unsecure scripts + lint bfrore commit| `husky` | TO BE IMPLEMENTED + Update CI/CD | FE |
| Core | Pre-commit Lints all over the project | ❌ | P1 | S | use ling before commit | `husky` | TO BE IMPLEMENTED | FE |
| Core | Versionning | ❌ | P1 | S | Auto upgrade version by bumping a Tag and pushing it when commiting a new release + creating a release note | --- | TO BE IMPLEMENTED | FE |
| Core | Env Vars | ❌ | P1 | XL | Adapt the ENV configuration multitenant and multi feature | see all files `REAMD-ENV-*` | TO BE IMPLEMENTED | FE |
| Core | Docs | ❌ | P1 | M | Update all documentations | --- | TO BE IMPLEMENTED | FE |