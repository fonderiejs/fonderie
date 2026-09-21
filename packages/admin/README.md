# @fonderie/admin

The operator's surface. One reserved path (default `/_admin`) behind one admin
token, answering what the founder cannot see after deploy: **which bricks are
installed, at what version, whether they are ready, and every route that is
exposed.**

Status: **experimental** (0.x). Design and roadmap: `docs/ADMIN-BRICK-DESIGN.md`.

## Use it

```ts
import { AdminModule } from '@fonderie/admin';

app.register(new AdminModule({ adminToken: process.env.ADMIN_TOKEN }));
```

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.example.com/_admin/manifest
```

- **No token, no surface.** Unset `adminToken` ⇒ nothing is registered (404),
  never an open route. Same rule as every other brick's admin routes
  (`docs/ADMIN-AUTH-SPEC.md`); the token is strength-checked at boot.
- **The prefix is reserved.** No other module can mount under it — a collision
  fails boot, naming both sides. `path` moves the whole surface
  (`{ path: '/ops' }`); it is relative to the app's `basePath`, like every route.

## `GET /_admin/manifest`

```json
{
  "generatedAt": "…", "env": "production",
  "admin": { "version": "0.1.0" },
  "modules": [
    { "name": "@fonderie/auth", "version": null, "readiness": { "ok": true, "problems": [] } },
    { "name": "@fonderie/config", "version": null, "readiness": { "ok": true, "problems": [ { "severity": "warning", "message": "no secretEncryptor configured — …" } ] } }
  ],
  "readiness": { "ok": true, "problems": [ … ] },
  "routes": [ { "method": "POST", "path": "/auth/login", "module": "@fonderie/auth" }, … ]
}
```

`version` is `null` until a brick reports one (`IFonderieModule.version`);
`describesAdmin` says whether the brick offers routes below. Readiness
problems are shown here in production — unlike `/readyz`, which is public —
because the operator is the audience.

## `GET /_admin/doctor` and `GET /_admin`

The five reconciliation checks from `docs/OPERATIONS.md` — and any the app
adds — with a permanent address. Each check reads the other side of a copy
(the provider, DNS, the database), so `/doctor` is on demand, not cached.

```json
{ "generatedAt": "…", "ok": false, "checks": [
  { "name": "billing.subscription-drift", "module": "@fonderie/billing", "ok": false,
    "findings": ["workspace:ws_1 (sub_x): status ours=active theirs=canceled [over-granting]"], "durationMs": 412 },
  { "name": "billing.webhook-registration", "module": "@fonderie/billing", "ok": true,
    "findings": [], "skipped": "config.publicUrl is not set", "durationMs": 0 },
  { "name": "courier.sender-dns", "module": "@fonderie/courier", "ok": true,
    "findings": ["DMARC p=none — monitoring only"], "durationMs": 88 }
] }
```

- `ok` is false only for a hard failure. Findings on a passing check are
  advice and never turn a healthy deployment red.
- A check that throws becomes a finding; one that exceeds `checkTimeoutMs`
  (default 10 s) is reported as timed out. The doctor itself never throws.
- `skipped` says why a check could not run — a provider that cannot be asked,
  a `publicUrl` that is not set — instead of guessing.

`GET /_admin` is the attention page: readiness problems as reported, failed
checks as errors, advice as advice. `ok: true, items: []` is green.

Checks a module cannot own belong to the app:

```ts
new AdminModule({
  adminToken,
  checks: [{
    name: 'app.migrations',
    run: async () => {
      const pending = await runner.pending();
      return { ok: pending.length === 0, findings: pending.map((f) => `pending: ${f}`) };
    },
  }],
});
```

## `GET /_admin/config`, `/_admin/routes`, `/_admin/access/tokens`

- **config** — readiness problems per module, and the presence (never the
  value) of each environment variable the deployment reads. Bricks never
  read `process.env` — config is injected — so the app names them:
  `new AdminModule({ adminToken, env: ['DATABASE_URL', 'STRIPE_SECRET_KEY'] })`.
- **routes** — every route in the table with a guard class: `admin` (behind
  this token), `probe` (core's `/healthz` `/readyz` `/metrics`), `app`
  (everything else — whether it needs a session is not claimed here).
- **access/tokens** — the admin token's readiness verdict, and which bricks
  still register a legacy standalone surface with their own token.

## From the terminal

```sh
export FONDERIE_ADMIN_URL=https://api.example.com FONDERIE_ADMIN_TOKEN=…
fonderie admin attention      # what needs you today
fonderie admin doctor         # every reconciliation check
fonderie admin log --limit 20 # who did what
```

`FONDERIE_ADMIN_PREFIX` when the surface was moved off `/_admin`.

## The admin log

```ts
import { AdminModule } from '@fonderie/admin';
import { getMigrationsPath } from '@fonderie/admin/migrations';

app.register(new AdminModule({ adminToken, store }));   // run the migrations first
```

With a store, every request served by this surface is a row in
`fonderie_admin_log` — actor (the `X-Actor` header, else `admin-token`),
method, path, route, module, status, duration, request id, client IP —
**including the ones the token guard refused.** The log middleware runs
before the guard, and a failed write never fails the request it describes.
Without a store nothing is recorded and the manifest says so
(`admin.log: false`).

`GET /_admin/activity/admin-log?limit=50&before=<cursor>` reads it, newest
first; `next` is the cursor for the following page.

## Composed routes

Bricks that implement `describeAdmin()` have their admin routes mounted here,
behind this module's token, whatever their own `adminToken` is set to. Two
bricks describing the same route fail boot, naming both.

| Under `/_admin` | From | Legacy standalone path (deprecated) |
|---|---|---|
| `GET\|PUT\|DELETE /config[/:key]`, `…/revisions`, `…/rollback` | `@fonderie/config` | `/admin/config…` |
| `GET\|PUT\|DELETE /secrets[/:key]`, `…/revisions`, `…/rollback`, `POST …/reveal` | `@fonderie/config` | `/admin/secrets…` |
| `GET\|PUT\|DELETE /templates[/:type]`, `…/revisions`, `…/rollback` | `@fonderie/courier` | `/admin/templates…` |
| `POST /plans`, `PUT\|DELETE /plans/:planId` | `@fonderie/billing` | `/plans…` |
| `POST /wallet/grant` (with `config.wallet`) | `@fonderie/billing` | `/billing/wallet/grant` |

The legacy paths keep working with each brick's own token and are removed in
a later major; `docs/ADMIN-BRICK-DESIGN.md` §9.

## Why it's a brick

The model that assembled the app knows what is installed, wired and
configured. The human who deployed it does not, unless they are back in a
development session and can ask. `@fonderie/core` already computes the
answer (`securityReport()`, `app.routes()`); this brick gives it an address.
