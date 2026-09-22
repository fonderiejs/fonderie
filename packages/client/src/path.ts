// Where an admin surface is mounted, as CONFIG: trailing slashes are typing,
// not meaning, so '/_admin', '/_admin/' and '/_admin//' are one prefix.
//
// This duplicates `normalizeMountPath` in @fonderie/core on purpose: this
// package ships with **zero runtime dependencies** so it can be dropped into
// any frontend, and importing a server package to strip a slash would end
// that. One copy here, used by every admin client — not one per client.
export const normalizeMountPath = (path: string): string => path.replace(/\/+$/, '');
