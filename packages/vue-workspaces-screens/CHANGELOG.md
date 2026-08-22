# @fonderie/vue-workspaces-screens

## 0.4.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

### Patch Changes

- Updated dependencies [04a13c1]
  - @fonderie/vue-workspaces@0.7.0

## 0.3.0

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

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/vue-workspaces@0.2.0
