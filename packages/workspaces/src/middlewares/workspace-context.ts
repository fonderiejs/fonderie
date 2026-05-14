import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { Middleware } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import { getMember } from '../services/members';
import { findWorkspaceById, findPersonalWorkspace } from '../services/workspaces';

// Resolves ctx.workspace from:
//   1. Route param :workspaceId or :id (path-based admin routes)
//   2. X-Workspace-ID request header (standard resource routes)
// Validates the current user is an active member.
// Must run after withSession.

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
				if (personal) Object.assign(ctx, { workspace: personal });
			}
			return next();
		}

		const workspace = await findWorkspaceById(workspaceId, store);
		if (!workspace) {
			return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
		}

		if (ctx.user) {
			const member = await getMember(ctx.user.id, workspaceId, store);
			if (!member) {
				return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Not a member of this workspace');
			}
		}

		Object.assign(ctx, { workspace });
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
