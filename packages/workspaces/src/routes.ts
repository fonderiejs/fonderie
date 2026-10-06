import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import { requireAuth, validate } from '@fonderie/core/middlewares';
import { HTTP, setApiResponse } from '@fonderie/core';
import { byIp, rateLimit, StoreAdapterStore } from '@fonderie/rate-limit';

import {
	createRoleSchema,
	updateRoleSchema,
	addMemberRoleSchema,
	transferOwnershipSchema,
	updateSettingsSchema,
	createWorkspaceSchema,
	updateWorkspaceSchema,
	addWorkspaceEmailSchema,
	updateWorkspaceEmailSchema,
	addWorkspacePhoneSchema,
	updateWorkspacePhoneSchema,
	createWorkspaceLocationSchema,
	updateWorkspaceLocationSchema,
	acceptInvitationSchema,
	createInvitationsSchema,
	setRolePermissionsSchema,
} from './schemas';

import { EVENT_KEYS, type IWorkspacesConfig, type WorkspaceRouteId } from './config';
import { withWorkspace } from './middlewares/workspace-context';
import { requireManager } from './middlewares/require-manager';
import { requireOwner } from './middlewares/require-owner';
import { contactOf, inviteOf, roleOf, target, trail } from './middlewares/trail';
import { requireStepUp } from './middlewares/require-step-up';
import { releaseBrake, velocityBrake } from './middlewares/velocity-brake';

