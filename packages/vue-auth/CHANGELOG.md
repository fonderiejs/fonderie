# @fonderie/vue-auth

## 0.8.0

### Minor Changes

- 0ec38b6: Vue composables now match the React hooks' reactive contract: data parameters accept MaybeRefOrGetter and refetch on change; initial fetches run in onMounted (SSR-safe); every composable exports its IUse*Return interface.

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
  - @fonderie/vue@0.2.0
