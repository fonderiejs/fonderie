# @fonderie/cli

## 0.9.5

### Patch Changes

- 0b96c47: brain.json stops silently under-reporting the packages it maps
  
  `packages/cli/data/knowledge.json` is regenerated, so the CLI's shipped brain
  now carries the 7 routes, 3 core probes, 1 subpath and 105 dependency edges it
  was quietly missing. No API change.

## 0.9.4

### Patch Changes

- cebac5a: `migrate`'s connection guidance no longer censors itself
  
  The advice shown when the database is unreachable read
  `DATABASE_URL must be postgresql://user:pass@host:port/database`. CI masks
  every occurrence of a secret's value anywhere in a log — including inside
  text the tool printed itself — so an operator who had pasted that exact
  placeholder into their `DATABASE_URL` secret saw:
  
  ```
  DATABASE_URL must be ***host:port/database
  ```
  
  The guidance blanked itself for precisely the person who needed it, and the
  `***` made it look as though the tool was hiding something rather than
  naming the mistake.
  
  Placeholders are now shouted — `postgresql://USER:PASSWORD@HOST:5432/DATABASE`
  — because caps are not pasted verbatim and so cannot collide. The message
  also now names that mistake explicitly, since it is a real one people make.
  
  Observed live: this is how the offending secret's value was identified,
  without ever seeing it. A test asserts the guidance stays un-pasteable.

## 0.9.3

### Patch Changes

- 3825e18: `fonderie migrate --check` fails when it cannot reach the database
  
  An unreachable database passed. Everything downstream swallows errors by
  design — `pending()` catches its own read failure and returns every file — so a
  refused connection produced `61 pending — first-time setup, nothing to lose`
  and **exit 0**. A gate green precisely because it reached nothing, which is
  worse than no gate.
  
  It now probes with `SELECT 1` before anything else and exits 1 on failure,
  naming the target and the driver's error, with the shapes that commonly parse
  elsewhere but not here: a keyword string (`host=… dbname=…`), surrounding
  quotes, a stray newline.
  
  A *reachable* database with no `fonderie_migrations` table is unchanged — still
  a legitimate first install, still passes, still says so.
  
  Found in CI: the migration gate reported success against a value that was not a
  parseable URL at all.

## 0.9.2

### Patch Changes

- ff3bbc7: `fonderie migrate` names the database it checked, and says when that database has never been migrated
  
  Two failures that looked identical from the output: a url pointing at your
  deployment, and a url pointing somewhere that has never seen this app. Both
  printed a confident list of pending migrations, and the second reported
  "first-time setup, nothing to lose" — which is the branch that suppresses the
  destructive flag. A wrong url produced a green gate that would have waved a
  `DROP TABLE` through.
  
  Found in CI: the gate ran against an environment secret and reported 61 pending
  including `800_drop_legacy_credits.sql` on a deployment where that migration was
  applied weeks ago.
  
  Now:
  
  - every run prints `checking <host>:<port>/<database>` — never the credentials,
    so a wrong target is obvious at a glance
  - the applied count is read directly (`select count(*) from fonderie_migrations`)
    rather than inferred from pending-vs-total, because `pending()` catches the
    read failure and returns every file — it cannot distinguish a missing table
    from a fresh install
  - a missing `fonderie_migrations` table says so loudly and states the
    consequence: treated as a first install, nothing flagged, **and if you expected
    an existing deployment the url is wrong and this check proves nothing**
  - a live database reports `(N already applied)`, which is the number that gives
    a wrong target away immediately

## 0.9.1

### Patch Changes

- 8c042ca: `fonderie migrate` stops demanding a connection mode it does not need
  
  The no-DATABASE_URL error and the help text both insisted on a SESSION or
  DIRECT url and warned against the transaction pooler. That is wrong for this
  command: `--status` and `--check` only READ which migrations are applied —
  `pending()` lists files and selects from the migrations table, taking no
  advisory lock and issuing no DDL. Any connection mode works, pooler included.
  
  The session/direct requirement belongs to whatever APPLIES migrations, which
  this command deliberately does not do.
  
  A wrong warning is worse than none. This one sent people provisioning a second
  database credential to satisfy a constraint that was never there.
  
  The error now points at `--dry-run` instead, which skips the database entirely.

## 0.9.0

### Minor Changes

- 13b6a15: `fonderie migrate --check` — a CI gate that refuses to delete data unattended
  
  Migrations had no way to say what they would *do*. A pipeline applying them
  unattended is fine for `CREATE TABLE` and not fine for `DROP TABLE`: the data is
  gone, and no down-migration brings it back — an empty table recreated by a
  rollback is not a rollback.
  
  `classifyMigration(sql)` in `@fonderie/store` labels a migration `additive` or
  `destructive` and returns the statements that earned the label, so a caller can
  show *what* will be lost rather than a generic warning. Conservative by design:
  `DROP TABLE|COLUMN|SCHEMA`, `TRUNCATE` and `ALTER COLUMN … TYPE` all count,
  because a false "destructive" costs one approval and a false "additive" costs
  the data.
  
  `fonderie migrate` uses it:
  
  ```bash
  fonderie migrate --status     # what is pending, per package, with impact
  fonderie migrate --check      # exit 1 if a pending migration deletes data
  fonderie migrate --dry-run    # classify every migration found — no database
  ```
  
  The CI shape it exists for — the gate, then the app's own runner:
  
  ```bash
  fonderie migrate --check && npm run migrate
  ```
  
  **It reports; it does not apply.** The order migrations run in is the app's to
  declare — app tables reference brick tables — and a CLI guessing that order
  would eventually guess wrong in a way that only appears on a fresh database.
  
  **A database with nothing applied is never flagged.** Brick history legitimately
  drops columns earlier migrations in the same set created, so flagging those
  would refuse every first-time install.
  
  Zero CLI dependencies preserved: `@fonderie/store` is imported from the
  consuming app's own `node_modules`. Note these packages are ESM-only — their
  exports maps have `import` but no `require` — so resolution reads the exports
  map rather than using `createRequire`, which answers
  `ERR_PACKAGE_PATH_NOT_EXPORTED` for every one of them.

