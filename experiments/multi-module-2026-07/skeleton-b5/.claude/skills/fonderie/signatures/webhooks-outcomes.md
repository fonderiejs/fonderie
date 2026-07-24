<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/webhooks — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_webhook_deliveries`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
endpoint_id              UUID NOT NULL REFERENCES fonderie_webhook_endpoints(id) ON DELETE CASCADE
event_id                 TEXT NOT NULL
event_type               TEXT NOT NULL
payload                  JSONB NOT NULL
status                   TEXT NOT NULL DEFAULT 'pending'
attempts                 INT NOT NULL DEFAULT 0
response_status          INT
response_body            TEXT
next_attempt_at          TIMESTAMPTZ
delivered_at             TIMESTAMPTZ
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_webhook_endpoints`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id             UUID NOT NULL
url                      TEXT NOT NULL
secret                   TEXT NOT NULL
events                   TEXT[] NOT NULL DEFAULT '{}'
enabled                  BOOLEAN NOT NULL DEFAULT true
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

Raw SQL ships in `node_modules/@fonderie/webhooks/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/webhooks` | `requireAuth → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const list = await new EndpointModel(store).list(ctx.workspace.id); return setApiResponse(HTTP.OK, 'WEBHOOKS_FETCHED', 'Webhook endpoints retrieved.', { endpoints: list.map(toEndpointDTO), }); }` |
| POST | `/webhooks` | `requireAuth → validate(createEndpointSchema) → withBody → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const body = ctx.meta['body'] as { url?: string; events?: string[] } | undefined; if (!body?.url) return setApiResponse(HTTP.UNPROCESSABLE, 'MISSING_FIELD', 'url is required'); const endpoint = await new EndpointModel(store).create({ workspaceId: ctx.workspace.id, url: body.url, secret: generateSecret(), events: body.events ?? [], }); return setApiResponse( HTTP.CREATED, 'WEBHOOK_CREATED', 'Webhook endpoint registered.', toEndpointCreatedDTO(endpoint), ); }` |
| DELETE | `/webhooks/:endpointId` | `requireAuth → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const { endpointId } = ctx.meta['params'] as { endpointId: string }; const deleted = await new EndpointModel(store).delete(endpointId, ctx.workspace.id); if (!deleted) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found'); return new Response(null, { status: HTTP.NO_CONTENT }); }` |
| GET | `/webhooks/:endpointId` | `requireAuth → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const { endpointId } = ctx.meta['params'] as { endpointId: string }; const endpoint = await new EndpointModel(store).findById(endpointId, ctx.workspace.id); if (!endpoint) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found'); return setApiResponse( HTTP.OK, 'WEBHOOK_FETCHED', 'Webhook endpoint retrieved.', toEndpointDTO(endpoint), ); }` |
| PATCH | `/webhooks/:endpointId` | `requireAuth → validate(updateEndpointSchema) → withBody → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const { endpointId } = ctx.meta['params'] as { endpointId: string }; const body = ctx.meta['body'] as | { url?: string; events?: string[]; enabled?: boolean } | undefined; const patch: { url?: string; events?: string[]; enabled?: boolean } = {}; if (body?.url !== undefined) patch.url = body.url; if (body?.events !== undefined) patch.events = body.events; if (body?.enabled !== undefined) patch.enabled = body.enabled; const updated = await new EndpointModel(store).update(endpointId, ctx.workspace.id, patch); if (!updated) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found'); return setApiResponse( HTTP.OK, 'WEBHOOK_UPDATED', 'Webhook endpoint updated.', toEndpointDTO(updated), ); }` |
| GET | `/webhooks/:endpointId/deliveries` | `requireAuth → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const { endpointId } = ctx.meta['params'] as { endpointId: string }; const endpoint = await new EndpointModel(store).findById(endpointId, ctx.workspace.id); if (!endpoint) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found'); const list = await new DeliveryModel(store).listByEndpoint(endpointId); return setApiResponse(HTTP.OK, 'DELIVERIES_FETCHED', 'Deliveries retrieved.', { deliveries: list.map(toDeliveryDTO), }); }` |
| POST | `/webhooks/:endpointId/test` | `requireAuth → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const { endpointId } = ctx.meta['params'] as { endpointId: string }; const endpoint = await new EndpointModel(store).findById(endpointId, ctx.workspace.id); if (!endpoint) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found'); const body = JSON.stringify({ id: `test-${Date.now()}`, type: 'webhook.test', data: { workspaceId: ctx.workspace.id, message: 'Test webhook delivery.' }, }); try { const res = await fetch(endpoint.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signPayload(endpoint.secret, body), 'X-Webhook-Event': 'webhook.test', }, body, signal: AbortSignal.timeout(10_000), }); return setApiResponse(HTTP.OK, 'TEST_SENT', 'Test delivery attempted.', { status: res.status, ok: res.ok, }); } catch (err) { return setApiResponse(HTTP.OK, 'TEST_SENT', 'Test delivery attempted.', { status: null, ok: false, error: err instanceof Error ? err.message : String(err), }); } }` |
