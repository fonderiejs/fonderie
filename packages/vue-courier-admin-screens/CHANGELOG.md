# @fonderie/vue-courier-admin-screens

## 0.3.0

### Minor Changes

- 2530bf1: Preview a template beside the editor, rendered the way it will actually send
  
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

### Patch Changes

- Updated dependencies [2530bf1]
- Updated dependencies [3aab737]
- Updated dependencies [3bf1669]
  - @fonderie/client@0.30.0
  - @fonderie/vue-courier-admin@0.4.0

## 0.2.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

### Patch Changes

- Updated dependencies [04a13c1]
  - @fonderie/vue-courier-admin@0.3.0
