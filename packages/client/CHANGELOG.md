# @fonderie/client

## 0.30.0

### Minor Changes

- 2530bf1: Preview a template beside the editor, rendered the way it will actually send
  
  The editor was three textareas. You changed HTML and saved it blind; the first
  render anyone saw was in a recipient's inbox.
  
  `POST /admin/templates/:type/preview` renders what the editor is **holding**,
  not what is stored, so you see the change before committing it. It goes through
  `renderFragment` and the operator's own `_layout` row, because a fragment
  rendered without the shell looks nothing like the mail that sends — and a
  preview that lies is worse than none.
  
  Three things had to become reachable for that to be true:
  
  - `getLayoutHtml(store, locale?)` is now exported. The `_layout` lookup was
    private to `DBTemplateResolver`, so nothing outside could fetch the shell.
    The resolver now calls the same function — one definition, not a copy.
  - `describeTemplateAdminRoutes` / `buildTemplateAdminRoutes` take an optional
    `{ brandName }`. On a real send the **Dispatcher** merges it, never the
    resolver, so a preview without it silently renders the wrong brand.
  - `templateVariables()` is exported, and the preview reports the variables the
    submitted content uses. The editor seeds its sample-data box from that rather
    than re-implementing the `{{var}}` contract — four copies of that regex
    already exist in this repo, and a fifth on the client would drift.
  
  The `{{var}}` and `{{#section}}` patterns are now named constants shared by the
  renderer and the new extractor, so substitution and "which variables is this?"
  cannot disagree.
  
  The preview renders into `<iframe sandbox="">` — no scripts, no same-origin.
  Operator-authored HTML must never execute in the dashboard's origin, which is
  where the admin token lives.
  
  Being a POST, the route requires the `write` scope rather than `read`. That
  follows the rule that scope comes from the route and is never annotated, and
  costs nothing in practice: anyone in the editor already needs `write` to save.
- 3aab737: The Users page lists on arrival instead of demanding an email first
  
  `GET /_admin/users` required `?email=` and answered 422 without it, so the
  operator screen opened as an empty box: you could only see an account you could
  already name. Nobody can answer "who signed up this morning" that way, and it
  is the opposite of what an operator surface is for.
  
  Without `email` the route now returns a keyset-paginated page, newest first —
  the same cursor contract as login history and the audit log, `{ users,
  nextCursor }`. With `email` it is the exact lookup it always was, unchanged.
  Not a new route, so the token scope stays `read`, derived as before.
  
  Ships `AuthAdminClient.listUsers()`, `useAdminUsers` for React and Vue, and the
  Users screen listing with Load more; clicking a row, or looking up an email,
  opens the account detail as before.
  
  Includes an index on `fonderie_users (created_at DESC, id DESC)` — **run the
  auth migrations**. Keyset paging orders by that pair and the table had only an
  email index, so every page would otherwise sort the whole table.
  
  The list is the same allowlist DTO as the lookup: `passwordHash` and
  `mfaSecret` cannot appear, and a test asserts it against the list response too.
- 3bf1669: The Subscriber page lists on arrival instead of asking for a type and an id
  
  `GET /_admin/subscriptions` returns a keyset-paginated page of subscribers,
  newest first — `{ subscriptions, nextCursor }`, the same cursor contract as the
  wallet ledger. The existing `/subscriptions/:type/:id` lookup is unchanged.
  
  The screen opened as an empty form asking for a subscriber type and id, which
  is answerable only if you already knew both. Now it lists, and a row opens the
  detail view — subscription, wallet, ledger and the manual grant — exactly as
  before.
  
  `limit` is clamped strictly (`NaN`, `<1` or `>100` ⇒ 422) and a malformed
  cursor is 422, matching how the wallet ledger behaves in this package rather
  than auth's and audit's silent clamp.
  
  Includes an index on `fonderie_subscriptions (created_at DESC, id DESC)` —
  **run the billing migrations**. The table carried no index at all: every read
  so far was by subscriber, which a small mirror serves from a scan, but a keyset
  page is a range scan and would otherwise sort the whole table each time.
  
  Ships `BillingAdminClient.listSubscriptions()`, `useAdminSubscribers` for React
  and Vue, and both Subscriber screens listing with Load more.

## 0.29.2

### Patch Changes

