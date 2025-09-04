# ⚙️ Feature Flags, Menus, Tenants — **Installation & Operations Guide**

_Last updated: 2025‑09‑03_

This skeleton loads its **runtime configuration** from `/assets/config.json` (no rebuild required):

```ts
// Host app bootstrap (excerpt)
const res = await fetch('assets/config.json', { cache: 'no-store' });
const env = await res.json();
```

It supports two **dynamic switches** that change how the app boots and behaves:

- **`hasNgrx: boolean`** — toggles NgRx Store/Effects integration.
- **`auth.hasKeycloak: boolean`** — toggles Keycloak SSO, guards, and auth interceptors.

When disabled, each feature degrades gracefully (details below).

---

## 0) File Layout of Runtime Configs

```
public/assets/config.json        # live symlink/copy chosen at deploy time
public/assets/config.dev.json
public/assets/config.uat.json
public/assets/config.prod.json
```

**Why runtime configs?**

- Swap `config.json` in CI/CD to flip envs **without rebuilding**.
- Keep assets cacheable & versioned.
- Drive features/menus/tenants at runtime.

---

## 1) Concepts (Features, Menus, Variants)

- A **feature** is both a capability **and** a menu entry (one config object).
- Visibility is controlled by:
  - `enabled` — on/off
  - `roles` — allow‑list (user needs **any**)
  - `allow.tenants` — tenant allow‑list (see tenant policy below)
  - `requireAuth` — hide & guard route if unauthenticated
- **Variants** are key/value knobs (e.g., AI provider/model) read by components/services.

> Client flags only control **UI**. Your backend must enforce authz & tenancy.

---

## 2) End‑to‑End Flow (userCtx → features)

**Sources**

- **RuntimeConfig** (from `/assets/config.json`) defines feature rules & variants.
- **Keycloak token** adds:
  - `authorization: string[]` — role names (`ROLE_user`, `ROLE_admin`, …).
  - `tenant: string` — tenant id (`"clarence"`).

**Flow**

1. `KeycloakService.getUserCtx()` → `{ isAuthenticated, roles, tenant }`
   - roles from `authorization` (fallback to realm/client roles if you enable it).
2. `FeatureService.isEnabled(key, userCtx)` checks: `enabled` → `requireAuth` → `roles` → `allow.tenants`.
3. `FeatureService.visibleFeatures(userCtx?)` filters features for **menus**.
4. `featureGuard('key')` applies the same logic for **routes**.
   - If `requireAuth` and unauthenticated → triggers **Keycloak login redirect** (no `/login` route needed).
   - If authenticated but disallowed → optional redirect to `/403` (configurable).

**Example Access Token (excerpt)**

```json
{
  "preferred_username": "alice",
  "authorization": ["ROLE_user", "ROLE_admin"],
  "tenant": "clarence"
}
```

---

## 3) Dynamic Flags — `hasNgrx` & `auth.hasKeycloak`

### `auth.hasKeycloak`

| Flag    | What Happens                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `true`  | Keycloak is **initialized** at boot, `authInterceptor` is installed, guards enforce auth/roles/tenants, `/403` redirect is active for 403s.                                                                                                 |
| `false` | Keycloak is **not** initialized. App runs in **guest mode**: user is treated as `{ isAuthenticated: true, roles: [], tenant: null }`. Guards **allow** all, `authInterceptor` is **omitted**, and 403s do **not** redirect (snackbar only). |

> Guest mode is useful for local demos and backends that don’t yet issue tokens.

**Core wiring (excerpt)**

```ts
const cfg = normalized.environments as RuntimeConfig;
const hasNgrx = !!cfg.hasNgrx;
const hasKeycloak = !!cfg.auth?.hasKeycloak;

// Interceptors: auth only when Keycloak is ON
provideHttpClient(withInterceptors([
  ...(hasKeycloak ? [authInterceptor] : []),
  ...normalized.interceptors,
  httpErrorInterceptor,
]));

// User context provider used by guards (guest when KC off)
{ provide: CORE_GET_USER_CTX, useFactory: () => {
    const kc = inject(KeycloakService);
    const guest = { isAuthenticated: true, roles: [], tenant: null } as const;
    return (() => (hasKeycloak ? kc.getUserCtx() : guest)) as GetUserCtx;
}};
```

**Error interceptor behavior**

- With KC **ON**: 403 from your API → `router.navigate(['/403'])`.
- With KC **OFF**: 403 → **no redirect**, optional snackbar (stay on page).

### `hasNgrx`

