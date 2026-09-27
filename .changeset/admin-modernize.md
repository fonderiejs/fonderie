---
'@fonderie/admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/react-config-admin-screens': minor
'@fonderie/vue-config-admin-screens': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
---

A modernized admin console. Same pages, same data, a surface that reads like a product instead of a text document.

- **Shell:** sidebar with the deployment's host and an environment badge (production is tinted), an icon per page, and the session controls (theme, forget token) docked in its footer instead of floating over content. Below 820px the sidebar becomes a drawer behind a top bar. New optional `AdminShell` props: `appName`, `envLabel`, `footer`.
- **Pages:** a header on every page saying what it answers, with its actions on the right. Tables and lists are framed cards. Status is a pill (ready / error / advice / skipped) rather than a coloured word. Attention opens with summary tiles (needs action, advice, modules ready, routes). Routes filters as you type. Empty states say what would appear.
- **Served console:** a sign-in card; the page lives in the URL hash, so reload, bookmarks and back work; hover, focus rings and phone padding from the shell stylesheet.
- **Config and templates screens** match: framed lists, pill status, card forms, consistent controls.

Every colour is still a `--fonderie-*` token with a light fallback (checked against the served bundle), so embedded screens keep rendering without the shell, and there is still no webfont or icon font — icons are inline SVG paths.
