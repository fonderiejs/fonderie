# @fonderie/react-billing

## 0.11.1

### Patch Changes

- ab62ea4: **Workspace screens open on their data, and follow a workspace switch.** `useMembers`, `useRoles`, `useInvitations`, `useWorkspaceSettings` and the other workspace reads loaded once on mount and never again. After the user switched workspace they kept showing the previous workspace's members and roles, and every visit opened on a spinner. They now read through the client's shared store (`client.queries`), like the billing hooks: data on the first frame when it was seen before, refreshes behind the data, no redraw when the answer is unchanged, and a workspace switch reads the other workspace's entry (instantly when seen before) without ever showing the previous one. Return shapes are unchanged.
  
  - `@fonderie/client`: the `workspaces`, `customers`, `audit` and `webhooks` sub-clients now report their scope, `getWorkspaceId()` and `onWorkspaceChange(listener)`, as `billing` already did. They held the workspace id silently, so no hook could follow a switch. Instances built without the constructor (test doubles) still work.
  - `@fonderie/react` / `@fonderie/vue`: `useScopedQuery(source, path, read, { normal, perWorkspace })`, the one read every hook package makes (keyed by path and, for per-workspace data, the selected workspace), plus `useWrite(after)` for the write → re-read → keep-the-error pattern, and `toApiError`.
  - `refresh({ force })` keeps its documented meaning in every migrated hook: it always re-reads, and `force: true` also bypasses the HTTP response cache. The billing hooks released in the previous version bypassed it on every `refresh()`; that is restored too.
- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/react@0.8.0

## 0.11.0

### Minor Changes

- 157004a: **Screens open on their data, not on a spinner — and a refresh never flickers.** Every hook used to start each mount with no data and `isLoading: true`, then wait for the network, even for data the previous screen had just fetched. A refresh that came back with the same answer still replaced the screen's data. The client's response cache could not help: it honours the server's `Cache-Control`, and an API answering `max-age=0` is cached for 0 ms.
  
  - `@fonderie/client`: `client.queries`, one shared read model per client (`QueryStore`). Fetched answers can be read synchronously and are observed by every screen showing them. A fetch happens only when an answer is missing or older than `staleMs` (option `queries: { staleMs }`, default 5 minutes; `Infinity` = only when asked), or on an explicit refresh. A refresh never removes data, and an answer equal to what is shown keeps the same object. A failed refresh keeps the data and reports the error. A write marks the reads under its resource stale (the same fragments the HTTP cache evicts), so screens showing them refetch in the background. Sign-out and revocation clear it.
  - `@fonderie/react` / `@fonderie/vue`: `useClientQuery(source, key, fetcher)`, the one way a hook reads server data. `isLoading` means "nothing to show yet", never "a refresh is running" (that is `isFetching`). In Vue, requests wait for mount, so SSR never fetches.
  - `@fonderie/react-billing` / `@fonderie/vue-billing`: every read (`useSubscription`, `usePaymentMethod`, `useInvoices`, `useUsage`, `useWallet`, `useWalletTransactions`, `useWalletPreferences`, `usePlans`, `usePlan`) goes through it. Returning to a screen, or switching back to a workspace already seen, shows its data on the first frame with no request. `useWallet` and `useWalletPreferences` share one request. Pages loaded with `loadMore` survive a refresh that returns the same first page. Return shapes are unchanged. Two behaviour differences: a failed refresh now keeps the last data shown instead of clearing it, and `refresh()` always bypasses the HTTP cache.
  
  `@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.

### Patch Changes

- Updated dependencies [157004a]
  - @fonderie/client@3.2.0
  - @fonderie/react@0.7.0

## 0.10.0

### Minor Changes

- 87f6e1d: **The invoice list no longer stops at 20.** `GET /billing/invoices` returned the newest 20 invoices and silently dropped everything older. It now pages newest first by keyset (`?limit=` 1–100, default 20; `?cursor=`) and answers `nextCursor`. `client.billing.listInvoices({ cursor, limit })`; `useInvoices()` gains `nextCursor`, `hasMore` and `loadMore()` (React and Vue), like `useWalletTransactions`. Providers receive an optional `createdLte` bound; one that ignores it still never repeats a row.
  
  **A usage screen can show the rate limit.** `GET /billing/usage/:metric` only summed usage records, so a windowed plan limit such as `'api-calls': { limit, window: '1d' }` — a counter, not records — always read 0. For such a metric it now answers from the live counter: `kind: 'counter'`, `total` used in the current window, `limit`, `status` (`ok` | `warning` | `over_limit` | `blocked`), `window`, `since` and `resetsAt`. Other metrics keep the records sum (`kind: 'records'`) and also report the plan's `limit`. `useUsage()` returns the whole reading as `usage` alongside `total` (React and Vue); `IUsageResult` is re-exported by the hook packages.
- 87f6e1d: **Billing screens follow a workspace switch.** With workspace billing the subscriber is the selected workspace, but the billing hooks only loaded on mount — a screen that stayed open across a switch kept showing the previous workspace's subscription, card, invoices or wallet.
  
  - `@fonderie/client`: `client.getWorkspaceId()` and `client.onWorkspaceChange(listener)` (returns an unsubscribe); the billing sub-client has the same pair. Listeners fire only when the id actually changes.
  - `@fonderie/react` / `@fonderie/vue`: `useWorkspaceId(source?)` — the current workspace id, re-rendering (React) or as a Ref (Vue) when it changes. Follows the provided client, or the sub-client you pass.
  - `@fonderie/react-billing` / `@fonderie/vue-billing`: `useSubscription`, `usePaymentMethod`, `useInvoices`, `useWallet`, `useWalletTransactions`, `useWalletPreferences` and `useUsage` clear what they showed and re-read on a switch, and a slow answer for the previous workspace can no longer land on top of the new one. `usePlans` / `usePlan` are not per-workspace and are unchanged.
  
  `@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0
  - @fonderie/react@0.6.0

