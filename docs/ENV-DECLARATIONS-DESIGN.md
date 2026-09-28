# Environment declarations — design

**Status:** design + audit (2026-09-28). Nothing built yet.

**Goal:** every brick declares the environment variables it depends on, and a
project's `.env.example` and `.env` are *generated* from the bricks it actually
installs — so the list can never drift from the dependency graph. The same
declarations drive `fonderie env check` and the admin console's Environment page.

---

## 1. Why — what the audit found

A read-only sweep of every backend brick (`src/**` of 24 packages, all tracked
`.env.example` files, the examples, the starter, the brain, and the two consumer
apps' wiring) found:

1. **There is no source of truth.** Six `.env.example` files ship, and no two
   agree. The template `create-fonderie-app` actually clones
   (`fonderiejs/template-starter`, untouched since 2026-07-28) lists `REDIS_URL`,
   which nothing reads; the in-repo `templates/starter` lists a different set.
   The express/hono/koa examples read `FRONTEND_URL` and `PORT` but do not list them.
2. **Bricks almost never read `process.env`.** Values arrive as constructor
   options, and the *app* picks the env name. So the names live only in docs,
   and the docs disagree (§4). Direct reads exist in exactly four places:
   core (`NODE_ENV`, `TRUST_PROXY`, `FONDERIE_BACKGROUND_TASKS`,
   `FONDERIE_BACKGROUND_TIMEOUT_MS`), store (`NODE_ENV`), risk (`RISK_PEPPER`),
   and the CLI's own commands. The admin README's "bricks never read
   `process.env`" is false.
3. **`fonderie add` writes from a hardcoded table** (`packages/cli/bin/fonderie.mjs:202-279`)
   that can only ever produce `DATABASE_URL` and `JWT_SECRET` — the latter with a
   placeholder value that auth refuses in production.
4. **The console's Environment page is a hand-typed list.** `AdminModule({ env })`
   is an app-supplied `string[]`; entries carry only `{ name, set }`. The reference
   app's list already omits eight variables it reads.
5. **Required-ness is enforced inconsistently.** Some bricks fail boot through
   readiness (auth `JWT_SECRET`, admin `ADMIN_TOKEN`), some throw in a constructor
   and never appear on `/readyz` (risk `RISK_PEPPER`, store's production DB
   checks), and some fail only on first use (billing's webhook secret → 500,
   courier SMTP → throws at send). A declaration that says "required" must match
   what the brick enforces — §5 lists the gaps.
6. **The brain knows two variable names** (`SMTP_HOST`, `SMTP_URL`) across 62
   concepts and 56 recipes, so an agent scaffolding an app has no env guidance.

---

## 2. The declaration

Each brick ships `env.json` at its package root, listed in `files` and exported
as `"./env.json"`. Static JSON, not code: the CLI must read it from
`node_modules` without executing the brick or connecting to a database, and
the admin module imports the same file at runtime.

```jsonc
{
  "$comment": "…what reads this file…",
  "brick": "@fonderie/auth",            // must equal package.json "name"
  "vars": [
    {
      "name": "JWT_SECRET",
      "source": "option",               // direct | option | platform
      "required": "always",             // always | production | feature | never
      "secret": true,
      "kind": "secret32",               // see kinds below
      "feeds": "jwtSecret",             // the option it feeds, or what reads it
      "generate": "base64-32",          // CLI fills it; exclusive with "dev"
      "enforcedBy": "readiness:JWT_SECRET_TOO_SHORT|JWT_SECRET_PLACEHOLDER (error in production)",
      "description": "Signs session tokens. At least 32 characters, no placeholder words."
    },
    {
      "name": "GOOGLE_REDIRECT_URI",
      "source": "option", "required": "feature", "feature": "google",
      "secret": false, "kind": "url", "feeds": "google.redirectUri",
      "deprecatedNames": ["GOOGLE_CALLBACK_URL"],
      "description": "Callback URL registered with Google, ending in /auth/oauth/google/callback."
    }
  ],
  "features": {
    "google": { "description": "Sign in with Google — all or none (readiness GOOGLE_INCOMPLETE)" }
  }
}
```

The shipped files are canonical: `packages/<brick>/env.json`. The rules are
enforced by `validateDeclaration` in `packages/cli/bin/env.mjs` — a `feature`
var names a described feature, a described feature has vars, only secrets are
generated, `generate` and `dev` are exclusive, platform variables are never
written. `dev` is allowed on a secret (a local `DATABASE_URL` is useful); a
generated one is fresh per project instead.

**`source`** separates three kinds of variable that must be treated differently:

| source | meaning | generator | check |
|---|---|---|---|
| `direct` | the brick reads `process.env[name]` itself | writes it | presence + kind |
| `option` | the brick takes an option; `name` is the canonical env name the app should read it from | writes it | presence + kind; `fonderie env check` greps the app for the name |
| `platform` | set by the host (`VERCEL`, `K_SERVICE`, …) | **never writes it** | informational only |

**`kind`** is the validator both the CLI and readiness use:
`secret32` (core's `secretStrengthProblem`), `hex64` (exactly 64 hex chars),
`url`, `postgres-url`, `int`, `bool`, `csv`, `enum:<a|b>`, `pem`, `string`.

**`generate`** is done by the CLI with `crypto.randomBytes`, not by shelling
out: `hex-32` (64 hex chars) or `base64-32`. One recipe per variable — this
retires the `-hex` vs `-base64` disagreement (§4).

**`features`** declares all-or-nothing groups (Google, Apple, the wallet, S3).
The generator writes a group commented out, and the check reports "partially
set" — the same condition auth's `GOOGLE_INCOMPLETE` / `APPLE_INCOMPLETE`
already refuse at boot.

**The app gets a declaration too.** A root `fonderie.env.json` with the same
schema holds app-owned variables (price IDs, market lists, retention windows,
worker settings). Without it the console list could never be complete, and
apps would go back to hand-keeping one.

---

## 3. Composition, generation, checking

### 3.1 Resolving the set

1. Read the app's `package.json` `dependencies`.
2. For every `@fonderie/*` found, resolve its `env.json` from `node_modules`
   and follow *its* `dependencies` and **required** `peerDependencies` (media →
   storage, every brick → core). An optional peer is followed only if the app
   installs it (§7.1).
3. Union by `name`. The same name from two bricks must agree on `kind` and
   `secret`, otherwise the command fails and names both bricks. `required` takes
   the strongest; `requiredBy` records every brick. `DATABASE_URL` and
   `ADMIN_TOKEN` are the normal case: several bricks, one variable.
4. Add the app's `fonderie.env.json`.

Resolution is a pure function `resolveEnv(pkgRoot) → EnvEntry[]` exported from
`@fonderie/cli`, so the check, the generator and tests share it.

### 3.2 `fonderie env generate`

- **`.env.example`** — rewritten in full each run. Grouped by brick, one comment
  line per variable (description, required, how to generate), secrets empty,
  non-secrets at their `default`, features commented out. A header says the file
  is generated and names the command.
- **`.env`** — merged, never clobbered. Existing values are kept. Missing entries
  with `generate` get a fresh random value; missing entries with `dev` get it.
  Everything left (Stripe keys, OAuth credentials, SMTP) is written empty and
  listed at the end of the run as "you must supply". `.env` must be gitignored,
  or the command refuses to write secrets.
- `fonderie add` stops using `MODULE_SPECS.env` and calls the generator.

### 3.3 `fonderie env check`

Three comparisons, each printing its denominator:

1. **declared ↔ `.env.example`** — missing or stale lines. Exit 1 when out of sync (the CI mode).
2. **declared ↔ a `.env` file** (`--env-file`), or ↔ a live deployment
   (`--remote`, through `GET /_admin/environment`) — unset required variables,
   values that fail their `kind`, partial features.
3. **declared ↔ the app's code** — every `source: option` name the app never
   references, and every `process.env.X` in the app that no declaration covers.
   Heuristic grep, so it only warns.

### 3.4 The console

`AdminModule` reads the `env.json` of every *registered* module plus the app
declaration, and `GET /_admin/environment` returns
`{ name, set, required, secret, brick, valid }` per entry. The `env` option
stays for one minor as an addition to the list, then is deprecated. Values are
never returned, as today.

---

## 4. Names to settle before any manifest is written

The declarations make one name canonical. Every row below currently has more
than one spelling or none; the proposed canonical name is first.

| Value | Canonical | Other spellings today | Where |
|---|---|---|---|
| config secret encryption key | `CONFIG_SECRET_KEY` | `SECRET_KEY` | config README:67 vs DEPLOYMENT.md:312 and both consumer apps |
| billing wallet webhook secret | `STRIPE_WALLET_WEBHOOK_SECRET` | `STRIPE_PAYMENT_WEBHOOK_SECRET` | **Decided:** the deployed name; README corrected |
| billing subscription webhook secret | `STRIPE_WEBHOOK_SECRET` | *(none in any fonderie doc)* | used by both consumer apps |
| Google redirect | `GOOGLE_REDIRECT_URI` | `GOOGLE_CALLBACK_URL` | the two consumer apps disagree; option is `redirectUri` |
| Apple redirect | `APPLE_REDIRECT_URI` | `APPLE_CALLBACK_URL` | **Decided:** `APPLE_REDIRECT_URI` canonical, `APPLE_CALLBACK_URL` a deprecated alias the check reports |
| auth MFA key | `MFA_SECRET_KEY` | *(none anywhere)* | `mfaSecretKey` has a readiness check but no documented env name |
| admin operator key | `ADMIN_OPERATOR_KEY` | *(not in admin README)* | consumer apps |
| admin host binding | `ADMIN_HOST` | *(not in admin README)* | consumer apps |
| JWT secret recipe | `base64-32` | `-hex 32` in the starter | DEPLOYMENT.md:45 and `config-guard.ts:156` say base64 |
| JWT placeholder | *(none — generated)* | three different placeholder strings | CLI, examples, starter |
| admin token (server) | `ADMIN_TOKEN` | `FONDERIE_ADMIN_TOKEN` is the CLI-side copy of the same value | deliberate split; the CLI's declaration links them |
| retention windows | `EVENT_RETENTION_DAYS`, `USER_RETENTION_DAYS` | app convention, no package default | declared by events / auth as optional, `default` documented as 365 / 30 |
| S3 provider | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | *(none anywhere)* | new names |

Renaming a deployed variable is a breaking change for the apps, so each rename
ships with the old name read as a fallback for one major, and `env check`
reports the old name as "deprecated, rename to X".

---

## 5. Findings the audit surfaced (independent of the feature)

Each of these makes a declaration lie until it is fixed. Severity is about the
declaration's honesty, not security.

**Fixed in the prerequisites PR:** E1 (options may be the 2nd argument; the
secret form is deprecated), E2 + E3 (readiness `WEBHOOK_SECRET_MISSING`,
`WALLET_WEBHOOK_SECRET_MISSING`, warnings when payments are on), E4 (core's
shared rule), E7 (readiness `WEAK_INTEGRITY_KEY` — a strength check, so the
declared kind is `secret32`, not `hex64`), E11, E12, E13, and E20 for the
in-repo starter. The cloned `template-starter` repo is regenerated in build step 5.

| # | Brick | Finding | Evidence |
|---|---|---|---|
| E1 | billing | `new StripeProvider(key, webhookSecret)` — the 2nd argument is never read; the README and both consumer apps pass it believing it verifies signatures. Only the config-level `webhookSecret` does | `providers/stripe.ts:445`, billing README:115 |
| E2 | billing | Unset `webhookSecret` makes `POST /billing/webhook` answer 500 with no readiness problem; every quickstart omits it | `webhook-shared.ts:78-79`, README:23-28, GETTING-STARTED.md:57 |
| E3 | billing | `wallet.webhookSecret` unset → `/billing/webhook/payment` 500, no readiness problem | `payment-webhook.controller.ts:242-250` |
| E4 | risk | `RISK_PEPPER` is validated in the constructor with its own 3-word denylist, not core's `secretStrengthProblem`, and never appears on `/readyz` | `risk/src/hashing.ts:11-22` |
| E5 | store | Production DB misconfiguration throws in the constructor, not through readiness | `store/src/adapters/pg.ts:14-34` |
| E6 | auth | `MFA_KEY_MISSING` checks only static `config.mfa`; MFA enabled at runtime through config `resolve` bypasses it | `config-guard.ts:116-137` |
| E7 | events | The integrity key is documented as 64 hex but any non-empty string is accepted | `transports/pg.ts:269` |
| E8 | events | A bad `connectionUrl` is swallowed at install (`.catch(console.error)`) | `events/src/module.ts:168` |
| E9 | courier | Nothing checks SMTP settings at boot; API.md claims a missing `SMTP_HOST` fails boot | `channels/email.ts:68-70`, `.claude/skills/fonderie/API.md:368-370` |
| E10 | courier | `'ses'` is in the provider union but unimplemented — sends are dropped with a warning | `channels/email.ts:34` |
| E11 | config | README snippet crashes when `SECRET_KEY` is unset although its comment says "or omit" | config README:67 |
| E12 | admin | README documents the env report at `/_admin/config`; the route is `/_admin/environment` | admin README:92-96 |
| E13 | admin | `operators/crypto.ts:181` says readiness reports a missing operator key; it deliberately does not | `module.ts:447-451` |
| E14 | core | `FonderieConfig.db.url`, `billing.stripeSecretKey`, `email.{apiKey,smtp}` are declared and never read | `core/src/config.ts:22-40` |
| E15 | core | `TRUST_PROXY` is documented only in the rate-limit README; `FONDERIE_BACKGROUND_TIMEOUT_MS` nowhere | — |
| E16 | logger | An invalid `level` makes every level log | `logger.ts:22,59` |
| E17 | workspaces | An invalid `invitationTtl` silently becomes 7d | `services/invitations.ts:23` |
| E18 | storage | Setting only one of the two S3 keys silently drops both and uses the ambient AWS chain | `providers/s3.ts:61` |
| E19 | media | Doc comment says `DbBlobProvider` is the default; `provider` is required with no default | `media/src/config.ts:5` |
| E20 | starter | The cloned template lists `REDIS_URL` (read by nothing) and omits `FRONTEND_URL`; the in-repo starter reads `PG_POOL_MAX` without listing it | `fonderiejs/template-starter`, `templates/starter/src/fonderie.ts:23` |

---

## 6. Draft declarations, per brick

> Superseded by the shipped `packages/*/env.json` (build step 3). Kept as the
> audit-time draft; where they differ, the files win — e.g. `EVENTS_INTEGRITY_KEY`
> is `secret32`, `PORT` is core's, retention and `CRON_SECRET` are app-owned.

`R` = required: **A** always, **P** production only, **F** when its feature is
used, **–** optional. `S` = secret. `G` = generate recipe.

**@fonderie/core**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `NODE_ENV` | direct | P | | `enum:development\|test\|production` | dev `development` |
| `TRUST_PROXY` | direct | – | | `int` | default 0 (ignore X-Forwarded-For) |
| `FONDERIE_BACKGROUND_TASKS` | direct | – | | `enum:auto\|await\|detach` | default `auto` |
| `FONDERIE_BACKGROUND_TIMEOUT_MS` | direct | – | | `int` | default 5000 |
| `FRONTEND_URL` | option (`withCors.origin`) | – | | `url` | dev `http://localhost:5173` |
| `VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`, `FUNCTION_TARGET`, `K_SERVICE`, `FUNCTIONS_WORKER_RUNTIME` | platform | – | | | never written |

**@fonderie/store**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `DATABASE_URL` | option (`PGAdapter`) | A | ✓ | `postgres-url` | dev `postgres://localhost/app` |
| `PG_POOL_MAX` | option (`pool.max`) | – | | `int` | default 10; 1 on serverless |

**@fonderie/auth**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `JWT_SECRET` | option | A | ✓ | `secret32` | `base64-32` |
| `MFA_SECRET_KEY` | option (`mfaSecretKey`) | F (mfa) | ✓ | `hex64` | `hex-32` |
| `PASSWORD_RESET_URL` | option | – | | `url` | unset = PIN-only reset |
| `USER_RETENTION_DAYS` | option (purge helper) | – | | `int` | documented 30 |
| feature `google`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ✓, `GOOGLE_REDIRECT_URI` | option | F | | `string`/`url` | human |
| feature `apple`: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` ✓ (`pem`), `APPLE_REDIRECT_URI`, `APPLE_NATIVE_CLIENT_IDS` (`csv`) | option | F | | | human |

**@fonderie/billing**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | option | A | ✓ | `string` (`sk_`) | human |
| `STRIPE_WEBHOOK_SECRET` | option (`webhookSecret`) | A (after E2) | ✓ | `string` (`whsec_`) | human |
| `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL` | option | A | | `url` | dev from `FRONTEND_URL` |
| `PUBLIC_API_URL` | option (`publicUrl`) | – | | `url` | unset skips the webhook-registration doctor check |
| feature `wallet`: `STRIPE_WALLET_WEBHOOK_SECRET` | option | F | ✓ | `string` | human |
| `ADMIN_TOKEN` | option | – | ✓ | `secret32` | shared, see admin |

**@fonderie/courier**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `SMTP_FROM` | option (`email.from`) | A | | `string` | human |
| `SMTP_REPLY_TO` | option | – | | `string` | |
| feature `smtp`: `SMTP_HOST`, `SMTP_PORT` (`int`), `SMTP_SECURE` (`bool`), `SMTP_USER`, `SMTP_PASS` ✓ | option | F | | | human; dev points at a local catcher |
| feature `resend`: `RESEND_API_KEY` ✓ | option | F | | | human |
| feature `twilio`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` ✓ | option | F | | | human |
| feature `sender-dns`: `SMTP_DKIM_SELECTORS` (`csv`), `SMTP_RETURN_PATH_DOMAIN` | option | – | | | doctor only |
| feature `delivery-webhooks`: `MAILGUN_SIGNING_KEY` ✓, `SENDGRID_VERIFICATION_KEY` (public, not secret) | option | F | | | human |

**@fonderie/config**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `CONFIG_SECRET_KEY` | option (`createAesGcmEncryptor`) | – (secrets surface 503s without it) | ✓ | `hex64` | `hex-32` |
| `DATABASE_URL` | option (`connectionUrl`, LISTEN) | – | ✓ | shared | |
| `ADMIN_TOKEN` | option | – | ✓ | shared | |

**@fonderie/admin**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `ADMIN_TOKEN` | option | A (surface 404s without it) | ✓ | `secret32` | `hex-32` |
| `ADMIN_OPERATOR_KEY` | option (`operatorKey`) | F (operators) | ✓ | `hex64` | `hex-32` |
| `ADMIN_HOST` | option (`host`) | – | | `csv` | unset = any host |

**@fonderie/events**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `DATABASE_URL` | option | A | ✓ | shared | |
| `EVENTS_INTEGRITY_KEY` | option (`integrityKey`) | – (readiness warning) | ✓ | `secret32` | `hex-32` |
| `EVENT_RETENTION_DAYS` | option (`purgeEvents`) | – | | `int` | documented 365 |
| `CRON_SECRET` | option (the scheduled-work route) | F (cron) | ✓ | `secret32` | `hex-32` |
| feature `worker`: `WORKER_SECRET` ✓, `PORT` | option (`runWorker`) | F | | | `hex-32` |

**@fonderie/risk**

| name | source | R | S | kind | G / default |
|---|---|---|---|---|---|
| `RISK_PEPPER` | direct + option | P | ✓ | `secret32` | `hex-32` |

**@fonderie/storage** — feature `s3`: `S3_BUCKET`, `S3_REGION` (default `us-east-1`),
`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` ✓. Feature `local-fs`: `STORAGE_DIR`.

**@fonderie/geo** — no variables; its `trust` argument is derived from the platform
`VERCEL` marker. **@fonderie/logger** — `NODE_ENV` (shared), optional `LOG_LEVEL`
(after E16). **workspaces, webhooks, media, customers, permissions, audit,
rate-limit, adapters** — no variables. They ship an `env.json` with `"vars": []`,
so "declares nothing" is a checked fact, not a missing file.

**@fonderie/cli** — its own commands: `FONDERIE_ADMIN_URL`, `FONDERIE_ADMIN_TOKEN`
(✓, same value as the server's `ADMIN_TOKEN`), `FONDERIE_ADMIN_PREFIX`,
`FONDERIE_ACTOR`. Listed in its declaration so they are documented, but not
written to an app's `.env`.

---

## 7. Prototype results (2026-09-28)

A throwaway prototype (resolve + generate + merge + check + gate, 17 tests) ran
against the **real** dependency graphs, `.env.example` files and brick sources.
All 17 pass. What it changed in this design:

1. **Optional peers are not followed.** Every adapter lists billing, workspaces
   and permissions as *optional* peers; following them asked a plain Express app
   for Stripe keys. Rule: follow `dependencies` and required peers; follow an
   optional peer only when the app installs it itself. Media → storage (a
   required peer) is still followed.
2. **Each brick declares its own direct reads, even shared ones.** `NODE_ENV` is
   read directly by core, store, auth, billing, config, risk and logger — not
   only core. Resolution merges them into one entry; the gate needs them per brick.
3. **The gate must ignore comments.** 8 of its first 19 hits were JSDoc/comment
   examples (`FRONTEND_URL` in the adapters, `WORKER_SECRET`/`PORT` in
   `runWorker`'s doc, `CONFIG_SECRET_KEY_OLD` in `rotate.ts`, `VERCEL` in geo).
   The real gate uses the TypeScript scanner, not a regex. Mutation check: removing
   store's `NODE_ENV` declaration fails the gate (353 files, 22 bricks scanned).
4. **Installed ≠ mounted.** Three examples install courier only for its `Channel`
   constant, so static resolution asks them for `SMTP_FROM`. Static resolution
   (generate, `env check` on files) is therefore a **superset**; the console and
   `env check --remote` use the modules actually registered, which is exact.
5. **Drift is ranked.** "Required variable missing" is an error;
   "optional variable not listed" is informational. Optional variables with no
   default are written commented out, never as `NAME=` (empty ≠ unset).

Drift the check finds in today's files (required only):

| file | required missing | stale |
|---|---|---|
| example-express | – | – |
| example-hono / example-koa | `SMTP_FROM` (installed-not-mounted) | – |
| example-mobile-api | `STRIPE_WEBHOOK_SECRET` (finding E2), `SMTP_FROM` | `PORT` |
| templates/starter | – | `PORT` |

`PORT` shows as stale because no brick declares it — it belongs in the app's
`fonderie.env.json`, which is the case the app-level declaration exists for.

---

## 8. Build order

1. **Settle §4's names** (two decisions marked there).
2. **Fix the findings a declaration depends on:** E1–E4, E7, E11–E13, E20.
   The remaining findings are independent.
3. ✅ **Schema + `resolveEnv`** in `@fonderie/cli` (`bin/env.mjs`), with the gate
   `check:env-declarations`: every backend brick ships a valid, exported
   `env.json`; every `process.env` read in its `src/` is declared `direct` or
   `platform`; every `direct` variable is really read; code passing the whole
   object is listed in `OPAQUE` with what it reads; all bricks resolve together
   without conflict. The gate proves its scanner on a probe before scanning.
4. ✅ **Declarations** for all 22 backend bricks (11 declare `vars: []`).
5. ✅ **`fonderie env generate`** (`--example-only`, `--check`, refuses an
   untracked-unsafe `.env`); `fonderie add` now writes `.env.example` through it
   and its hardcoded env table is gone. **5b (after the declarations publish):**
   bump the examples and the starter onto releases that ship `env.json`,
   regenerate their `.env.example`, push the `template-starter` repo, and run
   `fonderie env generate --check` on them in CI.
6. **`fonderie env check`**, run in CI against the examples.
7. **Console:** `/_admin/environment` reads the declarations; `env` option deprecated.
8. **Brain:** one concept (`environment`) generated from the declarations, so
   agents see every variable instead of two.
