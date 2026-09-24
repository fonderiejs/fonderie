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
| GET | `/admin/templates` | `async () => { return setApiResponse(HTTP.OK, 'TEMPLATES_LISTED', 'Templates', await listTemplateEntries(store)); }` |
| DELETE | `/admin/templates/:type` | `async (ctx) => { const ok = await deleteTemplate(typeOf(ctx), localeOf(ctx), store); return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such template'); }` |
| GET | `/admin/templates/:type` | `async (ctx) => { const row = await getTemplateEntry(typeOf(ctx), localeOf(ctx), store); return row ? setApiResponse(HTTP.OK, 'TEMPLATE', 'Template', row) : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such template'); }` |
| PUT | `/admin/templates/:type` | `async (ctx) => { const b = body(ctx); if (typeof b['text'] !== 'string') { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required'); } try { const opts: Parameters<typeof setTemplate>[0] = { type: typeOf(ctx), text: b['text'], locale: localeOf(ctx), actor: actorOf(ctx), }; if (typeof b['subject'] === 'string') opts.subject = b['subject']; if (typeof b['html'] === 'string') opts.html = b['html']; if (typeof b['active'] === 'boolean') opts.active = b['active']; if (typeof b['ifVersion'] === 'number') opts.ifVersion = b['ifVersion']; return setApiResponse(HTTP.OK, 'TEMPLATE_SET', 'Template saved', await setTemplate(opts, store)); } catch (err) { return conflictOr(err); } }` |
| POST | `/admin/templates/:type/preview` | `async (ctx) => { const b = body(ctx); if (typeof b['text'] !== 'string') { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required'); } const data = (b['data'] ?? {}) as Record<string, unknown>; if (typeof data !== 'object' || Array.isArray(data)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.data must be an object'); } const locale = localeOf(ctx); const html = typeof b['html'] === 'string' && b['html'] ? b['html'] : null; const rendered = renderFragment( { text: b['text'], ...(typeof b['subject'] === 'string' ? { subject: b['subject'] } : {}), ...(html ? { html } : {}), }, // Only fetched when there is HTML to wrap, mirroring the resolver. html ? await getLayoutHtml(store, locale ?? undefined) : undefined, // brandName is merged by the Dispatcher on a real send, never by // the resolver — so without this the shell renders the default // brand and the preview quietly misreports it. { ...(brandName ? { brandName } : {}), ...data }, ); // The variables THIS content uses, so an editor can offer exactly the // right fields without re-implementing the {{var}} contract on the // client — four copies of that regex already exist in this repo. return setApiResponse(HTTP.OK, 'TEMPLATE_PREVIEW', 'Rendered preview', { ...rendered, variables: templateVariables(b['subject'] as string, b['text'], html), }); }` |
| GET | `/admin/templates/:type/revisions` | `async (ctx) => { return setApiResponse(HTTP.OK, 'REVISIONS', 'Template revisions', await listTemplateRevisions(typeOf(ctx), localeOf(ctx), store)); }` |
| POST | `/admin/templates/:type/rollback` | `async (ctx) => { const b = body(ctx); const toVersion = Number(b['toVersion']); if (!Number.isInteger(toVersion)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required'); } const row = await rollbackTemplate( { type: typeOf(ctx), locale: localeOf(ctx), toVersion, actor: actorOf(ctx) }, store, ); return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, row); }` |
| POST | `/courier/delivery/mailgun` | `(ctx) => handleMailgunDelivery(ctx.request, store!, signingKeys.mailgun)` |
| POST | `/courier/delivery/mailtrap` | `(ctx) => handleMailtrapDelivery(ctx.request, store!)` |
| POST | `/courier/delivery/sendgrid` | `(ctx) => handleSendGridDelivery(ctx.request, store!, signingKeys.sendgrid)` |

## Migration statements not replayed (verify in raw SQL)

- `ELSE`
- `END IF`
- `END`
- `$fn$ LANGUAGE plpgsql`
