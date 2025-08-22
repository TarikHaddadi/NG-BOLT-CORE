# ⚙️ Feature Flags, Menus & Tenants — Installation & Operations Guide

_Last updated: 2025-08-22_

On the Host application Instead of Angular's build-time `environment.ts`, this project loads configuration **at runtime** via:

```ts
fetch('assets/config.json');
```

## As Is Configs

```text
public/assets/config.dev.json
public/assets/config.uat.json
public/assets/config.prod.json
```

Keep deploy-time environment in `public/assets/config.json` (copied to `/assets/config.json` at build). Example:

**Example (`public/assets/config.dev.json`)**

```json
{
  "name": "dev",
  "production": false,
  "apiUrl": "https://dev.api.yourdomain.com",
  "auth": {
    "url": "http://localhost:8080/",
    "realm": "my-realm",
    "clientId": "eportal_chatbot",
    "init": {
      "onLoad": "login-required",
      "checkLoginIframe": false,
      "pkceMethod": "S256"
    }
  }
}
```

Minimal typed access:

```ts
export interface AppConfig {
  name: 'dev' | 'uat' | 'prod';
  production: boolean;
  apiUrl: string;
}

export class ConfigService {
  private config!: AppConfig;

  async load(): Promise<void> {
    const res = await fetch('assets/config.json');
    this.config = (await res.json()) as AppConfig;
  }

  get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.config[key];
  }

  all(): AppConfig {
    return this.config;
  }
}
```

Bootstrap-time load (example):

```ts
const cfg = new ConfigService();
await cfg.load();
// provide it in DI or attach to app initializer before bootstrap
```

**Why this setup?**

- Change envs by swapping `config.json` on the server/CDN—**no rebuild**.
- Keep assets versioned and cacheable under `/assets`.
- Keep global styles & themes outside the bundle when needed.

This guide explains how to:

- Install and run the skeleton in **single-tenant** or **multi-tenant** mode
- Configure **features** (menus are features) from **runtime config**
- Bootstrap a **Feature Service** with the app
- Wire **guards** and **menu rendering**
- Prepare **CI/CD** to generate the right `config.json`
- Add **Keycloak mappers** for tenant and roles
- Integrate **Realtime** (SSE/WebSocket/Push) at runtime
- Use a **pre-deployment checklist** to avoid mistakes

---

## 1) Concept

- A **feature** is both a capability **and** a menu entry (same config object).
- Visibility is controlled by:
  - `enabled` (on/off)
  - `roles` (who can see/use it)
  - `allow.tenants` (which customers can see/use it)
  - `requireAuth` (hide & guard if user is not authenticated)
- Feature **variants** tune behavior (e.g., AI provider or model).

> **Important:** client-side flags only control **UI**. Your backend must enforce permissions/tenant constraints independently.

---

## 2) End-to-End Flow (userCtx → features)

**Where data lives**

- **RuntimeConfig** Hosting App provides a (`/public/assets/config.json`) file that includes : feature rules (`enabled`, `requireAuth`, `roles`, `allow.tenants`, and `key/label/icon/route` for menus).
- **Keycloak token**: custom claims
  - `authorization`: string array of role names (e.g., `ROLE_user`, `ROLE_admin`).
  - `tenant`: the current tenant id (e.g., `"clarence"`).

**How it works**

1. `KeycloakService.getUserCtx()` builds:  
   `{ isAuthenticated, roles, tenant }`
   - `roles` come from **`authorization`** (fallback to realm/client roles only if you choose to keep it).
   - `tenant` comes from **`tenant`** claim.
2. `FeatureService.isEnabled(key, userCtx)` validates:
   - `enabled === true`
   - If `requireAuth`, user must be authenticated
   - If `roles` present, user must have **at least one**
   - If `allow.tenants` present, **userCtx.tenant** must be in that list
3. `FeatureService.visibleFeatures(userCtx?)` filters all features for menus.
4. `featureGuard('feature.key')` applies the **same rules** to route navigation.
   - If `requireAuth` and user is not authenticated, it **invokes Keycloak login** (no `/login` route required).
   - If authenticated but not allowed (role/tenant), it redirects to optional `/403`.

**Example: Keycloak token (excerpt)**

```json
{
  "preferred_username": "alice",
  "authorization": ["ROLE_user", "ROLE_admin"],
  "tenant": "clarence"
}
```

