import type { Middleware }    from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import { PermissionsEngine }   from '../engine';
import { PERMISSIONS_ENGINE_KEY } from '../module';
import { getMembership }      from '../services/membership';

export function requireRole(
	roleName: string | string[],
	store:    IStoreAdapter,
): Middleware {
	const allowed = Array.isArray(roleName) ? roleName : [roleName];

	return async (ctx, next) => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const engine = ctx.meta[PERMISSIONS_ENGINE_KEY];
		const isPermissionEngine = engine instanceof PermissionsEngine;
		if (!isPermissionEngine) {
			return Response.json({ error: 'Permissions module not installed' }, { status: 500 });
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'];

		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		const membership = await getMembership(ctx.user.id, workspaceId, store);
		if (!membership || !allowed.includes(membership.roleName)) {
			return Response.json({ error: 'Insufficient role' }, { status: 403 });
		}

		return next();
	}
}