- 7299a08: `host` — answer only for requests addressed to a hostname you name
  
  `AdminModule({ host: 'admin.example.com' })`, or a list. Every other host
  gets the same `404` an unmounted surface gives — deliberately not a `403`,
  which would confirm the surface exists and that you found the wrong door.
  Case-insensitive, port-optional unless you configure one, and it covers the
  served dashboard's two unguarded asset routes as well: serving a page that
  says "admin" on your public API hostname is precisely what this prevents.
  
  The concrete reason it exists: platforms hand every deployment a permanent
  URL of their own (`project-abc123.vercel.app`) that answers whatever your
  custom domain answers, walking around anything you put in front of the
  domain. Binding closes that hole while the rest of the app keeps serving on
  both hostnames.
  
  **It is not an access control**, and the option's doc comment says so.
  `Host` is client-set, so this only means something when the edge decides the
  hostname and your origin is not reachable around it — the same footgun
  `trustProxy` carries in `@fonderie/core`. A refused request is still logged,
  so the caller learns nothing and the operator learns something, and the
  manifest reports the binding as `admin.host` (client type updated to match).

## 0.29.1

### Patch Changes

- 38f2410: Use one definition of a request path
  
  `@fonderie/media` recovered the app's `basePath` by stripping `/media` off
  the request path, which a trailing slash defeated — `/v1/media/` yielded no
  basePath and the served URL came out wrong. It now normalizes first.
  `@fonderie/logger` logs the normalized path, so `/x` and `/x/` group as one
  route. `@fonderie/client`'s six admin clients shared six copies of the same
  prefix strip; now one, kept local because this package has zero runtime
  dependencies by design.

## 0.29.0

### Minor Changes

- db925e5: `AdminClient.issueToken()` and `.revokeToken()`
  
  The root-token-only writes behind `@fonderie/admin`'s scoped tokens, with
  `AdminScope`, `IAdminTokenRecord`, `IAdminIssueTokenInput` and
  `IAdminIssuedToken` (the plaintext, returned once). `IAdminTokensReport`
  gains `issued` — null when the deployment gave `AdminModule` no store.

## 0.28.0

### Minor Changes

- 0ea4938: `AuditAdminClient` — `@fonderie/audit`'s operator read, typed
  
  `listAudit({ workspaceId?, type?, actorId?, from?, to?, limit?, cursor? })`
  — every workspace unless one is named, the workspace-scoped `IAuditPageResult`
  shape. Same constructor as the other admin clients, `prefix` included.

## 0.27.0

### Minor Changes

- 3e069c9: `BillingAdminClient` — `@fonderie/billing`'s operator routes, typed
  
  `catalog()`, `createPlan()`, `updatePlan()`, `deletePlan()`,
  `subscription(type, id)`, `wallet(type, id, currency?)`,
  `walletLedger(type, id, { currency, limit, cursor })`, `grant(input)` —
  with `IAdminCatalog`, `IAdminSubscriptionDTO`, `IAdminWalletDTO`,
  `IAdminWalletLedgerPage`, `IAdminPlanInput`, `IAdminGrantInput`. Same
  constructor as the other admin clients, `prefix` included.

## 0.26.0

### Minor Changes

- 201f6af: `AuthAdminClient` — `@fonderie/auth`'s operator routes, typed
  
  `findUser(email)`, `getUser(id)`, `listUserSessions(id)`,
  `revokeUserSessions(id)`, `userLoginHistory(id, { limit, cursor })`,
  `suspendUser(id)`, `unsuspendUser(id)`, with `IAdminUserDTO` (the app's
  user DTO plus `deletedAt`). Same constructor as `AdminClient`, including
  `prefix`. Not on `FonderieClient`: no user session reaches these.

## 0.25.0

### Minor Changes

- fdae8f5: `prefix` on `ConfigAdminClient` and `CourierAdminClient` — reach the composed surface with the one token
  
  `new ConfigAdminClient({ baseUrl, adminToken, prefix: '/_admin' })` sends
  `/_admin/config…` instead of the brick's standalone `/admin/config…`, so the
  config, secrets and template screens can sit inside the admin shell behind
  `@fonderie/admin`'s token. Unset keeps today's paths. The path literals are
  unchanged in source; the prefix replaces the leading `/admin` at request
  time.

## 0.24.0

### Minor Changes

- e8eb04c: `AdminClient` — the operator's surface, typed
  
  `new AdminClient({ baseUrl, adminToken, prefix = '/_admin', actor? })` with
  `attention()`, `manifest()`, `doctor()`, `config()`, `routes()`, `tokens()`
  and `adminLog({ limit, before })`, plus the page types. Deliberately not on
  `FonderieClient`: no user session can reach this surface. `prefix` follows
  the app when it moved the surface.

