# @fonderie/react-billing

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
