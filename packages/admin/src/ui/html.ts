// The served shell's document. Inlined as a string so it ships in dist with no
// copy step. The script path is passed in, not relative: the surface can be
// mounted under any basePath or path, and a trailing slash must not break it.
export const uiHtml = (scriptPath: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin</title>
<style>html,body{margin:0;background:#fff;color:#111}</style>
</head>
<body>
<div id="root"></div>
<script src="${scriptPath}" defer></script>
</body>
</html>
`;
