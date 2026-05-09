import { setErrorResponse }   from '@fonderie-js/core';
import type { Middleware }     from '@fonderie-js/core';
import type { IStoreAdapter }  from '@fonderie-js/store';

import { getMember }          from '../services/members';
import { findWorkspaceById }  from '../services/workspaces';

// Resolves ctx.workspace from:
//   1. Route param :workspaceId or :id (path-based admin routes)
//   2. X-Workspace-ID request header (standard resource routes)
// Validates the current user is an active member.
// Must run after auth middleware.

export function workspaceContextMiddleware(store: IStoreAdapter): Middleware {
	return async (ctx, next) => {
		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId =
			params?.['workspaceId'] ??
			params?.['id'] ??
			ctx.request.headers.get('x-workspace-id') ??
			undefined

		if (!workspaceId) return next()

		const workspace = await findWorkspaceById(workspaceId, store)
		if (!workspace) {
			return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)
		}

		if (ctx.user) {
			const member = await getMember(ctx.user.id, workspaceId, store)
			if (!member) {
				return setErrorResponse('FORBIDDEN', 'Not a member of this workspace', 403)
			}
		}

		Object.assign(ctx, { workspace })
		return next()
	}
}
