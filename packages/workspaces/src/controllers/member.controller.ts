import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { MemberModel } from '../models/member.model';
import { toMemberDTO, toRoleDTO } from '../dtos/workspace';

export function memberController(store: IStoreAdapter) {
	const members = new MemberModel(store);

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const list = await members.list(ctx.workspace.id);
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

			await members.remove(userId, ctx.workspace.id);
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

			await members.addRole(userId, ctx.workspace.id, roleId);
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

			try {
				await members.removeRole(userId, ctx.workspace.id, roleId);
				return setApiResponse(HTTP.OK, 'ROLE_REMOVED', 'Role removed successfully.');
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed';
				return setApiResponse(HTTP.BAD_REQUEST, 'OPERATION_FAILED', message);
			}
		},
	};
}
