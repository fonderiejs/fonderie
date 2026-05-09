import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';
import { requireAuth }   from '@fonderie-js/core/middlewares';

import type { IWorkspacesConfig } from './config';
import { withWorkspace }          from './middlewares/workspace-context';

import { workspaceController }  from './controllers/workspace.controller';
import { memberController }     from './controllers/member.controller';
import { roleController }       from './controllers/role.controller';
import { invitationController } from './controllers/invitation.controller';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildWorkspaceRoutes(
	store:  IStoreAdapter,
	config: IWorkspacesConfig,
): RouteDefinition[] {
	const ttl   = config.invitationTtl ?? '7d'
	const wsCtx = withWorkspace(store)

	const workspace  = workspaceController(store, config)
	const member     = memberController(store)
	const role       = roleController(store)
	const invitation = invitationController(store, ttl)

	return [
		// ── Workspace creation + listing (no workspace context required)
		['POST', '/workspaces',     requireAuth,workspace.create],
		['GET',  '/workspaces',     requireAuth,workspace.list],

		// ── Members (workspace resolved from X-Workspace-ID header)
		['GET',    '/workspaces/members',                            requireAuth,wsCtx, member.list],
		['DELETE', '/workspaces/members/:userId',                    requireAuth,wsCtx, member.remove],
		['GET',    '/workspaces/members/:userId/roles',              requireAuth,wsCtx, member.getUserRoles],
		['POST',   '/workspaces/members/:userId/roles',              requireAuth,wsCtx, member.addRole],
		['DELETE', '/workspaces/members/:userId/roles/:roleId',      requireAuth,wsCtx, member.removeRole],

		// ── Invitations
		['GET',    '/workspaces/invitations',                        requireAuth,wsCtx, invitation.list],
		['POST',   '/workspaces/invitations',                        requireAuth,wsCtx, invitation.invite],
		['DELETE', '/workspaces/invitations/:inviteId',              requireAuth,wsCtx, invitation.cancel],
		['POST',   '/workspaces/invitations/accept',                 requireAuth,invitation.accept],

		// ── Roles
		['POST',   '/workspaces/roles',                              requireAuth,wsCtx, role.create],
		['GET',    '/workspaces/roles',                              requireAuth,wsCtx, role.list],
		['GET',    '/workspaces/roles/:roleId',                      requireAuth,wsCtx, role.get],
		['PUT',    '/workspaces/roles/:roleId',                      requireAuth,wsCtx, role.update],
		['DELETE', '/workspaces/roles/:roleId',                      requireAuth,wsCtx, role.remove],
		['POST',   '/workspaces/roles/:roleId/permissions',          requireAuth,wsCtx, role.setPermissions],

		// ── Workspace lifecycle
		['POST',   '/workspaces/archive',                            requireAuth,wsCtx, workspace.archive],
		['POST',   '/workspaces/restore',                            requireAuth,wsCtx, workspace.restore],
		['GET',    '/workspaces/settings',                           requireAuth,wsCtx, workspace.getSettings],
		['PUT',    '/workspaces/settings',                           requireAuth,wsCtx, workspace.updateSettings],

		// ── Path-based admin routes — MUST be last to avoid shadowing specific routes above
		['GET',  '/workspaces/:id', requireAuth,wsCtx, workspace.get],
		['PUT',  '/workspaces/:id', requireAuth,wsCtx, workspace.update],
	]
}
