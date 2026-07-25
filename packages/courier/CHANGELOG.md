# @fonderie/courier

## 5.0.0

### Patch Changes

- 52c52f7: Security: bump `nodemailer` `^8.0.7` → `^9.0.3` to clear a high-severity
  advisory (CRLF/List-\* header injection, jsonTransport file-access bypass, and
  improper TLS validation in OAuth2 token fetch — GHSA-268h-hp4c-crq3 and
  related). Courier uses only the stable `createTransport`/`sendMail` surface,
  so the major bump is transparent to consumers.
- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0
  - @fonderie/events@5.0.0

## 4.0.0

### Minor Changes

- 2d4dac8: Add `app.checkProductionReadiness()` — one call that aggregates every module's
  config footguns into a structured report (`{ ok, problems[] }`) you can gate a
  deploy on or expose from a readiness endpoint, instead of relying on scattered
  boot-time warnings. Modules opt in via an optional `IFonderieModule.checkReadiness()`;
  core aggregates without importing them (`ok` is false on any `error`-severity
  problem). Auth reports a weak/placeholder `jwtSecret` (error) and
  `secureCookies: false` (warning); courier reports message types routed to a
  channel with no provider (warning). The existing auto-guards (auth fails closed
  in production, courier warns at boot) are unchanged — this adds the inspectable
  data path alongside them.
- 41dfd9c: Production-readiness preflight: at boot (`CourierModule.install`) courier now
  **warns when a message type is routed to a channel that has no registered
  provider** — e.g. `email-verification → email` with no email provider, which the
  dispatcher would otherwise silently drop (locking users out with
  `requireVerification` on). Warn-only (channel setups vary legitimately; never
  blocks boot). Checks the actually-registered channels, so channels added via
  `registerChannel` count as present. Exported as `validateCourierConfig` for an
  app's own preflight; `Dispatcher.channelNames()` lists registered channels.
- 8dcfc28: Courier template admin surface — bring versioned template management to config
  parity. `CourierModule` registers `/admin/templates/*` routes **only when an
  `adminToken` is configured** (fail-closed; requires `@fonderie/store` for db
  templates), each guarded by a `Bearer` token. Endpoints mirror config: list /
  get / put (with `ifVersion` optimistic concurrency → **409**) / delete /
  `GET :type/revisions` / `POST :type/rollback`. Templates are keyed by
  `(type, locale)` — the `?locale` query scopes a request, a null locale is the
  base — and writes record an actor (optional `X-Actor` header). Exports
  `buildTemplateAdminRoutes` and `deleteTemplate`.

  The CLI gains a `template` verb group — `fonderie template get|set|delete|history|rollback`
  against a live deployment's admin API (`FONDERIE_ADMIN_URL` + `FONDERIE_ADMIN_TOKEN`),
  scoped with `--locale` and carrying `--subject` / `--html` on `set`.

- 7f3a180: Versioned email templates — the second adopter of the shared `@fonderie/store`
  versioned-resource primitive. Templates (keyed by `type` + nullable `locale`,
  content `subject/html/text`) now carry a `version`, an append-only revision
  history, and rollback, with optimistic concurrency on edits. New exports:
  `setTemplate` (upsert with `ifVersion` → `VersionConflictError` on a stale
  compare-and-swap), `rollbackTemplate`, `listTemplateRevisions`,
  `getTemplateEntry`, `listTemplateEntries`. The resolver and the whole email
  pipeline are unchanged — templates simply gained an edit/history/rollback
  lifecycle. Proven end-to-end against real Postgres (edit, rollback, and the
  resolver still reading the current version).

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0
  - @fonderie/events@4.0.0

## 3.0.0

### Minor Changes

