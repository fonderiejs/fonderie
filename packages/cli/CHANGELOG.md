# @fonderie/cli

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
