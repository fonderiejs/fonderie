---
"@fonderie/courier": minor
"@fonderie/auth": minor
"@fonderie/core": minor
---

Production-grade, composable email templates. Templates are now **body
fragments** injected into a shared branded layout shell (`templates/layout.ts`)
— a cross-client-hardened responsive frame (max-width card, hybrid inline +
`<style>` CSS, mobile media query, Outlook VML shim) with a small retunable
theme token set (`EMAIL_THEME`). One shell, many bodies: the DB and FS resolvers
both compose it, so every transactional email renders the same frame for free.

Seeds now ship the templates auth and workspaces actually send —
`email-verification`, `password-reset`, `workspace-invitation`, `email-changed`
(previously only `email-verification` was seeded; the rest fell through to a raw
JSON debug fallback). Founders can override the whole shell by storing a
`_layout` template (DB row or `_layout.html` file); a template that is already a
full HTML document is passed through untouched (never double-wrapped).

Localization is now wired end-to-end. `IAuthUser` carries the user's `locale`
(sourced from the DB row via the session middleware), and every auth/workspaces
notification emit now stamps `locale` on the courier message so per-locale
templates are actually selected. The resolver's locale lookup was made
region-safe: it serves the **exact** locale or the neutral `NULL` default and
**never a sibling region** (`en-CA` will not fall back to `en-US`) — the SQL now
uses `locale IS NOT DISTINCT FROM $2` ordering plus a `(locale = $2 OR locale IS
NULL)` filter, so legal/jurisdictional copy can't bleed across regions.
Workspace invitations intentionally omit `locale` (the invitee's language is
unknown at invite time) and fall to the neutral default.
