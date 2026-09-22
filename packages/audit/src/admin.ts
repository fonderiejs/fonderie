import type { IAdminRoute, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { encodeCursor, toAuditEventDTO } from './dtos/audit';
import { AuditEventModel } from './models/event.model';

const ADMIN_PREFIX = '/_admin';

// The operator's read across every workspace — the same filters and DTO as
// the workspace-scoped route, plus an optional workspaceId. Declared at the
// default admin path so the route table reads literally; re-based by
// @fonderie/admin. No standalone surface.
function adminRouteTable(store: IStoreAdapter): Array<[string, string, Middleware]> {
	return [
		[
			'GET',
			'/_admin/audit',
			async (ctx) => {
				const params = new URL(ctx.request.url).searchParams;
				const rawLimit = Number(params.get('limit') ?? 50);
				const limit = Number.isFinite(rawLimit)
					? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
					: 50;
				const from = params.get('from') ? new Date(params.get('from') as string) : undefined;
				const to = params.get('to') ? new Date(params.get('to') as string) : undefined;
				if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())))
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'INVALID_PARAMETER',
						'from/to must be ISO dates',
					);
				const query: Parameters<AuditEventModel['listAcross']>[0] = { limit };
				const workspaceId = params.get('workspaceId');
				const type = params.get('type');
				const actorId = params.get('actorId');
				const cursor = params.get('cursor');
				if (workspaceId) query.workspaceId = workspaceId;
				if (type) query.type = type;
				if (actorId) query.actorId = actorId;
				if (from) query.from = from;
				if (to) query.to = to;
				if (cursor) query.cursor = cursor;
				const { events, hasMore } = await new AuditEventModel(store).listAcross(query);
				const last = events[events.length - 1];
				const nextCursor =
					hasMore && last ? encodeCursor(last.createdAtRaw ?? last.createdAt, last.id) : null;
				return setApiResponse(HTTP.OK, 'AUDIT', 'Audit events', {
					events: events.map(toAuditEventDTO),
					nextCursor,
				});
			},
		],
	];
}

export function describeAuditAdminRoutes(store: IStoreAdapter): IAdminRoute[] {
	return adminRouteTable(store).map(([method, path, h]) => ({
		method,
		path: path.slice(ADMIN_PREFIX.length),
		handlers: [h],
	}));
}
