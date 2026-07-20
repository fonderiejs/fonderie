<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/audit — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/audit` | `requireAuth → async (ctx) => { if (!ctx.workspace) return setApiResponse( HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required', ); const url = new URL(ctx.request.url); const params = url.searchParams; const limit = Math.min(Number(params.get('limit') ?? 50), 200); const type = params.get('type') ?? undefined; const actor = params.get('actorId') ?? undefined; const from = params.get('from') ? new Date(params.get('from')!) : undefined; const to = params.get('to') ? new Date(params.get('to')!) : undefined; const cursor = params.get('cursor') ?? undefined; const query: Parameters<AuditEventModel['list']>[0] = { workspaceId: ctx.workspace.id, limit: limit + 1, }; if (type) query.type = type; if (actor) query.actorId = actor; if (from) query.from = from; if (to) query.to = to; if (cursor) query.cursor = cursor; const events = await new AuditEventModel(store).list(query); // fetch one extra to determine if there's a next page const hasMore = events.length > limit; const page = hasMore ? events.slice(0, limit) : events; const lastEvent = page[page.length - 1]; const nextCursor = hasMore && lastEvent ? encodeCursor(lastEvent.createdAt, lastEvent.id) : null; return setApiResponse(HTTP.OK, 'AUDIT_FETCHED', 'Audit events retrieved.', { events: page.map(toAuditEventDTO), nextCursor, }); }` |
