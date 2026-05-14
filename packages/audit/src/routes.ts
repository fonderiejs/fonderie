import type { Middleware }      from '@fonderie-js/core';
import { setApiResponse, HTTP } from '@fonderie-js/core';
import { requireAuth }          from '@fonderie-js/core/middlewares';
import type { IStoreAdapter }   from '@fonderie-js/store';

import { AuditEventModel }          from './models/event.model';
import { toAuditEventDTO, encodeCursor } from './dtos/audit';

type Route = [string, string, ...Middleware[]];

export function buildAuditRoutes(store: IStoreAdapter): Route[] {
	return [

		['GET', '/audit', requireAuth, async (ctx) => {
			if (!ctx.workspace) return setApiResponse(HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required');

			const url    = new URL(ctx.request.url);
			const params = url.searchParams;

			const limit  = Math.min(Number(params.get('limit') ?? 50), 200);
			const type   = params.get('type')    ?? undefined;
			const actor  = params.get('actorId') ?? undefined;
			const from   = params.get('from')    ? new Date(params.get('from')!) : undefined;
			const to     = params.get('to')      ? new Date(params.get('to')!)   : undefined;
			const cursor = params.get('cursor')  ?? undefined;

			const query: Parameters<AuditEventModel['list']>[0] = { workspaceId: ctx.workspace.id, limit: limit + 1 };
			if (type)   query.type    = type;
			if (actor)  query.actorId = actor;
			if (from)   query.from    = from;
			if (to)     query.to      = to;
			if (cursor) query.cursor  = cursor;

			const events = await new AuditEventModel(store).list(query);

			// fetch one extra to determine if there's a next page
			const hasMore    = events.length > limit;
			const page       = hasMore ? events.slice(0, limit) : events;
			const lastEvent  = page[page.length - 1];
			const nextCursor = hasMore && lastEvent
				? encodeCursor(lastEvent.createdAt, lastEvent.id)
				: null;

			return setApiResponse(HTTP.OK, 'AUDIT_FETCHED', 'Audit events retrieved.', {
				events:     page.map(toAuditEventDTO),
				nextCursor,
			});
		}],

	];
}
