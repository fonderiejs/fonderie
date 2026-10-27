<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/sse — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `{base}/stream` | `...before → (ctx) => this.stream(ctx)` |
| GET | `{base}/topics` | `...before → async (ctx) => this.topics(ctx)` |
