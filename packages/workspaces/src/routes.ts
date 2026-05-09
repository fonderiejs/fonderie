import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';
import { requireAuth }         from '@fonderie-js/core/middlewares';

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
	const ttl   = config.invitationTtl ?? '7d'
	const auth  = requireAuth()
	const wsCtx = workspaceContextMiddleware(store)

	const workspace  = workspaceController(store, config)
	const member     = memberController(store)
	const role       = roleController(store)
	const invitation = invitationController(store, ttl)

	return [
		// ── Workspace creation + listing (no workspace context required)
		['POST', '/workspaces',     auth, workspace.create],
		['GET',  '/workspaces',     auth, workspace.list],

		// ── Members (workspace resolved from X-Workspace-ID header)
		['GET',    '/workspaces/members',                            auth, wsCtx, member.list],
		['DELETE', '/workspaces/members/:userId',                    auth, wsCtx, member.remove],
		['GET',    '/workspaces/members/:userId/roles',              auth, wsCtx, member.getUserRoles],
		['POST',   '/workspaces/members/:userId/roles',              auth, wsCtx, member.addRole],
		['DELETE', '/workspaces/members/:userId/roles/:roleId',      auth, wsCtx, member.removeRole],

		// ── Invitations
		['GET',    '/workspaces/invitations',                        auth, wsCtx, invitation.list],
		['POST',   '/workspaces/invitations',                        auth, wsCtx, invitation.invite],
		['DELETE', '/workspaces/invitations/:inviteId',              auth, wsCtx, invitation.cancel],
		['POST',   '/workspaces/invitations/accept',                 auth, invitation.accept],

		// ── Roles
		['POST',   '/workspaces/roles',                              auth, wsCtx, role.create],
		['GET',    '/workspaces/roles',                              auth, wsCtx, role.list],
		['GET',    '/workspaces/roles/:roleId',                      auth, wsCtx, role.get],
		['PUT',    '/workspaces/roles/:roleId',                      auth, wsCtx, role.update],
		['DELETE', '/workspaces/roles/:roleId',                      auth, wsCtx, role.remove],
		['POST',   '/workspaces/roles/:roleId/permissions',          auth, wsCtx, role.setPermissions],

		// ── Workspace lifecycle
		['POST',   '/workspaces/archive',                            auth, wsCtx, workspace.archive],
		['POST',   '/workspaces/restore',                            auth, wsCtx, workspace.restore],
		['GET',    '/workspaces/settings',                           auth, wsCtx, workspace.getSettings],
		['PUT',    '/workspaces/settings',                           auth, wsCtx, workspace.updateSettings],

		// ── Path-based admin routes — MUST be last to avoid shadowing specific routes above
		['GET',  '/workspaces/:id', auth, wsCtx, workspace.get],
		['PUT',  '/workspaces/:id', auth, wsCtx, workspace.update],
	]
}
