# @fonderie/vue-customers

## 0.8.0

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

## 0.7.2

### Patch Changes

- Updated dependencies [2686f16]
  - @fonderie/client@3.12.0
  - @fonderie/vue@0.11.0

## 0.7.1

### Patch Changes

- Updated dependencies [09e227e]
  - @fonderie/client@3.11.0
  - @fonderie/vue@0.10.0

## 0.7.0

### Minor Changes

- 3f521bc: A business profile fit for Canada and the US, and customers that are safe to delete and speak their own language.
  
  **Country rules as data: `@fonderie/core/region`.** One registry decides what a valid province, postal code or tax number is, per country. Fonderie ships Canada (English and French names: Québec, Colombie-Britannique…; `A1A 1A1`; GST/HST, QST, PST, BN) and the United States (states and territories; ZIP and ZIP+4; EIN, state sales-tax permits). An app adds any other country with `regions.register({ code: 'MX', … })`. A country without a pack is stored as given, never judged by another country's rules.
  
  **Business profile (`PUT /workspaces`)**: `legalName`, `email`, `website`, `logoUrl`, `taxRegistrations` (`{ country, type, number, region?, label? }`, checked and normalized against the country, e.g. `123 456 789 rt 0001` → `123456789RT0001`), and `languages`, the languages the business serves customers in (`['en-CA', 'fr-CA', 'zh-Hant']`). The address is normalized (`Canada`/`Québec`/`h2x1y4` → `CA`/`QC`/`H2X 1Y4`). `businessType` is now one of `SOLE_PROP`, `PARTNERSHIP`, `LLC`, `INC`, `NONPROFIT`, `COOPERATIVE`. Settings check `locale` (BCP 47, canonical), `currency` (ISO 4217) and `timezone` (IANA). Every refusal is a 422 naming the field. Migration `workspaces/005`.
  
  **Customers**
  - **Language**: `locale` is validated and canonical, and defaults to the business's own (workspace settings) instead of `en-US`. `displayName` writes the name in the customer's language's order: `王小明` for Chinese, Japanese and Korean, `Marie Tremblay` otherwise, the company name for a business.
  - **Archive** (`POST /customers/:id/archive|unarchive`, `archiveCustomer`): hidden from lists and pickers, still readable by id for the documents that name them. Lists exclude archived customers unless `archived: true | 'all'`. Migration `customers/014`.
  - **Safe delete**: one transaction. A customer still referenced (a database foreign key, or the new `isInUse(customerId, workspaceId)` config hook) is refused with `409 CUSTOMER_IN_USE` and loses nothing. Before, its emails, phones and notes were deleted first and the customer then survived without them.
  - **Search** also matches any email, and any phone by digits (`514 555` finds `+1 (514) 555-0100`). The count always describes the same rows.
  - **Primaries can't be lost**: setting a primary email, phone, address or relationship with an id that isn't this customer's now answers 404 and keeps the current primary. Before, it cleared every primary.
  - **Relationships**: the expanded relationship now has `relatedId` (the related customer) and `relationshipId`. `id`/`customerId` stay as deprecated aliases; `id` was the relationship's id, which apps read as the customer's.
  - Addresses use the same country rules.
  
  **Hooks**
  - `useCustomer()` gains `deleteCustomer`/`archiveCustomer`/`unarchiveCustomer`; `useCustomers()` gains `archiveCustomer`/`unarchiveCustomer`.
  - Section hooks take `{ read: false }` for their actions only, so a detail screen makes one request instead of one per section.
  - `@fonderie/react`: refreshing a disabled query no longer fetches it. A write made through a hook told not to read, or still waiting for an id, used to request that hook's list anyway.

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/client@3.9.0

## 0.6.0

### Minor Changes

- 90963c4: **Customer, audit and webhook screens open on their data and follow a workspace switch.** `useCustomers` and the customer sub-resource hooks (emails, phones, addresses, notes, tags, relationships, labels), `useAuditEvents` and the webhook hooks loaded once per mount on a spinner. The selected-workspace reads among them never re-read after a switch. They now go through the client's shared store like the billing and workspaces hooks: data on the first frame when seen before, refreshes behind what is shown, no redraw when the answer is unchanged, a write under the same resource refreshes them everywhere, and a workspace switch reads the other workspace's entry without showing the previous one. Return shapes and `refresh({ force })` semantics are unchanged.
  
  - `@fonderie/react` / `@fonderie/vue`: `usePagedQuery(source, path, readFirst, readMore, opts)` for cursor- or offset-paginated lists. The first page is the cached read, and pages appended by `loadMore` belong to the exact first page they extend: an unchanged refresh keeps them, a changed first page re-anchors the list. `rethrowLoadMore: false` reports a failed page on `error` only. `customers` and `audit` use it, because their `loadMore` never threw. Vue `useScopedQuery` gains `enabled`, as React's already had.
  - `@fonderie/client`: `queryParams(params)`, a stable key fragment for a filter object (property order and undefined values do not change it).
  - Lists filtered by params (customers, audit) are keyed by the filters' content, so the same filters on two screens share one entry.

### Patch Changes

- Updated dependencies [90963c4]
  - @fonderie/client@3.4.0
  - @fonderie/vue@0.9.0

## 0.5.6

### Patch Changes

- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/vue@0.8.0

## 0.5.5

### Patch Changes

- Updated dependencies [157004a]
  - @fonderie/client@3.2.0
  - @fonderie/vue@0.7.0

## 0.5.4

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0
  - @fonderie/vue@0.6.0

## 0.5.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/vue@0.5.3

## 0.5.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/vue@0.5.2

## 0.5.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.5.0

### Minor Changes

- 0ec38b6: Vue composables now match the React hooks' reactive contract: data parameters accept MaybeRefOrGetter and refetch on change; initial fetches run in onMounted (SSR-safe); every composable exports its IUse*Return interface.

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

- 3c3c68b: Customers pagination, and an MFA setup type correction.
  
  **Pagination (A-104):** `GET /customers` now returns `total` (matching rows regardless of limit/offset) alongside the page. `useCustomers` gains `total`, `hasMore`, and `loadMore()` — an append-fetch of the next page over the same params, mirroring `useAuditEvents`' pagination ergonomics.
  
  **Type correction:** `IMfaSetupResult` now matches what `@fonderie/auth`'s `/auth/mfa/setup` actually returns — `{ qr, backupCodes }` (a data-URI QR code and the one-time backup codes) — instead of the fictional `{ secret, uri }` that never existed at runtime. `useMfaSetup`'s `setupData` is now correctly typed for display.

### Patch Changes

- Updated dependencies [3c3c68b]
  - @fonderie/client@0.9.0

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/vue@0.2.0
