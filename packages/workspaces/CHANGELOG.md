# @fonderie/workspaces

## 6.0.3

### Patch Changes

- 9156a68: Re-validate the invitation role at ACCEPT time (defense-in-depth). The `roleId` is validated when the invitation is created, but accept now re-confirms it is still assignable — a workspace-local non-system role, or the seeded least-privilege system GUEST default — so a role that has since become non-assignable (or a directly-written bad row) can never grant a privileged membership. A system ADMIN or a foreign workspace's role is refused.

## 6.0.2

### Patch Changes

- be7a6e7: Validate the invitation `roleId` like a direct role assignment. An explicit `roleId` on `POST /workspaces/invitations` flowed unvalidated into the membership INSERT on accept — bypassing `addRoleToMember`'s workspace-local + non-system rule, so a manager could grant the system ADMIN role or another workspace's role via invitation (foreign role names then satisfied name-based role checks). Explicit role ids must now be a non-system role of the inviting workspace (`422 INVALID_ROLE` otherwise); the least-privilege system GUEST default is unchanged.
- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0
  - @fonderie/rate-limit@4.0.7

## 6.0.1

### Patch Changes

- 444f316: Manager gates match role NAMES, not just `is_system` (closes a hole in the just-shipped RBAC gates). Both `ADMIN` and `GUEST` are seeded system roles, and every default invitation lands on `GUEST` — so "holder of any active system role" made every default-invited member a manager, defeating the gate. `requireManager` (workspaces) and `requireBillingManager`/`isWorkspaceManager` (billing) now accept the workspace owner or a holder of an active **system role whose name is in the manager list** — default `['ADMIN']`, configurable via the new `managerRoles` config option in both packages. The `is_system` restriction remains (a member-created local role named 'ADMIN' still grants nothing).

## 6.0.0

### Major Changes

- cd2706a: Invitation hardening + last-owner guard (BREAKING for the PIN flow). (1) H4: the 6-digit invitation PIN was minted with `Math.random()` and looked up **globally** with no throttle — any authenticated user could brute-force any pending invitation and join arbitrary workspaces. The PIN now comes from a CSPRNG, only redeems an invitation addressed to the **accepting user's email**, and `POST /workspaces/invitations/accept` is IP rate-limited (10/15 min; backed by `@fonderie/rate-limit`, new dependency). The accept body now also takes `{ token }` (the 32-byte secret from the email link) as an alternative to `{ pin }` — the path for accounts without an email address. (2) H5: `DELETE /workspaces/members/:userId` refused to let you remove yourself but happily removed the workspace **owner**, orphaning the tenant — now `400 INVALID_OPERATION`. (3) The invitation list/DTO leaked the accept `token` — a bearer credential meant only for the invitee's inbox — letting any member hijack a pending invite; the DTO field remains for shape compatibility but is now always empty.
- cd2706a: Privileged workspace routes now require a manager (BREAKING). Every mutating route — role create/update/delete/set-permissions, member remove and role assign/unassign, invitation create/cancel, settings update, archive/restore, workspace update — previously only verified *membership*; any member could manage roles, evict members, or archive the tenant. These routes now additionally require the caller to be the workspace **owner** or hold an **active system role** (the seeded ADMIN), via the new exported `requireManager` middleware. Reads, invitation acceptance, and workspace creation/listing are unchanged, and personal workspaces pass via ownership. Apps that deliberately run flat teams can restore the old behaviour with `management: 'any-member'` in the module config.

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0
  - @fonderie/rate-limit@4.0.6

## 5.3.2

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.3.1

### Patch Changes

