import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import {
	createWorkspace, findWorkspacesByUserId,
	updateWorkspace, archiveWorkspace, restoreWorkspace,
	getWorkspaceSettings, updateWorkspaceSettings,
} from '../services/workspaces';
import { addMember }     from '../services/members';
import { createRole }    from '../services/roles';
import type { IWorkspace } from '../types';
import { toWorkspaceDTO, toSettingsDTO } from '../dtos/workspace';

export function listWorkspacesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')

		const workspaces = await findWorkspacesByUserId(ctx.user.id, store)
		return setApiResponse(200, 'WORKSPACES_FETCHED', 'Workspaces retrieved successfully.', {
			workspaces: workspaces.map(toWorkspaceDTO),
		})
	}
}

export function createWorkspaceHandler(store: IStoreAdapter, defaultRole: string) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')

		const body        = ctx.meta['body'] as Record<string, unknown> | undefined
		const name        = body?.['name']
		const description = body?.['description']
		const type        = body?.['type']

		if (typeof name !== 'string' || name.trim().length === 0) {
			return setErrorResponse(422, 'INVALID_PARAMETER', 'name is required')
		}

		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

		const workspace = await store.transaction(async tx => {
			const wsOpts: Parameters<typeof createWorkspace>[0] = {
				name:    name.trim(),
				slug,
				ownerId: ctx.user!.id,
				type:    typeof type === 'string' ? type : 'ORGANIZATION',
			}
			if (typeof description === 'string') wsOpts.description = description

			const ws = await createWorkspace(wsOpts, tx)

			// Create default workspace roles
			const [adminRole] = await Promise.all([
				createRole({ name: 'ADMIN', workspaceId: ws.id, description: 'Workspace administrator' }, tx),
				createRole({ name: defaultRole, workspaceId: ws.id, description: 'Default member role' }, tx),
			])

			// Add creator as ADMIN
			await addMember({ userId: ctx.user!.id, workspaceId: ws.id, roleId: adminRole.id }, tx)

			return ws
		})

		return setApiResponse(200, 'WORKSPACE_CREATED', 'Workspace created successfully.', {
			workspace: toWorkspaceDTO(workspace),
		}, 201)
	}
}

export function getWorkspaceHandler() {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')
		return setApiResponse(200, 'WORKSPACE_FETCHED', 'Workspace retrieved successfully.', {
			workspace: toWorkspaceDTO(ctx.workspace as IWorkspace),
		})
	}
}

export function updateWorkspaceHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		const opts: { name?: string; description?: string | null } = {}

		if (typeof body?.['name'] === 'string') opts.name = body['name'].trim()
		if (body?.['description'] !== undefined) {
			opts.description = typeof body['description'] === 'string'
				? body['description']
				: null
		}

		const workspace = await updateWorkspace(ctx.workspace.id, opts, store)
		if (!workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		return setApiResponse(200, 'WORKSPACE_UPDATED', 'Workspace updated successfully.', {
			workspace: toWorkspaceDTO(workspace),
		})
	}
}

export function archiveWorkspaceHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')
		if (!ctx.user)      return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')

		await archiveWorkspace(ctx.workspace.id, ctx.user.id, store)
		return setApiResponse(200, 'WORKSPACE_ARCHIVED', 'Workspace archived successfully.')
	}
}

export function restoreWorkspaceHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		await restoreWorkspace(ctx.workspace.id, store)
		return setApiResponse(200, 'WORKSPACE_RESTORED', 'Workspace restored successfully.')
	}
}

export function getSettingsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const settings = await getWorkspaceSettings(ctx.workspace.id, store)
		return setApiResponse(200, 'SETTINGS_FETCHED', 'Workspace settings retrieved successfully.', {
			settings: toSettingsDTO(settings),
		})
	}
}

export function updateSettingsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse(404, 'NOT_FOUND', 'Workspace not found')

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		if (!body || Object.keys(body).length === 0) {
			return setErrorResponse(422, 'INVALID_PARAMETER', 'No settings provided')
		}

		const patch: Record<string, string> = {}
		for (const key of ['locale', 'timezone', 'currency', 'dateFormat', 'timeFormat'] as const) {
			if (typeof body[key] === 'string') patch[key] = body[key] as string
		}

		const settings = await updateWorkspaceSettings(ctx.workspace.id, patch, store)
		return setApiResponse(200, 'SETTINGS_UPDATED', 'Workspace settings updated successfully.', {
			settings: toSettingsDTO(settings),
		})
	}
}
