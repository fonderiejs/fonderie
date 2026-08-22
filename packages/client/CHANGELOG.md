# @fonderie/client

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