---

## 3) Keycloak Pre‑requisites (custom claims)

Configure **two mappers** on the client (or realm) so they’re included in the **Access Token** (and optionally **ID Token**).

### A) `tenant` claim (string)

- **Mapper Type:** _User Attribute_
- **User Attribute:** `tenant` (set it on user, group, or compute via script)
- **Token Claim Name:** `tenant`
- **Claim JSON Type:** `String`
- **Add to access token:** ✅
- **Add to ID token:** ✅ (optional)
- _(Optional)_ **Add to userinfo:** ✅

### B) `authorization` claim (array of role names)

You can merge realm and client roles into one claim **without scripts** using multiple mappers with the **same** claim name:

- **Mapper 1:** _User Realm Role_ → Claim **`authorization`**, JSON type **String**, **Multivalued** ✅

Keycloak merges values into one `authorization: [...]` array.

---

## 4) Runtime Config Shape

Place presets in `public/assets/config.*.json`, then CI copies/merges into `/assets/config.json` for the build.

```json
{
  "name": "dev",
  "production": false,
  "apiUrl": "https://dev.api.yourdomain.com",
  "auth": {
    "url": "http://localhost:8080/",
    "realm": "my-realm",
    "clientId": "eportal_chatbot",
    "init": {
      "onLoad": "login-required",
      "checkLoginIframe": false,
      "pkceMethod": "S256"
    }
  },

  "realtime": {
    "enabled": false,
    "order": ["sse", "websocket", "push"],
    "transports": {
      "sse": {
        "enabled": false,
        "endpoint": "/rt/events"
      },
      "websocket": {
        "enabled": false,
        "url": "wss://app.example.com/rt/ws"
      },
      "push": {
        "enabled": false,
        "vapidPublicKey": "BPuB1c…publicKey…",
        "topics": ["alerts", "jobs"],
        "requireUserOptIn": true
      }
    }
  },

  "features": {
    "ai.chat": {
      "enabled": true,
      "variants": {
        "ai.provider": "openai",
        "ai.model": "gpt-4o-mini"
      },
      "roles": ["ROLE_user", "ROLE_admin"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "genai-chat",
      "label": "nav.genai-chat",
      "icon": "genai-chat",
      "route": "/genai-chat",
      "requireAuth": true
    },
    "ai.compare": {
      "enabled": true,
      "variants": {
        "ai.provider": "openai",
        "ai.model": "gpt-4o-mini"
      },
      "roles": ["ROLE_admin", "ROLE_user"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "genai-compare",
      "label": "nav.genai-compare",
      "icon": "genai-compare",
      "route": "/genai-compare",
      "requireAuth": true
    },
    "ai.workflows": {
      "enabled": true,
      "variants": {
        "ai.provider": "openai",
        "ai.model": "gpt-4o-mini"
      },
      "roles": ["ROLE_admin", "ROLE_user"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "genai-workflows",
      "label": "nav.genai-workflows",
      "icon": "genai-workflows",
      "route": "/genai-workflows",
      "requireAuth": true
    },
    "ai.projects": {
      "enabled": true,
      "roles": ["ROLE_admin", "ROLE_user", "ROLE_owner"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "genai-projects",
      "label": "nav.genai-projects",
      "icon": "genai-projects",
      "route": "/genai-projects",
      "requireAuth": true
    },
    "ai.admin": {
      "enabled": true,
      "roles": ["ROLE_admin"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "genai-admin",
      "label": "nav.genai-admin",
      "icon": "genai-admin",
      "route": "/genai-admin",
      "requireAuth": true
    },
    "admin": {
      "enabled": false,
      "roles": ["ROLE_admin"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "admin",
      "label": "nav.admin",
      "icon": "admin",
      "route": "/admin",
      "requireAuth": true
    }
  }
}
```

**Field notes**

- `key/label/icon/route` → renders as a menu item.
- `roles` → **allow-list**: user must have at least one.
- `allow.tenants` → tenant allow-list (omit/empty to allow all).
- `requireAuth: true` → hidden & route-guarded if unauthenticated.
- `variants` → knobs your components/services can read at runtime.

---

## 5) Single‑Tenant vs Multi‑Tenant

**Single‑Tenant**