- fc6b4c4: Close two workspace role vulnerabilities. (1) Privilege escalation via role assignment: `POST /workspaces/members/:userId/roles` accepted any role id, so a member could self-grant the seeded system `ADMIN` role (super-role bypass) or a role id from another workspace. Assignment now only succeeds for a role that belongs to the caller's workspace and is not a system role, and returns `422 INVALID_ROLE` otherwise. (2) Cross-workspace role IDOR: reading and mutating a role by id (`getRoleById` / `updateRole`, and the `getRole` / `updateRole` / `getRolePermissions` / `setRolePermissions` routes) were not workspace-scoped, letting a member of one workspace read or rename/deactivate another workspace's roles. All role lookups and mutations are now scoped to `workspace_id` (or a global system role for reads).

## 5.3.0

### Minor Changes

- e717ccb: Ship a default email template for the workspace-invitation notification (P2 of the notification-template normalization).
  
  `@fonderie/workspaces` now exports `DEFAULT_TEMPLATES` covering its one message key (`workspace-invitation`), lifted from courier's seed. Pass it to courier via `config.templates.defaults` and the invitation email renders out of the box — no per-app authoring, never the raw-JSON fallback; override per-app with a DB row / FS file. The copy uses `{{pin}}` (the payload's `token` is intentionally not surfaced). `satisfies Record<WorkspacesMessageKey, IDefaultTemplate>` makes a missing key a compile error; a coverage test asserts it renders cleanly with the real payload and is assignable to courier's `DefaultTemplateMap`. Additive; requires `@fonderie/core >= 0.8.0` + `@fonderie/courier >= 5.2.0`.

## 5.2.3

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 5.2.2

### Patch Changes

- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 5.2.1

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 5.2.0

### Minor Changes

- 473a632: DTO audit closeout: config value parity, actor attribution, and the last shape lies
  
  Config admin responses now serve the PARSED value the runtime read path
  serves — previously `setConfig(key, { value: { a: 1 } })` read back as the
  string `'{"a":1}'` and the shipped editor re-stringified it into a
  degradation loop on every save. Writes honor `active: false` instead of
  silently forcing `true` (list reads filter on it), and both admin clients
  accept an `actor` option sent as `X-Actor` on writes, so `updatedBy` and
  revision history can attribute changes to a person instead of
  'admin-token'. `HttpClient` gained per-request extra headers to carry it.
  
  Workspaces: `updateWorkspaceSchema`'s address validated `region`/
  `postalCode` — names nothing writes — while the real `state`/`zip` rode
  through `.passthrough()` unvalidated; the schema now matches the persisted
  shape and strips unknowns. `IWorkspaceDTO` exposes `archivedBy` (fetched by
  every query, dropped by the mapper) beside `isArchived`/`archivedAt`.
  
  Webhooks: `IWebhookDeliveryDTO` carries `payload`, `responseBody`, and
  `nextAttemptAt` — all fetched, all previously discarded, all exactly what a
  delivery-history UI needs to debug a failing endpoint.
  
  Customers: the email/phone/address update schemas shrink to the one field
  the controllers apply (`label`) — content changes are remove-and-re-add and
  `setPrimary` has its own route, so the old wider schemas validated bodies
  that were silently ignored.
  
  Auth: `mfa_secret` no longer rides along on every user fetch — `USER_COLUMNS`
  drops it and `mfa.disable` fetches on demand via `getMfaSecret` like
  `mfa.verify` always did (removing an untyped cast). `IUpdateProfileInput`
  models explicit-null clears like the workspaces input already did, and the
  client documents that the server's phone-auth register/login variant is a
  deliberate deferral to its own feature cycle.
- 6a03e90: Carry member identity in `IMemberDTO`
  
  `GET /workspaces/members` returned ids and roles only. `listMembers()` already
  joins the users table and selects the email, name and avatar, but `toMemberDTO()`
  discarded all four — so a client had nothing to display and fell back to printing
  a truncated user id.
  
  `IMemberDTO` now includes `email`, `firstName`, `lastName` and `profileImageUrl`,
  so a team screen renders from that one call with no second request. Absent values
  are empty strings, matching every other string field in the DTO.
  
  Additive: existing fields and their types are unchanged.

### Patch Changes

