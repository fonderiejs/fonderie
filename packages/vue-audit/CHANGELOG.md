# @fonderie/vue-audit

## 0.5.2

### Patch Changes

- Updated dependencies [2686f16]
  - @fonderie/client@3.12.0
  - @fonderie/vue@0.11.0

## 0.5.1

### Patch Changes

- Updated dependencies [09e227e]
  - @fonderie/client@3.11.0
  - @fonderie/vue@0.10.0

## 0.5.0

### Minor Changes

- 90963c4: **Customer, audit and webhook screens open on their data and follow a workspace switch.** `useCustomers` and the customer sub-resource hooks (emails, phones, addresses, notes, tags, relationships, labels), `useAuditEvents` and the webhook hooks loaded once per mount on a spinner. The selected-workspace reads among them never re-read after a switch. They now go through the client's shared store like the billing and workspaces hooks: data on the first frame when seen before, refreshes behind what is shown, no redraw when the answer is unchanged, a write under the same resource refreshes them everywhere, and a workspace switch reads the other workspace's entry without showing the previous one. Return shapes and `refresh({ force })` semantics are unchanged.
  
  - `@fonderie/react` / `@fonderie/vue`: `usePagedQuery(source, path, readFirst, readMore, opts)` for cursor- or offset-paginated lists. The first page is the cached read, and pages appended by `loadMore` belong to the exact first page they extend: an unchanged refresh keeps them, a changed first page re-anchors the list. `rethrowLoadMore: false` reports a failed page on `error` only. `customers` and `audit` use it, because their `loadMore` never threw. Vue `useScopedQuery` gains `enabled`, as React's already had.
  - `@fonderie/client`: `queryParams(params)`, a stable key fragment for a filter object (property order and undefined values do not change it).
  - Lists filtered by params (customers, audit) are keyed by the filters' content, so the same filters on two screens share one entry.

### Patch Changes

- Updated dependencies [90963c4]
  - @fonderie/client@3.4.0
  - @fonderie/vue@0.9.0

## 0.4.6

### Patch Changes

- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/vue@0.8.0

## 0.4.5

### Patch Changes

- Updated dependencies [157004a]
  - @fonderie/client@3.2.0
  - @fonderie/vue@0.7.0

## 0.4.4

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0
  - @fonderie/vue@0.6.0

## 0.4.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/vue@0.5.3

## 0.4.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/vue@0.5.2

## 0.4.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.4.0

### Minor Changes

- 0ec38b6: Vue composables now match the React hooks' reactive contract: data parameters accept MaybeRefOrGetter and refetch on change; initial fetches run in onMounted (SSR-safe); every composable exports its IUse*Return interface.

## 0.3.0

### Minor Changes

- 260e752: Phase 3 of the hook-gap audit: one refresh policy everywhere.
  
  **Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.
  
  **Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.

### Patch Changes

- Updated dependencies [260e752]
  - @fonderie/client@0.10.0

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/vue@0.2.0
