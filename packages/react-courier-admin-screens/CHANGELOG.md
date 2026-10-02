# @fonderie/react-courier-admin-screens

## 0.11.1

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react-courier-admin@0.5.2

## 0.11.0

### Minor Changes

- 1b349ba: The console shows every email and every language it exists in — Fonderie's built-in copy included.
  
  - **courier** — `GET /admin/template-catalog`: every email (saved or built-in only) with its built-in languages and saved versions, plus the app's system locale and fallback chains. The flat list only had saved rows, so a built-in email nobody had edited — every billing email — was invisible and could not be edited from the console. `GET /admin/templates/:type/built-in?locale=` returns Fonderie's copy in a language; `GET /admin/templates/:type/resolve?locale=` answers "who receives what" with the same function a real send runs (`chooseCopy`), so the console cannot disagree with delivery.
  - **client / hooks** — `getTemplateCatalog`, `getBuiltInTemplate`, `resolveTemplate`; `useTemplateCatalog`, `useBuiltInTemplate`, `useTemplateResolution` (React and Vue); `templateLanguages` / `suggestTemplateLocales` shared by both consoles. `useTemplate` now clears the shown version on a 404 instead of keeping a deleted one on screen.
  - **screens / admin** — the list is one row per email with an aligned language column sorted by code, the default version labelled with the system locale (`en-US`); solid = a version you saved, dashed = Fonderie's built-in copy. A built-in language opens prefilled and saving creates your version; "Reset to built-in" returns a language to Fonderie's copy (and the default version to its built-in text, as a new version). The editor shows the fallback chain and a "who receives what" check; adding the system locale is refused. `TemplateListScreen`'s selection callback now receives `{ type, locale, system }` rather than a full stored row, since a built-in email may have none.

### Patch Changes

- Updated dependencies [1b349ba]
  - @fonderie/client@1.13.0
  - @fonderie/react-courier-admin@0.5.0

## 0.10.0

### Minor Changes

- 6acfb5b: Adding a locale or a new template now has the same live preview as the editor, and flags fields still identical to the default copy ("Still the default copy: Subject, Plain-text body") — a half-translated email looked finished in a textarea and only showed its English subject once sent. The console page now loads its script as `app.js?v=<version>`, so a page opened after a deploy never reuses the previous bundle from cache.

### Patch Changes

- Updated dependencies [6acfb5b]
  - @fonderie/client@1.11.1

## 0.9.0

### Minor Changes

- 585fa8b: Email templates show their locales. The template list is one row per email with a chip for each locale it exists in (inactive ones struck through), instead of one flat row per (type, locale) pair that left an operator guessing which translations exist. The editor has a tab per locale: switching asks before discarding unsaved edits, and "+ Add locale" is offered on every locale and suggests the locales the app already uses elsewhere that this email lacks. New in `@fonderie/client`: `groupTemplatesByType` and `missingTemplateLocales`, shared by the React and Vue screens. `TemplateEditorScreen` gains `onSelectLocale` (Vue: `localeTabs` + `select-locale`); `onAddLocale` / `add-locale` now also receive `{ locales }`.

### Patch Changes

- Updated dependencies [585fa8b]
  - @fonderie/client@1.11.0

## 0.8.0

### Minor Changes

- b94ed53: The admin console speaks English, French and Spanish.
  
  The console's language is the OPERATOR's preference, independent of the locales the app serves its customers — a founder in France can run the console in French while every customer email stays English. It defaults to the browser's language, is stored per browser (`fonderie.admin.locale`), and is switched from the sidebar footer: a Language row with a menu (English / Français / Español, a check on the current one) above a Theme row with an icon-only System / Light / Dark control. The sign-in and onboarding screens carry the same controls, and a French or Spanish browser gets them in its language from the first screen.
  
  - `@fonderie/client`: `createAdminT(locale)`, `formatAdminDate`, `detectAdminLocale`, `ADMIN_LOCALES`, `adminLocaleNames` and the dictionaries — English canonical, French and Spanish typed against it, so a missing or extra key is a compile error; a test also checks every translation is non-empty and keeps the same `{placeholders}`.
  - Every console screen (React and Vue) takes an optional `locale` prop — `uiLocale` on `TemplateEditorScreen`, whose `locale` is the template's — and `AdminShell` passes it down. Omitted ⇒ English, so embedding apps are unaffected.
  - Dates follow the console language. Sign-in errors from known server reasons are shown translated; other server messages (check findings, validation from the API) stay as the server sends them.

