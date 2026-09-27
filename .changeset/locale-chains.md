---
'@fonderie/core': minor
'@fonderie/courier': minor
'@fonderie/auth': minor
'@fonderie/billing': minor
'@fonderie/workspaces': minor
'@fonderie/client': minor
---

Built-in emails in English, French and Spanish, and locale fallback chains the app declares once.

- **core** — `locales: { default, fallbacks }` in the app config: the system locale (default `en-US`) and, per market or language, where content comes from when that market has none (`fr: 'fr-CA'`, `'fr-BE': ['fr-FR', 'fr-CA']`). Chains don't expand, so a market's path reads in one line. A bad chain (invalid tag, a locale falling back to itself, more than five fallbacks) stops the app at construction. New: `defineLocales`, `localeChain`, `canonicalLocale`, `app.locales`, plus `withTranslations` / `translationProblems` for modules shipping translated defaults.
- **courier** — resolution order: the app's saved versions along the chain, then the built-in copy by language, then the saved default, then the built-in English. The system locale comes last so a French user gets the shipped French rather than the app's English default. The built-in layout shell is drawn in the email's language. Every send records the version actually used (`fonderie_message_log.resolved_locale`, migration 005 — run migrations with this release; until then sends still work and only that detail is skipped). Template tags are stored canonical, and a version tagged with the system locale is refused (409 `DEFAULT_LOCALE`): the default copy already is that version.
- **auth / billing / workspaces** — every built-in email ships in French and Spanish, with a coverage test that fails when a translation's subject, text or html uses different `{{variables}}` than the English.
- **auth / client** — sign-up accepts `locale`, stored on the new account, so the verification email already arrives in it; without one, new accounts get the app's system locale instead of a hard-coded `en-US`.
