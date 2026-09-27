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
resolved_locale          TEXT
-- INDEX idx_fml_created (created_at DESC)
```

Raw SQL ships in `node_modules/@fonderie/courier/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/admin/template-catalog` | `async () => { const settings = locales(); const rows = await listTemplateEntries(store); const types = [...new Set([...rows.map((r) => r.type), ...defaults.types()])] .filter((t) => t !== '_layout') .sort(); const emails = types.map((type) => ({ type, system: isSystemTemplate(type, null, systemTypes), builtIn: { // The English copy is the default version's built-in fallback. default: defaults.get(type) !== undefined, languages: defaults.languages(type).sort(), }, versions: rows .filter((r) => r.type === type) .map((r) => ({ locale: r.locale, active: r.active, version: r.version, updatedAt: r.updatedAt, })), })); return setApiResponse(HTTP.OK, 'TEMPLATE_CATALOG', 'Template catalog', { defaultLocale: settings.default, fallbacks: settings.fallbacks, emails, }); }` |
| GET | `/admin/templates` | `async () => { const rows = await listTemplateEntries(store); // `system` tells a console which rows it must not offer to delete. return setApiResponse( HTTP.OK, 'TEMPLATES_LISTED', 'Templates', rows.map((r) => ({ ...r, system: isSystemTemplate(r.type, r.locale, systemTypes) })), ); }` |
| DELETE | `/admin/templates/:type` | `async (ctx) => { if (isSystemTemplate(typeOf(ctx), localeOf(ctx), systemTypes)) { return setApiResponse( HTTP.CONFLICT, 'SYSTEM_TEMPLATE', 'This is a built-in email. Edit it or roll it back to an earlier version; it cannot be deleted.', ); } const ok = await deleteTemplate(typeOf(ctx), localeOf(ctx), store); return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such template'); }` |
| GET | `/admin/templates/:type` | `async (ctx) => { const row = await getTemplateEntry(typeOf(ctx), localeOf(ctx), store); return row ? setApiResponse(HTTP.OK, 'TEMPLATE', 'Template', row) : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such template'); }` |
| PUT | `/admin/templates/:type` | `async (ctx) => { const b = body(ctx); if (typeof b['text'] !== 'string') { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required'); } // Stored canonical ('fr-ca' → 'fr-CA'), so one locale is one row. const requested = localeOf(ctx); const locale = requested === null ? null : canonicalLocale(requested); if (requested !== null && !locale) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', `"${requested}" is not a locale tag`); } // The untagged row IS the system locale's version. A second copy tagged // with it would silently override the default for exactly those users, // and edits would land in one copy while mail went out from the other. const system = locales().default; if (locale === system) { return setApiResponse( HTTP.CONFLICT, 'DEFAULT_LOCALE', `${system} is the default version of this email. Edit the default instead of adding ${system}.`, { defaultLocale: system }, ); } try { const opts: Parameters<typeof setTemplate>[0] = { type: typeOf(ctx), text: b['text'], locale, actor: actorOf(ctx), }; if (typeof b['subject'] === 'string') opts.subject = b['subject']; if (typeof b['html'] === 'string') opts.html = b['html']; if (typeof b['active'] === 'boolean') opts.active = b['active']; if (typeof b['ifVersion'] === 'number') opts.ifVersion = b['ifVersion']; return setApiResponse(HTTP.OK, 'TEMPLATE_SET', 'Template saved', await setTemplate(opts, store)); } catch (err) { return conflictOr(err); } }` |
| GET | `/admin/templates/:type/built-in` | `async (ctx) => { const settings = locales(); const tag = canonicalLocale(localeOf(ctx)); const type = typeOf(ctx); const shipped = tag && tag !== settings.default ? defaults.getLocalized(type, tag) : (() => { const def = defaults.get(type); return def ? { copy: def, locale: settings.default } : undefined; })(); if (!shipped) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No built-in copy in that language'); const { subject, html, text } = shipped.copy; return setApiResponse(HTTP.OK, 'BUILT_IN_TEMPLATE', 'Built-in copy', { type, locale: shipped.locale, subject: subject ?? null, html: html ?? null, text, }); }` |
| POST | `/admin/templates/:type/preview` | `async (ctx) => { const b = body(ctx); if (typeof b['text'] !== 'string') { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required'); } const data = (b['data'] ?? {}) as Record<string, unknown>; if (typeof data !== 'object' || Array.isArray(data)) { return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.data must be an object'); } // Rendered as it would send in this locale: its saved shell along its // chain, else the built-in shell in its language. const settings = locales(); const tag = canonicalLocale(localeOf(ctx)) ?? settings.default; const html = typeof b['html'] === 'string' && b['html'] ? b['html'] : null; const rendered = renderFragment( { text: b['text'], ...(typeof b['subject'] === 'string' ? { subject: b['subject'] } : {}), ...(html ? { html } : {}), }, // Only fetched when there is HTML to wrap, mirroring the resolver. html ? await getLayoutHtml(store, tag === settings.default ? undefined : tag, settings) : undefined, // brandName is merged by the Dispatcher on a real send, never by // the resolver — so without this the shell renders the default // brand and the preview quietly misreports it. { ...(brandName ? { brandName } : {}), ...data }, tag, ); // The variables THIS content uses, so an editor can offer exactly the // right fields without re-implementing the {{var}} contract on the // client — four copies of that regex already exist in this repo. return setApiResponse(HTTP.OK, 'TEMPLATE_PREVIEW', 'Rendered preview', { ...rendered, variables: templateVariables(b['subject'] as string, b['text'], html), }); }` |
| GET | `/admin/templates/:type/resolve` | `async (ctx) => { const settings = locales(); const requested = localeOf(ctx); const choice = await chooseCopy(store, defaults, settings, typeOf(ctx), requested ?? undefined); if (!choice) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Nothing would be sent for this email'); return setApiResponse(HTTP.OK, 'TEMPLATE_RESOLUTION', 'Resolution', { requested: canonicalLocale(requested) ?? settings.default, chain: choice.chain, defaultLocale: settings.default, sent: choice.sent, source: choice.source, }); }` |
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
