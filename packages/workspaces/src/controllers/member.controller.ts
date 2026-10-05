import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IWorkspacesConfig } from '../config';
import { MemberModel } from '../models/member.model';
import { toMemberDTO, toRoleDTO } from '../dtos/workspace';

export function memberController(store: IStoreAdapter, config: IWorkspacesConfig = {}) {
	const members = new MemberModel(store);
	const managerRoles = config.managerRoles ?? ['ADMIN'];
	// The role granted by "make manager" / kept by a previous owner: the first
	// manager role name (default ADMIN).
	const managerRole = managerRoles[0] ?? 'ADMIN';
	const ownerOf = (ctx: IFonderieContext) => (ctx.workspace as { ownerId?: string } | undefined)?.ownerId;
	const targetUserId = (ctx: IFonderieContext) =>
		(ctx.meta['params'] as Record<string, string> | undefined)?.['userId'];

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const list = await members.list(ctx.workspace.id, managerRoles);
			return setApiResponse(HTTP.OK, 'MEMBERS_FETCHED', 'Members retrieved successfully.', {
				members: list.map(toMemberDTO),
			});
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			if (ctx.workspace.isPersonal) {
				return setApiResponse(
					HTTP.FORBIDDEN,
					'FORBIDDEN',
					'Personal workspaces do not support member management',
				);
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const userId = params?.['userId'];

			if (!userId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');
			if (userId === ctx.user?.id) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_OPERATION', 'Cannot remove yourself');
			}
			// Last-owner guard: removing the workspace owner would orphan the
			// tenant (no member can administer it anymore). Ownership transfer,
			// not removal, is the path for changing who owns a workspace.
			// (withWorkspace assigns the full row; core's IWorkspace type is minimal.)
			const ownerId = (ctx.workspace as { ownerId?: string }).ownerId;
			if (ownerId && userId === ownerId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'INVALID_OPERATION',
					'Cannot remove the workspace owner',
				);
			}

			// Re-checked under the workspace lock: ownership may have moved since
			// this request started (withWorkspace read it).
			const removed = await members.remove(userId, ctx.workspace.id, { actorId: ctx.user!.id, managerRoles });
			if (removed === 'owner') {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_OPERATION', 'Cannot remove the workspace owner');
			}
			if (removed === 'manager') {
				// Managers are peers: one cannot purge the others. The owner removes
				// a manager (or takes their manager rights away first).
				return setApiResponse(HTTP.FORBIDDEN, 'MANAGER_PROTECTED', 'Only the workspace owner can remove a manager.');
			}
			if (removed === 'not-member') {
				return setApiResponse(HTTP.NOT_FOUND, 'MEMBER_NOT_FOUND', 'That person is not a member of this workspace.');
			}
			return setApiResponse(HTTP.OK, 'MEMBER_REMOVED', 'Member removed successfully.');
		},

		async getUserRoles(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const userId = params?.['userId'];
			if (!userId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');

			const roles = await members.getUserRoles(userId, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'ROLES_FETCHED', 'Member roles retrieved successfully.', {
				roles: roles.map(toRoleDTO),
			});
		},

		async addRole(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const userId = params?.['userId'];
			const roleId = (body?.['roleId'] ?? params?.['roleId']) as string | undefined;

			if (!userId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');
			if (!roleId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');

			// Assigning a role is not a way in: the person must already be a
			// member (joined through an invitation they accepted). Otherwise a
			// manager could add anyone to the team without their consent and
			// without the seat check. Checked under the member's lock, in the
			// same transaction as the insert.
			const assigned = await members.addRole(userId, ctx.workspace.id, roleId);
			if (assigned === 'not-member') {
				return setApiResponse(HTTP.NOT_FOUND, 'MEMBER_NOT_FOUND', 'That person is not a member of this workspace.');
			}
			if (assigned === 'invalid-role') {
				// Role doesn't belong to this workspace, is a system role, or doesn't
				// exist — none are assignable through this route (see addRoleToMember).
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_ROLE',
					'Role is not assignable in this workspace.',
				);
			}
			return setApiResponse(HTTP.OK, 'ROLE_ASSIGNED', 'Role assigned successfully.');
		},

		async removeRole(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const userId = params?.['userId'];
			const roleId = params?.['roleId'];

			if (!userId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');
			if (!roleId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');

			const outcome = await members.removeRole(userId, ctx.workspace.id, roleId);
			switch (outcome) {
				case 'removed':
					return setApiResponse(HTTP.OK, 'ROLE_REMOVED', 'Role removed successfully.');
				case 'system-role':
					// Manager rights come off only through the owner's unsetManager.
					return setApiResponse(HTTP.FORBIDDEN, 'SYSTEM_ROLE', 'Built-in roles cannot be removed here. Only the owner can remove manager rights.');
				case 'last-role':
					return setApiResponse(HTTP.BAD_REQUEST, 'LAST_ROLE', 'A member keeps at least one role. Remove the member instead.');
				case 'not-held':
					return setApiResponse(HTTP.NOT_FOUND, 'ROLE_NOT_HELD', 'That person does not hold this role.');
			}
		},

		// Owner only (route guard): make an existing member a manager.
		async setManager(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			const userId = targetUserId(ctx);
			if (!userId) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');
			if (userId === ownerOf(ctx)) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_OPERATION', 'The owner already manages the workspace');
			}
			const ok = await members.setManager(userId, ctx.workspace.id, true, managerRole);
			if (!ok) return setApiResponse(HTTP.NOT_FOUND, 'MEMBER_NOT_FOUND', 'That person is not a member of this workspace.');
			return setApiResponse(HTTP.OK, 'MANAGER_SET', 'Member is now a manager.');
		},

		// Owner only (route guard): a manager goes back to their other roles.
		async unsetManager(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			const userId = targetUserId(ctx);
			if (!userId) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');
			if (userId === ownerOf(ctx)) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_OPERATION', 'Transfer ownership to stop managing the workspace');
			}
			const ok = await members.setManager(userId, ctx.workspace.id, false, managerRole);
			if (!ok) return setApiResponse(HTTP.NOT_FOUND, 'MEMBER_NOT_FOUND', 'That person is not a member of this workspace.');
			return setApiResponse(HTTP.OK, 'MANAGER_UNSET', 'Member is no longer a manager.');
		},

		// Owner only (route guard).
		async transferOwnership(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			if (ctx.workspace.isPersonal) {
				return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'A personal workspace cannot change owner');
			}
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const userId = body?.['userId'];
			if (typeof userId !== 'string' || !userId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'userId is required');
			}
			if (userId === ctx.user!.id) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_OPERATION', 'You already own this workspace');
			}
			const ok = await members.transferOwnership(ctx.workspace.id, ctx.user!.id, userId, managerRole);
			if (!ok) return setApiResponse(HTTP.NOT_FOUND, 'MEMBER_NOT_FOUND', 'Ownership can only go to a member of this workspace.');
			return setApiResponse(HTTP.OK, 'OWNERSHIP_TRANSFERRED', 'Ownership transferred.');
		},

		// Any member, for themselves. The owner hands the workspace over first.
		async leave(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			if (ctx.workspace.isPersonal) {
				return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'You cannot leave your personal workspace');
			}
			if (ctx.user!.id === ownerOf(ctx)) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'OWNER_CANNOT_LEAVE',
					'Transfer ownership to another member before leaving',
				);
			}
			const left = await members.remove(ctx.user!.id, ctx.workspace.id);
			if (left === 'owner') {
				return setApiResponse(HTTP.BAD_REQUEST, 'OWNER_CANNOT_LEAVE', 'Transfer ownership to another member before leaving');
			}
			return setApiResponse(HTTP.OK, 'WORKSPACE_LEFT', 'You left the workspace.');
		},
	};
}
