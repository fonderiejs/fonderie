<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/courier — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_courier_template_revisions`

```sql
type                     TEXT NOT NULL
locale                   TEXT
subject                  TEXT
html                     TEXT
text                     TEXT NOT NULL
version                  INT NOT NULL
actor                    TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_courier_templates`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
type                     TEXT NOT NULL
locale                   TEXT
subject                  TEXT
html                     TEXT
text                     TEXT NOT NULL
active                   BOOLEAN NOT NULL DEFAULT true
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
version                  INT NOT NULL DEFAULT 1
updated_by               TEXT
-- UNIQUE (type, locale)
```

### `fonderie_message_log`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
message_type             TEXT NOT NULL
channel                  TEXT NOT NULL
recipient                TEXT NOT NULL
locale                   TEXT
status                   TEXT NOT NULL DEFAULT 'pending'
error                    TEXT
attempts                 INT NOT NULL DEFAULT 0
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
sent_at                  TIMESTAMPTZ
provider                 TEXT
provider_message_id      TEXT
opened_at                TIMESTAMPTZ
clicked_at               TIMESTAMPTZ
bounced_at               TIMESTAMPTZ
bounce_reason            TEXT
-- INDEX idx_fml_created (created_at DESC)
```

Raw SQL ships in `node_modules/@fonderie/courier/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/admin/templates` | `g(async () => { return setApiResponse(HTTP.OK, 'TEMPLATES_LISTED', 'Templates', await listTemplateEntries(store)); })` |
| DELETE | `/admin/templates/:type` | `g(async (ctx) => { const ok = await deleteTemplate(typeOf(ctx), localeOf(ctx), store); return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such template'); })` |
| GET | `/admin/templates/:type` | `g(async (ctx) => { const row = await getTemplateEntry(typeOf(ctx), localeOf(ctx), store); return row ? setApiResponse(HTTP.OK, 'TEMPLATE', 'Template', row) : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such template'); })` |
| PUT | `/admin/templates/:type` | `g(async (ctx) => { const b = body(ctx); if (typeof b['text'] !== 'string') { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required'); } try { const opts: Parameters<typeof setTemplate>[0] = { type: typeOf(ctx), text: b['text'], locale: localeOf(ctx), actor: actorOf(ctx), }; if (typeof b['subject'] === 'string') opts.subject = b['subject']; if (typeof b['html'] === 'string') opts.html = b['html']; if (typeof b['active'] === 'boolean') opts.active = b['active']; if (typeof b['ifVersion'] === 'number') opts.ifVersion = b['ifVersion']; return setApiResponse(HTTP.OK, 'TEMPLATE_SET', 'Template saved', await setTemplate(opts, store)); } catch (err) { return conflictOr(err); } })` |
| GET | `/admin/templates/:type/revisions` | `g(async (ctx) => { return setApiResponse(HTTP.OK, 'REVISIONS', 'Template revisions', await listTemplateRevisions(typeOf(ctx), localeOf(ctx), store)); })` |
| POST | `/admin/templates/:type/rollback` | `g(async (ctx) => { const b = body(ctx); const toVersion = Number(b['toVersion']); if (!Number.isInteger(toVersion)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required'); } const row = await rollbackTemplate( { type: typeOf(ctx), locale: localeOf(ctx), toVersion, actor: actorOf(ctx) }, store, ); return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, row); })` |

## Migration statements not replayed (verify in raw SQL)

- `ELSE`
- `END IF`
- `END`
- `$fn$ LANGUAGE plpgsql`
