# @fonderie/react-workspaces-screens

## 0.5.5

### Patch Changes

- Updated dependencies [3760ddb]
- Updated dependencies [3760ddb]
  - @fonderie/client@3.20.0
  - @fonderie/react-workspaces@0.13.0

## 0.5.4

### Patch Changes

- Updated dependencies [09835c4]
  - @fonderie/client@3.19.0
  - @fonderie/react-workspaces@0.12.0

## 0.5.3

### Patch Changes

- Updated dependencies [ae2dcc6]
  - @fonderie/client@3.18.0
  - @fonderie/react-workspaces@0.11.0

## 0.5.2

### Patch Changes

- Updated dependencies [a299875]
  - @fonderie/client@3.17.0
  - @fonderie/react-workspaces@0.10.0

## 0.5.1

### Patch Changes

- 2686f16: Error messages in the reader's language. The screens showed the server's English sentence to everyone; a wrong password now reads « Le courriel ou le mot de passe est incorrect. » for a fr-CA user, 「電子郵件或密碼不正確。」 for zh-TW.
  
  - **`localizeApiError(error, locale)`** (client):
    - English readers keep the server's exact sentence.
    - Every other language gets the message for the error's reason code, filled from its `details`.
    - If the code is unknown or a value is missing, they get the generic message for the status, never a half-filled sentence.
    - An offline failure reads "couldn't reach the server" in every language, instead of "TypeError: Failed to fetch".
    - Covers 57 user-facing reason codes (sign-in, teams, billing, customers, uploads) plus 12 generic messages, in en/fr/es/zh-Hans/zh-Hant.
  - **`useUiError(source?, locale?)`** in `@fonderie/react` and `@fonderie/vue` returns that function in the app's UI language, following `setLocale()`.
  - **Every prebuilt screen** (all 18 packages) shows errors through it.
  - **Server:** `PLAN_UNCHANGED` (`plan`, `interval`), `FEATURE_UNAVAILABLE` (`feature`), `ASSET_TOO_LARGE` (`maxBytes`, `maxMegabytes`) and `ASSET_UNSUPPORTED` (`allowed`) now send their values in `details`, like the other messages that name a value. The English sentences are unchanged.
- Updated dependencies [2686f16]
  - @fonderie/client@3.12.0
  - @fonderie/react@0.11.0
  - @fonderie/react-workspaces@0.9.2

## 0.5.0

### Minor Changes

- 09e227e: The prebuilt screens speak the app's language: English, French, Spanish, and Chinese in Simplified and Traditional.
  
  - **One UI language per client.** `new FonderieClient({ locale: 'fr-CA' })`, `client.setLocale()`, `getLocale()`, `onLocaleChange()`; the default is the device's language. Every sub-client shares it, so a screen handed only `client.auth` follows it too. Requests now carry it as `Accept-Language`, a CORS-safelisted header, so no preflight is added.
  - **The screens' words** live in `@fonderie/client` (`ui-i18n/<domain>/<language>.ts`), shared by React, React Native and Vue: auth, billing, customers, workspaces, audit and webhooks, about 225 keys including React Native's screen-reader labels. Every language is typed against English, so a missing key won't compile. A parity test checks every string is non-empty with the same `{placeholders}`, and that Traditional is not the Simplified copy. French is written for Canada (« courriel »). `zh-TW`/`zh-HK`/`zh-MO` get Traditional and `zh`/`zh-CN`/`zh-SG` Simplified; other languages fall back to English.
  - **Hooks:** `useUiT(source?, locale?)` and `useUiLocale(source?, locale?)` in `@fonderie/react` (React and React Native) and `@fonderie/vue`. They follow `setLocale()` live.
  - **Every screen in the 18 packages** takes an optional `locale` prop (one screen in another language) and has no English left in it.
  - **Formatting follows the language too:** prices (were hard-coded `en-US`), renewal dates and audit timestamps. Server status words (subscription status, roles, invitation status, webhook delivery status) are translated, and an unknown value shows as-is.
  - **Fixes found on the way:**
    - The register screens send the UI language, so a new account starts in the language it signed up in (it always defaulted to en-US).
    - The team screens show each member's name (in the language's name order, e.g. 王小明), email and all their roles, instead of the user id.
    - React Native's subscription screen shows a Stripe Link payment method (it showed an empty card line; React and Vue were fixed in #605).
    - A subscription set to cancel says "Ends {date}", not "Renews {date}".
    - `formatPersonName()` in client.

### Patch Changes

- Updated dependencies [09e227e]
  - @fonderie/client@3.11.0
  - @fonderie/react@0.10.0
  - @fonderie/react-workspaces@0.9.1

## 0.4.6

### Patch Changes

- Updated dependencies [64aefa4]
  - @fonderie/client@3.8.0
  - @fonderie/react-workspaces@0.9.0

## 0.4.5

### Patch Changes

- cb678f7: Members and invitations work end to end.
  
  - **Invite without picking a role**: the person joins with the default role; the default role named explicitly is accepted, a manager role is refused.
  - **Accept by link**: set `invitationUrl` (e.g. `https://app.example.com/invite/{token}`) and the invitation email carries the link, the workspace name and who invited, with the PIN as fallback. `client.workspaces.acceptInvitation({ token } | { pin })`; a bare string is still a PIN. The prebuilt accept screens sent the link's token as a PIN, so they could never succeed; they now send it as a token.
  - **The invitation email** (en/fr/es) shows the link when one is configured, the workspace name and who invited, and always the PIN. Courier migration `006` upgrades the seeded `workspace-invitation` row to the same copy, but only if nobody edited it; the change is recorded as a revision the console can roll back. Without it, existing installs would keep sending the PIN-only email.
  - **A link joins one person**: accepting is single-use, even when two people race for one forwarded link.
  - **One pending invitation per address**, whatever the case: re-inviting refreshes it instead of stacking a duplicate (migration `004` adds the unique index and cancels existing duplicates). `resendInvitation` sends a new link and PIN; invitations past expiry are listed with `isExpired`.
  - **Seats** count each person once, plus pending invitations, never the owner. Adding a role never makes someone a member.
  - **Members list**: one row per person, with `roles[]`, `isOwner` and `isManager`.
  - **Manager path**: the owner can make a member a manager (`setManager` / `unsetManager`), hand over the workspace (`transferOwnership`; the previous owner stays as a manager), and any member can `leaveWorkspace` (the owner must hand over first).
  - **`GET /workspaces/current`** and `useCurrentWorkspace()` (React / React Native / Vue): the selected workspace from the shared cache, so an app needs no store copy.
  - Updating one workspace setting keeps the others (it replaced the whole settings object).
- Updated dependencies [cb678f7]
  - @fonderie/client@3.7.0
  - @fonderie/react-workspaces@0.8.0

## 0.4.4

### Patch Changes

- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/react-workspaces@0.7.0

## 0.4.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react-workspaces@0.6.3

## 0.4.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react-workspaces@0.6.2

## 0.4.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1
  - @fonderie/react-workspaces@0.6.1

## 0.4.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

### Patch Changes

- Updated dependencies [04a13c1]
  - @fonderie/react-workspaces@0.6.0

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
  - @fonderie/react-workspaces@0.2.0
