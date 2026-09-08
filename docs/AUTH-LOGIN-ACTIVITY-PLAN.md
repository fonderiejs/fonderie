# Auth Login Activity — multi-phase plan

Goal: power two per-user security screens — **Login History** (every attempt:
date, device, IP, method, success/failed, export) and **Active Sessions**
(devices signed in now, current badge, terminate one / all others) — as
`@fonderie/auth` features, not app code.

Status (updated 2026-09-08):
- Phase 1 — SHIPPED (`@fonderie/auth` minor). Session ip/ua persisted +
  `fonderie_login_events` table + recording across password/MFA/OAuth.
- Phase 2 — SHIPPED (`@fonderie/auth` + `@fonderie/client` minor). Four
  caller-scoped routes + AuthClient methods.
- Phase 3 — SHIPPED (`@fonderie/react-auth` minor). `useLoginHistory`,
  `useSessions`.
- Phase 4 — BLOCKED ON RELEASE. The LeadEasyGen app consumes the *published*
  `@fonderie/react-auth` (0.7.0), not the workspace source, so the screens
  can't be built until Phases 1–3 are versioned + published to npm and the
  app bumps its dependency. Changesets are staged; publishing is the
  user-gated release train, not an autonomous step.
- Phase 5 — deferred as designed.

239 package tests green (auth 207 / client 13 / react-auth 19); all three
typecheck clean.

## Findings this plan is built on

- `fonderie_sessions` already has `user_agent` and `ip_address` columns, but
  the INSERT (`session.model.ts`) never writes them — every row is NULL.
  The only reader today is the SAR export (`GET /users/export`).
- There is **no** session-management API: no list, no terminate, no
  terminate-others. Logout revokes only the current refresh session.
- Failed login attempts are recorded **nowhere** — no table, no bus event.
- No `last_active_at` anywhere; access tokens are stateless JWTs (~24h)
  carrying a `sid` claim, and only `/auth/refresh` touches the session row.
- `@fonderie/audit` is the wrong home: workspace-scoped team activity,
  depends on auth (arrow would invert), and failed attempts pre-date
  authentication. This data is born in auth's controllers; auth owns it.
- Reusable bricks already in place: `keyset-cursor` in `@fonderie/core`
  (audit's pagination), the hook-package convention (each hook package
  re-exports the client symbols its API surfaces).

## Principles

- **DRY**: one request-metadata helper feeds both features; pagination
  reuses core's keyset cursor; CSV export happens client-side from the same
  rows the hook already holds (no export endpoint); active sessions stay in
  `fonderie_sessions` (no second copy in the events table).
- **KISS**: store the raw user-agent, parse it in the UI; location is
  "Unknown" until a GeoIP phase is deliberately chosen; no per-request
  DB writes for last-active; no new package — auth/client/react-auth grow
  a feature each.

## Screen coverage — every mockup element, mapped to its phase

| Screen element | Powered by | Phase |
|---|---|---|
| Login History: date & time | `fonderie_login_events.created_at` | 1 |
| Login History: device | raw UA stored (1), parsed in UI (4) | 1 + 4 |
| Login History: IP address | `requestMeta` helper → events row | 1 |
| Login History: method (password/2fa/oauth) | `method` column at each outcome point | 1 |
| Login History: status success/failed | `outcome` + `failure_reason` | 1 |
| Login History: list + pagination | `GET /auth/login-history` → `useLoginHistory` | 2 + 3 |
| Login History: Export History button | client-side CSV from loaded rows | 4 |
| Login History: location | "Unknown" until GeoIP is chosen | (5) |
| Active Sessions: device cards (UA, IP) | session INSERT fix + `GET /auth/sessions` | 1 + 2 |
| Active Sessions: "Current" badge | row sid = JWT `sid` claim | 2 |
| Active Sessions: Terminate (one) | `DELETE /auth/sessions/:id` → `useSessions` | 2 + 3 |
| Active Sessions: Terminate All Others | `DELETE /auth/sessions/others` → `useSessions` | 2 + 3 |
| Active Sessions: "Last active" line | refresh-touch `last_active_at` — shows "Signed in <date>" until then | (5) |
| Active Sessions: location | same GeoIP decision as above | (5) |

Both screens ride the same Phase 1 capture; neither ships without it.

## Phase 1 — Capture (auth: the data both screens need)

1. One `requestMeta(ctx)` helper (x-forwarded-for-aware IP + user-agent),
   used everywhere below. Fix the session INSERT to persist both. (Bug fix.)
2. Migration: append-only `fonderie_login_events` —
   `id, user_id NULLABLE, email_attempted, method
   ('password'|'mfa'|'oauth-google'|…), outcome ('success'|'failed'),
   failure_reason NULLABLE, ip_address, user_agent, created_at`
   + index `(user_id, created_at DESC)`. `user_id` nullable so
   unknown-email attempts still record.
3. `recordLoginEvent(...)` model call at each outcome point: email login
   success/fail, MFA success/fail, OAuth callback success/fail. Fire-and-
   forget (a logging failure must never block a login).
4. Tests: failed login writes a `failed` row with reason; success writes
   `success` + the session row carries IP/UA. Negative-test both.

Ships as: auth minor (feature + bugfix), changeset.

## Phase 2 — Read/manage API (auth) + typed client

1. `GET /auth/login-history` — requireAuth, caller-scoped, keyset-cursor
   paginated (reuse `@fonderie/core` cursor; filters: outcome, from/to).
2. `GET /auth/sessions` — live rows for the caller; `current: true` where
   row sid = JWT sid.
3. `DELETE /auth/sessions/:id` and `DELETE /auth/sessions/others` —
   caller-scoped. **Documented semantics**: termination revokes refresh
   immediately; an outstanding access JWT stays valid until `exp`. (A
   liveness check in requireAuth is a deliberate non-goal here — it would
   put a DB read in every request; revisit only if product demands it.)
4. `@fonderie/client` AuthClient: `getLoginHistory`, `listSessions`,
   `terminateSession`, `terminateOtherSessions`; schemas exported.

## Phase 3 — Hooks (react-auth first, vue/rn parity after)

- `useLoginHistory` — cursor + `loadMore`, mirroring `useAuditEvents`'s
  shape so the two log UIs feel identical to build against.
- `useSessions` — list + `terminate(id)` + `terminateOthers()`, optimistic
  removal.
- Re-export the client symbols surfaced, per the one-import-per-package
  convention. Pre-built screens in `react-auth-screens` are a later nice-
  to-have; consumers can render their own first.

## Phase 4 — LeadEasyGen screens (app code, thin by design)

- Settings → Security: Login History table (device = UA parsed client-side,
  location "Unknown" for now, CSV export from loaded rows) and Active
  Sessions cards (current badge, Terminate / Terminate All Others with
  confirm dialog — reuse `ConfirmDialog`).

## Phase 5 — Deferred, each its own decision

- `last_active_at`: update only on `/auth/refresh` (a write that already
  happens) — never per-request.
- GeoIP location: backend-proxied lookup (no client keys), cache by IP.
- `auth.login.failed` / `auth.login.new-device` bus events → courier
  "new sign-in" notification (+ default template, per the notification
  normalization rule).
- Retention: sweep `fonderie_login_events` older than N days in auth's
  existing retention job.

## Explicit non-goals

- Not in `@fonderie/audit` (workspace-scoped, wrong dependency direction).
- No server-side UA parsing or CSV endpoint.
- No access-token liveness check on every request (see Phase 2.3).
