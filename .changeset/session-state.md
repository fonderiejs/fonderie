---
'@fonderie/client': minor
'@fonderie/react-auth': patch
'@fonderie/react-native-auth': patch
'@fonderie/vue-auth': patch
'@fonderie/react': patch
'@fonderie/vue': patch
---

**A network failure no longer signs the user out.** Only the server refusing the session does.

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
