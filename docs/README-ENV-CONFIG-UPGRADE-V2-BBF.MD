# ⚒️ Serve Config from the BFF – Implementation Process
>_Last updated: 2025-08-21_


This document explains **how to move runtime configuration out of the SPA** and **serve it from the BFF**. The BFF becomes the **source of truth** for per-tenant, per-role, per-environment features and menus.


## 1) What we’re building
- A **BFF endpoint** that returns the **effective config** for the current session/user:
  - Pruned by **tenant** and **roles**
  - Honoring `enabled`, `requireAuth`, `allow.tenants`
  - Including `variants` (e.g., AI provider/model)
  - Returning only features the user is allowed to see (menus == features)
- The SPA will **fetch `/config`** at startup (instead of reading `/assets/config.json`).

---

## 2) Source of truth
- Keep **canonical configs** versioned in the repo or a config store (S3/Blob/DB):
  - `config.base.json`, `config.dev.json`, `config.uat.json`, `config.prod.json`
  - Optional overlays: `config.customer-<TENANT>.json`
- CI/CD **merges** preset + overlay + env overrides (FEATURE_*/AI_*).
- The **BFF loads** the merged canonical config at **startup** and on change (watcher or reload API).

---

## 3) Endpoint design
- `GET /configFeatures` → returns JSON with the **effective, filtered** config:
  - `200 OK` with body:
    ```json
    {
      "features": { /* filtered features map depending on tenat or other custom attributes */ }
    }
    ```
  - Headers: `Cache-Control: private, max-age=60`, `ETag: "<hash>"`, `X-Config-Version: "<iso-or-gitsha>"`

---

## 4) Rollout plan
1. **Implement** `/config` in BFF (load → validate → filter → cache).
2. **Switch SPA** to `ConfigService.fetch('/config')`.
3. **Test** with two tenants → different menus/features.
4. **Add CI validation** + production CSP check.
5. **Monitor** with logs including `configVersion` and feature counts.

---

## 5) Example response (after filtering)
```json
{
  "features": {
    "ai.chat":   {
      "enabled": true,
      "key": "genai-chat",
      "label": "nav.genai-chat",
      "icon": "genai-chat",
      "route": "/genai-chat",
      "variants": {
        "ai.provider": "openai",
        "ai.model": "gpt-4o-mini"
      }
    },
    "reports":   {
      "enabled": true,
      "key": "reports",
      "label": "nav.reports",
      "icon": "reports",
      "route": "/reports"
    }
  }
}
```

---

## 6) Definition of Done
- `/config` returns **only** features the user can see.
- SPA boots using `/config`; CSP is simplified to `'self'`.
- No secrets in config; backend still enforces authorization.


## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).