| Flag    | What Happens                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `true`  | Store/Effects are expected. Boot dispatches hydration effects (Auth, Variants, etc.). Components can inject `Store`.                                                   |
| `false` | Store/Effects **not required**. `FeatureService` uses internal **signals** for variants; shared components should inject `Store` **optionally** and guard their usage. |

**Boot sequencing (excerpt)**

```ts
await config.loadConfig();
const runtime = config.getAll();
if (hasKeycloak) await kc.init();

// i18n: resolve selected language (optionally from store)
const selectedLang = ...;
translate.addLangs(['en', 'fr']);
translate.setFallbackLang('en');
translate.use(selectedLang);

// Features + user
features.reseedFromConfig();
features.setUser(hasKeycloak ? kc.getUserCtx()
                             : { isAuthenticated: true, roles: [], tenant: null });

// NgRx hydration (only if enabled & store present)
if (hasNgrx && store) {
  if (hasKeycloak) store.dispatch(AppActions.AuthActions.hydrateFromKc());
  store.dispatch(AppActions.AiVariantsActions.hydrateFromConfig());
}
```

**Component guidelines when `hasNgrx` can be false**

```ts
// Prefer optional Store
private store = inject(Store, { optional: true });

// Use defensively
this.user$ = this.store ? this.store.select(Selectors.user) : of(null);
if (this.store) this.store.dispatch(UserActions.load());
```

---

## 4) Keycloak Token Mappers (Pre‑requisites)

Create **two mappers** so your Access Token has the expected claims:

### `tenant` (string)

- Mapper Type: **User Attribute**
- User Attribute: `tenant`
- Token Claim Name: `tenant`
- JSON Type: `String`
- Add to Access Token: ✅ (ID token optional)

### `authorization` (array of strings)

- Mapper Type: **User Realm Role**
- Token Claim Name: `authorization`
- JSON Type: `String`, **Multivalued** ✅

> You can add a second mapper for client roles into the same `authorization` claim if needed—Keycloak merges arrays.

---

## 5) Runtime Config Schema (with dynamic flags)

```json
{
  "name": "dev",
  "production": false,
  "apiUrl": "https://dev.api.yourdomain.com",
  "hasNgrx": true,
  "auth": {
    "hasKeycloak": true,
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
      "sse": { "enabled": false, "endpoint": "/rt/events" },
      "websocket": { "enabled": false, "url": "wss://app.example.com/rt/ws" },
      "push": {
        "enabled": false,
        "vapidPublicKey": "BPuB1c…publicKey…",
        "topics": ["alerts", "jobs"],
        "requireUserOptIn": true
      }
    }
  },
  "features": {
    "dashboard": {
      "enabled": true,
      "roles": ["ROLE_user", "ROLE_admin"],
      "key": "dashboard",
      "label": "nav.dashboard",
      "icon": "dashboard",
      "route": "/dashboard",
      "requireAuth": true
    },
    "team": {
      "enabled": true,
      "roles": ["ROLE_user", "ROLE_admin"],
      "allow": { "tenants": ["clarence", "other_tenant"] },
      "key": "team",
      "label": "nav.team",
      "icon": "group",
      "route": "/team",
      "requireAuth": true
    }
    // ... other features
  }
}
```

**Field Notes**

- `key/label/icon/route` → a menu entry.
- `roles` → allow‑list (user needs **any**). The SDK **normalizes** both sides: `user` ↔ `ROLE_user` (either works).
- `allow.tenants` → allow‑list by tenant. **Tenant policy**:
  - If the claim is **missing**, default is **allow** (lenient).
  - If present and not matched, feature is **denied**.
- `requireAuth: true` → hidden & guarded when unauthenticated.
- **Dynamic flags**:
  - `hasKeycloak=false` → run as **authorized guest**; guards allow, `/403` redirect disabled.
  - `hasNgrx=false` → SDK runs without Store; use signals fallback.

---

## 6) FeatureService (Behavior with dynamic flags)

- When **Keycloak OFF** → `isEnabled` always returns **true** (guest mode).
- When **Keycloak ON** → checks `enabled` → `requireAuth` → roles → tenants.
- **Role normalization**: both config and token roles are coerced to `ROLE_*` for matching.
- **Tenant policy** (recommended): allow when tenant claim **missing**; deny when present & not listed.
- Provides `visibleFeatures()` to render menus.

```ts
// Example menu build
menu = this.features.visibleFeatures();
```

---

## 7) Route Guards

Apply to routes that correspond to features:

