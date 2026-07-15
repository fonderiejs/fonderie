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

import type { IWorkspacesConfig } from './config';
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

	return [
		// ── Workspace creation + listing (no workspace context required)
		['POST', '/workspaces', requireAuth, validate(createWorkspaceSchema), workspace.create],
		['GET', '/workspaces', requireAuth, workspace.list],

		// ── Members (workspace resolved from X-Workspace-ID header)
		['GET', '/workspaces/members', requireAuth, wsCtx, member.list],
		['DELETE', '/workspaces/members/:userId', requireAuth, wsCtx, member.remove],
		['GET', '/workspaces/members/:userId/roles', requireAuth, wsCtx, member.getUserRoles],
		['POST', '/workspaces/members/:userId/roles', requireAuth, wsCtx, validate(addMemberRoleSchema), member.addRole],
		['DELETE', '/workspaces/members/:userId/roles/:roleId', requireAuth, wsCtx, member.removeRole],

		// ── Invitations
		['GET', '/workspaces/invitations', requireAuth, wsCtx, invitation.list],
		['POST', '/workspaces/invitations', requireAuth, wsCtx, validate(createInvitationsSchema), invitation.invite],
		['DELETE', '/workspaces/invitations/:inviteId', requireAuth, wsCtx, invitation.cancel],
		['POST', '/workspaces/invitations/accept', requireAuth, validate(acceptInvitationSchema), invitation.accept],

		// ── Roles
		['POST', '/workspaces/roles', requireAuth, wsCtx, validate(createRoleSchema), role.create],
		['GET', '/workspaces/roles', requireAuth, wsCtx, role.list],
		['GET', '/workspaces/roles/:roleId', requireAuth, wsCtx, role.get],
		['PUT', '/workspaces/roles/:roleId', requireAuth, wsCtx, validate(updateRoleSchema), role.update],
		['DELETE', '/workspaces/roles/:roleId', requireAuth, wsCtx, role.remove],
		['POST', '/workspaces/roles/:roleId/permissions', requireAuth, wsCtx, validate(setRolePermissionsSchema), role.setPermissions],

		// ── Workspace lifecycle
		['POST', '/workspaces/archive', requireAuth, wsCtx, workspace.archive],
		['POST', '/workspaces/restore', requireAuth, wsCtx, workspace.restore],
		['GET', '/workspaces/settings', requireAuth, wsCtx, workspace.getSettings],
		['PUT', '/workspaces/settings', requireAuth, wsCtx, validate(updateSettingsSchema), workspace.updateSettings],

		// ── Path-based lookup by ID (admin / cross-workspace use)
		['GET', '/workspaces/:id', requireAuth, wsCtx, workspace.get],

		// ── Update current workspace — ID resolved from X-Workspace-ID header
		// (or personal workspace fallback when header is absent)
		['PUT', '/workspaces', requireAuth, wsCtx, validate(updateWorkspaceSchema), workspace.update],
	];
}
