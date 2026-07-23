---
"@fonderie/cli": patch
---

Internal: parameterize the `@fonderie` package scope behind a single `SCOPE` constant (matching `scripts/scope.mjs` for the generation tooling). No behavior change — output is byte-identical — but it turns the `@fonderiejs` 1.0.0 launch scope-rename from a find-and-replace across the codebase into a one-line flip (MIGRATION-FONDERIEJS.md § "pre-work"). Overridable at build time via `FONDERIE_SCOPE` for a dry run under a throwaway scope.
