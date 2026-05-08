import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import {
	getWorkspaceHandler,
	listWorkspacesHandler,
	createWorkspaceHandler,
} from './handlers/workspaces';
import type { WorkspacesConfig } from './config';
import { workspaceContextMiddleware } from './middlewares/workspace-context';
import { listMembersHandler, removeMemberHandler }     from './handlers/members';
import { inviteMemberHandler, acceptInvitationHandler } from './handlers/invitations';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildWorkspaceRoutes(
	store:  IStoreAdapter,
	config: WorkspacesConfig,
): RouteDefinition[] {
	const ttl         = config.invitationTtl ?? '7d';
	const defaultRole = config.defaultRole   ?? 'member';
	const wsCtx       = workspaceContextMiddleware(store);

	return [
		// Workspace CRUD
		['GET',  '/workspaces',     listWorkspacesHandler(store)],
		['POST', '/workspaces',     createWorkspaceHandler(store, defaultRole)],
		['GET',  '/workspaces/:workspaceId', wsCtx, getWorkspaceHandler()],

		// Members
		['GET',    '/workspaces/:workspaceId/members',          wsCtx, listMembersHandler(store)],
		['DELETE', '/workspaces/:workspaceId/members/:userId',  wsCtx, removeMemberHandler(store)],

		// Invitations
		['POST', '/workspaces/:workspaceId/invitations', wsCtx, inviteMemberHandler(store, ttl)],
		['POST', '/invitations/accept',                        acceptInvitationHandler(store)],
	];
}