## 0.23.0

### Minor Changes

- 5db8bbe: Let users disconnect an OAuth provider, and make an OAuth sign-up behave like
  a sign-up.
  
  `DELETE /auth/oauth/:provider` removes the linked provider from the caller's
  account, with `client.auth.unlinkOauth()` and a `useUnlinkOauth` hook in all
  three frontends. It refuses with 409 `PASSWORD_REQUIRED` when the account has
  no password: an account created BY the provider has no other credential, so
  unlinking would be account deletion rather than a settings change. The guard
  is inside the UPDATE's WHERE clause, so a password cannot disappear between
  the check and the write. The user DTO now carries `provider` and
  `hasPassword` so a settings screen can render the control — and know whether
  it is allowed — without probing for the error.
  
  The larger fix is on the way in. `upsertByProvider` returned only an id, which
  made a first-ever OAuth sign-in indistinguishable from a returning one, so the
  OAuth controller emitted nothing at all. Anything subscribed to
  `fonderie.user.registered` therefore never ran for OAuth users — including
  `@fonderie/workspaces`, which provisions the personal workspace on that event.
  Users who signed up with Google or Apple silently had none. The upsert now
  reports whether it inserted and what the previous provider was, and the
  controller acts on the difference: a new account emits `user.registered` plus
  an `oauth-registration` welcome; an existing account that gains or switches
  providers gets an `oauth-linked` security notice; a returning sign-in with the
  same provider emits nothing, so users are not emailed on every login. Apple
  and Google share the path, so both are fixed.

## 0.22.0

### Minor Changes

