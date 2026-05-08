import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import {
	listMembers, removeMember,
	getUserRoles, addRoleToMember, removeRoleFromMember,
} from '../services/members';
import { toMemberDTO, toRoleDTO } from '../dtos/workspace';

export function listMembersHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const members = await listMembers(ctx.workspace.id, store)
		return Response.json({ members: members.map(toMemberDTO) })
	}
}

export function removeMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId']

		if (!userId) return Response.json({ error: 'userId is required' }, { status: 422 })
		if (userId === ctx.user?.id) {
			return Response.json({ error: 'Cannot remove yourself' }, { status: 400 })
		}

		await removeMember(userId, ctx.workspace.id, store)
		return Response.json({ ok: true })
	}
}

export function getUserRolesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId']
		if (!userId) return Response.json({ error: 'userId is required' }, { status: 422 })

		const roles = await getUserRoles(userId, ctx.workspace.id, store)
		return Response.json({ roles: roles.map(toRoleDTO) })
	}
}

export function addRoleToMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const body   = ctx.meta['body']   as Record<string, unknown> | undefined
		const userId = params?.['userId']
		const roleId = (body?.['roleId'] ?? params?.['roleId']) as string | undefined

		if (!userId) return Response.json({ error: 'userId is required' }, { status: 422 })
		if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 422 })

		await addRoleToMember(userId, ctx.workspace.id, roleId, store)
		return Response.json({ ok: true })
	}
}

export function removeRoleFromMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId']
		const roleId = params?.['roleId']

		if (!userId) return Response.json({ error: 'userId is required' }, { status: 422 })
		if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 422 })

		try {
			await removeRoleFromMember(userId, ctx.workspace.id, roleId, store)
			return Response.json({ ok: true })
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed'
			return Response.json({ error: message }, { status: 400 })
		}
	}
}