```ts
import { featureGuard } from '@cadai/pxs-ng-core/feature/feature.guard';

export const routes = [
  {
    path: 'genai-chat',
    canActivate: [featureGuard('ai.chat', { forbid: '/403' })],
    loadComponent: () => import('./features/chat.component').then((m) => m.ChatComponent),
  },
];
```

- With KC **OFF** → guard returns **true** (guest mode).
- With KC **ON** → if `requireAuth` and not authenticated → **Keycloak login redirect**.  
  Otherwise uses same `isEnabled` logic as menus; on deny, navigates to `/403` if configured.

---

## 8) Interceptors

- **Auth** (`authInterceptor`): only registered when `auth.hasKeycloak=true`.  
  Skips static assets & i18n JSON; refreshes token JIT and attaches `Authorization` header to API calls.
- **Error** (`httpErrorInterceptor`): never handles assets or Keycloak endpoints.
  - With KC **ON**: 403 → `/403` navigation (API only).
  - With KC **OFF**: 403 → snackbar only (no redirect).

---

## 9) NgRx Optionality

- With `hasNgrx=true`, the SDK dispatches hydration actions.
- With `hasNgrx=false`, the SDK **does not** require Store/Effects; `FeatureService` uses signals for variants.
- Host components should inject `Store` **optionally** and guard usage.

```ts
private store = inject(Store, { optional: true });
this.user$ = this.store ? this.store.select(Selectors.user) : of(null);
if (this.store) this.store.dispatch(UserActions.load());
```

---

## 10) Realtime (Optional)

A factory chooses SSE / WebSocket / Push based on runtime flags:

```ts
const client = chooseRealtimeClient(cfg);
await client?.connect();
```

See `realtime` section in `config.json` for flags. Remember CSP (`connect-src`) and HTTPS for Push.

---

## 11) Troubleshooting

- **Redirected to /403 unexpectedly**
  - Log the decision reasons in `FeatureService.passes` (roles/tenant).
  - Ensure token has `authorization` and (if required) `tenant`.
  - Check role names: SDK normalizes `user` ↔ `ROLE_user`, but confirm your config matches intent.
- **Menus empty**
  - Verify `features.setUser(...)` is called after Keycloak init (or guest user when KC off).
- **Blank /403 with `ɵcmp`**
  - Avoid barrel cycles in your shared entrypoint. Import 403/SEO components **directly** inside the library; keep barrels for host imports only.
- **NgRx serializability errors**
  - Serialize errors before dispatch (e.g., `serializeError(err)`), or relax `strictActionSerializability` if you must.
- **Static assets & i18n fail with 401/403**
  - Ensure interceptors skip `/assets/**` and `*.json`.

---

## 12) CI/CD Notes

- Choose and copy the right preset to `assets/config.json` at deploy time.  
  Validate with a JSON schema.
- For single‑tenant builds, set `TENANT=<id>` and ensure features include it in `allow.tenants`.

---

## 13) Pre‑Deployment Checklist

**Keycloak**

- [ ] PKCE **S256** enabled; implicit/hybrid off.
- [ ] `tenant` mapper → claim **tenant** (string).
- [ ] `authorization` mapper → claim **authorization** (multivalued string).
- [ ] Exact Web Origins & Redirect URIs set.

**Config & Tenants**

- [ ] `hasKeycloak` and `hasNgrx` set as intended.
- [ ] Enabled features list correct tenants in `allow.tenants`.
- [ ] Role names match your policy (`ROLE_*` vs plain).
- [ ] `requireAuth` matches UX.

**App**

- [ ] `provideCore` loads config, (optionally) inits Keycloak, updates FeatureService, sets user.
- [ ] Menus render from `visibleFeatures()`; guards use `featureGuard('key')`.

**Security**

- [ ] No tokens in Store; keep in memory.
- [ ] Backend enforces authz/tenant.
- [ ] CSP & CORS tight.

**Realtime** (if used)

- [ ] Endpoints reachable; CSP updated.
- [ ] VAPID public key set (private key server‑side).
- [ ] `REALTIME_*` variables configured.

---

## 14) Developer Cheatsheet

- Check a feature: `features.isEnabled('ai.chat', userCtx)`
- Menu model: `features.visibleFeatures(userCtx)`
- Route guard: `canActivate: [featureGuard('ai.chat')]`
- Variant: `features.getLocalVariants()['ai.model']` (or your accessor)

---

## 🧑‍💻 Author

**Angular Product Skeleton** — _Tarik Haddadi_  
Angular 19+, standalone APIs, runtime configs, optional NgRx, optional Keycloak.
