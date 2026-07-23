import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import { requireAuth, validate } from '@fonderie/core/middlewares';

import {
	createRoleSchema,
	updateRoleSchema,
	addMemberRoleSchema,
	updateSettingsSchema,
	createWorkspaceSchema,
	updateWorkspaceSchema,
	acceptInvitationSchema,
	createInvitationsSchema,
	setRolePermissionsSchema,
} from './schemas';

import type { IWorkspacesConfig, WorkspaceRouteId } from './config';
import { withWorkspace } from './middlewares/workspace-context';

import { workspaceController } from './controllers/workspace.controller';
import { memberController } from './controllers/member.controller';
import { roleController } from './controllers/role.controller';
import { invitationController } from './controllers/invitation.controller';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildWorkspaceRoutes(
	store: IStoreAdapter,
	config: IWorkspacesConfig,
	bus?: EventBus,
): RouteDefinition[] {
	const ttl = config.invitationTtl ?? '7d';
	const wsCtx = withWorkspace(store);

	const workspace = workspaceController(store, config);
	const member = memberController(store);
	const role = roleController(store);
	const invitation = invitationController(store, ttl, bus);

	// Apply an optional per-route method/path override (config.routes) keyed by a
	// stable id, so an app can match an existing frontend's contract without a shim.
	const R = (id: WorkspaceRouteId, method: string, path: string, ...handlers: Middleware[]): RouteDefinition => {
		const o = config.routes?.[id];
		if (!o) return [method, path, ...handlers];
		if (typeof o === 'string') return [method, o, ...handlers];
		return [o.method ?? method, o.path ?? path, ...handlers];
	};

	return [
		// ── Workspace creation + listing (no workspace context required)
		R('createWorkspace', 'POST', '/workspaces', requireAuth, validate(createWorkspaceSchema), workspace.create),
		R('listWorkspaces', 'GET', '/workspaces', requireAuth, workspace.list),

		// ── Members (workspace resolved from X-Workspace-ID header)
		R('listMembers', 'GET', '/workspaces/members', requireAuth, wsCtx, member.list),
		R('removeMember', 'DELETE', '/workspaces/members/:userId', requireAuth, wsCtx, member.remove),
		R('getMemberRoles', 'GET', '/workspaces/members/:userId/roles', requireAuth, wsCtx, member.getUserRoles),
		R('addMemberRole', 'POST', '/workspaces/members/:userId/roles', requireAuth, wsCtx, validate(addMemberRoleSchema), member.addRole),
		R('removeMemberRole', 'DELETE', '/workspaces/members/:userId/roles/:roleId', requireAuth, wsCtx, member.removeRole),

		// ── Invitations
		R('listInvitations', 'GET', '/workspaces/invitations', requireAuth, wsCtx, invitation.list),
		R('invite', 'POST', '/workspaces/invitations', requireAuth, wsCtx, validate(createInvitationsSchema), invitation.invite),
		R('cancelInvitation', 'DELETE', '/workspaces/invitations/:inviteId', requireAuth, wsCtx, invitation.cancel),
		R('acceptInvitation', 'POST', '/workspaces/invitations/accept', requireAuth, validate(acceptInvitationSchema), invitation.accept),

		// ── Roles
		R('createRole', 'POST', '/workspaces/roles', requireAuth, wsCtx, validate(createRoleSchema), role.create),
		R('listRoles', 'GET', '/workspaces/roles', requireAuth, wsCtx, role.list),
		R('getRole', 'GET', '/workspaces/roles/:roleId', requireAuth, wsCtx, role.get),
		R('updateRole', 'PUT', '/workspaces/roles/:roleId', requireAuth, wsCtx, validate(updateRoleSchema), role.update),
		R('removeRole', 'DELETE', '/workspaces/roles/:roleId', requireAuth, wsCtx, role.remove),
		R('setRolePermissions', 'POST', '/workspaces/roles/:roleId/permissions', requireAuth, wsCtx, validate(setRolePermissionsSchema), role.setPermissions),

		// ── Workspace lifecycle
		R('archive', 'POST', '/workspaces/archive', requireAuth, wsCtx, workspace.archive),
		R('restore', 'POST', '/workspaces/restore', requireAuth, wsCtx, workspace.restore),
		R('getSettings', 'GET', '/workspaces/settings', requireAuth, wsCtx, workspace.getSettings),
		R('updateSettings', 'PUT', '/workspaces/settings', requireAuth, wsCtx, validate(updateSettingsSchema), workspace.updateSettings),

		// ── Path-based lookup by ID (admin / cross-workspace use)
		R('getWorkspace', 'GET', '/workspaces/:id', requireAuth, wsCtx, workspace.get),

		// ── Update current workspace — ID from :id path param (wsCtx) or the
		// X-Workspace-ID header (or personal-workspace fallback when absent). Set
		// routes.updateWorkspace = '/workspaces/:id' to match a path-id frontend.
		R('updateWorkspace', 'PUT', '/workspaces', requireAuth, wsCtx, validate(updateWorkspaceSchema), workspace.update),
	];
}
