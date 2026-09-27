---
'@fonderie/client': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/react-config-admin-screens': minor
'@fonderie/vue-config-admin-screens': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
'@fonderie/admin': minor
---

The admin console speaks English, French and Spanish.

The console's language is the OPERATOR's preference, independent of the locales the app serves its customers — a founder in France can run the console in French while every customer email stays English. It defaults to the browser's language, is stored per browser (`fonderie.admin.locale`), and is switched from the sidebar footer: a Language row with a menu (English / Français / Español, a check on the current one) above a Theme row with an icon-only System / Light / Dark control. The sign-in and onboarding screens carry the same controls, and a French or Spanish browser gets them in its language from the first screen.

- `@fonderie/client`: `createAdminT(locale)`, `formatAdminDate`, `detectAdminLocale`, `ADMIN_LOCALES`, `adminLocaleNames` and the dictionaries — English canonical, French and Spanish typed against it, so a missing or extra key is a compile error; a test also checks every translation is non-empty and keeps the same `{placeholders}`.
- Every console screen (React and Vue) takes an optional `locale` prop — `uiLocale` on `TemplateEditorScreen`, whose `locale` is the template's — and `AdminShell` passes it down. Omitted ⇒ English, so embedding apps are unaffected.
- Dates follow the console language. Sign-in errors from known server reasons are shown translated; other server messages (check findings, validation from the API) stay as the server sends them.
