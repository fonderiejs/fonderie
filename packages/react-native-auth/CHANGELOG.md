# @fonderie/react-native-auth

## 0.13.1

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0
  - @fonderie/react@0.6.0

## 0.13.0

### Minor Changes

- bd033f5: **Sign in with Google from a native app, and social sign-in now asks for the second factor.**
  
  **`@fonderie/auth`:**
  - **`POST /auth/google/native`:** the app posts the ID token the Google SDK gave it. The server checks the token the same way it checks Apple's: signature against Google's published keys (shared hardened key cache), issuer, audience against `google.nativeClientIds`, expiry, a verified email, and single use.
  - **Native-only setups:** `google.clientSecret` and `google.redirectUri` are now optional, so a setup can use native sign-in only. The web flow returns 501 without them.
  - **New env var:** `GOOGLE_NATIVE_CLIENT_IDS`.
  - **Security fix, social sign-in skipped two-factor:**
    - A linked Google or Apple account received a full session even when it had a second factor.
    - Every OAuth sign-in (Google web and native, Apple web and native) now answers `MFA_REQUIRED` with an `mfaToken` when the account has MFA, exactly like a password sign-in.
    - `/auth/mfa/verify` accepts that pending token from any sign-in method. Enabling, disabling and backup codes still require an email sign-in.
    - Suspended accounts are refused on social sign-in too.
  - **Docs fix:** the documented Google callback path is now `/auth/google/callback`, not `/auth/oauth/google/callback`.
  
  **`@fonderie/client` (major):**
  - New: `auth.googleNative({ idToken, nonce? })`.
  - **Breaking:** `auth.appleNative` now returns `ILoginResult | IMfaRequiredResult`, because the server can ask for the second factor. Check `isMfaRequired(result)` before reading `result.tokens`.
  
  **`@fonderie/react-native-auth`:**
  - New: `useGoogleSignIn`.
  - `useAppleSignIn` and `useGoogleSignIn` return `{ mfaToken }` without storing a session when the account has MFA. Finish with `useMfaLogin`.

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react@0.5.3

## 0.12.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react@0.5.2

## 0.12.1

### Patch Changes

- 3b6ca87: **A network failure no longer signs the user out.** Only the server refusing the session does.
  
  **Before:** any failed token refresh cleared the session and called `onAuthError()`. That included no signal, a 5xx and a rate limit, so a phone that was offline when its access token expired was signed out, even though nothing about the session had changed.
  
  **`@fonderie/client`:**
  - `client.session` is `'signedOut' | 'active' | 'offline' | 'revoked'`, and `onSessionChange(listener)` reports each change.
    - `offline` means signed in, but the server can't be reached. It goes back to `active` as soon as the server answers.
  - Only a 400, 401 or 403 from the refresh ends a session. Anything else keeps the tokens.
  - `onAuthError(info)` now says why the session ended:
    - `revoked`: announced live, with the server's reason in `detail`.
    - `expired`: the refresh was refused, with the reason code in `detail`.
    - `no-refresh-token`
    - Existing handlers that take no argument keep working.
  - `isSessionRefusal(err)` tells app code whether an error means "sign out" or "try again later".
  - `auth.hasAccessToken()` reports whether the client holds an access token.
  
  **`useSession` (React, React Native, Vue):** a failed session check signs out only when the server refused the session. Offline, the user stays signed in.
  
  `@fonderie/react` and `@fonderie/vue` re-export `SessionState` and `IAuthErrorInfo`, and the auth packages re-export `isSessionRefusal`, so apps keep a single import per package.
- Updated dependencies [3b6ca87]
  - @fonderie/client@2.5.0
  - @fonderie/react@0.5.1

## 0.12.0

### Minor Changes

