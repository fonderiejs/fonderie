<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/admin — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_admin_log`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
at                       TIMESTAMPTZ NOT NULL DEFAULT now()
actor                    TEXT NOT NULL
method                   TEXT NOT NULL
path                     TEXT NOT NULL
route                    TEXT NOT NULL
module                   TEXT NOT NULL
status                   INTEGER NOT NULL
duration_ms              INTEGER NOT NULL
request_id               TEXT
client_ip                TEXT
```

Raw SQL ships in `node_modules/@fonderie/admin/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/_admin` | `async () => setApiResponse( HTTP.OK, 'ADMIN_ATTENTION', 'What needs attention', attention(app, await doctor()), )` |
| GET | `/_admin/access/tokens` | `async () => setApiResponse(HTTP.OK, 'ADMIN_TOKENS', 'Admin tokens', tokensReport(app, this.name))` |
| GET | `/_admin/activity/admin-log` | `async (ctx) => { const q = new URL(ctx.request.url).searchParams; const limit = Number(q.get('limit')) || undefined; const before = q.get('before') ?? undefined; const page = await readAdminLog(store, { ...(limit ? { limit } : {}), ...(before ? { before } : {}), }); return setApiResponse(HTTP.OK, 'ADMIN_LOG', 'Admin activity', page); }` |
| GET | `/_admin/config` | `async () => setApiResponse( HTTP.OK, 'ADMIN_CONFIG', 'Declared vs held', configReport(app, this.options.env ?? []), )` |
| GET | `/_admin/doctor` | `async () => setApiResponse(HTTP.OK, 'ADMIN_DOCTOR', 'Reconciliation checks', await doctor())` |
| GET | `/_admin/manifest` | `async () => setApiResponse( HTTP.OK, 'ADMIN_MANIFEST', 'Deployment manifest', buildManifest(app, { version: this.version, log: Boolean(store) }), )` |
| GET | `/_admin/routes` | `async () => setApiResponse(HTTP.OK, 'ADMIN_ROUTES', 'Exposed routes', routesReport(app, this.name))` |
