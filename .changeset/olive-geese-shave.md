---
'@fonderie/courier': minor
'@fonderie/client': minor
'@fonderie/react-courier-admin': minor
'@fonderie/vue-courier-admin': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
---

Preview a template beside the editor, rendered the way it will actually send

The editor was three textareas. You changed HTML and saved it blind; the first
render anyone saw was in a recipient's inbox.

`POST /admin/templates/:type/preview` renders what the editor is **holding**,
not what is stored, so you see the change before committing it. It goes through
`renderFragment` and the operator's own `_layout` row, because a fragment
rendered without the shell looks nothing like the mail that sends — and a
preview that lies is worse than none.

Three things had to become reachable for that to be true:

- `getLayoutHtml(store, locale?)` is now exported. The `_layout` lookup was
  private to `DBTemplateResolver`, so nothing outside could fetch the shell.
  The resolver now calls the same function — one definition, not a copy.
- `describeTemplateAdminRoutes` / `buildTemplateAdminRoutes` take an optional
  `{ brandName }`. On a real send the **Dispatcher** merges it, never the
  resolver, so a preview without it silently renders the wrong brand.
- `templateVariables()` is exported, and the preview reports the variables the
  submitted content uses. The editor seeds its sample-data box from that rather
  than re-implementing the `{{var}}` contract — four copies of that regex
  already exist in this repo, and a fifth on the client would drift.

The `{{var}}` and `{{#section}}` patterns are now named constants shared by the
renderer and the new extractor, so substitution and "which variables is this?"
cannot disagree.

The preview renders into `<iframe sandbox="">` — no scripts, no same-origin.
Operator-authored HTML must never execute in the dashboard's origin, which is
where the admin token lives.

Being a POST, the route requires the `write` scope rather than `read`. That
follows the rule that scope comes from the route and is never annotated, and
costs nothing in practice: anyone in the editor already needs `write` to save.
