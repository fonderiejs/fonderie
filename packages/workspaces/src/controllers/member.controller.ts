import { setSuccessResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { MemberModel }              from '../models/member.model';
import { toMemberDTO, toRoleDTO }   from '../dtos/workspace';

export function memberController(store: IStoreAdapter) {
	const members = new MemberModel(store)

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const list = await members.list(ctx.workspace.id)
			return setSuccessResponse(200, 'MEMBERS_FETCHED', 'Members retrieved successfully.', {
				members: list.map(toMemberDTO),
			})
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const userId = params?.['userId']

			if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')
			if (userId === ctx.user?.id) {
				return setErrorResponse(400, 'INVALID_OPERATION', 'Cannot remove yourself')
			}

			await members.remove(userId, ctx.workspace.id)
			return setSuccessResponse(200, 'MEMBER_REMOVED', 'Member removed successfully.')
		},

		async getUserRoles(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const userId = params?.['userId']
			if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')

			const roles = await members.getUserRoles(userId, ctx.workspace.id)
			return setSuccessResponse(200, 'ROLES_FETCHED', 'Member roles retrieved successfully.', {
				roles: roles.map(toRoleDTO),
			})
		},

		async addRole(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const body   = ctx.meta['body']   as Record<string, unknown> | undefined
			const userId = params?.['userId']
			const roleId = (body?.['roleId'] ?? params?.['roleId']) as string | undefined

			if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')
			if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

			await members.addRole(userId, ctx.workspace.id, roleId)
			return setSuccessResponse(200, 'ROLE_ASSIGNED', 'Role assigned successfully.')
		},

		async removeRole(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const userId = params?.['userId']
			const roleId = params?.['roleId']

			if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')
			if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

			try {
				await members.removeRole(userId, ctx.workspace.id, roleId)
				return setSuccessResponse(200, 'ROLE_REMOVED', 'Role removed successfully.')
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed'
				return setErrorResponse(400, 'OPERATION_FAILED', message)
			}
		},
	}
}