- 6e9f785: Production-grade, composable email templates. Templates are now **body
  fragments** injected into a shared branded layout shell (`templates/layout.ts`)
  — a cross-client-hardened responsive frame (max-width card, hybrid inline +
  `<style>` CSS, mobile media query, Outlook VML shim) with a small retunable
  theme token set (`EMAIL_THEME`). One shell, many bodies: the DB and FS resolvers
  both compose it, so every transactional email renders the same frame for free.

  Seeds now ship the templates auth and workspaces actually send —
  `email-verification`, `password-reset`, `workspace-invitation`, `email-changed`
  (previously only `email-verification` was seeded; the rest fell through to a raw
  JSON debug fallback). Founders can override the whole shell by storing a
  `_layout` template (DB row or `_layout.html` file); a template that is already a
  full HTML document is passed through untouched (never double-wrapped).

  Localization is now wired end-to-end. `IAuthUser` carries the user's `locale`
  (sourced from the DB row via the session middleware), and every auth/workspaces
  notification emit now stamps `locale` on the courier message so per-locale
  templates are actually selected. The resolver's locale lookup was made
  region-safe: it serves the **exact** locale or the neutral `NULL` default and
  **never a sibling region** (`en-CA` will not fall back to `en-US`) — the SQL now
  uses `locale IS NOT DISTINCT FROM $2` ordering plus a `(locale = $2 OR locale IS
NULL)` filter, so legal/jurisdictional copy can't bleed across regions.
  Workspace invitations intentionally omit `locale` (the invitee's language is
  unknown at invite time) and fall to the neutral default.

- b98ccaa: Seed the remaining transactional templates so every message type the SDK emits
  has a production-grade default. Adds `email-registration` (the signup
  confirmation — the first email a new account receives), the four MFA/phone
  security notices (`mfa-enabled`, `mfa-disabled`, `mfa-backup-codes-regenerated`,
  `phone-changed`), and the `phone-otp` SMS template (text-only, no shell). All
  ten emitted types (auth + workspaces) are now covered; none fall through to the
  raw-JSON debug fallback. Validated + idempotent against Postgres 16.
- f9e8dc9: Align the default email theme with the product design system
  (`organization/ui/base.css`): near-black primary (`#171717`) for the button/ink,
  a mint brand accent (`#00d294`) as a thin top rule, the accessible teal
  (`#009767`) for links, the `#fafafa` canvas, the Inter font stack, tighter
  display tracking, and the product's `8px`/`6px` radii. `EMAIL_THEME` gains
  `brandAccent` and `link` tokens; retune it to rebrand every email at once. Pure
  presentation — no template copy or API changes.

### Patch Changes

- a20b7da: Change the email `brandAccent` (the thin top rule) from the mint `#00d294` to the
  near-black `#171717`, matching the primary — the email frame is now fully
  monochrome.
- 19b423f: Align the `email-registration` plain-text heading with its HTML: the text body
  opened with `Welcome` while the HTML `<h1>` read `Welcome aboard`. Both now read
  `Welcome aboard`.
- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0
  - @fonderie/events@3.0.0

## 2.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0
  - @fonderie/events@2.0.0

## 1.0.3

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.0.2

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.0.1

### Patch Changes

- Packaging and DX fixes found by dogfooding a fresh AI-agent install:

  - Every `@fonderie/*/migrations` subpath now actually ships its declared
    `index.d.ts` — the two parallel tsup dts passes raced over `dist/` and the
    migrations declaration was lost on multi-entry packages. Migrations now
    build as a separate sequential pass.
  - The adapters' optional peers are now truly optional: `withWorkspace`,
    `requirePermission`, and `requireFeature` lazy-load
    `@fonderie/workspaces`/`permissions`/`billing` on first request instead of
    statically importing them at module load, with a targeted install error
    when the peer is genuinely missing.
  - `OPERATIONS` and the `Operation` type moved to `@fonderie/core`;
    `@fonderie/permissions` and the adapters re-export them unchanged.

- Updated dependencies
  - @fonderie/events@1.0.1
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/events@1.0.0
  - @fonderie/store@0.1.0