- 3446009: Auth events can say where they came from. `IAuthConfig.location` is an
  optional resolver `({ ip, headers }) => IRequestLocation | null`, called at
  most once per request. Its result is stored on every login-attempt row, on a
  new `registration` row written at sign-up, and on each new session (nullable
  `location` JSONB columns — migrations 018 and 019, run your migrations), and
  returned as `location` on login-history events and active sessions. Absent
  resolver ⇒ `location: null`, behaviour unchanged apart from the new
  `registration` rows in login history.
  
  Registration is recorded because with verification not enforced the account
  is live from that request: it is the first record of where the user came from.
  
  Auth imports no geo code: on Vercel/Cloudflare pass
  `({ headers }) => geoFromHeaders(headers, { trust })` from `@fonderie/geo`; a
  self-hosted table or an IP-intelligence API fits the same contract and may add
  ISP/ASN/proxy/hosting. Output is treated as untrusted: type-checked and
  bounded, coordinates rounded to ~1 km, re-sanitized on read;
  a resolver that throws or exceeds 500 ms leaves the row without a location.
  
  Client: `IRequestLocationDTO`, `location` on `ILoginEventDTO` and
  `ISessionDTO`, and `describeLocation(loc, countryName?)` ("Mountain View, CA, US");
  the auth hook packages re-export the type. The admin console shows location
  next to the IP for live sessions and recent sign-ins, with a proxy/VPN or
  hosting flag when known.
  
  Postal / ZIP code is kept when the resolver knows it (`postalCode`), and
  `@fonderie/geo`'s `geoFromHeaders` now reads it from Vercel's
  `x-vercel-ip-postal-code` and Cloudflare's `cf-postal-code`. It is approximate
  for an IP, so `describeLocation` leaves it out of the one-line display.

### Patch Changes

- Updated dependencies [8983e77]
- Updated dependencies [3446009]
  - @fonderie/client@1.1.0

## 0.11.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1

## 0.11.0

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

## 0.10.0

### Minor Changes

- 2c15ffa: Add `useAuthProviders()` — react-auth shipped it, this package did not.
  
  `react-native-auth` exports its hooks from an explicit list rather than re-exporting react-auth wholesale (its hooks persist tokens to AsyncStorage), so a new react-auth hook does not appear here automatically. The 0.9.0 release bumped this package's version through a dependency change while the hook itself was absent — the version looked current and the API was missing.
  
  On native this is the hook that decides whether to render Sign in with Apple at all. Apple's Guideline 4.8 makes that button's presence conditional on the other social options being offered, so guessing is an App Review risk as well as a broken button — and the server is the only side that knows which providers actually have credentials.
  
  Identical to the react-auth hook, since it carries no token storage.
  
  Also adds `resolveSocialButtons(providers, { isIOS })`, which encodes the rule once instead of in every app: Apple needs the platform AND the server, Google needs only the server, and an iOS build offering Google with no Apple is flagged as an App Store Guideline 4.8 risk.
  
  "Always show Apple on iOS" is the tempting shortcut and it is wrong — `POST /auth/apple/native` answers 501 when the API has no apple config, so the user opens the Apple sheet, authenticates with Face ID, and only then fails. A button that fails after the user commits is worse than one that never appeared, and the always-on version also hides the 4.8 misconfiguration until App Review finds it.
  
  On iOS the guideline is **enforced**, not merely reported: when Apple is unavailable, Google is suppressed too. "If we offer Google we must offer Apple" has a contrapositive — offering neither is compliant, offering Google alone is not — so the shipped binary is correct by construction rather than correct-if-someone-reads-a-warning. `appleGuidelineRisk` still reports the cause, because suppressing a button fixes the build and not the configuration. `enforceAppleGuideline: false` opts out for internal builds.
  
  Android is unaffected: the guideline is Apple's, so there the server decides alone.
  
  Pure and platform-argument-based, so the package still needs no `react-native` dependency.

## 0.9.0

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

### Patch Changes

- Updated dependencies [048138e]
  - @fonderie/client@0.21.0

## 0.8.0

### Minor Changes

- 4eff0f5: Add `useLoginHistory` and `useSessions` to vue-auth and react-native-auth,
  closing the framework-parity gap with react-auth (the login-activity hooks
  shipped React-only in #229). Same contract as the React hooks — keyset-paginated
  login history and live-session listing with `terminate`/`terminateOthers`. Also
  re-exports the `IGetLoginHistoryInput` / `ILoginEventDTO` / `ISessionDTO` client
  types these hooks return, which both packages were previously missing.

### Patch Changes

- Updated dependencies [4eff0f5]
  - @fonderie/client@0.17.0

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
