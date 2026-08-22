# @fonderie/react-native-auth-screens

## 0.4.0

### Minor Changes

- 82e9eaa: Four new pre-built screens completing the multi-step flows whose second half previously dead-ended (hook existed, no screen):
  
  - **MfaChallengeScreen** (auth-screens) — completes an MFA_REQUIRED login via `useMfaLogin`; pairs with LoginScreen's `onMfaRequired`/`mfa-required`.
  - **ResetPasswordScreen** (auth-screens) — pin + new password via `useResetPassword`; the destination ForgotPasswordScreen never had.
  - **VerifyEmailScreen** (auth-screens) — code entry + resend via `useVerifyEmail`'s new `resend()`.
  - **AcceptInvitationScreen** (workspaces-screens) — accepts an invitation code via `useAcceptInvitation` and hands back the workspaceId.
  
  All follow the existing conventions: optional `client` prop falling back to the FonderieProvider/plugin context, callback props (React/RN) or emits (Vue).

### Patch Changes

- Updated dependencies [3c3c68b]
  - @fonderie/client@0.9.0
  - @fonderie/react-native-auth@0.6.1

## 0.3.0

### Minor Changes

- 7ab15a8: MFA-aware login and refresh-token-aware logout.
  
  `client.auth.login` is now typed `ILoginResult | IMfaRequiredResult` — when the account has MFA enabled the server returns `{ mfaToken }` with no tokens, and the previous typing hid that branch (hooks crashed reading `result.tokens`). A new exported guard `isMfaRequired(result)` discriminates the union. `useLogin` handles it: on an MFA-required response it skips token persistence, exposes the new `mfaPending` state, and returns the `mfaToken` for `client.auth.mfa.verifyLogin`. The pre-built `LoginScreen`s accept an `onMfaRequired(mfaToken)` callback (React/React Native) or emit `mfa-required` (Vue).
  
  `useLogout().logout(refreshToken?)` and `useSession().logout(refreshToken?)` now pass an optional refresh token through to `client.auth.logout` so the server can revoke the session, matching what the client already supported. Both changes are backward compatible at runtime; TypeScript consumers reading `result.tokens` directly off `login`'s return value must narrow with `isMfaRequired` first.

### Patch Changes

- Updated dependencies [7ab15a8]
  - @fonderie/client@0.7.0
  - @fonderie/react-native-auth@0.3.0

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/react-native-auth@0.2.0
