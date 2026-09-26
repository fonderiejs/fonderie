# @fonderie/vue-config-admin

## 0.3.2

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.3.1

### Patch Changes

- 4e3f341: The admin UI no longer offers a Config page for a brick that is not installed
  
  Clicking "Config & secrets" crashed the dashboard with
  `Uncaught TypeError: a.map is not a function`, alongside a 404 on
  `/_admin/secrets`.
  
  The 404 was the harmless symptom. The crash was a **silent shape collision**:
  the served UI decided whether to show the page by probing the manifest for
  `/_admin/config` — a path `@fonderie/admin` registers ITSELF, as the
  declared-vs-held report. So the probe was true on every deployment. The shell
  built a `ConfigAdminClient`, `listConfig()` fetched `/_admin/config`, got
  **200** carrying admin's report OBJECT where it expected an ARRAY of config
  entries, and the screen died on `.map`.
  
  A 200 with the wrong shape is worse than a 404: nothing reports it.
  
  - The probe is now `/secrets`, which only `@fonderie/config` serves.
  - `useConfigEntries` / `useSecrets` (React and Vue) reject a non-array result
    instead of handing it to a component typed for a list, and say what is
    likely wrong: "is @fonderie/config mounted at this prefix?"
  
  A test in `@fonderie/admin` pins the invariant both ways — that this module
  owns `/_admin/config` (so probing it for another brick is a false positive)
  and does NOT own `/_admin/secrets` (so the new probe stays sound).
  
  **Separately, and NOT fixed here:** `@fonderie/config` describes `/config`,
  which `@fonderie/admin` already owns, so registering both modules fails boot
  with "cannot describe GET /_admin/config". That needs one of the two paths to
  move and is a breaking change for whichever loses.

## 0.3.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

## 0.2.0

### Minor Changes

- 260e752: Phase 3 of the hook-gap audit: one refresh policy everywhere.
  
  **Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.
  
  **Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.

### Patch Changes

- Updated dependencies [260e752]
  - @fonderie/client@0.10.0
