<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/admin — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/_admin` | `async () => setApiResponse( HTTP.OK, 'ADMIN_ATTENTION', 'What needs attention', attention(app, await doctor()), )` |
| GET | `/_admin/doctor` | `async () => setApiResponse(HTTP.OK, 'ADMIN_DOCTOR', 'Reconciliation checks', await doctor())` |
| GET | `/_admin/manifest` | `async () => setApiResponse( HTTP.OK, 'ADMIN_MANIFEST', 'Deployment manifest', buildManifest(app, { version: this.version }), )` |