- 400d9f1: Workspace, member, and invitation timestamps serialize as ISO strings again
  
  In production the pg driver returns TIMESTAMPTZ columns as Date objects, and
  `toWorkspaceDTO`/`toMemberDTO`/`toInvitationDTO` mapped every timestamp
  through `stringOrEmpty` — which returns `''` for anything that isn't already
  a string. So `createdAt`/`updatedAt`/`archivedAt` on workspaces, the member
  join date, and — most visibly — the invitation `expiresAt` a UI needs to
  show invite expiry, all serialized as empty strings, while the client types
  declare real strings. (Unit tests missed it because their stubs fed ISO
  strings where pg delivers Dates.)
  
  All six mappings now use core's `dateOrEmpty`, the same convention the
  customers package already follows, and new tests feed actual Date objects to
  pin the ISO contract. `archivedAt` stays `''` for non-archived workspaces
  with `isArchived` derived independently, as before.

## 5.1.0

### Minor Changes

- 0cd4bb8: feat(workspaces): add GET /workspaces/roles/:roleId/permissions
  
  Roles could only have permissions *set* (POST) — there was no way to *read* a
  role's permissions. Adds the missing read endpoint:
  
  - `@fonderie/workspaces`: `getRolePermissions` service + `RoleModel.getPermissions`
    + `role.getPermissions` controller, registered as
    `GET /workspaces/roles/:roleId/permissions` (requireAuth, workspace-scoped).
  - `@fonderie/client`: `workspaces.getRolePermissions(roleId)` returning
    `{ permissions: IRolePermission[] }`.

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0
  - @fonderie/events@5.0.0

## 4.0.0

### Minor Changes

- 9eb3c80: Add `importRole` — completes the workspaces migration trio (`importWorkspace` →
  `importRole` → `importMembership`). Imports a custom, workspace-scoped role
  preserving its id so migrated memberships resolve to it; `is_system` stays false
  (system roles are seeded, resolve those by name). Supplied fields preserved,
  omitted ones take table defaults.
- 5130aba: Add `importWorkspace` + `importMembership` — the workspaces write-side of
  migrating an existing app onto Fonderie (mirrors `importUser` in
  `@fonderie/auth`). `importWorkspace` preserves the original id, `ownerId`,
  `createdAt`, settings and org-profile fields; `importMembership` restores the
  user↔workspace↔role join (replay-safe). A migration is: `importUser` →
  `importWorkspace` → resolve a role (seeded system role or a custom one) →
  `importMembership`. Supplied fields preserved, omitted ones take table defaults.

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0
  - @fonderie/events@4.0.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0
  - @fonderie/events@3.0.0

## 2.1.0

### Minor Changes

- bd4e8db: Add `routes` to `IWorkspacesConfig` — override any workspace route's path (and optionally method) by a stable id, matching `@fonderie/auth`'s `routes` config. This closes the last client-app contract divergence: a frontend that does `PUT /workspaces/:id` (id in the path) maps onto Fonderie's header-based update with a single line — `routes: { updateWorkspace: '/workspaces/:id' }` — because `wsCtx` already resolves the workspace from the `:id` path param first. No param-extraction shim needed. A bare string overrides the path; an object can also change the method; unset routes keep defaults.

## 2.0.0

### Minor Changes

- c0f05ea: Decouple workspaces from billing. `@fonderie/workspaces` no longer hard-depends on `@fonderie/billing` — you can register and boot workspaces (create/read/update, invitations, roles, members) without wiring billing or a Stripe provider. Billing stays an _optional_ enhancement: when it's registered, seat limits on invitations are enforced; when it's absent, invitations are unlimited (fail-open, as before). Implementation also fixes an architecture-law violation — workspaces now reads billing's seat limit through `ctx.meta['billing']` (the sanctioned inter-package channel) instead of importing `getPlanLimit` from the billing package. Surfaced by the client-app backend rewrite (Phase 1), where a field-service app that only reads a workspace was forced to wire payments.

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
