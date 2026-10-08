---
'@fonderie/workspaces': major
'@fonderie/client': minor
'@fonderie/react-workspaces': minor
'@fonderie/react-native-workspaces': minor
'@fonderie/vue-workspaces': minor
'@fonderie/permissions': minor
'@fonderie/billing': minor
---

An archived workspace is read-only, restoring it is the owner's alone, and teams can read their seats, the system roles' grants and their lists a page at a time.

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
