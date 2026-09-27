---
'@fonderie/client': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
'@fonderie/react-admin-screens': patch
'@fonderie/vue-admin-screens': patch
'@fonderie/admin': minor
---

Email templates show their locales. The template list is one row per email with a chip for each locale it exists in (inactive ones struck through), instead of one flat row per (type, locale) pair that left an operator guessing which translations exist. The editor has a tab per locale: switching asks before discarding unsaved edits, and "+ Add locale" is offered on every locale and suggests the locales the app already uses elsewhere that this email lacks. New in `@fonderie/client`: `groupTemplatesByType` and `missingTemplateLocales`, shared by the React and Vue screens. `TemplateEditorScreen` gains `onSelectLocale` (Vue: `localeTabs` + `select-locale`); `onAddLocale` / `add-locale` now also receive `{ locales }`.