### Patch Changes

- Updated dependencies [b94ed53]
  - @fonderie/client@1.9.0

## 0.7.0

### Minor Changes

- 1a593bc: The admin console now does what the CLI does for config, secrets and templates — and no longer edits the wrong row.
  
  **Fixed — the console could act on a different row than the one clicked:**
  - Opening a config entry or secret dropped its environment: a production-only row opened (and saved over) the shared `all` value.
  - Revealing a secret revealed the list's scope, not the row's environment.
  - Opening a template dropped its locale: the French row opened, and saved, the default copy.
  - `@fonderie/store`: re-creating a key that had been deleted failed with a 500 — the new version 1 collided with the key's surviving revision history. It now continues after the last revision; history is kept.
  
  **New, matching the CLI:**
  - Delete for config, secrets and templates (behind the fresh-code prompt).
  - **Built-in emails cannot be deleted.** `@fonderie/courier` refuses to delete the default-locale row of a seeded or module-shipped template (409 `SYSTEM_TEMPLATE`) and marks those rows `system: true` in the list — they can be edited and rolled back only. Locale variants and app-added templates remain deletable. A test pins the seeded list to migration 002.
  - Environments: filter Config & secrets by environment; create an entry in a chosen environment.
  - Templates: "New template", and "Add locale" on a template (starts from the default copy).
  - Version checks on the config and template editors: a concurrent change shows a conflict with Reload instead of being overwritten.
  - Public config: keys served to frontends are marked "public", with a preview of exactly what `GET /config/public` returns.
  - Audit: from/to date filters. Billing: read a subscriber's wallet in another currency.

### Patch Changes

- Updated dependencies [1a593bc]
  - @fonderie/client@1.8.0

## 0.6.0

### Minor Changes

- a2a9a65: A modernized admin console. Same pages, same data, a surface that reads like a product instead of a text document.
  
  - **Shell:** sidebar with the deployment's host and an environment badge (production is tinted), an icon per page, and the session controls (theme, forget token) docked in its footer instead of floating over content. Below 820px the sidebar becomes a drawer behind a top bar. New optional `AdminShell` props: `appName`, `envLabel`, `footer`.
  - **Pages:** a header on every page saying what it answers, with its actions on the right. Tables and lists are framed cards. Status is a pill (ready / error / advice / skipped) rather than a coloured word. Attention opens with summary tiles (needs action, advice, modules ready, routes). Routes filters as you type. Empty states say what would appear.
  - **Served console:** a sign-in card; the page lives in the URL hash, so reload, bookmarks and back work; hover, focus rings and phone padding from the shell stylesheet.
  - **Config and templates screens** match: framed lists, pill status, card forms, consistent controls.
  
  Every colour is still a `--fonderie-*` token with a light fallback (checked against the served bundle), so embedded screens keep rendering without the shell, and there is still no webfont or icon font — icons are inline SVG paths.

## 0.5.0

### Minor Changes

- cc51775: Admin editors that respect the operator's time.
  
  - **Templates:** the preview sits to the right of the editor and stays pinned
    while the form scrolls (it used to wrap below the fold), and it is always
    live — re-rendered 500 ms after the last edit instead of on a Render click.
    Save is disabled with "No changes to save" until the content differs from
    what is stored.
  - **Config & secrets:** the page had no way to create an entry and rendered
    bare headings when empty. It now has an empty state and **New entry** /
    **New secret** buttons; creating refuses an existing key rather than
    overwriting it. Values are edited by type — Text, Number, On/off or JSON —
    instead of raw JSON, and a value that does not parse shows why (it used to
    fail silently). The list shows each entry's type and value.
  - **client:** `castConfigValue`, `configValueType`, `formatConfigValue`,
    `configKeyProblem` and `CONFIG_VALUE_TYPES` — the typed-value rules the
    editors use, shared so feature-flag hooks can use the same casting.

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/client@1.3.0

## 0.4.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1
  - @fonderie/react-courier-admin@0.4.1

## 0.4.0

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
  - @fonderie/react-courier-admin@0.4.0

## 0.2.0

### Minor Changes

- 04a13c1: **Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.

### Patch Changes

- Updated dependencies [04a13c1]
  - @fonderie/react-courier-admin@0.3.0
