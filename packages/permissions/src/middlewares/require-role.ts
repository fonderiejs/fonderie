import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { Middleware }      from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }   from '@fonderie-js/store';

import { PermissionsEngine }      from '../engine';
import { PERMISSIONS_ENGINE_KEY } from '../module';
import { getMembership }          from '../services/membership';

function makeHandler(roleName: string | string[], store: IStoreAdapter): Middleware {
	const allowed = Array.isArray(roleName) ? roleName : [roleName];

	return async (ctx, next) => {
		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}

		const engine = ctx.meta[PERMISSIONS_ENGINE_KEY];
		if (!(engine instanceof PermissionsEngine)) {
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Permissions module not installed');
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'];

		if (!workspaceId) {
			return setApiResponse(HTTP.BAD_REQUEST, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		const membership = await getMembership(ctx.user.id, workspaceId, store);
		if (!membership || !allowed.includes(membership.roleName)) {
			return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Insufficient role');
		}

		return next();
	}
}

export function requireRole(roleName: string | string[], store: IStoreAdapter): Middleware
export function requireRole(roleName: string | string[], store: IStoreAdapter, ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>
export function requireRole(
	roleName: string | string[],
	store:    IStoreAdapter,
	ctx?:     IFonderieContext,
	next?:    () => Promise<Response>,
): Middleware | Promise<Response> {
	const handler = makeHandler(roleName, store)
	if (ctx !== undefined && next !== undefined) return handler(ctx, next)
	return handler
}
