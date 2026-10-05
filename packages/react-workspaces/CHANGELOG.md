# @fonderie/react-workspaces

## 0.10.0

### Minor Changes

- a299875: Deleting a customer, a custom role or a webhook endpoint can be undone for 30 days (docs/INSIDER-THREAT-DESIGN.md, Phase 3).
  
  A rogue manager, or a slip of the finger, could permanently delete customers with every email, phone, address and note, custom roles with their permissions and assignments, and webhook endpoints with their secrets. Nothing could bring them back.
  
  Now each delete first writes a snapshot of the record and everything attached to it into the module's bin, in the same transaction. A delete that is refused (a customer still on a job) leaves no snapshot.
  
  - **Restore** brings the record back with its original id, in one transaction:
    - `POST /customers/bin/:id/restore`: emails, phones, addresses, notes, tags and relationships come back too.
    - `POST /workspaces/roles/bin/:id/restore`: the role's permissions come back, and former holders still in the team get it again. Anyone moved to the default role by the delete leaves that role.
    - `POST /webhooks/bin/:id/restore`: the same URL, events and signing secret.
  - **What changed since is respected.** A deleted label is dropped from an email or phone; a referrer or related customer that is gone is left out. A taken reference code or role name answers `409 RESTORE_CONFLICT` and the snapshot stays in the bin.
  - **List** with `GET …/bin`. The webhooks bin never shows the secret.
  - **Empty one early** with `DELETE …/bin/:id`, which only the workspace owner can do. A manager who could empty the bin could delete and then erase the undo.
  - **Expiry.** Call `emptyCustomerBin`, `emptyRoleBin` and `emptyEndpointBin` from your cron to drop snapshots past the 30 days.
  - **Client and hooks.** `listDeleted*`, `restore*` and `purgeDeleted*` on the client; `useDeletedCustomers`, `useDeletedRoles` and `useDeletedWebhookEndpoints` in React (and React Native) and Vue.
  
  Apply the migrations before deploying: customers `016_customer_bin`, workspaces `006_role_bin`, webhooks `002_endpoint_bin`.

### Patch Changes

- Updated dependencies [a299875]
  - @fonderie/client@3.17.0

## 0.9.2

### Patch Changes

- Updated dependencies [2686f16]
  - @fonderie/client@3.12.0
  - @fonderie/react@0.11.0

## 0.9.1

### Patch Changes

- Updated dependencies [09e227e]
  - @fonderie/client@3.11.0
  - @fonderie/react@0.10.0

## 0.9.0

### Minor Changes