- fd87133: Add `GET /auth/providers` — which sign-in methods this deployment can actually honour.
  
  A login screen has to decide which buttons to draw, and the only honest source is the side holding the credentials. The alternative is a build-time flag in the frontend, which stores the same fact twice and lets the two disagree: the app offers a provider the server cannot complete, and the user lands on the provider's error page, which the app has no way to explain.
  
  Returns exactly `{ providers: [...] }` from the module's own config — nothing else. Public and unauthenticated on purpose, because the login screen needs it before anyone has signed in; it discloses nothing a visitor could not learn by looking at the buttons, and specifically no client ids, redirect URIs, or module inventory.
  
  Apps were hand-writing this. Doing so means re-reading the same environment variables auth already reads, in a second place, with a second chance to disagree — and naming it `/config`, which collides conceptually with `@fonderie/config` (operator-set feature flags and secrets, a different thing entirely).
  
  Overridable through `config.routes.providers` like every other auth route.
  
  Ships with the whole path, because a route a frontend cannot reach is not a feature: `client.auth.providers()` on the typed client, `useAuthProviders()` in react-auth, and the matching composable in vue-auth (react-native-auth re-exports react-auth's).
  
  Both hooks start EMPTY rather than optimistic, and fall back to empty on error. A brief moment with no social buttons is invisible; a button that appears and then fails is not — and an unreachable API is not evidence that Google works.

## 0.21.0

### Minor Changes

- 048138e: Native Sign in with Apple in the SDK.
  
  - `@fonderie/client`: `client.auth.appleNative({ identityToken, nonce? })` posts a
    native Apple `identityToken` to `POST /auth/apple/native` and returns the same
    `{ tokens, user }` envelope as `login` (no MFA branch). New `IAppleNativeInput`
    type.
  - `@fonderie/react-native-auth`: `useAppleSignIn()` — mirrors `useLogin`: call
    `signIn({ identityToken, nonce? })` with the token from the native Apple sheet
    (e.g. `expo-apple-authentication`) and it stores/persists the session token.
    Exposes `isLoading` / `error` / `data`.
  
  The framework stays free of any native Apple dependency: the app obtains the
  `identityToken` (its choice of native module) and hands it to the hook. Requires
  the API to enable the provider (`@fonderie/auth` `providers: ['apple']`).

## 0.20.0

### Minor Changes

- 3039084: Distributed tracing via W3C Trace Context — the Phase-1 correlation id becomes a
  real trace you can send to Jaeger/Tempo/Datadog-APM/Grafana, with **no required
  deps**.
  
  - `@fonderie/logger`: the request middleware now continues an inbound
    `traceparent` (the upstream span becomes the parent of a fresh server span) or
    starts a new trace, puts `traceId`/`spanId` on `ctx.meta` and the logs, and
    **echoes `traceparent`**. New dep-free helpers (`parseTraceparent`,
    `formatTraceparent`, `newTraceContext`) and an `ITraceExporter` seam with two
    exporters that need no SDK: `ConsoleTraceExporter` (JSON spans → stdout,
    self-hosted default) and `OtlpHttpTraceExporter` (a plain OTLP/HTTP POST that
    works with any OTLP collector). Wire one via `LoggerModule({ traceExporter })`;
    omit it and the trace context still propagates and shows in the logs.
  - `@fonderie/client`: sends `traceparent` on every request (portable random ids
    for RN/Hermes) with `X-Request-ID` unified to the trace id, so
    `FonderieApiError.requestId` is the trace id.
  
  `traceparent` is the standardized header (W3C Trace Context; `X-` prefixes are
  deprecated per RFC 6648), so traces interoperate with every OTel-compatible tool.
  Trace/span ids are random + pseudonymous — metadata-only, same posture as Phase 1.

## 0.19.0

### Minor Changes

- 9e880d1: Request correlation, end-to-end (telemetry Phase 1). The logger's request
  middleware now honours an inbound `X-Request-ID` (client or load balancer) when
  it's a bounded, safe token, generates one only if absent/unsafe, and **echoes it
  in the response header** — so a single id threads the client call → server logs →
  audit trail and can be quoted in a bug report. `@fonderie/client` sends
  `X-Request-ID` on every request (uuid where available, a portable fallback for
  React Native/Hermes) and surfaces it on `FonderieApiError.requestId`.
  Metadata-only and pseudonymous — no payloads captured; IP-minimization policy and
  retention are separate follow-ups.

## 0.18.0

### Minor Changes

- 31f26fb: Add a `media` sub-client for image/avatar upload — `client.media` alongside
  `client.auth`/`client.billing`, sharing the same access token. Methods:
  `upload({ dataBase64, purpose? })` (POST /media), `delete(id)` (DELETE
  /media/:id), plus the pure helpers `assetUrl(id)` (absolute `<img src>` for the
  public GET /media/:id) and `assetIdFromUrl(url)` (its inverse, for avatar
  cleanup). Completes the frontend surface for the @fonderie/media brick, which
  until now shipped server-first — the new @fonderie/react-media,
  @fonderie/react-native-media, and @fonderie/vue-media hook packages build on it.

## 0.17.1

### Patch Changes

- be7a6e7: URL-encode every path parameter uniformly. Path segments were interpolated raw in most modules (only a few call sites encoded), so an id containing `/`, `?`, or `#` — e.g. user-influenced input an app forwards as an id — could rewrite the request target. All path-segment interpolations now go through `encodeURIComponent`; query-string fragments are unchanged.

## 0.17.0

### Minor Changes

- 4eff0f5: Idempotent subscription checkout. `POST /billing/checkout` now accepts an optional `idempotencyKey` (added to `checkoutSchema` so `validate` doesn't strip it, threaded into `StripeProvider.createCheckoutSession` as the Stripe idempotency key). `@fonderie/client`'s `ICheckoutInput` gains the field, and `@fonderie/react-billing`'s `useCheckout` generates a V4 UUID per attempt (mirroring `usePurchasePack`) — so a retried checkout dedupes to a single session (and one subscription) instead of a duplicate. Verified: same key → same Stripe session; different key → different session.

## 0.16.0

### Minor Changes

- afb418c: Read/manage APIs for login activity. `@fonderie/auth` adds four caller-scoped routes: `GET /auth/login-history` (the caller's own attempts, newest first, keyset-paginated on `(created_at, id)` — the same cursor contract as audit's event log, reused from `@fonderie/core`); `GET /auth/sessions` (live sessions, with the current one flagged via the request's `sid`); `DELETE /auth/sessions/:id` (revoke one session, scoped to its owner); and `DELETE /auth/sessions/others` (revoke every session except the current). Because access tokens are already bound to their session's `sid`, terminating a session revokes its access token on the next request, not just its refresh. `@fonderie/client`'s `AuthClient` gains `getLoginHistory`, `listSessions`, `terminateSession`, and `terminateOtherSessions`, sharing the existing auth token.

## 0.15.1

### Patch Changes

- ad8c072: `IInvoiceDTO` now carries `dueDate` (ISO-8601, or null). `GET /billing/invoices` surfaces each invoice's payment-terms due date from the provider (`StripeProvider` maps `invoice.due_date`); one-time charges are paid on capture and carry `null`. Lets a billing UI show a "Due" column alongside the payment date.

## 0.15.0

### Minor Changes

- 158555a: Add the in-app pack-purchase surface for `@fonderie/billing`'s `POST /billing/wallet/purchase`.
  
  - `@fonderie/client`: `billing.purchaseWalletPack({ packId, idempotencyKey })` → `IWalletPurchaseResult` (`status`: `credited` / `checkout_required` / `declined` / `processing`).
  - `@fonderie/react-billing` + `@fonderie/vue-billing`: `usePurchasePack` — charges the saved card, generates one idempotency key per attempt and retries an indeterminate `processing` in place with the SAME key (so a retry can't double-charge), and resolves to the outcome so the caller can fall back to hosted checkout on `checkout_required`. `@fonderie/react-native-billing` re-exports it.
  
  Buy a credit pack without leaving the site when a card is on file; fall back to hosted checkout only when there's no saved card or the card needs 3-D Secure.

## 0.14.0

### Minor Changes

- 239a69c: Expose the in-app payment-method flow (billing server 8.7.0) through the SDK so a card can be added/replaced/removed without leaving the site:
  
  - `@fonderie/client` `BillingClient`: `setupPaymentMethod()` → `{ clientSecret }` (SetupIntent for the embedded card element), `savePaymentMethod({ paymentMethodId })` → the saved card, `removePaymentMethod()`.
  - `@fonderie/react-billing`: `useSetupPaymentMethod` (resolves the SetupIntent client secret for the Payment Element), `useSavePaymentMethod`, `useRemovePaymentMethod` — same context/explicit-client shape as the other billing hooks. `@fonderie/react-native-billing` re-exports them.

## 0.13.0

### Minor Changes

- d08ff1a: Complete the `BillingClient` public surface so every user-facing billing route has a typed client method:
  
  - `cancelSubscription(input?)` / `reactivateSubscription()` — first-party subscription lifecycle (no billing-portal round-trip), returning the new lifecycle state.
  - `createWalletCheckout({ packId })` — start a one-time credit-pack purchase (returns a hosted checkout URL).
  - `getWalletTransactions({ cursor?, limit? })` — the cursor-paginated wallet ledger (each entry carries `balanceAfter`).
  - `getPaymentMethod()` — the customer's card on file (brand/last4/expiry), for `@fonderie/billing`'s new `/billing/payment-method` route.
  - `listInvoices()` — the customer's invoices (each links to the hosted invoice/PDF), for the new `/billing/invoices` route.
  
  Adds the matching result/input types (`ISubscriptionChangeResult`, `IWalletTransactionDTO`/`IWalletTransactionsResult`, `IWalletCheckoutInput`, `ICancelSubscriptionInput`, `IPaymentMethodDTO`/`IPaymentMethodResult`, `IInvoiceDTO`/`IInvoicesResult`). All are additive.

## 0.12.0

### Minor Changes

- 4e3991f: Phase 5b: spend-purchased toggle — end-to-end API + hooks
  
  The Phase 5a spend-purchased preference (whether a debit may draw down purchased credits once the free allowance is exhausted) is now settable end to end, not just enforced from the database.
  
  - **Server** — new `POST /billing/wallet/preferences` (requireAuth, `walletPreferencesSchema`): `wallet.setPreferences` writes the per-(subscriber, currency) flag via a new `setSpendPurchased` service (UPSERT — creates a zero-balance row if none exists) and returns the refreshed wallet, currency-scoped like `GET /billing/wallet`.
  - **Client** — `BillingClient.getWallet()` and `BillingClient.setWalletPreferences({ spendPurchased })` (with `IWalletDTO` / `IWalletResult` / `IWalletPreferencesInput`) — the first typed wallet surface in `@fonderie/client`.
  - **Hooks** — `useWalletPreferences()` in `@fonderie/react-billing` and `@fonderie/vue-billing` (read current value + `setSpendPurchased(bool)`, refresh-on-mount); carried into `@fonderie/react-native-billing` via its wholesale re-export.
  
  Additive/opt-in. Verified against real PostgreSQL (UPSERT on a no-row subscriber; toggle flips the debit hard-stop end to end) plus client/react/vue tests; adversarially reviewed. Wallet balance/transactions client+hooks remain a later cycle (still allow-listed).

## 0.11.0

### Minor Changes

- 98821fc: Auth mediums from the DTO audit: honest SAR exports, typed preferences, the verify-routing signal
  
  The Subject Access Request export (`exportMe`) reported `isPhoneVerified:
  false` for every user — it called `toUserDTO` without the session's
  phone-verified claim while `GET /users` passes it; the compliance bundle now
  agrees with the profile endpoint. The MFA login completion propagates the
  claim into both the fresh token pair and its user DTO instead of silently
  dropping it. (The OAuth callback deliberately stays `false`: `phoneVerified`
  is a session claim, and a fresh browser-redirect session has verified
  nothing.)
  
  `updatePreferencesSchema` typed four fields as `unknown`, so `dateFormat:
  null` or `notifications: "yes"` validated, got stored, and was then served
  against string-typed client fields. The schema now validates all four
  (bounded strings; notifications as the four-boolean object), and `toUserDTO`
  additionally sanitizes reads — well-typed values survive, garbage falls back
  to defaults, and a partial stored notifications object deep-merges over the
  defaults so the promised shape can't shrink. Rows poisoned before this fix
  are therefore served clean too. `IUpdatePreferencesInput` is typed to match.
  
  `IRegisterResult` and `ILoginResult` gain `requiresVerification?: boolean` —
  the server has always sent it on email register/login (it's the signal for
  routing to the verify-email screen), but the client types omitted it, so
  typed frontends couldn't read it.
- 579ad09: Fix two phantom auth client types — and the runtime crash they were hiding
  
  `IResendVerificationResult` claimed `{ stat, message, data: { token,
  expiresAt, email } }` — a shape no server path produces (and whose phantom
  `data.token` falsely implied the verification pin is sent to the client; it
  is only ever emailed). It is now `{ email?, verified? }`, matching the
  server's two success branches. `IMfaEnabledResult` claimed `{ tokens, user }`,
  but the MFA setup-confirmation endpoint returns `{ mfaEnabled: true }` — the
  `{ tokens, user }` shape only exists on the mfa-pending login path, which
  `verifyLogin` already types correctly as `ILoginResult`.
  
  The second phantom was hiding a live bug: `useMfaSetup().verify` in
  react-auth, vue-auth, and react-native-auth all read `result.tokens.access`
  after enabling MFA, so every successful enrollment through those hooks threw
  a TypeError at runtime (their own tests asserted the phantom shape against a
  mocked phantom response). The hooks no longer touch the session token —
  correctly, since the server never rotates it on setup confirmation (MFA is
  enforced at login; the current session remains valid unchanged) — and their
  tests now pin the real contract.
- 6a03e90: Align `IUserDTO` and `IPlanDTO` with what the server actually sends
  
  Three drifts between the client types and the server DTOs:
  
  - `IUserDTO.skills` was declared as a required `IUserSkill[]`, but no endpoint has
    ever returned it — the server never mentions `skills` anywhere. Any code
    trusting the type and reading `user.skills.map(...)` would throw on undefined.
    Removed, along with the now-unused `IUserSkill` type and its export.
  - `IUserDTO.isPhoneVerified` is sent by the server but was not declared, so it
    was invisible to hooks and screens.
  - `IPlanDTO.pricingStale` is sent when pricing came from a stale cache during a
    provider outage. Now declared as optional so a billing screen can mark prices
    as indicative.
- ee5c72d: Customers DTO batch: label correlation, honest relationship dates, no more silent no-ops
  
  Six gaps from the DTO audit, fixed together. Email, phone, and address DTOs
  now expose `labelId` (fetched by every query, previously dropped by the
  mappers) so the label-admin surface — `listLabels`/`removeLabel` operate on
  label ids — can finally be correlated with the rows using a label without
  string-matching on the label value. Expanded relationship DTOs gain
  `relationshipCreatedAt`: their spread `createdAt`/`updatedAt` are the
  related CUSTOMER's dates, so sorting relationships by `createdAt` silently
  sorted by customer signup date; the new field carries the relationship
  row's own date (what the un-expanded DTO's `createdAt` always meant), and
  both sides now document the semantics.
  
  Contract honesty: `addRelationshipSchema` requires `relationship` (the
  controller always 422'd without it — an optional schema let a type-correct
  client walk into a guaranteed 422), and referral codes are create-time only:
  `IUpdateCustomerInput` drops `referralCode`/`referredByCode` and
  `updateCustomerSchema` no longer accepts them, so `updateCustomer({
  referralCode })` fails validation instead of returning 200 and changing
  nothing. `GET /customers/labels` responses now go through a proper
  `toCustomerLabelDTO` (the one customers route that leaked raw Date rows),
  and the dead `ICustomerTagDTO`/`toCustomerTagDTO`/`ICustomerTag` exports are
  removed — tag routes emit plain `string[]` and always have.
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

## 0.10.0

### Minor Changes

- 260e752: Phase 3 of the hook-gap audit: one refresh policy everywhere.
  
  **Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.
  
  **Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.

## 0.9.0

### Minor Changes

- 3c3c68b: Customers pagination, and an MFA setup type correction.
  
  **Pagination (A-104):** `GET /customers` now returns `total` (matching rows regardless of limit/offset) alongside the page. `useCustomers` gains `total`, `hasMore`, and `loadMore()` — an append-fetch of the next page over the same params, mirroring `useAuditEvents`' pagination ergonomics.
  
  **Type correction:** `IMfaSetupResult` now matches what `@fonderie/auth`'s `/auth/mfa/setup` actually returns — `{ qr, backupCodes }` (a data-URI QR code and the one-time backup codes) — instead of the fictional `{ secret, uri }` that never existed at runtime. `useMfaSetup`'s `setupData` is now correctly typed for display.

## 0.8.0

### Minor Changes

- 1d25414: Phase 1 of the hook-gap audit: auth lifecycle and workspace-scoping fixes.
  
  **Client fixes:** `setWorkspaceId` now propagates to the audit and webhooks sub-clients (previously they always hit the caller's personal workspace regardless of the selected team), and the constructor's `workspaceId` option is routed through the same setter instead of being silently ignored. Signing out via `auth.setAccessToken(undefined)` — the hooks' logout path — now clears the shared response cache so one session's data can't be served to the next.
  
  **New hook `useMfaLogin`** (react/react-native/vue): completes a login that returned MFA_REQUIRED via `auth.mfa.verifyLogin`, running the same token persistence as `useLogin` — previously the MFA path never wrote the persisted token, so `useSession` treated MFA users as logged out after restart.
  
  **Storage primitives exported:** `persistToken`, `clearToken`, `readToken`, `TOKEN_KEY` are now exported from each auth package, so apps can wire the client's `auth.onTokensChanged` (silent 401 refresh) and custom logout paths to the same storage the hooks use.

## 0.7.0

### Minor Changes

- 7ab15a8: MFA-aware login and refresh-token-aware logout.
  
  `client.auth.login` is now typed `ILoginResult | IMfaRequiredResult` — when the account has MFA enabled the server returns `{ mfaToken }` with no tokens, and the previous typing hid that branch (hooks crashed reading `result.tokens`). A new exported guard `isMfaRequired(result)` discriminates the union. `useLogin` handles it: on an MFA-required response it skips token persistence, exposes the new `mfaPending` state, and returns the `mfaToken` for `client.auth.mfa.verifyLogin`. The pre-built `LoginScreen`s accept an `onMfaRequired(mfaToken)` callback (React/React Native) or emit `mfa-required` (Vue).
  
  `useLogout().logout(refreshToken?)` and `useSession().logout(refreshToken?)` now pass an optional refresh token through to `client.auth.logout` so the server can revoke the session, matching what the client already supported. Both changes are backward compatible at runtime; TypeScript consumers reading `result.tokens` directly off `login`'s return value must narrow with `isMfaRequired` first.

## 0.6.0

### Minor Changes

- 1c83f8f: Add `auth.mfa.verifyLogin(mfaToken, code)` — a typed method for the MFA-login step
  (completing a login that returned `MFA_REQUIRED`). It sends the temporary `mfaToken`
  as the bearer, so consumers no longer need the generic `post()` + per-call token for
  this flow.

## 0.5.0

### Minor Changes

- e8d0a23: Add an optional per-call `token` to `IRequestConfig` (and `get`/`post`/`put`/`patch`/
  `delete`), overriding the client's stored Bearer for a single request. Enables flows
  that authenticate with a temporary token before the session exists — e.g. MFA login
  (`POST /auth/mfa/verify` with the `mfaToken`) — without dropping to raw HTTP.

## 0.4.0

### Minor Changes

- 4f05eca: feat(client): opt-in response cache + reactive token renewal
  
  Two optional capabilities so apps stop hand-rolling a data layer around the
  client. Both are off by default — existing behaviour is unchanged.
  
  - **Cache** — pass `cache: createMemoryCache()`. GETs are cached (with in-flight
    dedup) and writes auto-invalidate the resource they touch
    (`customers.create()` evicts the customers reads). Per-call control via
    `client.get(path, { cache, bust })` / `post(path, body, { invalidate })`. The
    cache is created **per client instance** (SSR-safe — no module globals, no
    background timer; it sweeps lazily). `clearCache()` and sign-out clear it.
  - **Reactive renew** — pass `auth: { getRefreshToken, onTokensChanged, onAuthError }`.
    On a 401 (never for `/auth/*`), the client refreshes once (single-flight) and
    retries with the new token, so both typed modules and the generic transport
    renew automatically.

## 0.3.0

### Minor Changes

- e614d99: feat(client): Fonderie-aware HTTP transport for custom endpoints
  
  Adds a generic, authenticated transport to `FonderieClient` so an app's own
  endpoints (on the same backend) get the same JWT + `X-Workspace-ID` as the typed
  modules — no hand-rolled axios:
  
  - `client.request({ method, path, body?, workspaceId? })`
  - `client.get / post / put / patch / delete(path, …)`
  - `client.setAccessToken(token)` and `client.setWorkspaceId(id)` (the latter also
    propagates to the workspace-scoped modules, so one call configures the client).
  
  All calls return the standard `{ reason, explanation, result }` envelope and throw
  `FonderieApiError`. Purely additive — existing typed methods are unchanged.

## 0.2.0

### Minor Changes

- dc96eeb: fix(client): align the auth/users surface with @fonderie/auth routes
  
  The client had drifted from the server's actual routes, so several auth and
  user flows failed. Audited every client module against its package; **workspaces,
  billing, and customers already matched** — auth did not. Corrected:
  
  **Fixed drifted endpoints**
  - `verifyEmail` → `POST /auth/verify` `{ token }` (was `/auth/email/verify` `{ pin }`); now sends the auth token (route is `requireAuth`).
  - `sendVerificationEmail` → `GET /auth/send-verification` (was `POST /auth/email/send-verification`).
  - `resetPassword` input → `{ pin, password }` (was `{ resetToken, password }`).
  - `mfa.disable` body → `{ token }` (was `{ code }`; server validates `mfaTokenSchema`).
  
  **Replaced the nonexistent `PUT /users/update`** (`updateUser`/`IUpdateUserInput` removed) with the server's dedicated routes:
  - `updateProfile` → `PUT /users/profile`, `updatePreferences` → `PUT /users/preferences`,
    `updateEmail` → `PUT /users/email`, `updatePhone` → `PUT /users/phone`,
    `changePassword` → `PUT /users/password`.
  
  **Added missing endpoints**
  - `exportData` → `GET /users/export` (SAR bundle).
  - `mfa.regenerateBackupCodes` → `POST /auth/mfa/backup-codes`.
  
  **Removed dead code**
  - `AuthClient.phone` / `PhoneClient` (`/auth/phone/*` — not registered by `@fonderie/auth`).
  
  BREAKING (types only; the removed members targeted routes that returned 404):
  `updateUser`, `IUpdateUserInput`, `client.auth.phone`, and `IPhoneVerifyResult`
  are removed. Aligns the client with the battle-tested crewfinding backend contract.
- 0cd4bb8: feat(workspaces): add GET /workspaces/roles/:roleId/permissions
  
  Roles could only have permissions *set* (POST) — there was no way to *read* a
  role's permissions. Adds the missing read endpoint:
  
  - `@fonderie/workspaces`: `getRolePermissions` service + `RoleModel.getPermissions`
    + `role.getPermissions` controller, registered as
    `GET /workspaces/roles/:roleId/permissions` (requireAuth, workspace-scoped).
  - `@fonderie/client`: `workspaces.getRolePermissions(roleId)` returning
    `{ permissions: IRolePermission[] }`.

### Patch Changes

- f38e00e: refactor(client): name MFA params `token` to match the wire field
  
  `mfa.verify` / `mfa.disable` / `mfa.regenerateBackupCodes` now take a `token`
  parameter and send `body: { token }` directly, instead of mapping a `code`
  param onto `{ token: code }`. No behavior change — the request is identical.

## 0.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 0.1.0

### Minor Changes

- First public release of the Fonderie SDK.
