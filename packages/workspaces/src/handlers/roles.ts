import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import {
	createRole, getRoleById, listWorkspaceRoles,
	updateRole, deleteRole, setRolePermissions,
} from '../services/roles';
import { toRoleDTO } from '../dtos/workspace';

export function createRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const body        = ctx.meta['body'] as Record<string, unknown> | undefined
		const name        = body?.['name']
		const description = body?.['description']

		if (typeof name !== 'string' || name.trim().length === 0) {
			return setErrorResponse('INVALID_PARAMETER', 'name is required', 422)
		}

		try {
			const opts: Parameters<typeof createRole>[0] = {
				name:        name.trim(),
				workspaceId: ctx.workspace.id,
			}
			if (typeof description === 'string') opts.description = description

			const role = await createRole(opts, store)
			return setApiResponse('ROLE_CREATED', 'Role created successfully.', { role: toRoleDTO(role) }, 201)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create role'
			return setErrorResponse('OPERATION_FAILED', message, 400)
		}
	}
}

export function listRolesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const roles = await listWorkspaceRoles(ctx.workspace.id, store)
		return setApiResponse('ROLES_FETCHED', 'Roles retrieved successfully.', {
			roles: roles.map(toRoleDTO),
		})
	}
}

export function getRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return setErrorResponse('INVALID_PARAMETER', 'roleId is required', 422)

		const role = await getRoleById(roleId, store)
		if (!role) return setErrorResponse('NOT_FOUND', 'Role not found', 404)

		return setApiResponse('ROLE_FETCHED', 'Role retrieved successfully.', { role: toRoleDTO(role) })
	}
}

export function updateRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const body   = ctx.meta['body']   as Record<string, unknown> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return setErrorResponse('INVALID_PARAMETER', 'roleId is required', 422)

		const opts: { name?: string; description?: string | null; active?: boolean } = {}
		if (typeof body?.['name']        === 'string')  opts.name        = body['name']
		if (typeof body?.['description'] === 'string')  opts.description = body['description']
		if (body?.['description'] === null)              opts.description = null
		if (typeof body?.['active']      === 'boolean') opts.active      = body['active']

		const role = await updateRole(roleId, opts, store)
		if (!role) return setErrorResponse('NOT_FOUND', 'Role not found or is a system role', 404)

		return setApiResponse('ROLE_UPDATED', 'Role updated successfully.', { role: toRoleDTO(role) })
	}
}

export function deleteRoleHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return setErrorResponse('INVALID_PARAMETER', 'roleId is required', 422)

		await deleteRole(roleId, ctx.workspace.id, store)
		return setApiResponse('ROLE_DELETED', 'Role deleted successfully.')
	}
}

export function setRolePermissionsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const body   = ctx.meta['body']   as Record<string, unknown> | undefined
		const roleId = params?.['roleId']
		if (!roleId) return setErrorResponse('INVALID_PARAMETER', 'roleId is required', 422)

		const perms = body?.['permissions']
		if (!Array.isArray(perms)) {
			return setErrorResponse('INVALID_PARAMETER', 'permissions array is required', 422)
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
		return setApiResponse('PERMISSIONS_SET', 'Role permissions updated successfully.')
	}
}