- In CI, set `TENANT=<your-tenant>` (e.g., `TENANT=clarence`).
- Ensure enabled features include that tenant in `allow.tenants`.
- (Optional) strip other tenants from the merged config for clarity.
- Token **must** include `tenant` claim equal to `TENANT`.

**Multi‑Tenant**

- Leave multiple tenants in `allow.tenants` arrays.
- Token **must** include a discriminator (e.g., `"tenant": "clarence"`).
- `FeatureService` evaluates using **roles + tenant** at runtime.

> See **Section 3** to configure the mappers that produce `tenant` and `authorization` in the token.

---

## 6) Feature Service (bootstrapped with the app)

**Responsibilities**

- Load `/assets/config.json` (via `ConfigService`) and expose:
  - `isEnabled(key, user): boolean`
  - `visibleFeatures(user?): FeatureNavItem[]` (for menus)
  - `variant<T>(path, fallback?): T`
  - `list(): string[]`
- Helpers:
  - **Route Guard:** `featureGuard('ai.chat')`
  - **Directive:** `*appFeature="'ai.chat'"` (optional; can use `*ngIf` + `isEnabled` instead)

**Bootstrap**

- In the SDK `provideCore()` initializer (after Keycloak init):
  ```ts
  const { isAuthenticated, roles, tenant } = kc.getUserCtx();
  features.setUser({ isAuthenticated, roles, tenant });
  ```
- Keep the store **token-free**; only use `roles` (and optionally profile UI fields) from your store if you wish to display them.

---

## 7) Menus = Features

Build the sidenav/topnav from `visibleFeatures()`:

```ts
// shell/layout component
menu = this.features.visibleFeatures(); // items have key/label/icon/route
```

If you want the menu to react to auth/role changes:

```ts
import { combineLatest, map } from 'rxjs';

combineLatest([roles$, kc.isAuthenticated$()]).subscribe(([roles]) => {
  const { isAuthenticated, tenant } = kc.getUserCtx();
  features.setUser({ isAuthenticated, roles, tenant });
  this.menu = features.visibleFeatures();
});
```

---

## 8) Route Guards

Use the guard on routes that correspond to features:

```ts
import { featureGuard } from '@cadai/pxs-ng-core/feature/feature.guard';

export const routes = [
  {
    path: 'reports',
    canActivate: [featureGuard('reports', { forbid: '/403' })],
    loadComponent: () => import('./features/reports.component').then((m) => m.ReportsComponent),
  },
];
```

- If `requireAuth` and user is unauthenticated → guard **invokes Keycloak login** (no `/login` route).
- If authenticated but not allowed → redirect to `/403` (configurable) or cancel navigation.

---

## 9) CI/CD Process

**Inputs**

- Presets: `public/assets/config.dev|uat|prod.json`
- Optional customer overlay: `public/assets/config.customer-{TENANT}.json`
- Pipeline variables:
  - `TENANT`
  - `FEATURE_*` overrides (e.g., `FEATURE_AI_CHAT=true/false`)
  - `AI_PROVIDER`, `AI_MODEL` variant overrides

**Steps**

1. Choose preset by branch.
2. Overlay customer config if `TENANT` is set.
3. Apply feature/variant overrides via env vars.
4. Validate JSON against a schema.
5. Write the final `public/assets/config.json`.
6. Build, dockerize, run CSP smoke test.

> Copy‑paste Azure/GitLab YAML and jq snippets — **see original section** for full scripts.

**Schema (excerpt)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "realtime": { "type": "object" /* ... */ },
    "features": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "roles": { "type": "array", "items": { "type": "string" } },
          "allow": {
            "type": "object",
            "properties": { "tenants": { "type": "array", "items": { "type": "string" } } }
          },
          "key": { "type": "string" },
          "label": { "type": "string" },
          "icon": { "type": "string" },
          "route": { "type": "string" },
          "requireAuth": { "type": "boolean" },
          "variants": { "type": "object" }
        },
        "required": ["enabled"]
      }
    }
  },
  "required": ["features"]
}
```

---

## 10) Realtime Integration

**Interface**

```ts
export interface RealtimeClient {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(channel: string, cb: (data: unknown) => void): () => void;
  publish?(channel: string, payload: unknown): Promise<void>;
}
```

**Factory**

```ts
function chooseRealtimeClient(cfg, deps): RealtimeClient | null {
  if (!cfg.realtime?.enabled) return null;
  const order = cfg.realtime.order ?? [];
  for (const t of order) {
    const rt = cfg.realtime.transports?.[t];
    if (!rt?.enabled) continue;
    if (t === 'sse') return new SseClient(rt.endpoint);
    if (t === 'websocket') return new WebSocketClient(rt.url);
    if (t === 'push') return new PushClient(rt.vapidPublicKey, deps.serviceWorker);
  }
  return null;
}
```

**BFF expectations**

- **SSE**: `GET /rt/events` (cookie auth)
- **WS**: `wss://.../rt/ws` (session-auth on upgrade)
- **Push**: `/push/subscribe|unsubscribe` VAPID flow

