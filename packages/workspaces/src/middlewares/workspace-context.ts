import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { findWorkspaceAccess, findPersonalWorkspace } from '../services/workspaces';
import { rememberAccess } from './access-snapshot';
import { WORKSPACE_ARCHIVED_META_KEY } from './require-active-workspace';

// Resolves ctx.workspace from:
//   1. Route param :workspaceId or :id (path-based admin routes)
//   2. X-Workspace-ID request header (standard resource routes)
// Validates the current user is an active member.
// Must run after withSession.
//
// Also says whether that workspace is archived (read-only), on
// ctx.meta['fonderie.workspaces.archived'], for any brick to honour by shape.

function makeHandler(store: IStoreAdapter): Middleware {
	return async (ctx, next) => {
		const params = ctx.meta['params'] as Record<string, string> | undefined;
		const workspaceId =
			params?.['workspaceId'] ??
			params?.['id'] ??
			ctx.request.headers.get('x-workspace-id') ??
			undefined;

		if (!workspaceId) {
			// DMZ fallback — if the caller didn't specify a workspace, use their personal one.
			// No membership check needed: the user is always the sole owner.
			if (ctx.user) {
				const personal = await findPersonalWorkspace(ctx.user.id, store);
				if (personal) {
					Object.assign(ctx, { workspace: personal });
					ctx.meta[WORKSPACE_ARCHIVED_META_KEY] = personal.archivedAt !== null && personal.archivedAt !== undefined;
				}
			}
			return next();
		}

		// One round-trip: the workspace, the caller's membership, and the system
		// roles requireManager would otherwise read again.
		const found = await findWorkspaceAccess(workspaceId, ctx.user?.id ?? null, store);
		if (!found) {
			return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
		}
		const { workspace } = found;

		if (ctx.user) {
			if (!found.isMember) {
				return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Not a member of this workspace');
			}
			rememberAccess(ctx, { userId: ctx.user.id, workspaceId: workspace.id, systemRoles: found.systemRoles });
		}

		Object.assign(ctx, { workspace });
		ctx.meta[WORKSPACE_ARCHIVED_META_KEY] = workspace.archivedAt !== null && workspace.archivedAt !== undefined;
		return next();
	};
}

export function withWorkspace(store: IStoreAdapter): Middleware;
export function withWorkspace(
	store: IStoreAdapter,
	ctx: IFonderieContext,
	next: () => Promise<Response>,
): Promise<Response>;
export function withWorkspace(
	store: IStoreAdapter,
	ctx?: IFonderieContext,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	const handler = makeHandler(store);
	if (ctx !== undefined && next !== undefined) return handler(ctx, next);
	return handler;
}