- 64aefa4: Permissions work end to end, from one declared list to the button a member sees.
  
  - **One catalog**: `new PermissionsModule(store, { catalog: [{ key: 'jobs' }, { key: 'reports', operations: ['read'] }] })`. A role editor reads it (`GET /workspaces/permissions/catalog`, `usePermissionCatalog`). Saving a role refuses a key outside it (`422 UNKNOWN_PERMISSION`) or an operation the resource does not have (`422 UNSUPPORTED_OPERATION`), so no switch can promise a restriction the server never checks.
  - **Rights for the built-in roles, from config**: `systemGrants: { GUEST: { jobs: ['read'] } }`. The system roles are shared by every workspace, so their rights are read from config at check time: every workspace, existing ones included, has them at once, with no seeding or backfill. A workspace's own role named `GUEST` gets none of them. A `systemGrants` key missing from the catalog stops the app at boot.
  - **What may I do here?** `GET /workspaces/current/permissions` returns `isOwner`, `isManager`, `isSuper` and per-resource rights (the union across all the member's roles). `usePermissions()` / `useCan(op, resource)` in React, React Native and Vue answer **no until the server has answered**, and re-read on a workspace switch and after any workspace write (a role change).
  - **Customers obey permissions**: `new CustomersModule(store, { permission: 'customers' })`. Reads need `read`; creating a customer `create`; deleting one `delete`; every other write (emails, notes, tags, blacklist…) `update`. Unset: unchanged.
  - **Deleting a role** now also removes its assignments and grants (before, they were left pointing at nothing). Anyone for whom it was the only role stays on the team with the default role, and the response (and `useRoles().removeRole`) says `{ membersAffected, movedToDefaultRole }`.
  - Hooks taking an id (`useRole`, `useRolePermissions`, `useMemberRoles`, `useWorkspace`) wait instead of requesting with an empty one.

### Patch Changes

- Updated dependencies [64aefa4]
  - @fonderie/client@3.8.0

## 0.8.0

### Minor Changes

- cb678f7: Members and invitations work end to end.
  
  - **Invite without picking a role**: the person joins with the default role; the default role named explicitly is accepted, a manager role is refused.
  - **Accept by link**: set `invitationUrl` (e.g. `https://app.example.com/invite/{token}`) and the invitation email carries the link, the workspace name and who invited, with the PIN as fallback. `client.workspaces.acceptInvitation({ token } | { pin })`; a bare string is still a PIN. The prebuilt accept screens sent the link's token as a PIN, so they could never succeed; they now send it as a token.
  - **The invitation email** (en/fr/es) shows the link when one is configured, the workspace name and who invited, and always the PIN. Courier migration `006` upgrades the seeded `workspace-invitation` row to the same copy, but only if nobody edited it; the change is recorded as a revision the console can roll back. Without it, existing installs would keep sending the PIN-only email.
  - **A link joins one person**: accepting is single-use, even when two people race for one forwarded link.
  - **One pending invitation per address**, whatever the case: re-inviting refreshes it instead of stacking a duplicate (migration `004` adds the unique index and cancels existing duplicates). `resendInvitation` sends a new link and PIN; invitations past expiry are listed with `isExpired`.
  - **Seats** count each person once, plus pending invitations, never the owner. Adding a role never makes someone a member.
  - **Members list**: one row per person, with `roles[]`, `isOwner` and `isManager`.
  - **Manager path**: the owner can make a member a manager (`setManager` / `unsetManager`), hand over the workspace (`transferOwnership`; the previous owner stays as a manager), and any member can `leaveWorkspace` (the owner must hand over first).
  - **`GET /workspaces/current`** and `useCurrentWorkspace()` (React / React Native / Vue): the selected workspace from the shared cache, so an app needs no store copy.
  - Updating one workspace setting keeps the others (it replaced the whole settings object).

### Patch Changes

- Updated dependencies [cb678f7]
  - @fonderie/client@3.7.0

## 0.7.1

### Patch Changes

- Updated dependencies [90963c4]
  - @fonderie/client@3.4.0
  - @fonderie/react@0.9.0

## 0.7.0

### Minor Changes

- ab62ea4: **Workspace screens open on their data, and follow a workspace switch.** `useMembers`, `useRoles`, `useInvitations`, `useWorkspaceSettings` and the other workspace reads loaded once on mount and never again. After the user switched workspace they kept showing the previous workspace's members and roles, and every visit opened on a spinner. They now read through the client's shared store (`client.queries`), like the billing hooks: data on the first frame when it was seen before, refreshes behind the data, no redraw when the answer is unchanged, and a workspace switch reads the other workspace's entry (instantly when seen before) without ever showing the previous one. Return shapes are unchanged.
  
  - `@fonderie/client`: the `workspaces`, `customers`, `audit` and `webhooks` sub-clients now report their scope, `getWorkspaceId()` and `onWorkspaceChange(listener)`, as `billing` already did. They held the workspace id silently, so no hook could follow a switch. Instances built without the constructor (test doubles) still work.
  - `@fonderie/react` / `@fonderie/vue`: `useScopedQuery(source, path, read, { normal, perWorkspace })`, the one read every hook package makes (keyed by path and, for per-workspace data, the selected workspace), plus `useWrite(after)` for the write → re-read → keep-the-error pattern, and `toApiError`.
  - `refresh({ force })` keeps its documented meaning in every migrated hook: it always re-reads, and `force: true` also bypasses the HTTP response cache. The billing hooks released in the previous version bypassed it on every `refresh()`; that is restored too.

### Patch Changes

- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/react@0.8.0

## 0.6.5

### Patch Changes

- Updated dependencies [157004a]
  - @fonderie/client@3.2.0
  - @fonderie/react@0.7.0

## 0.6.4

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0
  - @fonderie/react@0.6.0

## 0.6.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react@0.5.3

## 0.6.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react@0.5.2

## 0.6.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.6.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

## 0.5.0

### Minor Changes

- 57df01c: The last two audit read gaps: `useWorkspace(workspaceId)` and `useRole(roleId)` — read hooks with `refresh({force})` for the explicit-id lookups (`getWorkspace`/`getRole`) that previously had no hook. Current-workspace mutations stay in `useWorkspaceProfile` (they act on the client's workspace scope, not an explicit id). Vue versions take `MaybeRefOrGetter` params and refetch on change. The hook-coverage CI gate's allow-list entries for both methods are removed — they're now enforced as covered.

## 0.4.0

### Minor Changes

- 260e752: Phase 3 of the hook-gap audit: one refresh policy everywhere.
  
  **Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.
  
  **Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.

### Patch Changes

- Updated dependencies [260e752]
  - @fonderie/client@0.10.0

## 0.3.0

### Minor Changes

- 2711d2f: Phase 2 of the hook-gap audit: full auth-account and MFA-enrollment coverage, and the role-permissions read/write pair.
  
  **New auth hooks (react / react-native / vue):**
  - `useMfaSetup` — the complete MFA enrollment lifecycle: `setup()` (secret + otpauth URI), `verify(code)` which **persists the rotated tokens** the server issues on enrollment (previously nothing consumed them and the session went stale), `disable(code)`, and `regenerateBackupCodes(code)`.
  - `useProfile` — loads the profile and owns `updateProfile` / `updatePreferences` / `updateEmail` / `updatePhone`, self-refreshing.
  - `useChangePassword`, `useAccountData` (`exportData` + `deleteUser` with logout-equivalent teardown).
  - `useVerifyEmail` gains `resend()` / `resent` — both halves of the verification lifecycle in one hook.
  
  **New workspaces hook (react / react-native / vue):** `useRolePermissions(roleId)` — the read half that `useSetRolePermissions` never had, plus a self-refreshing write, so permission editors can pre-populate. `useSetRolePermissions` remains for compatibility.
  
  Client input/result types used by the new hooks are re-exported from each package index.

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/react@0.2.0
