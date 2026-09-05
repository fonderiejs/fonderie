import type { Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import { requireAuth } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';

import { AuditEventModel } from './models/event.model';
import { toAuditEventDTO, encodeCursor } from './dtos/audit';

type Route = [string, string, ...Middleware[]];

export function buildAuditRoutes(store: IStoreAdapter): Route[] {
	return [
		[
			'GET',
			'/audit',
			requireAuth,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const url = new URL(ctx.request.url);
				const params = url.searchParams;

				const rawLimit = Number(params.get('limit') ?? 50);
				const limit = Number.isFinite(rawLimit)
					? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
					: 50;
				const type = params.get('type') ?? undefined;
				const actor = params.get('actorId') ?? undefined;
				const from = params.get('from') ? new Date(params.get('from')!) : undefined;
				const to = params.get('to') ? new Date(params.get('to')!) : undefined;
				const cursor = params.get('cursor') ?? undefined;

				const query: Parameters<AuditEventModel['list']>[0] = {
					workspaceId: ctx.workspace.id,
					limit,
				};
				if (type) query.type = type;
				if (actor) query.actorId = actor;
				if (from) query.from = from;
				if (to) query.to = to;
				if (cursor) query.cursor = cursor;

				// The model over-fetches internally to detect a next page; the
				// cursor carries the row's created_at::text at full microsecond
				// precision so same-millisecond events can't be skipped.
				const { events, hasMore } = await new AuditEventModel(store).list(query);
				const lastEvent = events[events.length - 1];
				const nextCursor =
					hasMore && lastEvent
						? encodeCursor(lastEvent.createdAtRaw ?? lastEvent.createdAt, lastEvent.id)
						: null;

				return setApiResponse(HTTP.OK, 'AUDIT_FETCHED', 'Audit events retrieved.', {
					events: events.map(toAuditEventDTO),
					nextCursor,
				});
			},
		],
	];
}
