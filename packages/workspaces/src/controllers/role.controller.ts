import { setSuccessResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { RoleModel }    from '../models/role.model';
import { toRoleDTO }    from '../dtos/workspace';

export function roleController(store: IStoreAdapter) {
	const roles = new RoleModel(store)

	return {
		async create(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const body        = ctx.meta['body'] as Record<string, unknown> | undefined
			const name        = body?.['name']
			const description = body?.['description']

			if (typeof name !== 'string' || name.trim().length === 0) {
				return setErrorResponse(422, 'INVALID_PARAMETER', 'name is required')
			}

			try {
				const opts: Parameters<typeof roles.create>[0] = {
					name:        name.trim(),
					workspaceId: ctx.workspace.id,
				}
				if (typeof description === 'string') opts.description = description

				const role = await roles.create(opts)
				return setSuccessResponse(201, 'ROLE_CREATED', 'Role created successfully.', { role: toRoleDTO(role) })
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to create role'
				return setErrorResponse(400, 'OPERATION_FAILED', message)
			}
		},

		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const list = await roles.list(ctx.workspace.id)
			return setSuccessResponse(200, 'ROLES_FETCHED', 'Roles retrieved successfully.', {
				roles: list.map(toRoleDTO),
			})
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const roleId = params?.['roleId']
			if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

			const role = await roles.findById(roleId)
			if (!role) return setErrorResponse(404, 'NOT_FOUND', 'Role not found')

			return setSuccessResponse(200, 'ROLE_FETCHED', 'Role retrieved successfully.', { role: toRoleDTO(role) })
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const body   = ctx.meta['body']   as Record<string, unknown> | undefined
			const roleId = params?.['roleId']
			if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

			const opts: { name?: string; description?: string | null; active?: boolean } = {}
			if (typeof body?.['name']        === 'string')  opts.name        = body['name']
			if (typeof body?.['description'] === 'string')  opts.description = body['description']
			if (body?.['description'] === null)              opts.description = null
			if (typeof body?.['active']      === 'boolean') opts.active      = body['active']

			const role = await roles.update(roleId, opts)
			if (!role) return setErrorResponse(404, 'NOT_FOUND', 'Role not found or is a system role')

			return setSuccessResponse(200, 'ROLE_UPDATED', 'Role updated successfully.', { role: toRoleDTO(role) })
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const roleId = params?.['roleId']
			if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

			await roles.delete(roleId, ctx.workspace.id)
			return setSuccessResponse(200, 'ROLE_DELETED', 'Role deleted successfully.')
		},

		async setPermissions(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

			const params = ctx.meta['params'] as Record<string, string> | undefined
			const body   = ctx.meta['body']   as Record<string, unknown> | undefined
			const roleId = params?.['roleId']
			if (!roleId) return setErrorResponse(422, 'INVALID_PARAMETER', 'roleId is required')

			const perms = body?.['permissions']
			if (!Array.isArray(perms)) {
				return setErrorResponse(422, 'INVALID_PARAMETER', 'permissions array is required')
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

			await roles.setPermissions(roleId, ctx.workspace.id, normalized)
			return setSuccessResponse(200, 'PERMISSIONS_SET', 'Role permissions updated successfully.')
		},
	}
}
