# Admin-route authentication — Fonderie spec

**Status:** spec + conformance audit (2026-09-06). Applies to every `@fonderie/*`
module that exposes an ops/admin HTTP surface (a route that mutates operator-owned
state and must not be reachable by ordinary session users).

## Why one convention

Fonderie's promise is that the security-sensitive plumbing is a *solved, safe-by-
default brick* — the integrator "usually can't audit whether what got invented is
actually safe." Admin auth is exactly that plumbing. If each module invents its
own admin guard, we get N surfaces to audit and N ways to get it subtly wrong.
**One convention, one shared primitive, verified by this audit.** Less to learn,
nothing to re-derive per package.

## The convention (MUST)

A module with an admin/ops surface MUST follow all of these:

1. **One top-level `adminToken?: string`** on the module's config/options. No
   per-feature or nested tokens; a single token guards *all* of that module's
   admin routes. (Billing unified its former `planAdminToken` +
   `wallet.adminToken` into one `config.adminToken` in 7.0.0/7.1.0.)

2. **Guard with the shared `requireAdminToken`** from
   `@fonderie/core/middlewares` — never a package-local copy. It MUST:
   - read `Authorization: Bearer <token>` (case-sensitive prefix);
   - compare in **constant time** (`crypto.timingSafeEqual`, length-guarded);
   - return **`401` `UNAUTHORIZED` / "Missing or invalid admin token"** for both a
     missing and a wrong token — no oracle distinguishing the two.

3. **Register-only-when-set (fail-closed by absence).** Admin routes are added to
   the route table **only when `adminToken` is set**. Unset ⇒ the routes do not
   exist (**404**), never an open route and never a 401-on-an-existing-route. A
   disabled admin surface is invisible, not merely locked.

4. **Validate token strength at boot** via the shared
   `validateAdminToken(token)` (see below), called from the module's
   `checkReadiness()`: a **production error** on a token shorter than 32 chars or
   matching a known placeholder (`changeme`, `admin-token`, `placeholder`, …).
   Strength is enforced identically across modules, not per package.

5. **Never affect data-plane behavior.** Leaving `adminToken` unset disables only
   the *remote* admin surface. Internal piping (e.g. billing's `syncPlansToDB` at
   boot, in-process, tokenless) is unaffected — it never depends on the token.

## Shared primitives (target home: `@fonderie/core/middlewares`)

`@fonderie/core` depends on nothing and every module already peer-deps it, so
these live in core with no dependency cycle, beside the sibling guards
(`requireAuth`, `validate`):

```ts
// the ONE guard — lifted from billing's admin-token.ts, behavior-identical
export function requireAdminToken(adminToken: string): Middleware;

// the ONE strength check — lifted from config's checkReadiness
export function validateAdminToken(
  token: string | undefined,
  opts: { module: string; surface: string },
): IReadinessProblem[];
```

## Conformance audit (2026-09-06)

| Rule | `@fonderie/billing` | `@fonderie/config` | `@fonderie/courier` |
|---|---|---|---|
| 1 · one top-level `adminToken` | ✅ `config.adminToken` (legacy `planAdminToken` / `wallet.adminToken` deprecated fallbacks) | ✅ `options.adminToken` | ✅ `config.adminToken` |
| 2 · guard: Bearer + constant-time + 401 shape | ✅ behavior correct — but **local copy** | ✅ behavior correct — but **local copy** | ✅ behavior correct — but **local copy** |
| 3 · register-only-when-set → 404 | ✅ | ✅ | ✅ |
| 4 · boot strength validation | ❌ **none** | ✅ min-32 + placeholder reject (prod error) | ❌ **none** |
| 5 · data-plane unaffected when unset | ✅ (`syncPlansToDB` boot-sync) | ✅ | ✅ |

Behaviorally the three guards are **byte-identical today** (same Bearer parsing,
`timingSafeEqual` + length-guard, same `401 UNAUTHORIZED / "Missing or invalid
admin token"`); the drift risk is that they are **three independent copies**
(`safeTokenEqual` is copy-pasted verbatim in
`billing/src/middlewares/admin-token.ts`, `config/src/admin.ts`,
`courier/src/templates/admin-routes.ts`).

## Findings → remediation

- **F1 (drift risk, medium): guard is triplicated.** Extract one
  `requireAdminToken` into `@fonderie/core/middlewares`; delete the three local
  `safeTokenEqual`/`guarded` copies; billing imports it directly, config's
  `guarded`/`checkAdmin` and courier's `guarded` collapse onto it. Behavior-
  preserving → per-package patch/minor.
- **F2 (real gap, high-for-a-security-brick): strength validation only in config.**
  A weak/placeholder token guarding billing's `/plans` + `/billing/wallet/grant`
  or courier's `/admin/templates` passes production readiness today, while the
  same token fails for config. Lift `validateAdminToken` into core and call it
  from **all three** `checkReadiness()` methods.
- **F3 (minor, note only): unset/misconfig signalling differs.** Courier *throws*
  at install when `adminToken` is set without a store; billing/config stay silent
  when unset (correct — unset = no surface). Acceptable; document, don't change.

Do F1 + F2 in one pass (they touch the same three files). Net effect: one guard,
one strength check, applied identically everywhere — this spec becomes something
the compiler and `checkReadiness()` enforce, not a convention to remember.