## 0.8.0

### Minor Changes

- 0a5c5c7: `fonderie admin token issue <name> --scopes read[,write[,secrets]] [--days <n>]` · `admin token revoke <id>`
  
  Root token only, by design.

## 0.7.0

### Minor Changes

- 83fdb67: `fonderie admin audit [--workspace] [--type] [--actor] [--from] [--to] [--limit] [--cursor]`
  
  What happened, across every workspace, from the terminal.

## 0.6.0

### Minor Changes

- 9bd6566: `fonderie admin catalog` and `admin subscriber <user|workspace> <id> [subscription|wallet|ledger]`
  
  What am I selling, what is this subscriber on, what does their wallet hold
  — from the terminal, over `@fonderie/billing`'s described admin reads.

## 0.5.0

### Minor Changes

- 223a934: `fonderie admin user <email|id> [sessions|history|revoke-sessions|suspend|unsuspend]`
  
  The first support question — why can't this person log in — from the
  terminal, over `@fonderie/auth`'s described admin routes.

## 0.4.0

### Minor Changes

- 782cac2: `fonderie admin <page>` — read a deployment's operator surface
  
  `attention`, `manifest`, `doctor`, `config`, `routes`, `tokens`, `log`
  (`--limit`, `--before`) over `@fonderie/admin`, with the same
  `FONDERIE_ADMIN_URL` / `FONDERIE_ADMIN_TOKEN` the config, secret and
  template verbs use, and `FONDERIE_ADMIN_PREFIX` when the surface was moved.
  Read-only.

## 0.3.0

### Minor Changes

- 8fbe182: Config control-plane, phase 5 — management CLI (the LLM-native interface). Adds
  `fonderie config <get|set|delete|history|rollback>` and `fonderie secret
<get|set|delete|history|rollback|reveal>` — a thin, zero-dep client over the
  admin API (`FONDERIE_ADMIN_URL` + `FONDERIE_ADMIN_TOKEN`; optional
  `FONDERIE_ACTOR`). The five kubectl-inspired verbs are held in a single `VERBS`
  dictionary (method + path suffix + requirements), so usage/help derive from one
  source and adding a resource costs the LLM ~zero extra grammar. `set` honours
  `--if-version` (optimistic concurrency) and exits **2** on a 409 conflict
  (reload-and-retry); config values are JSON-parsed, secret values stay raw
  strings; secret reads are masked, `reveal` is the explicit decrypt path.
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

## 0.2.1

### Patch Changes

- 9746437: Internal: parameterize the `@fonderie` package scope behind a single `SCOPE` constant (matching `scripts/scope.mjs` for the generation tooling). No behavior change — output is byte-identical — but it turns the `@fonderiejs` 1.0.0 launch scope-rename from a find-and-replace across the codebase into a one-line flip (MIGRATION-FONDERIEJS.md § "pre-work"). Overridable at build time via `FONDERIE_SCOPE` for a dry run under a throwaway scope.

## 0.2.0

### Minor Changes

- 35e74ed: Add `fonderie add <recipe>` — deterministically wire a capability in one command: installs the recipe's bricks, emits a version-matched `src/fonderie.ts` composition (matching the maintained `example-express`, verified to typecheck against the installed packages), and sets up `.env.example`. Positioned as a correctness/DX convenience, not a token/turn saving — an auth-session pilot found the wiring isn't the turn bottleneck (experiments/phase41-2026-07/DISCOVERY-ADD-WIRING.md).
- 8a9cc2a: Add `@fonderie/cli` — `fonderie init` sets up a lazy skill (router + per-package bodies read on demand) and keeps it fresh via postinstall; `fonderie query` answers what to install for a capability. The N=3-verified lazy pattern, packaged. (First publish is the one-time manual bootstrap per DEPLOYMENT.md; CI owns it after.)

### Patch Changes

- 0529a86: Skill router now states the definition of done — a Fonderie app is done when it typechecks and is wired per recipe; **no database is needed to build** (bricks own their migrations, which run on boot, and their routes are guaranteed by the package). Stops agents from provisioning a Postgres or booting to "check it works" during authoring. Confirmed: a typecheck-clean wired app boots, self-migrates, and serves the brick routes with no hand-written glue (experiments/phase41-2026-07/DECISION-DB-FREE-AUTHORING.md).
