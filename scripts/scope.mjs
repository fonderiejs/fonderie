// Single source of truth for the package scope. The `@fonderiejs` 1.0.0 launch
// (MIGRATION-FONDERIEJS.md) flips this ONE line — every generation/scan below
// derives the scope from it, so the migration is a one-liner, not a sweep.
// Override at build time with FONDERIE_SCOPE for a dry run under a throwaway scope.
export const SCOPE = process.env.FONDERIE_SCOPE ?? '@fonderie';
export const SCOPE_PREFIX = `${SCOPE}/`; // e.g. '@fonderie/'
