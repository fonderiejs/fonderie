import { setErrorResponse }    from '@fonderie-js/core';
import type { Middleware }      from '@fonderie-js/core';
import type { IStoreAdapter }   from '@fonderie-js/store';

import { PermissionsEngine }      from '../engine';
import { PERMISSIONS_ENGINE_KEY } from '../module';
import { getMembership }          from '../services/membership';

export function requireRole(
	roleName: string | string[],
	store:    IStoreAdapter,
): Middleware {
	const allowed = Array.isArray(roleName) ? roleName : [roleName];

	return async (ctx, next) => {
		if (!ctx.user) {
			return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
		}

		const engine = ctx.meta[PERMISSIONS_ENGINE_KEY];
		if (!(engine instanceof PermissionsEngine)) {
			return setErrorResponse(500, 'SERVER_ERROR', 'Permissions module not installed');
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'];

		if (!workspaceId) {
			return setErrorResponse(400, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		const membership = await getMembership(ctx.user.id, workspaceId, store);
		if (!membership || !allowed.includes(membership.roleName)) {
			return setErrorResponse(403, 'FORBIDDEN', 'Insufficient role');
		}

		return next();
	}
}
