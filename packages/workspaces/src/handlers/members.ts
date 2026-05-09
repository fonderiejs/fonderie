import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import {
	listMembers, removeMember,
	getUserRoles, addRoleToMember, removeRoleFromMember,
} from '../services/members';
import { toMemberDTO, toRoleDTO } from '../dtos/workspace';

export function listMembersHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const members = await listMembers(ctx.workspace.id, store)
		return setApiResponse(200, 'MEMBERS_FETCHED', 'Members retrieved successfully.', {
			members: members.map(toMemberDTO),
		})
	}
}

export function removeMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId']

		if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')
		if (userId === ctx.user?.id) {
			return setErrorResponse(400, 'INVALID_OPERATION', 'Cannot remove yourself')
		}

		await removeMember(userId, ctx.workspace.id, store)
		return setApiResponse(200, 'MEMBER_REMOVED', 'Member removed successfully.')
	}
}

export function getUserRolesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId']
		if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')

		const roles = await getUserRoles(userId, ctx.workspace.id, store)
		return setApiResponse(200, 'ROLES_FETCHED', 'Member roles retrieved successfully.', {
			roles: roles.map(toRoleDTO),
		})
	}
}

export function addRoleToMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const body   = ctx.meta['body']   as Record<string, unknown> | undefined
		const userId = params?.['userId']
		const roleId = (body?.['roleId'] ?? params?.['roleId']) as string | undefined

		if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')
		if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

		await addRoleToMember(userId, ctx.workspace.id, roleId, store)
		return setApiResponse(200, 'ROLE_ASSIGNED', 'Role assigned successfully.')
	}
}

export function removeRoleFromMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId']
		const roleId = params?.['roleId']

		if (!userId) return setErrorResponse(422, 'INVALID_PARAMETER', 'userId is required')
		if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

		try {
			await removeRoleFromMember(userId, ctx.workspace.id, roleId, store)
			return setApiResponse(200, 'ROLE_REMOVED', 'Role removed successfully.')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed'
			return setErrorResponse('OPERATION_FAILED', message, 400)
		}
	}
}
