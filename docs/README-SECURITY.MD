# Security Posture
>_Last updated: 2025-09-02_

**Stack:** Angular 19 SPA + Keycloak (Broker, PKCE) + NgRx + Nginx (Docker)  
**Decision:** Keep the SPA for UI, **implement a BFF (Backend‑for‑Frontend)** to hold tokens server‑side.


## 1) Current State (As‑Is)

- **Auth**: Keycloak Authorization Code + **PKCE S256**, **redirect‑only** (no iframes, no `silent-check-sso.html`).  
- **Tokens**: live **only in `keycloak-js` memory**; **not persisted**; removed from NgRx store.  
- **NGRX Store**: contains **minimal user info** (`name`, `email`, optionally `isAuthenticated` & `expiresAt`).  
- **CSP**: strict & iframe‑free; `connect-src` limited to Keycloak + API.  
- **HTTP**: interceptor reads token from `keycloak().token` per request.  
- **Logout/Refresh**: handled by `keycloak-js` (`updateToken`, `logout`).

**Strengths**
- No token persistence; PKCE; CSP‑friendly; low ops complexity.

**Residual Risk**
- **XSS can still steal in‑memory tokens** (any SPA risk).

---


## 2) Already Done
- [x] Tokens removed from NgRx store (store only `name`, `email`, etc.).  
- [x] CSP enforcing, iframe‑free; Keycloak redirect‑only.

---

## 3) Definition of Done

- [x] **CSP** in dev, uat and prod: `connect-src 'self'`; `frame-src 'none'`.  
- [x] **Keycloak**: PKCE only; exact origins; short lifetimes; refresh rotation.  
- [x] **API**: CORS restricted; JWT validated.  
- [ ] **CI/CD**: dependency scan + CSP smoke test;.  
- [ ] Runbook & onboarding docs updated.

---

## 4) FAQ

**Q: Can we keep the actual SPA flow?**  
A: Yes. Yes its safe tokens are secure and the CSP covers most parts.

---

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).