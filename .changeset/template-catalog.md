---
'@fonderie/courier': minor
'@fonderie/client': minor
'@fonderie/react-courier-admin': minor
'@fonderie/vue-courier-admin': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
'@fonderie/react-admin-screens': patch
'@fonderie/vue-admin-screens': patch
'@fonderie/admin': minor
---

The console shows every email and every language it exists in — Fonderie's built-in copy included.

- **courier** — `GET /admin/template-catalog`: every email (saved or built-in only) with its built-in languages and saved versions, plus the app's system locale and fallback chains. The flat list only had saved rows, so a built-in email nobody had edited — every billing email — was invisible and could not be edited from the console. `GET /admin/templates/:type/built-in?locale=` returns Fonderie's copy in a language; `GET /admin/templates/:type/resolve?locale=` answers "who receives what" with the same function a real send runs (`chooseCopy`), so the console cannot disagree with delivery.
- **client / hooks** — `getTemplateCatalog`, `getBuiltInTemplate`, `resolveTemplate`; `useTemplateCatalog`, `useBuiltInTemplate`, `useTemplateResolution` (React and Vue); `templateLanguages` / `suggestTemplateLocales` shared by both consoles. `useTemplate` now clears the shown version on a 404 instead of keeping a deleted one on screen.
- **screens / admin** — the list is one row per email with an aligned language column sorted by code, the default version labelled with the system locale (`en-US`); solid = a version you saved, dashed = Fonderie's built-in copy. A built-in language opens prefilled and saving creates your version; "Reset to built-in" returns a language to Fonderie's copy (and the default version to its built-in text, as a new version). The editor shows the fallback chain and a "who receives what" check; adding the system locale is refused. `TemplateListScreen`'s selection callback now receives `{ type, locale, system }` rather than a full stored row, since a built-in email may have none.
