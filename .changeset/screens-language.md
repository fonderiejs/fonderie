---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/react-auth-screens': minor
'@fonderie/react-native-auth-screens': minor
'@fonderie/vue-auth-screens': minor
'@fonderie/react-billing-screens': minor
'@fonderie/react-native-billing-screens': minor
'@fonderie/vue-billing-screens': minor
'@fonderie/react-customers-screens': minor
'@fonderie/react-native-customers-screens': minor
'@fonderie/vue-customers-screens': minor
'@fonderie/react-workspaces-screens': minor
'@fonderie/react-native-workspaces-screens': minor
'@fonderie/vue-workspaces-screens': minor
'@fonderie/react-audit-screens': minor
'@fonderie/react-native-audit-screens': minor
'@fonderie/vue-audit-screens': minor
'@fonderie/react-webhooks-screens': minor
'@fonderie/react-native-webhooks-screens': minor
'@fonderie/vue-webhooks-screens': minor
---

The prebuilt screens speak the app's language: English, French, Spanish, and Chinese in Simplified and Traditional.

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
