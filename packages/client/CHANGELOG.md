# @fonderie/client

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
