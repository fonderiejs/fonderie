---
"@fonderie/client": minor
"@fonderie/react-native-auth": minor
---

Native Sign in with Apple in the SDK.

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
