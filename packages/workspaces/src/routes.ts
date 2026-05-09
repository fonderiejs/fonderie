import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import type { IWorkspacesConfig } from './config';
import { workspaceContextMiddleware } from './middlewares/workspace-context';

import { workspaceController }  from './controllers/workspace.controller';
import { memberController }     from './controllers/member.controller';
import { roleController }       from './controllers/role.controller';
import { invitationController } from './controllers/invitation.controller';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildWorkspaceRoutes(
	store:  IStoreAdapter,
	config: IWorkspacesConfig,
): RouteDefinition[] {
	const ttl  = config.invitationTtl ?? '7d'
	const wsCtx = workspaceContextMiddleware(store)

	const workspace  = workspaceController(store, config)
	const member     = memberController(store)
	const role       = roleController(store)
	const invitation = invitationController(store, ttl)

	return [
		// ── Workspace creation + listing (no workspace context required)
		['POST', '/workspaces',     workspace.create],
		['GET',  '/workspaces',     workspace.list],

		// ── Members (workspace resolved from X-Workspace-ID header)
		['GET',    '/workspaces/members',                            wsCtx, member.list],
		['DELETE', '/workspaces/members/:userId',                    wsCtx, member.remove],
		['GET',    '/workspaces/members/:userId/roles',              wsCtx, member.getUserRoles],
		['POST',   '/workspaces/members/:userId/roles',              wsCtx, member.addRole],
		['DELETE', '/workspaces/members/:userId/roles/:roleId',      wsCtx, member.removeRole],

		// ── Invitations
		['GET',    '/workspaces/invitations',                        wsCtx, invitation.list],
		['POST',   '/workspaces/invitations',                        wsCtx, invitation.invite],
		['DELETE', '/workspaces/invitations/:inviteId',              wsCtx, invitation.cancel],
		['POST',   '/workspaces/invitations/accept',                       invitation.accept],

		// ── Roles
		['POST',   '/workspaces/roles',                              wsCtx, role.create],
		['GET',    '/workspaces/roles',                              wsCtx, role.list],
		['GET',    '/workspaces/roles/:roleId',                      wsCtx, role.get],
		['PUT',    '/workspaces/roles/:roleId',                      wsCtx, role.update],
		['DELETE', '/workspaces/roles/:roleId',                      wsCtx, role.remove],
		['POST',   '/workspaces/roles/:roleId/permissions',          wsCtx, role.setPermissions],

		// ── Workspace lifecycle
		['POST',   '/workspaces/archive',                            wsCtx, workspace.archive],
		['POST',   '/workspaces/restore',                            wsCtx, workspace.restore],
		['GET',    '/workspaces/settings',                           wsCtx, workspace.getSettings],
		['PUT',    '/workspaces/settings',                           wsCtx, workspace.updateSettings],

		// ── Path-based admin routes — MUST be last to avoid shadowing specific routes above
		['GET',  '/workspaces/:id', wsCtx, workspace.get],
		['PUT',  '/workspaces/:id', wsCtx, workspace.update],
	]
}
