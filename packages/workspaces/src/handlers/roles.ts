import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import {
	createRole, getRoleById, listWorkspaceRoles,
	updateRole, deleteRole, setRolePermissions,
} from '../services/roles';
import { toRoleDTO } from '../dtos/workspace';

export function createRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const body        = ctx.meta['body'] as Record<string, unknown> | undefined
		const name        = body?.['name']
		const description = body?.['description']

		if (typeof name !== 'string' || name.trim().length === 0) {
			return Response.json({ error: 'name is required' }, { status: 422 })
		}

		try {
			const opts: Parameters<typeof createRole>[0] = {
				name:        name.trim(),
				workspaceId: ctx.workspace.id,
			}
			if (typeof description === 'string') opts.description = description

			const role = await createRole(opts, store)
			return Response.json({ role: toRoleDTO(role) }, { status: 201 })
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create role'
			return Response.json({ error: message }, { status: 400 })
		}
	}
}

export function listRolesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const roles = await listWorkspaceRoles(ctx.workspace.id, store)
		return Response.json({ roles: roles.map(toRoleDTO) })
	}
}

export function getRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 422 })

		const role = await getRoleById(roleId, store)
		if (!role) return Response.json({ error: 'Role not found' }, { status: 404 })

		return Response.json({ role: toRoleDTO(role) })
	}
}

export function updateRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const body   = ctx.meta['body']   as Record<string, unknown> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 422 })

		const opts: { name?: string; description?: string | null; active?: boolean } = {}
		if (typeof body?.['name']        === 'string')  opts.name        = body['name']
		if (typeof body?.['description'] === 'string')  opts.description = body['description']
		if (body?.['description'] === null)              opts.description = null
		if (typeof body?.['active']      === 'boolean') opts.active      = body['active']

		const role = await updateRole(roleId, opts, store)
		if (!role) return Response.json({ error: 'Role not found or is a system role' }, { status: 404 })

		return Response.json({ role: toRoleDTO(role) })
	}
}

export function deleteRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 422 })

		await deleteRole(roleId, ctx.workspace.id, store)
		return new Response(null, { status: 204 })
	}
}

export function setRolePermissionsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const body   = ctx.meta['body']   as Record<string, unknown> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return Response.json({ error: 'roleId is required' }, { status: 422 })

		const perms = body?.['permissions']
		if (!Array.isArray(perms)) {
			return Response.json({ error: 'permissions array is required' }, { status: 422 })
		}

		const normalized = perms.map((p: unknown) => {
			const perm = p as Record<string, unknown>
			return {
				permissionKey: String(perm['permissionKey'] ?? ''),
				canCreate:     Boolean(perm['canCreate']),
				canRead:       Boolean(perm['canRead']),
				canUpdate:     Boolean(perm['canUpdate']),
				canDelete:     Boolean(perm['canDelete']),
			}
		}).filter(p => p.permissionKey.length > 0)

		await setRolePermissions(roleId, ctx.workspace.id, normalized, store)
		return Response.json({ ok: true })
	}
}
