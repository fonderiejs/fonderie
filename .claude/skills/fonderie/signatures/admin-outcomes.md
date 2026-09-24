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

### `fonderie_admin_tokens`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                     TEXT NOT NULL
token_hash               TEXT NOT NULL UNIQUE
scopes                   TEXT[] NOT NULL
created_by               TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at               TIMESTAMPTZ
revoked_at               TIMESTAMPTZ
last_used_at             TIMESTAMPTZ
```

Raw SQL ships in `node_modules/@fonderie/admin/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/_admin` | `async () => setApiResponse( HTTP.OK, 'ADMIN_ATTENTION', 'What needs attention', attention(app, await doctor()), )` |
| GET | `/_admin/access/tokens` | `async () => setApiResponse( HTTP.OK, 'ADMIN_TOKENS', 'Admin tokens', tokensReport(app, this.name, store ? await listTokens(store) : null), )` |
| POST | `/_admin/access/tokens` | `[ validate(issueTokenSchema), async (ctx) => { const body = ctx.meta['body'] as { name: string; scopes: AdminScope[]; expiresInDays?: number; }; const createdBy = ctx.request.headers.get('x-actor') || 'admin-token'; const { token: plaintext, record } = await issueToken(store, { ...body, createdBy, }); // The plaintext is returned once and never stored. return setApiResponse(HTTP.CREATED, 'TOKEN_ISSUED', 'Token issued — shown once', { token: plaintext, ...record, }); }, ]` |
| DELETE | `/_admin/access/tokens/:id` | `[ async (ctx) => { const ok = await revokeToken(store, ctx.meta.params?.['id'] ?? ''); return ok ? setApiResponse(HTTP.OK, 'TOKEN_REVOKED', 'Token revoked') : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such live token'); }, ]` |
| GET | `/_admin/activity/admin-log` | `async (ctx) => { const q = new URL(ctx.request.url).searchParams; const limit = Number(q.get('limit')) || undefined; const before = q.get('before') ?? undefined; const page = await readAdminLog(store, { ...(limit ? { limit } : {}), ...(before ? { before } : {}), }); return setApiResponse(HTTP.OK, 'ADMIN_LOG', 'Admin activity', page); }` |
| GET | `/_admin/config` | `async () => setApiResponse( HTTP.OK, 'ADMIN_CONFIG', 'Declared vs held', configReport(app, this.options.env ?? []), )` |
| GET | `/_admin/doctor` | `async () => setApiResponse(HTTP.OK, 'ADMIN_DOCTOR', 'Reconciliation checks', await doctor())` |
| GET | `/_admin/manifest` | `async () => setApiResponse( HTTP.OK, 'ADMIN_MANIFEST', 'Deployment manifest', buildManifest(app, { version: this.version, log: Boolean(store), host: this.hosts }), )` |
| GET | `/_admin/migrations` | `[ async () => setApiResponse( HTTP.OK, 'MIGRATIONS', 'Pending migrations by module', await migrationsReport(store, migrationSets), ), ]` |
| POST | `/_admin/migrations/:module/apply` | `[ validate(applyMigrationsSchema), async (ctx) => { const { expect } = ctx.meta['body'] as { expect: string[] }; const name = ctx.meta.params?.['module'] ?? ''; const out = await applyModuleMigrations(store, migrationSets, name, expect); if (out.ok) { return setApiResponse( HTTP.OK, out.reason, out.reason === 'MIGRATIONS_APPLIED' ? `Applied. ${out.module.pending.length} still pending in ${name}.` : `${name} is already up to date`, out.module, ); } switch (out.reason) { case 'NOT_FOUND': return setApiResponse( HTTP.NOT_FOUND, 'NOT_FOUND', `No migration set named "${name}"`, ); case 'MIGRATIONS_OUT_OF_ORDER': return setApiResponse( HTTP.CONFLICT, out.reason, `Apply "${out.blockedBy}" first — it runs before "${name}" and is behind.`, { blockedBy: out.blockedBy }, ); case 'MIGRATIONS_CHANGED': return setApiResponse( HTTP.CONFLICT, out.reason, 'What is pending changed since you looked. Refresh and read it again.', { expected: out.expected, actual: out.actual }, ); default: return setApiResponse( HTTP.UNPROCESSABLE, out.reason, 'A pending migration deletes data. No down-migration brings it back — ' + 'apply it through CI or `npm run migrate`, not from here.', { files: out.files }, ); } }, ]` |
| GET | `/_admin/routes` | `async () => setApiResponse(HTTP.OK, 'ADMIN_ROUTES', 'Exposed routes', routesReport(app, this.name))` |