**CSP & Security**

- With SSE only: `connect-src 'self'`. For WS: include `wss://...`.
- Push requires HTTPS + SW. Keep secrets server-side; no tokens in JS.
- Apply CSRF to mutating endpoints; not needed for `GET /rt/events`.

**CI vars**

- `REALTIME_ENABLED`, `REALTIME_ORDER`
- `REALTIME_SSE_ENABLED`, `REALTIME_SSE_ENDPOINT`
- `REALTIME_WS_ENABLED`, `REALTIME_WS_URL`
- `REALTIME_PUSH_ENABLED`, `REALTIME_VAPID_PUBLIC`, `REALTIME_PUSH_TOPICS`, `REALTIME_PUSH_REQUIRE_OPTIN`

---

## 11) Testing Plan

- **Unit (client)**: factory selection logic; SSE/WS subscriptions; Push prompts.
- **Unit (BFF)**: SSE streams authorized channels; WS upgrade/auth; Push subscription handling.
- **Integration**: feature route subscribes to channels; `REALTIME_ORDER` toggles selection.
- **E2E**: Tenant A vs B → different menus; SSE fallback when WS disabled.

---

## 12) Troubleshooting

- **Nothing connects** → check `realtime.enabled`, CSP `connect-src`.
- **SSE disconnects** → proxy timeouts; add heartbeats; retry with backoff.
- **WS 101 fails** → reverse proxy upgrade support; correct `wss://` URL.
- **Push denied** → require user opt-in; provide settings UI to re-prompt.
- **Wrong transport** → inspect `realtime.order` and `enabled` flags.

---

## 13) Pre‑Deployment Checklist

**Keycloak**

- [ ] PKCE **S256**; implicit/hybrid **off**.
- [ ] **`tenant`** mapper (User Attribute or Script) → claim `tenant` (string).
- [ ] **`authorization`** mapper(s) → claim `authorization` (multivalued string).
- [ ] Exact Web Origins and Redirect URIs (no wildcards).

**Config & Tenants**

- [ ] `TENANT` variable (single‑tenant) or omitted (multi‑tenant).
- [ ] Each enabled feature’s `allow.tenants` includes the target tenant(s).
- [ ] `roles` match values emitted in `authorization` claim.
- [ ] `requireAuth` matches expected UX.

**App**

- [ ] `provideCore` loads config, inits Keycloak, calls `features.setUser(kc.getUserCtx())`.
- [ ] Menu built from `visibleFeatures()`; guards use `featureGuard('key')`.

**CI/CD**

- [ ] Merge step picked preset + overlay; applied overrides.
- [ ] JSON Schema validation passed.
- [ ] CSP smoke test passed.

**Security**

- [ ] No tokens persisted in client store; token stays in memory.
- [ ] Backend enforces authorization/tenant.
- [ ] CSP strict; CORS restricted to app origin(s).

**UX/i18n**

- [ ] All `label` keys exist in `/assets/i18n/*.json`.
- [ ] All `icon` names resolve; routes/components exist.

**Realtime (if used)**

- [ ] Endpoints reachable; CSP updated.
- [ ] VAPID public key set (private key server‑side only).
- [ ] `REALTIME_*` CI vars set as intended.

---

## 14) Developer Cheatsheet

- Check a feature: `featureService.isEnabled('ai.chat', user)`
- Menu model: `featureService.visibleFeatures(user)`
- Route guard: `canActivate: [featureGuard('ai.chat')]`
- Template: `*appFeature="'ai.chat'"` (or `*ngIf="features.isEnabled('ai.chat')"` )
- Variant: `featureService.variant('ai.model', 'gpt-4o-mini')`

---

**Author — Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19 and modern best practices (2025).
