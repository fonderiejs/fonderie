---
"@fonderie/courier": minor
---

Versioned email templates — the second adopter of the shared `@fonderie/store`
versioned-resource primitive. Templates (keyed by `type` + nullable `locale`,
content `subject/html/text`) now carry a `version`, an append-only revision
history, and rollback, with optimistic concurrency on edits. New exports:
`setTemplate` (upsert with `ifVersion` → `VersionConflictError` on a stale
compare-and-swap), `rollbackTemplate`, `listTemplateRevisions`,
`getTemplateEntry`, `listTemplateEntries`. The resolver and the whole email
pipeline are unchanged — templates simply gained an edit/history/rollback
lifecycle. Proven end-to-end against real Postgres (edit, rollback, and the
resolver still reading the current version).
