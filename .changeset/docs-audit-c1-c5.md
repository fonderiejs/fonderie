---
'@fonderie/core': patch
'@fonderie/react-courier-admin': patch
'@fonderie/vue-courier-admin': patch
'@fonderie/cli': patch
---

README samples now use real exports. The core README imported `cors` from `@fonderie/core/middlewares`; the export is `withCors`. The courier-admin READMEs imported `useSaveTemplate` and mentioned `useDeleteTemplate`, neither of which exists — saving and deleting are `saveTemplate`/`removeTemplate` on `useTemplates`. They now also list `useTemplatePreview`, `useTemplateCatalog`, `useBuiltInTemplate` and `useTemplateResolution`. The CLI's bundled knowledge data carries the same correction.
