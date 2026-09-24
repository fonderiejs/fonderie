// The served shell's document. Inlined as a string so it ships in dist with no
// copy step. The script path is passed in, not relative: the surface can be
// mounted under any basePath or path, and a trailing slash must not break it.
//
// The `:root` block is the organisation's design tokens (organization/ui/base.css),
// carried here rather than imported: this file is a string in dist, the admin
// package has no CSS pipeline, and an operator console must not depend on a
// stylesheet it might fail to fetch. Screens read these through
// `var(--fonderie-*)` in their inline styles, so the palette lives in exactly
// one place and both light and dark follow from it.
//
// Namespaced `--fonderie-*` deliberately. The dashboard can be mounted inside a
// consumer's own page, and bare `--color-text` would collide with theirs —
// silently, and only in their app.
//
// NO WEBFONT. The tokens name Inter first and fall through to the system stack,
// but nothing is fetched: an admin console should not announce its existence to
// a third party, and it has to work on an air-gapped deploy.
const TOKENS = `
:root{
--fonderie-accent:#00d294;
--fonderie-accent-strong:#009767;
--fonderie-warning:#f5a623;
--fonderie-danger:#e00;
--fonderie-bg:#fafafa;
--fonderie-surface:#fff;
--fonderie-surface-alt:#fafafa;
--fonderie-border:#e0e0e0;
--fonderie-border-light:#f5f5f5;
--fonderie-text:#171717;
--fonderie-text-muted:#5c5c5c;
--fonderie-topbar:#000;
--fonderie-font:Inter,"Inter Fallback",-apple-system,BlinkMacSystemFont,"Helvetica Neue",system-ui,sans-serif;
--fonderie-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
--fonderie-tracking-display:-0.05em;
--fonderie-tracking-body:-0.02em;
--fonderie-radius:4px;
--fonderie-radius-lg:8px;
--fonderie-shadow-card:0 2px 3px 0 rgba(0,0,0,.05);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
--fonderie-accent:#00d294;
--fonderie-accent-strong:#00e6a2;
--fonderie-warning:#f5a623;
--fonderie-danger:#f33;
--fonderie-bg:#0a0a0a;
--fonderie-surface:#111;
--fonderie-surface-alt:#1a1a1a;
--fonderie-border:#27272a;
--fonderie-border-light:#1c1c1e;
--fonderie-text:#ededed;
--fonderie-text-muted:#a1a1aa;
--fonderie-topbar:#0a0a0a;
--fonderie-shadow-card:0 2px 3px 0 rgba(0,0,0,.3);
}}
html,body{margin:0;padding:0}
body{
background:var(--fonderie-bg);
color:var(--fonderie-text);
font-family:var(--fonderie-font);
font-size:14px;
line-height:1.7;
letter-spacing:var(--fonderie-tracking-body);
-webkit-font-smoothing:antialiased;
-moz-osx-font-smoothing:grayscale;
}
h1,h2,h3{letter-spacing:var(--fonderie-tracking-display);font-weight:600;line-height:1.25}
code,pre{font-family:var(--fonderie-mono)}
/* Focus must stay visible on a console that performs irreversible actions. */
:focus-visible{outline:2px solid var(--fonderie-accent);outline-offset:2px}
`;

export const uiHtml = (scriptPath: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>Admin</title>
<style>${TOKENS}</style>
</head>
<body>
<div id="root"></div>
<script src="${scriptPath}" defer></script>
</body>
</html>
`;
