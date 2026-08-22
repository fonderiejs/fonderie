---
"@fonderie/react-auth-screens": minor
"@fonderie/react-native-auth-screens": minor
"@fonderie/vue-auth-screens": minor
"@fonderie/react-workspaces-screens": minor
"@fonderie/react-native-workspaces-screens": minor
"@fonderie/vue-workspaces-screens": minor
---

Four new pre-built screens completing the multi-step flows whose second half previously dead-ended (hook existed, no screen):

- **MfaChallengeScreen** (auth-screens) — completes an MFA_REQUIRED login via `useMfaLogin`; pairs with LoginScreen's `onMfaRequired`/`mfa-required`.
- **ResetPasswordScreen** (auth-screens) — pin + new password via `useResetPassword`; the destination ForgotPasswordScreen never had.
- **VerifyEmailScreen** (auth-screens) — code entry + resend via `useVerifyEmail`'s new `resend()`.
- **AcceptInvitationScreen** (workspaces-screens) — accepts an invitation code via `useAcceptInvitation` and hands back the workspaceId.

All follow the existing conventions: optional `client` prop falling back to the FonderieProvider/plugin context, callback props (React/RN) or emits (Vue).
