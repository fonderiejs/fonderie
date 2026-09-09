import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { PermissionsEngine } from '../engine';
import { PERMISSIONS_ENGINE_KEY } from '../module';
import { hasAnyRole } from '../services/membership';

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

		const workspaceId =
			ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'];

		if (!workspaceId) {
			return setApiResponse(HTTP.BAD_REQUEST, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		// EXISTS across ALL of the user's roles — a member holding several roles
		// must not be denied because a single arbitrary row was the wrong one.
		if (!(await hasAnyRole(ctx.user.id, workspaceId, allowed, store))) {
			return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Insufficient role');
		}

		return next();
	};
}

export function requireRole(roleName: string | string[], store: IStoreAdapter): Middleware;
export function requireRole(
	roleName: string | string[],
	store: IStoreAdapter,
	ctx: IFonderieContext,
	next: () => Promise<Response>,
): Promise<Response>;
export function requireRole(
	roleName: string | string[],
	store: IStoreAdapter,
	ctx?: IFonderieContext,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	const handler = makeHandler(roleName, store);
	if (ctx !== undefined && next !== undefined) return handler(ctx, next);
	return handler;
}
