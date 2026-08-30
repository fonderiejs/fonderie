# example-mobile-api

A Fonderie backend that speaks the **SaaS Starter** mobile app's REST contract.

The other examples in this folder show adapter parity — the same todo app across
Hono, Express and Koa. This one answers a different question: *can a Fonderie
backend actually serve a real mobile SaaS?* It implements all 15 endpoints the
starter calls, on top of Fonderie's own auth, workspaces, billing and audit.

```bash
npm install
npm run setup          # copies .env.example → .env
npm run migrate        # needs a Postgres in DATABASE_URL
npm run dev            # http://localhost:4004/v1
```

Then point the app at it:

```bash
# in the SaaS Starter's .env
EXPO_PUBLIC_DEMO=0
EXPO_PUBLIC_API_URL=http://192.168.1.42:4004/v1   # your LAN IP, not localhost
EXPO_PUBLIC_AUTH_PROVIDER=rest
EXPO_PUBLIC_AUTH_URL=http://192.168.1.42:4004/v1
```

---

## What comes from where

Only **projects** and **devices** are this app's own tables. Everything else is
Fonderie, re-shaped into the paths the mobile app expects.

| The app calls | Served by |
|---|---|
| `GET/POST/PATCH/DELETE /projects` | this app's `projects` table |
| `GET /members` | `GET /workspaces/members` |
| `POST /members/invitations` | `POST /workspaces/invitations` |
| `PATCH /members/:id` | `POST /workspaces/members/:id/roles` |
| `DELETE /members/:id` | `DELETE /workspaces/members/:id` |
| `GET/PATCH /organization` | `GET/PUT /workspaces` |
| `GET /billing/plans` | `GET /plans` |
| `GET /billing/subscription` | `GET /billing/subscription` |
| `GET /activity` | `GET /audit` |
| `POST /devices` | this app's `devices` table |
| sign in / register / refresh | `POST /auth/*` |

`starter.routes.ts` is the whole adapter — about 300 lines, and the only file
you'd rewrite to change the contract.

### Why it re-shapes instead of exposing Fonderie directly

The mobile app is deliberately backend-agnostic. It calls a flat set of REST
endpoints and has no idea Fonderie exists — no Fonderie package appears anywhere
in it. That means it can point at this backend, at Supabase, or at something you
write yourself, and the translation lives here rather than in the app.

Re-shaping calls Fonderie over its own HTTP surface rather than reading its
tables, so this file cannot break when an internal schema changes.

> **One trap worth knowing.** Internal calls go straight to `fonderie.handle()`,
> not back through the Hono router. Several paths sit on both sides —
> `/billing/subscription` is both served here and called from here — so routing
> an internal call through the app would re-enter the same handler and recurse
> until the stack overflows. There's a test that fails if anyone changes it back.

---

## Requirements

- **Node 20+**
- **Postgres.** `npm run migrate` creates Fonderie's tables plus `projects` and
  `devices`.

No Stripe key is needed to list plans or read a subscription — both read from the
database. You only need one to open a real checkout session.

---

## Tests

```bash
npm test
```

Runs without a database. It asserts every endpoint the starter calls is routed,
that each rejects an anonymous caller, and that internal calls cannot recurse.

Testing against real data needs Postgres — start one, run `npm run migrate`, then
register a user and exercise the endpoints with the token you get back.

---

## Making it yours

1. **Rename `projects`.** It's an ordinary table in `project.model.ts` and
   `migrations/sql/001_create_projects.sql`. Rename it to whatever your product
   actually manages and update the matching type in the app.
2. **Add resources** the same way — model, routes, a migration.
3. **Turn on email verification.** `requireVerification: false` in `fonderie.ts`
   is a local-development convenience. Switch it on before you ship.
4. **Set a real `JWT_SECRET`.** Fonderie refuses to boot in production with the
   dev default, which is the behaviour you want.
