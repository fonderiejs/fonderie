# @fonderie/react-native-workspaces

## 0.3.0

### Minor Changes

- 0423614: An archived workspace is read-only, restoring it is the owner's alone, and teams can read their seats, the system roles' grants and their lists a page at a time.
  
  - **Archive = read-only (BREAKING).** Every write route of the workspaces brick answers `409 WORKSPACE_ARCHIVED` while the workspace is archived; reads keep working (export), and leaving or handing it over still work. An invitation to an archived workspace cannot be accepted (`409 WORKSPACE_ARCHIVED`) until it is restored. `withWorkspace` sets `ctx.meta['fonderie.workspaces.archived']` for any brick to honour by shape; `requireActiveWorkspace()`, `isWorkspaceArchived()` and `WORKSPACE_ARCHIVED_META_KEY` are exported for your own write routes.
  - **Restore is owner-only (BREAKING)** — a manager now gets `403 OWNER_REQUIRED` — and restoring a workspace that is not archived answers `409 WORKSPACE_NOT_ARCHIVED` instead of a no-op 200 with a trail event.
  - **Billing can follow the workspace (opt-in).** `@fonderie/billing` listens to `fonderie.workspace.archived` / `.restored`; by default it changes nothing. With `onWorkspaceArchived: 'cancel-at-period-end'` the workspace's subscription ends at the period's end (the stored card is kept), and restoring the workspace before then resumes it — never a cancellation the owner chose. `handleWorkspaceArchived` / `handleWorkspaceRestored` are exported.
  - **Seats.** `GET /workspaces/seats` (any member) → `{ used, members, pendingInvites, limit, available }` — the same count the invite path checks. `client.workspaces.getSeats()`, `useWorkspaceSeats()`.
  - **System-role grants.** `GET /workspaces/permissions/catalog` also returns `systemGrants` (role → resource → operations) from `@fonderie/permissions`' config, which now exposes them as `engine.systemGrants`; `usePermissionCatalog().systemGrants`.
  - **Paging.** `GET /workspaces/members` and `/workspaces/invitations` accept optional `?limit=&cursor=` and then answer one page plus `nextCursor`; without them the whole list comes back as before. `listMembers({ limit, cursor })`, `listInvitations({ limit, cursor })`; `useMembers(client, { pageSize })` and `useInvitations(client, { pageSize })` add `loadMore` / `hasMore` / `isLoadingMore`.
  
  **Migrating to @fonderie/workspaces 8**
  
  - Handle `409 WORKSPACE_ARCHIVED` on writes to an archived workspace (and on accepting an invitation to one): show the workspace as read-only (`workspace.isArchived`) instead of offering edits, and tell the owner to restore it.
  - `POST /workspaces/restore` is the owner's: hide it from managers, or expect `403 OWNER_REQUIRED`.
  - `POST /workspaces/restore` on a workspace that is not archived now answers `409 WORKSPACE_NOT_ARCHIVED`; treat it as "already active".
  - No migration to apply. Billing behaves as before unless you set `onWorkspaceArchived: 'cancel-at-period-end'`.

### Patch Changes

- Updated dependencies [0423614]
  - @fonderie/client@3.22.0
  - @fonderie/react-workspaces@0.14.0

## 0.2.0

### Minor Changes

- 3760ddb: A workspace now holds several emails and phones (one primary each) and its locations (one head office, archivable), under `GET /workspaces/contacts`, `/workspaces/emails`, `/workspaces/phones` and `/workspaces/locations` — members read, owners and managers write. The workspace's `email`, `phone` and `address` stay, as the mirror of the primary email, the primary phone and the head office's address, kept in step both ways in one transaction: a `PUT /workspaces` with them updates (or creates) the entries. Phones are E.164 with an optional extension; a location's `taxRegion` (`CA-QC`) is derived from its address unless given. Migration 010 creates the three tables and turns each existing workspace's email, phone (when already E.164) and address into its first entries. Client: `getContacts`, `addEmail` / `updateEmail` / `removeEmail`, `addPhone` / `updatePhone` / `removePhone`, `createLocation` / `updateLocation` / `archiveLocation` / `restoreLocation`. Hooks: `useWorkspaceContacts()`, `useWorkspaceLocations()`.

### Patch Changes

- Updated dependencies [3760ddb]
- Updated dependencies [3760ddb]
  - @fonderie/client@3.20.0
  - @fonderie/react-workspaces@0.13.0

## 0.1.9

### Patch Changes

- Updated dependencies [09835c4]
  - @fonderie/client@3.19.0
  - @fonderie/react-workspaces@0.12.0

## 0.1.8

### Patch Changes

- Updated dependencies [ae2dcc6]
  - @fonderie/client@3.18.0
  - @fonderie/react-workspaces@0.11.0

## 0.1.7

### Patch Changes

- Updated dependencies [a299875]
  - @fonderie/client@3.17.0
  - @fonderie/react-workspaces@0.10.0

## 0.1.6

### Patch Changes

- Updated dependencies [64aefa4]
  - @fonderie/client@3.8.0
  - @fonderie/react-workspaces@0.9.0

## 0.1.5

### Patch Changes

- Updated dependencies [cb678f7]
  - @fonderie/client@3.7.0
  - @fonderie/react-workspaces@0.8.0

## 0.1.4

### Patch Changes

- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/react-workspaces@0.7.0

## 0.1.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react-workspaces@0.6.3

## 0.1.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react-workspaces@0.6.2

## 0.1.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1
  - @fonderie/react-workspaces@0.6.1
