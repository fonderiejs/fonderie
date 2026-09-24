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
// The dark palette, applied from two places: when the OS asks for it, and when
// the operator asks for it explicitly. Declared once so the two cannot drift.
const DARK = `
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
`;

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
/* OS says dark, and the operator has not overridden it. */
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}
/* The operator chose dark, whatever the OS says. Without this rule "Dark" on a
   light machine did nothing — the console could only ever follow the system. */
:root[data-theme="dark"]{${DARK}}
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

/* Theme switcher — copied from the organisation UI (theme.css .theme-switch),
   with --color-* mapped to --fonderie-*. It lives here rather than in inline
   styles because the selected pill is expressed with :has(input:checked): the
   radio is the state, so nothing in React has to style the label by hand. */
.theme-switch{
display:inline-flex;
align-items:center;
gap:0;
border:1px solid var(--fonderie-border);
border-radius:9999px;
padding:3px;
margin:0;
background:var(--fonderie-bg);
}
.theme-switch__option{
display:inline-flex;
align-items:center;
gap:4px;
padding:4px 10px;
border-radius:9999px;
cursor:pointer;
font-size:12px;
color:var(--fonderie-text-muted);
transition:background .15s,color .15s;
white-space:nowrap;
}
.theme-switch__option input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.theme-switch__option:has(input:checked){
background:var(--fonderie-surface);
color:var(--fonderie-text);
box-shadow:0 1px 2px rgba(0,0,0,.06);
}
/* :has() is wide but not universal. Without it every option reads as unselected
   and the control looks broken, so keyboard focus alone must still show where
   you are — this is the fallback that keeps it usable. */
.theme-switch__option:focus-within{color:var(--fonderie-text)}
.theme-switch__option svg{flex-shrink:0}
.theme-switch__option span{line-height:1}
`;

// Applies a STORED theme before the first paint. Without it an operator who
// chose light on a dark machine gets a dark flash on every load, which is the
// specific thing a console cannot look like.
//
// "System" is the ABSENCE of the attribute, so this script does nothing in that
// case and the media query above handles it — which also means system-mode
// follows the OS live, with no listener. The organisation's own switcher
// resolves system eagerly to a concrete value and writes it, so a machine that
// flips to dark at sunset keeps the old theme until reload; this does not.
//
// Degrades correctly: if localStorage throws, or a consumer's CSP blocks the
// inline script, no attribute is set and the console follows the system — the
// default either way.
const BOOT = `(function(){try{var t=localStorage.getItem('fonderie.admin.theme');` +
	`if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export const uiHtml = (scriptPath: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>Admin</title>
<style>${TOKENS}</style>
<script>${BOOT}</script>
</head>
<body>
<div id="root"></div>
<script src="${scriptPath}" defer></script>
</body>
</html>
`;
