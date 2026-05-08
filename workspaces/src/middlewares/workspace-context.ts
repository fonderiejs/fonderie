import type { Middleware }    from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import { getMember }          from '../services/members';
import { findWorkspaceById }  from '../services/workspaces';

// Resolves ctx.workspace from the route param :workspaceId
// Validates the current user is a member
// Must run after auth middleware

export function workspaceContextMiddleware(store: IStoreAdapter): Middleware {
	return async (ctx, next) => {
		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId = params?.['workspaceId'];

		if (!workspaceId) {
			return next();
		}

		const workspace = await findWorkspaceById(workspaceId, store)
		if (!workspace) {
			return Response.json({ error: 'Workspace not found' }, { status: 404 });
		}

		// If user is authenticated, verify membership
		if (ctx.user) {
			const member = await getMember(ctx.user.id, workspaceId, store);
			if (!member) {
				return Response.json({ error: 'Not a member of this workspace' }, { status: 403 });
			}
		}

		Object.assign(ctx, { workspace });

		return next();
	}
}