import { workspaceController } from './controllers/workspace.controller';
import { memberController } from './controllers/member.controller';
import { roleController } from './controllers/role.controller';
import { invitationController } from './controllers/invitation.controller';
import { accessController } from './controllers/access.controller';
import { contactsController } from './controllers/contacts.controller';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildWorkspaceRoutes(
	store: IStoreAdapter,
	config: IWorkspacesConfig,
	bus?: EventBus,
): RouteDefinition[] {
	const ttl = config.invitationTtl ?? '7d';
	const wsCtx = withWorkspace(store);

	// RBAC: privileged (mutating) workspace routes are MANAGER actions — the
	// owner or a holder of an active system role. Reads stay any-member.
	// Opt out with config.management: 'any-member'.
	const manager = requireManager(store, config);

	// Brute-force guard for invitation acceptance: the PIN variant is a 6-digit
	// code (email-bound, but still low-entropy), so the route is IP-throttled —
	// 10 attempts / 15 min, same shape as auth's login/verify limiters.
	const acceptLimit = rateLimit({
		store: new StoreAdapterStore(store),
		rule: { capacity: 10, refillPerSec: 10 / (15 * 60) },
		key: byIp('workspaces:invitation-accept'),
	});

	const workspace = workspaceController(store, config);
	const owner = requireOwner();
	// Big moves need a fresh proof it's the person (Phase 4); stepUp: false opts out.
	const stepUp: Middleware = config.stepUp === false ? (_c, next) => next() : requireStepUp();
	const member = memberController(store, config);
	const role = roleController(store);
	const access = accessController(store, config);
	const contacts = contactsController(store);
	const invitation = invitationController(store, ttl, bus, {
		...(config.invitationUrl ? { invitationUrl: config.invitationUrl } : {}),
		...(config.invitationAccountMatch ? { invitationAccountMatch: config.invitationAccountMatch } : {}),
	});

	// Apply an optional per-route method/path override (config.routes) keyed by a
	// stable id, so an app can match an existing frontend's contract without a shim.
	const R = (id: WorkspaceRouteId, method: string, path: string, ...handlers: Middleware[]): RouteDefinition => {
		const o = config.routes?.[id];
		if (!o) return [method, path, ...handlers];
		if (typeof o === 'string') return [method, o, ...handlers];
		return [o.method ?? method, o.path ?? path, ...handlers];
	};

	// The trail: one event after each successful change (ids only).
	const T = (type: string, facts?: Parameters<typeof trail>[2], workspaceOf?: Parameters<typeof trail>[3]) =>
		trail(bus, type, facts, workspaceOf);
	const K = EVENT_KEYS;
	// The velocity brake (Phase 5) on everything that destroys.
	const brake = (kind: string) => velocityBrake(store, kind, config.velocityBrake ?? {}, bus);

	return [
		// ── Workspace creation + listing (no workspace context required)
		R('createWorkspace', 'POST', '/workspaces', requireAuth, validate(createWorkspaceSchema), T(K.workspaceCreated, () => ({}), (r) => (r?.['workspace'] as { id?: string } | undefined)?.id), workspace.create),
		R('listWorkspaces', 'GET', '/workspaces', requireAuth, workspace.list),

		// ── Members (workspace resolved from X-Workspace-ID header)
		R('listMembers', 'GET', '/workspaces/members', requireAuth, wsCtx, member.list),
		R('removeMember', 'DELETE', '/workspaces/members/:userId', requireAuth, wsCtx, manager, brake('member.remove'), T(K.memberRemoved, target), member.remove),
		R('getMemberRoles', 'GET', '/workspaces/members/:userId/roles', requireAuth, wsCtx, member.getUserRoles),
		R('addMemberRole', 'POST', '/workspaces/members/:userId/roles', requireAuth, wsCtx, manager, validate(addMemberRoleSchema), T(K.memberRoleAdded, (c) => ({ ...target(c), ...roleOf(c) })), member.addRole),
		R('removeMemberRole', 'DELETE', '/workspaces/members/:userId/roles/:roleId', requireAuth, wsCtx, manager, T(K.memberRoleRemoved, (c) => ({ ...target(c), ...roleOf(c) })), member.removeRole),
		// Ownership decisions — the owner alone (requireOwner), not any manager.
		// The owner lets someone the velocity brake paused delete again.
		R('releaseBrake', 'DELETE', '/workspaces/members/:userId/brake', requireAuth, wsCtx, owner, T(K.managerReleased, target), async (ctx) => {
			const userId = (ctx.meta['params'] as Record<string, string> | undefined)?.['userId'] ?? '';
			return (await releaseBrake(store, ctx.workspace!.id, userId))
				? setApiResponse(HTTP.OK, 'MANAGER_RELEASED', 'They can delete again.')
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_PAUSED', 'That person is not paused.');
		}),
		R('setManager', 'POST', '/workspaces/members/:userId/manager', requireAuth, wsCtx, owner, T(K.managerSet, target), member.setManager),
		R('unsetManager', 'DELETE', '/workspaces/members/:userId/manager', requireAuth, wsCtx, owner, T(K.managerUnset, target), member.unsetManager),
		// Handing the team over (Phase 4): the owner OFFERS, after confirming it's
		// them; the member accepts. Static paths before /workspaces/:id.
		R('transferOwnership', 'POST', '/workspaces/transfer-ownership', requireAuth, wsCtx, owner, stepUp, validate(transferOwnershipSchema), T(K.ownershipOffered, (c) => ({ targetUserId: (c.meta['body'] as { userId?: string } | undefined)?.userId })), member.transferOwnership),
		R('getOwnershipOffer', 'GET', '/workspaces/transfer-ownership', requireAuth, wsCtx, member.getOwnershipOffer),
		R('acceptOwnership', 'POST', '/workspaces/transfer-ownership/accept', requireAuth, wsCtx, T(K.ownershipTransferred, (_c, r) => ({ targetUserId: r?.['previousOwnerId'] as string | undefined })), member.acceptOwnership),
		R('declineOwnership', 'POST', '/workspaces/transfer-ownership/decline', requireAuth, wsCtx, T(K.ownershipDeclined), member.declineOwnership),
		R('withdrawOwnershipOffer', 'DELETE', '/workspaces/transfer-ownership', requireAuth, wsCtx, owner, T(K.ownershipWithdrawn), member.withdrawOwnershipOffer),
		// Any member, for themselves.
		R('leaveWorkspace', 'POST', '/workspaces/leave', requireAuth, wsCtx, T(K.memberLeft), member.leave),

		// ── Invitations
		R('listInvitations', 'GET', '/workspaces/invitations', requireAuth, wsCtx, invitation.list),
		R('invite', 'POST', '/workspaces/invitations', requireAuth, wsCtx, manager, validate(createInvitationsSchema), T(K.invitationCreated, (_c, r) => ({ inviteIds: ((r?.['invitations'] as Array<{ invitationId: string }> | undefined) ?? []).map((i) => i.invitationId) })), invitation.invite),
		R('cancelInvitation', 'DELETE', '/workspaces/invitations/:inviteId', requireAuth, wsCtx, manager, brake('invitation.cancel'), T(K.invitationCancelled, inviteOf), invitation.cancel),
		R('resendInvitation', 'POST', '/workspaces/invitations/:inviteId/resend', requireAuth, wsCtx, manager, T(K.invitationResent, inviteOf), invitation.resend),
		R('acceptInvitation', 'POST', '/workspaces/invitations/accept', acceptLimit, requireAuth, validate(acceptInvitationSchema), T(K.invitationAccepted, () => ({}), (r) => r?.['workspaceId'] as string | undefined), invitation.accept),

		// ── Roles
		// The undo bin — BEFORE /workspaces/roles/:roleId (the router is first-match).
		R('listRoleBin', 'GET', '/workspaces/roles/bin', requireAuth, wsCtx, manager, role.listBin),
		R('restoreRole', 'POST', '/workspaces/roles/bin/:roleId/restore', requireAuth, wsCtx, manager, T(K.roleRestored, roleOf), role.restore),
		R('purgeRoleFromBin', 'DELETE', '/workspaces/roles/bin/:roleId', requireAuth, wsCtx, owner, T(K.roleBinPurged, roleOf), role.purge),
		R('createRole', 'POST', '/workspaces/roles', requireAuth, wsCtx, manager, validate(createRoleSchema), T(K.roleCreated, (_c, r) => ({ roleId: (r?.['role'] as { id?: string } | undefined)?.id })), role.create),
		R('listRoles', 'GET', '/workspaces/roles', requireAuth, wsCtx, role.list),
		R('getRole', 'GET', '/workspaces/roles/:roleId', requireAuth, wsCtx, role.get),
		R('updateRole', 'PUT', '/workspaces/roles/:roleId', requireAuth, wsCtx, manager, validate(updateRoleSchema), T(K.roleUpdated, roleOf), role.update),
		R('removeRole', 'DELETE', '/workspaces/roles/:roleId', requireAuth, wsCtx, manager, brake('role.delete'), T(K.roleDeleted, roleOf), role.remove),
		R('getRolePermissions', 'GET', '/workspaces/roles/:roleId/permissions', requireAuth, wsCtx, role.getPermissions),
		R('setRolePermissions', 'POST', '/workspaces/roles/:roleId/permissions', requireAuth, wsCtx, manager, validate(setRolePermissionsSchema), T(K.rolePermissionsSet, roleOf), role.setPermissions),

		// ── Workspace lifecycle
		// Owner only: archiving locks every member out (docs/INSIDER-THREAT-DESIGN.md, I2).
		R('archive', 'POST', '/workspaces/archive', requireAuth, wsCtx, owner, T(K.workspaceArchived), workspace.archive),
		R('restore', 'POST', '/workspaces/restore', requireAuth, wsCtx, manager, T(K.workspaceRestored), workspace.restore),
		R('getSettings', 'GET', '/workspaces/settings', requireAuth, wsCtx, workspace.getSettings),
		R('updateSettings', 'PUT', '/workspaces/settings', requireAuth, wsCtx, manager, validate(updateSettingsSchema), T(K.settingsUpdated), workspace.updateSettings),

		// ── Contacts & locations (X-Workspace-ID). Members read; managers write.
		// Params are :emailId / :phoneId / :locationId — never :id, which
		// withWorkspace would read as the workspace. Before /workspaces/:id.
		R('getContacts', 'GET', '/workspaces/contacts', requireAuth, wsCtx, contacts.list),
		R('addEmail', 'POST', '/workspaces/emails', requireAuth, wsCtx, manager, validate(addWorkspaceEmailSchema), T(K.emailAdded, contactOf('email')), contacts.addEmail),
		R('updateEmail', 'PATCH', '/workspaces/emails/:emailId', requireAuth, wsCtx, manager, validate(updateWorkspaceEmailSchema), T(K.emailUpdated, contactOf('email')), contacts.updateEmail),
		R('removeEmail', 'DELETE', '/workspaces/emails/:emailId', requireAuth, wsCtx, manager, T(K.emailRemoved, contactOf('email')), contacts.removeEmail),
		R('addPhone', 'POST', '/workspaces/phones', requireAuth, wsCtx, manager, validate(addWorkspacePhoneSchema), T(K.phoneAdded, contactOf('phone')), contacts.addPhone),
		R('updatePhone', 'PATCH', '/workspaces/phones/:phoneId', requireAuth, wsCtx, manager, validate(updateWorkspacePhoneSchema), T(K.phoneUpdated, contactOf('phone')), contacts.updatePhone),
		R('removePhone', 'DELETE', '/workspaces/phones/:phoneId', requireAuth, wsCtx, manager, T(K.phoneRemoved, contactOf('phone')), contacts.removePhone),
		R('createLocation', 'POST', '/workspaces/locations', requireAuth, wsCtx, manager, validate(createWorkspaceLocationSchema), T(K.locationCreated, contactOf('location')), contacts.createLocation),
		R('updateLocation', 'PATCH', '/workspaces/locations/:locationId', requireAuth, wsCtx, manager, validate(updateWorkspaceLocationSchema), T(K.locationUpdated, contactOf('location')), contacts.updateLocation),
		R('archiveLocation', 'POST', '/workspaces/locations/:locationId/archive', requireAuth, wsCtx, manager, T(K.locationArchived, contactOf('location')), contacts.archiveLocation),
		R('restoreLocation', 'POST', '/workspaces/locations/:locationId/restore', requireAuth, wsCtx, manager, T(K.locationRestored, contactOf('location')), contacts.restoreLocation),

		// ── The workspace this request is scoped to (X-Workspace-ID, or the
		// personal workspace). Before /workspaces/:id so 'current' is not an id.
		R('getCurrentWorkspace', 'GET', '/workspaces/current', requireAuth, wsCtx, workspace.get),
		// What the signed-in member may do here (useCan), and the resources the
		// app checks (the role editor's grid).
		R('getMyPermissions', 'GET', '/workspaces/current/permissions', requireAuth, wsCtx, access.mine),
		R('getPermissionCatalog', 'GET', '/workspaces/permissions/catalog', requireAuth, wsCtx, access.catalog),

		// ── Path-based lookup by ID (admin / cross-workspace use)
		R('getWorkspace', 'GET', '/workspaces/:id', requireAuth, wsCtx, workspace.get),

		// ── Update current workspace — ID from :id path param (wsCtx) or the
		// X-Workspace-ID header (or personal-workspace fallback when absent). Set
		// routes.updateWorkspace = '/workspaces/:id' to match a path-id frontend.
		R('updateWorkspace', 'PUT', '/workspaces', requireAuth, wsCtx, manager, validate(updateWorkspaceSchema), T(K.workspaceUpdated), workspace.update),
	];
}
