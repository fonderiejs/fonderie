---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/billing': patch
'@fonderie/media': patch
'@fonderie/react-auth-screens': patch
'@fonderie/react-native-auth-screens': patch
'@fonderie/vue-auth-screens': patch
'@fonderie/react-billing-screens': patch
'@fonderie/react-native-billing-screens': patch
'@fonderie/vue-billing-screens': patch
'@fonderie/react-customers-screens': patch
'@fonderie/react-native-customers-screens': patch
'@fonderie/vue-customers-screens': patch
'@fonderie/react-workspaces-screens': patch
'@fonderie/react-native-workspaces-screens': patch
'@fonderie/vue-workspaces-screens': patch
'@fonderie/react-audit-screens': patch
'@fonderie/react-native-audit-screens': patch
'@fonderie/vue-audit-screens': patch
'@fonderie/react-webhooks-screens': patch
'@fonderie/react-native-webhooks-screens': patch
'@fonderie/vue-webhooks-screens': patch
---

Error messages in the reader's language. The screens showed the server's English sentence to everyone; a wrong password now reads « Le courriel ou le mot de passe est incorrect. » for a fr-CA user, 「電子郵件或密碼不正確。」 for zh-TW.

- **`localizeApiError(error, locale)`** (client):
  - English readers keep the server's exact sentence.
  - Every other language gets the message for the error's reason code, filled from its `details`.
  - If the code is unknown or a value is missing, they get the generic message for the status, never a half-filled sentence.
  - An offline failure reads "couldn't reach the server" in every language, instead of "TypeError: Failed to fetch".
  - Covers 57 user-facing reason codes (sign-in, teams, billing, customers, uploads) plus 12 generic messages, in en/fr/es/zh-Hans/zh-Hant.
- **`useUiError(source?, locale?)`** in `@fonderie/react` and `@fonderie/vue` returns that function in the app's UI language, following `setLocale()`.
- **Every prebuilt screen** (all 18 packages) shows errors through it.
- **Server:** `PLAN_UNCHANGED` (`plan`, `interval`), `FEATURE_UNAVAILABLE` (`feature`), `ASSET_TOO_LARGE` (`maxBytes`, `maxMegabytes`) and `ASSET_UNSUPPORTED` (`allowed`) now send their values in `details`, like the other messages that name a value. The English sentences are unchanged.
