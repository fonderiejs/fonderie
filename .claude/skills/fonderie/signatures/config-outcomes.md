<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/config — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_config`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
key                      TEXT NOT NULL
value                    TEXT NOT NULL
environment              TEXT NOT NULL DEFAULT 'all'
description              TEXT
active                   BOOLEAN NOT NULL DEFAULT true
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
version                  INT NOT NULL DEFAULT 1
updated_by               TEXT
-- UNIQUE (key, environment)
```

### `fonderie_config_revisions`

```sql
key                      TEXT NOT NULL
environment              TEXT NOT NULL DEFAULT 'all'
value                    TEXT NOT NULL
version                  INT NOT NULL
actor                    TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- PRIMARY KEY (key, environment, version)
```

### `fonderie_secret_revisions`

```sql
key                      TEXT NOT NULL
environment              TEXT NOT NULL DEFAULT 'all'
value                    TEXT NOT NULL
version                  INT NOT NULL
actor                    TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- PRIMARY KEY (key, environment, version)
```

### `fonderie_secrets`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
key                      TEXT NOT NULL
value                    TEXT NOT NULL
environment              TEXT NOT NULL DEFAULT 'all'
description              TEXT
active                   BOOLEAN NOT NULL DEFAULT true
version                  INT NOT NULL DEFAULT 1
updated_by               TEXT
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- UNIQUE (key, environment)
```

Raw SQL ships in `node_modules/@fonderie/config/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/admin/config` | `g(async (ctx) => { const rows = await listConfigEntries(envOf(ctx) ?? null, store); return setApiResponse(HTTP.OK, 'CONFIG_LISTED', 'Config entries', rows.map(withParsedValue)); })` |
| DELETE | `/admin/config/:key` | `g(async (ctx) => { const ok = await deleteConfigEntry(keyOf(ctx), envOf(ctx) ?? 'all', store); return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such config entry'); })` |
| GET | `/admin/config/:key` | `g(async (ctx) => { const row = await getConfigEntry(keyOf(ctx), envOf(ctx) ?? 'all', store); return row ? setApiResponse(HTTP.OK, 'CONFIG_ENTRY', 'Config entry', withParsedValue(row)) : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such config entry'); })` |
| PUT | `/admin/config/:key` | `g(async (ctx) => { const b = body(ctx); if (!('value' in b)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.value is required'); } try { const row = await setConfigEntry( { key: keyOf(ctx), value: b['value'], ...writeOpts(ctx, b) }, store, ); return setApiResponse(HTTP.OK, 'CONFIG_SET', 'Config entry saved', withParsedValue(row)); } catch (err) { return conflictOr(err); } })` |
| GET | `/admin/config/:key/revisions` | `g(async (ctx) => { const revs = await listConfigRevisions(keyOf(ctx), envOf(ctx) ?? 'all', store); return setApiResponse(HTTP.OK, 'REVISIONS', 'Config revisions', revs.map(withParsedValue)); })` |
| POST | `/admin/config/:key/rollback` | `g(async (ctx) => { const b = body(ctx); const toVersion = Number(b['toVersion']); if (!Number.isInteger(toVersion)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required'); } const row = await rollbackConfigEntry( rollbackOpts(ctx, b, toVersion), store, ); return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, withParsedValue(row)); })` |
| GET | `/admin/secrets` | `g(async (ctx) => { const rows = await listSecrets(envOf(ctx) ?? null, store); return setApiResponse(HTTP.OK, 'SECRETS_LISTED', 'Secrets (masked)', rows); })` |
| DELETE | `/admin/secrets/:key` | `g(async (ctx) => { const ok = await deleteSecret(keyOf(ctx), envOf(ctx) ?? 'all', store); return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such secret'); })` |
| GET | `/admin/secrets/:key` | `g(async (ctx) => { const row = await getSecret(keyOf(ctx), envOf(ctx) ?? 'all', store); return row ? setApiResponse(HTTP.OK, 'SECRET', 'Secret (masked)', row) : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such secret'); })` |
| PUT | `/admin/secrets/:key` | `g(async (ctx) => { const b = body(ctx); if (typeof b['value'] !== 'string') { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.value (string) is required'); } try { const row = await setSecret( { key: keyOf(ctx), value: b['value'], ...writeOpts(ctx, b) }, store, encryptor, ); return setApiResponse(HTTP.OK, 'SECRET_SET', 'Secret saved (masked)', row); } catch (err) { return conflictOr(err); } })` |
| POST | `/admin/secrets/:key/reveal` | `g(async (ctx) => { const value = await revealSecret(keyOf(ctx), envOf(ctx) ?? 'all', store, encryptor); return value === null ? setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such secret') : setApiResponse(HTTP.OK, 'SECRET_REVEALED', 'Decrypted secret value', { value }); })` |
| GET | `/admin/secrets/:key/revisions` | `g(async (ctx) => { const revs = await listSecretRevisions(keyOf(ctx), envOf(ctx) ?? 'all', store); return setApiResponse(HTTP.OK, 'REVISIONS', 'Secret revisions', revs); })` |
| POST | `/admin/secrets/:key/rollback` | `g(async (ctx) => { const b = body(ctx); const toVersion = Number(b['toVersion']); if (!Number.isInteger(toVersion)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required'); } const row = await rollbackSecret( rollbackOpts(ctx, b, toVersion), store, ); return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, row); })` |
