import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import type { IWorkspacesConfig }        from './config';
import { workspaceContextMiddleware }    from './middlewares/workspace-context';

import {
	listWorkspacesHandler, createWorkspaceHandler, getWorkspaceHandler,
	updateWorkspaceHandler, archiveWorkspaceHandler, restoreWorkspaceHandler,
	getSettingsHandler, updateSettingsHandler,
} from './handlers/workspaces';
import {
	listMembersHandler, removeMemberHandler,
	getUserRolesHandler, addRoleToMemberHandler, removeRoleFromMemberHandler,
} from './handlers/members';
import {
	listInvitationsHandler, inviteMemberHandler,
	cancelInvitationHandler, acceptInvitationHandler,
} from './handlers/invitations';
import {
	createRoleHandler, listRolesHandler, getRoleHandler,
	updateRoleHandler, deleteRoleHandler, setRolePermissionsHandler,
} from './handlers/roles';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildWorkspaceRoutes(
	store:  IStoreAdapter,
	config: IWorkspacesConfig,
): RouteDefinition[] {
	const ttl         = config.invitationTtl ?? '7d'
	const defaultRole = config.defaultRole   ?? 'member'
	const wsCtx       = workspaceContextMiddleware(store)

	return [
		// ── Workspace creation + listing (no workspace context required)
		['POST', '/workspaces',     createWorkspaceHandler(store, defaultRole)],
		['GET',  '/workspaces',     listWorkspacesHandler(store)],

		// ── Members (workspace resolved from X-Workspace-ID header)
		['GET',    '/workspaces/members',                            wsCtx, listMembersHandler(store)],
		['DELETE', '/workspaces/members/:userId',                    wsCtx, removeMemberHandler(store)],
		['GET',    '/workspaces/members/:userId/roles',              wsCtx, getUserRolesHandler(store)],
		['POST',   '/workspaces/members/:userId/roles',              wsCtx, addRoleToMemberHandler(store)],
		['DELETE', '/workspaces/members/:userId/roles/:roleId',      wsCtx, removeRoleFromMemberHandler(store)],

		// ── Invitations
		['GET',    '/workspaces/invitations',                        wsCtx, listInvitationsHandler(store)],
		['POST',   '/workspaces/invitations',                        wsCtx, inviteMemberHandler(store, ttl)],
		['DELETE', '/workspaces/invitations/:inviteId',              wsCtx, cancelInvitationHandler(store)],
		['POST',   '/workspaces/invitations/accept',                       acceptInvitationHandler(store)],

		// ── Roles
		['POST',   '/workspaces/roles',                              wsCtx, createRoleHandler(store)],
		['GET',    '/workspaces/roles',                              wsCtx, listRolesHandler(store)],
		['GET',    '/workspaces/roles/:roleId',                      wsCtx, getRoleHandler(store)],
		['PUT',    '/workspaces/roles/:roleId',                      wsCtx, updateRoleHandler(store)],
		['DELETE', '/workspaces/roles/:roleId',                      wsCtx, deleteRoleHandler(store)],
		['POST',   '/workspaces/roles/:roleId/permissions',          wsCtx, setRolePermissionsHandler(store)],

		// ── Workspace lifecycle
		['POST',   '/workspaces/archive',                            wsCtx, archiveWorkspaceHandler(store)],
		['POST',   '/workspaces/restore',                            wsCtx, restoreWorkspaceHandler(store)],
		['GET',    '/workspaces/settings',                           wsCtx, getSettingsHandler(store)],
		['PUT',    '/workspaces/settings',                           wsCtx, updateSettingsHandler(store)],

		// ── Path-based admin routes — MUST be last to avoid shadowing specific routes above
		['GET',  '/workspaces/:id', wsCtx, getWorkspaceHandler()],
		['PUT',  '/workspaces/:id', wsCtx, updateWorkspaceHandler(store)],
	]
}
