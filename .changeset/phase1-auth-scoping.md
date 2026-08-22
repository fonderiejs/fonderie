---
"@fonderie/client": minor
"@fonderie/react-auth": minor
"@fonderie/react-native-auth": minor
"@fonderie/vue-auth": minor
---

Phase 1 of the hook-gap audit: auth lifecycle and workspace-scoping fixes.

**Client fixes:** `setWorkspaceId` now propagates to the audit and webhooks sub-clients (previously they always hit the caller's personal workspace regardless of the selected team), and the constructor's `workspaceId` option is routed through the same setter instead of being silently ignored. Signing out via `auth.setAccessToken(undefined)` — the hooks' logout path — now clears the shared response cache so one session's data can't be served to the next.

**New hook `useMfaLogin`** (react/react-native/vue): completes a login that returned MFA_REQUIRED via `auth.mfa.verifyLogin`, running the same token persistence as `useLogin` — previously the MFA path never wrote the persisted token, so `useSession` treated MFA users as logged out after restart.

**Storage primitives exported:** `persistToken`, `clearToken`, `readToken`, `TOKEN_KEY` are now exported from each auth package, so apps can wire the client's `auth.onTokensChanged` (silent 401 refresh) and custom logout paths to the same storage the hooks use.