## 0.9.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react@0.5.3

## 0.9.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react@0.5.2

## 0.9.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.9.0

### Minor Changes

- 4eff0f5: Idempotent subscription checkout. `POST /billing/checkout` now accepts an optional `idempotencyKey` (added to `checkoutSchema` so `validate` doesn't strip it, threaded into `StripeProvider.createCheckoutSession` as the Stripe idempotency key). `@fonderie/client`'s `ICheckoutInput` gains the field, and `@fonderie/react-billing`'s `useCheckout` generates a V4 UUID per attempt (mirroring `usePurchasePack`) — so a retried checkout dedupes to a single session (and one subscription) instead of a duplicate. Verified: same key → same Stripe session; different key → different session.

### Patch Changes

- Updated dependencies [4eff0f5]
  - @fonderie/client@0.17.0

## 0.8.0

### Minor Changes

- 158555a: Add the in-app pack-purchase surface for `@fonderie/billing`'s `POST /billing/wallet/purchase`.
  
  - `@fonderie/client`: `billing.purchaseWalletPack({ packId, idempotencyKey })` → `IWalletPurchaseResult` (`status`: `credited` / `checkout_required` / `declined` / `processing`).
  - `@fonderie/react-billing` + `@fonderie/vue-billing`: `usePurchasePack` — charges the saved card, generates one idempotency key per attempt and retries an indeterminate `processing` in place with the SAME key (so a retry can't double-charge), and resolves to the outcome so the caller can fall back to hosted checkout on `checkout_required`. `@fonderie/react-native-billing` re-exports it.
  
  Buy a credit pack without leaving the site when a card is on file; fall back to hosted checkout only when there's no saved card or the card needs 3-D Secure.

### Patch Changes

- Updated dependencies [158555a]
  - @fonderie/client@0.15.0

## 0.7.1

### Patch Changes

- 113c586: Documentation: cover in-app payment-method management. The `@fonderie/billing` README gains a *Payment methods* section (routes, the on-page SetupIntent flow, the optional provider methods with their `501` fallback, ownership checks, and `allow_redirects: 'never'`); the hook/composable READMEs list `usePaymentMethod`/`useSetupPaymentMethod`/`useSavePaymentMethod`/`useRemovePaymentMethod` with a short in-app example; and the screens READMEs document `SubscriptionScreen`'s payment-method section and its add/update delegation (`onAddPaymentMethod` prop / `add-payment-method` emit). Docs-only — no runtime change.

## 0.7.0

### Minor Changes

- 239a69c: Expose the in-app payment-method flow (billing server 8.7.0) through the SDK so a card can be added/replaced/removed without leaving the site:
  
  - `@fonderie/client` `BillingClient`: `setupPaymentMethod()` → `{ clientSecret }` (SetupIntent for the embedded card element), `savePaymentMethod({ paymentMethodId })` → the saved card, `removePaymentMethod()`.
  - `@fonderie/react-billing`: `useSetupPaymentMethod` (resolves the SetupIntent client secret for the Payment Element), `useSavePaymentMethod`, `useRemovePaymentMethod` — same context/explicit-client shape as the other billing hooks. `@fonderie/react-native-billing` re-exports them.

### Patch Changes

- Updated dependencies [239a69c]
  - @fonderie/client@0.14.0

## 0.6.0

### Minor Changes

- d08ff1a: Add hooks for the full wallet + billing-account surface, so a React billing page needs no hand-rolled fetches:
  
  - `useWallet()` — the stored-value balance (reads `GET /billing/wallet`).
  - `useWalletTransactions()` — the cursor-paginated ledger, with `loadMore()`.
  - `useWalletCheckout()` — start a one-time credit-pack purchase (returns the hosted URL to redirect to).
  - `useCancelSubscription()` / `useReactivateSubscription()` — first-party lifecycle controls (no billing-portal round-trip).
  - `usePaymentMethod()` — the card on file; treats a provider `501` as "no card", not an error.
  - `useInvoices()` — invoice history (each links to the hosted invoice/PDF); `501` reads as an empty list.
  
  Follows the existing hook conventions (context-resolved client, `{ isLoading, error, refresh }` reads / action mutations). `@fonderie/react-native-billing` re-exports these unchanged.

### Patch Changes

- Updated dependencies [d08ff1a]
  - @fonderie/client@0.13.0

## 0.5.0

### Minor Changes

- 4e3991f: Phase 5b: spend-purchased toggle — end-to-end API + hooks
  
  The Phase 5a spend-purchased preference (whether a debit may draw down purchased credits once the free allowance is exhausted) is now settable end to end, not just enforced from the database.
  
  - **Server** — new `POST /billing/wallet/preferences` (requireAuth, `walletPreferencesSchema`): `wallet.setPreferences` writes the per-(subscriber, currency) flag via a new `setSpendPurchased` service (UPSERT — creates a zero-balance row if none exists) and returns the refreshed wallet, currency-scoped like `GET /billing/wallet`.
  - **Client** — `BillingClient.getWallet()` and `BillingClient.setWalletPreferences({ spendPurchased })` (with `IWalletDTO` / `IWalletResult` / `IWalletPreferencesInput`) — the first typed wallet surface in `@fonderie/client`.
  - **Hooks** — `useWalletPreferences()` in `@fonderie/react-billing` and `@fonderie/vue-billing` (read current value + `setSpendPurchased(bool)`, refresh-on-mount); carried into `@fonderie/react-native-billing` via its wholesale re-export.
  
  Additive/opt-in. Verified against real PostgreSQL (UPSERT on a no-row subscriber; toggle flips the debit hard-stop end to end) plus client/react/vue tests; adversarially reviewed. Wallet balance/transactions client+hooks remain a later cycle (still allow-listed).

### Patch Changes

- Updated dependencies [4e3991f]
  - @fonderie/client@0.12.0

## 0.4.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

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
  - @fonderie/react@0.2.0
