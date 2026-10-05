import type { Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import { requireAuth } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';
import { withWorkspace } from '@fonderie/workspaces';

import { AuditEventModel } from './models/event.model';
import { toAuditEventDTO, encodeCursor } from './dtos/audit';

type Route = [string, string, ...Middleware[]];

export interface IAuditConfig {
	/**
	 * Who may read the workspace's trail (docs/INSIDER-THREAT-DESIGN.md, I1).
	 * A permission key: reading requires `read` on it, through
	 * @fonderie/permissions (fail closed when that module is missing). Unset,
	 * any member of the workspace reads it — the trail names who did what to
	 * whom, so most apps grant it to managers only.
	 */
	permission?: string;
}

export function buildAuditRoutes(store: IStoreAdapter, config: IAuditConfig = {}): Route[] {
	return [
		[
			'GET',
			'/audit',
			requireAuth,
			resolveWorkspace(store),
			...(config.permission ? [requireAuditRead(config.permission)] : []),
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

// @fonderie/permissions is not a dependency: its module puts its engine on every
// request. Read by shape; missing while a permission is configured → refuse.
function requireAuditRead(key: string): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		const engine = ctx.meta['fonderie.permissions.engine'] as
			| { can?: (u: string, op: 'read', k: string, ws: string) => Promise<boolean> }
			| undefined;
		if (typeof engine?.can !== 'function') {
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Permissions module not installed');
		}
		if (!ctx.workspace) return next(); // the handler answers 422
		if (!(await engine.can(ctx.user.id, 'read', key, ctx.workspace.id))) {
			return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', `Permission denied: read:${key}`);
		}
		return next();
	};
}

// The workspace the trail is for: from X-Workspace-ID, membership verified
// (@fonderie/workspaces). Before, the route only READ ctx.workspace and nothing
// set it — every request answered 422 MISSING_WORKSPACE unless the app ran its
// own workspace middleware. One that already set it still wins.
function resolveWorkspace(store: IStoreAdapter): Middleware {
	const resolve = withWorkspace(store);
	return (ctx, next) => (ctx.workspace ? next() : resolve(ctx, next));
}

