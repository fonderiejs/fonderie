# @fonderie/react-auth

## 0.10.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.10.0

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

### Patch Changes

- Updated dependencies [5db8bbe]
  - @fonderie/client@0.23.0

## 0.9.1

### Patch Changes

- 44150ea: Actually export `useAuthProviders`. It shipped defined but unreachable.
  
  Both packages export from an **explicit list** in `src/index.ts`, so adding the hook to `src/hooks/` and `src/composables/` was not enough: the code was bundled into `index.js` and absent from the package's runtime exports *and* its `.d.ts`. `require('@fonderie/react-auth').useAuthProviders` was `undefined`, and a TypeScript import did not compile. The same was true of vue-auth.
  
  It looked shipped from every angle that does not actually import it — the version bumped, the file existed, the symbol appeared in `dist/index.js`, and `check:hook-parity` passed because that gate compared packages to each other and never asked whether *any* of them exported it.
  
  `check:hook-parity` now also asserts that every hook is exported from its own package's public entry, which fails on exactly this. Only `react-native-auth` was unaffected, because that is the one package where the export list was edited.

## 0.9.0

### Minor Changes

- fd87133: Add `GET /auth/providers` — which sign-in methods this deployment can actually honour.
  
  A login screen has to decide which buttons to draw, and the only honest source is the side holding the credentials. The alternative is a build-time flag in the frontend, which stores the same fact twice and lets the two disagree: the app offers a provider the server cannot complete, and the user lands on the provider's error page, which the app has no way to explain.
  
  Returns exactly `{ providers: [...] }` from the module's own config — nothing else. Public and unauthenticated on purpose, because the login screen needs it before anyone has signed in; it discloses nothing a visitor could not learn by looking at the buttons, and specifically no client ids, redirect URIs, or module inventory.
  
  Apps were hand-writing this. Doing so means re-reading the same environment variables auth already reads, in a second place, with a second chance to disagree — and naming it `/config`, which collides conceptually with `@fonderie/config` (operator-set feature flags and secrets, a different thing entirely).
  
  Overridable through `config.routes.providers` like every other auth route.
  
  Ships with the whole path, because a route a frontend cannot reach is not a feature: `client.auth.providers()` on the typed client, `useAuthProviders()` in react-auth, and the matching composable in vue-auth (react-native-auth re-exports react-auth's).
  
  Both hooks start EMPTY rather than optimistic, and fall back to empty on error. A brief moment with no social buttons is invisible; a button that appears and then fails is not — and an unreachable API is not evidence that Google works.

### Patch Changes

- Updated dependencies [fd87133]
  - @fonderie/client@0.22.0

## 0.8.0

### Minor Changes

- afb418c: Add `useLoginHistory` and `useSessions`. `useLoginHistory` paginates the caller's own login attempts (cursor + `loadMore`, filterable by outcome/date) with the same return shape as `react-audit`'s `useAuditEvents`, so a login-history table and an audit-log table build against an identical contract. `useSessions` lists the caller's live sessions (one flagged `current`) and exposes `terminate(id)` (optimistic removal, rolls back on failure) and `terminateOthers()` (refetches from the server rather than guessing which survived). Both re-export the `@fonderie/client` symbols they surface, keeping one import per package.

### Patch Changes

- Updated dependencies [afb418c]
  - @fonderie/client@0.16.0

## 0.7.1

### Patch Changes

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
- Updated dependencies [98821fc]
- Updated dependencies [579ad09]
- Updated dependencies [6a03e90]
- Updated dependencies [ee5c72d]
- Updated dependencies [473a632]
- Updated dependencies [6a03e90]
  - @fonderie/client@0.11.0

## 0.7.0

### Minor Changes

- 260e752: Phase 3 of the hook-gap audit: one refresh policy everywhere.
  
  **Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.
  
  **Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.

### Patch Changes

- Updated dependencies [260e752]
  - @fonderie/client@0.10.0

## 0.6.1

### Patch Changes

- 3c3c68b: Customers pagination, and an MFA setup type correction.
  
  **Pagination (A-104):** `GET /customers` now returns `total` (matching rows regardless of limit/offset) alongside the page. `useCustomers` gains `total`, `hasMore`, and `loadMore()` — an append-fetch of the next page over the same params, mirroring `useAuditEvents`' pagination ergonomics.
  
  **Type correction:** `IMfaSetupResult` now matches what `@fonderie/auth`'s `/auth/mfa/setup` actually returns — `{ qr, backupCodes }` (a data-URI QR code and the one-time backup codes) — instead of the fictional `{ secret, uri }` that never existed at runtime. `useMfaSetup`'s `setupData` is now correctly typed for display.
- Updated dependencies [3c3c68b]
  - @fonderie/client@0.9.0

## 0.6.0

### Minor Changes

- 2711d2f: Phase 2 of the hook-gap audit: full auth-account and MFA-enrollment coverage, and the role-permissions read/write pair.
  
  **New auth hooks (react / react-native / vue):**
  - `useMfaSetup` — the complete MFA enrollment lifecycle: `setup()` (secret + otpauth URI), `verify(code)` which **persists the rotated tokens** the server issues on enrollment (previously nothing consumed them and the session went stale), `disable(code)`, and `regenerateBackupCodes(code)`.
  - `useProfile` — loads the profile and owns `updateProfile` / `updatePreferences` / `updateEmail` / `updatePhone`, self-refreshing.
  - `useChangePassword`, `useAccountData` (`exportData` + `deleteUser` with logout-equivalent teardown).
  - `useVerifyEmail` gains `resend()` / `resent` — both halves of the verification lifecycle in one hook.
  
  **New workspaces hook (react / react-native / vue):** `useRolePermissions(roleId)` — the read half that `useSetRolePermissions` never had, plus a self-refreshing write, so permission editors can pre-populate. `useSetRolePermissions` remains for compatibility.
  
  Client input/result types used by the new hooks are re-exported from each package index.

## 0.5.0

### Minor Changes

- 1d25414: Phase 1 of the hook-gap audit: auth lifecycle and workspace-scoping fixes.
  
  **Client fixes:** `setWorkspaceId` now propagates to the audit and webhooks sub-clients (previously they always hit the caller's personal workspace regardless of the selected team), and the constructor's `workspaceId` option is routed through the same setter instead of being silently ignored. Signing out via `auth.setAccessToken(undefined)` — the hooks' logout path — now clears the shared response cache so one session's data can't be served to the next.
  
  **New hook `useMfaLogin`** (react/react-native/vue): completes a login that returned MFA_REQUIRED via `auth.mfa.verifyLogin`, running the same token persistence as `useLogin` — previously the MFA path never wrote the persisted token, so `useSession` treated MFA users as logged out after restart.
  
  **Storage primitives exported:** `persistToken`, `clearToken`, `readToken`, `TOKEN_KEY` are now exported from each auth package, so apps can wire the client's `auth.onTokensChanged` (silent 401 refresh) and custom logout paths to the same storage the hooks use.

### Patch Changes

- Updated dependencies [1d25414]
  - @fonderie/client@0.8.0

## 0.4.0

### Minor Changes

- 1638dcb: Re-export `isMfaRequired` and `IMfaRequiredResult` from the package index, matching the existing `FonderieApiError`/auth-type re-exports — MFA-aware login now needs only one import: `import { isMfaRequired, useLogin } from '@fonderie/react-native-auth'`. No knowledge of the `@fonderie/client` dependency required (importing from `@fonderie/client` continues to work).

## 0.3.0

### Minor Changes

- 7ab15a8: MFA-aware login and refresh-token-aware logout.
  
  `client.auth.login` is now typed `ILoginResult | IMfaRequiredResult` — when the account has MFA enabled the server returns `{ mfaToken }` with no tokens, and the previous typing hid that branch (hooks crashed reading `result.tokens`). A new exported guard `isMfaRequired(result)` discriminates the union. `useLogin` handles it: on an MFA-required response it skips token persistence, exposes the new `mfaPending` state, and returns the `mfaToken` for `client.auth.mfa.verifyLogin`. The pre-built `LoginScreen`s accept an `onMfaRequired(mfaToken)` callback (React/React Native) or emit `mfa-required` (Vue).
  
  `useLogout().logout(refreshToken?)` and `useSession().logout(refreshToken?)` now pass an optional refresh token through to `client.auth.logout` so the server can revoke the session, matching what the client already supported. Both changes are backward compatible at runtime; TypeScript consumers reading `result.tokens` directly off `login`'s return value must narrow with `isMfaRequired` first.

### Patch Changes

- Updated dependencies [7ab15a8]
  - @fonderie/client@0.7.0

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/react@0.2.0
