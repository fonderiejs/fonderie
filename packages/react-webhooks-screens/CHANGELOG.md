# @fonderie/react-webhooks-screens

## 0.4.0

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
  - @fonderie/react-webhooks@0.5.1

## 0.3.4

### Patch Changes

- Updated dependencies [90963c4]
  - @fonderie/client@3.4.0
  - @fonderie/react-webhooks@0.5.0

## 0.3.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react-webhooks@0.4.3

## 0.3.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react-webhooks@0.4.2

## 0.3.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1
  - @fonderie/react-webhooks@0.4.1

## 0.3.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

### Patch Changes

- Updated dependencies [04a13c1]
  - @fonderie/react-webhooks@0.4.0

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/react-webhooks@0.2.0

## 0.1.1

### Patch Changes

- f2021b8: Canary patch release to verify OIDC Trusted Publishing (+ provenance) works end-to-end after the release-workflow and toolchain updates. No functional change.
