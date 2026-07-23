# @fonderie/workspaces

## 2.1.0

### Minor Changes

- bd4e8db: Add `routes` to `IWorkspacesConfig` — override any workspace route's path (and optionally method) by a stable id, matching `@fonderie/auth`'s `routes` config. This closes the last crewfinding contract divergence: a frontend that does `PUT /workspaces/:id` (id in the path) maps onto Fonderie's header-based update with a single line — `routes: { updateWorkspace: '/workspaces/:id' }` — because `wsCtx` already resolves the workspace from the `:id` path param first. No param-extraction shim needed. A bare string overrides the path; an object can also change the method; unset routes keep defaults.

## 2.0.0

### Minor Changes

- c0f05ea: Decouple workspaces from billing. `@fonderie/workspaces` no longer hard-depends on `@fonderie/billing` — you can register and boot workspaces (create/read/update, invitations, roles, members) without wiring billing or a Stripe provider. Billing stays an _optional_ enhancement: when it's registered, seat limits on invitations are enforced; when it's absent, invitations are unlimited (fail-open, as before). Implementation also fixes an architecture-law violation — workspaces now reads billing's seat limit through `ctx.meta['billing']` (the sanctioned inter-package channel) instead of importing `getPlanLimit` from the billing package. Surfaced by the crewfinding backend rewrite (Phase 1), where a field-service app that only reads a workspace was forced to wire payments.

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0
  - @fonderie/events@2.0.0

## 1.2.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.2.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.2.0

### Minor Changes

- 87b1e2a: Remove the dead `defaultRole` config option. It was never read by any code
  path and its documented `'member'` default never existed; since 1.1.1
  invitations without an explicit `roleId` always resolve to the seeded
  system GUEST role. Passing `defaultRole` was silently ignored before —
  now it's a compile error, which is the honest signal.

## 1.1.1

### Patch Changes

- Security: invitations without an explicit `roleId` now default to the seeded
  system GUEST role (least privilege) instead of resolving a workspace-scoped
  ADMIN role. Previously, apps that seeded per-workspace ADMIN roles would
  silently grant every bare invite full admin rights; apps that didn't would
  500 with "Default role not found". Granting a privileged role now always
  requires passing `roleId` (from `GET /workspaces/roles`).

## 1.1.0

### Minor Changes

- One request-validation layer across every endpoint-exposing package:

  - `validate(schema)` middleware in `@fonderie/core/middlewares` (structural
    `safeParse` interface — core stays dependency-free)
  - zod request schemas on all 43 body-taking routes across auth, workspaces,
    billing, customers, and webhooks; invalid input returns 422
    `INVALID_PARAMETER` with a field path before the controller runs; parsed
    bodies are trimmed and stripped of unknown keys
  - schemas exported per package (`schemas.*`) so docs generators and typed
    clients read the same contract the runtime enforces
  - provider-shaped webhooks (`/billing/webhook`, `/courier/delivery/*`) are
    deliberately exempt — gated by signature verification instead

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
  - @fonderie/billing@1.0.1
  - @fonderie/events@1.0.1
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/billing@1.0.0
  - @fonderie/core@0.1.0
  - @fonderie/events@1.0.0
  - @fonderie/store@0.1.0
