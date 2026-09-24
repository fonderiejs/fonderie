---
'@fonderie/admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/react-config-admin-screens': minor
'@fonderie/vue-config-admin-screens': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
---

Theme the admin console with the organisation's design tokens.

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
