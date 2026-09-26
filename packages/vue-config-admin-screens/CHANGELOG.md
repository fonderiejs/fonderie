# @fonderie/vue-config-admin-screens

## 0.3.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1
  - @fonderie/vue-config-admin@0.3.2

## 0.3.0

### Minor Changes

- 615525d: Theme the admin console with the organisation's design tokens.
  
  The console is the surface an operator judges the product by, and it looked
  assembled: seven files carried their own greys, so the same border was `#ddd`
  on one screen, `#e0e0e0` on another and `#eee` on a third, and the token gate
  shipped a different font stack from the pages behind it.
  
  Colour, type, radii and shadow now come from `var(--fonderie-*)`, declared once
  in the served shell. Two consequences beyond the look:
  
  - **Dark mode works.** It never did — the near-white `#ddd`/`#eee` borders and
    the `#f9fafb` code block would have drawn bright lines and panels on a dark
    page. The shell now ships a dark palette under `prefers-color-scheme`, scoped
    `:root:not([data-theme="light"])` so an explicit light choice still wins.
  - **The surface is themeable.** Override any `--fonderie-*` variable on an
    ancestor and the console follows. The prefix is namespaced deliberately: the
    dashboard can be embedded in a consumer's own page, and a bare `--color-text`
    would collide with theirs silently, and only in their app.
  
  Every variable carries a light-palette fallback, because these screens are
  published packages: imported into an app with no Fonderie shell, an unresolved
  `var(--fonderie-text)` yields nothing at all — invisible text, invisible
  borders. With fallbacks an embedded screen renders correctly and is simply not
  themed.
  
  No webfont is fetched. The tokens name Inter first and fall through to the
  system stack, so an admin console does not announce its existence to a third
  party and still works on an air-gapped deploy.
  
  **Theme switcher.** The console offers System / Light / Dark, the same control
  as the organisation UI (markup, icons and CSS copied from its `.theme-switch`).
  Until now "dark" was decided entirely by the OS: there was no rule for forcing
  dark on a light machine and no way to opt out of dark on a dark one. The shell
  gains `:root[data-theme="dark"]` alongside the existing media query, and the
  choice is stored under a namespaced `fonderie.admin.theme` key — the bare
  `theme` key would read and write a host app's own preference on a shared origin.
  
  "System" is the *absence* of `data-theme`, not a snapshot of the OS resolved at
  click time, so system mode keeps following the machine when it flips at sunset
  rather than freezing until reload. An inline boot script applies a stored choice
  before first paint; if it is blocked or storage throws, the console falls back to
  system — the default either way.
  
  **Chrome moved to the corners.** "Forget token" used to sit in a full-width
  strip above the whole console, which spent a band of vertical space on one
  button and pushed the sidebar down from the top edge. The strip is gone: the
  session control docks bottom-left, the theme switcher bottom-right, and the nav
  now reaches the top of the page.

## 0.2.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

### Patch Changes

- Updated dependencies [04a13c1]
  - @fonderie/vue-config-admin@0.3.0
